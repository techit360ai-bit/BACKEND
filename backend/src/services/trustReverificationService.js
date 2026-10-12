// WS9 continuous re-verification, decay, and expiry.
//
// One scheduler tick does exactly what the plan's acceptance criterion needs:
//   - a verified proof whose source TTL (SYNC_INTERVALS) has lapsed flips to
//     `expired`, which removes it from `activeProofs` and drops the score,
//   - a verified skill past its TTL flips to `expired`,
//   - the affected user's profile + snapshot + projection outbox are recomputed
//     so the badge is inactive within the same tick,
//   - founder + investor notifications are emitted (deduped, append-only).
//
// It mirrors trustAuthority.js dispatch: the legacy snapshot authority by
// default, the row-level repository when TRUST_WRITE_SOURCE=postgres. Scoring
// and TTLs are shared, so expiry can never diverge between the two paths.

import { createId, nowIso } from '../utils/api.js'
import * as database from '../config/database.js'
import { trustScoreFor } from './trustVerificationAuthority.js'
import { trustWriteEnabled, trustRepositoryEnabled, trustReadEnabled, countDueReverification } from '../repositories/trustRepository.js'
import { isExpired } from '../config/trustSyncIntervals.js'
import { incTrustMetric } from './trustMetrics.js'

const readAuthorityDb = (...args) => database.readDb(...args)
const updateAuthorityDb = mutator => {
  try { if (typeof database.updateDb === 'function') return database.updateDb(mutator) } catch {}
  return mutator(database.readDb())
}
const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const toIso = value => (value instanceof Date ? value.toISOString() : new Date(value).toISOString())

export function trustReverificationEnabled(env = process.env) {
  return String(env.TRUST_REVERIFICATION_ENABLED || '').trim().toLowerCase() === 'true'
}

function pushNotification(db, notification) {
  const list = rows(db, 'notifications')
  const digestKey = notification.metadata?.digestKey
  if (digestKey && list.some(row => row.metadata?.digestKey === digestKey)) return null
  list.push(notification)
  return notification
}

// Founder-facing notification plus a fan-out to investors who hold approved
// Trust access to any of the founder's projects that the source belonged to.
function notifyAffectedUsers(db, { userId, proof, now }) {
  const created = []
  const founder = pushNotification(db, {
    id: createId('notification'),
    userId,
    type: 'trust_verification_expired',
    title: 'Trust verification expired',
    message: `Your ${proof.source} verification expired and was removed from your Trust score. Re-verify to restore it.`,
    linkTo: '/founder/trust',
    read: false,
    metadata: { digestKey: `trust_expired:${proof.id}`, source: proof.source, proofId: proof.id, expiresAt: proof.expiresAt },
    createdAt: now,
  })
  if (founder) created.push(founder)

  const projectId = proof.projectId
  const ownerOf = project => project?.ownerId || project?.founderId || project?.creatorId || project?.userId || project?.createdBy || null
  const projects = projectId
    ? rows(db, 'projects').filter(project => String(project.id) === String(projectId))
    : rows(db, 'projects').filter(project => String(ownerOf(project)) === String(userId))
  const projectIds = new Set(projects.map(project => String(project.id)))
  if (!projectIds.size) return created
  const investors = rows(db, 'investorTrustAccessRequests')
    .filter(request => request.status === 'approved' && projectIds.has(String(request.projectId)))
  for (const request of investors) {
    const investorNote = pushNotification(db, {
      id: createId('notification'),
      userId: request.investorId,
      type: 'trust_verification_expired',
      title: 'Startup Trust signal changed',
      message: `A verified source for a startup you follow expired and their Trust score was reduced.`,
      linkTo: `/investor/trust/${request.projectId}`,
      read: false,
      metadata: { digestKey: `trust_expired:${proof.id}:investor:${request.investorId}`, source: proof.source, projectId: request.projectId },
      createdAt: now,
    })
    if (investorNote) created.push(investorNote)
  }
  return created
}

export function recomputeLegacyProfile(db, userId, now) {
  const score = trustScoreFor(db, userId)
  const existing = rows(db, 'trustProfiles').find(row => row.userId === userId && (row.projectId || null) === null)
  const profile = existing || { id: createId('trust'), userId, projectId: null, createdAt: now }
  Object.assign(profile, {
    trustScore: score.trustScore,
    assurance: score.tier,
    verificationStatus: score.verificationStatus,
    breakdown: score.breakdown,
    signals: score.signals,
    proofCount: score.proofCount,
    verifiedSkillCount: score.verifiedSkillCount,
    updatedAt: now,
  })
  if (!existing) rows(db, 'trustProfiles').push(profile)
  rows(db, 'trustScoreSnapshots').push({
    id: createId('trust_snapshot'), userId, projectId: null,
    score: score.trustScore, tier: score.tier, breakdown: score.breakdown,
    policyVersion: 'trust-v2', createdAt: now,
  })
  rows(db, 'trustProjectionOutbox').push({
    id: createId('trust_projection'), type: 'trust.decayed', userId, projectId: null, proofId: null,
    score: { trustScore: score.trustScore, tier: score.tier, breakdown: score.breakdown, signals: score.signals },
    createdAt: now, deliveredAt: null,
  })
  return score
}

// Pure, db-in-place tick. Exported for tests and reused by the legacy wrapper.
export function expireStaleInDb(db, { now = new Date(), limit = 200 } = {}) {
  const nowIsoValue = toIso(now)
  const nowMs = new Date(nowIsoValue).getTime()
  const capped = Math.max(1, Number(limit) || 200)
  const expiredProofs = []
  const expiredSkills = []
  const affected = new Set()
  const notifications = []

  for (const proof of rows(db, 'trustVerificationProofs')) {
    if (expiredProofs.length >= capped) break
    if (proof.status !== 'verified') continue
    if (!isExpired(proof.expiresAt, nowMs)) continue
    proof.status = 'expired'
    proof.updatedAt = nowIsoValue
    expiredProofs.push(proof)
    affected.add(proof.userId)
    rows(db, 'trustVerificationHistory').push({
      id: createId('trust_event'), verificationId: proof.id, userId: proof.userId, projectId: proof.projectId,
      source: proof.source, status: 'expired', confidence: proof.confidence, metadataHash: proof.evidenceHash,
      eventType: 'trust_expired', createdAt: nowIsoValue, expiresAt: proof.expiresAt,
    })
  }

  for (const skill of rows(db, 'verifiedSkills')) {
    if (expiredSkills.length >= capped) break
    if (skill.status !== 'verified') continue
    if (!isExpired(skill.expiresAt, nowMs)) continue
    skill.status = 'expired'
    skill.updatedAt = nowIsoValue
    expiredSkills.push(skill)
    affected.add(skill.userId)
  }

  const profiles = []
  for (const userId of affected) {
    const score = recomputeLegacyProfile(db, userId, nowIsoValue)
    profiles.push({ userId, trustScore: score.trustScore, tier: score.tier })
    for (const proof of expiredProofs.filter(row => row.userId === userId)) {
      notifications.push(...notifyAffectedUsers(db, { userId, proof, now: nowIsoValue }))
    }
  }

  return {
    now: nowIsoValue,
    expired_proofs: expiredProofs.map(proof => ({ id: proof.id, userId: proof.userId, source: proof.source, expiresAt: proof.expiresAt })),
    expired_skills: expiredSkills.map(skill => ({ id: skill.id, userId: skill.userId, skill: skill.skill })),
    affected_users: [...affected],
    profiles,
    notifications,
  }
}

// Row-level (postgres) path: expire via the repository, then recompute each
// affected profile through the async authority so scoring stays identical.
async function runRepositoryTick({ now, limit }) {
  const repo = await import('../repositories/trustRepository.js')
  const { refreshTrustProfile } = await import('./trustAuthorityAsync.js')
  const nowIsoValue = toIso(now)
  const expiredProofs = []
  const expiredSkills = []
  const affected = new Set()

  for (const proof of await repo.listExpiredProofs(nowIsoValue, limit)) {
    const row = await repo.expireProof(proof.id)
    if (!row) continue
    expiredProofs.push(row)
    affected.add(row.userId)
    await repo.insertHistory({
      id: createId('trust_event'), verificationId: row.id, userId: row.userId, projectId: row.projectId,
      source: row.source, status: 'expired', confidence: row.confidence, metadataHash: row.evidenceHash,
      eventType: 'trust_expired', createdAt: nowIsoValue, expiresAt: row.expiresAt,
    })
  }
  for (const skill of await repo.listExpiredSkills(nowIsoValue, limit)) {
    const row = await repo.expireSkill(skill.id)
    if (!row) continue
    expiredSkills.push(row)
    affected.add(row.userId)
  }

  const profiles = []
  const notifications = []
  for (const userId of affected) {
    const score = await refreshTrustProfile(userId)
    profiles.push({ userId, trustScore: score.trustScore, tier: score.tier })
    if (expiredProofs.some(proof => proof.userId === userId)) {
      updateAuthorityDb(db => {
        for (const proof of expiredProofs.filter(row => row.userId === userId)) {
          notifications.push(...notifyAffectedUsers(db, { userId, proof, now: nowIsoValue }))
        }
        return db
      })
    }
  }

  return {
    now: nowIsoValue,
    expired_proofs: expiredProofs.map(proof => ({ id: proof.id, userId: proof.userId, source: proof.source, expiresAt: proof.expiresAt })),
    expired_skills: expiredSkills.map(skill => ({ id: skill.id, userId: skill.userId, skill: skill.skill })),
    affected_users: [...affected],
    profiles,
    notifications,
  }
}

export async function runTrustReverificationTick({ now = new Date(), limit = 200 } = {}) {
  const result = trustWriteEnabled() && trustRepositoryEnabled()
    ? await runRepositoryTick({ now, limit })
    : await updateAuthorityDb(db => expireStaleInDb(db, { now, limit }))
  // WS11: expiries per tick (badge decay is a health signal, not just an event).
  incTrustMetric('trust_expired_proofs_total', {}, result.expired_proofs?.length || 0)
  incTrustMetric('trust_expired_skills_total', {}, result.expired_skills?.length || 0)
  return result
}

// Lightweight, read-only planning view (no mutation): what would expire now.
export function trustReverificationDue({ now = new Date() } = {}) {
  const nowMs = new Date(toIso(now)).getTime()
  const db = readAuthorityDb()
  const proofs = rows(db, 'trustVerificationProofs').filter(proof => proof.status === 'verified' && isExpired(proof.expiresAt, nowMs))
  const skills = rows(db, 'verifiedSkills').filter(skill => skill.status === 'verified' && isExpired(skill.expiresAt, nowMs))
  return {
    now: toIso(now),
    due_proof_count: proofs.length,
    due_skill_count: skills.length,
    sources: [...new Set(proofs.map(proof => proof.source))],
  }
}

// Row-level planning view: SQL counts instead of loading every due row. Falls
// back to the snapshot while TRUST_READ_SOURCE is not postgres.
export async function trustReverificationDueAsync({ now = new Date() } = {}) {
  if (!trustReadEnabled()) return trustReverificationDue({ now })
  const nowIsoValue = toIso(now)
  try {
    const counts = await countDueReverification(nowIsoValue)
    return { now: nowIsoValue, due_proof_count: counts.proofs, due_skill_count: counts.skills, sources: counts.sources, deterministic: true }
  } catch (error) {
    console.error(JSON.stringify({ event: 'trust_reverification_postgres_read_failed', error: error.message }))
    return trustReverificationDue({ now })
  }
}

export const __internals = { expireStaleInDb, recomputeLegacyProfile }
