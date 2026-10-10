import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn(), writeDb: vi.fn() }))
import { readDb, updateDb } from '../config/database.js'
import { addVerifiedSkill, appendTrustProof, createDomainProofChallenge, publicTrustFor, reviewTrustProof } from '../services/trustVerificationAuthority.js'

let db
beforeEach(() => {
  db = { users: [{ id: 'u1' }], profiles: [{ id: 'u1', role: 'founder' }], trustProfiles: [], trustVerificationProofs: [], trustVerificationHistory: [], trustVerificationChallenges: [], verifiedSkills: [], trustScoreSnapshots: [], trustProjectionOutbox: [] }
  readDb.mockReturnValue(db)
  updateDb.mockImplementation(mutator => mutator(db))
})

describe('proof-bound trust authority', () => {
  it('does not award trust for pending client evidence', () => {
    const result = appendTrustProof('u1', { source: 'linkedin', status: 'pending', metadata: { providerSubjectId: 'spoof' } })
    expect(result.ok).toBe(true)
    expect(result.profile.trust_score).toBe(0)
  })

  it('awards score and verified skills only from a backend proof', () => {
    const proof = appendTrustProof('u1', { source: 'github', status: 'verified', method: 'github_oauth', providerSubjectId: 'gh-1', metadata: { repoCount: 4, commitCount: 100 } })
    expect(proof.profile.trust_score).toBeGreaterThan(0)
    const skill = addVerifiedSkill('u1', { skill: 'TypeScript', proofId: proof.proof.id, source: 'github' })
    expect(skill.ok).toBe(true)
    expect(publicTrustFor('u1').verifiedSkills[0].skill).toBe('typescript')
    expect(publicTrustFor('u1').breakdown.verified_skills).toBeGreaterThan(0)
  })

  it('creates a challenge without persisting the plaintext token in the challenge record', () => {
    const challenge = createDomainProofChallenge('u1', { domain: 'example.com' })
    expect(challenge.ok).toBe(true)
    expect(challenge.token).toBeTruthy()
    expect(db.trustVerificationChallenges[0].token).toBeUndefined()
    expect(db.trustVerificationChallenges[0].tokenHash).not.toBe(challenge.token)
    expect(challenge.challenge.tokenHash).toBeUndefined()
  })

  it('scales provider-observed analytics but never self-reported numbers', () => {
    const observed = appendTrustProof('u1', { source: 'product_analytics', status: 'verified', method: 'posthog_readonly', metadata: { provider: 'posthog', mau: 1000, dau: 400 } })
    expect(observed.proof.attestationLevel).toBe('provider_observed')
    expect(observed.proof.metadata.mau).toBe(1000)

    db.profiles.push({ id: 'u2', role: 'founder' })
    const selfReported = appendTrustProof('u2', { source: 'product_analytics', status: 'verified', method: 'manual_upload', metadata: { mau: 100000, dau: 90000 } })
    expect(selfReported.proof.attestationLevel).toBe('self')
    // Claimed engagement metrics are dropped, and the score is a fixed reduced weight.
    expect(selfReported.proof.metadata.mau).toBeUndefined()
    expect(selfReported.profile.trust_score).toBeLessThan(observed.profile.trust_score)
  })

  it('awards the deployment_activity bonus only for provider-observed cadence', () => {
    const observed = appendTrustProof('u1', { source: 'deployment', status: 'verified', method: 'vercel_readonly', attestationLevel: 'provider_observed', metadata: { provider: 'vercel', deploys30d: 6, deployments30d: 6 } })
    expect(observed.proof.metadata.deployments30d).toBe(6)
    expect(observed.profile.breakdown.deployment_activity).toBeGreaterThan(0)

    db.profiles.push({ id: 'u2', role: 'founder' })
    const selfReported = appendTrustProof('u2', { source: 'deployment', status: 'verified', method: 'manual_upload', metadata: { deployments30d: 100 } })
    // Claimed counts are stripped, no continuity bonus is awarded.
    expect(selfReported.proof.metadata.deployments30d).toBeUndefined()
    expect(selfReported.profile.breakdown.deployment_activity).toBeUndefined()
    expect(selfReported.profile.trust_score).toBeLessThan(observed.profile.trust_score)
  })

  it('scales team headcount only for provider-observed proofs', () => {
    const observed = appendTrustProof('u1', { source: 'team', status: 'verified', method: 'gusto_hris', attestationLevel: 'provider_observed', metadata: { provider: 'gusto', headcount: 40, verifiedCount: 40 } })
    expect(observed.proof.metadata.verifiedCount).toBe(40)
    expect(observed.profile.breakdown.team).toBe(10)

    db.profiles.push({ id: 'u2', role: 'founder' })
    const selfReported = appendTrustProof('u2', { source: 'team', status: 'verified', method: 'manual_upload', metadata: { verifiedCount: 100, headcount: 100 } })
    expect(selfReported.proof.attestationLevel).toBe('self')
    // Claimed headcount is stripped and never scales: only the reduced self-attested weight applies.
    expect(selfReported.proof.metadata.verifiedCount).toBeUndefined()
    expect(selfReported.profile.breakdown.team).toBeCloseTo(3.5, 4)
    expect(selfReported.profile.trust_score).toBeLessThan(observed.profile.trust_score)
  })

  it('awards milestone full weight only for third-party attestation', () => {
    const attested = appendTrustProof('u1', { source: 'milestone', status: 'verified', method: 'docusign_attested_milestone', attestationLevel: 'third_party_attested', metadata: { milestoneType: 'funding' } })
    expect(attested.proof.attestationLevel).toBe('third_party_attested')
    expect(attested.profile.breakdown.milestone).toBe(5)

    db.profiles.push({ id: 'u2', role: 'founder' })
    const self = appendTrustProof('u2', { source: 'milestone', status: 'verified', method: 'milestone_funding', metadata: { milestoneType: 'funding' } })
    expect(self.proof.attestationLevel).toBe('self')
    // Founder's own word is capped at the reduced self-attested weight.
    expect(self.profile.breakdown.milestone).toBeCloseTo(1.75, 4)
    expect(self.profile.trust_score).toBeLessThan(attested.profile.trust_score)
  })

  it('awards identity full weight only for provider-observed KYC', () => {
    const observed = appendTrustProof('u1', { source: 'identity', status: 'verified', method: 'kyc_persona', attestationLevel: 'provider_observed', metadata: { identityKind: 'kyc', kycProvider: 'persona', kycStatus: 'verified', country: 'HU' } })
    expect(observed.profile.breakdown.identity).toBe(18)

    db.profiles.push({ id: 'u2', role: 'founder' })
    const self = appendTrustProof('u2', { source: 'identity', status: 'verified', method: 'manual_review', metadata: { identityKind: 'kyc' } })
    expect(self.proof.attestationLevel).toBe('self')
    expect(self.profile.breakdown.identity).toBeCloseTo(6.3, 4)
    expect(self.profile.trust_score).toBeLessThan(observed.profile.trust_score)
  })

  it('recomputes trust and invalidates proof-backed skills after admin rejection', () => {
    const proof = appendTrustProof('u1', { source: 'github', status: 'verified', method: 'github_oauth', metadata: { repoCount: 2 } })
    addVerifiedSkill('u1', { skill: 'TypeScript', proofId: proof.proof.id, source: 'github' })
    expect(publicTrustFor('u1').verifiedSkills).toHaveLength(1)
    const reviewed = reviewTrustProof('admin-1', proof.proof.id, { decision: 'rejected', note: 'proof failed review' })
    expect(reviewed.ok).toBe(true)
    expect(reviewed.score.trustScore).toBe(0)
    expect(publicTrustFor('u1').verifiedSkills).toHaveLength(0)
  })
})
