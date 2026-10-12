import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(),
  storeEnabled: vi.fn(() => true),
  loadOrganization: vi.fn(async () => ({ id: 'org1', name: 'Acme' })),
  actorMembership: vi.fn(async () => ({ userId: 'u1', organizationId: 'org1', role: 'owner', status: 'active' })),
  insertRow: vi.fn(async () => {}),
  findRow: vi.fn(async () => null),
  saveRow: vi.fn(async () => {}),
  listAllRows: vi.fn(async () => []),
  upsertDomain: vi.fn(async () => {}),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/registryVerificationRepository.js', () => ({
  registryStoreEnabled: mocks.storeEnabled,
  registryFallbackEnabled: () => true,
  loadOrganization: mocks.loadOrganization,
  actorMembership: mocks.actorMembership,
  insertRow: mocks.insertRow,
  findRow: mocks.findRow,
  saveRow: mocks.saveRow,
  listAllRows: mocks.listAllRows,
  upsertOrganizationDomain: mocks.upsertDomain,
}))

const { registryCheck, createDomainChallenge, verificationOperations, reviewVerificationOperation } = await import('../services/registryVerificationService.js')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  delete process.env.REGISTRY_NIGERIA_URL
  delete process.env.REGISTRY_NIGERIA_API_KEY
})

describe('registry verification row-level store (§5 cutover)', () => {
  it('records a registry check row-level without the snapshot', async () => {
    const result = await registryCheck('u1', 'org1', { country: 'Nigeria', registrationNumber: 'CAC-123' })
    expect(result.ok).toBe(true)
    expect(result.check.status).toBe('manual_review_required')
    expect(mocks.loadOrganization).toHaveBeenCalledWith('org1')
    expect(mocks.actorMembership).toHaveBeenCalledWith('u1', 'org1')
    expect(mocks.insertRow).toHaveBeenCalledWith('organizationRegistryChecks', expect.objectContaining({ organizationId: 'org1', authority: 'Corporate Affairs Commission' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('creates a domain challenge row-level', async () => {
    const result = await createDomainChallenge('u1', 'org1', { domain: 'acme.example' })
    expect(result.ok).toBe(true)
    expect(result.challenge.token).toBeTruthy()
    expect(mocks.insertRow).toHaveBeenCalledWith('organizationDomainChallenges', expect.objectContaining({ domain: 'acme.example' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('reads the admin operations view row-level with redacted secrets', async () => {
    mocks.listAllRows.mockImplementation(async name => (name === 'organizationDomainChallenges' ? [{ id: 'd1', token: 'secret' }] : []))
    const operations = await verificationOperations()
    expect(operations.registryConfigurations.length).toBeGreaterThan(0)
    expect(operations.domainChallenges[0].token).toBeUndefined()
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('records an admin review decision row-level', async () => {
    mocks.findRow.mockResolvedValue({ id: 'c1', status: 'manual_review_required', organizationId: 'org1' })
    const reviewed = await reviewVerificationOperation('admin1', 'registry', 'c1', { decision: 'verified' })
    expect(reviewed.ok).toBe(true)
    expect(reviewed.operation.status).toBe('verified')
    expect(mocks.saveRow).toHaveBeenCalledWith('organizationRegistryChecks', expect.objectContaining({ id: 'c1', status: 'verified' }))
    expect(mocks.insertRow).toHaveBeenCalledWith('manualReviews', expect.objectContaining({ operationId: 'c1', decision: 'verified' }))
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })
})
