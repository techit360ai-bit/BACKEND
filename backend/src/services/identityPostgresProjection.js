import fs from 'node:fs/promises'
import pg from 'pg'
import { readDb } from '../config/database.js'

let pool = null
let timer = null
const connectionUrl = () => process.env.IDENTITY_DATABASE_URL || process.env.DATABASE_URL
const date = value => value || new Date().toISOString()
const json = value => JSON.stringify(value || {})

export function identityProjectionEnabled() { return Boolean(connectionUrl()) }

export async function syncIdentityProjection() {
  if (!pool) return { enabled: false, users: 0, profiles: 0, roles: 0, contexts: 0 }
  const db = readDb()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const user of db.users || []) {
      await client.query(`INSERT INTO core_users(id,email,password_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,updated_at=EXCLUDED.updated_at`, [user.id, user.email, user.passwordHash, date(user.createdAt), date(user.updatedAt)])
    }
    for (const profile of db.profiles || []) {
      await client.query(`INSERT INTO core_profiles(id,email,first_name,last_name,username,role,workspace_id,is_verified,is_onboarded,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,username=EXCLUDED.username,role=EXCLUDED.role,workspace_id=EXCLUDED.workspace_id,is_verified=EXCLUDED.is_verified,is_onboarded=EXCLUDED.is_onboarded,payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at`, [profile.id, profile.email, profile.firstName || null, profile.lastName || null, profile.username || null, profile.role || 'explorer', profile.workspaceId || null, Boolean(profile.isVerified), Boolean(profile.isOnboarded), json(profile), date(profile.createdAt), date(profile.updatedAt)])
    }
    for (const role of db.userRoles || []) {
      await client.query(`INSERT INTO core_user_roles(id,user_id,role,status,active,assurance,is_primary,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,role) DO UPDATE SET status=EXCLUDED.status,active=EXCLUDED.active,assurance=EXCLUDED.assurance,is_primary=EXCLUDED.is_primary,updated_at=EXCLUDED.updated_at`, [role.id, role.userId, role.role, role.status || 'active', role.active !== false, role.assurance || null, Boolean(role.isPrimary), date(role.createdAt), date(role.updatedAt)])
    }
    for (const context of db.activeContexts || []) {
      await client.query(`INSERT INTO core_active_contexts(id,user_id,role,role_assignment_id,organization_id,workspace_id,resource_type,resource_id,status,started_at,last_active_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role,role_assignment_id=EXCLUDED.role_assignment_id,organization_id=EXCLUDED.organization_id,workspace_id=EXCLUDED.workspace_id,resource_type=EXCLUDED.resource_type,resource_id=EXCLUDED.resource_id,status=EXCLUDED.status,last_active_at=EXCLUDED.last_active_at,updated_at=EXCLUDED.updated_at`, [context.id, context.userId, context.role, context.roleAssignmentId || null, context.organizationId || null, context.workspaceId || null, context.resourceType || null, context.resourceId || null, context.status || 'active', date(context.startedAt), date(context.lastActiveAt), date(context.updatedAt)])
    }
    const userIds = (db.users || []).map(row => row.id)
    const profileIds = (db.profiles || []).map(row => row.id)
    const roleIds = (db.userRoles || []).map(row => row.id)
    const contextIds = (db.activeContexts || []).map(row => row.id)
    await client.query('DELETE FROM core_profiles WHERE id <> ALL($1::text[])', [profileIds])
    await client.query('DELETE FROM core_user_roles WHERE id <> ALL($1::text[])', [roleIds])
    await client.query('DELETE FROM core_active_contexts WHERE id <> ALL($1::text[])', [contextIds])
    await client.query('DELETE FROM core_users WHERE id <> ALL($1::text[])', [userIds])
    const counts = await client.query(`SELECT (SELECT count(*) FROM core_users) AS users, (SELECT count(*) FROM core_profiles) AS profiles, (SELECT count(*) FROM core_user_roles) AS roles, (SELECT count(*) FROM core_active_contexts) AS contexts`)
    await client.query('COMMIT')
    const actual = Object.fromEntries(Object.entries(counts.rows[0]).map(([key, value]) => [key, Number(value)]))
    const expected = { users: userIds.length, profiles: profileIds.length, roles: roleIds.length, contexts: contextIds.length }
    const mismatches = Object.fromEntries(Object.keys(expected).filter(key => expected[key] !== actual[key]).map(key => [key, { expected: expected[key], actual: actual[key] }]))
    return { enabled: true, ...actual, expected, mismatches, consistent: Object.keys(mismatches).length === 0 }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function initializeIdentityPostgresProjection() {
  if (!connectionUrl()) return { enabled: false }
  pool = new pg.Pool({ connectionString: connectionUrl(), max: Math.max(1, Number(process.env.IDENTITY_DB_POOL_SIZE || 5)), connectionTimeoutMillis: Number(process.env.IDENTITY_DB_CONNECTION_TIMEOUT_MS || 5000), ssl: /sslmode=require/.test(connectionUrl()) ? { rejectUnauthorized: process.env.IDENTITY_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
  const sql = await fs.readFile(new URL('../../migrations/postgres/009_core_identity_projection.sql', import.meta.url), 'utf8')
  await pool.query(sql)
  const initial = await syncIdentityProjection()
  const interval = Math.max(5000, Number(process.env.IDENTITY_PROJECTION_INTERVAL_MS || 30000))
  timer = setInterval(() => syncIdentityProjection().catch(error => console.error(JSON.stringify({ event: 'identity_projection_failed', error: error.message }))), interval)
  timer.unref?.()
  return { enabled: true, ...initial }
}

export async function closeIdentityPostgresProjection() {
  if (timer) clearInterval(timer)
  timer = null
  if (pool) await pool.end()
  pool = null
}
