import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(fn => fn({})),
  storeEnabled: vi.fn(() => true),
  fallbackEnabled: vi.fn(() => true),
  runRecommendationRead: vi.fn(),
  applyRecommendationMutation: vi.fn(),
  authorizationEnabled: vi.fn(() => true),
  loadAuthorizationSources: vi.fn(async userId => ({ profiles: [{ id: userId, role: 'collaborator' }], subscriptions: [], walletAccounts: [], creditLedger: [] })),
  dispatchPublicTrustFor: vi.fn(async () => ({ tier: 'Verified', verification_status: 'verified', trust_score: 80, verified_skill_count: 2 })),
  evaluateEntitlementAsync: vi.fn(async () => ({ capability: 'IDEA_DIAGNOSTICS_ADVANCED', allowed: true, funding: 'none' })),
  requireOrganizationPermissionAsync: vi.fn(async () => ({ ok: true, organizationId: 'o1', role: 'owner' })),
  overviewAsync: vi.fn(async () => ({ ok: true, health: { score: 72 } })),
  pulseAsync: vi.fn(async () => ({ activity: [{ message: 'sprint shipped' }] })),
  risksAsync: vi.fn(async () => ({ risks: [{ type: 'stalled' }] })),
  investorOverviewFrom: vi.fn(() => ({ startups: [{ startupId: 'p1', executionVelocity: 40, readiness: 60, riskLevel: 'moderate', evidence: [] }] })),
  lastReadOptions: null,
  lastWriteOptions: null,
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb, runBoundedDatabase: (_db, fn) => fn() }))
vi.mock('../repositories/recommendationRepository.js', () => ({
  recommendationStoreEnabled: mocks.storeEnabled,
  recommendationFallbackEnabled: mocks.fallbackEnabled,
  runRecommendationRead: mocks.runRecommendationRead,
  applyRecommendationMutation: mocks.applyRecommendationMutation,
}))
vi.mock('../repositories/authorizationRepository.js', () => ({ authorizationEnabled: mocks.authorizationEnabled, loadAuthorizationSources: mocks.loadAuthorizationSources }))
vi.mock('../services/trustAuthority.js', () => ({ publicTrustFor: mocks.dispatchPublicTrustFor }))
vi.mock('../services/trustVerificationAuthority.js', () => ({ publicTrustFor: vi.fn(() => ({ tier: 'Claimed' })) }))
vi.mock('../services/tvceService.js', () => ({ evaluateEntitlement: vi.fn(() => ({ allowed: false })), evaluateEntitlementAsync: mocks.evaluateEntitlementAsync }))
vi.mock('../services/organizationIntelligenceService.js', () => ({
  requireOrganizationPermission: vi.fn(() => ({ ok: false, error: 'forbidden' })),
  requireOrganizationPermissionAsync: mocks.requireOrganizationPermissionAsync,
  organizationOverview: vi.fn(() => ({ ok: false })),
  organizationPulse: vi.fn(() => ({})),
  organizationRisks: vi.fn(() => ({ risks: [] })),
  organizationOverviewAsync: mocks.overviewAsync,
  organizationPulseAsync: mocks.pulseAsync,
  organizationRisksAsync: mocks.risksAsync,
}))
vi.mock('../services/investorIntelligenceService.js', () => ({ investorIntelligenceOverview: vi.fn(() => ({ startups: [] })), investorIntelligenceOverviewFrom: mocks.investorOverviewFrom }))

const svc = await import('../services/recommendationIntelligenceService.js')

function usedBounded(db) {
  mocks.readAuthorityDb.mockReturnValue(db)
  mocks.updateAuthorityDb.mockImplementation(fn => fn(db))
  mocks.runRecommendationRead.mockImplementation(async (options, read) => { mocks.lastReadOptions = options; return read() })
  mocks.applyRecommendationMutation.mockImplementation(async (options, mutate) => { mocks.lastWriteOptions = options; return mutate() })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  mocks.fallbackEnabled.mockReturnValue(true)
  mocks.authorizationEnabled.mockReturnValue(true)
  mocks.requireOrganizationPermissionAsync.mockResolvedValue({ ok: true, organizationId: 'o1', role: 'owner' })
})

describe('recommendation row-level store (§5)', () => {
  it('ranks collaborators from the bounded bundle', async () => {
    usedBounded({
      profiles: [{ id: 'u1', role: 'collaborator', skills: ['react'] }, { id: 'u2', role: 'collaborator', skills: ['react', 'node'], executionScore: 80 }],
      projects: [], workspaceMembers: [], milestones: [], projectActivities: [], startupActivities: [], mentorshipRooms: [], mentorshipMentees: [], mentorshipTasks: [], mentorshipApplications: [], organizationMemberships: [], executionScores: [], workspaceTasks: [], recommendationEvents: [], investments: [], portfolioInvestments: [], investorPortfolio: [], investorRelationships: [], investorWatchlists: [], dealRooms: [], dataRooms: [], dealFlowSnapshots: [], investorIntelligenceSnapshots: [], investorIntelligenceAudits: [],
    })
    const result = await svc.collaboratorRecommendationsAsync('u1', { requiredSkills: 'react' })
    expect(result.ok).toBe(true)
    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0].collaborator.id).toBe('u2')
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1' })
  })

  it('404s founder collaborator recommendations when the project is not owned', async () => {
    usedBounded({ profiles: [{ id: 'u1', role: 'founder' }], projects: [], workspaceMembers: [], milestones: [], projectActivities: [], startupActivities: [], mentorshipRooms: [], mentorshipMentees: [], mentorshipTasks: [], mentorshipApplications: [], organizationMemberships: [], executionScores: [], workspaceTasks: [], recommendationEvents: [], investments: [], portfolioInvestments: [], investorPortfolio: [], investorRelationships: [], investorWatchlists: [], dealRooms: [], dataRooms: [], dealFlowSnapshots: [], investorIntelligenceSnapshots: [], investorIntelligenceAudits: [] })
    const result = await svc.founderCollaboratorRecommendationsAsync('u1', 'p9')
    expect(result).toMatchObject({ ok: false, status: 404, error: 'project_not_found' })
  })

  it('builds organization talent matches with the async permission context', async () => {
    usedBounded({ profiles: [{ id: 'u1', role: 'owner', skills: ['ops'] }, { id: 'u3', role: 'founder', skills: ['growth'] }], projects: [{ id: 'p1', organizationId: 'o1', industry: 'fintech', missingSkills: ['growth'] }], workspaceMembers: [], milestones: [], projectActivities: [], startupActivities: [], mentorshipRooms: [], mentorshipMentees: [], mentorshipTasks: [], mentorshipApplications: [], organizationMemberships: [{ id: 'm1', organizationId: 'o1', userId: 'u1', status: 'active' }], executionScores: [], workspaceTasks: [], recommendationEvents: [], investments: [], portfolioInvestments: [], investorPortfolio: [], investorRelationships: [], investorWatchlists: [], dealRooms: [], dataRooms: [], dealFlowSnapshots: [], investorIntelligenceSnapshots: [], investorIntelligenceAudits: [] })
    const result = await svc.organizationTalentRecommendationsAsync('u1', { organizationId: 'o1' })
    expect(result.ok).toBe(true)
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', organizationId: 'o1' })
    expect(result.recommendations.some(row => row.person.id === 'u3')).toBe(true)
  })

  it('writes the continuous-intelligence snapshot through the bounded mutation', async () => {
    usedBounded({ profiles: [{ id: 'u1', role: 'founder' }], projects: [{ id: 'p1', ownerId: 'u1', stage: 'seed', updatedAt: new Date().toISOString() }], workspaceMembers: [], milestones: [], projectActivities: [], startupActivities: [], mentorshipRooms: [], mentorshipMentees: [], mentorshipTasks: [], mentorshipApplications: [], organizationMemberships: [], executionScores: [], workspaceTasks: [], recommendationEvents: [], investments: [], portfolioInvestments: [], investorPortfolio: [], investorRelationships: [], investorWatchlists: [], dealRooms: [], dataRooms: [], dealFlowSnapshots: [], investorIntelligenceSnapshots: [], investorIntelligenceAudits: [], continuousIntelligenceSnapshots: [] })
    const result = await svc.continuousIntelligenceAsync('u1', { role: 'founder' })
    expect(result.ok).toBe(true)
    expect(result.intelligence.role).toBe('founder')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1' })
  })

  it('falls back to the snapshot path when the store is disabled', async () => {
    mocks.storeEnabled.mockReturnValue(false)
    const db = { profiles: [{ id: 'u1', role: 'collaborator' }, { id: 'u2', role: 'collaborator' }], subscriptions: [], walletAccounts: [], creditLedger: [] }
    mocks.readAuthorityDb.mockReturnValue(db)
    const result = await svc.collaboratorRecommendationsAsync('u1')
    expect(result.ok).toBe(true)
    expect(mocks.runRecommendationRead).not.toHaveBeenCalled()
  })
})
