import { readDb as readAuthorityDb } from '../config/database.js'
import { recordCutoverComparison } from '../services/postgresCutoverMonitor.js'
import { getPlatformPool, closePlatformPool } from './platformCollectionRepository.js'

const url = () => process.env.IDENTITY_DATABASE_URL || process.env.DATABASE_URL
// A PostgreSQL-authoritative write mode must read the same authority. This
// prevents a newly-created session or identity from disappearing when the
// explicit read flag has not yet been updated in a deployment.
const postgresReads = () => process.env.IDENTITY_READ_SOURCE === 'postgres' || process.env.IDENTITY_WRITE_SOURCE === 'postgres'

// The request-authority snapshot is sparse: any collection with no rows is
// absent, not an empty array. Read defensively (same convention as the other
// services) so a missing collection is a miss, never a TypeError.
const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }

function localById(userId) {
  const db = readAuthorityDb(); const user = collection(db, 'users').find(row => row.id === userId) || null
  if (!user) return null
  return { user, profile: collection(db, 'profiles').find(row => row.id === userId) || null, roles: collection(db, 'userRoles').filter(row => row.userId === userId), activeContext: collection(db, 'activeContexts').find(row => row.userId === userId && row.status === 'active') || null }
}

function localByEmail(email) {
  const db = readAuthorityDb(); const user = collection(db, 'users').find(row => row.email === email) || null
  return user ? localById(user.id) : null
}

function getPool() {
  if (!url()) throw new Error('IDENTITY_DATABASE_URL or DATABASE_URL is required for PostgreSQL identity reads')
  return getPlatformPool()
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

// The legacy read is only a cutover comparison shadow. It must never be able to
// fail the primary (PostgreSQL-authoritative) read path.
function safeShadowRead(localCall) {
  try { return localCall() } catch (error) {
    console.error(JSON.stringify({ event: 'identity_shadow_read_failed', error: error.message }))
    return null
  }
}

async function withRollbackFallback(postgresCall, localCall) {
  if (!postgresReads()) return localCall()
  let primary
  try { primary = await postgresCall() } catch (error) {
    console.error(JSON.stringify({ event: 'identity_postgres_read_failed', error: error.message }))
    if (process.env.IDENTITY_READ_FALLBACK_SQLITE === 'true') return localCall()
    throw error
  }
  recordCutoverComparison('identity', primary?.user?.id || primary?.user?.email || 'missing', primary, safeShadowRead(localCall))
  return primary
}

export const findIdentityById = userId => withRollbackFallback(() => postgresBundle('u.id', userId), () => localById(userId))
export const findIdentityByEmail = email => withRollbackFallback(() => postgresBundle('u.email', email), () => localByEmail(email))
export function identityReadSource() { return postgresReads() ? 'postgres' : 'sqlite' }
export async function updateIdentityProfile(userId, updates) {
  const result = await getPool().query('SELECT payload,first_name,last_name,username,role,workspace_id,is_verified,is_onboarded,created_at,email FROM core_profiles WHERE id=$1', [userId])
  const current = result.rows[0]
  if (!current) return null
  const payload = { ...(current.payload || {}), ...updates, id: userId, email: current.email }
  const updatedAt = new Date().toISOString()
  await getPool().query('UPDATE core_profiles SET first_name=$1,last_name=$2,username=$3,role=$4,workspace_id=$5,is_verified=$6,is_onboarded=$7,payload=$8,updated_at=$9 WHERE id=$10', [payload.firstName || current.first_name || null, payload.lastName || current.last_name || null, payload.username || current.username || null, payload.role || current.role || 'explorer', payload.workspaceId || current.workspace_id || null, payload.isVerified ?? current.is_verified ?? false, payload.isOnboarded ?? current.is_onboarded ?? false, JSON.stringify(payload), updatedAt, userId])
  return { ...payload, createdAt: current.created_at, updatedAt }
}
export async function createIdentityBundle(user, profile, role, context) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query('INSERT INTO core_users(id,email,password_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5)', [user.id, user.email, user.passwordHash, user.createdAt, user.updatedAt])
    await client.query('INSERT INTO core_profiles(id,email,first_name,last_name,username,role,workspace_id,is_verified,is_onboarded,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [profile.id, profile.email, profile.firstName || null, profile.lastName || null, profile.username || null, profile.role || 'explorer', profile.workspaceId || null, Boolean(profile.isVerified), Boolean(profile.isOnboarded), JSON.stringify(profile), profile.createdAt, profile.updatedAt])
    await client.query('INSERT INTO core_user_roles(id,user_id,role,status,active,assurance,is_primary,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [role.id, role.userId, role.role, role.status || 'active', role.active !== false, role.assurance || null, Boolean(role.isPrimary), role.createdAt, role.updatedAt])
    await client.query('INSERT INTO core_active_contexts(id,user_id,role,role_assignment_id,organization_id,workspace_id,resource_type,resource_id,status,started_at,last_active_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [context.id, context.userId, context.role, context.roleAssignmentId || null, context.organizationId || null, context.workspaceId || null, context.resourceType || null, context.resourceId || null, context.status || 'active', context.startedAt, context.lastActiveAt, context.updatedAt])
    await client.query('COMMIT')
    return { user, profile, role, context }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}
export async function updateIdentityPassword(userId, passwordHash) {
  const result = await getPool().query('UPDATE core_users SET password_hash=$1,updated_at=$2 WHERE id=$3', [passwordHash, new Date().toISOString(), userId])
  return result.rowCount > 0
}
export async function listIdentityProfiles() {
  const result = await getPool().query('SELECT id,email,first_name,last_name,username,role,workspace_id,is_verified,is_onboarded,payload,created_at,updated_at FROM core_profiles ORDER BY created_at DESC')
  return result.rows.map(row => ({ ...(row.payload || {}), id: row.id, email: row.email, firstName: row.first_name, lastName: row.last_name, username: row.username, role: row.role, workspaceId: row.workspace_id, isVerified: row.is_verified, isOnboarded: row.is_onboarded, createdAt: row.created_at, updatedAt: row.updated_at }))
}
export async function findSessionByIdentifier(identifier) {
  if (!identifier) return null
  return withRollbackFallback(
    async () => {
      const result = await getPool().query('SELECT id,user_id,session_identifier,refresh_token_hash,previous_refresh_token_hash,expires_at,revoked_at,last_active_at FROM user_sessions WHERE session_identifier=$1', [identifier])
      const row = result.rows[0]
      return row ? { id: row.id, userId: row.user_id, sessionIdentifier: row.session_identifier, refreshTokenHash: row.refresh_token_hash, previousRefreshTokenHash: row.previous_refresh_token_hash, expiresAt: row.expires_at, revokedAt: row.revoked_at, lastActiveAt: row.last_active_at } : null
    },
    () => {
      const db = readAuthorityDb()
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
export async function closeIdentityRepository() { await closePlatformPool() }
