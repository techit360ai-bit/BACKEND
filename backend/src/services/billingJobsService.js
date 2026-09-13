import { nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'
import { TVCE_FREE_QUOTAS } from './tvceService.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }

export function runBillingJobs(actor = 'scheduler') {
  return updateDb(db => {
    const now = Date.now(); const runAt = nowIso(); const results = {}
    // Capability counters are event-derived and reset by cycle; this job only
    // records the run so it remains idempotent and auditable.
    results.freeQuotaCycle = Object.keys(TVCE_FREE_QUOTAS).length
    results.expiredReservations = rows(db, 'usageReservations').filter(row => row.status === 'reserved' && row.expiresAt && Date.parse(row.expiresAt) <= now).map(row => { row.status = 'refunded'; row.releasedCredits = Number(row.reservedCredits || 0); row.updatedAt = runAt; return row.id }).length
    results.expiredTeamGrants = rows(db, 'workspaceTeamEntitlements').filter(row => row.status === 'active' && row.expiresAt && Date.parse(row.expiresAt) <= now).map(row => { row.status = 'expired'; row.updatedAt = runAt; return row.id }).length
    results.pastDueSubscriptions = rows(db, 'subscriptions').filter(row => row.status === 'past_due').length
    const usage = rows(db, 'usageEvents').filter(row => row.createdAt && Date.parse(row.createdAt) >= now - 30 * 86400000)
    const belowFloor = usage.filter(row => Number.isFinite(Number(row.grossMargin)) && Number(row.grossMargin) < 0.60)
    for (const event of belowFloor) rows(db, 'marginAlerts').push({ id: `margin:${event.id}`, usageEventId: event.id, severity: Number(event.grossMargin) < 0.50 ? 'critical' : 'warning', grossMargin: event.grossMargin, createdAt: runAt })
    results.marginAlerts = belowFloor.length
    rows(db, 'billingJobRuns').push({ id: `billing-job:${runAt}`, actor, createdAt: runAt, results })
    return { ok: true, ranAt: runAt, results }
  })
}

export function billingJobStatus() {
  const db = readDb(); const runs = rows(db, 'billingJobRuns')
  return { lastRun: runs[runs.length - 1] || null, marginAlerts: rows(db, 'marginAlerts').slice(-100) }
}
