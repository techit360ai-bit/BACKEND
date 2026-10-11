import { beforeEach, describe, expect, it, vi } from 'vitest'

const OWNER_FIELDS = { userRoles: ['userId'], roleProfiles: ['userId'], trustProfiles: ['userId'], verificationProfiles: ['userId'], riskProfiles: ['userId'], organizationMemberships: ['userId'], subscriptions: ['userId'], walletAccounts: ['userId'], creditLedger: ['userId'], usageReservations: ['userId'], activeContexts: ['userId'] }

const store = vi.hoisted(() => ({
  profiles: {}, userRoles: [], roleProfiles: [], activeContexts: [], trustProfiles: [], verificationProfiles: [], riskProfiles: [],
  organizationMemberships: [], subscriptions: [], walletAccounts: [], creditLedger: [], usageReservations: [],
  capabilityPolicies: [], billingPlans: [], verificationAuditLogs: [], authorizationAuditLogs: [], contextHistory: [], roleHistory: [],
}))

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(),
  enabled: vi.fn(() => true),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))

function loadDb(userId, collections) {
  const db = { profiles: store.profiles[userId] ? [store.profiles[userId]] : [] }
  const names = Array.isArray(collections) && collections.length ? collections : Object.keys(OWNER_FIELDS)
  for (const name of names) if (OWNER_FIELDS[name]) db[name] = (store[name] || []).filter(row => row.userId === userId)
  db.capabilityPolicies = store.capabilityPolicies
  db.billingPlans = store.billingPlans
  return db
}

function persist(name, row) {
  if (!row || !row.id) return
  if (name === 'profiles') { store.profiles[row.id] = row; return }
  if (!Array.isArray(store[name])) store[name] = []
  const index = store[name].findIndex(item => item.id === row.id)
  if (index >= 0) store[name][index] = row
  else store[name].push(row)
}

vi.mock('../repositories/platformCollectionRepository.js', () => ({
  getRecord: vi.fn(async (_client, name, id) => (name === 'profiles' ? (store.profiles[id] || null) : ((store[name] || []).find(row => row.id === id) || null))),
  listRecords: vi.fn(async (_client, name, query = {}) => (store[name] || []).filter(row => Object.entries(query).every(([key, value]) => row[key] === value))),
}))

vi.mock('../repositories/authorizationRepository.js', () => ({
  authorizationEnabled: () => mocks.enabled(),
  authorizationFallbackEnabled: () => true,
  loadAuthorizationSources: vi.fn(async (userId, collections) => loadDb(userId, collections)),
  applyScopedMutation: vi.fn(async (userId, collections, mutate) => {
    const db = loadDb(userId, collections)
    const out = mutate(db) || {}
    const result = Object.prototype.hasOwnProperty.call(out, 'result') ? out.result : out
    for (const name of collections) for (const row of (db[name] || [])) persist(name, row)
    for (const item of out.append || []) persist(item.collection, item.row)
    return result
  }),
  applyGlobalMutation: vi.fn(async mutate => {
    const db = { capabilityPolicies: store.capabilityPolicies, billingPlans: store.billingPlans }
    const out = mutate(db) || {}
    const result = Object.prototype.hasOwnProperty.call(out, 'result') ? out.result : out
    for (const name of ['capabilityPolicies', 'billingPlans']) for (const row of (db[name] || [])) persist(name, row)
    for (const item of out.append || []) persist(item.collection, item.row)
    return result
  }),
  appendRow: vi.fn(async (name, row) => { persist(name, row); return row }),
  listCapabilityPolicies: vi.fn(async () => store.capabilityPolicies),
}))

const { authorizeCapabilityAsync, trustProfileForAsync, roleActivationAsync, capabilityPoliciesForAdmin, switchActiveRoleAsync } = await import('../services/capabilityAuthorization.js')
const { availableContextsAsync, switchContextAsync, activateRoleAssignmentAsync, deactivateRoleAssignmentAsync } = await import('../services/multiRoleContextService.js')

function seedUser(overrides = {}) {
  store.profiles.u1 = { id: 'u1', role: 'founder', isOnboarded: true, secondaryRoles: [], ...overrides }
  store.userRoles = [
    { id: 'ur-explorer', userId: 'u1', role: 'explorer', status: 'active', active: true, createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'ur-founder', userId: 'u1', role: 'founder', status: 'active', active: true, createdAt: '2024-01-01T00:00:00.000Z' },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabled.mockReturnValue(true)
  for (const key of Object.keys(store)) store[key] = Array.isArray(store[key]) ? [] : {}
})

describe('authorization / role-context row-level store (§5 cutover)', () => {
  it('authorizes a capability from row-level sources without the snapshot', async () => {
    seedUser()
    store.walletAccounts = [{ id: 'wa1', userId: 'u1', creditBalance: 0 }]
    const decision = await authorizeCapabilityAsync('u1', 'mentorship.hub.view', {})
    expect(decision.allowed).toBe(true)
    expect(decision.activeRole).toBe('founder')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('derives the trust profile row-level', async () => {
    seedUser()
    const trust = await trustProfileForAsync('u1')
    expect(trust.activeRole).toBe('founder')
    expect(trust.roles).toContain('founder')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('repairs the base context row-level', async () => {
    store.profiles.u1 = { id: 'u1', role: 'founder', isOnboarded: true, secondaryRoles: [] }
    const result = await availableContextsAsync('u1')
    expect(result.contexts.some(row => row.role === 'founder')).toBe(true)
    expect(store.userRoles.some(row => row.userId === 'u1' && row.role === 'explorer')).toBe(true)
    expect(store.activeContexts.some(row => row.userId === 'u1' && row.status === 'active')).toBe(true)
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('switches the active context row-level', async () => {
    seedUser()
    store.activeContexts = [{ id: 'ctx1', userId: 'u1', role: 'explorer', status: 'active', startedAt: '2024-01-01T00:00:00.000Z', lastActiveAt: '2024-01-01T00:00:00.000Z' }]
    const result = await switchContextAsync('u1', { role: 'founder' })
    expect(result.ok).toBe(true)
    expect(store.activeContexts.find(row => row.userId === 'u1' && row.status === 'active').role).toBe('founder')
    expect(store.contextHistory).toHaveLength(1)
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('activates a role row-level (profile + userRole + trust)', async () => {
    store.profiles.u1 = { id: 'u1', role: 'founder', isOnboarded: true, secondaryRoles: [] }
    const result = await roleActivationAsync('u1', 'investor', { headline: 'x' })
    expect(result.ok).toBe(true)
    expect(store.userRoles.some(row => row.userId === 'u1' && row.role === 'investor' && row.status === 'active')).toBe(true)
    expect(store.profiles.u1.secondaryRoles).toContain('investor')
    expect(store.trustProfiles.some(row => row.userId === 'u1')).toBe(true)
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('switches the active role row-level', async () => {
    seedUser()
    const result = await switchActiveRoleAsync('u1', 'founder')
    expect(result.ok).toBe(true)
    expect(store.profiles.u1.activeRole).toBe('founder')
    expect(store.verificationAuditLogs.some(row => row.userId === 'u1' && row.action === 'active_role_switched')).toBe(true)
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('activates and deactivates a role assignment row-level', async () => {
    seedUser()
    const activated = await activateRoleAssignmentAsync('u1', 'collaborator')
    expect(activated.ok).toBe(true)
    expect(store.userRoles.some(row => row.userId === 'u1' && row.role === 'collaborator' && row.status === 'active')).toBe(true)
    const deactivated = await deactivateRoleAssignmentAsync('u1', 'collaborator')
    expect(deactivated.ok).toBe(true)
    expect(store.userRoles.find(row => row.userId === 'u1' && row.role === 'collaborator').status).toBe('revoked')
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('resolves capability policies row-level', async () => {
    store.capabilityPolicies = [{ id: 'c1', capability: 'mentorship.hub.view', policy: { assurance: 'PROFILED' }, active: true }]
    const policies = await capabilityPoliciesForAdmin()
    expect(policies.find(row => row.capability === 'mentorship.hub.view').policy.assurance).toBe('PROFILED')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('falls back to the snapshot when the authorization source is sqlite', async () => {
    mocks.enabled.mockReturnValue(false)
    mocks.readDb.mockReturnValue({ profiles: [{ id: 'u1', role: 'founder', isOnboarded: true }], userRoles: [], trustProfiles: [], verificationProfiles: [], riskProfiles: [] })
    const trust = await trustProfileForAsync('u1')
    expect(trust.activeRole).toBe('founder')
    expect(mocks.readDb).toHaveBeenCalled()
  })
})
