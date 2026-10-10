// Row-level trust authority repository.
//
// This is the WS0 replacement for reading/writing trust rows through the
// whole-database snapshot authority. Reads are scoped to one user (bounded
// per-request cost); writes are row-level, transactional, and optimistically
// concurrent. It talks to the normalized trust tables (migrations 018 + 019)
// in TRUST_DATABASE_URL.
//
// Privacy: only normalized metadata, aggregates, and hashes live here.

import pg from 'pg'
import { incTrustMetric } from '../services/trustMetrics.js'

let pool = null

const url = () => process.env.TRUST_DATABASE_URL || process.env.DATABASE_URL
const nowIso = () => new Date().toISOString()

export function trustRepositoryEnabled() {
  return process.env.TRUST_READ_SOURCE === 'postgres' || process.env.TRUST_WRITE_SOURCE === 'postgres'
}

export function trustReadEnabled() { return process.env.TRUST_READ_SOURCE === 'postgres' }
export function trustWriteEnabled() { return process.env.TRUST_WRITE_SOURCE === 'postgres' }

export function getTrustPool() {
  if (pool) return pool
  if (!url()) throw new Error('TRUST_DATABASE_URL or DATABASE_URL is required for trust repository access')
  pool = new pg.Pool({
    connectionString: url(),
    max: Math.max(1, Number(process.env.TRUST_DB_POOL_SIZE || 5)),
    connectionTimeoutMillis: Number(process.env.TRUST_DB_CONNECTION_TIMEOUT_MS || 5000),
    ssl: /sslmode=require/.test(url()) ? { rejectUnauthorized: process.env.TRUST_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
  })
  return pool
}

// Test seam. Never used in production paths.
export function __setTrustPoolForTests(next) { pool = next }
export function __resetTrustPoolForTests() { pool = null }

const run = (client, text, params) => (client || getTrustPool()).query(text, params)

const mapProof = row => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id,
  source: row.source,
  method: row.method,
  providerSubjectId: row.provider_subject_id,
  status: row.status,
  confidence: Number(row.confidence || 0),
  points: Number(row.points || 0),
  metadata: row.metadata || {},
  evidenceHash: row.evidence_hash,
  expiresAt: row.expires_at,
  verifiedAt: row.verified_at,
  reviewedBy: row.reviewed_by,
  reviewedAt: row.reviewed_at,
  reviewNote: row.review_note,
  attestationLevel: row.attestation_level || 'self',
  correlationGroup: row.correlation_group,
  halfLifeDays: row.half_life_days == null ? null : Number(row.half_life_days),
  metricWindow: row.metric_window,
  policyVersion: row.policy_version || 'trust-v2',
  lastSyncedAt: row.last_synced_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapSkill = row => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id,
  skill: row.skill,
  source: row.source,
  proofId: row.proof_id,
  confidence: Number(row.confidence || 0),
  evidenceHash: row.evidence_hash,
  status: row.status,
  expiresAt: row.expires_at,
  policyVersion: row.policy_version || 'trust-v2',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapHistory = row => ({
  id: row.id,
  verificationId: row.verification_id,
  userId: row.user_id,
  projectId: row.project_id,
  source: row.source,
  status: row.status,
  confidence: Number(row.confidence || 0),
  metadataHash: row.metadata_hash,
  eventType: row.event_type,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
})

const mapChallenge = row => ({
  id: row.id,
  userId: row.user_id,
  domain: row.domain,
  recordName: row.record_name,
  method: row.method,
  tokenHash: row.token_hash,
  status: row.status,
  lastCheckedAt: row.last_checked_at,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapProfile = row => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id,
  trustScore: Number(row.trust_score || 0),
  assurance: row.assurance,
  verificationStatus: row.verification_status,
  confidenceScore: row.confidence_score == null ? null : Number(row.confidence_score),
  breakdown: row.breakdown || {},
  signals: row.signals || [],
  proofCount: Number(row.proof_count || 0),
  verifiedSkillCount: Number(row.verified_skill_count || 0),
  lastSyncAt: row.last_sync_at,
  policyVersion: row.policy_version || 'trust-v2',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapSnapshot = row => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id,
  score: Number(row.score || 0),
  tier: row.tier,
  breakdown: row.breakdown || {},
  policyVersion: row.policy_version || 'trust-v2',
  createdAt: row.created_at,
})

const mapOutbox = row => ({
  id: row.id,
  type: row.type,
  userId: row.user_id,
  projectId: row.project_id,
  proofId: row.proof_id,
  score: row.score || {},
  attempts: Number(row.attempts || 0),
  lastError: row.last_error,
  createdAt: row.created_at,
  deliveredAt: row.delivered_at,
})

const mapOverride = row => ({
  id: row.id,
  userId: row.user_id,
  projectId: row.project_id,
  source: row.source,
  delta: Number(row.delta || 0),
  reasonCode: row.reason_code,
  note: row.note,
  adminId: row.admin_id,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  revokedBy: row.revoked_by,
  createdAt: row.created_at,
})

export async function withTrustTransaction(fn, { userId = null } = {}) {
  const client = await getTrustPool().connect()
  try {
    await client.query('BEGIN')
    if (userId) await client.query("SELECT set_config('app.user_id',$1,true)", [String(userId)])
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Bounded read: only this user's trust rows, so per-request cost no longer
// scales with total platform size.
export async function loadTrustScope(userId, { client } = {}) {
  const [proofs, skills, history, challenges, profiles, snapshots, outbox, overrides] = await Promise.all([
    run(client, 'SELECT * FROM trust_verification_proofs WHERE user_id=$1', [userId]),
    run(client, 'SELECT * FROM trust_verified_skills WHERE user_id=$1', [userId]),
    run(client, 'SELECT * FROM trust_verification_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 500', [userId]),
    run(client, 'SELECT * FROM trust_verification_challenges WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [userId]),
    run(client, 'SELECT * FROM trust_profiles WHERE user_id=$1', [userId]),
    run(client, 'SELECT * FROM trust_score_snapshots WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [userId]),
    run(client, 'SELECT * FROM trust_projection_outbox WHERE user_id=$1 AND delivered_at IS NULL ORDER BY created_at DESC LIMIT 100', [userId]),
    run(client, 'SELECT * FROM trust_score_overrides WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 100', [userId]),
  ])
  return {
    users: [{ id: userId }],
    profiles: [{ id: userId }],
    trustVerificationProofs: proofs.rows.map(mapProof),
    verifiedSkills: skills.rows.map(mapSkill),
    trustVerificationHistory: history.rows.map(mapHistory),
    trustVerificationChallenges: challenges.rows.map(mapChallenge),
    trustProfiles: profiles.rows.map(mapProfile),
    trustScoreSnapshots: snapshots.rows.map(mapSnapshot),
    trustProjectionOutbox: outbox.rows.map(mapOutbox),
    trustScoreOverrides: overrides.rows.map(mapOverride),
  }
}

export async function listProofs(userId, { client } = {}) {
  const result = await run(client, 'SELECT * FROM trust_verification_proofs WHERE user_id=$1 ORDER BY updated_at DESC', [userId])
  return result.rows.map(mapProof)
}

// Bounded admin reads. These are deliberately paginated; the admin surface
// must never issue an unbounded scan of all users' proofs.
export async function listRecentProofs(limit = 100, { client } = {}) {
  const capped = Math.min(500, Math.max(1, Number(limit) || 100))
  const result = await run(client, 'SELECT * FROM trust_verification_proofs ORDER BY updated_at DESC LIMIT $1', [capped])
  return result.rows.map(mapProof)
}

export async function listRecentChallenges(limit = 100, { client } = {}) {
  const capped = Math.min(500, Math.max(1, Number(limit) || 100))
  const result = await run(client, 'SELECT * FROM trust_verification_challenges ORDER BY updated_at DESC LIMIT $1', [capped])
  return result.rows.map(mapChallenge)
}

export async function getProof(id, { client } = {}) {
  const result = await run(client, 'SELECT * FROM trust_verification_proofs WHERE id=$1', [id])
  return result.rows[0] ? mapProof(result.rows[0]) : null
}

export async function insertProof(proof, { client } = {}) {
  await run(client, `INSERT INTO trust_verification_proofs
    (id,user_id,project_id,source,method,provider_subject_id,status,confidence,points,metadata,evidence_hash,expires_at,verified_at,reviewed_by,reviewed_at,attestation_level,correlation_group,half_life_days,metric_window,policy_version,last_synced_at,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
    ON CONFLICT(id) DO NOTHING`, [
    proof.id, proof.userId, proof.projectId || null, proof.source, proof.method, proof.providerSubjectId || null,
    proof.status, proof.confidence, proof.points, JSON.stringify(proof.metadata || {}), proof.evidenceHash,
    proof.expiresAt || null, proof.verifiedAt || null, proof.reviewedBy || null, proof.reviewedAt || null,
    proof.attestationLevel || 'self', proof.correlationGroup || null,
    proof.halfLifeDays == null ? null : proof.halfLifeDays, proof.metricWindow || null,
    proof.policyVersion || 'trust-v2', proof.lastSyncedAt || null, proof.createdAt, proof.updatedAt,
  ])
  return proof
}

// Optimistic status transition. Pass expectedStatus to reject stale writes.
export async function updateProofStatus(id, patch = {}, { client, expectedStatus } = {}) {
  const columns = []
  const values = [id]
  const push = (column, value) => { values.push(value); columns.push(`${column}=$${values.length}`) }
  if (patch.status !== undefined) push('status', patch.status)
  if (patch.reviewedBy !== undefined) push('reviewed_by', patch.reviewedBy)
  if (patch.reviewedAt !== undefined) push('reviewed_at', patch.reviewedAt)
  if (patch.reviewNote !== undefined) push('review_note', patch.reviewNote)
  if (patch.verifiedAt !== undefined) push('verified_at', patch.verifiedAt)
  if (patch.attestationLevel !== undefined) push('attestation_level', patch.attestationLevel)
  if (patch.lastSyncedAt !== undefined) push('last_synced_at', patch.lastSyncedAt)
  push('updated_at', patch.updatedAt || nowIso())
  let where = 'id=$1'
  if (expectedStatus !== undefined) { values.push(expectedStatus); where += ` AND status=$${values.length}` }
  const result = await run(client, `UPDATE trust_verification_proofs SET ${columns.join(', ')} WHERE ${where} RETURNING *`, values)
  return result.rows[0] ? mapProof(result.rows[0]) : null
}

export async function revokeVerifiedProofs(userId, source, { client } = {}) {
  const result = await run(client, `UPDATE trust_verification_proofs SET status='revoked', updated_at=$3 WHERE user_id=$1 AND source=$2 AND status='verified' RETURNING *`, [userId, source, nowIso()])
  return result.rows.map(mapProof)
}

export async function insertHistory(entry, { client } = {}) {
  await run(client, `INSERT INTO trust_verification_history
    (id,verification_id,user_id,project_id,source,status,confidence,metadata_hash,event_type,created_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT(id) DO NOTHING`, [
    entry.id, entry.verificationId || null, entry.userId, entry.projectId || null, entry.source, entry.status,
    entry.confidence ?? 0, entry.metadataHash || null, entry.eventType, entry.createdAt || nowIso(), entry.expiresAt || null,
  ])
  return entry
}

export async function listHistory(userId, limit = 50, { client } = {}) {
  const capped = Math.min(100, Math.max(1, Number(limit) || 50))
  const result = await run(client, 'SELECT * FROM trust_verification_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2', [userId, capped])
  return result.rows.map(mapHistory)
}

export async function upsertSkill(skill, { client } = {}) {
  const now = skill.updatedAt || nowIso()
  const updated = await run(client, `UPDATE trust_verified_skills
    SET proof_id=$4, source=$5, confidence=$6, evidence_hash=$7, status=$8, expires_at=$9, policy_version=$10, updated_at=$11
    WHERE user_id=$1 AND project_id IS NOT DISTINCT FROM $2 AND skill=$3 AND status=$8 RETURNING *`, [
    skill.userId, skill.projectId ?? null, skill.skill, skill.proofId || null, skill.source,
    skill.confidence ?? 0.5, skill.evidenceHash, skill.status || 'verified', skill.expiresAt || null,
    skill.policyVersion || 'trust-v2', now,
  ])
  if (updated.rowCount) return mapSkill(updated.rows[0])
  const inserted = await run(client, `INSERT INTO trust_verified_skills
    (id,user_id,project_id,skill,source,proof_id,confidence,evidence_hash,status,expires_at,policy_version,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [
    skill.id, skill.userId, skill.projectId ?? null, skill.skill, skill.source, skill.proofId || null,
    skill.confidence ?? 0.5, skill.evidenceHash, skill.status || 'verified', skill.expiresAt || null,
    skill.policyVersion || 'trust-v2', skill.createdAt || now, now,
  ])
  return mapSkill(inserted.rows[0])
}

export async function listSkills(userId, { client } = {}) {
  const result = await run(client, 'SELECT * FROM trust_verified_skills WHERE user_id=$1', [userId])
  return result.rows.map(mapSkill)
}

// Cross-account anti-gaming lookups. Bounded and indexed (see migration 019).
export async function findProofsByEvidenceHash(evidenceHash, { client } = {}) {
  if (!evidenceHash) return []
  const result = await run(client, 'SELECT * FROM trust_verification_proofs WHERE evidence_hash=$1 LIMIT 50', [evidenceHash])
  return result.rows.map(mapProof)
}

export async function findProofsByProviderSubject(source, providerSubjectId, { client } = {}) {
  if (!source || !providerSubjectId) return []
  const result = await run(client, 'SELECT * FROM trust_verification_proofs WHERE source=$1 AND provider_subject_id=$2 LIMIT 50', [source, providerSubjectId])
  return result.rows.map(mapProof)
}

export async function getProfile(userId, projectId = null, { client } = {}) {
  const result = await run(client, 'SELECT * FROM trust_profiles WHERE user_id=$1 AND project_id IS NOT DISTINCT FROM $2', [userId, projectId])
  return result.rows[0] ? mapProfile(result.rows[0]) : null
}

export async function upsertProfile(profile, { client } = {}) {
  const now = profile.updatedAt || nowIso()
  const updated = await run(client, `UPDATE trust_profiles
    SET trust_score=$3, assurance=$4, verification_status=$5, confidence_score=$6, breakdown=$7, signals=$8,
        proof_count=$9, verified_skill_count=$10, last_sync_at=$11, policy_version=$12, updated_at=$13
    WHERE user_id=$1 AND project_id IS NOT DISTINCT FROM $2 RETURNING *`, [
    profile.userId, profile.projectId ?? null, profile.trustScore ?? 0, profile.assurance || null,
    profile.verificationStatus || null, profile.confidenceScore ?? null, JSON.stringify(profile.breakdown || {}),
    JSON.stringify(profile.signals || []), profile.proofCount || 0, profile.verifiedSkillCount || 0,
    profile.lastSyncAt || null, profile.policyVersion || 'trust-v2', now,
  ])
  if (updated.rowCount) return mapProfile(updated.rows[0])
  const inserted = await run(client, `INSERT INTO trust_profiles
    (id,user_id,project_id,trust_score,assurance,verification_status,confidence_score,breakdown,signals,proof_count,verified_skill_count,last_sync_at,policy_version,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`, [
    profile.id, profile.userId, profile.projectId ?? null, profile.trustScore ?? 0, profile.assurance || null,
    profile.verificationStatus || null, profile.confidenceScore ?? null, JSON.stringify(profile.breakdown || {}),
    JSON.stringify(profile.signals || []), profile.proofCount || 0, profile.verifiedSkillCount || 0,
    profile.lastSyncAt || null, profile.policyVersion || 'trust-v2', profile.createdAt || now, now,
  ])
  return mapProfile(inserted.rows[0])
}

export async function insertSnapshot(snapshot, { client } = {}) {
  await run(client, `INSERT INTO trust_score_snapshots(id,user_id,project_id,score,tier,breakdown,policy_version,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING`, [
    snapshot.id, snapshot.userId, snapshot.projectId || null, snapshot.score ?? 0, snapshot.tier || null,
    JSON.stringify(snapshot.breakdown || {}), snapshot.policyVersion || 'trust-v2', snapshot.createdAt || nowIso(),
  ])
  return snapshot
}

export async function enqueueProjection(entry, { client } = {}) {
  await run(client, `INSERT INTO trust_projection_outbox(id,type,user_id,project_id,proof_id,score,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`, [
    entry.id, entry.type, entry.userId, entry.projectId || null, entry.proofId || null,
    JSON.stringify(entry.score || {}), entry.createdAt || nowIso(),
  ])
  return entry
}

export async function listPendingOutbox(limit = 20) {
  const result = await run(null, 'SELECT * FROM trust_projection_outbox WHERE delivered_at IS NULL ORDER BY created_at ASC LIMIT $1', [Math.min(100, Math.max(1, Number(limit) || 20))])
  return result.rows.map(mapOutbox)
}

export async function markOutboxDelivered(id) {
  await run(null, 'UPDATE trust_projection_outbox SET delivered_at=$2 WHERE id=$1', [id, nowIso()])
}

export async function markOutboxFailed(id, error) {
  await run(null, 'UPDATE trust_projection_outbox SET attempts=attempts+1, last_error=$2 WHERE id=$1', [id, String(error || '').slice(0, 500)])
}

export async function insertChallenge(challenge, { client } = {}) {
  await run(client, `INSERT INTO trust_verification_challenges(id,user_id,domain,record_name,method,token_hash,status,last_checked_at,expires_at,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING`, [
    challenge.id, challenge.userId, challenge.domain, challenge.recordName, challenge.method, challenge.tokenHash,
    challenge.status || 'pending', challenge.lastCheckedAt || null, challenge.expiresAt || null,
    challenge.createdAt || nowIso(), challenge.updatedAt || nowIso(),
  ])
  return challenge
}

export async function getChallenge(id, { client } = {}) {
  const result = await run(client, 'SELECT * FROM trust_verification_challenges WHERE id=$1', [id])
  return result.rows[0] ? mapChallenge(result.rows[0]) : null
}

export async function updateChallenge(id, patch = {}, { client } = {}) {
  const columns = []
  const values = [id]
  const push = (column, value) => { values.push(value); columns.push(`${column}=$${values.length}`) }
  if (patch.status !== undefined) push('status', patch.status)
  if (patch.lastCheckedAt !== undefined) push('last_checked_at', patch.lastCheckedAt)
  push('updated_at', patch.updatedAt || nowIso())
  const result = await run(client, `UPDATE trust_verification_challenges SET ${columns.join(', ')} WHERE id=$1 RETURNING *`, values)
  return result.rows[0] ? mapChallenge(result.rows[0]) : null
}

export async function recordManualReview(entry, { client } = {}) {
  await run(client, `INSERT INTO trust_manual_reviews(id,operation_kind,operation_id,admin_id,decision,note,reason_code,created_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`, [
    entry.id, entry.operationKind, entry.operationId, entry.adminId, entry.decision,
    entry.note || null, entry.reasonCode || null, entry.createdAt || nowIso(), entry.expiresAt || null,
  ])
  return entry
}

export async function recordAnomaly(entry, { client } = {}) {
  await run(client, `INSERT INTO trust_anomaly_events(id,user_id,kind,severity,detail,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`, [
    entry.id, entry.userId, entry.kind, entry.severity || 'info', JSON.stringify(entry.detail || {}), entry.createdAt || nowIso(),
  ])
  // WS11: anomaly rate is a first-class metric (kind/severity labeled).
  incTrustMetric('trust_anomaly_events_total', { kind: entry.kind, severity: entry.severity || 'info' })
  return entry
}

// --- WS3: encrypted provider credentials + revenue snapshots ---

const mapCredential = row => ({
  id: row.id,
  userId: row.user_id,
  provider: row.provider,
  source: row.source,
  encryptedPayload: row.encrypted_payload,
  scopes: row.scopes || [],
  status: row.status,
  mode: row.mode || null,
  subject: row.subject || null,
  accountDomain: row.account_domain || null,
  lastSyncedAt: row.last_synced_at,
  lastVerifiedAt: row.last_verified_at,
  lastMetrics: row.last_metrics || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  revokedAt: row.revoked_at,
})

export async function upsertCredential(entry, { client } = {}) {
  const result = await run(client, `INSERT INTO trust_connect_credentials
    (id,user_id,provider,source,encrypted_payload,scopes,status,mode,subject,account_domain,last_synced_at,last_verified_at,last_metrics,created_at,updated_at,revoked_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NULL)
    ON CONFLICT (user_id, provider) WHERE revoked_at IS NULL
    DO UPDATE SET encrypted_payload=EXCLUDED.encrypted_payload, scopes=EXCLUDED.scopes, status='active',
      mode=EXCLUDED.mode, subject=EXCLUDED.subject, account_domain=EXCLUDED.account_domain,
      updated_at=EXCLUDED.updated_at
    RETURNING *`, [
    entry.id, entry.userId, entry.provider, entry.source, entry.encryptedPayload, JSON.stringify(entry.scopes || []),
    entry.status || 'active', entry.mode || null, entry.subject || null, entry.accountDomain || null,
    entry.lastSyncedAt || null, entry.lastVerifiedAt || null, entry.lastMetrics ? JSON.stringify(entry.lastMetrics) : null,
    entry.createdAt || nowIso(), entry.updatedAt || nowIso(),
  ])
  return result.rows[0] ? mapCredential(result.rows[0]) : null
}

export async function getActiveCredential(userId, provider, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_connect_credentials WHERE user_id=$1 AND provider=$2 AND revoked_at IS NULL LIMIT 1`, [userId, provider])
  return result.rows[0] ? mapCredential(result.rows[0]) : null
}

export async function listActiveCredentials(userId, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_connect_credentials WHERE user_id=$1 AND revoked_at IS NULL ORDER BY updated_at DESC LIMIT 50`, [userId])
  return result.rows.map(mapCredential)
}

export async function markCredentialSynced(id, { mode, subject, accountDomain, metrics, verifiedAt } = {}, { client } = {}) {
  const result = await run(client, `UPDATE trust_connect_credentials SET
    mode=COALESCE($2, mode), subject=COALESCE($3, subject), account_domain=COALESCE($4, account_domain),
    last_synced_at=$5, last_verified_at=COALESCE($6, last_verified_at), last_metrics=COALESCE($7, last_metrics), updated_at=$5
    WHERE id=$1 RETURNING *`, [id, mode || null, subject || null, accountDomain || null, nowIso(), verifiedAt || null, metrics ? JSON.stringify(metrics) : null])
  return result.rows[0] ? mapCredential(result.rows[0]) : null
}

export async function listCredentialsDueForSync({ intervalMs = 24 * 3600_000, limit = 100 } = {}, { client } = {}) {
  const cutoff = new Date(Date.now() - Math.max(0, Number(intervalMs) || 0)).toISOString()
  const result = await run(client, `SELECT * FROM trust_connect_credentials
    WHERE revoked_at IS NULL AND status='active' AND (last_synced_at IS NULL OR last_synced_at < $1)
    ORDER BY last_synced_at NULLS FIRST LIMIT $2`, [cutoff, Math.max(1, Math.min(500, Number(limit) || 100))])
  return result.rows.map(mapCredential)
}

export async function revokeCredential(userId, provider, { client } = {}) {
  const result = await run(client, `UPDATE trust_connect_credentials SET status='revoked', revoked_at=$3, updated_at=$3
    WHERE user_id=$1 AND provider=$2 AND revoked_at IS NULL RETURNING *`, [userId, provider, nowIso()])
  return result.rows[0] ? mapCredential(result.rows[0]) : null
}

export async function insertRevenueSnapshot(entry, { client } = {}) {
  await run(client, `INSERT INTO trust_revenue_snapshots
    (id,user_id,provider,credential_id,mrr,arr,paying_customers,churn_rate,net_revenue_retention,gross_margin,currency,livemode,as_of,metrics,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(id) DO NOTHING`, [
    entry.id, entry.userId, entry.provider, entry.credentialId || null, entry.mrr ?? null, entry.arr ?? null,
    entry.payingCustomers ?? null, entry.churnRate ?? null, entry.netRevenueRetention ?? null, entry.grossMargin ?? null,
    entry.currency || null, entry.livemode == null ? null : Boolean(entry.livemode), entry.asOf || null,
    JSON.stringify(entry.metrics || {}), entry.createdAt || nowIso(),
  ])
  return entry
}

export async function latestRevenueSnapshot(userId, provider, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_revenue_snapshots WHERE user_id=$1 AND provider=$2 ORDER BY created_at DESC LIMIT 1`, [userId, provider])
  const row = result.rows[0]
  return row ? {
    id: row.id, userId: row.user_id, provider: row.provider, credentialId: row.credential_id,
    mrr: row.mrr == null ? null : Number(row.mrr), arr: row.arr == null ? null : Number(row.arr),
    payingCustomers: row.paying_customers == null ? null : Number(row.paying_customers),
    churnRate: row.churn_rate == null ? null : Number(row.churn_rate),
    netRevenueRetention: row.net_revenue_retention == null ? null : Number(row.net_revenue_retention),
    grossMargin: row.gross_margin == null ? null : Number(row.gross_margin),
    currency: row.currency, livemode: row.livemode, asOf: row.as_of, metrics: row.metrics || {}, createdAt: row.created_at,
  } : null
}

// --- WS4: product analytics snapshots ---

const mapAnalytics = row => ({
  id: row.id, userId: row.user_id, provider: row.provider, credentialId: row.credential_id,
  mau: row.mau == null ? null : Number(row.mau), dau: row.dau == null ? null : Number(row.dau),
  wau: row.wau == null ? null : Number(row.wau),
  retentionD1: row.retention_d1 == null ? null : Number(row.retention_d1),
  retentionD7: row.retention_d7 == null ? null : Number(row.retention_d7),
  retentionD30: row.retention_d30 == null ? null : Number(row.retention_d30),
  activationRate: row.activation_rate == null ? null : Number(row.activation_rate),
  asOf: row.as_of, freshnessHours: row.freshness_hours == null ? null : Number(row.freshness_hours),
  metrics: row.metrics || {}, createdAt: row.created_at,
})

export async function insertAnalyticsSnapshot(entry, { client } = {}) {
  await run(client, `INSERT INTO trust_product_analytics_snapshots
    (id,user_id,provider,credential_id,mau,dau,wau,retention_d1,retention_d7,retention_d30,activation_rate,as_of,freshness_hours,metrics,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(id) DO NOTHING`, [
    entry.id, entry.userId, entry.provider, entry.credentialId || null, entry.mau ?? null, entry.dau ?? null,
    entry.wau ?? null, entry.retentionD1 ?? null, entry.retentionD7 ?? null, entry.retentionD30 ?? null,
    entry.activationRate ?? null, entry.asOf || null, entry.freshnessHours ?? null,
    JSON.stringify(entry.metrics || {}), entry.createdAt || nowIso(),
  ])
  return entry
}

export async function latestAnalyticsSnapshot(userId, provider, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_product_analytics_snapshots WHERE user_id=$1 AND provider=$2 ORDER BY created_at DESC LIMIT 1`, [userId, provider])
  return result.rows[0] ? mapAnalytics(result.rows[0]) : null
}

// --- WS5: shipping / deployment cadence snapshots ---

const mapShipping = row => ({
  id: row.id, userId: row.user_id, provider: row.provider, credentialId: row.credential_id,
  deploys30d: row.deploys_30d == null ? null : Number(row.deploys_30d),
  deploys90d: row.deploys_90d == null ? null : Number(row.deploys_90d),
  deploySuccessRate30d: row.deploy_success_rate_30d == null ? null : Number(row.deploy_success_rate_30d),
  lastDeployAt: row.last_deploy_at, mergedPrs30d: row.merged_prs_30d == null ? null : Number(row.merged_prs_30d),
  mergedPrs90d: row.merged_prs_90d == null ? null : Number(row.merged_prs_90d),
  releases30d: row.releases_30d == null ? null : Number(row.releases_30d),
  releases90d: row.releases_90d == null ? null : Number(row.releases_90d),
  uptime30d: row.uptime_30d == null ? null : Number(row.uptime_30d),
  leadTimeHours: row.lead_time_hours == null ? null : Number(row.lead_time_hours),
  asOf: row.as_of, freshnessHours: row.freshness_hours == null ? null : Number(row.freshness_hours),
  metrics: row.metrics || {}, createdAt: row.created_at,
})

export async function insertShippingSnapshot(entry, { client } = {}) {
  await run(client, `INSERT INTO trust_shipping_snapshots
    (id,user_id,provider,credential_id,deploys_30d,deploys_90d,deploy_success_rate_30d,last_deploy_at,merged_prs_30d,merged_prs_90d,releases_30d,releases_90d,uptime_30d,lead_time_hours,as_of,freshness_hours,metrics,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(id) DO NOTHING`, [
    entry.id, entry.userId, entry.provider, entry.credentialId || null, entry.deploys30d ?? null, entry.deploys90d ?? null,
    entry.deploySuccessRate30d ?? null, entry.lastDeployAt || null, entry.mergedPrs30d ?? null, entry.mergedPrs90d ?? null,
    entry.releases30d ?? null, entry.releases90d ?? null, entry.uptime30d ?? null, entry.leadTimeHours ?? null,
    entry.asOf || null, entry.freshnessHours ?? null, JSON.stringify(entry.metrics || {}), entry.createdAt || nowIso(),
  ])
  return entry
}

export async function latestShippingSnapshot(userId, provider, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_shipping_snapshots WHERE user_id=$1 AND provider=$2 ORDER BY created_at DESC LIMIT 1`, [userId, provider])
  return result.rows[0] ? mapShipping(result.rows[0]) : null
}

// --- WS6: team / registry / HRIS snapshots ---

const mapTeam = row => ({
  id: row.id, userId: row.user_id, provider: row.provider, kind: row.kind, credentialId: row.credential_id,
  entityName: row.entity_name, companyNumber: row.company_number, jurisdiction: row.jurisdiction,
  headcount: row.headcount == null ? null : Number(row.headcount), roles: Array.isArray(row.roles) ? row.roles : [],
  asOf: row.as_of, freshnessHours: row.freshness_hours == null ? null : Number(row.freshness_hours),
  metrics: row.metrics || {}, createdAt: row.created_at,
})

export async function insertTeamSnapshot(entry, { client } = {}) {
  await run(client, `INSERT INTO trust_team_snapshots
    (id,user_id,provider,kind,credential_id,entity_name,company_number,jurisdiction,headcount,roles,as_of,freshness_hours,metrics,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(id) DO NOTHING`, [
    entry.id, entry.userId, entry.provider, entry.kind, entry.credentialId || null, entry.entityName || null,
    entry.companyNumber || null, entry.jurisdiction || null, entry.headcount ?? null, JSON.stringify(entry.roles || []),
    entry.asOf || null, entry.freshnessHours ?? null, JSON.stringify(entry.metrics || {}), entry.createdAt || nowIso(),
  ])
  return entry
}

export async function latestTeamSnapshot(userId, kind, provider, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_team_snapshots WHERE user_id=$1 AND kind=$2 AND provider=$3 ORDER BY created_at DESC LIMIT 1`, [userId, kind, provider])
  return result.rows[0] ? mapTeam(result.rows[0]) : null
}

// --- WS6: work-email OTP challenges ---

const mapWorkEmailChallenge = row => ({
  id: row.id, userId: row.user_id, email: row.email, emailDomain: row.email_domain, role: row.role,
  tokenHash: row.token_hash, status: row.status, attempts: Number(row.attempts || 0), maxAttempts: Number(row.max_attempts || 5),
  expiresAt: row.expires_at, verifiedAt: row.verified_at, createdAt: row.created_at, updatedAt: row.updated_at,
})

export async function insertWorkEmailChallenge(entry, { client } = {}) {
  const result = await run(client, `INSERT INTO trust_work_email_challenges
    (id,user_id,email,email_domain,role,token_hash,status,attempts,max_attempts,expires_at,verified_at,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [
    entry.id, entry.userId, entry.email, entry.emailDomain, entry.role || null, entry.tokenHash,
    entry.status || 'pending', entry.attempts || 0, entry.maxAttempts || 5, entry.expiresAt,
    entry.verifiedAt || null, entry.createdAt || nowIso(), entry.updatedAt || nowIso(),
  ])
  return result.rows[0] ? mapWorkEmailChallenge(result.rows[0]) : null
}

export async function getWorkEmailChallenge(id, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_work_email_challenges WHERE id=$1 LIMIT 1`, [id])
  return result.rows[0] ? mapWorkEmailChallenge(result.rows[0]) : null
}

export async function latestWorkEmailChallenge(userId, emailDomain, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_work_email_challenges WHERE user_id=$1 AND email_domain=$2 ORDER BY created_at DESC LIMIT 1`, [userId, emailDomain])
  return result.rows[0] ? mapWorkEmailChallenge(result.rows[0]) : null
}

export async function updateWorkEmailChallenge(id, patch = {}, { client } = {}) {
  const columns = []
  const values = [id]
  const push = (column, value) => { values.push(value); columns.push(`${column}=$${values.length}`) }
  if (patch.status !== undefined) push('status', patch.status)
  if (patch.attempts !== undefined) push('attempts', patch.attempts)
  if (patch.verifiedAt !== undefined) push('verified_at', patch.verifiedAt)
  push('updated_at', patch.updatedAt || nowIso())
  const result = await run(client, `UPDATE trust_work_email_challenges SET ${columns.join(', ')} WHERE id=$1 RETURNING *`, values)
  return result.rows[0] ? mapWorkEmailChallenge(result.rows[0]) : null
}

// --- WS7: milestone evidence objects ---

const mapMilestoneEvidence = row => ({
  id: row.id, userId: row.user_id, milestoneProofId: row.milestone_proof_id,
  objectKey: row.object_key, contentType: row.content_type, sizeBytes: Number(row.size_bytes || 0),
  status: row.status, malwareStatus: row.malware_status, sha256: row.sha256, scan: row.scan || null,
  createdAt: row.created_at, updatedAt: row.updated_at,
})

export async function insertMilestoneEvidence(entry, { client } = {}) {
  const result = await run(client, `INSERT INTO trust_milestone_evidence
    (id,user_id,milestone_proof_id,object_key,content_type,size_bytes,status,malware_status,sha256,scan,created_at,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [
    entry.id, entry.userId, entry.milestoneProofId || null, entry.objectKey, entry.contentType, entry.sizeBytes,
    entry.status || 'upload_pending', entry.malwareStatus || 'pending', entry.sha256 || null,
    entry.scan ? JSON.stringify(entry.scan) : null, entry.createdAt || nowIso(), entry.updatedAt || nowIso(),
  ])
  return result.rows[0] ? mapMilestoneEvidence(result.rows[0]) : null
}

export async function getMilestoneEvidence(userId, id, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_milestone_evidence WHERE user_id=$1 AND id=$2 LIMIT 1`, [userId, id])
  return result.rows[0] ? mapMilestoneEvidence(result.rows[0]) : null
}

export async function listMilestoneEvidence(userId, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_milestone_evidence WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [userId])
  return result.rows.map(mapMilestoneEvidence)
}

export async function updateMilestoneEvidence(id, patch = {}, { client } = {}) {
  const columns = []
  const values = [id]
  const push = (column, value) => { values.push(value); columns.push(`${column}=$${values.length}`) }
  if (patch.status !== undefined) push('status', patch.status)
  if (patch.malwareStatus !== undefined) push('malware_status', patch.malwareStatus)
  if (patch.sha256 !== undefined) push('sha256', patch.sha256)
  if (patch.scan !== undefined) push('scan', patch.scan ? JSON.stringify(patch.scan) : null)
  if (patch.milestoneProofId !== undefined) push('milestone_proof_id', patch.milestoneProofId)
  push('updated_at', patch.updatedAt || nowIso())
  const result = await run(client, `UPDATE trust_milestone_evidence SET ${columns.join(', ')} WHERE id=$1 RETURNING *`, values)
  return result.rows[0] ? mapMilestoneEvidence(result.rows[0]) : null
}

// --- WS8: founder identity / KYC verification attempts ---

const mapIdentityVerification = row => ({
  id: row.id, userId: row.user_id, provider: row.provider, kind: row.kind, status: row.status,
  providerReference: row.provider_reference, subject: row.subject, country: row.country,
  resultHash: row.result_hash, checkedAt: row.checked_at, createdAt: row.created_at,
})

export async function insertIdentityVerification(entry, { client } = {}) {
  await run(client, `INSERT INTO trust_identity_verifications
    (id,user_id,provider,kind,status,provider_reference,subject,country,result_hash,checked_at,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING`, [
    entry.id, entry.userId, entry.provider, entry.kind, entry.status, entry.providerReference || null,
    entry.subject || null, entry.country || null, entry.resultHash || null, entry.checkedAt || null, entry.createdAt || nowIso(),
  ])
  return entry
}

export async function listIdentityVerifications(userId, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_identity_verifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [userId])
  return result.rows.map(mapIdentityVerification)
}

// --- WS8: sanctions / PEP screening (append-only) ---

const mapScreeningResult = row => ({
  id: row.id, userId: row.user_id, provider: row.provider, subjectHash: row.subject_hash,
  status: row.status, matchCount: Number(row.match_count || 0), country: row.country,
  resultHash: row.result_hash, screenedAt: row.screened_at, createdAt: row.created_at,
})

export async function insertScreeningResult(entry, { client } = {}) {
  const result = await run(client, `INSERT INTO trust_screening_results
    (id,user_id,provider,subject_hash,status,match_count,country,result_hash,screened_at,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [
    entry.id, entry.userId, entry.provider, entry.subjectHash || null, entry.status,
    Number(entry.matchCount || 0), entry.country || null, entry.resultHash || null,
    entry.screenedAt || nowIso(), entry.createdAt || nowIso(),
  ])
  return result.rows[0] ? mapScreeningResult(result.rows[0]) : null
}

export async function listScreeningResults(userId, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_screening_results WHERE user_id=$1 ORDER BY screened_at DESC LIMIT 50`, [userId])
  return result.rows.map(mapScreeningResult)
}

export async function latestScreeningResult(userId, provider = null, { client } = {}) {
  const result = provider
    ? await run(client, `SELECT * FROM trust_screening_results WHERE user_id=$1 AND provider=$2 ORDER BY screened_at DESC LIMIT 1`, [userId, provider])
    : await run(client, `SELECT * FROM trust_screening_results WHERE user_id=$1 ORDER BY screened_at DESC LIMIT 1`, [userId])
  return result.rows[0] ? mapScreeningResult(result.rows[0]) : null
}

// --- WS9: reverification / decay scan + manual overrides ---

// Bounded, cross-user scan used by the reverification scheduler. Only returns
// proofs that are still "verified" but past their source TTL, so the job can
// flip them to expired and recompute the affected profiles.
export async function listExpiredProofs(now = nowIso(), limit = 200, { client } = {}) {
  const capped = Math.min(1000, Math.max(1, Number(limit) || 200))
  const result = await run(client, `SELECT * FROM trust_verification_proofs
    WHERE status='verified' AND expires_at IS NOT NULL AND expires_at <= $1
    ORDER BY expires_at ASC LIMIT $2`, [now, capped])
  return result.rows.map(mapProof)
}

export async function expireProof(id, { client } = {}) {
  const result = await run(client, `UPDATE trust_verification_proofs
    SET status='expired', updated_at=$2 WHERE id=$1 AND status='verified' RETURNING *`, [id, nowIso()])
  return result.rows[0] ? mapProof(result.rows[0]) : null
}

export async function listExpiredSkills(now = nowIso(), limit = 200, { client } = {}) {
  const capped = Math.min(1000, Math.max(1, Number(limit) || 200))
  const result = await run(client, `SELECT * FROM trust_verified_skills
    WHERE status='verified' AND expires_at IS NOT NULL AND expires_at <= $1
    ORDER BY expires_at ASC LIMIT $2`, [now, capped])
  return result.rows.map(mapSkill)
}

export async function expireSkill(id, { client } = {}) {
  const result = await run(client, `UPDATE trust_verified_skills
    SET status='expired', updated_at=$2 WHERE id=$1 AND status='verified' RETURNING *`, [id, nowIso()])
  return result.rows[0] ? mapSkill(result.rows[0]) : null
}

export async function listActiveOverrides(userId, { now = nowIso(), client } = {}) {
  const result = await run(client, `SELECT * FROM trust_score_overrides
    WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > $2 ORDER BY created_at DESC LIMIT 100`, [userId, now])
  return result.rows.map(mapOverride)
}

export async function listOverrides(userId, { client } = {}) {
  const result = await run(client, `SELECT * FROM trust_score_overrides WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [userId])
  return result.rows.map(mapOverride)
}

export async function insertOverride(entry, { client } = {}) {
  const result = await run(client, `INSERT INTO trust_score_overrides
    (id,user_id,project_id,source,delta,reason_code,note,admin_id,expires_at,revoked_at,revoked_by,created_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,NULL,$10) ON CONFLICT(id) DO NOTHING RETURNING *`, [
    entry.id, entry.userId, entry.projectId || null, entry.source || null, entry.delta,
    entry.reasonCode, entry.note || null, entry.adminId, entry.expiresAt, entry.createdAt || nowIso(),
  ])
  return result.rows[0] ? mapOverride(result.rows[0]) : null
}

export async function revokeOverride(id, adminId, { client } = {}) {
  const result = await run(client, `UPDATE trust_score_overrides
    SET revoked_at=$3, revoked_by=$4 WHERE id=$1 AND revoked_at IS NULL AND user_id=$2 RETURNING *`, [id, adminId, nowIso(), adminId])
  return result.rows[0] ? mapOverride(result.rows[0]) : null
}

// --- WS11 observability gauges (read-only, best-effort) ---

export async function countPendingOutbox() {
  const result = await run(null, 'SELECT COUNT(*)::int AS count FROM trust_projection_outbox WHERE delivered_at IS NULL')
  return Number(result.rows[0]?.count || 0)
}

export async function countExpiredProofs() {
  const result = await run(null, "SELECT COUNT(*)::int AS count FROM trust_verification_proofs WHERE status='expired'")
  return Number(result.rows[0]?.count || 0)
}

export async function anomalyStats({ sinceHours = 24 } = {}) {
  const hours = Math.min(24 * 30, Math.max(1, Number(sinceHours) || 24))
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const result = await run(null, `SELECT severity, COUNT(*)::int AS count FROM trust_anomaly_events WHERE created_at >= $1 GROUP BY severity`, [since])
  const bySeverity = Object.fromEntries(result.rows.map(row => [row.severity, Number(row.count || 0)]))
  return { window_hours: hours, total: Object.values(bySeverity).reduce((sum, value) => sum + value, 0), by_severity: bySeverity }
}

// Never creates a pool: saturation is only meaningful once traffic has opened one.
export function trustPoolStats() {
  if (!pool) return null
  return {
    total: pool.totalCount ?? null,
    idle: pool.idleCount ?? null,
    waiting: pool.waitingCount ?? null,
    max: pool.options?.max ?? Number(process.env.TRUST_DB_POOL_SIZE || 5),
  }
}

export async function closeTrustPool() {
  if (pool) await pool.end()
  pool = null
}
