import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(fn => fn({})),
  storeEnabled: vi.fn(() => true),
  fallbackEnabled: vi.fn(() => true),
  runDomainRead: vi.fn(),
  applyDomainMutation: vi.fn(),
  lastReadOptions: null,
  lastWriteOptions: null,
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/domainRepository.js', () => ({
  domainStoreEnabled: mocks.storeEnabled,
  domainFallbackEnabled: mocks.fallbackEnabled,
  runDomainRead: mocks.runDomainRead,
  applyDomainMutation: mocks.applyDomainMutation,
}))
vi.mock('../services/discoveryService.js', () => ({ appendPlatformEventInDb: vi.fn(), appendRelationshipInDb: vi.fn() }))
vi.mock('../services/aiRouterClient.js', () => ({ computeGsisNarrative: vi.fn(async () => null), extractRecommendation: vi.fn(async () => null) }))
vi.mock('../services/organizationIntelligenceService.js', () => ({ organizationOverview: vi.fn(), requireOrganizationPermission: vi.fn() }))
vi.mock('../services/organizationEntitlementService.js', () => ({ evaluateOrganizationEntitlement: vi.fn(() => ({ allowed: true })) }))
vi.mock('../repositories/workspaceProjectRepository.js', () => ({ listProjects: vi.fn(async () => []), listWorkspaces: vi.fn(async () => []), findWorkspace: vi.fn(async () => null), listMembers: vi.fn(async () => []), workspaceReadEnabled: vi.fn(() => false), workspaceReadFallbackEnabled: vi.fn(() => true) }))
vi.mock('../repositories/financeRepository.js', () => ({ walletSummary: vi.fn(async () => ({})), walletCollection: vi.fn(async () => []), financeReadEnabled: vi.fn(() => false), financeReadFallbackEnabled: vi.fn(() => true) }))
vi.mock('../services/financePostgresProjection.js', () => ({ syncFinanceProjection: vi.fn(async () => {}) }))

const svc = await import('../services/domainService.js')

function usedBounded(db) {
  mocks.readDb.mockReturnValue(db)
  mocks.updateDb.mockImplementation(fn => fn(db))
  mocks.runDomainRead.mockImplementation(async (options, read) => { mocks.lastReadOptions = options; return read() })
  mocks.applyDomainMutation.mockImplementation(async (options, mutate) => { mocks.lastWriteOptions = options; return mutate() })
}

const base = () => ({ profiles: [], users: [], projects: [], endorsements: [], investorWatchlists: [], investorWatchlistPreferences: [], dealFlowSnapshots: [] })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  mocks.fallbackEnabled.mockReturnValue(true)
})

describe('domain row-level store — endorsements + investor (§5 sub-slice 1)', () => {
  it('lists received endorsements through the endorsement-scoped read', async () => {
    usedBounded({ ...base(), endorsements: [{ id: 'e1', subjectId: 'u1', authorId: 'u2', quote: 'Great' }], profiles: [{ id: 'u2', firstName: 'Ada', lastName: 'Lovelace' }] })
    const result = await svc.listEndorsementsAsync('u1')
    expect(result.endorsements).toHaveLength(1)
    expect(result.endorsements[0].authorName).toBe('Ada Lovelace')
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', endorsements: true })
  })

  it('creates an endorsement with the subject + project hints', async () => {
    usedBounded({ ...base(), users: [{ id: 'u2' }], profiles: [{ id: 'u1', firstName: 'Me' }], projects: [{ id: 'p1', ownerId: 'u2', title: 'FinPay' }] })
    const result = await svc.createEndorsementAsync('u1', { subjectUserId: 'u2', quote: 'Ships fast', projectId: 'p1' })
    expect(result.ok).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', endorsements: true, subjectUserId: 'u2', projectIds: ['p1'] })
  })

  it('builds the investor deal flow from the caller watchlist + snapshots', async () => {
    usedBounded({ ...base(), investorWatchlists: [{ id: 'w1', investorId: 'u1', projectId: 'p1' }], dealFlowSnapshots: [{ id: 's1', investorId: 'u1', projectId: 'p1', rankScore: 1 }], projects: [{ id: 'p1', title: 'FinPay' }] })
    const result = await svc.investorDealFlowAsync('u1')
    expect(result.ranking).toHaveLength(1)
    expect(result.ranking[0].watchlisted).toBe(true)
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', investor: true })
  })

  it('adds and removes a watchlist entry through the investor-scoped mutation', async () => {
    usedBounded({ ...base(), investorWatchlists: [] })
    const added = await svc.addWatchlistAsync('u1', { projectId: 'p1' })
    expect(added.ok).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', investor: true })

    usedBounded({ ...base(), investorWatchlists: [{ id: 'w1', investorId: 'u1', projectId: 'p1' }] })
    const removed = await svc.removeWatchlistAsync('u1', 'p1')
    expect(removed.ok).toBe(true)
  })

  it('reads and writes watchlist preferences', async () => {
    usedBounded({ ...base(), investorWatchlistPreferences: [] })
    const defaults = await svc.listWatchlistPreferencesAsync('u1')
    expect(defaults.preferences.velocity).toBe(true)

    usedBounded({ ...base(), investorWatchlistPreferences: [] })
    const updated = await svc.updateWatchlistPreferencesAsync('u1', { trust: true })
    expect(updated.preferences.trust).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', investor: true })
  })

  it('lists a bound investor collection through the collection scope', async () => {
    usedBounded({ ...base(), capitalPools: [{ id: 'c1', investorId: 'u1', name: 'Fund I' }] })
    const result = await svc.investorCollectionAsync('u1', 'capitalPools')
    expect(result).toHaveLength(1)
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', collections: [{ name: 'capitalPools', field: 'investorId' }] })
  })

  it('falls back to the snapshot path when the row-level store is disabled', async () => {
    mocks.storeEnabled.mockReturnValue(false)
    usedBounded({ ...base(), endorsements: [{ id: 'e1', subjectId: 'u1', authorId: 'u2', quote: 'Great' }], profiles: [{ id: 'u2', firstName: 'Ada' }] })
    const result = await svc.listEndorsementsAsync('u1')
    expect(result.endorsements).toHaveLength(1)
    expect(mocks.runDomainRead).not.toHaveBeenCalled()
    expect(mocks.readDb).toHaveBeenCalled()
  })
})

const orgProject = { id: 'p1', organizationId: 'org1', title: 'FinPay', industry: 'FinTech', stage: 'launch', gsisScore: 82, marketReadyScore: 70, mrr: 500, progress: 60, memberCount: 4, hasWorkspace: true }

describe('domain row-level store — organization intelligence (§5 sub-slice 2)', () => {
  it('lists organization projects through the org scope', async () => {
    usedBounded({ projects: [orgProject] })
    const result = await svc.listOrganizationProjectsAsync('org1')
    expect(result.projects).toHaveLength(1)
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'org1', organization: true })
  })

  it('creates an organization project through the org-scoped mutation', async () => {
    usedBounded({ projects: [] })
    const result = await svc.createOrganizationProjectAsync('org1', { title: 'Acme', stage: 'idea' })
    expect(result.project.title).toBe('Acme')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'org1', organization: true })
  })

  it('derives cohort health from the org projects', async () => {
    usedBounded({ projects: [orgProject] })
    const result = await svc.organizationCohortHealthAsync('org1')
    expect(result.summary.total).toBe(1)
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'org1', organization: true })
  })

  it('derives impact metrics from the org projects', async () => {
    usedBounded({ projects: [orgProject] })
    const result = await svc.organizationImpactAsync('org1', { template: 'quarterly' })
    expect(result.metrics.startups).toBe(1)
    expect(result.metrics.totalMrr).toBe(500)
  })

  it('persists an organization KPI target', async () => {
    usedBounded({ orgKpiTargets: [] })
    const result = await svc.saveOrganizationKpiTargetAsync('org1', { metric: 'mrr', target: 1000 })
    expect(result.ok).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'org1', organization: true })
  })

  it('publishes an organization project to deal flow', async () => {
    usedBounded({ projects: [orgProject], dealFlowSnapshots: [] })
    const result = await svc.publishOrganizationProjectAsync('org1', { projectId: 'p1' })
    expect(result.ok).toBe(true)
    expect(result.snapshotId).toBeTruthy()
  })

  it('reads the demo-day pipeline and analytics', async () => {
    usedBounded({ projects: [orgProject], dealFlowSnapshots: [{ id: 's1', organizationId: 'org1', projectId: 'p1', startupName: 'FinPay' }], investorWatchlists: [{ id: 'w1', investorId: 'inv1', projectId: 'p1' }] })
    const pipeline = await svc.demoDayPipelineAsync('org1')
    expect(pipeline.pipeline).toHaveLength(1)
    const analytics = await svc.organizationDemoDayAnalyticsAsync('org1')
    expect(analytics.publishedCount).toBe(1)
    expect(analytics.totalWatchlisted).toBe(1)
  })

  it('matches investors from the bounded investor profile window', async () => {
    usedBounded({ projects: [orgProject], profiles: [{ id: 'inv1', role: 'investor', industries: ['FinTech'], stagePreference: 'launch', checkSize: 25000 }] })
    const result = await svc.investorMatchesAsync('org1', 'p1')
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0].investorId).toBe('inv1')
  })

  it('renders the organization dashboard from the owner-scoped fallback rows', async () => {
    usedBounded({ organizationDashboards: [{ id: 'd1', ownerId: 'org1', metrics: { activePrograms: 2 } }], hackathons: [{ id: 'h1', ownerId: 'org1' }] })
    const result = await svc.organizationDashboardAsync('org1')
    expect(result.dashboard.id).toBe('d1')
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'org1', organization: true })
  })
})
