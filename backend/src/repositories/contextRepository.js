// Row-level session-context store (§5 cutover).
//
// The state machine, session log, checkpoints and pre-computed suggestions live
// in platform_collection_records, and the cross-domain evidence that derives the
// state is read with bounded per-collection owner queries, so the context and
// session flows never load the whole-database snapshot. Enabled with
// CONTEXT_SOURCE=postgres; the snapshot fallback is retained in the service.
import { withPlatformTransaction, getRecord, upsertRecord, listRecordsForOwner } from './platformCollectionRepository.js'

// Collections the context engine derives from, with the owner-bearing field(s)
// each may use. The state/log/checkpoint collections are written by this domain.
const SOURCE_OWNER_FIELDS = {
  projects: ['ownerId', 'userId'],
  projectAnalyses: ['ownerId', 'userId'],
  workspaces: ['ownerId', 'userId'],
  opportunityApplications: ['applicantId', 'userId'],
  contributions: ['collaboratorId', 'userId'],
  equityGrants: ['collaboratorId', 'userId'],
  investorWatchlists: ['ownerId', 'investorId', 'userId'],
  dealRooms: ['investorId'],
  hackathons: ['ownerId'],
  userStateMachine: ['userId'],
  userSessionLogs: ['userId'],
  userContextCheckpoints: ['userId'],
  userSuggestions: ['userId'],
  notifications: ['userId'],
}

export function contextStoreEnabled() {
  return ['CONTEXT_SOURCE', 'CONTEXT_READ_SOURCE', 'CONTEXT_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function contextFallbackEnabled() { return process.env.CONTEXT_FALLBACK_SQLITE !== 'false' }

export async function loadContextSources(userId) {
  return withPlatformTransaction(async client => {
    const out = {}
    for (const [collection, ownerFields] of Object.entries(SOURCE_OWNER_FIELDS)) {
      out[collection] = await listRecordsForOwner(client, collection, userId, { ownerFields })
    }
    return out
  })
}

export async function loadProfile(userId) {
  return withPlatformTransaction(client => getRecord(client, 'profiles', userId))
}

export async function saveContextRow(collection, row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, collection, row.id)
    await upsertRecord(client, collection, row, {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `${collection}:${row.id}:${row.updatedAt || Date.now()}`,
    })
    return row
  }, { userId: row.userId || null })
}

export async function deleteContextCheckpoint(userId, checkpointType, referenceId) {
  return withPlatformTransaction(async client => {
    const rows = await listRecordsForOwner(client, 'userContextCheckpoints', userId, { ownerFields: ['userId'] })
    let removed = 0
    for (const row of rows.filter(item => item.checkpointType === checkpointType && item.referenceId === referenceId)) {
      const result = await client.query(
        'UPDATE platform_collection_records SET deleted_at=now(), version=version+1, updated_at=now() WHERE collection_name=$1 AND record_id=$2 AND deleted_at IS NULL',
        ['userContextCheckpoints', row.id],
      )
      removed += result.rowCount
    }
    return removed
  }, { userId })
}
