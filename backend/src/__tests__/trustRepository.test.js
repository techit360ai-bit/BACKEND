import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetTrustPoolForTests, __setTrustPoolForTests, loadTrustScope, updateProofStatus, insertProof } from '../repositories/trustRepository.js'

function fakePool({ proofRowCount = 1 } = {}) {
  const proofRow = {
    id: 'p1', user_id: 'u1', project_id: null, source: 'github', method: 'github_oauth',
    provider_subject_id: 'gh-1', status: 'verified', confidence: '0.98', points: '15',
    metadata: { repoCount: 4 }, evidence_hash: 'hash', expires_at: null,
    verified_at: '2026-01-01T00:00:00.000Z', reviewed_by: null, reviewed_at: null,
    review_note: null, attestation_level: 'provider_observed', correlation_group: 'code',
    half_life_days: null, metric_window: null, policy_version: 'trust-v2',
    last_synced_at: null, created_at: 'c', updated_at: 'u1',
  }
  const query = vi.fn(async (text) => {
    if (/FROM trust_verification_proofs/.test(text)) return { rows: [proofRow], rowCount: 1 }
    if (/UPDATE trust_verification_proofs/.test(text)) return { rows: proofRowCount ? [proofRow] : [], rowCount: proofRowCount }
    if (/INSERT INTO trust_verification_proofs/.test(text)) return { rows: [], rowCount: 1 }
    return { rows: [], rowCount: 0 }
  })
  return { query, connect: async () => ({ query, release: () => {} }), end: async () => {} }
}

afterEach(() => __resetTrustPoolForTests())

describe('trust repository', () => {
  it('scopes reads to a single user and maps rows', async () => {
    const pool = fakePool()
    __setTrustPoolForTests(pool)
    const scope = await loadTrustScope('u1')
    expect(pool.query).toHaveBeenCalled()
    for (const call of pool.query.mock.calls) expect(call[1]).toEqual(['u1'])
    expect(scope.trustVerificationProofs[0]).toMatchObject({ id: 'p1', userId: 'u1', status: 'verified', attestationLevel: 'provider_observed' })
    expect(scope.trustVerificationProofs[0].confidence).toBe(0.98)
  })

  it('returns null on an optimistic status conflict instead of overwriting', async () => {
    __setTrustPoolForTests(fakePool({ proofRowCount: 0 }))
    const result = await updateProofStatus('p1', { status: 'rejected', updatedAt: 'now' }, { expectedStatus: 'verified' })
    expect(result).toBeNull()
  })

  it('inserts proofs with ON CONFLICT so replays are idempotent', async () => {
    const pool = fakePool()
    __setTrustPoolForTests(pool)
    await insertProof({ id: 'p2', userId: 'u1', source: 'github', method: 'github_oauth', status: 'verified', confidence: 1, points: 15, metadata: {}, evidenceHash: 'h', createdAt: 'c', updatedAt: 'u' })
    const insertCall = pool.query.mock.calls.find(call => /INSERT INTO trust_verification_proofs/.test(call[0]))
    expect(insertCall[0]).toMatch(/ON CONFLICT\(id\) DO NOTHING/)
  })
})
