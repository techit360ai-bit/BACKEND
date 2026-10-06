import fs from 'node:fs/promises'
import pg from 'pg'
import { loadAuthoritySnapshot } from '../config/database.js'

let pool = null
let timer = null
const url = () => process.env.WORKSPACE_DATABASE_URL || process.env.DATABASE_URL
const date = value => value || new Date().toISOString()
const json = value => JSON.stringify(value || {})

export async function syncWorkspaceProjectProjection() {
  if (!pool) return { enabled: false }
  const db = await loadAuthoritySnapshot()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const row of db.projects || []) await client.query(`INSERT INTO core_projects(id,owner_id,organization_id,title,stage,visibility,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET owner_id=EXCLUDED.owner_id,organization_id=EXCLUDED.organization_id,title=EXCLUDED.title,stage=EXCLUDED.stage,visibility=EXCLUDED.visibility,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`, [row.id, row.ownerId || row.userId || null, row.organizationId || null, row.title || row.name || null, row.stage || null, row.visibility || null, json(row), date(row.createdAt), date(row.updatedAt)])
    for (const row of db.workspaces || []) await client.query(`INSERT INTO core_workspaces(id,owner_id,project_id,organization_id,name,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET owner_id=EXCLUDED.owner_id,project_id=EXCLUDED.project_id,organization_id=EXCLUDED.organization_id,name=EXCLUDED.name,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`, [row.id, row.ownerId || null, row.projectId || null, row.organizationId || null, row.name || row.title || null, row.status || null, json(row), date(row.createdAt), date(row.updatedAt)])
    for (const row of db.workspaceMembers || []) await client.query(`INSERT INTO core_workspace_members(id,workspace_id,user_id,role,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role,status=EXCLUDED.status,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`, [row.id, row.workspaceId, row.userId, row.role || null, row.status || null, json(row), date(row.createdAt || row.joinedAt), date(row.updatedAt)])
    for (const row of db.workspaceTasks || []) await client.query(`INSERT INTO core_workspace_tasks(id,workspace_id,project_id,assignee_id,status,title,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET workspace_id=EXCLUDED.workspace_id,project_id=EXCLUDED.project_id,assignee_id=EXCLUDED.assignee_id,status=EXCLUDED.status,title=EXCLUDED.title,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`, [row.id, row.workspaceId || null, row.projectId || null, row.assigneeId || row.assignedTo || null, row.status || null, row.title || row.name || null, json(row), date(row.createdAt), date(row.updatedAt)])
    const ids = { projects: (db.projects || []).map(row => row.id), workspaces: (db.workspaces || []).map(row => row.id), members: (db.workspaceMembers || []).map(row => row.id), tasks: (db.workspaceTasks || []).map(row => row.id) }
    await client.query('DELETE FROM core_projects WHERE id <> ALL($1::text[])', [ids.projects])
    await client.query('DELETE FROM core_workspaces WHERE id <> ALL($1::text[])', [ids.workspaces])
    await client.query('DELETE FROM core_workspace_members WHERE id <> ALL($1::text[])', [ids.members])
    await client.query('DELETE FROM core_workspace_tasks WHERE id <> ALL($1::text[])', [ids.tasks])
    const count = await client.query(`SELECT (SELECT count(*) FROM core_projects) AS projects,(SELECT count(*) FROM core_workspaces) AS workspaces,(SELECT count(*) FROM core_workspace_members) AS members,(SELECT count(*) FROM core_workspace_tasks) AS tasks`)
    await client.query('COMMIT')
    const actual = Object.fromEntries(Object.entries(count.rows[0]).map(([key, value]) => [key, Number(value)]))
    const expected = { projects: ids.projects.length, workspaces: ids.workspaces.length, members: ids.members.length, tasks: ids.tasks.length }
    const mismatches = Object.fromEntries(Object.keys(expected).filter(key => actual[key] !== expected[key]).map(key => [key, { expected: expected[key], actual: actual[key] }]))
    return { enabled: true, ...actual, expected, mismatches, consistent: Object.keys(mismatches).length === 0 }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function initializeWorkspaceProjectProjection() {
  if (!url()) return { enabled: false }
  pool = new pg.Pool({ connectionString: url(), max: Math.max(1, Number(process.env.WORKSPACE_DB_POOL_SIZE || 5)), connectionTimeoutMillis: Number(process.env.WORKSPACE_DB_CONNECTION_TIMEOUT_MS || 5000), ssl: /sslmode=require/.test(url()) ? { rejectUnauthorized: process.env.WORKSPACE_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
  const sql = await fs.readFile(new URL('../../migrations/postgres/011_core_workspace_project_projection.sql', import.meta.url), 'utf8')
  await pool.query(sql)
  const initial = await syncWorkspaceProjectProjection()
  const interval = Math.max(5000, Number(process.env.WORKSPACE_PROJECTION_INTERVAL_MS || 30000))
  timer = setInterval(() => syncWorkspaceProjectProjection().catch(error => console.error(JSON.stringify({ event: 'workspace_project_projection_failed', error: error.message }))), interval)
  timer.unref?.()
  return { enabled: true, ...initial }
}

export async function closeWorkspaceProjectProjection() {
  if (timer) clearInterval(timer)
  timer = null
  if (pool) await pool.end()
  pool = null
}
