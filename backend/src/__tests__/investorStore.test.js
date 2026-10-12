import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// In-process stand-in for the platform collection store, driven through the real
// investor repository so the bounded load plan and persistence are exercised.
const store = vi.hoisted(() => {
  const names = [
    'projects', 'milestones', 'mentorshipRooms', 'mentorshipMentees', 'mentorshipTasks',
    'projectActivities', 'startupActivities', 'recommendationEvents',
    'investorWatchlists', 'dealFlowSnapshots', 'investments', 'portfolioInvestments', 'investorPortfolio',
    'investorRelationships', 'dealRooms', 'dataRooms',
    'investorIntelligenceSnapshots', 'investorIntelligenceAudits',
    'investorTrustAccessRequests', 'investorTrustAccessHistory', 'notifications',
  ]
  const db = {}
  for (const name of names) db[name] = []
  return db
})

const mocks = vi.hoisted(() => ({ authority: { snapshot: null }, fallback: {} }))

vi.mock('../config/database.js', () => ({
  readAuthorityDb: vi.fn(() => mocks.authority.snapshot || mocks.fallback),
  updateAuthorityDb: vi.fn(fn => fn(mocks.authority.snapshot || mocks.fallback)),
  runBoundedDatabase: (snapshot, callback) => { const previous = mocks.authority.snapshot; mocks.authority.snapshot = snapshot; try { return callback() } finally { mocks.authority.snapshot = previous } },
}))
vi.mock('../repositories/platformCollectionRepository.js', () => ({
  withPlatformTransaction: vi.fn(async fn => fn({})),
  getRecord: vi.fn(async (_client, name, id) => (store[name] || []).find(row => row.id === id) || null),
  upsertRecord: vi.fn(async (_client, name, row) => { const list = store[name] || (store[name] = []); const index = list.findIndex(item => item.id === row.id); if (index >= 0) list[index] = row; else list.push(row); return row }),
  deleteRecord: vi.fn(async (_client, name, id) => { const list = store[name] || []; const index = list.findIndex(item => item.id === id); if (index >= 0) list.splice(index, 1) }),
  listRecordsForOwner: vi.fn(async (_client, name, value, { ownerFields = ['userId'] } = {}) => (store[name] || []).filter(row => row.ownerId === value || ownerFields.some(field => row[field] === value))),
  listRecordsByField: vi.fn(async (_client, name, field, value) => (store[name] || []).filter(row => row[field] === value)),
  listRecordsByFieldIn: vi.fn(async (_client, name, field, values = []) => (store[name] || []).filter(row => values.includes(row[field]))),
  listRecordsLimited: vi.fn(async (_client, name, { limit = 500 } = {}) => (store[name] || []).slice(0, limit)),
  listRecordsByIds: vi.fn(async (_client, name, ids = []) => { const wanted = new Set(ids); return (store[name] || []).filter(row => wanted.has(row.id)) }),
}))

const svc = await import('../services/investorIntelligenceService.js')
const trust = await import('../services/investorTrustAccessService.js')

const ENV_KEYS = ['INVESTOR_SOURCE', 'INVESTOR_READ_SOURCE', 'INVESTOR_WRITE_SOURCE', 'INVESTOR_FALLBACK_SQLITE', 'INVESTOR_READ_FALLBACK_SQLITE', 'INVESTOR_WRITE_FALLBACK_SQLITE']
let savedEnv = {}

beforeEach(() => {
  vi.clearAllMocks()
  for (const name of Object.keys(store)) store[name].length = 0
  savedEnv = {}
  for (const key of ENV_KEYS) { savedEnv[key] = process.env[key]; delete process.env[key] }
  process.env.INVESTOR_SOURCE = 'postgres'
  process.env.INVESTOR_FALLBACK_SQLITE = 'false'
  process.env.INVESTOR_READ_FALLBACK_SQLITE = 'false'
  process.env.INVESTOR_WRITE_FALLBACK_SQLITE = 'false'
})
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
})

function seedPortfolio() {
  store.projects.push({ id: 'startup-1', title: 'Northstar', industry: 'SaaS', updatedAt: new Date().toISOString() })
  store.investorWatchlists.push({ id: 'watch-1', investorId: 'investor-1', projectId: 'startup-1' })
  store.dealFlowSnapshots.push({ id: 'snapshot-1', investorId: 'investor-1', projectId: 'startup-1', startupName: 'Northstar', executionVelocity: 78, readinessScore: 82, updatedAt: new Date().toISOString() })
  store.mentorshipRooms.push({ id: 'room-1', projectId: 'startup-1' })
  store.mentorshipMentees.push({ id: 'mentee-1', roomId: 'room-1', status: 'active' })
  store.mentorshipTasks.push({ id: 'task-1', roomId: 'room-1', status: 'completed' }, { id: 'task-2', roomId: 'room-1', status: 'pending' })
  store.milestones.push({ id: 'ms-1', projectId: 'startup-1', status: 'completed' }, { id: 'ms-2', projectId: 'startup-1', status: 'in_progress', dueDate: new Date(Date.now() + 86400000).toISOString() })
}

describe('investor row-level store — intelligence + trust access (§5 2c)', () => {
  it('builds the portfolio overview from the bounded bundle and persists the snapshot', async () => {
    seedPortfolio()
    const overview = await svc.investorIntelligenceOverviewAsync('investor-1')
    expect(overview.startups).toHaveLength(1)
    expect(overview.startups[0]).toMatchObject({ startupId: 'startup-1', name: 'Northstar', riskLevel: 'low' })
    expect(overview.startups[0].mentorship.completedTasks).toBe(1)
    expect(overview.portfolio).toMatchObject({ total: 1, healthy: 1 })
    expect(store.investorIntelligenceSnapshots).toHaveLength(1)
    expect(store.investorIntelligenceAudits).toHaveLength(1)
  })

  it('scopes startup intelligence to the authorized startup only', async () => {
    seedPortfolio()
    store.projects.push({ id: 'startup-2', title: 'Secret', ownerId: 'someone-else' })
    const allowed = await svc.investorStartupIntelligenceAsync('investor-1', 'startup-1')
    expect(allowed.startup.startupId).toBe('startup-1')
    expect(store.investorIntelligenceSnapshots.some(row => row.scope === 'startup:startup-1')).toBe(true)
    const denied = await svc.investorStartupIntelligenceAsync('investor-1', 'startup-2')
    expect(denied).toBeNull()
  })

  it('runs the derived brief through the mutation runner (snapshot persisted)', async () => {
    seedPortfolio()
    const brief = await svc.investorDailyBriefAsync('investor-1')
    expect(brief).toMatchObject({ totalStartups: 1, significantChanges: 1, generatedAt: expect.any(String) })
    const report = await svc.investorReportsAsync('investor-1')
    expect(report.reports[0].id).toContain(`daily-brief:investor-1`)
    expect(store.investorIntelligenceSnapshots.length).toBeGreaterThanOrEqual(2)
  })

  it('reads advisory evidence without persisting a snapshot', async () => {
    seedPortfolio()
    const evidence = await svc.investorAdvisoryEvidenceAsync('investor-1')
    expect(evidence.startups).toHaveLength(1)
    expect(store.investorIntelligenceSnapshots).toHaveLength(0)
  })

  it('creates one pending trust request and notifies the founder', async () => {
    store.projects.push({ id: 'project-1', ownerId: 'founder-1' })
    const created = await trust.requestInvestorTrustAccessAsync('investor-1', 'project-1', { purpose: 'Due diligence' })
    const duplicate = await trust.requestInvestorTrustAccessAsync('investor-1', 'project-1', { purpose: 'Duplicate' })
    expect(created).toMatchObject({ ok: true, created: true })
    expect(created.request.projectId).toBe('project-1')
    expect(duplicate.created).toBe(false)
    expect(store.investorTrustAccessRequests).toHaveLength(1)
    expect(store.notifications.some(row => row.userId === 'founder-1')).toBe(true)
    expect(store.investorTrustAccessHistory.map(row => row.action)).toEqual(['requested'])
  })

  it('lets only the startup owner decide, then exposes the decision to both sides', async () => {
    store.projects.push({ id: 'project-1', ownerId: 'founder-1' })
    const created = await trust.requestInvestorTrustAccessAsync('investor-1', 'project-1', {})
    const status = await trust.investorTrustAccessStatusAsync('investor-1', 'project-1')
    expect(status.requestAccessAllowed).toBe(false)
    const forbidden = await trust.decideInvestorTrustAccessAsync('other-founder', created.request.id, { decision: 'approved' })
    expect(forbidden.status).toBe(403)
    const decided = await trust.decideInvestorTrustAccessAsync('founder-1', created.request.id, { decision: 'approved' })
    expect(decided.request.status).toBe('approved')
    const list = await trust.listFounderTrustAccessRequestsAsync('founder-1')
    expect(list.requests[0].status).toBe('approved')
    expect(store.investorTrustAccessHistory.map(row => row.action)).toEqual(['requested', 'approved'])
  })

  it('falls back to the snapshot path when the investor store is disabled', async () => {
    delete process.env.INVESTOR_SOURCE
    mocks.fallback = {
      investorWatchlists: [{ id: 'w', investorId: 'investor-1', projectId: 'startup-1' }],
      dealFlowSnapshots: [], investments: [], portfolioInvestments: [], investorPortfolio: [], investorRelationships: [], dealRooms: [], dataRooms: [],
      projects: [{ id: 'startup-1', title: 'Northstar' }], milestones: [], mentorshipRooms: [], mentorshipMentees: [], mentorshipTasks: [],
      projectActivities: [], startupActivities: [], recommendationEvents: [], investorIntelligenceSnapshots: [], investorIntelligenceAudits: [],
    }
    const overview = await svc.investorIntelligenceOverviewAsync('investor-1')
    expect(overview.startups).toHaveLength(1)
    expect(store.investorIntelligenceSnapshots).toHaveLength(0)
  })
})
