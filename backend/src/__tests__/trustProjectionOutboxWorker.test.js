import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const repoMode = { enabled: true }
const outbox = []
const delivered = []
const failed = []

vi.mock('../repositories/trustRepository.js', () => ({
  trustWriteEnabled: () => repoMode.enabled,
  trustRepositoryEnabled: () => repoMode.enabled,
  listPendingOutbox: async limit => outbox.slice(0, limit),
  markOutboxDelivered: async id => { delivered.push(id) },
  markOutboxFailed: async (id, error) => { failed.push({ id, error }) },
  loadTrustScope: async userId => ({
    users: [{ id: userId }],
    profiles: [{ id: userId }],
    trustVerificationProofs: [{ id: 'p1', userId, projectId: null, source: 'github', method: 'github_oauth', status: 'verified', confidence: 0.98, metadata: { repoCount: 4 }, evidenceHash: 'h', expiresAt: new Date(Date.now() + 3600_000).toISOString() }],
    verifiedSkills: [],
    trustVerificationHistory: [],
    trustVerificationChallenges: [],
    trustProfiles: [{ id: 't1', userId, projectId: null, trustScore: 15 }],
    trustScoreSnapshots: [],
    trustProjectionOutbox: [],
    trustScoreOverrides: [],
  }),
}))

import { flushTrustProjectionOutboxFromRepository } from '../services/trustProjectionOutboxWorker.js'

const savedEnv = { ...process.env }

beforeEach(() => {
  repoMode.enabled = true
  outbox.length = 0
  delivered.length = 0
  failed.length = 0
  process.env.TRUST_PROJECTION_SECRET = 'test-secret'
  process.env.TRUST_PROJECTION_URL = 'https://projection.test/internal/trust/projection'
  process.env.TRUST_WRITE_SOURCE = 'postgres'
})

afterEach(() => {
  process.env = { ...savedEnv }
  vi.unstubAllGlobals()
})

describe('repository outbox worker (WS9)', () => {
  it('is a no-op unless the row-level authority is the writer', async () => {
    repoMode.enabled = false
    const result = await flushTrustProjectionOutboxFromRepository()
    expect(result).toEqual({ enabled: false, attempted: 0, results: [] })
    expect(delivered).toHaveLength(0)
  })

  it('posts a repo-derived payload and marks the row delivered', async () => {
    outbox.push({ id: 'o1', userId: 'u1', projectId: null })
    let received = null
    vi.stubGlobal('fetch', vi.fn(async (url, init) => { received = JSON.parse(init.body); return { ok: true, status: 200, headers: { get: () => null } } }))
    const result = await flushTrustProjectionOutboxFromRepository()
    expect(result.delivered).toBe(1)
    expect(delivered).toEqual(['o1'])
    expect(received.userId).toBe('u1')
    expect(received.profile.github_connected).toBe(true)
  })

  it('keeps the row pending and records the error on failure', async () => {
    outbox.push({ id: 'o2', userId: 'u1', projectId: null })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, headers: { get: () => null } })))
    const result = await flushTrustProjectionOutboxFromRepository()
    expect(result.delivered).toBe(0)
    expect(failed[0].id).toBe('o2')
    expect(delivered).toHaveLength(0)
  })
})
