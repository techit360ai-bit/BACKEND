import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { repoMock, appendTrustProofMock } = vi.hoisted(() => {
  const mock = {
    listProofs: vi.fn(async () => []),
    insertTeamSnapshot: vi.fn(async entry => entry),
    latestTeamSnapshot: vi.fn(async () => null),
    insertWorkEmailChallenge: vi.fn(async entry => entry),
    getWorkEmailChallenge: vi.fn(),
    latestWorkEmailChallenge: vi.fn(async () => null),
    updateWorkEmailChallenge: vi.fn(async (id, patch) => ({ id, ...patch })),
    withTrustTransaction: vi.fn(async fn => fn({})),
    upsertCredential: vi.fn(async entry => entry),
    listActiveCredentials: vi.fn(async () => []),
    getActiveCredential: vi.fn(async () => null),
    revokeCredential: vi.fn(async () => ({})),
    revokeVerifiedProofs: vi.fn(async () => []),
    insertHistory: vi.fn(async entry => entry),
    markCredentialSynced: vi.fn(async () => ({})),
    recordAnomaly: vi.fn(async entry => entry),
    listCredentialsDueForSync: vi.fn(async () => []),
  }
  return { repoMock: mock, appendTrustProofMock: vi.fn(async () => ({ ok: true, proof: { id: 'proof-1' }, profile: { trustScore: 50 } })) }
})

vi.mock('../repositories/trustRepository.js', () => repoMock)
vi.mock('../services/trustAuthority.js', () => ({ appendTrustProof: appendTrustProofMock }))

const {
  connectTeamSource,
  disconnectTeamSource,
  hashWorkEmailCode,
  listTeamCredentials,
  requestWorkEmailChallenge,
  runTeamRefresh,
  verifyHrisSource,
  verifyRegistrySource,
  verifyWorkEmailChallenge,
} = await import('../services/trustTeamService.js')
const { encryptCredential } = await import('../services/trustCredentialVault.js')

const KEY = 'k'.repeat(48)
const baseEnv = () => ({
  TRUST_CREDENTIAL_ENCRYPTION_KEY: KEY,
  TRUST_TEAM_ENABLED: 'true',
  TRUST_TEAM_OTP_DEV_MODE: 'true',
  TRUST_TEAM_OTP_HASH_SECRET: 'otp-secret',
  TRUST_TEAM_REGISTRY_PROVIDERS: 'opencorporates',
  TRUST_TEAM_HRIS_PROVIDERS: 'gusto',
})
const verifiedDomainProof = { source: 'domain', status: 'verified', expiresAt: null, metadata: { domain: 'acme.com' } }
const future = () => new Date(Date.now() + 600000).toISOString()

const registryFetch = vi.fn(async url => {
  const value = String(url)
  if (value.includes('/officers')) return { ok: true, status: 200, json: async () => ({ results: { officers: [{ officer: { name: 'Jane Doe', position: 'Director' } }] } }) }
  return { ok: true, status: 200, json: async () => ({ results: { company: { name: 'Acme Ltd', company_number: '123', jurisdiction_code: 'gb', current_status: 'Active' } } }) }
})
const hrisFetch = (count = 3) => vi.fn(async () => ({ ok: true, status: 200, json: async () => Array.from({ length: count }, () => ({ role: 'Engineer' })) }))

beforeEach(() => {
  process.env.TRUST_WRITE_SOURCE = 'postgres'
  for (const fn of Object.values(repoMock)) fn.mockReset?.()
  repoMock.withTrustTransaction.mockImplementation(async handler => handler({}))
  repoMock.listProofs.mockResolvedValue([])
  repoMock.latestTeamSnapshot.mockResolvedValue(null)
  repoMock.latestWorkEmailChallenge.mockResolvedValue(null)
  repoMock.getActiveCredential.mockResolvedValue(null)
  repoMock.getWorkEmailChallenge.mockResolvedValue(null)
  repoMock.revokeVerifiedProofs.mockResolvedValue([])
  repoMock.upsertCredential.mockImplementation(async entry => entry)
  appendTrustProofMock.mockReset()
  appendTrustProofMock.mockResolvedValue({ ok: true, proof: { id: 'proof-1' }, profile: { trustScore: 50 } })
})

afterEach(() => {
  delete process.env.TRUST_WRITE_SOURCE
})

describe('connectTeamSource', () => {
  it('stores a founder registry credential encrypted and never returns the secret', async () => {
    const env = baseEnv()
    const result = await connectTeamSource('u1', { kind: 'registry', provider: 'opencorporates', credential: 'oc-secret', companyNumber: 'gb/123' }, { env })
    expect(result.ok).toBe(true)
    expect(result.credential).toMatchObject({ provider: 'opencorporates', stored: true, secret_stored: false })
    expect(JSON.stringify(result)).not.toContain('oc-secret')
    const stored = repoMock.upsertCredential.mock.calls[0][0]
    expect(stored.encryptedPayload).not.toContain('oc-secret')
    expect(stored.source).toBe('team')
    expect(stored.subject).toBe('gb/123')
  })

  it('keeps team coming soon while disabled and rejects unsupported providers', async () => {
    const disabled = await connectTeamSource('u1', { kind: 'registry', provider: 'opencorporates', credential: 'x' }, { env: { TRUST_CREDENTIAL_ENCRYPTION_KEY: KEY } })
    expect(disabled.status).toBe(409)
    expect(disabled.reason).toBe('feature_disabled')
    expect((await connectTeamSource('u1', { kind: 'registry', provider: 'nope', credential: 'x' }, { env: baseEnv() })).error).toBe('unsupported_registry_provider')
  })

  it('requires the postgres authority and a configured vault', async () => {
    delete process.env.TRUST_WRITE_SOURCE
    expect((await connectTeamSource('u1', { kind: 'hris', provider: 'gusto', credential: 'x' }, { env: baseEnv() })).error).toBe('team_requires_postgres_authority')
    process.env.TRUST_WRITE_SOURCE = 'postgres'
    const env = { TRUST_TEAM_ENABLED: 'true', TRUST_TEAM_HRIS_PROVIDERS: 'gusto' }
    expect((await connectTeamSource('u1', { kind: 'hris', provider: 'gusto', credential: 'x' }, { env })).error).toBe('credential_vault_not_configured')
  })
})

describe('work-email OTP', () => {
  it('refuses to issue a challenge for a domain the founder has not verified', async () => {
    const result = await requestWorkEmailChallenge('u1', { email: 'jane@acme.com' }, { env: baseEnv() })
    expect(result.status).toBe(422)
    expect(result.error).toBe('work_email_domain_not_verified')
    expect(repoMock.insertWorkEmailChallenge).not.toHaveBeenCalled()
  })

  it('issues a hashed challenge and returns the dev code only in dev mode', async () => {
    repoMock.listProofs.mockResolvedValue([verifiedDomainProof])
    const result = await requestWorkEmailChallenge('u1', { email: 'jane@acme.com', role: 'cto' }, { env: baseEnv() })
    expect(result.ok).toBe(true)
    expect(result.challenge).toMatchObject({ email_domain: 'acme.com', role: 'cto', status: 'pending', max_attempts: 5 })
    expect(result.dev_code).toMatch(/^\d{6}$/)
    const stored = repoMock.insertWorkEmailChallenge.mock.calls[0][0]
    expect(stored.tokenHash).not.toBe(result.dev_code)
    expect(stored.tokenHash).toBe(hashWorkEmailCode(result.dev_code, stored.id, baseEnv()))
  })

  it('enforces the resend cooldown on a pending challenge', async () => {
    repoMock.listProofs.mockResolvedValue([verifiedDomainProof])
    repoMock.latestWorkEmailChallenge.mockResolvedValue({ status: 'pending', createdAt: new Date().toISOString() })
    const result = await requestWorkEmailChallenge('u1', { email: 'jane@acme.com' }, { env: baseEnv() })
    expect(result.status).toBe(429)
    expect(result.error).toBe('work_email_resend_too_soon')
  })

  it('verifies the code and mints a provider-observed team proof', async () => {
    const env = baseEnv()
    repoMock.listProofs.mockResolvedValue([verifiedDomainProof])
    repoMock.getWorkEmailChallenge.mockResolvedValue({ id: 'ch1', userId: 'u1', emailDomain: 'acme.com', role: 'cto', status: 'pending', attempts: 0, maxAttempts: 5, expiresAt: future(), tokenHash: hashWorkEmailCode('123456', 'ch1', env) })
    const result = await verifyWorkEmailChallenge('u1', { challengeId: 'ch1', code: '123456' }, { env })
    expect(result.ok).toBe(true)
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input).toMatchObject({ source: 'team', status: 'verified', method: 'work_email_otp', attestationLevel: 'provider_observed', correlationGroup: 'org' })
    expect(input.metadata).toMatchObject({ provider: 'work_email', emailDomain: 'acme.com', workEmailVerified: true, verifiedCount: 1 })
    expect(repoMock.updateWorkEmailChallenge).toHaveBeenCalledWith('ch1', expect.objectContaining({ status: 'verified' }))
  })

  it('increments attempts on a wrong code without minting a proof', async () => {
    const env = baseEnv()
    repoMock.getWorkEmailChallenge.mockResolvedValue({ id: 'ch1', userId: 'u1', emailDomain: 'acme.com', status: 'pending', attempts: 0, maxAttempts: 5, expiresAt: future(), tokenHash: hashWorkEmailCode('123456', 'ch1', env) })
    const result = await verifyWorkEmailChallenge('u1', { challengeId: 'ch1', code: '000000' }, { env })
    expect(result.status).toBe(401)
    expect(result.error).toBe('work_email_code_invalid')
    expect(repoMock.updateWorkEmailChallenge).toHaveBeenCalledWith('ch1', expect.objectContaining({ attempts: 1 }))
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })

  it('re-checks the verified domain at verification time', async () => {
    const env = baseEnv()
    repoMock.getWorkEmailChallenge.mockResolvedValue({ id: 'ch1', userId: 'u1', emailDomain: 'acme.com', status: 'pending', attempts: 0, maxAttempts: 5, expiresAt: future(), tokenHash: hashWorkEmailCode('123456', 'ch1', env) })
    const result = await verifyWorkEmailChallenge('u1', { challengeId: 'ch1', code: '123456' }, { env })
    expect(result.status).toBe(422)
    expect(result.error).toBe('work_email_domain_not_verified')
  })
})

describe('verifyRegistrySource', () => {
  it('mints a provider-observed organization proof when the founder is a listed officer', async () => {
    const env = baseEnv()
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'opencorporates', source: 'team', scopes: ['read_only'], createdAt: 'c', subject: 'gb/123', encryptedPayload: encryptCredential('oc-secret', { env }) })
    const result = await verifyRegistrySource('u1', 'opencorporates', { founderName: 'Jane Doe' }, { env, fetchImpl: registryFetch })
    expect(result.ok).toBe(true)
    expect(result.entity.companyNumber).toBe('123')
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input).toMatchObject({ source: 'organization', status: 'verified', method: 'opencorporates_registry', attestationLevel: 'provider_observed', correlationGroup: 'org', providerSubjectId: 'gb/123' })
    expect(input.metadata).toMatchObject({ provider: 'opencorporates', entityName: 'Acme Ltd', officerVerified: true, credentialSource: 'founder' })
    expect(repoMock.insertTeamSnapshot).toHaveBeenCalled()
  })

  it('records an anomaly and refuses a proof when the founder is not an officer', async () => {
    const env = baseEnv()
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-1', provider: 'opencorporates', source: 'team', scopes: [], createdAt: 'c', subject: 'gb/123', encryptedPayload: encryptCredential('oc-secret', { env }) })
    const result = await verifyRegistrySource('u1', 'opencorporates', { founderName: 'Nobody Else' }, { env, fetchImpl: registryFetch })
    expect(result.status).toBe(422)
    expect(result.error).toBe('registry_officer_not_found')
    expect(repoMock.recordAnomaly).toHaveBeenCalled()
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })

  it('falls back to the platform credential without attaching a shared subject', async () => {
    const env = { ...baseEnv(), OPENCORPORATES_API_KEY: 'platform-token' }
    const result = await verifyRegistrySource('u1', 'opencorporates', { founderName: 'Jane Doe', companyNumber: 'gb/123' }, { env, fetchImpl: registryFetch })
    expect(result.ok).toBe(true)
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input.providerSubjectId).toBeNull()
    expect(input.metadata.credentialSource).toBe('platform')
  })

  it('requires a connected credential when no platform token exists', async () => {
    const result = await verifyRegistrySource('u1', 'opencorporates', {}, { env: baseEnv(), fetchImpl: registryFetch })
    expect(result.error).toBe('team_credential_not_connected')
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })
})

describe('verifyHrisSource', () => {
  it('mints a provider-observed organization proof from aggregate headcount only', async () => {
    const env = baseEnv()
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-2', provider: 'gusto', source: 'team', scopes: ['read_only'], createdAt: 'c', subject: 'c1', encryptedPayload: encryptCredential('gusto-secret', { env }) })
    const result = await verifyHrisSource('u1', 'gusto', { env, fetchImpl: hrisFetch(3) })
    expect(result.ok).toBe(true)
    expect(result.headcount).toBe(3)
    const input = appendTrustProofMock.mock.calls[0][1]
    expect(input).toMatchObject({ source: 'team', status: 'verified', method: 'gusto_hris', attestationLevel: 'provider_observed', correlationGroup: 'org' })
    expect(input.metadata).toMatchObject({ provider: 'gusto', headcount: 3, verifiedCount: 3, credentialSource: 'founder' })
    expect(JSON.stringify(input.metadata)).not.toContain('workEmail')
  })

  it('enforces the minimum headcount threshold', async () => {
    const env = { ...baseEnv(), TRUST_TEAM_MIN_HEADCOUNT: '5' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-2', provider: 'gusto', source: 'team', scopes: [], createdAt: 'c', subject: 'c1', encryptedPayload: encryptCredential('gusto-secret', { env }) })
    const result = await verifyHrisSource('u1', 'gusto', { env, fetchImpl: hrisFetch(2) })
    expect(result.error).toBe('team_below_threshold')
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })

  it('flags implausible headcount growth against the previous snapshot', async () => {
    const env = { ...baseEnv(), TRUST_TEAM_MAX_HEADCOUNT_JUMP_RATIO: '2' }
    repoMock.getActiveCredential.mockResolvedValue({ id: 'cred-2', provider: 'gusto', source: 'team', scopes: [], createdAt: 'c', subject: 'c1', encryptedPayload: encryptCredential('gusto-secret', { env }) })
    repoMock.latestTeamSnapshot.mockResolvedValue({ headcount: 2 })
    const result = await verifyHrisSource('u1', 'gusto', { env, fetchImpl: hrisFetch(20) })
    expect(result.error).toBe('team_implausible_growth')
    expect(repoMock.recordAnomaly).toHaveBeenCalled()
    expect(appendTrustProofMock).not.toHaveBeenCalled()
  })
})

describe('disconnect + refresh', () => {
  it('revokes the credential and both team and organization proofs', async () => {
    repoMock.revokeVerifiedProofs.mockResolvedValue([{ id: 'p1', projectId: null, confidence: 0.9, evidenceHash: 'h', expiresAt: null }])
    const result = await disconnectTeamSource('u1', 'opencorporates')
    expect(result).toMatchObject({ ok: true, provider: 'opencorporates', status: 'disconnected' })
    expect(repoMock.revokeCredential).toHaveBeenCalledWith('u1', 'opencorporates')
    expect(repoMock.revokeVerifiedProofs).toHaveBeenCalledWith('u1', 'team', expect.anything())
    expect(repoMock.revokeVerifiedProofs).toHaveBeenCalledWith('u1', 'organization', expect.anything())
  })

  it('skips the refresh when disabled or off the postgres authority', async () => {
    expect((await runTeamRefresh({ env: { TRUST_TEAM_ENABLED: 'false' } })).skipped).toBe('team_disabled')
    delete process.env.TRUST_WRITE_SOURCE
    expect((await runTeamRefresh({ env: baseEnv() })).skipped).toBe('team_requires_postgres_authority')
  })

  it('lists only team credentials', async () => {
    repoMock.listActiveCredentials.mockResolvedValue([{ source: 'team', provider: 'gusto', scopes: [], createdAt: 'c', lastSyncedAt: null }, { source: 'shipping', provider: 'vercel', scopes: [], createdAt: 'c' }])
    const result = await listTeamCredentials('u1')
    expect(result.credentials).toHaveLength(1)
    expect(result.credentials[0].provider).toBe('gusto')
  })
})
