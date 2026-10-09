import { getPlatformPool, closePlatformPool } from './platformCollectionRepository.js'

const connectionUrl = () => process.env.IDENTITY_DATABASE_URL || process.env.DATABASE_URL

function getPool() {
  if (!connectionUrl()) throw new Error('IDENTITY_DATABASE_URL or DATABASE_URL is required for PostgreSQL identity writes')
  return getPlatformPool()
}

const eventValues = event => [event.id, event.userId || null, event.sessionIdentifier || null, event.eventType, event.ipAddress || null, event.userAgent || null, JSON.stringify(event.metadata || {}), event.createdAt || new Date().toISOString()]

export async function createSession(session, securityEvent) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`INSERT INTO user_sessions(id,user_id,session_identifier,refresh_token_hash,previous_refresh_token_hash,device_identifier,device_name,platform,browser,ip_address,user_agent,created_at,last_active_at,expires_at,last_refreshed_at,revoked_at,remember_me,rotation_counter) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`, [session.id, session.userId, session.sessionIdentifier, session.refreshTokenHash, session.previousRefreshTokenHash || null, session.deviceIdentifier || null, session.deviceName || null, session.platform || null, session.browser || null, session.ipAddress || null, session.userAgent || null, session.createdAt, session.lastActiveAt, session.expiresAt, session.lastRefreshedAt || null, session.revokedAt || null, session.rememberMe !== false, Number(session.rotationCounter || 0)])
    await client.query('INSERT INTO auth_security_events(id,user_id,session_identifier,event_type,ip_address,user_agent,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', eventValues(securityEvent))
    await client.query('COMMIT')
    return session
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

function mapSession(row) {
  return row ? { id: row.id, userId: row.user_id, sessionIdentifier: row.session_identifier, refreshTokenHash: row.refresh_token_hash, previousRefreshTokenHash: row.previous_refresh_token_hash, deviceIdentifier: row.device_identifier, deviceName: row.device_name, platform: row.platform, browser: row.browser, ipAddress: row.ip_address, userAgent: row.user_agent, createdAt: row.created_at, lastActiveAt: row.last_active_at, expiresAt: row.expires_at, lastRefreshedAt: row.last_refreshed_at, revokedAt: row.revoked_at, rememberMe: row.remember_me, rotationCounter: row.rotation_counter } : null
}

export async function findByRefreshTokenHash(hash) {
  const result = await getPool().query('SELECT * FROM user_sessions WHERE refresh_token_hash=$1', [hash])
  return mapSession(result.rows[0])
}

export async function findByPreviousRefreshTokenHash(hash) {
  const result = await getPool().query('SELECT * FROM user_sessions WHERE previous_refresh_token_hash=$1', [hash])
  return mapSession(result.rows[0])
}

export async function rotateSession(id, expectedHash, nextSession, securityEvent) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const updated = await client.query(`UPDATE user_sessions SET previous_refresh_token_hash=$1,refresh_token_hash=$2,last_refreshed_at=$3,last_active_at=$4,rotation_counter=$5 WHERE id=$6 AND refresh_token_hash=$7 AND revoked_at IS NULL AND expires_at > now() RETURNING *`, [nextSession.previousRefreshTokenHash, nextSession.refreshTokenHash, nextSession.lastRefreshedAt, nextSession.lastActiveAt, Number(nextSession.rotationCounter || 0), id, expectedHash])
    if (!updated.rowCount) { await client.query('ROLLBACK'); return null }
    await client.query('INSERT INTO auth_security_events(id,user_id,session_identifier,event_type,ip_address,user_agent,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', eventValues(securityEvent))
    await client.query('COMMIT')
    return mapSession(updated.rows[0])
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function revokeByIdentifier(userId, identifier, securityEvent) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await client.query('UPDATE user_sessions SET revoked_at=$1 WHERE user_id=$2 AND (session_identifier=$3 OR id=$3) AND revoked_at IS NULL RETURNING session_identifier', [securityEvent.createdAt || new Date().toISOString(), userId, identifier])
    if (result.rowCount) await client.query('INSERT INTO auth_security_events(id,user_id,session_identifier,event_type,ip_address,user_agent,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', eventValues({ ...securityEvent, sessionIdentifier: result.rows[0].session_identifier }))
    await client.query('COMMIT')
    return result.rowCount ? { ok: true } : { ok: false, error: 'session_not_found' }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function revokeAll(userId, exceptIdentifier, securityEvent) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await client.query('UPDATE user_sessions SET revoked_at=$1 WHERE user_id=$2 AND revoked_at IS NULL AND ($3::text IS NULL OR session_identifier <> $3) RETURNING id', [securityEvent.createdAt || new Date().toISOString(), userId, exceptIdentifier || null])
    await client.query('INSERT INTO auth_security_events(id,user_id,event_type,ip_address,user_agent,metadata,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [securityEvent.id, userId, securityEvent.eventType, securityEvent.ipAddress || null, securityEvent.userAgent || null, JSON.stringify({ ...(securityEvent.metadata || {}), revokedCount: result.rowCount }), securityEvent.createdAt || new Date().toISOString()])
    await client.query('COMMIT')
    return { ok: true, revokedCount: result.rowCount }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function touch(identifier, lastActiveAt) {
  await getPool().query('UPDATE user_sessions SET last_active_at=$1 WHERE session_identifier=$2 AND revoked_at IS NULL', [lastActiveAt, identifier])
}

export async function listActive(userId, currentIdentifier) {
  const result = await getPool().query('SELECT * FROM user_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_active_at DESC', [userId])
  return result.rows.map(row => { const session = mapSession(row); return { id: session.id, sessionIdentifier: session.sessionIdentifier, deviceName: session.deviceName, platform: session.platform, browser: session.browser, ipAddress: session.ipAddress, createdAt: session.createdAt, lastActiveAt: session.lastActiveAt, expiresAt: session.expiresAt, current: session.sessionIdentifier === currentIdentifier } })
}

export async function cleanup(cutoff) {
  const result = await getPool().query('WITH removed AS (DELETE FROM user_sessions WHERE revoked_at IS NOT NULL AND revoked_at <= $1 AND expires_at <= $1 RETURNING id), events AS (DELETE FROM auth_security_events WHERE created_at <= $1 RETURNING id) SELECT (SELECT count(*) FROM removed)::int AS sessions_removed, (SELECT count(*) FROM events)::int AS events_removed', [cutoff])
  return { removed: Number(result.rows[0]?.sessions_removed || 0), eventsRemoved: Number(result.rows[0]?.events_removed || 0) }
}

export async function closeIdentitySessionRepository() { await closePlatformPool() }
