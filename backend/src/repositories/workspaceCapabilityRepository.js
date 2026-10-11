// Row-level workspace-capability store (§5 cutover).
//
// Build profiles/estimates/preview, lifecycle events, BYOK model connections,
// workspace model bindings and hackathon project entries live in
// platform_collection_records instead of the whole-database snapshot. Enabled
// with WORKSPACE_CAPABILITY_SOURCE=postgres; the snapshot fallback is retained
// in the service until the authority is deleted.
import {
  withPlatformTransaction,
  getRecord,
  upsertRecord,
  deleteRecord,
  listRecords,
  listRecordsForOwner,
  listRecordsByField,
} from './platformCollectionRepository.js'

export function workspaceCapabilityEnabled() {
  return ['WORKSPACE_CAPABILITY_SOURCE', 'WORKSPACE_CAPABILITY_READ_SOURCE', 'WORKSPACE_CAPABILITY_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function workspaceCapabilityFallbackEnabled() { return process.env.WORKSPACE_CAPABILITY_FALLBACK_SQLITE !== 'false' }

// Mirrors the service's workspaceFor(): owner is ownerId only.
export async function workspaceAccess(workspaceId, userId) {
  return withPlatformTransaction(async client => {
    const workspace = await getRecord(client, 'workspaces', workspaceId)
    if (!workspace) return null
    const owner = workspace.ownerId === userId
    const memberships = await listRecordsForOwner(client, 'workspaceMembers', userId, { ownerFields: ['userId'] })
    const member = memberships.find(row => row.workspaceId === workspaceId && row.status === 'active') || null
    return owner || member ? { workspace, owner, member } : null
  })
}

export async function findById(collectionName, rowId) {
  return withPlatformTransaction(client => getRecord(client, collectionName, rowId))
}

export async function findByWorkspace(collectionName, workspaceId) {
  return withPlatformTransaction(client => listRecords(client, collectionName, { workspaceId }))
}

export async function listByOwner(collectionName, userId, ownerFields = ['userId']) {
  return withPlatformTransaction(client => listRecordsForOwner(client, collectionName, userId, { ownerFields }))
}

export async function findByField(collectionName, field, value) {
  return withPlatformTransaction(client => listRecordsByField(client, collectionName, field, value))
}

export async function insert(collectionName, row) {
  return withPlatformTransaction(
    client => upsertRecord(client, collectionName, row, { operation: 'insert', idempotencyKey: `${collectionName}:${row.id}` }),
    { userId: row.userId || row.createdBy || row.actorId || null },
  )
}

export async function save(collectionName, row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, collectionName, row.id)
    await upsertRecord(client, collectionName, row, {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `${collectionName}:${row.id}:${row.updatedAt || Date.now()}`,
    })
    return row
  }, { userId: row.userId || row.createdBy || row.actorId || null })
}

export async function remove(collectionName, rowId) {
  return withPlatformTransaction(client => deleteRecord(client, collectionName, rowId))
}
