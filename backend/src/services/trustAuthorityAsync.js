// Async, row-level trust authority (WS0).
//
// Mirrors the semantics of trustVerificationAuthority.js but reads/writes only
// the current user's rows through trustRepository, so trust requests no longer
// load the whole platform database. Scoring and metadata rules are imported
// from the legacy module via `trustCore` so the two paths cannot drift.
//
// Activation is flag-gated: controllers dispatch here only when
// TRUST_READ_SOURCE/TRUST_WRITE_SOURCE=postgres. Defaults keep legacy behavior.

import dns from 'node:dns/promises'
import { createId, nowIso } from '../utils/api.js'
import { safeFetch } from './outboundHttpService.js'
import { trustCore, trustScoreFor } from './trustVerificationAuthority.js'
import { resolveActivePolicy, computeTrustV3 } from './trustPolicy.js'
import { evaluateAntiGaming } from './trustAntiGaming.js'
import * as repo from '../repositories/trustRepository.js'

const { sourceWeights, supportedSources, clean, hash, token, publicMetadata, normalizeDomain, attestationFromMethod } = trustCore

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function computeScore(scope, userId, projectId) {
  const policy = resolveActivePolicy()
  if (policy.active === 'trust-v3') {
    return computeTrustV3({ proofs: scope.trustVerificationProofs, skills: scope.verifiedSkills, policy: policy.policy })
  }
  return { ...trustScoreFor(scope, userId, projectId), policyVersion: 'trust-v2' }
}

function computeProfile(scope, userId, projectId) {
  const score = computeScore(scope, userId, projectId)
  const proofs = scope.trustVerificationProofs.filter(proof => proof.userId === userId)
  const lastSyncAt = proofs.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]?.updatedAt || null
  return { ...score, lastSyncAt }
}

function toPublicProfile(computed, userId, projectId) {
  return {
    userId,
    projectId,
    trust_score: computed.trustScore,
    tier: computed.tier,
    verification_status: computed.verificationStatus,
    confidence_score: Math.round(computed.trustScore) / 100,
    breakdown: computed.breakdown,
    signals: computed.signals,
    verified_skill_count: computed.verifiedSkillCount,
    proof_count: computed.proofCount,
    last_sync_at: computed.lastSyncAt,
    policy_version: computed.policyVersion || 'trust-v2',
    privacy: { metadata_only: true, raw_payload_stored: false, secrets_stored: false },
  }
}

function toProfileRow(computed, userId, projectId, { id, createdAt, policyVersion }) {
  return {
    id,
    userId,
    projectId,
    trustScore: computed.trustScore,
    assurance: computed.tier,
    verificationStatus: computed.verificationStatus,
    confidenceScore: Math.round(computed.trustScore) / 100,
    breakdown: computed.breakdown,
    signals: computed.signals,
    proofCount: computed.proofCount,
    verifiedSkillCount: computed.verifiedSkillCount,
    lastSyncAt: computed.lastSyncAt,
    policyVersion: policyVersion || computed.policyVersion || 'trust-v2',
    createdAt,
    updatedAt: createdAt,
  }
}

function activeSkills(scope, userId, projectId) {
  const activeIds = new Set(trustCore.activeProofs(scope, userId, projectId).map(proof => proof.id))
  const now = Date.now()
  return scope.verifiedSkills
    .filter(skill => skill.userId === userId && skill.status === 'verified'
      && (!projectId || skill.projectId == null || skill.projectId === projectId)
      && (!skill.expiresAt || new Date(skill.expiresAt).getTime() > now)
      && (skill.source === 'admin_review' || (skill.proofId && activeIds.has(skill.proofId))))
    .map(skill => ({ skill: skill.skill, source: skill.source, confidence: skill.confidence, verifiedAt: skill.updatedAt, expiresAt: skill.expiresAt }))
}

function buildProof(userId, input, policy) {
  const source = clean(input.source, 60).toLowerCase()
  if (!supportedSources.has(source)) return { ok: false, error: 'unsupported_trust_source' }
  const status = input.status === 'verified' ? 'verified' : input.status === 'failed' ? 'failed' : 'pending'
  const now = nowIso()
  // Attestation is derived, never trusted from caller input for non-verified
  // statuses, so founder submissions cannot declare themselves provider-observed
  // (which would unlock metric metadata + scaled scoring).
  const resolvedAttestation = status === 'verified' ? (input.attestationLevel || attestationFromMethod(input.method, status)) : 'self'
  const includeMetrics = status === 'verified' && (resolvedAttestation === 'provider_observed' || resolvedAttestation === 'third_party_attested')
  const metadata = publicMetadata(source, input.metadata, { includeMetrics })
  const defaultTtlDays = source === 'github' ? 1 : source === 'linkedin' ? 30 : 90
  return {
    ok: true,
    proof: {
      id: createId('trust_proof'),
      userId,
      projectId: clean(input.projectId, 120) || null,
      source,
      method: clean(input.method || 'backend_adapter', 80),
      providerSubjectId: clean(input.providerSubjectId, 200) || null,
      status,
      confidence: clamp(Number(input.confidence ?? (status === 'verified' ? 0.95 : 0.5)), 0, 1),
      points: Number(sourceWeights[source] || 0),
      metadata,
      evidenceHash: clean(input.evidenceHash, 128) || hash({ source, userId, metadata }),
      expiresAt: input.expiresAt || new Date(Date.now() + defaultTtlDays * 86400000).toISOString(),
      verifiedAt: status === 'verified' ? now : null,
      attestationLevel: resolvedAttestation,
      correlationGroup: input.correlationGroup || policy.policy?.correlationGroups?.[source] || null,
      metricWindow: input.metricWindow || policy.policy?.metricWindows?.[source] || null,
      policyVersion: policy.active,
      createdAt: now,
      updatedAt: now,
    },
  }
}

async function writeProfileAndProjection(client, userId, projectId, now, policy) {
  const scope = await repo.loadTrustScope(userId, { client })
  const computed = computeProfile(scope, userId, projectId)
  const profileRow = toProfileRow(computed, userId, projectId, { id: createId('trust'), createdAt: now, policyVersion: policy.active })
  await repo.upsertProfile(profileRow, { client })
  await repo.insertSnapshot({
    id: createId('trust_snapshot'),
    userId,
    projectId,
    score: computed.trustScore,
    tier: computed.tier,
    breakdown: computed.breakdown,
    policyVersion: policy.active,
    createdAt: now,
  }, { client })
  await repo.enqueueProjection({
    id: createId('trust_projection'),
    type: 'trust.updated',
    userId,
    projectId,
    proofId: null,
    score: { trustScore: computed.trustScore, tier: computed.tier, breakdown: computed.breakdown, signals: computed.signals },
    createdAt: now,
  }, { client })
  return computed
}

export async function getPublicTrust(userId, projectId = null) {
  const scope = await repo.loadTrustScope(userId)
  return { ...toPublicProfile(computeProfile(scope, userId, projectId), userId, projectId), verifiedSkills: activeSkills(scope, userId, projectId) }
}

export async function getTrustHistory(userId, limit = 50) {
  const history = await repo.listHistory(userId, limit)
  return history.slice(0, Math.min(100, Math.max(1, Number(limit) || 50)))
}

export async function appendProof(userId, input = {}) {
  const policy = resolveActivePolicy()
  const built = buildProof(userId, input, policy)
  if (!built.ok) return built
  const proof = built.proof
  const now = nowIso()
  const outcome = await repo.withTrustTransaction(async client => {
    const scope = await repo.loadTrustScope(userId, { client })
    const decision = await evaluateAntiGaming({
      scope,
      proof,
      env: process.env,
      lookups: {
        byEvidenceHash: hash => repo.findProofsByEvidenceHash(hash, { client }),
        byProviderSubject: (source, subject) => repo.findProofsByProviderSubject(source, subject, { client }),
      },
    })
    for (const anomaly of decision.anomalies) {
      await repo.recordAnomaly({ id: createId('trust_anomaly'), userId, kind: anomaly.kind, severity: anomaly.severity, detail: anomaly.detail || {}, createdAt: now }, { client })
    }
    // Suspicious verified claims are downgraded to pending, never persisted as
    // verified. Verified status is only ever minted from clean, server-observed
    // evidence.
    if (decision.blocking) {
      proof.status = 'pending'
      proof.verifiedAt = null
      proof.reviewNote = `blocked:${decision.reasons.join(',')}`
      proof.updatedAt = now
    }
    await repo.insertProof(proof, { client })
    await repo.insertHistory({
      id: createId('trust_event'),
      verificationId: proof.id,
      userId,
      projectId: proof.projectId,
      source: proof.source,
      status: proof.status,
      confidence: proof.confidence,
      metadataHash: proof.evidenceHash,
      eventType: `trust_${proof.status}`,
      createdAt: now,
      expiresAt: proof.expiresAt,
    }, { client })
    const computed = await writeProfileAndProjection(client, userId, proof.projectId, now, policy)
    return { computed, decision }
  })
  return {
    ok: true,
    proof,
    profile: toPublicProfile(outcome.computed, userId, proof.projectId),
    anti_gaming: { severity: outcome.decision.severity, reasons: outcome.decision.reasons },
  }
}

export async function addSkill(userId, input = {}) {
  const skill = clean(input.skill, 100).toLowerCase()
  if (!skill) return { ok: false, error: 'skill_required' }
  const policy = resolveActivePolicy()
  const now = nowIso()
  return repo.withTrustTransaction(async client => {
    const proof = input.proofId ? await repo.getProof(input.proofId, { client }) : null
    const hasVerifiedProof = proof && proof.userId === userId && proof.status === 'verified'
    if (!hasVerifiedProof && input.source !== 'admin_review') return { ok: false, error: 'verified_proof_required' }
    const saved = await repo.upsertSkill({
      id: createId('verified_skill'),
      userId,
      projectId: clean(input.projectId, 120) || null,
      skill,
      source: clean(input.source || proof?.source || 'admin_review', 80),
      proofId: proof?.id || input.proofId || null,
      confidence: clamp(Number(input.confidence ?? proof?.confidence ?? 0.75), 0, 1),
      evidenceHash: clean(input.evidenceHash || proof?.evidenceHash, 128) || hash({ userId, skill }),
      status: 'verified',
      expiresAt: input.expiresAt || proof?.expiresAt || new Date(Date.now() + 180 * 86400000).toISOString(),
      policyVersion: policy.active,
      createdAt: now,
      updatedAt: now,
    }, { client })
    const computed = await writeProfileAndProjection(client, userId, saved.projectId, now, policy)
    return { ok: true, skill: saved, profile: toPublicProfile(computed, userId, saved.projectId) }
  })
}

export async function disconnectSource(userId, source) {
  const normalized = clean(source, 60).toLowerCase()
  const policy = resolveActivePolicy()
  const now = nowIso()
  const computed = await repo.withTrustTransaction(async client => {
    const revoked = await repo.revokeVerifiedProofs(userId, normalized, { client })
    for (const proof of revoked) {
      await repo.insertHistory({
        id: createId('trust_event'),
        verificationId: proof.id,
        userId,
        projectId: proof.projectId,
        source: proof.source,
        status: 'revoked',
        confidence: proof.confidence,
        metadataHash: proof.evidenceHash,
        eventType: 'trust_revoked',
        createdAt: now,
        expiresAt: proof.expiresAt,
      }, { client })
    }
    return writeProfileAndProjection(client, userId, null, now, policy)
  })
  return { ok: true, source: normalized, status: 'disconnected', confidence: 0, persisted: true, profile: toPublicProfile(computed, userId, null), score: computed }
}

export async function reviewProof(adminId, proofId, body = {}) {
  const decision = clean(body.decision || body.status, 40).toLowerCase()
  if (!['verified', 'rejected', 'expired'].includes(decision)) return { ok: false, status: 400, error: 'invalid_proof_review_status' }
  const existing = await repo.getProof(proofId)
  if (!existing) return { ok: false, status: 404, error: 'trust_proof_not_found' }
  const policy = resolveActivePolicy()
  const now = nowIso()
  const reviewed = await repo.withTrustTransaction(async client => {
    const row = await repo.updateProofStatus(proofId, {
      status: decision,
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNote: clean(body.note, 1000),
      verifiedAt: decision === 'verified' ? (existing.verifiedAt || now) : null,
      updatedAt: now,
    }, { client, expectedStatus: existing.status })
    if (!row) return null
    await repo.insertHistory({
      id: createId('trust_event'),
      verificationId: row.id,
      userId: row.userId,
      projectId: row.projectId,
      source: row.source,
      status: decision,
      confidence: row.confidence,
      metadataHash: row.evidenceHash,
      eventType: `trust_${decision}`,
      createdAt: now,
      expiresAt: row.expiresAt,
    }, { client })
    await repo.recordManualReview({
      id: createId('manual_review'),
      operationKind: 'trust_proof',
      operationId: proofId,
      adminId,
      decision,
      note: clean(body.note, 1000),
      reasonCode: clean(body.reasonCode || body.reason_code, 60) || null,
      createdAt: now,
      expiresAt: body.expiresAt || null,
    }, { client })
    const computed = await writeProfileAndProjection(client, row.userId, row.projectId, now, policy)
    return { row, computed }
  })
  if (!reviewed) return { ok: false, status: 409, error: 'trust_proof_status_conflict' }
  return {
    ok: true,
    proof: { ...reviewed.row, metadata: publicMetadata(reviewed.row.source, reviewed.row.metadata) },
    score: { trustScore: reviewed.computed.trustScore, tier: reviewed.computed.tier, breakdown: reviewed.computed.breakdown, signals: reviewed.computed.signals },
    previousStatus: existing.status,
  }
}

export async function createDomainChallenge(userId, input = {}) {
  const domain = normalizeDomain(input.domain || input.website)
  if (!domain) return { ok: false, error: 'domain_invalid' }
  const plaintextToken = token()
  const now = nowIso()
  const challenge = {
    id: createId('trust_domain'),
    userId,
    domain,
    recordName: `_techit-verification.${domain}`,
    tokenHash: hash(plaintextToken),
    method: input.method === 'https' ? 'https' : 'dns_txt',
    status: 'pending',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: now,
    updatedAt: now,
  }
  await repo.insertChallenge(challenge)
  const publicChallenge = { ...challenge, tokenHash: undefined }
  return {
    ok: true,
    challenge: publicChallenge,
    token: plaintextToken,
    instructions: challenge.method === 'https'
      ? `Publish the token at https://${domain}/.well-known/techit-verification.txt.`
      : `Publish the token as a TXT value at ${challenge.recordName}.`,
  }
}

export async function verifyDomainChallenge(userId, challengeId) {
  const challenge = await repo.getChallenge(challengeId)
  if (!challenge || challenge.userId !== userId) return { ok: false, error: 'challenge_not_found' }
  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    await repo.updateChallenge(challengeId, { status: 'expired' })
    return { ok: false, error: 'challenge_expired' }
  }
  let verified = false
  if (challenge.method === 'dns_txt') {
    try {
      const values = (await dns.resolveTxt(challenge.recordName)).flat().map(value => String(value).trim())
      verified = values.some(value => hash(value) === challenge.tokenHash)
    } catch { /* unresolved */ }
  }
  if (challenge.method === 'https') {
    try {
      const response = await safeFetch(`https://${challenge.domain}/.well-known/techit-verification.txt`, { signal: AbortSignal.timeout(10000) }, { schemes: ['https'], allowHosts: [challenge.domain] })
      if (response.ok) {
        const body = (await response.text()).slice(0, 4096)
        verified = body.split(/\s+/).some(value => hash(value.trim()) === challenge.tokenHash) || body.includes(challenge.tokenHash)
      }
    } catch { /* unreachable or blocked */ }
  }
  if (!verified) {
    const row = await repo.updateChallenge(challengeId, { lastCheckedAt: nowIso(), status: 'pending' })
    return { ok: true, verified: false, challenge: { ...row, tokenHash: undefined } }
  }
  const proof = await appendProof(userId, {
    source: challenge.method === 'dns_txt' ? 'domain' : 'website',
    method: challenge.method,
    status: 'verified',
    confidence: 0.98,
    metadata: { domain: challenge.domain, method: challenge.method },
    evidenceHash: challenge.tokenHash,
  })
  const row = await repo.updateChallenge(challengeId, { status: 'verified' })
  return { ok: true, verified: true, proof: proof.proof, challenge: { ...row, tokenHash: undefined } }
}

export async function getOperations({ limit = 100 } = {}) {
  const [proofs, challenges] = await Promise.all([repo.listRecentProofs(limit), repo.listRecentChallenges(limit)])
  return {
    proofs: proofs.map(proof => ({ ...proof, metadata: publicMetadata(proof.source, proof.metadata) })),
    skills: [],
    challenges: challenges.map(challenge => ({ ...challenge, tokenHash: undefined })),
    history: [],
  }
}

// Exposed for tests/parity checks.
export const __internals = { buildProof, computeProfile, toPublicProfile, attestationFromMethod, activeSkills }
