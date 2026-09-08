import pg from 'pg'
import { readDb as readAuthorityDb } from '../config/database.js'
import { withPlatformTransaction, upsertRecord } from './platformCollectionRepository.js'

let pool = null
const url = () => process.env.WORKSPACE_DATABASE_URL || process.env.DATABASE_URL
const enabled = () => process.env.WORKSPACE_READ_SOURCE === 'postgres'
const fallback = () => process.env.WORKSPACE_READ_FALLBACK_SQLITE !== 'false'

function getPool() {
  if (!url()) throw new Error('WORKSPACE_DATABASE_URL or DATABASE_URL is required for PostgreSQL workspace reads')
  pool ||= new pg.Pool({ connectionString: url(), max: Math.max(1, Number(process.env.WORKSPACE_READ_POOL_SIZE || 5)), connectionTimeoutMillis: Number(process.env.WORKSPACE_DB_CONNECTION_TIMEOUT_MS || 5000), ssl: /sslmode=require/.test(url()) ? { rejectUnauthorized: process.env.WORKSPACE_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
  return pool
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
  const result = await getPool().query('SELECT * FROM core_workspaces WHERE id=$1', [workspaceId])
  return result.rows[0] ? payload(result.rows[0]) : null
}

export async function listWorkspaces(userId) {
  const result = await getPool().query(`SELECT w.*,m.id AS membership_id,m.user_id AS membership_user_id,m.role AS membership_role,m.status AS membership_status,m.payload AS membership_payload FROM core_workspaces w LEFT JOIN core_workspace_members m ON m.workspace_id=w.id AND m.user_id=$1 AND m.status='active' WHERE w.owner_id=$1 OR m.user_id=$1 ORDER BY w.updated_at DESC`, [userId])
  return result.rows.map(row => ({ workspace: payload(row), membership: row.membership_id ? { ...(row.membership_payload || {}), id: row.membership_id, workspaceId: row.id, userId: row.membership_user_id, role: row.membership_role, status: row.membership_status } : null }))
}

export async function listMembers(workspaceId) {
  const result = await getPool().query('SELECT * FROM core_workspace_members WHERE workspace_id=$1 AND status=\'active\' ORDER BY created_at ASC', [workspaceId])
  return result.rows.map(row => ({ ...(row.payload || {}), id: row.id, workspaceId: row.workspace_id, userId: row.user_id, role: row.role, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }))
}
export async function syncWorkspaceProjectAggregate(actorId, workspaceId = null, projectId = null) {
  if (process.env.WORKSPACE_WRITE_SOURCE !== 'postgres') return { enabled: false }
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

export async function closeWorkspaceProjectRepository() { if (pool) await pool.end(); pool = null }
export function workspaceReadEnabled() { return enabled() }
export function workspaceReadFallbackEnabled() { return fallback() }
