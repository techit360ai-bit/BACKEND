import { currentBoundedDatabase, currentDriver, readAuthorityDb } from '../config/database.js'
import { withPlatformTransaction, upsertRecord, getPlatformPool, closePlatformPool, mapRow } from './platformCollectionRepository.js'

const url = () => process.env.WORKSPACE_DATABASE_URL || process.env.DATABASE_URL
const enabled = () => process.env.WORKSPACE_READ_SOURCE === 'postgres'
const fallback = () => process.env.WORKSPACE_READ_FALLBACK_SQLITE !== 'false'

function getPool() {
  if (!url()) throw new Error('WORKSPACE_DATABASE_URL or DATABASE_URL is required for PostgreSQL workspace reads')
  return getPlatformPool()
}

const payload = row => {
  const result = { ...(row.payload || {}), id: row.id }
  for (const [key, value] of Object.entries({ ownerId: row.owner_id, organizationId: row.organization_id, projectId: row.project_id, title: row.title, stage: row.stage, visibility: row.visibility, name: row.name, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at })) if (value !== null && value !== undefined) result[key] = value
  return result
}

export async function listProjects(userId) {
  const result = await getPool().query('SELECT * FROM core_projects WHERE owner_id=$1 ORDER BY updated_at DESC', [userId])
  return result.rows.map(payload)
}

export async function findWorkspace(workspaceId) {
  const result = await getPool().query(`SELECT w.*,cr.payload AS cofounder_payload FROM core_workspaces w LEFT JOIN platform_collection_records cr ON cr.collection_name='cofounderRelationships' AND cr.record_id=w.payload->>'cofounderRelationshipId' AND cr.deleted_at IS NULL WHERE w.id=$1`, [workspaceId])
  if (!result.rows[0]) return null
  const workspace = payload(result.rows[0])
  if (result.rows[0].cofounder_payload) {
    workspace.cofounderStatus = result.rows[0].cofounder_payload.status || null
    workspace.cofounderFounderId = result.rows[0].cofounder_payload.founderId || null
    workspace.cofounderCofounderId = result.rows[0].cofounder_payload.cofounderId || null
  }
  return workspace
}

export async function listWorkspaces(userId) {
  const result = await getPool().query(`SELECT w.*,m.id AS membership_id,m.user_id AS membership_user_id,m.role AS membership_role,m.status AS membership_status,m.payload AS membership_payload,cr.payload AS cofounder_payload FROM core_workspaces w LEFT JOIN core_workspace_members m ON m.workspace_id=w.id AND m.user_id=$1 AND m.status='active' LEFT JOIN platform_collection_records cr ON cr.collection_name='cofounderRelationships' AND cr.record_id=w.payload->>'cofounderRelationshipId' AND cr.deleted_at IS NULL WHERE (w.owner_id=$1 OR m.user_id=$1) AND (w.payload->>'cofounderRelationshipId' IS NULL OR (cr.payload->>'status'='ACTIVE' AND $1 IN (cr.payload->>'founderId',cr.payload->>'cofounderId'))) ORDER BY w.updated_at DESC`, [userId])
  return result.rows.map(row => {
    const workspace = payload(row)
    if (row.cofounder_payload) {
      workspace.cofounderStatus = row.cofounder_payload.status || null
      workspace.cofounderFounderId = row.cofounder_payload.founderId || null
      workspace.cofounderCofounderId = row.cofounder_payload.cofounderId || null
    }
    return { workspace, membership: row.membership_id ? { ...(row.membership_payload || {}), id: row.membership_id, workspaceId: row.id, userId: row.membership_user_id, role: row.membership_role, status: row.membership_status } : null }
  })
}

export async function listMembers(workspaceId) {
  const result = await getPool().query('SELECT * FROM core_workspace_members WHERE workspace_id=$1 AND status=\'active\' ORDER BY created_at ASC', [workspaceId])
  return result.rows.map(row => ({ ...(row.payload || {}), id: row.id, workspaceId: row.workspace_id, userId: row.user_id, role: row.role, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }))
}
export async function syncWorkspaceProjectAggregate(actorId, workspaceId = null, projectId = null) {
  if (process.env.WORKSPACE_WRITE_SOURCE !== 'postgres') return { enabled: false }
  // Under DB_DRIVER=postgres the row-level domain writers already persisted the
  // aggregate; the snapshot replay below would throw (readAuthorityDb) and turn a
  // successful write into workspace_project_write_temporarily_unavailable. Project
  // the touched aggregate into the core_* read tables instead, so a workspace is
  // readable immediately rather than after the next periodic projection.
  if (currentDriver() === 'postgres' && !currentBoundedDatabase()) return projectWorkspaceAggregate(actorId, workspaceId, projectId)
  const db = readAuthorityDb()
  return withPlatformTransaction(async client => {
    const sets = {
      projects: (db.projects || []).filter(row => !projectId || row.id === projectId),
      workspaces: (db.workspaces || []).filter(row => !workspaceId && !projectId ? row.ownerId === actorId : row.id === workspaceId || row.projectId === projectId),
      workspaceMembers: (db.workspaceMembers || []).filter(row => !workspaceId || row.workspaceId === workspaceId),
      workspaceTasks: (db.workspaceTasks || []).filter(row => !workspaceId || row.workspaceId === workspaceId),
    }
    let records = 0
    for (const [collectionName, rows] of Object.entries(sets)) for (const row of rows) { await upsertRecord(client, collectionName, row, { operation: 'replay', idempotencyKey: `workspace-project:${collectionName}:${row.id}:${row.updatedAt || row.createdAt || ''}` }); records += 1 }
    return { enabled: true, records }
  }, { userId: actorId })
}

export async function closeWorkspaceProjectRepository() { await closePlatformPool() }
export function workspaceReadEnabled() { return enabled() }
export function workspaceReadFallbackEnabled() { return fallback() }

const isoDate = value => (value instanceof Date ? value.toISOString() : value) || new Date().toISOString()
const asJson = value => JSON.stringify(value || {})

// Rows of one collection, including soft-deleted ones so removals propagate.
async function aggregateRows(client, collection, where, params) {
  const result = await client.query(`SELECT * FROM platform_collection_records WHERE collection_name=$1 AND ${where}`, [collection, ...params])
  return result.rows.map(row => ({ ...mapRow(row), deleted: Boolean(row.deleted_at) }))
}

// Write-through projection of one workspace/project aggregate into the core_*
// read tables (same column mapping as workspaceProjectPostgresProjection).
async function projectWorkspaceAggregate(actorId, workspaceId = null, projectId = null) {
  return withPlatformTransaction(async client => {
    const workspaces = []
    const projects = []
    if (workspaceId) workspaces.push(...await aggregateRows(client, 'workspaces', 'record_id=$2', [String(workspaceId)]))
    const projectIds = [...new Set([projectId, ...workspaces.map(row => row.projectId)].filter(Boolean).map(String))]
    if (projectIds.length) {
      projects.push(...await aggregateRows(client, 'projects', 'record_id = ANY($2::text[])', [projectIds]))
      for (const row of await aggregateRows(client, 'workspaces', 'project_id = ANY($2::text[])', [projectIds])) if (!workspaces.some(item => item.id === row.id)) workspaces.push(row)
    }
    if (!workspaceId && !projectId && actorId) {
      projects.push(...await aggregateRows(client, 'projects', 'owner_id=$2', [String(actorId)]))
      workspaces.push(...await aggregateRows(client, 'workspaces', 'owner_id=$2', [String(actorId)]))
    }
    const workspaceIds = workspaces.map(row => String(row.id))
    const members = workspaceIds.length ? await aggregateRows(client, 'workspaceMembers', 'workspace_id = ANY($2::text[])', [workspaceIds]) : []
    const tasks = workspaceIds.length ? await aggregateRows(client, 'workspaceTasks', 'workspace_id = ANY($2::text[])', [workspaceIds]) : []
    for (const row of projects) {
      if (row.deleted) { await client.query('DELETE FROM core_projects WHERE id=$1', [row.id]); continue }
      await client.query('INSERT INTO core_projects(id,owner_id,organization_id,title,stage,visibility,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET owner_id=EXCLUDED.owner_id,organization_id=EXCLUDED.organization_id,title=EXCLUDED.title,stage=EXCLUDED.stage,visibility=EXCLUDED.visibility,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at', [row.id, row.ownerId || row.userId || null, row.organizationId || null, row.title || row.name || null, row.stage || null, row.visibility || null, asJson(row), isoDate(row.createdAt), isoDate(row.updatedAt)])
    }
    for (const row of workspaces) {
      if (row.deleted) { await client.query('DELETE FROM core_workspaces WHERE id=$1', [row.id]); continue }
      await client.query('INSERT INTO core_workspaces(id,owner_id,project_id,organization_id,name,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET owner_id=EXCLUDED.owner_id,project_id=EXCLUDED.project_id,organization_id=EXCLUDED.organization_id,name=EXCLUDED.name,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at', [row.id, row.ownerId || null, row.projectId || null, row.organizationId || null, row.name || row.title || null, row.status || null, asJson(row), isoDate(row.createdAt), isoDate(row.updatedAt)])
    }
    for (const row of members) {
      if (row.deleted || !row.workspaceId || !row.userId) { await client.query('DELETE FROM core_workspace_members WHERE id=$1', [row.id]); continue }
      await client.query('INSERT INTO core_workspace_members(id,workspace_id,user_id,role,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at', [row.id, row.workspaceId, row.userId, row.role || null, row.status || null, asJson(row), isoDate(row.createdAt || row.joinedAt), isoDate(row.updatedAt)])
    }
    for (const row of tasks) {
      if (row.deleted) { await client.query('DELETE FROM core_workspace_tasks WHERE id=$1', [row.id]); continue }
      await client.query('INSERT INTO core_workspace_tasks(id,workspace_id,project_id,assignee_id,status,title,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET workspace_id=EXCLUDED.workspace_id,project_id=EXCLUDED.project_id,assignee_id=EXCLUDED.assignee_id,status=EXCLUDED.status,title=EXCLUDED.title,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at', [row.id, row.workspaceId || null, row.projectId || null, row.assigneeId || row.assignedTo || null, row.status || null, row.title || row.name || null, asJson(row), isoDate(row.createdAt), isoDate(row.updatedAt)])
    }
    return { enabled: true, projected: { projects: projects.length, workspaces: workspaces.length, members: members.length, tasks: tasks.length } }
  }, { userId: actorId })
}
