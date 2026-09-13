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
