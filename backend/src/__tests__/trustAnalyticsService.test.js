import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { repoMock, appendTrustProofMock } = vi.hoisted(() => {
  const mock = {
    getActiveCredential: vi.fn(),
    upsertCredential: vi.fn(async entry => entry),
    revokeCredential: vi.fn(async entry => entry),
    revokeVerifiedProofs: vi.fn(async () => []),
    listProofs: vi.fn(async () => []),
    listActiveCredentials: vi.fn(async () => []),
    latestAnalyticsSnapshot: vi.fn(async () => null),
    insertAnalyticsSnapshot: vi.fn(async entry => entry),
    markCredentialSynced: vi.fn(async entry => entry),
    recordAnomaly: vi.fn(async entry => entry),
    insertHistory: vi.fn(async entry => entry),
    listCredentialsDueForSync: vi.fn(async () => []),
    withTrustTransaction: vi.fn(async fn => fn({})),
  }
  return { repoMock: mock, appendTrustProofMock: vi.fn(async () => ({ ok: true, proof: { id: 'proof-1' }, profile: {} })) }
})

vi.mock('../repositories/trustRepository.js', () => repoMock)
vi.mock('../services/trustAuthority.js', () => ({ appendTrustProof: appendTrustProofMock }))

const { connectAnalyticsSource, verifyAnalyticsSource, disconnectAnalyticsSource } = await import('../services/trustAnalyticsService.js')
const { encryptCredential } = await import('../services/trustCredentialVault.js')

const KEY = 'k'.repeat(48)
const baseEnv = () => ({ TRUST_CREDENTIAL_ENCRYPTION_KEY: KEY, TRUST_ANALYTICS_ENABLED: 'true', TRUST_ANALYTICS_PROVIDERS: 'posthog' })

// PostHog fetcher issues three concurrent HogQL queries; map by interval.
const posthogFetch = (values = { dau: 50, wau: 200, mau: 800 }) => vi.fn(async (_url, init) => {
  const sql = JSON.parse(init.body).query.query
  const value = sql.includes('1 DAY') ? values.dau : sql.includes('7 DAY') ? values.wau : values.mau
  return { ok: true, status: 200, json: async () => ({ results: [[value]] }) }
})

beforeEach(() => {
  process.env.TRUST_WRITE_SOURCE = 'postgres'
  for (const fn of Object.values(repoMock)) fn.mockReset?.()
  repoMock.withTrustTransaction.mockImplementation(async handler => handler({}))
  repoMock.revokeVerifiedProofs.mockResolvedValue([])
  repoMock.listProofs.mockResolvedValue([])
  repoMock.latestAnalyticsSnapshot.mockResolvedValue(null)
  repoMock.getActiveCredential.mockResolvedValue(null)
  repoMock.upsertCredential.mockImplementation(async entry => entry)
  appendTrustProofMock.mockReset()
  appendTrustProofMock.mockResolvedValue({ ok: true, proof: { id: 'proof-1' }, profile: {} })
})

afterEach(() => {
  delete process.env.TRUST_WRITE_SOURCE
})

describe('connectAnalyticsSource', () => {
  it('stores a founder credential encrypted and never returns the secret', async () => {
    const env = baseEnv()
    const result = await connectAnalyticsSource('u1', { provider: 'posthog', credential: 'ph_secret_key', subject: 'proj-1' }, { env })
    expect(result.ok).toBe(true)
    expect(result.credential).toMatchObject({ provider: 'posthog', stored: true, secret_stored: false })
    expect(JSON.stringify(result)).not.toContain('ph_secret_key')
    const stored = repoMock.upsertCredential.mock.calls[0][0]
    expect(stored.encryptedPayload).not.toContain('ph_secret_key')
    expect(stored.source).toBe('product_analytics')
    expect(stored.subject).toBe('proj-1')
  })

  it('keeps analytics coming soon while disabled', async () => {
    const result = await connectAnalyticsSource('u1', { provider: 'posthog', credential: 'ph_key' }, { env: { TRUST_CREDENTIAL_ENCRYPTION_KEY: KEY } })
    expect(result.status).toBe(409)
    expect(result.error).toBe('trust_source_coming_soon')
    expect(result.reason).toBe('feature_disabled')
  })

  it('rejects unsupported providers and requires the postgres authority', async () => {
    expect((await connectAnalyticsSource('u1', { provider: 'segment', credential: 'x' }, { env: baseEnv() })).error).toBe('unsupported_analytics_provider')
    delete process.env.TRUST_WRITE_SOURCE
    expect((await connectAnalyticsSource('u1', { provider: 'posthog', credential: 'x' }, { env: baseEnv() })).error).toBe('analytics_requires_postgres_authority')
  })
})

describe('verifyAnalyticsSource', () => {
  it('mints a verified provider-observed proof from founder credential data', async () => {
    const env = baseEnv()
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'posthog', source: 'product_analytics', scopes: ['read_only'], createdAt: 'c', subject: 'proj-1', encryptedPayload: encryptCredential('ph_secret', { env }) })
    const result = await verifyAnalyticsSource('u1', 'posthog', { env, fetchImpl: posthogFetch() })
    expect(result.ok).toBe(true)
    expect(result.metrics).toMatchObject({ mau: 800, dau: 50, wau: 200 })
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input).toMatchObject({ source: 'product_analytics', status: 'verified', method: 'posthog_readonly', attestationLevel: 'provider_observed', correlationGroup: 'product', providerSubjectId: 'proj-1' })
    expect(input.metadata).toMatchObject({ provider: 'posthog', credentialSource: 'founder', mau: 800, dau: 50 })
    expect(repoMock.insertAnalyticsSnapshot).toHaveBeenCalled()
  })

  it('falls back to the platform analytics credential without a shared provider subject', async () => {
    const env = { ...baseEnv(), POSTHOG_API_KEY: 'ph_platform', POSTHOG_PROJECT_ID: 'proj-platform' }
    const result = await verifyAnalyticsSource('u1', 'posthog', { env, fetchImpl: posthogFetch() })
    expect(result.ok).toBe(true)
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input.providerSubjectId).toBeNull()
    expect(input.metadata.credentialSource).toBe('platform')
  })

  it('enforces minimum MAU thresholds', async () => {
    const env = { ...baseEnv(), TRUST_ANALYTICS_MIN_MAU: '5000' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'posthog', source: 'product_analytics', scopes: [], createdAt: 'c', subject: 'proj-1', encryptedPayload: encryptCredential('ph_secret', { env }) })
    const result = await verifyAnalyticsSource('u1', 'posthog', { env, fetchImpl: posthogFetch() })
    expect(result.error).toBe('analytics_below_threshold')
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })

  it('rejects stale snapshots beyond the freshness window', async () => {
    // A freshly-read provider snapshot has ~0h age; a max below that forces the gate.
    const env = { ...baseEnv(), TRUST_ANALYTICS_MAX_FRESHNESS_HOURS: '-1' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'posthog', source: 'product_analytics', scopes: [], createdAt: 'c', subject: 'proj-1', encryptedPayload: encryptCredential('ph_secret', { env }) })
    const result = await verifyAnalyticsSource('u1', 'posthog', { env, fetchImpl: posthogFetch() })
    expect(result.error).toBe('analytics_stale_data')
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })

  it('flags implausible MAU growth against the previous snapshot', async () => {
    const env = { ...baseEnv(), TRUST_ANALYTICS_MAX_MAU_JUMP_RATIO: '2' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'posthog', source: 'product_analytics', scopes: [], createdAt: 'c', subject: 'proj-1', encryptedPayload: encryptCredential('ph_secret', { env }) })
    repoMock.latestAnalyticsSnapshot.mockResolvedValue({ mau: 100 })
    const result = await verifyAnalyticsSource('u1', 'posthog', { env, fetchImpl: posthogFetch({ mau: 800 }) })
    expect(result.error).toBe('analytics_implausible_growth')
    expect(repoMock.recordAnomaly).toHaveBeenCalled()
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })

  it('requires a matching verified domain when enforced', async () => {
    const env = { ...baseEnv(), TRUST_ANALYTICS_REQUIRE_DOMAIN_MATCH: 'true' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'posthog', source: 'product_analytics', scopes: [], createdAt: 'c', subject: 'proj-1', encryptedPayload: encryptCredential('ph_secret', { env }) })
    repoMock.listProofs.mockResolvedValue([{ source: 'website', status: 'verified', metadata: { domain: 'other.com' } }])
    const result = await verifyAnalyticsSource('u1', 'posthog', { env, fetchImpl: posthogFetch() })
    expect(result.error).toBe('analytics_domain_mismatch')
  })

  it('requires a connected credential when no platform key exists', async () => {
    const result = await verifyAnalyticsSource('u1', 'posthog', { env: baseEnv(), fetchImpl: posthogFetch() })
    expect(result.error).toBe('analytics_credential_not_connected')
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })
})

describe('disconnectAnalyticsSource', () => {
  it('revokes the credential and verified proofs', async () => {
    repoMock.revokeVerifiedProofs.mockResolvedValue([{ id: 'p1', projectId: null, confidence: 0.9, evidenceHash: 'h', expiresAt: null }])
    const result = await disconnectAnalyticsSource('u1', 'posthog')
    expect(result).toMatchObject({ ok: true, provider: 'posthog', status: 'disconnected' })
    expect(repoMock.revokeCredential).toHaveBeenCalledWith('u1', 'posthog')
    expect(repoMock.revokeVerifiedProofs).toHaveBeenCalledWith('u1', 'product_analytics', expect.anything())
  })
})
