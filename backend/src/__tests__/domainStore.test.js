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

describe('domain row-level store — hackathons (§5 sub-slice 3)', () => {
  it('lists visible hackathons with counts through the hackathon scope', async () => {
    usedBounded({ hackathons: [{ id: 'h1', visibility: 'public', name: 'Build Weekend', status: 'upcoming' }], hackathonTeams: [{ id: 't1', hackathonId: 'h1' }], hackathonMembers: [] })
    const result = await svc.listHackathonsAsync('u1')
    expect(result.hackathons).toHaveLength(1)
    expect(result.hackathons[0].teamsFormed).toBe(1)
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', hackathon: true })
  })

  it('creates a hackathon through the hackathon-scoped mutation', async () => {
    usedBounded({ hackathons: [] })
    const result = await svc.createHackathonAsync('u1', { name: 'Build Weekend', visibility: 'private' })
    expect(result.hackathon.name).toBe('Build Weekend')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', hackathon: true })
  })

  it('reads a single hackathon by id', async () => {
    usedBounded({ hackathons: [{ id: 'h1', visibility: 'public', name: 'Build Weekend' }], hackathonTeams: [], hackathonMembers: [] })
    const result = await svc.getHackathonAsync('u1', 'h1')
    expect(result.id).toBe('h1')
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', hackathon: true, hackathonId: 'h1' })
  })

  it('registers a hackathon team and returns the registration', async () => {
    usedBounded({ hackathons: [{ id: 'h1', visibility: 'public', name: 'Build Weekend' }], hackathonTeams: [], hackathonMembers: [], hackathonBriefs: [], hackathonScores: [], hackathonCheckIns: [], hackathonFinalSubmissions: [], hackathonTeamWorkspaces: [] })
    const result = await svc.registerHackathonAsync('u1', 'h1', { name: 'Team Rocket' })
    expect(result.ok).toBe(true)
    expect(result.team.name).toBe('Team Rocket')
    expect(result.registration.role).toBe('leader')
  })

  it('invites a collaborator through the hackathon-scoped mutation', async () => {
    usedBounded({ hackathonTeams: [{ id: 't1', hackathonId: 'h1', leaderId: 'u1', openRoles: ['dev'], teamSize: 5 }], profiles: [{ id: 'u1' }, { id: 'c1', role: 'collaborator' }], hackathonMembers: [], hackathonInvitations: [], notifications: [] })
    const result = await svc.createHackathonInvitationAsync('u1', 'h1', 't1', { collaboratorId: 'c1', role: 'dev' })
    expect(result.ok).toBe(true)
    expect(result.invitation.collaboratorId).toBe('c1')
  })

  it('accepts a hackathon invite with the targeted token', async () => {
    usedBounded({ hackathonTeams: [{ id: 't1', hackathonId: 'h1', leaderId: 'u1', inviteToken: 'tok', openRoles: ['dev'], teamSize: 5 }], profiles: [{ id: 'c1', firstName: 'Cy' }], hackathonMembers: [], hackathonInvitations: [{ id: 'i1', hackathonId: 'h1', teamId: 't1', token: 'tok', collaboratorId: 'c1', role: 'dev', status: 'pending' }], hackathonBriefs: [], hackathonScores: [], hackathonCheckIns: [], hackathonFinalSubmissions: [], hackathonTeamWorkspaces: [] })
    const result = await svc.acceptHackathonInviteAsync('c1', 'h1', 't1', { token: 'tok' })
    expect(result.ok).toBe(true)
    expect(result.registration.role).toBe('member')
  })

  it('provisions a hackathon team workspace', async () => {
    usedBounded({ hackathonTeams: [{ id: 't1', hackathonId: 'h1', leaderId: 'u1', name: 'Team Rocket' }], hackathonTeamWorkspaces: [], projects: [], workspaces: [], hackathonBriefs: [], hackathonScores: [], hackathonCheckIns: [], hackathonFinalSubmissions: [], hackathonMembers: [] })
    const result = await svc.provisionHackathonWorkspaceAsync('u1', 'h1', 't1', { projectTitle: 'Rocket' })
    expect(result.ok).toBe(true)
    expect(result.workspace.projectId).toBe(result.project.id)
  })

  it('aggregates the hackathon command center from bounded rows', async () => {
    usedBounded({ hackathons: [{ id: 'h1', visibility: 'public', status: 'live' }], hackathonTeams: [{ id: 't1', hackathonId: 'h1', name: 'Rocket', isSolo: false }], hackathonMembers: [{ id: 'm1', hackathonId: 'h1', teamId: 't1' }], hackathonBriefs: [{ id: 'b1', hackathonId: 'h1', teamId: 't1' }], hackathonCheckIns: [{ id: 'c1', hackathonId: 'h1', teamId: 't1', activityScore: 5 }], hackathonScores: [{ id: 's1', hackathonId: 'h1', teamId: 't1', composite: 60 }] })
    const result = await svc.hackathonAggregatesAsync('u1', 'h1')
    expect(result.overview.teamsFormed).toBe(1)
    expect(result.leaderboard[0].composite).toBe(60)
  })
})

describe('domain row-level store — contracts + opportunities (§5 sub-slice 4)', () => {
  it('lists the caller contracts through the contract scope', async () => {
    usedBounded({
      contracts: [
        { id: 'c1', founderId: 'u1', collaboratorId: 'c2', status: 'draft', updatedAt: '2024-01-01T00:00:00Z' },
        { id: 'c2', founderId: 'c9', collaboratorId: 'u1', status: 'active', updatedAt: '2024-02-01T00:00:00Z' },
        { id: 'c3', founderId: 'x', collaboratorId: 'y', status: 'draft', updatedAt: '2024-03-01T00:00:00Z' },
      ],
    })
    const result = await svc.listContractsAsync('u1')
    expect(result.contracts.map(row => row.id)).toEqual(['c2', 'c1'])
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', contracts: true })
  })

  it('creates a contract for an existing collaborator', async () => {
    usedBounded({ users: [{ id: 'c2' }], profiles: [], contracts: [] })
    const result = await svc.createContractAsync('u1', { collaboratorId: 'c2', projectName: 'FinPay' })
    expect(result.ok).toBe(true)
    expect(result.contract.founderId).toBe('u1')
    expect(result.contract.status).toBe('draft')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', contracts: true, collaboratorId: 'c2' })
  })

  it('rejects a contract for an unknown collaborator', async () => {
    usedBounded({ users: [], profiles: [], contracts: [] })
    const result = await svc.createContractAsync('u1', { collaboratorId: 'ghost' })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('collaborator_not_found')
  })

  it('reads a single contract by id', async () => {
    usedBounded({ contracts: [{ id: 'c1', founderId: 'u1', collaboratorId: 'c2', status: 'draft' }] })
    const found = await svc.getContractAsync('u1', 'c1')
    expect(found.id).toBe('c1')
    const missing = await svc.getContractAsync('u1', 'nope')
    expect(missing).toBeNull()
  })

  it('countersigns a founder contract and signs a collaborator contract', async () => {
    usedBounded({ contracts: [{ id: 'c1', founderId: 'u1', collaboratorId: 'c2', status: 'pending-signature', collaboratorSignedAt: '2024-01-01T00:00:00Z', collaboratorSignature: 'c2' }] })
    const countersigned = await svc.countersignContractAsync('u1', 'c1')
    expect(countersigned.ok).toBe(true)
    expect(countersigned.contract.status).toBe('active')

    usedBounded({ contracts: [{ id: 'c2', founderId: 'u1', collaboratorId: 'u2', status: 'pending-countersign', founderSignedAt: '2024-01-01T00:00:00Z', founderSignature: 'u1' }] })
    const signed = await svc.signContractAsync('u2', 'c2')
    expect(signed.ok).toBe(true)
    expect(signed.contract.status).toBe('active')
  })

  it('applies to an opportunity and lists the caller applications', async () => {
    usedBounded({ opportunities: [{ id: 'o1', ownerId: 'founder', title: 'Designer' }], opportunityApplications: [] })
    const applied = await svc.applyToOpportunityAsync('u1', 'o1', { message: 'Keen' })
    expect(applied.ok).toBe(true)
    expect(applied.application.applicantId).toBe('u1')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', contracts: true, opportunityId: 'o1' })

    usedBounded({ opportunityApplications: [{ id: 'a1', applicantId: 'u1', opportunityId: 'o1', updatedAt: '2024-01-01T00:00:00Z' }] })
    const listed = await svc.listApplicationsAsync('u1')
    expect(listed.applications).toHaveLength(1)
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', contracts: true })
  })

  it('creates a collaboration call as an opportunity', async () => {
    usedBounded({ opportunities: [], profiles: [{ id: 'u1', firstName: 'Ada' }] })
    const result = await svc.createCollaborationCallAsync('u1', {
      projectId: 'p1',
      company: 'FinPay',
      summary: 'Need a designer',
      scope: 'Design system',
      role: 'Designer',
      audienceRoles: ['collaborator'],
      compensationMode: 'equity-heavy',
      equityPercent: 5,
    })
    expect(result.ok).toBe(true)
    expect(result.created).toBe(true)
    expect(result.opportunity.type).toBe('collaboration')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', contracts: true })
  })
})

describe('domain row-level store — venture intakes + analyses (§5 sub-slice 5a)', () => {
  it('lists only the caller venture intakes through the venture scope', async () => {
    usedBounded({
      ventureIntakes: [
        { id: 'i1', ownerId: 'u1', status: 'draft', updatedAt: '2024-01-01T00:00:00Z' },
        { id: 'i2', ownerId: 'u2', status: 'draft', updatedAt: '2024-02-01T00:00:00Z' },
      ],
    })
    const result = await svc.listIntakesAsync('u1')
    expect(result.intakes.map(row => row.id)).toEqual(['i1'])
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', venture: true })
  })

  it('creates an intake owned by the caller', async () => {
    usedBounded({ ventureIntakes: [] })
    const result = await svc.createIntakeAsync('u1', { submission: { startup_name: 'FinPay' } })
    expect(result.intake.ownerId).toBe('u1')
    expect(result.intake.status).toBe('draft')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', venture: true })
  })

  it('reads a single intake by id', async () => {
    usedBounded({ ventureIntakes: [{ id: 'i1', ownerId: 'u1', structuredProfile: { name: 'FinPay' } }] })
    const found = await svc.getIntakeAsync('u1', 'i1')
    expect(found.id).toBe('i1')
    const missing = await svc.getIntakeAsync('u1', 'nope')
    expect(missing).toBeNull()
  })

  it('promotes an intake into a project', async () => {
    const db = { ventureIntakes: [{ id: 'i1', ownerId: 'u1', structuredProfile: { name: 'FinPay', industry: 'FinTech' } }], projects: [] }
    usedBounded(db)
    const result = await svc.promoteIntakeAsync('u1', 'i1', {})
    expect(result.ok).toBe(true)
    expect(result.project.title).toBe('FinPay')
    expect(result.intake.promotedProjectId).toBe(result.project.id)
    expect(db.projects).toHaveLength(1)
  })

  it('lists and creates venture analyses, mirroring project analyses', async () => {
    usedBounded({ ventureAnalyses: [{ id: 'a1', ownerId: 'u1', updatedAt: '2024-01-01T00:00:00Z' }] })
    const listed = await svc.listAnalysesAsync('u1')
    expect(listed.analyses.map(row => row.id)).toEqual(['a1'])
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', venture: true })

    const db = { ventureAnalyses: [], projectAnalyses: [] }
    usedBounded(db)
    const created = await svc.createAnalysisAsync('u1', { module: 'gsis', projectId: 'p1' })
    expect(created.analysis.ownerId).toBe('u1')
    expect(db.projectAnalyses).toHaveLength(1)
    expect(db.projectAnalyses[0].projectId).toBe('p1')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', venture: true })
  })

  it('reads a single analysis by id', async () => {
    usedBounded({ ventureAnalyses: [{ id: 'a1', ownerId: 'u1', module: 'gsis' }] })
    const found = await svc.getAnalysisAsync('u1', 'a1')
    expect(found.id).toBe('a1')
    const missing = await svc.getAnalysisAsync('u1', 'nope')
    expect(missing).toBeNull()
  })
})

describe('domain row-level store — workspace collections (§5 sub-slice 5b)', () => {
  it('lets the owner list a workspace collection by workspace id', async () => {
    usedBounded({ workspaces: [{ id: 'ws1', ownerId: 'owner1' }], workspaceMembers: [], workspaceTasks: [{ id: 't1', workspaceId: 'ws1', title: 'A', updatedAt: '2024-01-01T00:00:00Z' }] })
    const rows = await svc.listWorkspaceCollectionAsync('owner1', 'ws1', 'workspaceTasks')
    expect(rows).toHaveLength(1)
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'owner1', workspaceId: 'ws1', collections: ['workspaceTasks'] })
  })

  it('returns null for a missing workspace and for a non-member', async () => {
    usedBounded({ workspaces: [], workspaceMembers: [], workspaceTasks: [] })
    expect(await svc.listWorkspaceCollectionAsync('owner1', 'nope', 'workspaceTasks')).toBeNull()

    usedBounded({ workspaces: [{ id: 'ws1', ownerId: 'owner1' }], workspaceMembers: [], workspaceTasks: [] })
    expect(await svc.listWorkspaceCollectionAsync('stranger', 'ws1', 'workspaceTasks')).toBeNull()
  })

  it('hides agents and connectors from non-owner members', async () => {
    usedBounded({ workspaces: [{ id: 'ws1', ownerId: 'owner1' }], workspaceMembers: [{ id: 'm1', workspaceId: 'ws1', userId: 'collab1', status: 'active', accessLevel: 'contributor' }], workspaceAgents: [{ id: 'a1', workspaceId: 'ws1' }] })
    const rows = await svc.listWorkspaceCollectionAsync('collab1', 'ws1', 'workspaceAgents')
    expect(rows).toEqual([])
  })

  it('lets a contributor create tasks but not agents', async () => {
    const db = { workspaces: [{ id: 'ws1', ownerId: 'owner1' }], workspaceMembers: [{ id: 'm1', workspaceId: 'ws1', userId: 'collab1', status: 'active', accessLevel: 'contributor' }], workspaceTasks: [], workspaceAgents: [] }
    usedBounded(db)
    const created = await svc.createWorkspaceCollectionItemAsync('collab1', 'ws1', 'workspaceTasks', { title: 'Do' }, 'task')
    expect(created.title).toBe('Do')
    expect(created.workspaceId).toBe('ws1')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'collab1', workspaceId: 'ws1', collections: ['workspaceTasks'] })

    const denied = await svc.createWorkspaceCollectionItemAsync('collab1', 'ws1', 'workspaceAgents', { name: 'x' }, 'agent')
    expect(denied).toBeNull()
  })

  it('patches a workspace item by id while preserving its owner', async () => {
    usedBounded({ workspaces: [{ id: 'ws1', ownerId: 'owner1' }], workspaceMembers: [], workspaceTasks: [{ id: 't1', workspaceId: 'ws1', ownerId: 'collab1', title: 'A', updatedAt: '2024-01-01T00:00:00Z' }] })
    const updated = await svc.patchWorkspaceCollectionItemAsync('owner1', 'ws1', 'workspaceTasks', 't1', { status: 'done' })
    expect(updated.status).toBe('done')
    expect(updated.ownerId).toBe('collab1')
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'owner1', workspaceId: 'ws1', collections: ['workspaceTasks'] })
  })
})
