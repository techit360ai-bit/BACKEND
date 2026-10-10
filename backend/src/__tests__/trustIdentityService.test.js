import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { repoMock, appendMock, vaultMock, teamAdapterMock, identityAdapterMock } = vi.hoisted(() => ({
  repoMock: {
    insertIdentityVerification: vi.fn(async entry => entry),
    listIdentityVerifications: vi.fn(async () => []),
    insertScreeningResult: vi.fn(async entry => ({ ...entry, id: entry.id })),
    listScreeningResults: vi.fn(async () => []),
    latestScreeningResult: vi.fn(async () => null),
    listCredentialsDueForSync: vi.fn(async () => []),
    getActiveCredential: vi.fn(async () => null),
    listActiveCredentials: vi.fn(async () => []),
    upsertCredential: vi.fn(async entry => ({ ...entry, scopes: entry.scopes || ['read_only'], createdAt: entry.createdAt })),
    revokeCredential: vi.fn(async () => ({ ok: true })),
    markCredentialSynced: vi.fn(async () => ({ ok: true })),
    revokeVerifiedProofs: vi.fn(async () => []),
    insertHistory: vi.fn(async () => ({ ok: true })),
    listProofs: vi.fn(async () => []),
    withTrustTransaction: vi.fn(async fn => fn(undefined)),
  },
  appendMock: vi.fn(async () => ({ ok: true, proof: { id: 'proof-1' }, profile: { trustScore: 18 } })),
  vaultMock: {
    credentialVaultConfigured: vi.fn(() => true),
    encryptCredential: vi.fn(value => `enc:${value}`),
    decryptCredential: vi.fn(() => 'decrypted'),
    describeCredential: vi.fn((provider, meta) => ({ provider, scopes: meta?.scopes || ['read_only'], created_at: meta?.created_at || null })),
  },
  teamAdapterMock: { fetchProviderRegistry: vi.fn() },
  identityAdapterMock: { fetchKycSession: vi.fn(), fetchSanctionsScreening: vi.fn() },
}))

vi.mock('../repositories/trustRepository.js', () => repoMock)
vi.mock('../services/trustAuthority.js', () => ({ appendTrustProof: appendMock }))
vi.mock('../services/trustCredentialVault.js', () => vaultMock)
vi.mock('../services/trustTeamAdapter.js', () => ({ ...teamAdapterMock, normalizePersonName: value => String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim() }))
vi.mock('../services/trustIdentityAdapter.js', () => identityAdapterMock)

const { connectIdentitySource, disconnectIdentitySource, listIdentity, runSanctionsScreening, verifyBusinessRegistry, verifyIdentity } = await import('../services/trustIdentityService.js')

const kycEnv = () => ({ TRUST_KYC_ENABLED: 'true', TRUST_KYC_PROVIDER: 'persona', TRUST_DPIA_APPROVAL_REF: 'DPIA-2026-01', TRUST_KYC_REGIONS: 'HU,DE', PERSONA_API_KEY: 'persona-key' })

beforeEach(() => {
  process.env.TRUST_WRITE_SOURCE = 'postgres'
  for (const fn of Object.values(repoMock)) fn.mockReset?.()
  repoMock.insertIdentityVerification.mockImplementation(async entry => entry)
  repoMock.insertScreeningResult.mockImplementation(async entry => ({ ...entry, id: entry.id }))
  repoMock.revokeVerifiedProofs.mockResolvedValue([])
  repoMock.withTrustTransaction.mockImplementation(async fn => fn(undefined))
  repoMock.getActiveCredential.mockResolvedValue(null)
  repoMock.listProofs.mockResolvedValue([])
  repoMock.listScreeningResults.mockResolvedValue([])
  repoMock.listIdentityVerifications.mockResolvedValue([])
  repoMock.listCredentialsDueForSync.mockResolvedValue([])
  appendMock.mockReset(); appendMock.mockResolvedValue({ ok: true, proof: { id: 'proof-1' }, profile: { trustScore: 18 } })
  identityAdapterMock.fetchKycSession.mockReset()
  identityAdapterMock.fetchSanctionsScreening.mockReset()
  teamAdapterMock.fetchProviderRegistry.mockReset()
})

afterEach(() => { delete process.env.TRUST_WRITE_SOURCE })

describe('verifyIdentity (KYC)', () => {
  it('mints a provider-observed identity proof from an approved KYC result', async () => {
    identityAdapterMock.fetchKycSession.mockResolvedValue({ ok: true, provider: 'persona', verified: true, status: 'verified', reference: 'inq_1' })
    const result = await verifyIdentity('u1', { provider: 'persona', reference: 'inq_1', country: 'HU' }, { env: kycEnv() })
    expect(result.ok).toBe(true)
    expect(repoMock.insertIdentityVerification).toHaveBeenCalledWith(expect.objectContaining({ kind: 'kyc', status: 'verified' }), expect.anything())
    const input = appendMock.mock.calls[0][1]
    expect(input).toMatchObject({ source: 'identity', method: 'kyc_persona', status: 'verified', attestationLevel: 'provider_observed' })
    expect(input.metadata).toMatchObject({ identityKind: 'kyc', kycProvider: 'persona', kycStatus: 'verified', country: 'HU' })
  })

  it('never mints a verified badge on failed KYC and revokes a prior one', async () => {
    identityAdapterMock.fetchKycSession.mockResolvedValue({ ok: true, provider: 'persona', verified: false, status: 'failed', reference: 'inq_1' })
    const result = await verifyIdentity('u1', { provider: 'persona', reference: 'inq_1' }, { env: kycEnv() })
    expect(result.status).toBe(422)
    expect(result.error).toBe('identity_kyc_failed')
    expect(appendMock).not.toHaveBeenCalled()
    expect(repoMock.revokeVerifiedProofs).toHaveBeenCalledWith('u1', 'identity', expect.anything())
  })

  it('reports pending KYC without revoking or minting', async () => {
    identityAdapterMock.fetchKycSession.mockResolvedValue({ ok: true, provider: 'persona', verified: false, status: 'pending', reference: 'inq_1' })
    const result = await verifyIdentity('u1', { provider: 'persona', reference: 'inq_1' }, { env: kycEnv() })
    expect(result.status).toBe(202)
    expect(result.error).toBe('identity_kyc_pending')
    expect(appendMock).not.toHaveBeenCalled()
    expect(repoMock.revokeVerifiedProofs).not.toHaveBeenCalled()
  })

  it('rejects founders outside the declared KYC regions before any provider call', async () => {
    const result = await verifyIdentity('u1', { provider: 'persona', reference: 'inq_1', country: 'US' }, { env: kycEnv() })
    expect(result).toMatchObject({ status: 422, error: 'identity_region_not_allowed' })
    expect(identityAdapterMock.fetchKycSession).not.toHaveBeenCalled()
  })

  it('requires a connected credential', async () => {
    const env = { ...kycEnv() }; delete env.PERSONA_API_KEY
    const result = await verifyIdentity('u1', { provider: 'persona', reference: 'inq_1' }, { env })
    expect(result.error).toBe('identity_credential_not_connected')
    expect(identityAdapterMock.fetchKycSession).not.toHaveBeenCalled()
  })
})

describe('business registry', () => {
  it('mints a provider-observed identity proof when the founder is a listed officer', async () => {
    teamAdapterMock.fetchProviderRegistry.mockResolvedValue({ ok: true, provider: 'opencorporates', subject: '123', entityExists: true, entity: { name: 'Acme Ltd', companyNumber: '123', jurisdiction: 'gb' }, officers: [], founderIsOfficer: true })
    const env = { ...kycEnv(), OPENCORPORATES_API_KEY: 'oc' }
    const result = await verifyBusinessRegistry('u1', { provider: 'opencorporates', companyNumber: '123', founderName: 'Jane Doe' }, { env })
    expect(result.ok).toBe(true)
    const input = appendMock.mock.calls[0][1]
    expect(input).toMatchObject({ source: 'identity', method: 'registry', attestationLevel: 'provider_observed' })
    expect(input.metadata).toMatchObject({ identityKind: 'registry', entityName: 'Acme Ltd', companyNumber: '123', officerVerified: true })
  })
})

describe('sanctions screening (append-only)', () => {
  it('appends a screening row and returns the clear result', async () => {
    identityAdapterMock.fetchSanctionsScreening.mockResolvedValue({ ok: true, provider: 'ofac', status: 'clear', matchCount: 0 })
    const result = await runSanctionsScreening('u1', { provider: 'ofac', name: 'Jane Doe', country: 'HU' }, { env: kycEnv() })
    expect(result.ok).toBe(true)
    expect(result.screening.status).toBe('clear')
    expect(repoMock.insertScreeningResult).toHaveBeenCalledTimes(1)
    expect(repoMock.insertScreeningResult.mock.calls[0][0]).toMatchObject({ provider: 'ofac', status: 'clear', matchCount: 0, country: 'HU' })
  })

  it('records a match without updating earlier rows', async () => {
    identityAdapterMock.fetchSanctionsScreening.mockResolvedValue({ ok: true, provider: 'ofac', status: 'match', matchCount: 2 })
    const result = await runSanctionsScreening('u1', { provider: 'ofac', name: 'Ivan Test Person' }, { env: kycEnv() })
    expect(result.screening).toMatchObject({ status: 'match', match_count: 2 })
    expect(repoMock.insertScreeningResult).toHaveBeenCalledTimes(1)
  })
})

describe('listIdentity', () => {
  it('flags screening as due when no screening exists', async () => {
    const result = await listIdentity('u1')
    expect(result.ok).toBe(true)
    expect(result.screening_due).toBe(true)
    expect(result.rescreen_days).toBe(30)
  })
})

describe('credentials + disconnect', () => {
  it('stores only an encrypted credential', async () => {
    const result = await connectIdentitySource('u1', { provider: 'persona', credential: 'secret', subject: 'inq_1' }, { env: kycEnv() })
    expect(result.ok).toBe(true)
    expect(vaultMock.encryptCredential).toHaveBeenCalledWith('secret', expect.anything())
    expect(repoMock.upsertCredential.mock.calls[0][0]).toMatchObject({ provider: 'persona', source: 'identity', encryptedPayload: 'enc:secret' })
  })

  it('disconnects identity proofs and the credential', async () => {
    const result = await disconnectIdentitySource('u1', 'persona')
    expect(result.ok).toBe(true)
    expect(repoMock.revokeCredential).toHaveBeenCalledWith('u1', 'persona')
    expect(repoMock.revokeVerifiedProofs).toHaveBeenCalledWith('u1', 'identity', expect.anything())
  })
})
