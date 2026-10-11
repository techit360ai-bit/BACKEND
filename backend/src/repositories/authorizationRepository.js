// Row-level authorization/role-context store (§5 cutover).
//
// Capability decisions and role/context switches previously read the whole-DB
// snapshot: profiles, roles, trust/verification/risk profiles, subscriptions,
// wallet/ledger/reservations, organization memberships, capability policies and
// the audit logs. This repository resolves the owner-scoped rows with bounded
// queries and writes the mutated rows back individually. Gated by
// AUTHORIZATION_SOURCE=postgres (or an authoritative identity source); the
// snapshot stays in the services as the fallback.
import {
  withPlatformTransaction,
  getRecord,
  upsertRecord,
  listRecords,
  listRecordsForOwner,
} from './platformCollectionRepository.js'

// Owner-scoped collections the authorization/context flows read.
const OWNER_FIELDS = {
  userRoles: ['userId'],
  roleProfiles: ['userId'],
  trustProfiles: ['userId'],
  verificationProfiles: ['userId'],
  riskProfiles: ['userId'],
  organizationMemberships: ['userId'],
  subscriptions: ['userId'],
  walletAccounts: ['userId'],
  creditLedger: ['userId'],
  usageReservations: ['userId'],
  activeContexts: ['userId'],
}
// Global catalogs (no owner) plus the audit logs written by this domain.
const GLOBAL_COLLECTIONS = ['capabilityPolicies', 'billingPlans']
const AUDIT_COLLECTIONS = ['verificationAuditLogs', 'authorizationAuditLogs', 'contextHistory', 'roleHistory']

export function authorizationEnabled() {
  return process.env.AUTHORIZATION_SOURCE === 'postgres' || process.env.IDENTITY_READ_SOURCE === 'postgres' || process.env.IDENTITY_WRITE_SOURCE === 'postgres'
}
export function authorizationFallbackEnabled() { return process.env.AUTHORIZATION_FALLBACK_SQLITE !== 'false' }

// Returns a db-shaped bundle (arrays of rows) the pure decision code can consume
// without loading the whole snapshot.
export async function loadAuthorizationSources(userId, collections = Object.keys(OWNER_FIELDS)) {
  return withPlatformTransaction(async client => {
    const out = { profiles: [] }
    for (const name of collections) {
      if (!OWNER_FIELDS[name]) continue
      out[name] = await listRecordsForOwner(client, name, userId, { ownerFields: OWNER_FIELDS[name] })
    }
    const profile = await getRecord(client, 'profiles', userId)
    out.profiles = profile ? [profile] : []
    for (const name of GLOBAL_COLLECTIONS) out[name] = await listRecords(client, name, {})
    return out
  }, { userId })
}

export async function listCapabilityPolicies() {
  return withPlatformTransaction(client => listRecords(client, 'capabilityPolicies', {}))
}
export async function listAuthorizationAudit() {
  return withPlatformTransaction(client => listRecords(client, 'authorizationAuditLogs', {}))
}

export async function saveProfile(profile) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, 'profiles', profile.id)
    await upsertRecord(client, 'profiles', profile, { operation: current ? 'update' : 'insert', expectedVersion: current ? current.version : null, idempotencyKey: `profiles:${profile.id}:${profile.updatedAt || Date.now()}` })
    return profile
  }, { userId: profile.id })
}
export async function saveUserRole(row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, 'userRoles', row.id)
    await upsertRecord(client, 'userRoles', row, { operation: current ? 'update' : 'insert', expectedVersion: current ? current.version : null, idempotencyKey: `userRoles:${row.id}:${row.updatedAt || Date.now()}` })
    return row
  }, { userId: row.userId || null })
}
export async function saveRoleProfile(row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, 'roleProfiles', row.id)
    await upsertRecord(client, 'roleProfiles', row, { operation: current ? 'update' : 'insert', expectedVersion: current ? current.version : null, idempotencyKey: `roleProfiles:${row.id}:${row.updatedAt || Date.now()}` })
    return row
  }, { userId: row.userId || null })
}
export async function saveTrustProfile(row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, 'trustProfiles', row.id)
    await upsertRecord(client, 'trustProfiles', row, { operation: current ? 'update' : 'insert', expectedVersion: current ? current.version : null, idempotencyKey: `trustProfiles:${row.id}:${row.updatedAt || Date.now()}` })
    return row
  }, { userId: row.userId || null })
}
export async function saveCapabilityPolicy(row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, 'capabilityPolicies', row.id)
    await upsertRecord(client, 'capabilityPolicies', row, { operation: current ? 'update' : 'insert', expectedVersion: current ? current.version : null, idempotencyKey: `capabilityPolicies:${row.id}:${row.updatedAt || Date.now()}` })
    return row
  })
}
export async function saveActiveContext(row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, 'activeContexts', row.id)
    await upsertRecord(client, 'activeContexts', row, { operation: current ? 'update' : 'insert', expectedVersion: current ? current.version : null, idempotencyKey: `activeContexts:${row.id}:${row.updatedAt || Date.now()}` })
    return row
  }, { userId: row.userId || null })
}
export async function insertAudit(row, collectionName = 'verificationAuditLogs') {
  return withPlatformTransaction(client => upsertRecord(client, collectionName, row, { operation: 'insert', idempotencyKey: `${collectionName}:${row.id}` }), { userId: row.userId || null })
}
export async function insertRow(collectionName, row) {
  return withPlatformTransaction(client => upsertRecord(client, collectionName, row, { operation: 'insert', idempotencyKey: `${collectionName}:${row.id}` }), { userId: row.userId || null })
}

async function upsertScoped(client, collectionName, row) {
  const current = await getRecord(client, collectionName, row.id)
  await upsertRecord(client, collectionName, row, { operation: current ? 'update' : 'insert', expectedVersion: current ? current.version : null, idempotencyKey: `${collectionName}:${row.id}:${row.updatedAt || row.createdAt || Date.now()}` })
  return row
}

// Loads the owner-scoped collections, runs a pure mutation on the db bundle and
// writes every row in those collections back (idempotent — the bundles are
// small per user). Append-only rows the mutation returns under `append` are
// inserted without loading prior rows.
export async function applyScopedMutation(userId, collections, mutate, extras = null) {
  return withPlatformTransaction(async client => {
    const db = {}
    for (const name of collections) {
      if (name === 'profiles') { const profile = await getRecord(client, 'profiles', userId); db.profiles = profile ? [profile] : [] }
      else db[name] = await listRecordsForOwner(client, name, userId, { ownerFields: OWNER_FIELDS[name] || ['userId'] })
    }
    if (extras) Object.assign(db, await extras(client))
    const out = mutate(db) || {}
    const result = Object.prototype.hasOwnProperty.call(out, 'result') ? out.result : out
    for (const name of collections) {
      const rows = name === 'profiles' ? (db.profiles || []) : (db[name] || [])
      for (const row of rows) if (row?.id) await upsertScoped(client, name, row)
    }
    for (const item of out.append || []) await upsertScoped(client, item.collection, item.row)
    return result
  }, { userId })
}

// Same as applyScopedMutation for the global catalogs (capability policies and
// billing plans) that carry no owner.
export async function applyGlobalMutation(mutate) {
  return withPlatformTransaction(async client => {
    const db = {}
    for (const name of GLOBAL_COLLECTIONS) db[name] = await listRecords(client, name, {})
    const out = mutate(db) || {}
    const result = Object.prototype.hasOwnProperty.call(out, 'result') ? out.result : out
    for (const name of GLOBAL_COLLECTIONS) {
      for (const row of db[name] || []) if (row?.id) await upsertScoped(client, name, row)
    }
    for (const item of out.append || []) await upsertScoped(client, item.collection, item.row)
    return result
  })
}

export async function appendRow(collectionName, row) {
  return withPlatformTransaction(client => upsertScoped(client, collectionName, row), { userId: row.userId || null })
}

// Read-only helper inputs.
export async function loadWorkspace(workspaceId) {
  return withPlatformTransaction(client => getRecord(client, 'workspaces', workspaceId))
}
export async function listWorkspaceMembers(workspaceId) {
  return withPlatformTransaction(client => listRecords(client, 'workspaceMembers', { workspaceId }))
}
export async function loadProfileRow(userId) {
  return withPlatformTransaction(client => getRecord(client, 'profiles', userId))
}
export async function listOwned(userId, collectionName, ownerFields = ['userId']) {
  return withPlatformTransaction(client => listRecordsForOwner(client, collectionName, userId, { ownerFields }))
}
export { AUDIT_COLLECTIONS }
