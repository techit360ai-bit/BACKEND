import { beforeEach, describe, expect, it } from 'vitest'
import { expireStaleInDb } from '../services/trustReverificationService.js'
import { trustScoreFor } from '../services/trustVerificationAuthority.js'

const past = () => new Date(Date.now() - 60_000).toISOString()
const future = () => new Date(Date.now() + 3600_000).toISOString()
const soon = () => new Date(Date.now() + 2000).toISOString()
const afterSoon = () => new Date(Date.now() + 5000)

function seedDb() {
  return {
    users: [{ id: 'u1' }],
    profiles: [{ id: 'u1' }],
    projects: [{ id: 'proj1', ownerId: 'u1' }],
    investorTrustAccessRequests: [],
    trustVerificationProofs: [],
    trustVerificationHistory: [],
    verifiedSkills: [],
    trustProfiles: [],
    trustScoreSnapshots: [],
    trustProjectionOutbox: [],
    trustScoreOverrides: [],
    notifications: [],
  }
}

function githubProof(overrides = {}) {
  return {
    id: 'p1', userId: 'u1', projectId: null, source: 'github', method: 'github_oauth',
    status: 'verified', confidence: 0.98, points: 15, metadata: { repoCount: 4, commitCount: 100 },
    evidenceHash: 'h1', attestationLevel: 'provider_observed',
    expiresAt: soon(), verifiedAt: past(), createdAt: past(), updatedAt: past(), ...overrides,
  }
}

describe('trust reverification tick (WS9)', () => {
  let db
  beforeEach(() => { db = seedDb() })

  it('expires a stale verified proof, drops the score, and enqueues a projection', () => {
    db.trustVerificationProofs.push(githubProof())
    expect(trustScoreFor(db, 'u1').trustScore).toBeGreaterThan(0)

    const result = expireStaleInDb(db, { now: afterSoon() })

    expect(result.expired_proofs.map(row => row.id)).toEqual(['p1'])
    expect(db.trustVerificationProofs[0].status).toBe('expired')
    expect(db.trustVerificationHistory.some(row => row.eventType === 'trust_expired')).toBe(true)
    expect(trustScoreFor(db, 'u1').trustScore).toBe(0)
    expect(db.trustProjectionOutbox).toHaveLength(1)
    expect(db.trustProjectionOutbox[0].type).toBe('trust.decayed')
    expect(db.notifications.filter(row => row.type === 'trust_verification_expired')).toHaveLength(1)
    expect(result.affected_users).toEqual(['u1'])
  })

  it('leaves fresh proofs and skills untouched', () => {
    db.trustVerificationProofs.push(githubProof({ id: 'p2', expiresAt: future() }))
    db.verifiedSkills.push({ id: 's1', userId: 'u1', skill: 'typescript', status: 'verified', confidence: 0.9, expiresAt: future(), proofId: 'p2', updatedAt: past(), createdAt: past() })

    const result = expireStaleInDb(db, { now: new Date() })

    expect(result.expired_proofs).toHaveLength(0)
    expect(result.expired_skills).toHaveLength(0)
    expect(db.trustVerificationProofs[0].status).toBe('verified')
    expect(db.verifiedSkills[0].status).toBe('verified')
    expect(trustScoreFor(db, 'u1').trustScore).toBeGreaterThan(0)
  })

  it('expires a stale skill and dedupes notifications across ticks', () => {
    db.trustVerificationProofs.push(githubProof())
    db.verifiedSkills.push({ id: 's1', userId: 'u1', skill: 'typescript', status: 'verified', confidence: 0.9, expiresAt: soon(), source: 'github', proofId: 'p1', updatedAt: past(), createdAt: past() })

    expireStaleInDb(db, { now: afterSoon() })
    const second = expireStaleInDb(db, { now: afterSoon() })

    expect(db.verifiedSkills[0].status).toBe('expired')
    expect(second.expired_proofs).toHaveLength(0)
    expect(db.notifications.filter(row => row.type === 'trust_verification_expired')).toHaveLength(1)
  })

  it('notifies investors that hold approved access to the founder', () => {
    db.trustVerificationProofs.push(githubProof({ projectId: 'proj1' }))
    db.investorTrustAccessRequests.push({ id: 'r1', projectId: 'proj1', investorId: 'inv1', status: 'approved' })

    expireStaleInDb(db, { now: afterSoon() })

    const investorNotes = db.notifications.filter(row => row.userId === 'inv1')
    expect(investorNotes).toHaveLength(1)
    expect(investorNotes[0].metadata.source).toBe('github')
  })
})
