import pg from 'pg'
import { readDb } from '../config/database.js'
import { recordCutoverComparison } from '../services/postgresCutoverMonitor.js'

let pool = null
const url = () => process.env.IDENTITY_DATABASE_URL || process.env.DATABASE_URL
// A PostgreSQL-authoritative write mode must read the same authority. This
// prevents a newly-created session or identity from disappearing when the
// explicit read flag has not yet been updated in a deployment.
const postgresReads = () => process.env.IDENTITY_READ_SOURCE === 'postgres' || process.env.IDENTITY_WRITE_SOURCE === 'postgres'

function localById(userId) {
  const db = readDb(); const user = db.users.find(row => row.id === userId) || null
  if (!user) return null
  return { user, profile: db.profiles.find(row => row.id === userId) || null, roles: (db.userRoles || []).filter(row => row.userId === userId), activeContext: (db.activeContexts || []).find(row => row.userId === userId && row.status === 'active') || null }
}

function localByEmail(email) {
  const db = readDb(); const user = db.users.find(row => row.email === email) || null
  return user ? localById(user.id) : null
}

function getPool() {
  if (!url()) throw new Error('IDENTITY_DATABASE_URL or DATABASE_URL is required for PostgreSQL identity reads')
  pool ||= new pg.Pool({ connectionString: url(), max: Math.max(1, Number(process.env.IDENTITY_READ_POOL_SIZE || 5)), connectionTimeoutMillis: Number(process.env.IDENTITY_DB_CONNECTION_TIMEOUT_MS || 5000), ssl: /sslmode=require/.test(url()) ? { rejectUnauthorized: process.env.IDENTITY_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
  return pool
}

function bundle(rows) {
  if (!rows.length) return null
  const first = rows[0]
  const profile = first.profile_payload || null
  const roles = rows.filter(row => row.role_id).map(row => ({ id: row.role_id, userId: first.user_id, role: row.assigned_role, status: row.role_status, active: row.role_active, assurance: row.role_assurance, isPrimary: row.role_primary }))
  const activeContext = first.context_id ? { id: first.context_id, userId: first.user_id, role: first.context_role, roleAssignmentId: first.role_assignment_id, organizationId: first.organization_id, workspaceId: first.workspace_id, resourceType: first.resource_type, resourceId: first.resource_id, status: first.context_status } : null
  return { user: { id: first.user_id, email: first.user_email, passwordHash: first.password_hash, createdAt: first.user_created_at, updatedAt: first.user_updated_at }, profile, roles, activeContext }
}

async function postgresBundle(where, value) {
  const result = await getPool().query(`SELECT u.id AS user_id,u.email AS user_email,u.password_hash,u.created_at AS user_created_at,u.updated_at AS user_updated_at,p.payload AS profile_payload,r.id AS role_id,r.role AS assigned_role,r.status AS role_status,r.active AS role_active,r.assurance AS role_assurance,r.is_primary AS role_primary,c.id AS context_id,c.role AS context_role,c.role_assignment_id,c.organization_id,c.workspace_id,c.resource_type,c.resource_id,c.status AS context_status FROM core_users u LEFT JOIN core_profiles p ON p.id=u.id LEFT JOIN core_user_roles r ON r.user_id=u.id LEFT JOIN core_active_contexts c ON c.user_id=u.id WHERE ${where}=$1`, [value])
  return bundle(result.rows)
}

async function withRollbackFallback(postgresCall, localCall) {
  if (!postgresReads()) return localCall()
  try { const primary = await postgresCall(); const shadow = localCall(); recordCutoverComparison('identity', primary?.user?.id || primary?.user?.email || 'missing', primary, shadow); return primary } catch (error) {
    console.error(JSON.stringify({ event: 'identity_postgres_read_failed', error: error.message }))
    if (process.env.IDENTITY_READ_FALLBACK_SQLITE === 'true') return localCall()
    throw error
  }
}

export const findIdentityById = userId => withRollbackFallback(() => postgresBundle('u.id', userId), () => localById(userId))
export const findIdentityByEmail = email => withRollbackFallback(() => postgresBundle('u.email', email), () => localByEmail(email))
export function identityReadSource() { return postgresReads() ? 'postgres' : 'sqlite' }
export async function findSessionByIdentifier(identifier) {
  if (!identifier) return null
  return withRollbackFallback(
    async () => {
      const result = await getPool().query('SELECT id,user_id,session_identifier,refresh_token_hash,previous_refresh_token_hash,expires_at,revoked_at,last_active_at FROM user_sessions WHERE session_identifier=$1', [identifier])
      const row = result.rows[0]
      return row ? { id: row.id, userId: row.user_id, sessionIdentifier: row.session_identifier, refreshTokenHash: row.refresh_token_hash, previousRefreshTokenHash: row.previous_refresh_token_hash, expiresAt: row.expires_at, revokedAt: row.revoked_at, lastActiveAt: row.last_active_at } : null
    },
    () => {
      const db = readDb()
      return (db.userSessions || []).find(row => row.sessionIdentifier === identifier) || null
    },
  )
}

export async function validateSessionBindingAsync(payload) {
  if (!payload?.sid) return { valid: true, legacy: true }
  const row = await findSessionByIdentifier(payload.sid)
  if (!row || row.revokedAt || new Date(row.expiresAt).getTime() <= Date.now() || row.userId !== payload.sub) return { valid: false, error: 'session_invalid' }
  return { valid: true, session: row }
}
export async function closeIdentityRepository() { if (pool) await pool.end(); pool = null }
