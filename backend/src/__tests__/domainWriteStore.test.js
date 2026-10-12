import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// In-process stand-in for the platform collection store. The repository builds a
// bounded scope from these rows, runs the synchronous service logic against it,
// and persists only the changed rows back — so the assertions below check both
// the loaded scope and what actually landed.
const store = vi.hoisted(() => {
  const names = [
    'profiles', 'users', 'projects', 'workspaces', 'workspaceMembers', 'workspaceInvitations',
    'notifications', 'dealFlowSnapshots', 'projectAnalyses', 'equityGrants', 'collaboratorEarnings',
    'payouts', 'dilutionEvents', 'accountEntitlements', 'subscriptions', 'creditLedger',
    'recommendationEvents', 'networkEdges', 'entityRelationships', 'hackathons', 'hackathonTeams',
    'hackathonTeamWorkspaces', 'organizationMemberships', 'orgKpiTargets', 'orgDemoDayEvents',
    'organizationDashboards', 'usageEvents',
  ]
  const db = {}
  for (const name of names) db[name] = []
  return db
})

// Minimal AsyncLocalStorage authority: `readDb`/`updateDb` resolve the bounded
// scope the repository is running, exactly like the production snapshot hook.
const mocks = vi.hoisted(() => ({ authority: { snapshot: null }, fallback: {} }))

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(() => mocks.authority.snapshot || mocks.fallback),
  updateDb: vi.fn(fn => fn(mocks.authority.snapshot || mocks.fallback)),
  runDatabaseAuthority: (snapshot, callback) => { const previous = mocks.authority.snapshot; mocks.authority.snapshot = snapshot; try { return callback() } finally { mocks.authority.snapshot = previous } },
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

const svc = await import('../services/domainService.js')

const ENV_KEYS = ['DOMAIN_SOURCE', 'DOMAIN_READ_SOURCE', 'DOMAIN_WRITE_SOURCE', 'DOMAIN_FALLBACK_SQLITE']
let savedEnv = {}

beforeEach(() => {
  vi.clearAllMocks()
  for (const name of Object.keys(store)) store[name].length = 0
  savedEnv = {}
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
  process.env.DOMAIN_SOURCE = 'postgres'
  process.env.DOMAIN_FALLBACK_SQLITE = 'false'
})
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
})

const future = () => new Date(Date.now() + 7 * 86400000).toISOString()

describe('domain row-level store — project + workspace + equity writes (§5 2b)', () => {
  it('creates a project through the bounded founder scope and appends the event', async () => {
    const result = await svc.createProjectAsync('u1', { title: 'FinPay', industry: 'fintech' })
    expect(result.ok).toBe(true)
    expect(result.project).toMatchObject({ title: 'FinPay', ownerId: 'u1' })
    expect(store.projects).toHaveLength(1)
    expect(store.projects[0]).toMatchObject({ id: result.project.id, ownerId: 'u1' })
    expect(store.recommendationEvents).toHaveLength(1)
  })

  it('promotes a hackathon team into a project without the snapshot', async () => {
    store.hackathonTeams.push({ id: 't1', hackathonId: 'h1', leaderId: 'u1', workspaceId: 'w1' })
    store.hackathonTeamWorkspaces.push({ id: 'b1', teamId: 't1', workspaceId: 'w1' })
    store.workspaces.push({ id: 'w1', ownerId: 'u1', name: 'Venture Workspace' })
    const result = await svc.createProjectAsync('u1', { title: 'Promoted', origin: { kind: 'hackathon_promote', teamId: 't1', hackathonId: 'h1' } })
    expect(result.ok).toBe(true)
    expect(result.project.hasWorkspace).toBe(true)
    expect(store.hackathonTeams[0].promotedProjectId).toBe(result.project.id)
    expect(store.hackathonTeamWorkspaces[0].projectId).toBe(result.project.id)
    expect(store.workspaces[0].projectId).toBe(result.project.id)
  })

  it('patches a project the caller owns', async () => {
    store.projects.push({ id: 'p1', ownerId: 'u1', title: 'Old' })
    const project = await svc.updateProjectAsync('u1', 'p1', { title: 'New', tagline: 'ships' })
    expect(project).toMatchObject({ id: 'p1', title: 'New', tagline: 'ships' })
    expect(store.projects[0].title).toBe('New')
  })

  it('provisions a workspace seeded from the project analysis', async () => {
    store.projects.push({ id: 'p1', ownerId: 'u1' })
    store.projectAnalyses.push({ id: 'a1', projectId: 'p1', ventureName: 'FinPay', updatedAt: new Date().toISOString() })
    const result = await svc.provisionWorkspaceAsync('u1', { projectId: 'p1' })
    expect(result.ok).toBe(true)
    expect(result.workspace).toMatchObject({ projectId: 'p1', name: 'FinPay', seededFromAnalysis: true })
    expect(store.workspaces).toHaveLength(1)
  })

  it('publishes a project to a public deal-flow snapshot', async () => {
    store.projects.push({ id: 'p1', ownerId: 'u1', title: 'FinPay', industry: 'fintech' })
    store.projectAnalyses.push({ id: 'a1', projectId: 'p1', blueprint: { gsis_score: 72 }, updatedAt: new Date().toISOString() })
    const result = await svc.publishProjectAsync('u1', { projectId: 'p1' })
    expect(result.ok).toBe(true)
    expect(store.dealFlowSnapshots).toHaveLength(1)
    expect(store.dealFlowSnapshots[0]).toMatchObject({ projectId: 'p1', visibility: 'public', ownerId: 'u1' })
    expect(store.projects[0].visibility).toBe('public')
  })

  it('creates a workspace invitation and its collaborator notification', async () => {
    store.workspaces.push({ id: 'w1', ownerId: 'u1', name: 'Venture', projectId: 'p1' })
    store.profiles.push({ id: 'u1', firstName: 'Founder' }, { id: 'u2', role: 'collaborator' })
    const result = await svc.createWorkspaceInvitationAsync('u1', 'w1', { collaboratorId: 'u2', requestedRole: 'Engineer', scope: 'build core', equityProposal: 5 })
    expect(result.ok).toBe(true)
    expect(result.invitation).toMatchObject({ collaboratorId: 'u2', workspaceName: 'Venture', requestedRole: 'Engineer', equityProposal: 5 })
    expect(store.workspaceInvitations).toHaveLength(1)
    expect(store.notifications).toHaveLength(1)
    expect(store.notifications[0]).toMatchObject({ userId: 'u2', type: 'collab' })
  })

  it('accepts an invitation and records the membership', async () => {
    store.workspaceInvitations.push({ id: 'i1', workspaceId: 'w1', collaboratorId: 'u1', invitedBy: 'u2', status: 'pending', expiresAt: future(), requestedRole: 'Engineer', accessLevel: 'contributor' })
    store.workspaces.push({ id: 'w1', ownerId: 'u2', name: 'Venture', projectId: 'p1' })
    store.profiles.push({ id: 'u2', firstName: 'Owner' })
    const result = await svc.acceptWorkspaceInvitationAsync('u1', 'i1')
    expect(result.ok).toBe(true)
    expect(result.membership).toMatchObject({ userId: 'u1', workspaceId: 'w1', status: 'active' })
    expect(store.workspaceInvitations[0].status).toBe('accepted')
    expect(store.workspaceMembers).toHaveLength(1)
    expect(store.workspaceMembers[0]).toMatchObject({ userId: 'u1', status: 'active' })
  })

  it('declines an invitation', async () => {
    store.workspaceInvitations.push({ id: 'i1', workspaceId: 'w1', collaboratorId: 'u1', invitedBy: 'u2', status: 'pending', expiresAt: future() })
    store.workspaces.push({ id: 'w1', ownerId: 'u2', name: 'Venture' })
    const result = await svc.declineWorkspaceInvitationAsync('u1', 'i1')
    expect(result.ok).toBe(true)
    expect(store.workspaceInvitations[0].status).toBe('declined')
  })

  it('removes a workspace member and notifies them', async () => {
    store.workspaces.push({ id: 'w1', ownerId: 'u1', name: 'Venture' })
    store.workspaceMembers.push({ id: 'm1', workspaceId: 'w1', userId: 'u2', status: 'active' })
    const result = await svc.removeWorkspaceMemberAsync('u1', 'w1', 'm1')
    expect(result.ok).toBe(true)
    expect(result.member.status).toBe('removed')
    expect(store.workspaceMembers[0].status).toBe('removed')
    expect(store.notifications.some(row => row.userId === 'u2')).toBe(true)
  })

  it('records a dilution event from the caller equity grant', async () => {
    store.equityGrants.push({ id: 'g1', collaboratorId: 'u1', projectId: 'p1', equityPercent: 10, vestedPercent: 50 })
    const event = await svc.recordDilutionAsync('u1', { projectId: 'p1', newSharesPercent: 20, consentGiven: false })
    expect(event).toMatchObject({ collaboratorId: 'u1', projectId: 'p1', protectedApplied: true })
    expect(store.dilutionEvents).toHaveLength(1)
  })

  it('requests a withdrawal against the caller pending earnings', async () => {
    store.collaboratorEarnings.push({ id: 'e1', collaboratorId: 'u1', pending: 100 })
    const result = await svc.requestWithdrawalAsync('u1', { amount: 40, destination: 'bank' })
    expect(result.ok).toBe(true)
    expect(store.payouts).toHaveLength(1)
    expect(store.payouts[0]).toMatchObject({ collaboratorId: 'u1', amount: 40, status: 'processing' })
  })
})
