import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(fn => fn({})),
  trustReadEnabled: vi.fn(() => true),
  trustWriteEnabled: vi.fn(() => true),
  trustRepositoryEnabled: vi.fn(() => true),
  countDueReverification: vi.fn(async () => ({ proofs: 3, skills: 1, sources: ['github'] })),
  listHistory: vi.fn(async () => []),
  saveGithubOauthState: vi.fn(async () => {}),
  saveLinkedinOauthState: vi.fn(async () => {}),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb, runDatabaseAuthority: (_db, fn) => fn() }))
vi.mock('../repositories/trustRepository.js', () => ({
  trustReadEnabled: mocks.trustReadEnabled,
  trustWriteEnabled: mocks.trustWriteEnabled,
  trustRepositoryEnabled: mocks.trustRepositoryEnabled,
  countDueReverification: mocks.countDueReverification,
  listHistory: mocks.listHistory,
}))
vi.mock('../repositories/githubRepository.js', () => ({ saveGithubOauthState: mocks.saveGithubOauthState }))
vi.mock('../repositories/linkedinRepository.js', () => ({ saveLinkedinOauthState: mocks.saveLinkedinOauthState }))

const asyncAuthority = await import('../services/trustAuthorityAsync.js')
const dispatcher = await import('../services/trustAuthority.js')
const reverification = await import('../services/trustReverificationService.js')
const surface = await import('../services/trustSurfaceService.js')

const envBackup = {}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.trustReadEnabled.mockReturnValue(true)
  mocks.trustWriteEnabled.mockReturnValue(true)
  mocks.trustRepositoryEnabled.mockReturnValue(true)
  for (const key of ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI']) envBackup[key] = process.env[key]
  process.env.GITHUB_CLIENT_ID = 'client-id'
  process.env.GITHUB_CLIENT_SECRET = 'client-secret'
  process.env.GITHUB_REDIRECT_URI = 'https://backend.techitnetwork.com/api/github/callback'
})
afterEach(() => {
  for (const [key, value] of Object.entries(envBackup)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
})

describe('row-level trust authority (§5 2a)', () => {
  it('mints a github trust oauth state through the row-level store', async () => {
    const result = await asyncAuthority.beginProviderVerification('u1', 'github')
    expect(result.ok).toBe(true)
    expect(result.status).toBe('pending')
    expect(result.authorizationUrl).toContain('https://github.com/login/oauth/authorize')
    expect(mocks.saveGithubOauthState).toHaveBeenCalledTimes(1)
    const row = mocks.saveGithubOauthState.mock.calls[0][0]
    expect(row).toMatchObject({ userId: 'u1', purpose: 'trust' })
    expect(row.state).toBeTruthy()
    expect(result.authorizationUrl).toContain(row.state)
  })

  it('routes beginProviderVerification to the async path when trust writes are postgres', async () => {
    const result = await dispatcher.beginProviderVerification('u1', 'github')
    expect(result.ok).toBe(true)
    expect(mocks.saveGithubOauthState).toHaveBeenCalledTimes(1)
  })

  it('rejects unsupported sources and reports unconfigured providers without writing', async () => {
    expect(await asyncAuthority.beginProviderVerification('u1', 'myspace')).toEqual({ ok: false, error: 'unsupported_trust_source' })
    delete process.env.GITHUB_CLIENT_ID
    const result = await asyncAuthority.beginProviderVerification('u1', 'github')
    expect(result).toMatchObject({ ok: true, status: 'manual_review_required' })
    expect(mocks.saveGithubOauthState).not.toHaveBeenCalled()
  })

  it('counts due reverification with SQL instead of loading every row', async () => {
    const result = await reverification.trustReverificationDueAsync()
    expect(result).toMatchObject({ due_proof_count: 3, due_skill_count: 1, sources: ['github'] })
    expect(mocks.countDueReverification).toHaveBeenCalledTimes(1)
  })

  it('builds the trust notification preview from row-level history', async () => {
    mocks.listHistory.mockResolvedValueOnce([
      { id: 'h1', status: 'expired', eventType: 'trust_expired', source: 'github', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 'h2', status: 'verified', eventType: 'trust_verified', source: 'linkedin', createdAt: '2026-10-02T00:00:00.000Z' },
    ])
    const result = await surface.previewTrustSurfaceNotificationsAsync('u1')
    expect(result.notification_intents).toHaveLength(1)
    expect(result.notification_intents[0]).toMatchObject({ notification_id: 'h1', notification_type: 'trust_expired', source: 'github', severity: 'critical' })
    expect(result.summary).toMatchObject({ events_seen: 2, notifications_prepared: 1 })
  })
})
