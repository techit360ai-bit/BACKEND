import { createId, nowIso } from '../utils/api.js'
import { withPlatformTransaction, upsertRecord } from './platformCollectionRepository.js'

const enabled = () => process.env.FINANCE_WRITE_SOURCE === 'postgres'
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

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
    const now = nowIso(); const credits = status === 'completed' ? number(reservation?.reservedCredits) : 0
    const usageEvent = { id: createId('usage'), requestId, payloadHash: facts.payloadHash || null, userId, workspaceId: facts.workspace_id || facts.workspaceId || null, taskType, provider: facts.provider || 'unknown', model: facts.model || 'unknown', status, promptTokens: number(facts.prompt_tokens ?? facts.promptTokens), completionTokens: number(facts.completion_tokens ?? facts.completionTokens), totalTokens: number(facts.total_tokens ?? facts.totalTokens), providerCostUsd: number(facts.provider_cost_usd ?? facts.providerCostUsd), latencyMs: number(facts.latency_ms ?? facts.latencyMs), attemptCount: number(facts.attempt_count ?? facts.attemptCount, 1), cacheHit: Boolean(facts.cache_hit ?? facts.cacheHit), grantId: facts.grant_id || facts.grantId || null, reservationId: reservation?.reservationId || facts.reservation_id || facts.reservationId || null, credits, totalCogs: number(facts.provider_cost_usd ?? facts.providerCostUsd), customerPrice: 0, grossMargin: 0, fundingSource: reservation?.fundingSource || 'unknown', metadata: facts.metadata || {}, createdAt: now, updatedAt: now }
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
