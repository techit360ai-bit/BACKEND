import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(fn => fn({})),
  storeEnabled: vi.fn(() => true),
  fallbackEnabled: vi.fn(() => true),
  runVerificationRead: vi.fn(),
  applyVerificationMutation: vi.fn(),
  ensureTrustProfile: vi.fn(),
  lastReadOptions: null,
  lastWriteOptions: null,
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/verificationRepository.js', () => ({
  verificationStoreEnabled: mocks.storeEnabled,
  verificationFallbackEnabled: mocks.fallbackEnabled,
  runVerificationRead: mocks.runVerificationRead,
  applyVerificationMutation: mocks.applyVerificationMutation,
}))
vi.mock('../services/capabilityAuthorization.js', () => ({ ensureTrustProfile: mocks.ensureTrustProfile }))
vi.mock('../services/usageGrantService.js', () => ({ issueExecutionGrant: vi.fn(() => ({ ok: true, grant: { token: 'grant-token' } })) }))
vi.mock('../services/aiRouterClient.js', () => ({ analyzeVerificationEvidence: vi.fn(async () => ({ recommendation: 'strong' })) }))

const svc = await import('../services/trustVerificationService.js')

function usedBounded(db) {
  mocks.readAuthorityDb.mockReturnValue(db)
  mocks.updateAuthorityDb.mockImplementation(fn => fn(db))
  mocks.runVerificationRead.mockImplementation(async (options, read) => { mocks.lastReadOptions = options; return read() })
  mocks.applyVerificationMutation.mockImplementation(async (options, mutate) => { mocks.lastWriteOptions = options; return mutate() })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  mocks.fallbackEnabled.mockReturnValue(true)
})

describe('verification row-level store (§5 cutover)', () => {
  it('creates a verification request through the user-scoped mutation', async () => {
    usedBounded({ profiles: [{ id: 'u1' }], verificationRequests: [], verificationProfiles: [], verificationAuditLogs: [] })
    const result = await svc.requestVerificationAsync('u1', { role: 'investor' })
    expect(result.ok).toBe(true)
    expect(mocks.applyVerificationMutation).toHaveBeenCalled()
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1' })
  })

  it('reads a verification profile through the user-scoped read', async () => {
    usedBounded({ verificationProfiles: [{ id: 'vp1', userId: 'u1', role: 'investor', assurance: 'VERIFIED' }], verificationEvidence: [], verificationRequests: [] })
    const result = await svc.getVerificationProfileAsync('u1', 'investor')
    expect(result.profile.assurance).toBe('VERIFIED')
    expect(mocks.runVerificationRead).toHaveBeenCalled()
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1' })
  })

  it('submits evidence through the request-scoped mutation', async () => {
    usedBounded({ profiles: [{ id: 'u1' }], verificationRequests: [{ id: 'r1', userId: 'u1', role: 'investor', status: 'pending' }], verificationEvidence: [], verificationProfiles: [], verificationAuditLogs: [], trustProfiles: [], userRoles: [], riskProfiles: [] })
    const result = await svc.submitEvidenceAsync('u1', 'r1', { method: 'official_document' })
    expect(result.ok).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', requestId: 'r1' })
    expect(mocks.ensureTrustProfile).toHaveBeenCalled()
  })

  it('reviews a request by loading the request owner bundle', async () => {
    usedBounded({ profiles: [{ id: 'u2' }], verificationRequests: [{ id: 'r1', userId: 'u2', role: 'organization', status: 'in_review' }], verificationProfiles: [], manualReviews: [], verificationAuditLogs: [], trustProfiles: [], userRoles: [], riskProfiles: [] })
    const result = await svc.reviewVerificationAsync('admin1', 'r1', { decision: 'approve' })
    expect(result.ok).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ requestId: 'r1' })
  })

  it('creates an organization over the global organization catalog', async () => {
    usedBounded({ organizations: [], organizationDomains: [], organizationMemberships: [] })
    const result = await svc.createOrganizationAsync('u1', { name: 'Acme Capital', website: 'https://acme.example' })
    expect(result.ok).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', organizations: true })
  })

  it('adds an organization member with the addressed org + target user', async () => {
    usedBounded({ organizations: [{ id: 'o1' }], organizationMemberships: [{ id: 'm1', organizationId: 'o1', userId: 'admin1', status: 'active', role: 'owner' }], users: [{ id: 'u2' }], verificationAuditLogs: [] })
    const result = await svc.addOrganizationMemberAsync('admin1', 'o1', { userId: 'u2', role: 'member' })
    expect(result.ok).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'admin1', organizationId: 'o1', targetUserId: 'u2' })
  })

  it('updates a risk state row-level', async () => {
    usedBounded({ riskProfiles: [], verificationAuditLogs: [] })
    const result = await svc.updateRiskStateAsync('admin1', 'u1', 'HIGH', 'fraud review')
    expect(result.ok).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1' })
  })

  it('runs the reverification tick over all profiles row-level', async () => {
    const expiresAt = new Date(Date.now() + 10 * 86400000).toISOString()
    usedBounded({ verificationProfiles: [{ id: 'vp1', userId: 'u1', role: 'investor', expiresAt }], notifications: [], verificationNotificationRuns: [] })
    const result = await svc.generateReverificationNotificationsAsync()
    expect(result.ok).toBe(true)
    expect(result.created).toBe(1)
    expect(mocks.lastWriteOptions).toMatchObject({ reverification: true })
  })

  it('aggregates analytics over the global verification rows', async () => {
    usedBounded({ capabilityAnalytics: [{ capability: 'export', eventType: 'capability_allowed' }], authorizationAuditLogs: [{ id: 'a1' }], verificationRequests: [{ id: 'r1', status: 'pending' }], verificationEvidence: [{ id: 'e1' }] })
    const result = await svc.verificationAnalyticsAsync()
    expect(result.requests).toBe(1)
    expect(result.pendingReviews).toBe(1)
    expect(mocks.lastReadOptions).toMatchObject({ analytics: true })
  })

  it('falls back to the snapshot path when the row-level store is disabled', async () => {
    mocks.storeEnabled.mockReturnValue(false)
    usedBounded({ profiles: [{ id: 'u1' }], verificationRequests: [], verificationProfiles: [], verificationAuditLogs: [] })
    const result = await svc.requestVerificationAsync('u1', { role: 'investor' })
    expect(result.ok).toBe(true)
    expect(mocks.applyVerificationMutation).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).toHaveBeenCalled()
  })
})
