import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { repoMock, appendTrustProofMock } = vi.hoisted(() => {
  const mock = {
    getActiveCredential: vi.fn(),
    upsertCredential: vi.fn(),
    revokeCredential: vi.fn(),
    revokeVerifiedProofs: vi.fn(async () => []),
    listProofs: vi.fn(async () => []),
    listActiveCredentials: vi.fn(async () => []),
    latestRevenueSnapshot: vi.fn(async () => null),
    insertRevenueSnapshot: vi.fn(async entry => entry),
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

const { connectRevenueSource, verifyRevenueSource } = await import('../services/trustRevenueService.js')
const { encryptCredential } = await import('../services/trustCredentialVault.js')

const KEY = 'k'.repeat(48)
const baseEnv = () => ({ TRUST_CREDENTIAL_ENCRYPTION_KEY: KEY, TRUST_REVENUE_ENABLED: 'true', TRUST_REVENUE_REQUIRE_LIVEMODE: 'false' })

const stripeFetch = (overrides = {}) => vi.fn(async url => {
  const value = String(url)
  if (value.includes('/v1/account')) return { ok: true, status: 200, json: async () => ({ id: 'acct_1', business_profile: { url: 'https://acme.com' } }) }
  if (value.includes('/v1/subscriptions')) return { ok: true, status: 200, json: async () => ({ has_more: false, data: overrides.subscriptions ?? [{ id: 'sub_1', status: 'active', livemode: true, currency: 'usd', customer: 'cus_1', items: { data: [{ quantity: 1, price: { unit_amount: 500000, recurring: { interval: 'month' } } }] } }] }) }
  if (value.includes('/v1/charges')) return { ok: true, status: 200, json: async () => ({ data: [] }) }
  throw new Error(`unexpected ${value}`)
})

beforeEach(() => {
  process.env.TRUST_WRITE_SOURCE = 'postgres'
  for (const fn of Object.values(repoMock)) fn.mockReset?.()
  repoMock.withTrustTransaction.mockImplementation(async handler => handler({}))
  repoMock.revokeVerifiedProofs.mockResolvedValue([])
  repoMock.listProofs.mockResolvedValue([])
  repoMock.latestRevenueSnapshot.mockResolvedValue(null)
  repoMock.getActiveCredential.mockResolvedValue(null)
  repoMock.upsertCredential.mockImplementation(async entry => entry)
  appendTrustProofMock.mockReset()
  appendTrustProofMock.mockResolvedValue({ ok: true, proof: { id: 'proof-1' }, profile: {} })
})

afterEach(() => {
  delete process.env.TRUST_WRITE_SOURCE
})

describe('connectRevenueSource', () => {
  it('stores a founder read-only credential encrypted and returns no secret', async () => {
    const env = baseEnv()
    const result = await connectRevenueSource('u1', { provider: 'stripe', credential: 'rk_test_abc' }, { env })
    expect(result.ok).toBe(true)
    expect(result.credential).toMatchObject({ provider: 'stripe', mode: 'test', stored: true, secret_stored: false })
    expect(JSON.stringify(result)).not.toContain('rk_test_abc')
    const stored = repoMock.upsertCredential.mock.calls[0][0]
    expect(stored.encryptedPayload).not.toContain('rk_test_abc')
    expect(stored.source).toBe('revenue')
  })

  it('rejects a full-access stripe secret key unless explicitly allowed', async () => {
    const result = await connectRevenueSource('u1', { provider: 'stripe', credential: 'sk_live_abc' }, { env: baseEnv() })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('read_only_key_required')
    const allowed = await connectRevenueSource('u1', { provider: 'stripe', credential: 'sk_live_abc' }, { env: { ...baseEnv(), TRUST_REVENUE_ALLOW_SECRET_KEYS: 'true' } })
    expect(allowed.ok).toBe(true)
  })

  it('keeps the source coming soon while disabled', async () => {
    const result = await connectRevenueSource('u1', { provider: 'stripe', credential: 'rk_test_abc' }, { env: { TRUST_CREDENTIAL_ENCRYPTION_KEY: KEY } })
    expect(result.status).toBe(409)
    expect(result.error).toBe('trust_source_coming_soon')
  })
})

describe('verifyRevenueSource', () => {
  it('mints a verified provider-observed proof from founder credential data', async () => {
    const env = baseEnv()
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'stripe', source: 'revenue', scopes: ['read_only'], mode: 'live', createdAt: 'c', encryptedPayload: encryptCredential('rk_live_abc', { env }) })
    const result = await verifyRevenueSource('u1', 'stripe', { env, fetchImpl: stripeFetch() })
    expect(result.ok).toBe(true)
    expect(result.aggregates.mrr).toBe(5000)
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input).toMatchObject({ source: 'revenue', status: 'verified', method: 'stripe_readonly', attestationLevel: 'provider_observed', correlationGroup: 'financials', providerSubjectId: 'acct_1' })
    expect(input.metadata).toMatchObject({ provider: 'stripe', credentialSource: 'founder', mrr: 5000, arr: 60000 })
    expect(repoMock.insertRevenueSnapshot).toHaveBeenCalled()
  })

  it('falls back to the platform payment credential without a shared provider subject', async () => {
    const env = { ...baseEnv(), STRIPE_SECRET_KEY: 'sk_live_platform' }
    const result = await verifyRevenueSource('u1', 'stripe', { env, fetchImpl: stripeFetch() })
    expect(result.ok).toBe(true)
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input.providerSubjectId).toBeNull()
    expect(input.metadata.credentialSource).toBe('platform')
  })

  it('rejects a credential/mode mismatch and test-mode keys', async () => {
    const env = baseEnv()
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'stripe', source: 'revenue', scopes: [], mode: 'live', createdAt: 'c', encryptedPayload: encryptCredential('rk_live_abc', { env }) })
    const mismatch = await verifyRevenueSource('u1', 'stripe', { env, fetchImpl: stripeFetch({ subscriptions: [{ id: 's', status: 'active', livemode: false, currency: 'usd', customer: 'c', items: { data: [] } }] }) })
    expect(mismatch.error).toBe('revenue_mode_mismatch')

    const strict = { ...env, TRUST_REVENUE_REQUIRE_LIVEMODE: 'true' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'stripe', source: 'revenue', scopes: [], mode: 'live', createdAt: 'c', encryptedPayload: encryptCredential('rk_test_abc', { env: strict }) })
    const testMode = await verifyRevenueSource('u1', 'stripe', { env: strict, fetchImpl: stripeFetch({ subscriptions: [{ id: 's', status: 'active', livemode: false, currency: 'usd', customer: 'c', items: { data: [{ quantity: 1, price: { unit_amount: 1000, recurring: { interval: 'month' } } }] } }] }) })
    expect(testMode.error).toBe('revenue_test_mode_rejected')
  })

  it('enforces minimum thresholds', async () => {
    const env = { ...baseEnv(), TRUST_REVENUE_MIN_MRR: '100000' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'stripe', source: 'revenue', scopes: [], mode: 'live', createdAt: 'c', encryptedPayload: encryptCredential('rk_live_abc', { env }) })
    const result = await verifyRevenueSource('u1', 'stripe', { env, fetchImpl: stripeFetch() })
    expect(result.error).toBe('revenue_below_threshold')
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })

  it('flags implausible growth against the previous snapshot', async () => {
    const env = { ...baseEnv(), TRUST_REVENUE_MAX_MRR_JUMP_PCT: '50' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'stripe', source: 'revenue', scopes: [], mode: 'live', createdAt: 'c', encryptedPayload: encryptCredential('rk_live_abc', { env }) })
    repoMock.latestRevenueSnapshot.mockResolvedValue({ mrr: 100 })
    const result = await verifyRevenueSource('u1', 'stripe', { env, fetchImpl: stripeFetch() })
    expect(result.error).toBe('revenue_implausible_growth')
    expect(repoMock.recordAnomaly).toHaveBeenCalled()
  })

  it('requires a matching verified domain when enforced', async () => {
    const env = { ...baseEnv(), TRUST_REVENUE_REQUIRE_DOMAIN_MATCH: 'true' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'stripe', source: 'revenue', scopes: [], mode: 'live', createdAt: 'c', encryptedPayload: encryptCredential('rk_live_abc', { env }) })
    repoMock.listProofs.mockResolvedValue([{ source: 'website', status: 'verified', metadata: { domain: 'other.com' } }])
    const result = await verifyRevenueSource('u1', 'stripe', { env, fetchImpl: stripeFetch() })
    expect(result.error).toBe('revenue_domain_mismatch')
  })

  it('requires a connected credential when no platform key exists', async () => {
    const result = await verifyRevenueSource('u1', 'stripe', { env: baseEnv(), fetchImpl: stripeFetch() })
    expect(result.error).toBe('revenue_credential_not_connected')
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })
})
