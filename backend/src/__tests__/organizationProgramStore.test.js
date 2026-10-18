import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  activeContexts: [], organizationMemberships: [], organizationDashboards: [], organizations: [], projects: [],
  organizationSponsorshipPackages: [], sponsorshipApplications: [], sponsorshipTransactions: [], sponsorshipBenefits: [],
  consentRecords: [], managedHackathonOperations: [], organizationInstitutionalSettings: [], startupCandidates: [],
  organizationAbuseReviews: [], hackathons: [], hackathonTeams: [], hackathonMembers: [], hackathonFinalSubmissions: [], hackathonScores: [],
}))

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(),
  accessEnabled: vi.fn(() => true),
  programEnabled: vi.fn(() => true),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/organizationAccessRepository.js', () => ({
  organizationAccessEnabled: () => mocks.accessEnabled(),
  organizationAccessFallbackEnabled: () => true,
  loadOrganizationAccess: vi.fn(async (userId, requestedOrganizationId = null) => ({
    activeContexts: store.activeContexts.filter(row => row.userId === userId),
    organizationMemberships: store.organizationMemberships.filter(row => row.userId === userId),
    organizationDashboards: store.organizationDashboards.filter(row => row.userId === userId || row.ownerId === userId),
    organizations: store.organizations.filter(row => row.id === (requestedOrganizationId || store.activeContexts.find(c => c.userId === userId)?.organizationId)),
    projects: store.projects.filter(row => row.organizationId === requestedOrganizationId),
  })),
}))
vi.mock('../repositories/organizationProgramRepository.js', () => ({
  organizationProgramEnabled: () => mocks.programEnabled(),
  organizationProgramFallbackEnabled: () => true,
  readOrgProgramRecord: vi.fn(async (name, id) => (store[name] || []).find(row => row.id === id) || null),
  readOrgProgramSources: vi.fn(async () => store),
  applyOrgProgramMutation: vi.fn(async (_userId, _opts, mutate) => mutate(store)),
}))
vi.mock('../services/organizationEntitlementService.js', () => ({ evaluateOrganizationEntitlement: () => ({ allowed: true }) }))
vi.mock('../services/supportService.js', () => ({ createCase: vi.fn(async () => ({ ok: true, case: { id: 'case-1' } })) }))

const { listSponsorshipPackagesAsync, createSponsorshipPackageAsync, hackathonOutcomeAsync, convertHackathonTeamAsync, reviewSponsorshipApplicationAsync } = await import('../services/organizationProgramService.js')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.accessEnabled.mockReturnValue(true)
  mocks.programEnabled.mockReturnValue(true)
  for (const key of Object.keys(store)) store[key].length = 0
  store.activeContexts.push({ userId: 'org-user', organizationId: 'org-1', status: 'active' })
  store.organizationMemberships.push({ id: 'm1', organizationId: 'org-1', userId: 'org-user', role: 'program_manager', status: 'active' })
  store.organizations.push({ id: 'org-1' })
})

describe('organization program row-level store (§5 cutover)', () => {
  it('lists sponsorship packages row-level without the snapshot', async () => {
    store.organizationSponsorshipPackages.push({ id: 'pkg-1', organizationId: 'org-1', name: 'Gold', status: 'active' })
    const result = await listSponsorshipPackagesAsync('org-user')
    expect(result.packages.map(row => row.id)).toEqual(['pkg-1'])
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('creates a sponsorship package row-level', async () => {
    const result = await createSponsorshipPackageAsync('org-user', { organizationId: 'org-1', name: 'Silver', packageType: 'community' })
    expect(result.ok).toBe(true)
    expect(store.organizationSponsorshipPackages.some(row => row.name === 'Silver')).toBe(true)
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('denies a package when the membership lacks program permission', async () => {
    store.organizationMemberships[0].role = 'read_only'
    const result = await createSponsorshipPackageAsync('org-user', { organizationId: 'org-1', name: 'Nope' })
    expect(result).toMatchObject({ ok: false, error: 'organization_permission_denied' })
  })

  it('reads a hackathon outcome from row-level hackathon children', async () => {
    store.hackathons.push({ id: 'h1', organizationId: 'org-1', ownerId: 'org-user', status: 'draft' })
    store.hackathonTeams.push({ id: 't1', hackathonId: 'h1', leaderId: 'member', name: 'Team' })
    store.hackathonMembers.push({ id: 'hm1', hackathonId: 'h1', teamId: 't1', userId: 'member' })
    store.hackathonFinalSubmissions.push({ id: 'f1', hackathonId: 'h1', teamId: 't1' })
    const result = await hackathonOutcomeAsync('org-user', 'h1')
    expect(result.report).toMatchObject({ participants: 1, teams: 1, completedProjects: 1 })
  })

  it('converts a hackathon team row-level', async () => {
    store.hackathons.push({ id: 'h1', organizationId: 'org-1', ownerId: 'org-user' })
    store.hackathonTeams.push({ id: 't1', hackathonId: 'h1', leaderId: 'member', name: 'Team One' })
    const result = await convertHackathonTeamAsync('member', 'h1', 't1', { consent: true })
    expect(result.ok).toBe(true)
    expect(store.startupCandidates.some(row => row.hackathonId === 'h1' && row.teamId === 't1')).toBe(true)
  })

  it('preserves lifecycle provenance when converting a shortlisted hackathon team', async () => {
    store.hackathons.push({ id: 'h1', organizationId: 'org-1', ownerId: 'org-user' })
    store.hackathonTeams.push({
      id: 't1',
      hackathonId: 'h1',
      leaderId: 'member',
      name: 'Evidence Team',
      source: 'community_discovery',
      sourceCommunity: 'campus-builders',
      shortlistedAt: '2026-10-01T00:00:00.000Z',
      programId: 'program-1',
      cohortId: 'cohort-1',
    })
    store.hackathonScores.push({ id: 'score-1', teamId: 't1', createdAt: '2026-10-02T00:00:00.000Z', total: 91 })
    const result = await convertHackathonTeamAsync('member', 'h1', 't1', { consent: true, projectId: 'project-1' })
    expect(result.ok).toBe(true)
    expect(result.candidate).toMatchObject({
      source: 'community_discovery',
      sourceCommunity: 'campus-builders',
      shortlistedAt: '2026-10-01T00:00:00.000Z',
      evaluationId: 'score-1',
      programId: 'program-1',
      cohortId: 'cohort-1',
      projectId: 'project-1',
    })
    expect(store.hackathonTeams[0]).toMatchObject({ startupCandidateId: result.candidate.id, evaluationId: 'score-1' })
  })

  it('reviews a sponsorship application resolved by id row-level', async () => {
    store.organizationMemberships[0].role = 'admin'
    store.sponsorshipApplications.push({ id: 'app-1', organizationId: 'org-1', status: 'submitted' })
    const result = await reviewSponsorshipApplicationAsync('org-user', 'app-1', { status: 'approved' })
    expect(result.ok).toBe(true)
    expect(store.sponsorshipApplications.find(row => row.id === 'app-1').status).toBe('approved')
  })

  it('falls back to the snapshot when the source is sqlite', async () => {
    mocks.accessEnabled.mockReturnValue(false)
    mocks.programEnabled.mockReturnValue(false)
    mocks.readAuthorityDb.mockReturnValue({
      activeContexts: [{ userId: 'org-user', organizationId: 'org-1', status: 'active' }],
      organizationMemberships: [{ organizationId: 'org-1', userId: 'org-user', role: 'program_manager', status: 'active' }],
      organizations: [{ id: 'org-1' }], projects: [], organizationSponsorshipPackages: [{ id: 'pkg-1', organizationId: 'org-1', status: 'active' }],
    })
    const result = await listSponsorshipPackagesAsync('org-user')
    expect(result.packages.map(row => row.id)).toEqual(['pkg-1'])
    expect(mocks.readAuthorityDb).toHaveBeenCalled()
  })
})
