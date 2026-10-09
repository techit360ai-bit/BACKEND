// Trust authority dispatcher.
//
// Routes trust reads/writes to either the legacy whole-snapshot authority or
// the row-level repository, based on explicit per-domain flags. Defaults keep
// legacy behavior, so this is safe to ship before the Postgres cutover.
//
//   TRUST_READ_SOURCE=postgres   -> reads via trustRepository
//   TRUST_WRITE_SOURCE=postgres  -> writes via trustRepository
//
// Note: this dispatcher is the surface for the trust HTTP controller. A few
// non-controller callers (intelligence/recommendation services) still call the
// legacy module directly and migrate with their own domain cutover.

import * as legacy from './trustVerificationAuthority.js'
import * as asyncAuthority from './trustAuthorityAsync.js'
import { trustReadEnabled, trustWriteEnabled } from '../repositories/trustRepository.js'

export function publicTrustFor(userId, projectId = null) {
  return trustReadEnabled() ? asyncAuthority.getPublicTrust(userId, projectId) : legacy.publicTrustFor(userId, projectId)
}

export function trustHistoryFor(userId, limit = 50) {
  return trustReadEnabled() ? asyncAuthority.getTrustHistory(userId, limit) : legacy.trustHistoryFor(userId, limit)
}

export function trustOperations(options) {
  return trustReadEnabled() ? asyncAuthority.getOperations(options) : legacy.trustOperations()
}

export function appendTrustProof(userId, input = {}) {
  return trustWriteEnabled() ? asyncAuthority.appendProof(userId, input) : legacy.appendTrustProof(userId, input)
}

export function addVerifiedSkill(userId, input = {}) {
  return trustWriteEnabled() ? asyncAuthority.addSkill(userId, input) : legacy.addVerifiedSkill(userId, input)
}

export function disconnectTrustSource(userId, source) {
  return trustWriteEnabled() ? asyncAuthority.disconnectSource(userId, source) : legacy.disconnectTrustSource(userId, source)
}

export function reviewTrustProof(adminId, proofId, body = {}) {
  return trustWriteEnabled() ? asyncAuthority.reviewProof(adminId, proofId, body) : legacy.reviewTrustProof(adminId, proofId, body)
}

export function createDomainProofChallenge(userId, input = {}) {
  return trustWriteEnabled() ? asyncAuthority.createDomainChallenge(userId, input) : legacy.createDomainProofChallenge(userId, input)
}

export function verifyDomainProofChallenge(userId, challengeId) {
  return trustWriteEnabled() ? asyncAuthority.verifyDomainChallenge(userId, challengeId) : legacy.verifyDomainProofChallenge(userId, challengeId)
}

// Not yet ported to the row-level path; still snapshot-backed. Safe because it
// only mints an OAuth state row, but it is tracked as remaining WS0 work.
export function beginProviderVerification(userId, source) {
  return legacy.beginProviderVerification(userId, source)
}
