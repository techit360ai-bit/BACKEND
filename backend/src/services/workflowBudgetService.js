import { createId, nowIso } from '../utils/api.js'

/**
 * Workflow budget accounting.
 *
 * The AI router enforces a workflow ceiling at admission time. The backend owns
 * the authoritative ledger, so it accumulates every settled sub-request of a
 * workflow (including trusted-worker fan-out) and reconciles the total against
 * the ceiling the grant carried. Only `provider_cost_usd` from the router fact
 * is aggregated; customer pricing/credits stay owned by the settlement service.
 *
 * Records live in the `workflowBudgets` collection, which persists through the
 * generic `platform_collection_records` JSONB store (no schema migration).
 */

const COST_STATUS_RANK = { free: 0, estimated: 1, pending_reconciliation: 2 }
const round = (value) => Number(Number(value || 0).toFixed(8))

function worstCostStatus(current, next) {
  const a = COST_STATUS_RANK[current] ?? -1
  const b = COST_STATUS_RANK[next] ?? -1
  return b > a ? next : (current || next)
}

export function mergeWorkflowBudget(row, entry = {}) {
  const now = nowIso()
  const providerCostUsd = Math.max(0, Number(entry.providerCostUsd) || 0)
  const credits = Math.max(0, Number(entry.credits) || 0)
  const ceilingFromEntry = entry.maxCostUsd == null || entry.maxCostUsd === '' ? null : Number(entry.maxCostUsd)
  const next = row ? { ...row } : {
    id: createId('workflow_budget'),
    workflowId: entry.workflowId,
    userId: entry.userId ?? null,
    workspaceId: entry.workspaceId ?? null,
    settledProviderCostUsd: 0,
    settledCredits: 0,
    calls: 0,
    failedCalls: 0,
    maxCostUsd: null,
    costStatus: entry.costStatus || 'estimated',
    pricingVersion: entry.pricingVersion || null,
    lastRequestId: null,
    createdAt: now,
    updatedAt: now,
  }
  next.calls += 1
  if (entry.status && entry.status !== 'completed') next.failedCalls += 1
  next.settledProviderCostUsd = round(next.settledProviderCostUsd + providerCostUsd)
  next.settledCredits = round(next.settledCredits + credits)
  next.costStatus = worstCostStatus(next.costStatus, entry.costStatus || 'estimated')
  if (entry.pricingVersion) next.pricingVersion = entry.pricingVersion
  if (entry.workspaceId && !next.workspaceId) next.workspaceId = entry.workspaceId
  if (entry.userId && !next.userId) next.userId = entry.userId
  if (ceilingFromEntry != null && ceilingFromEntry > 0) next.maxCostUsd = ceilingFromEntry
  if (entry.requestId) next.lastRequestId = entry.requestId
  next.reconciled = next.costStatus !== 'pending_reconciliation'
  next.status = next.maxCostUsd != null && next.maxCostUsd > 0 && next.settledProviderCostUsd > next.maxCostUsd
    ? 'exceeded'
    : 'within'
  next.updatedAt = now
  return next
}

export function recordWorkflowUsage(db, entry = {}) {
  if (!entry.workflowId) return null
  if (!Array.isArray(db.workflowBudgets)) db.workflowBudgets = []
  const index = db.workflowBudgets.findIndex((row) => row.workflowId === entry.workflowId)
  const next = mergeWorkflowBudget(index >= 0 ? db.workflowBudgets[index] : null, entry)
  if (index >= 0) db.workflowBudgets[index] = next
  else db.workflowBudgets.push(next)
  return next
}

export function workflowBudgetFor(db, workflowId) {
  if (!workflowId || !Array.isArray(db.workflowBudgets)) return null
  return db.workflowBudgets.find((row) => row.workflowId === workflowId) || null
}

export function workflowBudgetSnapshot(row) {
  if (!row) return null
  const remaining = row.maxCostUsd == null ? null : round(row.maxCostUsd - row.settledProviderCostUsd)
  return {
    workflowId: row.workflowId,
    calls: row.calls,
    failedCalls: row.failedCalls,
    settledProviderCostUsd: row.settledProviderCostUsd,
    settledCredits: row.settledCredits,
    maxCostUsd: row.maxCostUsd ?? null,
    remainingCostUsd: remaining,
    costStatus: row.costStatus,
    pricingVersion: row.pricingVersion ?? null,
    reconciled: Boolean(row.reconciled),
    status: row.status,
    updatedAt: row.updatedAt,
  }
}

/**
 * Resolve the workflow spend ceiling the grant carried. The reservation (created
 * at grant time) is authoritative; the settlement fact is a fallback.
 */
export function resolveWorkflowCeiling(reservation, normalized) {
  const candidates = [
    reservation?.metadata?.maxWorkflowCostUsd,
    reservation?.metadata?.max_workflow_cost_usd,
    normalized?.metadata?.maxWorkflowCostUsd,
    normalized?.metadata?.max_workflow_cost_usd,
  ]
  for (const value of candidates) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}
