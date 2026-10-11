import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  authorizationEnabled: vi.fn(() => true),
  loadAuthorizationSources: vi.fn(),
  dispatchPublicTrustFor: vi.fn(),
  legacyPublicTrustFor: vi.fn(),
  evaluateEntitlement: vi.fn(),
  evaluateEntitlementAsync: vi.fn(),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: vi.fn(fn => fn({})) }))
vi.mock('../repositories/authorizationRepository.js', () => ({
  authorizationEnabled: mocks.authorizationEnabled,
  loadAuthorizationSources: mocks.loadAuthorizationSources,
}))
vi.mock('../services/trustAuthority.js', () => ({ publicTrustFor: mocks.dispatchPublicTrustFor }))
vi.mock('../services/trustVerificationAuthority.js', () => ({ publicTrustFor: mocks.legacyPublicTrustFor }))
vi.mock('../services/tvceService.js', () => ({
  evaluateEntitlement: mocks.evaluateEntitlement,
  evaluateEntitlementAsync: mocks.evaluateEntitlementAsync,
}))
vi.mock('../services/organizationIntelligenceService.js', () => ({ requireOrganizationPermission: vi.fn(), organizationOverview: vi.fn(), organizationPulse: vi.fn(), organizationRisks: vi.fn() }))
vi.mock('../services/investorIntelligenceService.js', () => ({ investorIntelligenceOverview: vi.fn() }))

const svc = await import('../services/recommendationIntelligenceService.js')

const TRUST = { tier: 'Verified', verification_status: 'verified', trust_score: 82, verified_skill_count: 3 }
const ENTITLEMENT = { allowed: true, capability: 'IDEA_DIAGNOSTICS_ADVANCED', funding: 'subscription' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorizationEnabled.mockReturnValue(true)
  mocks.readDb.mockReturnValue({})
})

describe('recommendation matching access row-level store (§5 remaining controllers)', () => {
  it('resolves the caller access from owner-scoped rows without the snapshot', async () => {
    mocks.loadAuthorizationSources.mockResolvedValue({
      profiles: [{ id: 'u1', role: 'founder' }],
      subscriptions: [{ id: 's1', userId: 'u1', status: 'active', planId: 'pro' }],
      walletAccounts: [{ id: 'w1', userId: 'u1', creditBalance: 20 }],
      creditLedger: [{ id: 'l1', userId: 'u1', deltaCredits: 40 }],
    })
    mocks.dispatchPublicTrustFor.mockResolvedValue(TRUST)
    mocks.evaluateEntitlementAsync.mockResolvedValue(ENTITLEMENT)

    const result = await svc.matchingAccessAsync('u1')

    expect(mocks.loadAuthorizationSources).toHaveBeenCalledWith('u1', ['subscriptions', 'walletAccounts', 'creditLedger'])
    expect(mocks.dispatchPublicTrustFor).toHaveBeenCalledWith('u1', null)
    expect(mocks.evaluateEntitlementAsync).toHaveBeenCalledWith('u1', { capability: 'IDEA_DIAGNOSTICS_ADVANCED', role: 'founder' })
    expect(result).toMatchObject({ ok: true, role: 'founder', visibility: 'verified' })
    expect(result.funding).toMatchObject({ subscriptionActive: true, plan: 'pro', credits: 40, capabilityAllowed: true, fundingSource: 'subscription' })
    expect(result.verification).toMatchObject({ tier: 'Verified', status: 'verified', score: 82, verifiedSkills: 3 })
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('derives the capability from the requested role when the profile has none', async () => {
    mocks.loadAuthorizationSources.mockResolvedValue({ profiles: [], subscriptions: [], walletAccounts: [], creditLedger: [] })
    mocks.dispatchPublicTrustFor.mockResolvedValue({ tier: 'Claimed', verification_status: 'unverified', trust_score: 10, verified_skill_count: 0 })
    mocks.evaluateEntitlementAsync.mockResolvedValue({ allowed: false, capability: 'INVESTOR_INTELLIGENCE', funding: 'none' })

    const result = await svc.matchingAccessAsync('u2', 'investor')

    expect(result.role).toBe('investor')
    expect(result.funding.capability).toBe('INVESTOR_INTELLIGENCE')
    expect(mocks.evaluateEntitlementAsync).toHaveBeenCalledWith('u2', { capability: 'INVESTOR_INTELLIGENCE', role: 'investor' })
  })

  it('falls back to the snapshot path when the authorization store is disabled', async () => {
    mocks.authorizationEnabled.mockReturnValue(false)
    mocks.readDb.mockReturnValue({ profiles: [{ id: 'u3', role: 'collaborator' }], subscriptions: [], walletAccounts: [], creditLedger: [] })
    mocks.legacyPublicTrustFor.mockReturnValue(TRUST)
    mocks.evaluateEntitlement.mockReturnValue(ENTITLEMENT)

    const result = await svc.matchingAccessAsync('u3')

    expect(result.role).toBe('collaborator')
    expect(mocks.loadAuthorizationSources).not.toHaveBeenCalled()
    expect(mocks.readDb).toHaveBeenCalled()
  })

  it('falls back to the snapshot path when the row-level read fails', async () => {
    mocks.loadAuthorizationSources.mockRejectedValue(new Error('pool offline'))
    mocks.readDb.mockReturnValue({ profiles: [{ id: 'u4', role: 'founder' }], subscriptions: [], walletAccounts: [], creditLedger: [] })
    mocks.legacyPublicTrustFor.mockReturnValue(TRUST)
    mocks.evaluateEntitlement.mockReturnValue(ENTITLEMENT)

    const result = await svc.matchingAccessAsync('u4')

    expect(result.ok).toBe(true)
    expect(mocks.readDb).toHaveBeenCalled()
  })
})
