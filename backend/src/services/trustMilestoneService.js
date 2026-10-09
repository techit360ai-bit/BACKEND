// Outcomes / milestone verification authority (WS7).
//
// Invariants that live here and are NOT env-tunable:
//   1. A milestone proof is backed only by a scanned, hashed evidence object.
//   2. Only a server-observed e-sign envelope (or an admin-confirmed third-party
//      letter/notary) may raise the proof to `third_party_attested`. A founder's
//      own word stays `self` and is capped by the scoring policy.

import { createId, nowIso } from '../utils/api.js'
import * as repo from '../repositories/trustRepository.js'
import { trustCore } from './trustVerificationAuthority.js'
import { appendTrustProof, reviewTrustProof } from './trustAuthority.js'
import { createPrivateUpload, finalizePrivateUpload } from './evidenceStorageService.js'
import { findMilestoneType, platformAttestationCredential, resolveMilestoneAvailability, resolveMilestoneConfig, resolveMilestoneType, resolveAttestationProvider } from '../config/trustMilestoneSources.js'
import { buildMilestoneMetadata, fetchEsignAttestation, normalizeAttestation } from './trustMilestoneAdapter.js'

const { hash, clean } = trustCore

function writeAuthorityRequired() {
  return process.env.TRUST_WRITE_SOURCE === 'postgres'
}

function comingSoon(reason) {
  return { ok: false, status: 409, error: 'trust_source_coming_soon', reason }
}

// --- evidence pipeline: upload -> malware scan -> hash ----------------------

export async function createMilestoneEvidenceUpload(userId, input = {}, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'milestone_requires_postgres_authority' }
  const availability = resolveMilestoneAvailability(env)
  if (!availability.enabled) return comingSoon(availability.availability_reason)
  const objectId = createId('trust_milestone_evidence')
  const upload = createPrivateUpload({ namespace: 'milestone', ownerId: userId, objectId, contentType: input.contentType, sizeBytes: input.sizeBytes })
  if (!upload.ok) return upload
  const now = nowIso()
  const row = await repo.insertMilestoneEvidence({
    id: objectId, userId, objectKey: upload.objectKey, contentType: String(input.contentType || '').toLowerCase(), sizeBytes: Number(input.sizeBytes || 0),
    status: 'upload_pending', malwareStatus: 'pending', createdAt: now, updatedAt: now,
  })
  return { ok: true, evidence: { id: row.id, status: row.status }, uploadUrl: upload.uploadUrl, requiredHeaders: upload.requiredHeaders }
}

export async function finalizeMilestoneEvidence(userId, evidenceId, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'milestone_requires_postgres_authority' }
  const evidence = await repo.getMilestoneEvidence(userId, String(evidenceId || ''))
  if (!evidence) return { ok: false, status: 404, error: 'milestone_evidence_not_found' }
  if (evidence.status !== 'upload_pending') return { ok: false, status: 409, error: 'milestone_evidence_not_pending' }
  const result = await finalizePrivateUpload({ objectKey: evidence.objectKey, contentType: evidence.contentType, expectedSizeBytes: evidence.sizeBytes })
  const updated = await repo.updateMilestoneEvidence(evidence.id, {
    status: result.ok ? 'available' : 'quarantined',
    malwareStatus: result.ok ? 'clean' : 'infected_or_unavailable',
    sha256: result.sha256 || null, scan: result.scan || null, updatedAt: nowIso(),
  })
  if (!result.ok) return { ok: false, status: 422, error: result.error, evidence: { id: updated.id, status: updated.status } }
  return { ok: true, evidence: { id: updated.id, status: updated.status, sha256: updated.sha256 } }
}

// --- milestone submission ---------------------------------------------------

export async function submitMilestone(userId, input = {}, { env = process.env, fetchImpl } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'milestone_requires_postgres_authority' }
  const availability = resolveMilestoneAvailability(env)
  if (!availability.enabled) return comingSoon(availability.availability_reason)
  const type = resolveMilestoneType(input.type || input.milestoneType, env)
  if (!type.enabled) return { ok: false, status: 422, error: type.availability_reason === 'unsupported_milestone_type' ? 'milestone_type_unsupported' : 'milestone_type_not_allowed' }
  const config = resolveMilestoneConfig(env)

  // Evidence: required by default; must be scanned + hashed before review.
  let evidence = null
  if (input.evidenceId) {
    evidence = await repo.getMilestoneEvidence(userId, String(input.evidenceId))
    if (!evidence) return { ok: false, status: 422, error: 'milestone_evidence_not_found' }
    if (evidence.status !== 'available') return { ok: false, status: 422, error: 'milestone_evidence_not_ready' }
  } else if (config.requireEvidence) {
    return { ok: false, status: 422, error: 'milestone_evidence_required' }
  }

  // Attestation: e-sign is read server-side; letter/notary waits for admin review.
  const attestation = normalizeAttestation(input.attestation || {})
  let attestationLevel = 'self'
  if (attestation.provider) {
    const entry = resolveAttestationProvider(attestation.provider, env)
    if (!entry.enabled) return comingSoon(entry.availability_reason)
    if (entry.kind === 'esign') {
      const credential = platformAttestationCredential(attestation.provider, env)
      if (!credential) return { ok: false, status: 409, error: 'milestone_attestation_not_configured' }
      const fetched = await fetchEsignAttestation(attestation.provider, credential, { env, fetchImpl, attestation })
      if (!fetched.ok) return fetched
      if (!fetched.completed) return { ok: false, status: 422, error: 'milestone_attestation_incomplete', detail: { status: fetched.status } }
      attestationLevel = 'third_party_attested'
    }
  }

  const crossLinks = { contractId: clean(input.contractId || input.contract_id, 120) || null, revenueVerificationId: clean(input.revenueVerificationId || input.revenue_verification_id, 120) || null }
  const now = nowIso()
  const metadata = buildMilestoneMetadata({ type: type.type, evidenceObjectId: evidence?.id, evidenceHash: evidence?.sha256, attestation, crossLinks, now })
  const verified = attestationLevel === 'third_party_attested'
  const proof = await appendTrustProof(userId, {
    source: 'milestone',
    status: verified ? 'verified' : 'pending',
    method: verified ? `${attestation.provider}_attested_milestone` : `milestone_${type.type}`,
    attestationLevel,
    confidence: verified ? 0.95 : 0.6,
    metadata,
    evidenceHash: hash({ userId, milestone: type.type, evidence: evidence?.sha256 || null, envelope: attestation.envelopeId || null }),
    expiresAt: new Date(Date.now() + config.proofTtlDays * 86400000).toISOString(),
    correlationGroup: 'financials',
  })
  if (!proof.ok) return proof
  if (evidence) await repo.updateMilestoneEvidence(evidence.id, { milestoneProofId: proof.proof.id, updatedAt: nowIso() })
  return {
    ok: true,
    status: verified ? 'verified' : 'pending',
    milestone: { id: proof.proof.id, type: type.type, attestation_level: attestationLevel, evidence_id: evidence?.id || null, cross_links: crossLinks },
    profile: proof.profile,
    verification: proof.proof,
  }
}

// --- admin review queue -----------------------------------------------------

export async function reviewMilestoneProof(adminId, proofId, body = {}, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'milestone_requires_postgres_authority' }
  const decision = clean(body.decision || body.status, 40).toLowerCase()
  if (!['verified', 'rejected', 'expired'].includes(decision)) return { ok: false, status: 400, error: 'invalid_proof_review_status' }
  const reasonCode = clean(body.reasonCode || body.reason_code, 60) || null
  if (decision === 'rejected' && !reasonCode) return { ok: false, status: 400, error: 'milestone_rejection_reason_required' }

  const proof = await repo.getProof(String(proofId || ''))
  if (!proof || proof.source !== 'milestone') return { ok: false, status: 404, error: 'milestone_proof_not_found' }
  const config = resolveMilestoneConfig(env)
  const type = findMilestoneType(proof.metadata?.milestoneType)
  const requestedAttestation = clean(body.attestationLevel || body.attestation_level, 40) || null
  const attested = proof.attestationLevel === 'third_party_attested' || requestedAttestation === 'third_party_attested'

  if (decision === 'verified') {
    if ((type?.requires_attestation || config.requireAttestation) && !attested) return { ok: false, status: 422, error: 'milestone_attestation_required' }
    // Admin-confirmed letter/notary can upgrade a self milestone to third-party.
    if (requestedAttestation === 'third_party_attested' && proof.attestationLevel !== 'third_party_attested') {
      await repo.updateProofStatus(proof.id, { attestationLevel: 'third_party_attested' })
    }
  }
  const result = await reviewTrustProof(adminId, proof.id, { decision, reasonCode, note: body.note })
  return result
}

export async function listMilestones(userId) {
  if (!writeAuthorityRequired()) return { ok: true, milestones: [] }
  const proofs = await repo.listProofs(userId)
  const milestones = proofs
    .filter(proof => proof.source === 'milestone')
    .map(proof => ({
      id: proof.id, type: proof.metadata?.milestoneType || null, status: proof.status,
      attestation_level: proof.attestationLevel || 'self', evidence_object_id: proof.metadata?.evidenceObjectId || null,
      review_note: proof.reviewNote || null, created_at: proof.createdAt, verified_at: proof.verifiedAt, expires_at: proof.expiresAt,
    }))
  return { ok: true, milestones }
}
