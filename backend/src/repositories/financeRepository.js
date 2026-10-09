import { createId, nowIso } from '../utils/api.js'
import { economicsForUsage } from '../services/unitEconomicsService.js'
import { withPlatformTransaction, upsertRecord, getPlatformPool, closePlatformPool } from './platformCollectionRepository.js'

const enabled = () => process.env.FINANCE_WRITE_SOURCE === 'postgres'
const readEnabled = () => process.env.FINANCE_READ_SOURCE === 'postgres'
const readFallback = () => process.env.FINANCE_READ_FALLBACK_SQLITE !== 'false'
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

function getFinancePool() {
  const connectionString = process.env.FINANCE_DATABASE_URL || process.env.DATABASE_URL
  if (!connectionString) throw new Error('FINANCE_DATABASE_URL or DATABASE_URL is required')
  return getPlatformPool()
}

const mapNormalized = row => ({ ...(row.payload || {}), id: row.id, userId: row.user_id, creditBalance: row.balance == null ? undefined : Number(row.balance), balance: row.balance == null ? undefined : Number(row.balance), currency: row.currency, deltaCredits: row.delta_credits == null ? undefined : Number(row.delta_credits), reservedCredits: row.reserved_credits == null ? undefined : Number(row.reserved_credits), status: row.status, amount: row.amount == null ? undefined : Number(row.amount), credits: row.credits == null ? undefined : Number(row.credits), createdAt: row.created_at, updatedAt: row.updated_at })

export async function walletAccount(userId) { const result = await getFinancePool().query('SELECT * FROM core_wallet_accounts WHERE user_id=$1', [userId]); return result.rows[0] ? mapNormalized(result.rows[0]) : null }
export async function walletCollection(userId, name) { const tables = { creditLedger: 'core_credit_ledger', usageReservations: 'core_usage_reservations', paymentIntents: 'core_payment_intents', subscriptions: 'core_subscriptions' }; const table = tables[name]; if (!table) throw new Error('unsupported finance collection'); const result = await getFinancePool().query(`SELECT * FROM ${table} WHERE user_id=$1 ORDER BY created_at DESC`, [userId]); return result.rows.map(mapNormalized) }
export async function walletSummary(userId) { const [account, ledger, reservations, payments] = await Promise.all([walletAccount(userId), walletCollection(userId, 'creditLedger'), walletCollection(userId, 'usageReservations'), walletCollection(userId, 'paymentIntents')]); const creditBalance = Number(account?.creditBalance || 0) + ledger.reduce((sum, row) => sum + Number(row.deltaCredits || row.credits || 0), 0); return { account: account || { userId, creditBalance, currency: 'USD' }, creditBalance, lifetimeCreditsUsed: Math.abs(ledger.filter(row => row.type === 'usage_settlement').reduce((sum, row) => sum + Number(row.deltaCredits || 0), 0)), pendingPayments: payments.filter(row => row.status === 'pending').length, pendingReservations: reservations.filter(row => row.status === 'reserved').length } }
export function financeReadEnabled() { return readEnabled() }
export function financeReadFallbackEnabled() { return readFallback() }
export async function closeFinanceRepository() { await closePlatformPool() }

async function findByPayload(client, collection, key, value, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE' : ''
  const result = await client.query(
    `SELECT * FROM platform_collection_records
     WHERE collection_name=$1 AND deleted_at IS NULL AND payload->>$2=$3
     ORDER BY updated_at DESC LIMIT 1${lock}`,
    [collection, key, String(value)],
  )
  const row = result.rows[0]
  return row ? { ...(row.payload || {}), id: row.record_id, version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at } : null
}

async function listByUser(client, collection, userId, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE' : ''
  const result = await client.query(
    `SELECT * FROM platform_collection_records
     WHERE collection_name=$1 AND deleted_at IS NULL AND (owner_id=$2 OR payload->>'userId'=$2)
     ORDER BY updated_at DESC${lock}`,
    [collection, userId],
  )
  return result.rows.map(row => ({ ...(row.payload || {}), id: row.record_id, version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at }))
}

export async function loadFinanceSnapshotPostgres(userId) {
  return withPlatformTransaction(async client => {
    const names = ['profiles', 'userRoles', 'verificationProfiles', 'trustProfiles', 'riskProfiles', 'organizationMemberships', 'walletAccounts', 'creditLedger', 'usageReservations', 'usageEvents', 'subscriptions', 'billingPlans', 'creditPackages', 'rateCards', 'geoPricingProfiles', 'profitabilityEvents', 'marginAlerts', 'workspaceTeamEntitlements', 'accountEntitlements', 'capabilityConsumptions', 'capabilityAnalytics', 'paywallEvents', 'workflowSnapshots', 'paymentIntents', 'billingWebhookEvents']
    const snapshot = {}
    for (const name of names) snapshot[name] = ['billingPlans', 'creditPackages', 'rateCards', 'geoPricingProfiles', 'workspaceTeamEntitlements'].includes(name) ? (await client.query("SELECT * FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL ORDER BY updated_at DESC", [name])).rows.map(row => ({ ...(row.payload || {}), id: row.record_id, version: Number(row.version) })) : await listByUser(client, name, userId)
    const config = (await client.query("SELECT payload FROM platform_collection_records WHERE collection_name='tvceConfig' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1")).rows[0]?.payload
    snapshot.tvceConfig = config || { freeQuotas: {}, capabilities: {} }
    return snapshot
  }, { userId })
}

async function findById(client, collection, recordId, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE' : ''
  const result = await client.query('SELECT * FROM platform_collection_records WHERE collection_name=$1 AND record_id=$2 AND deleted_at IS NULL' + lock, [collection, recordId])
  const row = result.rows[0]
  return row ? { ...(row.payload || {}), id: row.record_id, version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at } : null
}

export async function fulfillPaymentPostgres(userId, paymentId, input = {}) {
  return withPlatformTransaction(async client => {
    const payment = await findById(client, 'paymentIntents', paymentId, { forUpdate: true })
    if (!payment || payment.userId !== userId) return { ok: false, error: 'payment_not_found' }
    if (payment.status === 'successful') return { ok: true, idempotent: true, payment }
    if (input.verified !== true) return { ok: false, error: 'payment_verification_required' }
    const now = nowIso()
    const updatedPayment = { ...payment, status: 'successful', verifiedAt: now, providerReference: input.providerReference || null, updatedAt: now }
    await upsertRecord(client, 'paymentIntents', updatedPayment, { idempotencyKey: `payment:${paymentId}:success`, operation: 'update', expectedVersion: payment.version })
    const credits = Math.max(0, number(payment.credits))
    if (credits > 0) await upsertRecord(client, 'creditLedger', { id: createId('credit_purchase'), userId, deltaCredits: credits, credits, type: 'credit_purchase', paymentIntentId: payment.id, idempotencyKey: payment.id, createdAt: now, updatedAt: now }, { idempotencyKey: `credit-purchase:${payment.id}`, operation: 'insert' })
    const planId = input.planId || payment.planId || null
    let subscription = null
    if (planId) {
      subscription = (await listByUser(client, 'subscriptions', userId, { forUpdate: true })).find(row => row.planId === planId) || { id: createId('subscription'), userId, planId, createdAt: now }
      subscription = { ...subscription, planId, status: 'active', currentPeriodStart: now, currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(), updatedAt: now }
      await upsertRecord(client, 'subscriptions', subscription, { idempotencyKey: `subscription:${subscription.id}:active`, operation: subscription.version ? 'update' : 'insert', expectedVersion: subscription.version ?? null })
    }
    const existingAccounts = await listByUser(client, 'accountEntitlements', userId, { forUpdate: true })
    const account = existingAccounts[0] || { id: createId('account_entitlement'), userId, createdAt: now }
    const accountEntitlement = { ...account, status: 'active', source: credits > 0 ? 'credits' : 'subscription', paymentIntentId: payment.id, updatedAt: now }
    await upsertRecord(client, 'accountEntitlements', accountEntitlement, { idempotencyKey: `account-entitlement:${userId}`, operation: account.version ? 'update' : 'insert', expectedVersion: account.version ?? null })
    let workflow = null
    if (input.workflowId) {
      const current = await findById(client, 'workflowSnapshots', input.workflowId, { forUpdate: true })
      if (current && current.userId === userId) {
        workflow = { ...current, status: 'resumed', resumedAt: now, updatedAt: now }
        await upsertRecord(client, 'workflowSnapshots', workflow, { idempotencyKey: `workflow:${workflow.id}:resume:${payment.id}`, operation: 'update', expectedVersion: current.version })
      }
    }
    return { ok: true, payment: updatedPayment, accountEntitlement, subscription, workflow }
  }, { userId })
}

export async function billingEventExistsPostgres(provider, eventId) {
  return withPlatformTransaction(async client => Boolean(await findByPayload(client, 'billingWebhookEvents', 'eventId', String(eventId))))
}

export async function paymentUserPostgres(paymentId) {
  return withPlatformTransaction(async client => (await findById(client, 'paymentIntents', paymentId))?.userId || null)
}

export async function recordBillingEventPostgres(event) {
  return withPlatformTransaction(async client => {
    const existing = await findByPayload(client, 'billingWebhookEvents', 'eventId', String(event.eventId))
    if (existing) return existing
    const row = { id: event.id || createId('billing_event'), ...event, eventId: String(event.eventId), createdAt: event.createdAt || nowIso() }
    await upsertRecord(client, 'billingWebhookEvents', row, { idempotencyKey: `billing-event:${event.provider}:${event.eventId}`, operation: 'insert' })
    return row
  })
}

export async function updateSubscriptionPostgres({ userId, provider, providerId, planId, status, amount, currency, failureReason }) {
  return withPlatformTransaction(async client => {
    const current = (await listByUser(client, 'subscriptions', userId, { forUpdate: true })).find(row => row.providerId === providerId || row.planId === planId) || { id: createId('subscription'), userId, createdAt: nowIso() }
    const next = { ...current, provider, providerId, planId: planId || current.planId || null, status, amount: amount ?? current.amount ?? null, currency: currency || current.currency || null, lastFailureReason: failureReason || current.lastFailureReason || null, updatedAt: nowIso() }
    await upsertRecord(client, 'subscriptions', next, { idempotencyKey: `subscription:${next.id}:${status}:${next.updatedAt}`, operation: current.version ? 'update' : 'insert', expectedVersion: current.version ?? null })
    const account = (await listByUser(client, 'accountEntitlements', userId, { forUpdate: true })).find(row => row.source === 'subscription')
    if (account) await upsertRecord(client, 'accountEntitlements', { ...account, status: status === 'past_due' ? 'grace_period' : ['cancelled', 'refunded', 'disputed'].includes(status) ? 'inactive' : status, updatedAt: nowIso() }, { idempotencyKey: `account-entitlement:${userId}:${status}`, operation: 'update', expectedVersion: account.version })
    return next
  }, { userId })
}

export async function reversePaymentCreditsPostgres(userId, paymentId, reason = 'refund') {
  return withPlatformTransaction(async client => {
    const payment = await findById(client, 'paymentIntents', paymentId, { forUpdate: true })
    if (!payment || payment.userId !== userId) return { ok: false, error: 'payment_not_found' }
    const ledger = await listByUser(client, 'creditLedger', userId)
    const purchased = ledger.filter(row => row.paymentIntentId === paymentId && number(row.deltaCredits ?? row.credits) > 0).reduce((sum, row) => sum + number(row.deltaCredits ?? row.credits), 0)
    const reversed = ledger.filter(row => row.paymentIntentId === paymentId && row.type === 'credit_purchase_reversal').reduce((sum, row) => sum + Math.abs(number(row.deltaCredits ?? row.credits)), 0)
    const remaining = Math.max(0, purchased - reversed); const now = nowIso()
    if (remaining > 0) await upsertRecord(client, 'creditLedger', { id: createId('credit_reversal'), userId, paymentIntentId: paymentId, deltaCredits: -remaining, credits: -remaining, type: 'credit_purchase_reversal', reason, createdAt: now, updatedAt: now }, { idempotencyKey: `credit-reversal:${paymentId}:${reason}`, operation: 'insert' })
    const updated = { ...payment, status: reason === 'dispute' ? 'disputed' : 'refunded', updatedAt: now }
    await upsertRecord(client, 'paymentIntents', updated, { idempotencyKey: `payment:${paymentId}:${updated.status}`, operation: 'update', expectedVersion: payment.version })
    return { ok: true, idempotent: remaining === 0, payment: updated, reversedCredits: remaining }
  }, { userId })
}

export async function reserveUsagePostgres({ userId, workspaceId = null, requestId, taskType, estimatedCredits, grantId = null, fundingSource = 'payg', metadata = {} }) {
  const credits = Math.max(0, number(estimatedCredits))
  if (!userId || !requestId || !taskType || credits <= 0) return { ok: false, error: 'reservation_fields_required' }
  if (!['subscription', 'payg', 'platform_subsidy'].includes(fundingSource)) return { ok: false, error: 'invalid_funding_source' }
  return withPlatformTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`usage:${requestId}`])
    const existing = await findByPayload(client, 'usageReservations', 'requestId', requestId, { forUpdate: true })
    if (existing) {
      const same = existing.userId === userId && existing.workspaceId === workspaceId && existing.taskType === taskType && number(existing.reservedCredits) === credits && existing.fundingSource === fundingSource
      return same ? { ok: true, idempotent: true, reservation: existing } : { ok: false, error: 'request_id_reservation_conflict' }
    }
    const accounts = await listByUser(client, 'walletAccounts', userId, { forUpdate: true })
    const ledger = await listByUser(client, 'creditLedger', userId)
    const reservations = await listByUser(client, 'usageReservations', userId, { forUpdate: true })
    const subscriptions = await listByUser(client, 'subscriptions', userId)
    const accountBalance = number(accounts[0]?.creditBalance)
    const ledgerBalance = ledger.reduce((sum, row) => sum + number(row.deltaCredits ?? row.credits), 0)
    const reservedPayg = reservations.filter(row => row.fundingSource === 'payg' && row.status === 'reserved').reduce((sum, row) => sum + number(row.reservedCredits), 0)
    const subscription = subscriptions.find(row => ['active', 'trialing'].includes(row.status))
    const included = number(subscription?.includedCredits ?? subscription?.monthlyCredits ?? subscription?.creditAllowance)
    const used = (await listByUser(client, 'usageEvents', userId)).filter(row => row.fundingSource === 'subscription' && row.status === 'completed').reduce((sum, row) => sum + number(row.credits), 0)
    const reservedSub = reservations.filter(row => row.fundingSource === 'subscription' && row.status === 'reserved').reduce((sum, row) => sum + number(row.reservedCredits), 0)
    const available = fundingSource === 'subscription' ? Math.max(0, included - used - reservedSub) : fundingSource === 'payg' ? accountBalance + ledgerBalance - reservedPayg : Number.POSITIVE_INFINITY
    if (fundingSource !== 'platform_subsidy' && available < credits) return { ok: false, error: fundingSource === 'subscription' ? 'subscription_allowance_exhausted' : 'insufficient_credits', availableCredits: available, requiredCredits: credits }
    const now = nowIso()
    const reservation = { id: createId('usage_reservation'), reservationId: requestId, requestId, userId, workspaceId, taskType, estimatedCredits: credits, reservedCredits: credits, settledCredits: 0, releasedCredits: 0, fundingSource, grantId, status: 'reserved', metadata, createdAt: now, updatedAt: now }
    await upsertRecord(client, 'usageReservations', reservation, { idempotencyKey: `usage-reservation:${requestId}`, operation: 'insert' })
    return { ok: true, idempotent: false, reservation }
  }, { userId })
}

export async function settleUsagePostgres(facts) {
  const requestId = String(facts.request_id || facts.requestId || '')
  const userId = String(facts.user_id || facts.userId || '')
  const taskType = String(facts.task_type || facts.taskType || '')
  const status = String(facts.status || 'completed')
  if (!requestId || !userId || !taskType) return { ok: false, error: 'request_id_user_id_task_type_required' }
  if (!['completed', 'failed', 'cancelled'].includes(status)) return { ok: false, error: 'invalid_execution_status' }
  return withPlatformTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`usage:${requestId}`])
    const existing = await findByPayload(client, 'usageEvents', 'requestId', requestId, { forUpdate: true })
    if (existing) return { ok: true, idempotent: true, usageEvent: existing, reservation: await findByPayload(client, 'usageReservations', 'requestId', requestId, { forUpdate: true }) }
    const reservation = await findByPayload(client, 'usageReservations', 'requestId', facts.reservation_id || facts.reservationId || requestId, { forUpdate: true })
    if (status === 'completed' && !reservation) return { ok: false, error: 'reservation_not_found', requestId }
    if (reservation && (reservation.userId !== userId || reservation.taskType !== taskType)) return { ok: false, error: 'reservation_execution_mismatch', requestId }
    const now = nowIso(); const economics = economicsForUsage({ ...facts, taskType, status }, reservation, null); const credits = economics.settledCredits
    const usageEvent = { id: createId('usage'), requestId, payloadHash: facts.payloadHash || null, userId, workspaceId: facts.workspace_id || facts.workspaceId || null, taskType, provider: facts.provider || 'unknown', model: facts.model || 'unknown', status, promptTokens: economics.inputTokens, completionTokens: economics.outputTokens, totalTokens: number(facts.total_tokens ?? facts.totalTokens), providerCostUsd: economics.providerCostUsd, infrastructureCostUsd: economics.infrastructureCostUsd, externalCostUsd: economics.externalCostUsd, paymentCostUsd: economics.paymentCostUsd, directServiceCogsUsd: economics.directServiceCogsUsd, totalVariableCostUsd: economics.totalVariableCostUsd, latencyMs: number(facts.latency_ms ?? facts.latencyMs), attemptCount: number(facts.attempt_count ?? facts.attemptCount, 1), cacheHit: Boolean(facts.cache_hit ?? facts.cacheHit), grantId: facts.grant_id || facts.grantId || null, reservationId: reservation?.reservationId || facts.reservation_id || facts.reservationId || null, credits, rateCardVersion: economics.rateCardVersion, totalCogs: economics.directServiceCogsUsd, customerPrice: economics.allocatedRevenueUsd, allocatedRevenueUsd: economics.allocatedRevenueUsd, grossProfitUsd: economics.grossProfitUsd, grossMargin: economics.grossMargin, marginStatus: economics.marginStatus, fundingSource: reservation?.fundingSource || 'unknown', metadata: facts.metadata || {}, createdAt: now, updatedAt: now }
    await upsertRecord(client, 'usageEvents', usageEvent, { idempotencyKey: `usage-event:${requestId}`, operation: 'insert' })
    if (reservation) {
      const next = { ...reservation, settledCredits: credits, releasedCredits: Math.max(0, number(reservation.reservedCredits) - credits), status: status === 'completed' ? 'settled' : 'refunded', updatedAt: now }
      await upsertRecord(client, 'usageReservations', next, { idempotencyKey: `usage-reservation-settle:${requestId}`, operation: 'update', expectedVersion: reservation.version })
    }
    if (credits > 0) await upsertRecord(client, 'creditLedger', { id: createId('usage_debit'), userId, workspaceId: usageEvent.workspaceId, requestId, deltaCredits: -credits, credits: -credits, type: 'usage_settlement', createdAt: now, updatedAt: now }, { idempotencyKey: `usage-debit:${requestId}`, operation: 'insert' })
    return { ok: true, idempotent: false, usageEvent, reservation }
  }, { userId })
}

export function financePostgresEnabled() { return enabled() }

export async function findCapabilityConsumptionPostgres(idempotencyKey, consumptionId = null) {
  return withPlatformTransaction(async client => consumptionId ? findById(client, 'capabilityConsumptions', consumptionId) : findByPayload(client, 'capabilityConsumptions', 'idempotencyKey', idempotencyKey))
}

export async function createCapabilityConsumptionPostgres(consumption) {
  return withPlatformTransaction(async client => {
    const existing = await findByPayload(client, 'capabilityConsumptions', 'idempotencyKey', consumption.idempotencyKey, { forUpdate: true })
    if (existing) return existing.userId === consumption.userId && existing.capability === consumption.capability ? { ok: true, idempotent: true, consumption: existing } : { ok: false, error: 'idempotency_key_conflict' }
    await upsertRecord(client, 'capabilityConsumptions', consumption, { idempotencyKey: `capability-consumption:${consumption.idempotencyKey}`, operation: 'insert' })
    return { ok: true, idempotent: false, consumption }
  }, { userId: consumption.userId })
}

export async function settleCapabilityConsumptionPostgres(consumptionId, responseStatus, analytics) {
  return withPlatformTransaction(async client => {
    const current = await findById(client, 'capabilityConsumptions', consumptionId, { forUpdate: true })
    if (!current) return { ok: false, error: 'consumption_not_found' }
    if (current.status !== 'reserved') return { ok: true, idempotent: true, consumption: current }
    const now = nowIso(); const next = { ...current, status: analytics.success ? 'settled' : 'released', responseStatus: Number(responseStatus), updatedAt: now }
    await upsertRecord(client, 'capabilityConsumptions', next, { idempotencyKey: `capability-consumption:${consumptionId}:${next.status}`, operation: 'update', expectedVersion: current.version })
    await upsertRecord(client, 'capabilityAnalytics', { id: createId('capability_event'), userId: current.userId, capability: current.capability, eventType: analytics.success ? 'capability_completed' : 'capability_released', metadata: { fundingSource: current.fundingSource, credits: current.credits, responseStatus }, createdAt: now, updatedAt: now }, { idempotencyKey: `capability-analytics:${consumptionId}:${next.status}`, operation: 'insert' })
    return { ok: true, consumption: next }
  }, { userId: analytics.userId || null })
}

export async function saveWorkflowPostgres(userId, input = {}) {
  return withPlatformTransaction(async client => {
    const existing = await findByPayload(client, 'workflowSnapshots', 'clientRequestId', input.clientRequestId || '')
    if (existing && existing.userId === userId) return { ok: true, idempotent: true, workflow: existing }
    const now = nowIso(); const workflow = { id: createId('workflow'), userId, clientRequestId: input.clientRequestId || createId('request'), name: String(input.name || input.capability || 'TechIT workflow').trim(), capability: String(input.capability || '').trim(), payload: input.payload || {}, estimatedCredits: number(input.estimatedCredits), status: 'pending', createdAt: now, updatedAt: now }
    await upsertRecord(client, 'workflowSnapshots', workflow, { idempotencyKey: `workflow-create:${userId}:${workflow.clientRequestId}`, operation: 'insert' })
    return { ok: true, workflow }
  }, { userId })
}

export async function resumeWorkflowPostgres(userId, workflowId, input = {}) {
  return withPlatformTransaction(async client => {
    const current = await findById(client, 'workflowSnapshots', workflowId, { forUpdate: true })
    if (!current || current.userId !== userId) return { ok: false, error: 'workflow_not_found' }
    const now = nowIso(); const workflow = { ...current, status: input.status || 'resumed', resumedAt: now, updatedAt: now }
    await upsertRecord(client, 'workflowSnapshots', workflow, { idempotencyKey: `workflow-resume:${workflowId}:${now}`, operation: 'update', expectedVersion: current.version })
    return { ok: true, workflow }
  }, { userId })
}

export async function recordPaywallEventPostgres(event) {
  return withPlatformTransaction(async client => {
    const row = { id: createId('paywall'), ...event, createdAt: event.createdAt || nowIso() }
    await upsertRecord(client, 'paywallEvents', row, { idempotencyKey: `paywall:${row.id}`, operation: 'insert' })
    return { ok: true, event: row }
  }, { userId: event.userId })
}
