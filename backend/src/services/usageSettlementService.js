import { createHash } from 'crypto'
import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { syncFinanceProjection } from './financePostgresProjection.js'
import { reserveUsagePostgres, settleUsagePostgres, financePostgresEnabled } from '../repositories/financeRepository.js'
import { reserveOrganizationBudget, settleOrganizationBudget } from './organizationBudgetService.js'

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function hashPayload(payload) {
  return createHash('sha256').update(stableJson(payload)).digest('hex')
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function reservationFor(db, reservationId) {
  return db.usageReservations.find(row => row.id === reservationId || row.reservationId === reservationId) || null
}

const FUNDING_SOURCES = new Set(['subscription', 'payg', 'platform_subsidy', 'organization'])

function usageFor(db, requestId) {
  return db.usageEvents.find(row => row.requestId === requestId) || null
}

function activeSubscription(db, userId) {
  return db.subscriptions.find(row => row.userId === userId && ['active', 'trialing'].includes(row.status)) || null
}

function availableSubscriptionCredits(db, userId, subscription) {
  if (!subscription) return 0
  const included = number(subscription.includedCredits ?? subscription.monthlyCredits ?? subscription.creditAllowance)
  const used = db.usageEvents.filter(row => row.userId === userId && row.fundingSource === 'subscription' && row.status === 'completed').reduce((sum, row) => sum + number(row.credits), 0)
  const reserved = db.usageReservations.filter(row => row.userId === userId && row.fundingSource === 'subscription' && row.status === 'reserved').reduce((sum, row) => sum + number(row.reservedCredits), 0)
  return Math.max(0, included - used - reserved)
}

function validateFacts(facts) {
  const requestId = text(facts.request_id || facts.requestId)
  const userId = text(facts.user_id || facts.userId)
  const taskType = text(facts.task_type || facts.taskType)
  if (!requestId || !userId || !taskType) return { error: 'request_id_user_id_task_type_required' }
  const status = text(facts.status, 'completed')
  if (!['completed', 'failed', 'cancelled'].includes(status)) return { error: 'invalid_execution_status' }
  return {
    requestId,
    userId,
    workspaceId: text(facts.workspace_id || facts.workspaceId) || null,
    taskType,
    provider: text(facts.provider, 'unknown'),
    model: text(facts.model, 'unknown'),
    status,
    promptTokens: Math.max(0, Math.floor(number(facts.prompt_tokens ?? facts.promptTokens))),
    completionTokens: Math.max(0, Math.floor(number(facts.completion_tokens ?? facts.completionTokens))),
    totalTokens: Math.max(0, Math.floor(number(facts.total_tokens ?? facts.totalTokens))),
    providerCostUsd: Math.max(0, number(facts.provider_cost_usd ?? facts.providerCostUsd)),
    latencyMs: Math.max(0, Math.floor(number(facts.latency_ms ?? facts.latencyMs))),
    attemptCount: Math.max(0, Math.floor(number(facts.attempt_count ?? facts.attemptCount, 1))),
    cacheHit: Boolean(facts.cache_hit ?? facts.cacheHit),
    grantId: text(facts.grant_id || facts.grantId) || null,
    reservationId: text(facts.reservation_id || facts.reservationId) || null,
    metadata: facts.metadata && typeof facts.metadata === 'object' ? facts.metadata : {},
  }
}

export function reserveUsage({ userId, workspaceId = null, requestId, taskType, estimatedCredits, grantId = null, fundingSource = 'payg', organizationId = null, budgetId = null, programId = null, hackathonId = null, metadata = {} }) {
  const normalizedRequestId = text(requestId)
  const credits = Math.max(0, number(estimatedCredits))
  if (!userId || !normalizedRequestId || !taskType || credits <= 0) return { ok: false, error: 'reservation_fields_required' }
  if (!FUNDING_SOURCES.has(fundingSource)) return { ok: false, error: 'invalid_funding_source' }
  if (fundingSource === 'organization') {
    const organizationReservation = reserveOrganizationBudget({ organizationId, budgetId, programId, hackathonId, requestId: normalizedRequestId, credits, metadata })
    if (!organizationReservation.ok) return organizationReservation
  }
  return updateAuthorityDb(db => {
    const existing = reservationFor(db, normalizedRequestId)
    if (existing) {
      const sameReservation = existing.userId === userId
        && existing.workspaceId === workspaceId
        && existing.taskType === taskType
        && number(existing.reservedCredits) === credits
        && existing.fundingSource === fundingSource
      if (!sameReservation) return { ok: false, error: 'request_id_reservation_conflict' }
      return { ok: true, idempotent: true, reservation: existing }
    }
    const account = db.walletAccounts.find(row => row.userId === userId) || { userId, creditBalance: 0, currency: 'USD' }
    const ledgerBalance = db.creditLedger.filter(row => row.userId === userId).reduce((sum, row) => sum + number(row.deltaCredits ?? row.credits), 0)
    const usageReserved = db.usageReservations.filter(row => row.userId === userId && row.fundingSource === 'payg' && row.status === 'reserved').reduce((sum, row) => sum + number(row.reservedCredits), 0)
    const subscription = activeSubscription(db, userId)
    const subscriptionAvailable = availableSubscriptionCredits(db, userId, subscription)
    const paygAvailable = number(account.creditBalance) + ledgerBalance - usageReserved
    const requestedFunding = fundingSource
    const available = requestedFunding === 'subscription' ? subscriptionAvailable : requestedFunding === 'payg' ? paygAvailable : Number.POSITIVE_INFINITY
    if (requestedFunding !== 'platform_subsidy' && available < credits) return { ok: false, error: requestedFunding === 'subscription' ? 'subscription_allowance_exhausted' : 'insufficient_credits', availableCredits: available, requiredCredits: credits }
    const now = nowIso()
    const reservation = {
      id: createId('usage_reservation'), reservationId: normalizedRequestId, requestId: normalizedRequestId,
      userId, workspaceId, taskType, estimatedCredits: credits, reservedCredits: credits,
      settledCredits: 0, releasedCredits: 0, fundingSource: requestedFunding, grantId, status: 'reserved',
      metadata: { ...metadata, ...(organizationId ? { organizationId, budgetId, programId, hackathonId } : {}) }, createdAt: now, updatedAt: now,
    }
    db.usageReservations.push(reservation)
    return { ok: true, idempotent: false, reservation }
  })
}

export function settleUsage(facts) {
  const normalized = validateFacts(facts)
  if (normalized.error) return { ok: false, error: normalized.error }
  return updateAuthorityDb(db => {
    const payloadHash = hashPayload(normalized)
    const existing = usageFor(db, normalized.requestId)
    if (existing) {
      if (existing.payloadHash !== payloadHash) return { ok: false, error: 'request_id_payload_conflict', requestId: normalized.requestId }
      return { ok: true, idempotent: true, usageEvent: existing, reservation: reservationFor(db, normalized.reservationId || normalized.requestId) }
    }
    const now = nowIso()
    const reservation = reservationFor(db, normalized.reservationId || normalized.requestId)
    if (normalized.status === 'completed' && !reservation) return { ok: false, error: 'reservation_not_found', requestId: normalized.requestId }
    if (reservation) {
      if (reservation.requestId !== normalized.requestId
          || reservation.userId !== normalized.userId
          || reservation.workspaceId !== normalized.workspaceId
          || reservation.taskType !== normalized.taskType) {
        return { ok: false, error: 'reservation_execution_mismatch', requestId: normalized.requestId }
      }
      if (normalized.grantId && reservation.grantId && normalized.grantId !== reservation.grantId) {
        return { ok: false, error: 'reservation_grant_mismatch', requestId: normalized.requestId }
      }
    }
    const reservedCredits = number(reservation?.reservedCredits)
    // Credits, customer price, COGS and margin are backend-owned. Router facts
    // can report provider telemetry, but cannot increase or rewrite the charge.
    const actualCredits = normalized.status === 'completed' ? reservedCredits : 0
    const usageEvent = {
      id: createId('usage'), requestId: normalized.requestId, payloadHash, userId: normalized.userId,
      workspaceId: normalized.workspaceId, taskType: normalized.taskType, provider: normalized.provider,
      model: normalized.model, status: normalized.status, promptTokens: normalized.promptTokens,
      completionTokens: normalized.completionTokens,
      totalTokens: normalized.totalTokens || normalized.promptTokens + normalized.completionTokens,
      providerCostUsd: normalized.providerCostUsd, latencyMs: normalized.latencyMs,
      attemptCount: normalized.attemptCount, cacheHit: normalized.cacheHit, grantId: normalized.grantId,
      reservationId: normalized.reservationId, credits: actualCredits,
      totalCogs: normalized.providerCostUsd,
      customerPrice: 0,
      grossMargin: 0,
      fundingSource: reservation?.fundingSource || 'unknown',
      metadata: normalized.metadata, createdAt: now, updatedAt: now,
    }
    db.usageEvents.push(usageEvent)
    if (reservation?.fundingSource === 'organization') {
      const organizationSettlement = settleOrganizationBudget({ requestId: normalized.requestId, status: normalized.status, actualCredits })
      if (!organizationSettlement.ok) return organizationSettlement
    }
    if (reservation) {
      reservation.settledCredits = actualCredits
      reservation.releasedCredits = Math.max(0, reservedCredits - actualCredits)
      reservation.status = normalized.status === 'completed' ? 'settled' : 'refunded'
      reservation.updatedAt = now
    }
    if (actualCredits > 0 && reservation?.fundingSource !== 'organization') db.creditLedger.push({
      id: createId('usage_debit'), userId: normalized.userId, workspaceId: normalized.workspaceId,
      requestId: normalized.requestId, deltaCredits: -actualCredits, credits: -actualCredits,
      type: 'usage_settlement', createdAt: now,
    })
    return { ok: true, idempotent: false, usageEvent, reservation }
  })
}

export function usageSettlementHealth() {
  const db = readAuthorityDb()
  const settled = db.usageEvents.filter(row => row.status === 'completed').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  return { ok: true, usageEvents: db.usageEvents.length, pendingReservations: db.usageReservations.filter(row => row.status === 'reserved').length, lastSettledAt: settled[0]?.updatedAt || null }
}

const financeWrites = () => process.env.FINANCE_WRITE_SOURCE === 'postgres'
const financeWriteFallback = () => process.env.FINANCE_WRITE_FALLBACK_SQLITE !== 'false'
async function persistFinanceWrite(result) {
  if (!financeWrites() || !result?.ok) return result
  try { await syncFinanceProjection(); return result } catch (error) { console.error(JSON.stringify({ event: 'finance_postgres_write_failed', error: error.message })); if (financeWriteFallback()) return result; return { ok: false, error: 'finance_write_temporarily_unavailable' } }
}
export async function reserveUsageAsync(facts) {
  if (facts.fundingSource === 'organization') return persistFinanceWrite(reserveUsage(facts))
  if (financePostgresEnabled()) {
    try { return await reserveUsagePostgres(facts) } catch (error) {
      console.error(JSON.stringify({ event: 'finance_postgres_reservation_failed', error: error.message }))
      if (!financeWriteFallback()) return { ok: false, error: 'finance_write_temporarily_unavailable' }
    }
  }
  return persistFinanceWrite(reserveUsage(facts))
}

export async function settleUsageAsync(facts) {
  if (facts.fundingSource === 'organization' || facts.metadata?.organizationId) return persistFinanceWrite(settleUsage(facts))
  if (financePostgresEnabled()) {
    try { return await settleUsagePostgres(facts) } catch (error) {
      console.error(JSON.stringify({ event: 'finance_postgres_settlement_failed', error: error.message }))
      if (!financeWriteFallback()) return { ok: false, error: 'finance_write_temporarily_unavailable' }
    }
  }
  return persistFinanceWrite(settleUsage(facts))
}
