import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { repoMock, appendTrustProofMock } = vi.hoisted(() => {
  const mock = {
    getActiveCredential: vi.fn(),
    upsertCredential: vi.fn(async entry => entry),
    revokeCredential: vi.fn(async entry => entry),
    revokeVerifiedProofs: vi.fn(async () => []),
    listProofs: vi.fn(async () => []),
    listActiveCredentials: vi.fn(async () => []),
    latestShippingSnapshot: vi.fn(async () => null),
    insertShippingSnapshot: vi.fn(async entry => entry),
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

const { connectShippingSource, verifyShippingSource, disconnectShippingSource } = await import('../services/trustShippingService.js')
const { encryptCredential } = await import('../services/trustCredentialVault.js')

const KEY = 'k'.repeat(48)
const baseEnv = () => ({ TRUST_CREDENTIAL_ENCRYPTION_KEY: KEY, TRUST_SHIPPING_ENABLED: 'true', TRUST_SHIPPING_PROVIDERS: 'github_actions' })
const recent = () => new Date(Date.now() - 3600_000).toISOString()

const githubFetch = (runs = 3) => vi.fn(async url => {
  const value = String(url)
  if (value.includes('/actions/runs')) return { ok: true, status: 200, json: async () => ({ workflow_runs: Array.from({ length: runs }, () => ({ status: 'completed', conclusion: 'success', updated_at: recent() })) }) }
  if (value.includes('/pulls')) return { ok: true, status: 200, json: async () => ([{ merged_at: recent() }]) }
  if (value.includes('/releases')) return { ok: true, status: 200, json: async () => ([{ published_at: recent() }]) }
  throw new Error(`unexpected ${value}`)
})

beforeEach(() => {
  process.env.TRUST_WRITE_SOURCE = 'postgres'
  for (const fn of Object.values(repoMock)) fn.mockReset?.()
  repoMock.withTrustTransaction.mockImplementation(async handler => handler({}))
  repoMock.revokeVerifiedProofs.mockResolvedValue([])
  repoMock.listProofs.mockResolvedValue([])
  repoMock.latestShippingSnapshot.mockResolvedValue(null)
  repoMock.getActiveCredential.mockResolvedValue(null)
  repoMock.upsertCredential.mockImplementation(async entry => entry)
  appendTrustProofMock.mockReset()
  appendTrustProofMock.mockResolvedValue({ ok: true, proof: { id: 'proof-1' }, profile: {} })
})

afterEach(() => {
  delete process.env.TRUST_WRITE_SOURCE
})

describe('connectShippingSource', () => {
  it('stores a founder credential encrypted and never returns the secret', async () => {
    const env = baseEnv()
    const result = await connectShippingSource('u1', { provider: 'github_actions', credential: 'ghp_secret', subject: 'acme/app' }, { env })
    expect(result.ok).toBe(true)
    expect(result.credential).toMatchObject({ provider: 'github_actions', stored: true, secret_stored: false })
    expect(JSON.stringify(result)).not.toContain('ghp_secret')
    const stored = repoMock.upsertCredential.mock.calls[0][0]
    expect(stored.encryptedPayload).not.toContain('ghp_secret')
    expect(stored.source).toBe('shipping')
    expect(stored.subject).toBe('acme/app')
  })

  it('keeps shipping coming soon while disabled', async () => {
    const result = await connectShippingSource('u1', { provider: 'github_actions', credential: 'ghp_x' }, { env: { TRUST_CREDENTIAL_ENCRYPTION_KEY: KEY } })
    expect(result.status).toBe(409)
    expect(result.reason).toBe('feature_disabled')
  })

  it('rejects unsupported providers and requires the postgres authority', async () => {
    expect((await connectShippingSource('u1', { provider: 'jenkins', credential: 'x' }, { env: baseEnv() })).error).toBe('unsupported_shipping_provider')
    delete process.env.TRUST_WRITE_SOURCE
    expect((await connectShippingSource('u1', { provider: 'github_actions', credential: 'x' }, { env: baseEnv() })).error).toBe('shipping_requires_postgres_authority')
  })
})

describe('verifyShippingSource', () => {
  it('mints a verified provider-observed deployment proof from provider cadence', async () => {
    const env = baseEnv()
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'github_actions', source: 'shipping', scopes: ['read_only'], createdAt: 'c', subject: 'acme/app', encryptedPayload: encryptCredential('ghp_x', { env }) })
    const result = await verifyShippingSource('u1', 'github_actions', { env, fetchImpl: githubFetch(3) })
    expect(result.ok).toBe(true)
    expect(result.cadence).toMatchObject({ deploys_30d: 3, merged_prs_30d: 1, releases_30d: 1 })
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input).toMatchObject({ source: 'deployment', status: 'verified', method: 'github_actions_readonly', attestationLevel: 'provider_observed', correlationGroup: 'delivery', providerSubjectId: 'acme/app' })
    expect(input.metadata).toMatchObject({ provider: 'github_actions', credentialSource: 'founder', deploys30d: 3, deployments30d: 3, mergedPrs30d: 1 })
    expect(repoMock.insertShippingSnapshot).toHaveBeenCalled()
  })

  it('falls back to the platform token without a shared provider subject', async () => {
    const env = { ...baseEnv(), GITHUB_ACTIONS_TOKEN: 'ghp_platform', GITHUB_ACTIONS_REPO: 'acme/app' }
    const result = await verifyShippingSource('u1', 'github_actions', { env, fetchImpl: githubFetch(2) })
    expect(result.ok).toBe(true)
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input.providerSubjectId).toBeNull()
    expect(input.metadata.credentialSource).toBe('platform')
  })

  it('enforces the minimum deploys threshold', async () => {
    const env = { ...baseEnv(), TRUST_SHIPPING_MIN_DEPLOYS_30D: '5' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'github_actions', source: 'shipping', scopes: [], createdAt: 'c', subject: 'acme/app', encryptedPayload: encryptCredential('ghp_x', { env }) })
    const result = await verifyShippingSource('u1', 'github_actions', { env, fetchImpl: githubFetch(1) })
    expect(result.error).toBe('shipping_below_threshold')
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })

  it('flags implausible cadence growth against the previous snapshot', async () => {
    const env = { ...baseEnv(), TRUST_SHIPPING_MAX_DEPLOYS_JUMP_RATIO: '2' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'github_actions', source: 'shipping', scopes: [], createdAt: 'c', subject: 'acme/app', encryptedPayload: encryptCredential('ghp_x', { env }) })
    repoMock.latestShippingSnapshot.mockResolvedValue({ deploys30d: 1 })
    const result = await verifyShippingSource('u1', 'github_actions', { env, fetchImpl: githubFetch(4) })
    expect(result.error).toBe('shipping_implausible_growth')
    expect(repoMock.recordAnomaly).toHaveBeenCalled()
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })

  it('requires a matching verified domain when enforced', async () => {
    const env = { ...baseEnv(), TRUST_SHIPPING_REQUIRE_DOMAIN_MATCH: 'true' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'github_actions', source: 'shipping', scopes: [], createdAt: 'c', subject: 'acme/app', encryptedPayload: encryptCredential('ghp_x', { env }) })
    repoMock.listProofs.mockResolvedValue([{ source: 'website', status: 'verified', metadata: { domain: 'other.com' } }])
    const result = await verifyShippingSource('u1', 'github_actions', { env, fetchImpl: githubFetch(2) })
    expect(result.error).toBe('shipping_domain_mismatch')
  })

  it('requires a connected credential when no platform token exists', async () => {
    const result = await verifyShippingSource('u1', 'github_actions', { env: baseEnv(), fetchImpl: githubFetch(2) })
    expect(result.error).toBe('shipping_credential_not_connected')
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })
})

describe('disconnectShippingSource', () => {
  it('revokes the credential and verified deployment proofs', async () => {
    repoMock.revokeVerifiedProofs.mockResolvedValue([{ id: 'p1', projectId: null, confidence: 0.9, evidenceHash: 'h', expiresAt: null }])
    const result = await disconnectShippingSource('u1', 'github_actions')
    expect(result).toMatchObject({ ok: true, provider: 'github_actions', status: 'disconnected' })
    expect(repoMock.revokeCredential).toHaveBeenCalledWith('u1', 'github_actions')
    expect(repoMock.revokeVerifiedProofs).toHaveBeenCalledWith('u1', 'deployment', expect.anything())
  })
})
