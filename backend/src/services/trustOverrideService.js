// WS9 manual trust-score overrides (admin-only).
//
// An override is explicit, time-boxed, reason-coded, and audit-logged. It is
// applied on top of the computed score and surfaced in the breakdown as
// `manual_override`. Removing it is always a revoke (never a delete) so the
// audit trail stays append-only. Reason code + expiry are mandatory and the
// delta is bounded (see trustScoreOverrides.js).
//
// Mirrors trustAuthority.js dispatch: legacy snapshot authority by default,
// row-level repository when TRUST_WRITE_SOURCE=postgres.

import { createId, nowIso } from '../utils/api.js'
import * as database from '../config/database.js'
import { validateOverrideInput } from './trustScoreOverrides.js'
import { recomputeLegacyProfile } from './trustReverificationService.js'
import { trustWriteEnabled, trustRepositoryEnabled } from '../repositories/trustRepository.js'

const readAuthorityDb = (...args) => database.readAuthorityDb(...args)
const updateAuthorityDb = mutator => {
  try { if (typeof database.updateAuthorityDb === 'function') return database.updateAuthorityDb(mutator) } catch {}
  return mutator(database.readAuthorityDb())
}
const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }

function recordAudit(db, { adminId, override, decision, now }) {
  rows(db, 'manualReviews').push({
    id: createId('manual_review'),
    operationKind: 'trust_score_override',
    operationId: override.id,
    adminId,
    decision,
    note: override.note || null,
    reasonCode: override.reasonCode || null,
    createdAt: now,
    expiresAt: override.expiresAt || null,
  })
}

function applyLegacy({ adminId, userId, value }) {
  return updateAuthorityDb(db => {
    const now = nowIso()
    const override = { id: createId('trust_override'), userId, ...value, adminId, revokedAt: null, revokedBy: null, createdAt: now }
    rows(db, 'trustScoreOverrides').push(override)
    recordAudit(db, { adminId, override, decision: 'applied', now })
    const score = recomputeLegacyProfile(db, userId, now)
    return { ok: true, override, score: { trustScore: score.trustScore, tier: score.tier, breakdown: score.breakdown, signals: score.signals } }
  })
}

function revokeLegacy({ adminId, userId, overrideId }) {
  return updateAuthorityDb(db => {
    const override = rows(db, 'trustScoreOverrides').find(row => row.id === overrideId && row.userId === userId)
    if (!override) return { ok: false, status: 404, error: 'trust_override_not_found' }
    if (override.revokedAt) return { ok: true, override, idempotent: true }
    const now = nowIso()
    override.revokedAt = now
    override.revokedBy = adminId
    recordAudit(db, { adminId, override, decision: 'revoked', now })
    const score = recomputeLegacyProfile(db, userId, now)
    return { ok: true, override, score: { trustScore: score.trustScore, tier: score.tier, breakdown: score.breakdown, signals: score.signals } }
  })
}

async function applyRepository({ adminId, userId, value }) {
  const repo = await import('../repositories/trustRepository.js')
  const { refreshTrustProfile } = await import('./trustAuthorityAsync.js')
  const now = nowIso()
  const override = await repo.insertOverride({ id: createId('trust_override'), userId, ...value, adminId, createdAt: now })
  if (!override) return { ok: false, status: 409, error: 'trust_override_conflict' }
  await repo.recordManualReview({
    id: createId('manual_review'), operationKind: 'trust_score_override', operationId: override.id,
    adminId, decision: 'applied', note: override.note || null, reasonCode: override.reasonCode || null,
    createdAt: now, expiresAt: override.expiresAt || null,
  })
  const score = await refreshTrustProfile(userId)
  return { ok: true, override, score }
}

async function revokeRepository({ adminId, userId, overrideId }) {
  const repo = await import('../repositories/trustRepository.js')
  const { refreshTrustProfile } = await import('./trustAuthorityAsync.js')
  const now = nowIso()
  const override = await repo.revokeOverride(overrideId, adminId)
  if (!override || override.userId !== userId) return { ok: false, status: 404, error: 'trust_override_not_found' }
  await repo.recordManualReview({
    id: createId('manual_review'), operationKind: 'trust_score_override', operationId: override.id,
    adminId, decision: 'revoked', note: override.note || null, reasonCode: override.reasonCode || null,
    createdAt: now, expiresAt: override.expiresAt || null,
  })
  const score = await refreshTrustProfile(userId)
  return { ok: true, override, score }
}

export async function applyTrustOverride(adminId, userId, input = {}, { env = process.env } = {}) {
  const id = String(userId || '').trim()
  if (!id) return { ok: false, status: 400, error: 'user_id_required' }
  const validated = validateOverrideInput(input, env)
  if (!validated.ok) return validated
  if (trustWriteEnabled() && trustRepositoryEnabled()) return applyRepository({ adminId, userId: id, value: validated.value })
  return applyLegacy({ adminId, userId: id, value: validated.value })
}

export async function revokeTrustOverride(adminId, userId, overrideId) {
  const id = String(userId || '').trim()
  const override = String(overrideId || '').trim()
  if (!id || !override) return { ok: false, status: 400, error: 'override_id_required' }
  if (trustWriteEnabled() && trustRepositoryEnabled()) return revokeRepository({ adminId, userId: id, overrideId: override })
  return revokeLegacy({ adminId, userId: id, overrideId: override })
}

export async function listTrustOverrides(userId) {
  if (trustWriteEnabled() && trustRepositoryEnabled()) {
    const repo = await import('../repositories/trustRepository.js')
    return { ok: true, overrides: await repo.listOverrides(userId) }
  }
  const db = readAuthorityDb()
  return {
    ok: true,
    overrides: rows(db, 'trustScoreOverrides')
      .filter(row => row.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  }
}
