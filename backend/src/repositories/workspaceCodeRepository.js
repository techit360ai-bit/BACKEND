import { readAuthorityDb } from '../config/database.js'
import {
  withPlatformTransaction,
  getRecord,
  upsertRecord,
  deleteRecord,
  listRecords,
  listRecordsForOwner,
  listRecordsByField,
} from './platformCollectionRepository.js'

const collections = ['projectFiles', 'projectFileVersions', 'codeChangeEvents', 'codeRuntimeSessions', 'codeSyncStates', 'codeBridgeGrants', 'codeBridgeSessions', 'codeDeploymentRecords', 'codeDeploymentVerifications', 'codeExecutionRuns', 'codeExecutionStepEvents', 'codeReviewDecisions']
const enabled = () => process.env.WORKSPACE_CODE_SOURCE === 'postgres' || process.env.WORKSPACE_CODE_WRITE_SOURCE === 'postgres' || process.env.WORKSPACE_CODE_READ_SOURCE === 'postgres'
const fallback = () => process.env.WORKSPACE_CODE_FALLBACK_SQLITE !== 'false'

export function workspaceCodeEnabled() { return enabled() }
export function workspaceCodeFallbackEnabled() { return fallback() }

export async function syncWorkspaceCode(workspaceId, userId = null) {
  if (!enabled()) return { enabled: false }
  const db = readAuthorityDb()
  return withPlatformTransaction(async client => {
    let records = 0
    for (const collectionName of collections) {
      for (const row of (db[collectionName] || []).filter(item => item.workspaceId === workspaceId)) {
        await upsertRecord(client, collectionName, row, { operation: 'replay', idempotencyKey: `workspace-code:${collectionName}:${row.id}:${row.updatedAt || row.createdAt || ''}` })
        records += 1
      }
    }
    return { enabled: true, workspaceId, records }
  }, { userId })
}

export async function listWorkspaceCode(workspaceId, collectionName) {
  if (!enabled()) return null
  return withPlatformTransaction(client => listRecords(client, collectionName, { workspaceId }))
}

// --- Row-level primitives for the code-workspace service path ---------------
export async function loadById(collectionName, rowId) {
  return withPlatformTransaction(client => getRecord(client, collectionName, rowId))
}

export async function listByWorkspace(collectionName, workspaceId) {
  return withPlatformTransaction(client => listRecords(client, collectionName, { workspaceId }))
}

export async function findByWorkspacePath(collectionName, workspaceId, path) {
  return withPlatformTransaction(async client => {
    const rows = await listRecords(client, collectionName, { workspaceId })
    return rows.find(row => row.path === path) || null
  })
}

export async function listByField(collectionName, field, value) {
  return withPlatformTransaction(client => listRecordsByField(client, collectionName, field, value))
}

export async function listByOwner(collectionName, userId, ownerFields = ['userId']) {
  return withPlatformTransaction(client => listRecordsForOwner(client, collectionName, userId, { ownerFields }))
}

export async function insertRow(collectionName, row) {
  return withPlatformTransaction(
    client => upsertRecord(client, collectionName, row, { operation: 'insert', idempotencyKey: `${collectionName}:${row.id}` }),
    { userId: row.userId || row.actorId || row.createdBy || null },
  )
}

export async function saveRow(collectionName, row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, collectionName, row.id)
    await upsertRecord(client, collectionName, row, {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `${collectionName}:${row.id}:${row.updatedAt || Date.now()}`,
    })
    return row
  }, { userId: row.userId || row.actorId || row.createdBy || null })
}

export async function deleteRow(collectionName, rowId) {
  return withPlatformTransaction(client => deleteRecord(client, collectionName, rowId))
}

// Access control inputs, read scoped instead of from the whole-DB snapshot.
export async function loadWorkspace(workspaceId) {
  return withPlatformTransaction(client => getRecord(client, 'workspaces', workspaceId))
}
export async function loadWorkspaceMember(workspaceId, userId) {
  return withPlatformTransaction(async client => {
    const rows = await listRecordsForOwner(client, 'workspaceMembers', userId, { ownerFields: ['userId'] })
    return rows.find(row => row.workspaceId === workspaceId && row.status === 'active') || null
  })
}
export async function collaboratorIsPaid(userId) {
  return withPlatformTransaction(async client => {
    const entitlements = await listRecordsForOwner(client, 'accountEntitlements', userId, { ownerFields: ['userId'] })
    if (entitlements.some(row => ['active', 'trialing', 'grace_period'].includes(row.status))) return true
    const subscriptions = await listRecordsForOwner(client, 'subscriptions', userId, { ownerFields: ['userId'] })
    if (subscriptions.some(row => ['active', 'trialing', 'grace_period'].includes(row.status))) return true
    const ledger = await listRecordsForOwner(client, 'creditLedger', userId, { ownerFields: ['userId'] })
    return ledger.some(row => ['credit_purchase', 'credits_purchased', 'subscription_purchase'].includes(row.type) && Number(row.deltaCredits ?? row.credits ?? 0) > 0)
  })
}
export async function firstCollaboratorWorkspace(userId) {
  return withPlatformTransaction(async client => {
    const members = await listRecordsForOwner(client, 'workspaceMembers', userId, { ownerFields: ['userId'] })
    const collaborators = members.filter(row => row.status === 'active' && String(row.role || '').toLowerCase() === 'collaborator').sort((a, b) => new Date(a.joinedAt || a.createdAt || 0) - new Date(b.joinedAt || b.createdAt || 0))
    return collaborators[0]?.workspaceId || null
  })
}
