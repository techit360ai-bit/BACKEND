import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => {
  const names = ['organizationPrograms', 'organizationRiskSignals', 'organizationActions', 'organizationActivityEvents', 'organizationAuditEvents', 'organizationRecommendations', 'organizationHealthSnapshots', 'organizationReports', 'organizationCohorts', 'organizationPartners', 'organizationResources', 'organizationReportSchedules', 'organizationKpiDefinitions', 'organizationKpiValues', 'organizationEntitlements', 'organizationBudgets', 'organizationUsage', 'organizationSponsorshipPackages', 'sponsorshipApplications', 'startupCandidates', 'organizationMarketplace', 'opportunities', 'mentorshipRooms', 'activeContexts', 'organizationMemberships', 'organizationDashboards', 'organizations', 'profiles', 'projects', 'workspaceTasks']
  const db = {}
  for (const name of names) db[name] = []
  return db
})

// Minimal in-process stand-in for the AsyncLocalStorage authority: the repository
// builds a bounded scope and runs the synchronous service logic against it, while
// `readDb`/`updateDb` resolve that same scope.
const mocks = vi.hoisted(() => ({ authority: { snapshot: null }, fallback: {}, fallbackReads: 0 }))

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(() => { if (!mocks.authority.snapshot) mocks.fallbackReads += 1; return mocks.authority.snapshot || mocks.fallback }),
  updateDb: vi.fn(fn => fn(mocks.authority.snapshot || mocks.fallback)),
  runDatabaseAuthority: (snapshot, callback) => { const previous = mocks.authority.snapshot; mocks.authority.snapshot = snapshot; try { return callback() } finally { mocks.authority.snapshot = previous } },
}))
vi.mock('../repositories/platformCollectionRepository.js', () => ({
  withPlatformTransaction: vi.fn(async fn => fn({})),
  getRecord: vi.fn(async (_client, name, id) => (store[name] || []).find(row => row.id === id) || null),
  upsertRecord: vi.fn(async (_client, name, row) => { const list = store[name] || (store[name] = []); const index = list.findIndex(item => item.id === row.id); if (index >= 0) list[index] = row; else list.push(row); return row }),
  listRecordsForOwner: vi.fn(async (_client, name, value, { ownerFields = ['userId'] } = {}) => (store[name] || []).filter(row => ownerFields.some(field => row[field] === value))),
  listRecordsByField: vi.fn(async (_client, name, field, value) => (store[name] || []).filter(row => row[field] === value)),
  listRecordsByFieldIn: vi.fn(async (_client, name, field, values = []) => (store[name] || []).filter(row => values.includes(row[field]))),
  listRecordsLimited: vi.fn(async (_client, name, { limit = 500 } = {}) => (store[name] || []).slice(0, limit)),
  listRecordsByIds: vi.fn(async (_client, name, ids = []) => { const wanted = new Set(ids); return (store[name] || []).filter(row => wanted.has(row.id)) }),
}))

const { organizationOverviewAsync, organizationProgramHealthAsync, organizationCohortBenchmarksAsync, organizationRisksAsync, createOrganizationActionAsync, runOrganizationIntelligenceMaintenanceAsync } = await import('../services/organizationIntelligenceService.js')
const { updateDb } = await import('../config/database.js')
const { withPlatformTransaction } = await import('../repositories/platformCollectionRepository.js')

const ENV_KEYS = ['ORGANIZATION_SOURCE', 'ORGANIZATION_READ_SOURCE', 'ORGANIZATION_WRITE_SOURCE', 'AUTHORIZATION_SOURCE', 'ORGANIZATION_FALLBACK_SQLITE']
let savedEnv = {}

function seed() {
  store.organizations.push({ id: 'org-1', name: 'Northstar' }, { id: 'org-2', name: 'Other' })
  store.activeContexts.push({ id: 'ctx-1', userId: 'org-user', organizationId: 'org-1', status: 'active' })
  store.organizationMemberships.push({ id: 'm1', organizationId: 'org-1', userId: 'org-user', role: 'owner', status: 'active' })
  store.profiles.push({ id: 'org-user', role: 'organization' })
  store.projects.push(
    { id: 'startup-1', organizationId: 'org-1', programId: 'program-1', cohortId: 'cohort-1', title: 'Northstar Labs', gsisScore: 80, progress: 60, status: 'active', updatedAt: new Date().toISOString() },
    { id: 'startup-2', organizationId: 'org-2', title: 'Other Labs', gsisScore: 99, progress: 99 },
  )
  store.organizationPrograms.push({ id: 'program-1', organizationId: 'org-1', name: 'Accelerator', status: 'active', cohortCount: 1, updatedAt: new Date().toISOString() })
  store.organizationCohorts.push({ id: 'cohort-1', organizationId: 'org-1', programId: 'program-1', name: 'Spring 2026' })
  store.mentorshipRooms.push({ id: 'room-1', organizationId: 'org-1', programId: 'program-1', updatedAt: new Date().toISOString() })
  store.workspaceTasks.push({ id: 'task-1', organizationId: 'org-1', projectId: 'startup-1', status: 'completed' })
  store.organizationRiskSignals.push({ id: 'risk-1', organizationId: 'org-1', severity: 'high', status: 'open', updatedAt: new Date().toISOString() })
}

function fallbackSnapshot() {
  return { activeContexts: store.activeContexts, organizationMemberships: store.organizationMemberships, organizations: store.organizations, projects: store.projects, organizationRiskSignals: store.organizationRiskSignals, organizationPrograms: store.organizationPrograms, organizationEntitlements: [], organizationBudgets: [], organizationUsage: [], organizationSponsorshipPackages: [], sponsorshipApplications: [], startupCandidates: [], mentorshipRooms: [], organizationPartners: [], organizationMarketplace: [], opportunities: [], organizationCohorts: [], workspaceTasks: [], organizationActions: [], organizationActivityEvents: [], organizationAuditEvents: [] }
}

beforeEach(() => {
  savedEnv = {}
  for (const key of ENV_KEYS) { savedEnv[key] = process.env[key]; delete process.env[key] }
  process.env.ORGANIZATION_READ_SOURCE = 'postgres'
  vi.clearAllMocks()
  mocks.authority.snapshot = null
  mocks.fallbackReads = 0
  mocks.fallback = fallbackSnapshot()
  for (const key of Object.keys(store)) store[key].length = 0
  seed()
})

afterEach(() => {
  for (const key of ENV_KEYS) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key] }
})

describe('organization intelligence row-level store (§5 cutover)', () => {
  it('resolves overview from the organization scope without the snapshot', async () => {
    const result = await organizationOverviewAsync('org-user', 'org-1')
    expect(result.ok).toBe(true)
    expect(result.organizationId).toBe('org-1')
    expect(result.metrics.startups).toBe(1)
    expect(result.metrics.activePrograms).toBe(1)
    expect(result.risks.total).toBe(1)
    expect(mocks.fallbackReads).toBe(0)
    expect(updateDb).not.toHaveBeenCalled()
  })

  it('derives program health from program-scoped cohorts, mentors, and startups', async () => {
    const result = await organizationProgramHealthAsync('org-user', 'program-1', 'org-1')
    expect(result.ok).toBe(true)
    expect(result.metrics).toEqual({ startups: 1, cohorts: 1, mentors: 1 })
    expect(mocks.fallbackReads).toBe(0)
  })

  it('benchmarks cohorts from row-level projects + cohort names', async () => {
    const result = await organizationCohortBenchmarksAsync('org-user', 'org-1')
    expect(result.ok).toBe(true)
    expect(result.benchmark).toEqual([expect.objectContaining({ cohortId: 'cohort-1', name: 'Spring 2026', startups: 1 })])
    expect(mocks.fallbackReads).toBe(0)
  })

  it('rejects a caller whose context is not a member of the addressed organization', async () => {
    const result = await organizationRisksAsync('org-user', { organizationId: 'org-2' })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('organization_access_denied')
    expect(mocks.fallbackReads).toBe(0)
  })

  it('creates an audited action row-level without the snapshot', async () => {
    const result = await createOrganizationActionAsync('org-user', { organizationId: 'org-1', title: 'Review Northstar', priority: 'high' })
    expect(result.ok).toBe(true)
    expect(result.action.organizationId).toBe('org-1')
    expect(store.organizationActions).toHaveLength(1)
    expect(store.organizationAuditEvents).toHaveLength(1)
    expect(mocks.fallbackReads).toBe(0)
    expect(withPlatformTransaction).toHaveBeenCalled()
  })

  it('runs scheduled maintenance against the bounded store (overdue + due reports)', async () => {
    const past = new Date(Date.now() - 2 * 86400000).toISOString()
    store.organizationActions.push({ id: 'act-1', organizationId: 'org-1', ownerId: 'org-user', status: 'open', dueDate: past, updatedAt: past })
    store.organizationReportSchedules.push({ id: 'sched-1', organizationId: 'org-1', frequency: 'daily', active: true, recipients: ['org-user'], createdBy: 'org-user', createdAt: past, updatedAt: past })
    const result = await runOrganizationIntelligenceMaintenanceAsync()
    expect(result.ok).toBe(true)
    expect(result.overdueActions).toBe(1)
    expect(result.reportsGenerated).toBe(1)
    expect(store.organizationActions.find(row => row.id === 'act-1').status).toBe('overdue')
    expect(store.organizationReports).toHaveLength(1)
    expect(store.notifications.length).toBeGreaterThan(0)
    expect(mocks.fallbackReads).toBe(0)
  })

  it('falls back to the snapshot when the organization source is disabled', async () => {
    delete process.env.ORGANIZATION_READ_SOURCE
    const result = await organizationOverviewAsync('org-user', 'org-1')
    expect(result.ok).toBe(true)
    expect(mocks.fallbackReads).toBeGreaterThan(0)
  })

  it('falls back to the snapshot when the row-level read throws', async () => {
    withPlatformTransaction.mockRejectedValueOnce(new Error('store offline'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await organizationOverviewAsync('org-user', 'org-1')
    expect(result.ok).toBe(true)
    expect(mocks.fallbackReads).toBeGreaterThan(0)
    spy.mockRestore()
  })

  it('surfaces the failure when the row-level read throws and fallback is disabled', async () => {
    process.env.ORGANIZATION_FALLBACK_SQLITE = 'false'
    withPlatformTransaction.mockRejectedValueOnce(new Error('store offline'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(organizationOverviewAsync('org-user', 'org-1')).rejects.toThrow('store offline')
    spy.mockRestore()
  })
})
