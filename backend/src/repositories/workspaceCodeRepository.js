import { readDb as readAuthorityDb } from '../config/database.js'
import { withPlatformTransaction, upsertRecord, listRecords } from './platformCollectionRepository.js'

const collections = ['projectFiles', 'projectFileVersions', 'codeChangeEvents', 'codeRuntimeSessions', 'codeSyncStates', 'codeBridgeGrants', 'codeBridgeSessions', 'codeDeploymentRecords', 'codeDeploymentVerifications', 'codeExecutionRuns', 'codeExecutionStepEvents', 'codeReviewDecisions']
const enabled = () => process.env.WORKSPACE_CODE_SOURCE === 'postgres' || process.env.WORKSPACE_CODE_WRITE_SOURCE === 'postgres' || process.env.WORKSPACE_CODE_READ_SOURCE === 'postgres'
const fallback = () => process.env.WORKSPACE_CODE_FALLBACK_SQLITE !== 'false'

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

export function workspaceCodeEnabled() { return enabled() }
export function workspaceCodeFallbackEnabled() { return fallback() }
