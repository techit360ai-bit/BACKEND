import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = { proofs: [], skills: [], history: [], challenges: [], profiles: [], snapshots: [], outbox: [], reviews: [], anomalies: [] }

vi.mock('../repositories/trustRepository.js', () => ({
  withTrustTransaction: async fn => fn({}),
  loadTrustScope: async userId => ({
    users: [{ id: userId }], profiles: [{ id: userId }],
    trustVerificationProofs: store.proofs.filter(row => row.userId === userId),
    verifiedSkills: store.skills.filter(row => row.userId === userId),
    trustVerificationHistory: store.history.filter(row => row.userId === userId),
    trustVerificationChallenges: store.challenges.filter(row => row.userId === userId),
    trustProfiles: store.profiles.filter(row => row.userId === userId),
    trustScoreSnapshots: store.snapshots.filter(row => row.userId === userId),
    trustProjectionOutbox: store.outbox.filter(row => row.userId === userId),
  }),
  insertProof: async proof => { store.proofs.push(proof); return proof },
  getProof: async id => store.proofs.find(row => row.id === id) || null,
  findProofsByEvidenceHash: async hash => store.proofs.filter(row => row.evidenceHash === hash),
  findProofsByProviderSubject: async (source, subject) => store.proofs.filter(row => row.source === source && row.providerSubjectId === subject),
  recordAnomaly: async entry => { store.anomalies.push(entry); return entry },
  updateProofStatus: async (id, patch) => {
    const row = store.proofs.find(item => item.id === id)
    if (!row) return null
    Object.assign(row, patch)
    return row
  },
  insertHistory: async entry => { store.history.push(entry); return entry },
  listHistory: async (userId, limit) => store.history.filter(row => row.userId === userId).slice(0, limit),
  upsertSkill: async skill => { const i = store.skills.findIndex(s => s.skill === skill.skill); if (i >= 0) store.skills[i] = skill; else store.skills.push(skill); return skill },
  listSkills: async userId => store.skills.filter(row => row.userId === userId),
  upsertProfile: async profile => { const i = store.profiles.findIndex(p => p.userId === profile.userId); if (i >= 0) store.profiles[i] = profile; else store.profiles.push(profile); return profile },
  insertSnapshot: async snapshot => { store.snapshots.push(snapshot); return snapshot },
  enqueueProjection: async entry => { store.outbox.push(entry); return entry },
  recordManualReview: async entry => { store.reviews.push(entry); return entry },
  revokeVerifiedProofs: async (userId, source) => {
    const revoked = store.proofs.filter(row => row.userId === userId && row.source === source && row.status === 'verified')
    for (const row of revoked) row.status = 'revoked'
    return revoked
  },
  getChallenge: async id => store.challenges.find(row => row.id === id) || null,
  insertChallenge: async challenge => { store.challenges.push(challenge); return challenge },
  updateChallenge: async (id, patch) => { const row = store.challenges.find(c => c.id === id); if (row) Object.assign(row, patch); return row },
  listRecentProofs: async () => store.proofs,
  listRecentChallenges: async () => store.challenges,
}))

import { addSkill, appendProof, getPublicTrust, reviewProof } from '../services/trustAuthorityAsync.js'

beforeEach(() => {
  for (const key of Object.keys(store)) store[key] = []
})

describe('async trust authority', () => {
  it('awards no score for pending client evidence', async () => {
    const result = await appendProof('u1', { source: 'linkedin', status: 'pending', metadata: { providerSubjectId: 'spoof' } })
    expect(result.ok).toBe(true)
    expect(result.profile.trust_score).toBe(0)
  })

  it('awards score from a verified provider proof and persists profile/snapshot/outbox once', async () => {
    const result = await appendProof('u1', { source: 'github', status: 'verified', method: 'github_oauth', confidence: 0.98, metadata: { repoCount: 4, commitCount: 100 } })
    expect(result.ok).toBe(true)
    expect(result.profile.trust_score).toBeGreaterThan(0)
    expect(store.profiles).toHaveLength(1)
    expect(store.snapshots).toHaveLength(1)
    expect(store.outbox).toHaveLength(1)
  })

  it('recomputes trust after admin rejection and drops proof-bound skills', async () => {
    const created = await appendProof('u1', { source: 'github', status: 'verified', method: 'github_oauth', metadata: { repoCount: 2 } })
    await addSkill('u1', { skill: 'TypeScript', proofId: created.proof.id, source: 'github' })
    expect((await getPublicTrust('u1')).verifiedSkills).toHaveLength(1)
    const reviewed = await reviewProof('admin-1', created.proof.id, { decision: 'rejected', note: 'failed review' })
    expect(reviewed.ok).toBe(true)
    expect(reviewed.score.trustScore).toBe(0)
    expect((await getPublicTrust('u1')).verifiedSkills).toHaveLength(0)
  })

  it('tags provider-observed vs self attestation', async () => {
    const verified = await appendProof('u1', { source: 'domain', status: 'verified', method: 'dns_txt' })
    const self = await appendProof('u1', { source: 'milestone', status: 'verified', method: 'user_submitted' })
    expect(verified.proof.attestationLevel).toBe('provider_observed')
    expect(self.proof.attestationLevel).toBe('self')
  })
})
