import fs from 'node:fs/promises'
import { loadAuthoritySnapshot } from '../config/database.js'
import { getPlatformPool, hasPlatformDatabaseUrl, closePlatformPool } from '../repositories/platformCollectionRepository.js'

let timer = null
const date = value => value || new Date().toISOString()
const json = value => JSON.stringify(value || {})

export async function syncFinanceProjection() {
  if (!hasPlatformDatabaseUrl()) return { enabled: false }
  const db = await loadAuthoritySnapshot(); const client = await getPlatformPool().connect()
  const sets = { wallets: db.walletAccounts || [], ledger: db.creditLedger || [], reservations: db.usageReservations || [], payments: db.paymentIntents || [], subscriptions: db.subscriptions || [], webhooks: db.billingWebhookEvents || [] }
  try {
    await client.query('BEGIN')
    for (const row of sets.wallets) await client.query(`INSERT INTO core_wallet_accounts(id,user_id,balance,currency,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET balance=EXCLUDED.balance,currency=EXCLUDED.currency,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`, [row.id || `wallet:${row.userId}`, row.userId, Number(row.creditBalance ?? row.balance ?? 0), row.currency || 'USD', json(row), date(row.createdAt), date(row.updatedAt)])
    for (const row of sets.ledger) await client.query(`INSERT INTO core_credit_ledger(id,user_id,delta_credits,type,payment_intent_id,idempotency_key,payload,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`, [row.id, row.userId, Number(row.deltaCredits ?? row.credits ?? 0), row.type || 'unknown', row.paymentIntentId || null, row.idempotencyKey || null, json(row), date(row.createdAt)])
    for (const row of sets.reservations) await client.query(`INSERT INTO core_usage_reservations(id,user_id,reserved_credits,status,idempotency_key,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET reserved_credits=EXCLUDED.reserved_credits,status=EXCLUDED.status,idempotency_key=EXCLUDED.idempotency_key,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`, [row.id, row.userId, Number(row.reservedCredits || 0), row.status || 'unknown', row.idempotencyKey || row.reservationId || null, json(row), date(row.createdAt), date(row.updatedAt)])
    for (const row of sets.payments) await client.query(`INSERT INTO core_payment_intents(id,user_id,amount,currency,credits,status,idempotency_key,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET amount=EXCLUDED.amount,currency=EXCLUDED.currency,credits=EXCLUDED.credits,status=EXCLUDED.status,idempotency_key=EXCLUDED.idempotency_key,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`, [row.id, row.userId, Number(row.amount || 0), row.currency || 'USD', Number(row.credits || 0), row.status || 'unknown', row.idemKey || row.idempotencyKey || null, json(row), date(row.createdAt), date(row.updatedAt)])
    for (const row of sets.subscriptions) await client.query(`INSERT INTO core_subscriptions(id,user_id,plan_id,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET plan_id=EXCLUDED.plan_id,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`, [row.id, row.userId, row.planId || row.planName || null, row.status || 'unknown', json(row), date(row.createdAt), date(row.updatedAt)])
    for (const row of sets.webhooks) await client.query(`INSERT INTO core_billing_webhook_events(id,provider,event_id,type,status,payload,created_at) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider,event_id) DO UPDATE SET type=EXCLUDED.type,status=EXCLUDED.status,payload=EXCLUDED.payload`, [row.id, row.provider || 'unknown', row.eventId || row.id, row.type || null, row.status || 'unknown', json(row), date(row.createdAt)])
    const count = await client.query(`SELECT (SELECT count(*) FROM core_wallet_accounts) AS wallets,(SELECT count(*) FROM core_credit_ledger) AS ledger,(SELECT count(*) FROM core_usage_reservations) AS reservations,(SELECT count(*) FROM core_payment_intents) AS payments,(SELECT count(*) FROM core_subscriptions) AS subscriptions,(SELECT count(*) FROM core_billing_webhook_events) AS webhooks`)
    await client.query('COMMIT')
    const actual = Object.fromEntries(Object.entries(count.rows[0]).map(([key, value]) => [key, Number(value)]))
    const expected = { wallets: sets.wallets.length, ledger: sets.ledger.length, reservations: sets.reservations.length, payments: sets.payments.length, subscriptions: sets.subscriptions.length, webhooks: sets.webhooks.length }
    const mismatches = Object.fromEntries(Object.keys(expected).filter(key => actual[key] !== expected[key]).map(key => [key, { expected: expected[key], actual: actual[key] }]))
    return { enabled: true, ...actual, expected, mismatches, consistent: Object.keys(mismatches).length === 0 }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function initializeFinancePostgresProjection() {
  if (!hasPlatformDatabaseUrl()) return { enabled: false }
  await getPlatformPool().query(await fs.readFile(new URL('../../migrations/postgres/013_core_finance_projection.sql', import.meta.url), 'utf8'))
  const initial = await syncFinanceProjection(); const interval = Math.max(5000, Number(process.env.FINANCE_PROJECTION_INTERVAL_MS || 30000))
  timer = setInterval(() => syncFinanceProjection().catch(error => console.error(JSON.stringify({ event: 'finance_projection_failed', error: error.message }))), interval); timer.unref?.()
  return { enabled: true, ...initial }
}

export async function closeFinancePostgresProjection() { if (timer) clearInterval(timer); timer = null; await closePlatformPool() }
