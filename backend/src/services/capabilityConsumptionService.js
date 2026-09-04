import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'
import { reserveUsage, settleUsage } from './usageSettlementService.js'

export function reserveCapabilityConsumption(userId, decision, idempotencyKey, options = {}) {
  if (!decision.allowed) return { ok: false, error: 'capability_not_authorized' }
  const existing = (readDb().capabilityConsumptions || []).find(row => row.idempotencyKey === idempotencyKey)
  if (existing) return existing.userId === userId && existing.capability === decision.capability ? { ok: true, idempotent: true, consumption: existing } : { ok: false, error: 'idempotency_key_conflict' }
  // TVCE does not assign capability prices. A positive estimate is supplied
  // by the runtime usage meter when an execution is about to start.
  const required = Math.max(0, Number(options.estimatedCredits || 0))
  let fundingSource = decision.subscription?.active && decision.subscription?.entitlements?.[decision.capability] !== false ? 'subscription' : required > 0 ? 'payg' : 'entitlement'
  let reservation = null
  if (required > 0) {
    reservation = reserveUsage({ userId, requestId: idempotencyKey, taskType: `capability:${decision.capability}`, estimatedCredits: required, fundingSource, metadata: { capability: decision.capability } })
    if (!reservation.ok && fundingSource === 'subscription') {
      fundingSource = 'payg'
      reservation = reserveUsage({ userId, requestId: idempotencyKey, taskType: `capability:${decision.capability}`, estimatedCredits: required, fundingSource, metadata: { capability: decision.capability } })
    }
    if (!reservation.ok) return reservation
  }
  return updateDb(db => {
    if (!Array.isArray(db.capabilityConsumptions)) db.capabilityConsumptions = []
    const now = nowIso(); const consumption = { id: createId('capability_use'), idempotencyKey, userId, capability: decision.capability, fundingSource, credits: required, reservationId: reservation?.reservation?.reservationId || null, status: 'reserved', metering: required > 0 ? 'runtime' : 'none', createdAt: now, updatedAt: now }
    db.capabilityConsumptions.push(consumption); return { ok: true, idempotent: false, consumption }
  })
}

export function settleCapabilityConsumption(consumptionId, responseStatus) {
  const snapshot = (readDb().capabilityConsumptions || []).find(item => item.id === consumptionId)
  if (!snapshot) return { ok: false, error: 'consumption_not_found' }
  if (snapshot.status !== 'reserved') return { ok: true, idempotent: true, consumption: snapshot }
  const success = Number(responseStatus) >= 200 && Number(responseStatus) < 400
  if (snapshot.reservationId) {
    const settlement = settleUsage({ requestId: snapshot.idempotencyKey, reservationId: snapshot.reservationId, userId: snapshot.userId, workspaceId: null, taskType: `capability:${snapshot.capability}`, status: success ? 'completed' : 'cancelled', provider: 'backend', model: 'deterministic', metadata: { capability: snapshot.capability } })
    if (!settlement.ok) return settlement
  }
  return updateDb(db => {
    if (!Array.isArray(db.capabilityAnalytics)) db.capabilityAnalytics = []
    const row = db.capabilityConsumptions.find(item => item.id === consumptionId)
    row.status = success ? 'settled' : 'released'; row.responseStatus = Number(responseStatus); row.updatedAt = nowIso()
    db.capabilityAnalytics.push({ id: createId('capability_event'), userId: row.userId, capability: row.capability, eventType: success ? 'capability_completed' : 'capability_released', metadata: { fundingSource: row.fundingSource, credits: row.credits, responseStatus }, createdAt: nowIso() })
    return { ok: true, consumption: row }
  })
}
