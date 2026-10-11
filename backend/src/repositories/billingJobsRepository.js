// Row-level billing-jobs store (§5 cutover).
//
// The billing maintenance job used the whole-DB snapshot to scan and mutate
// usage reservations, team grants, subscriptions, margin alerts and job runs.
// This repository does the same work with collection-scoped queries over
// platform_collection_records (never the full database). Enabled with
// FINANCE_WRITE_SOURCE=postgres (or BILLING_JOBS_SOURCE).
import { getPlatformPool, withPlatformTransaction, upsertRecord } from './platformCollectionRepository.js'

const enabled = () => process.env.BILLING_JOBS_SOURCE === 'postgres' || process.env.FINANCE_WRITE_SOURCE === 'postgres'

export function billingJobsRowLevelEnabled() { return enabled() }

async function rowsByField(collection, field, value) {
  const result = await getPlatformPool().query(
    `SELECT record_id, payload FROM platform_collection_records
     WHERE collection_name=$1 AND deleted_at IS NULL AND payload->>$2=$3`,
    [collection, field, value],
  )
  return result.rows.map(row => ({ ...(row.payload || {}), id: row.record_id }))
}

async function rowsSince(collection, field, iso) {
  const result = await getPlatformPool().query(
    `SELECT record_id, payload FROM platform_collection_records
     WHERE collection_name=$1 AND deleted_at IS NULL
       AND payload->>$2 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
       AND (payload->>$2)::timestamptz >= $3`,
    [collection, field, iso],
  )
  return result.rows.map(row => ({ ...(row.payload || {}), id: row.record_id }))
}

export async function runBillingJobsRowLevel(actor, { freeQuotaCycles, now = Date.now(), runAt }) {
  const reservations = await rowsByField('usageReservations', 'status', 'reserved')
  const expiredReservations = reservations.filter(row => row.expiresAt && Date.parse(row.expiresAt) <= now)
  const grants = await rowsByField('workspaceTeamEntitlements', 'status', 'active')
  const expiredGrants = grants.filter(row => row.expiresAt && Date.parse(row.expiresAt) <= now)
  const pastDue = (await rowsByField('subscriptions', 'status', 'past_due')).length
  const usage = await rowsSince('usageEvents', 'createdAt', new Date(now - 30 * 86400000).toISOString())
  const belowFloor = usage.filter(row => Number.isFinite(Number(row.grossMargin)) && Number(row.grossMargin) < 0.60)

  const results = { freeQuotaCycle: freeQuotaCycles, expiredReservations: expiredReservations.length, expiredTeamGrants: expiredGrants.length, pastDueSubscriptions: pastDue, marginAlerts: belowFloor.length }

  await withPlatformTransaction(async client => {
    for (const row of expiredReservations) await upsertRecord(client, 'usageReservations', { ...row, status: 'refunded', releasedCredits: Number(row.reservedCredits || 0), updatedAt: runAt }, { operation: 'update', idempotencyKey: `billing:reservation-refund:${row.id}` })
    for (const grant of expiredGrants) await upsertRecord(client, 'workspaceTeamEntitlements', { ...grant, status: 'expired', updatedAt: runAt }, { operation: 'update', idempotencyKey: `billing:grant-expire:${grant.id}` })
    for (const event of belowFloor) await upsertRecord(client, 'marginAlerts', { id: `margin:${event.id}`, usageEventId: event.id, severity: Number(event.grossMargin) < 0.50 ? 'critical' : 'warning', grossMargin: event.grossMargin, createdAt: runAt }, { operation: 'insert', idempotencyKey: `margin:${event.id}` })
    await upsertRecord(client, 'billingJobRuns', { id: `billing-job:${runAt}`, actor, createdAt: runAt, results }, { operation: 'insert', idempotencyKey: `billing-job:${runAt}` })
  })
  return { ok: true, ranAt: runAt, results }
}

export async function billingJobStatusRowLevel() {
  const runs = await getPlatformPool().query(
    `SELECT payload FROM platform_collection_records WHERE collection_name='billingJobRuns' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1`,
  )
  const alerts = await getPlatformPool().query(
    `SELECT payload FROM platform_collection_records WHERE collection_name='marginAlerts' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100`,
  )
  return { lastRun: runs.rows[0]?.payload || null, marginAlerts: alerts.rows.map(row => row.payload).reverse() }
}
