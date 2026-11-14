// Scoped platform data for the Plugins-MCP boundary hooks in app.js.
//
// The MCP actor resolver and invocation hooks run the existing synchronous
// policy code (organizationResourceAccess, authorizeCodeDestination,
// projectCodeCommit). Under DB_DRIVER=postgres the synchronous authority store
// throws outside a bounded scope, which made every MCP request resolve to
// "no actor" (401 in production). This repository loads only the rows those
// hooks read, runs them in `runBoundedDatabase`, and persists only the rows
// they append. On the JSON/SQLite drivers the hooks run unchanged.
import { currentDriver, runBoundedDatabase } from '../config/database.js'
import { listRecordsByFieldIn, listRecordsByIds, upsertRecord, withPlatformTransaction } from './platformCollectionRepository.js'

export const MCP_WRITE_COLLECTIONS = ['contributions', 'projectActivities', 'workspaceReports', 'organizationActivityEvents']

export function mcpScopedStoreEnabled() {
  return currentDriver() === 'postgres'
}

function mergeById(target, rows) {
  const seen = new Set(target.map(row => String(row.id)))
  for (const row of rows) if (row?.id && !seen.has(String(row.id))) { target.push(row); seen.add(String(row.id)) }
}

export async function loadMcpBundle(client, { userId = null, workspaceId = null, projectId = null, integrationId = null } = {}) {
  const db = {
    workspaces: [], projects: [], workspaceConnectors: [], workspaceMembers: [],
    organizationIntegrations: [], organizationMemberships: [], programEnrollments: [],
    contributions: [], projectActivities: [], workspaceReports: [], organizationActivityEvents: [],
  }
  if (workspaceId) mergeById(db.workspaces, await listRecordsByIds(client, 'workspaces', [workspaceId]))
  const projectIds = [...new Set([projectId, ...db.workspaces.map(row => row.projectId)].filter(Boolean).map(String))]
  if (projectIds.length) {
    mergeById(db.projects, await listRecordsByIds(client, 'projects', projectIds))
    mergeById(db.workspaces, await listRecordsByFieldIn(client, 'workspaces', 'projectId', projectIds))
    // Idempotency for code-commit projection (same commit, same project).
    mergeById(db.contributions, await listRecordsByFieldIn(client, 'contributions', 'projectId', projectIds))
  }
  const workspaceIds = db.workspaces.map(row => row.id)
  if (workspaceIds.length) {
    mergeById(db.workspaceConnectors, await listRecordsByFieldIn(client, 'workspaceConnectors', 'workspaceId', workspaceIds))
    mergeById(db.workspaceMembers, await listRecordsByFieldIn(client, 'workspaceMembers', 'workspaceId', workspaceIds))
  }
  if (integrationId) mergeById(db.organizationIntegrations, await listRecordsByIds(client, 'organizationIntegrations', [integrationId]))
  if (userId) {
    mergeById(db.organizationMemberships, await listRecordsByFieldIn(client, 'organizationMemberships', 'userId', [userId]))
    mergeById(db.programEnrollments, await listRecordsByFieldIn(client, 'programEnrollments', 'founderId', [userId]))
  }
  return db
}

// Run `fn` against the scoped bundle. With `write: true` rows appended to (or
// changed in) MCP_WRITE_COLLECTIONS are persisted in the same transaction.
export async function withMcpAuthority(scope, fn, { write = false } = {}) {
  if (!mcpScopedStoreEnabled()) return fn()
  return withPlatformTransaction(async client => {
    const db = await loadMcpBundle(client, scope)
    const originals = new Map()
    for (const name of MCP_WRITE_COLLECTIONS) for (const row of db[name]) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runBoundedDatabase(db, async () => fn())
    if (write) {
      for (const name of MCP_WRITE_COLLECTIONS) {
        for (const row of db[name] || []) {
          if (!row?.id) continue
          const key = `${name}:${row.id}`
          const next = JSON.stringify(row)
          if (originals.get(key) === next) continue
          await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `mcp:${key}:${next.length}` })
        }
      }
    }
    return result
  }, { userId: scope?.userId || null })
}
