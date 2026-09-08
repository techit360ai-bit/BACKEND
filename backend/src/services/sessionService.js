import crypto from 'node:crypto'
import { signJwt } from './jwtKeyService.js'
import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { findIdentityById } from '../repositories/identityRepository.js'
import * as identitySessionRepository from '../repositories/identitySessionRepository.js'

const ACCESS_COOKIE = 'techit_access'
const REFRESH_COOKIE = 'techit_refresh'
const CSRF_COOKIE = 'techit_csrf'
const ACCESS_TTL_SECONDS = Math.max(300, Number(process.env.AUTH_ACCESS_TTL_SECONDS || 900))
const REFRESH_TTL_SECONDS = Math.max(3600, Number(process.env.AUTH_REFRESH_TTL_SECONDS || 30 * 86400))
const SESSION_TTL_SECONDS = Math.max(3600, Number(process.env.AUTH_SESSION_TTL_SECONDS || 30 * 86400))
const cookieBase = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.AUTH_COOKIE_SAMESITE || 'lax', path: '/' })

function randomToken() { return crypto.randomBytes(48).toString('base64url') }
function hashToken(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function browserRequest(req) { return !req.headers.authorization && Boolean(req.headers.cookie || req.headers['x-techit-client'] === 'web') }
function cookieOptions(maxAge) { return { ...cookieBase(), maxAge: maxAge * 1000 } }
function sessionFromDb(db, identifier) { return (db.userSessions || []).find(row => row.sessionIdentifier === identifier) }
const postgresWrites = () => process.env.IDENTITY_WRITE_SOURCE === 'postgres'
const writeFallbackEnabled = () => process.env.IDENTITY_WRITE_FALLBACK_SQLITE !== 'false'
function contextClaims(userId, profile) {
  const db = readAuthorityDb()
  const context = (db.activeContexts || []).find(row => row.userId === userId && row.status === 'active')
  return {
    active_role: context?.role || profile?.activeRole || profile?.role || 'explorer',
    organization_id: context?.organizationId || null,
    resource_type: context?.resourceType || null,
    resource_id: context?.resourceId || null,
    workspaceId: context?.workspaceId || profile?.workspaceId || `user-${userId}`,
  }
}
function identityClaims(userId, profile) {
  const db = readAuthorityDb()
  const subscription = (db.subscriptions || []).find(row => row.userId === userId && ['active', 'trialing'].includes(String(row.status || '').toLowerCase()))
  const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim()
  return {
    name: displayName || profile?.username || '',
    username: profile?.username || null,
    avatar_url: profile?.avatarUrl || null,
    verified: Boolean(profile?.isVerified),
    credibility_score: Math.min(100, Math.max(0, Number(profile?.credibilityScore || 0))),
    subscriber: Boolean(subscription),
    subscription_tier: subscription ? String(subscription.planName || subscription.planId || 'subscriber').slice(0, 80) : null,
  }
}
function userAgentParts(userAgent = '') { const value = String(userAgent); return { browser: /Edg/i.test(value) ? 'Edge' : /Chrome/i.test(value) ? 'Chrome' : /Safari/i.test(value) ? 'Safari' : /Firefox/i.test(value) ? 'Firefox' : 'Unknown', platform: /Android/i.test(value) ? 'Android' : /iPhone|iPad/i.test(value) ? 'iOS' : /Windows/i.test(value) ? 'Windows' : /Mac OS/i.test(value) ? 'macOS' : /Linux/i.test(value) ? 'Linux' : 'Unknown' } }
function event(db, payload) { (db.authSecurityEvents || (db.authSecurityEvents = [])).push({ id: createId('auth_event'), createdAt: nowIso(), ...payload }) }
export function mobileClient(req) { return String(req.get('x-techit-client') || '').toLowerCase() === 'mobile' }

export function issueSession(user, profile, req, { rememberMe = true } = {}) {
  const sessionIdentifier = randomToken(); const refreshToken = randomToken(); const now = Date.now(); const parts = userAgentParts(req.get('user-agent'))
  const session = { id: createId('session'), userId: user.id, sessionIdentifier, refreshTokenHash: hashToken(refreshToken), deviceIdentifier: String(req.get('x-device-id') || '').slice(0, 160) || null, deviceName: String(req.get('x-device-name') || '').slice(0, 120) || null, platform: parts.platform, browser: parts.browser, ipAddress: req.ip || null, userAgent: String(req.get('user-agent') || '').slice(0, 500), createdAt: new Date(now).toISOString(), lastActiveAt: new Date(now).toISOString(), expiresAt: new Date(now + (rememberMe ? SESSION_TTL_SECONDS : 86400) * 1000).toISOString(), lastRefreshedAt: new Date(now).toISOString(), revokedAt: null, rememberMe, rotationCounter: 0 }
  const accessToken = signJwt({ sub: user.id, role: profile?.activeRole || profile?.role || 'explorer', ...contextClaims(user.id, profile), ...identityClaims(user.id, profile), sid: sessionIdentifier, token_use: 'access' }, { expiresIn: ACCESS_TTL_SECONDS, ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}), ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}) })
  if (process.env.NODE_ENV !== 'test' || req.get('x-techit-client') === 'web') updateAuthorityDb(db => { (db.userSessions || (db.userSessions = [])).push(session); event(db, { userId: user.id, sessionIdentifier, eventType: 'session_created', ipAddress: req.ip || null, userAgent: session.userAgent, metadata: { rememberMe, browser: parts.browser, platform: parts.platform } }) })
  return { accessToken, refreshToken, session }
}

export async function issueSessionAsync(user, profile, req, options = {}) {
  const credentials = issueSession(user, profile, req, { ...options, rememberMe: options.rememberMe !== false })
  if (!postgresWrites()) return credentials
  const securityEvent = { id: createId('auth_event'), userId: user.id, sessionIdentifier: credentials.session.sessionIdentifier, eventType: 'session_created', ipAddress: req.ip || null, userAgent: credentials.session.userAgent, metadata: { rememberMe: credentials.session.rememberMe, browser: credentials.session.browser, platform: credentials.session.platform }, createdAt: credentials.session.createdAt }
  try {
    // The sync helper already persisted SQLite. Remove that local write from the
    // authoritative path after PostgreSQL confirms the session.
    await identitySessionRepository.createSession(credentials.session, securityEvent)
    if (process.env.NODE_ENV !== 'test' || req.get('x-techit-client') === 'web') updateAuthorityDb(db => {
      db.userSessions = (db.userSessions || []).filter(row => row.id !== credentials.session.id)
      db.authSecurityEvents = (db.authSecurityEvents || []).filter(row => row.id !== securityEvent.id)
    })
    return credentials
  } catch (error) {
    console.error(JSON.stringify({ event: 'identity_postgres_session_write_failed', operation: 'create', error: error.message }))
    if (!writeFallbackEnabled()) throw error
    return credentials
  }
}

export function setSessionCookies(res, credentials) { res.cookie(ACCESS_COOKIE, credentials.accessToken, cookieOptions(ACCESS_TTL_SECONDS)); res.cookie(REFRESH_COOKIE, credentials.refreshToken, cookieOptions(credentials.session.rememberMe ? REFRESH_TTL_SECONDS : 86400)); res.cookie(CSRF_COOKIE, randomToken(), { secure: process.env.NODE_ENV === 'production', sameSite: process.env.AUTH_COOKIE_SAMESITE || 'lax', path: '/', maxAge: (credentials.session.rememberMe ? REFRESH_TTL_SECONDS : 86400) * 1000 }) }
export function clearSessionCookies(res) { const options = cookieBase(); res.clearCookie(ACCESS_COOKIE, options); res.clearCookie(REFRESH_COOKIE, options); res.clearCookie(CSRF_COOKIE, options) }
export function accessTokenFromRequest(req) { const header = req.headers.authorization; if (header?.startsWith('Bearer ')) return { token: header.slice(7), source: 'bearer' }; const match = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${ACCESS_COOKIE}=`)); return match ? { token: decodeURIComponent(match.slice(ACCESS_COOKIE.length + 1)), source: 'cookie' } : null }
export function refreshTokenFromRequest(req) { const match = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${REFRESH_COOKIE}=`)); return match ? decodeURIComponent(match.slice(REFRESH_COOKIE.length + 1)) : String(req.body?.refreshToken || '') || null }

export function rotateSession(refreshToken, req) {
  if (!refreshToken) return { ok: false, error: 'refresh_token_missing' }
  return updateAuthorityDb(db => {
    const reused = (db.userSessions || []).find(item => item.previousRefreshTokenHash === hashToken(refreshToken))
    if (reused) { reused.revokedAt = nowIso(); event(db, { userId: reused.userId, sessionIdentifier: reused.sessionIdentifier, eventType: 'refresh_token_reuse_detected', ipAddress: req.ip || null, userAgent: req.get('user-agent') || '', metadata: {} }); return { ok: false, error: 'refresh_token_reuse_detected' } }
    const row = (db.userSessions || []).find(item => item.refreshTokenHash === hashToken(refreshToken))
    if (!row || row.revokedAt || new Date(row.expiresAt).getTime() <= Date.now()) { if (row) { row.revokedAt = nowIso(); event(db, { userId: row.userId, sessionIdentifier: row.sessionIdentifier, eventType: 'refresh_token_rejected', ipAddress: req.ip || null, userAgent: req.get('user-agent') || '', metadata: { reason: row.revokedAt ? 'revoked' : 'expired' } }) }; return { ok: false, error: 'refresh_token_invalid' } }
    const user = db.users.find(item => item.id === row.userId); const profile = db.profiles.find(item => item.id === row.userId); if (!user) return { ok: false, error: 'user_not_found' }
    const nextRefresh = randomToken(); const now = nowIso(); row.previousRefreshTokenHash = row.refreshTokenHash; row.refreshTokenHash = hashToken(nextRefresh); row.rotationCounter = Number(row.rotationCounter || 0) + 1; row.lastRefreshedAt = now; row.lastActiveAt = now
    const accessToken = signJwt({ sub: user.id, role: profile?.activeRole || profile?.role || 'explorer', ...contextClaims(user.id, profile), ...identityClaims(user.id, profile), sid: row.sessionIdentifier, token_use: 'access' }, { expiresIn: ACCESS_TTL_SECONDS, ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}), ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}) })
    event(db, { userId: row.userId, sessionIdentifier: row.sessionIdentifier, eventType: 'session_refreshed', ipAddress: req.ip || null, userAgent: req.get('user-agent') || '', metadata: { rotationCounter: row.rotationCounter } })
    return { ok: true, accessToken, refreshToken: nextRefresh, session: row, user, profile }
  })
}

export async function rotateSessionAsync(refreshToken, req) {
  if (!postgresWrites()) return rotateSession(refreshToken, req)
  if (!refreshToken) return { ok: false, error: 'refresh_token_missing' }
  const tokenHash = hashToken(refreshToken)
  try {
    const reused = await identitySessionRepository.findByPreviousRefreshTokenHash(tokenHash)
    if (reused) {
      await identitySessionRepository.revokeByIdentifier(reused.userId, reused.sessionIdentifier, { id: createId('auth_event'), userId: reused.userId, eventType: 'refresh_token_reuse_detected', ipAddress: req.ip || null, userAgent: req.get('user-agent') || '', metadata: {} })
      return { ok: false, error: 'refresh_token_reuse_detected' }
    }
    const row = await identitySessionRepository.findByRefreshTokenHash(tokenHash)
    if (!row || row.revokedAt || new Date(row.expiresAt).getTime() <= Date.now()) {
      if (row) await identitySessionRepository.revokeByIdentifier(row.userId, row.sessionIdentifier, { id: createId('auth_event'), userId: row.userId, eventType: 'refresh_token_rejected', ipAddress: req.ip || null, userAgent: req.get('user-agent') || '', metadata: { reason: row.revokedAt ? 'revoked' : 'expired' } })
      return { ok: false, error: 'refresh_token_invalid' }
    }
    const identity = await findIdentityById(row.userId)
    const user = identity?.user
    const profile = identity?.profile
    if (!user) return { ok: false, error: 'user_not_found' }
    const nextRefresh = randomToken(); const now = nowIso()
    const nextSession = { ...row, previousRefreshTokenHash: row.refreshTokenHash, refreshTokenHash: hashToken(nextRefresh), rotationCounter: Number(row.rotationCounter || 0) + 1, lastRefreshedAt: now, lastActiveAt: now }
    const securityEvent = { id: createId('auth_event'), userId: row.userId, sessionIdentifier: row.sessionIdentifier, eventType: 'session_refreshed', ipAddress: req.ip || null, userAgent: req.get('user-agent') || '', metadata: { rotationCounter: nextSession.rotationCounter }, createdAt: now }
    const persisted = await identitySessionRepository.rotateSession(row.id, tokenHash, nextSession, securityEvent)
    if (!persisted) return { ok: false, error: 'refresh_token_invalid' }
    const accessToken = signJwt({ sub: user.id, role: profile?.activeRole || profile?.role || 'explorer', ...contextClaims(user.id, profile), ...identityClaims(user.id, profile), sid: row.sessionIdentifier, token_use: 'access' }, { expiresIn: ACCESS_TTL_SECONDS, ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}), ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}) })
    return { ok: true, accessToken, refreshToken: nextRefresh, session: persisted, user, profile }
  } catch (error) {
    console.error(JSON.stringify({ event: 'identity_postgres_session_write_failed', operation: 'rotate', error: error.message }))
    if (!writeFallbackEnabled()) throw error
    return rotateSession(refreshToken, req)
  }
}

export function validateSessionBinding(payload) {
  if (!payload?.sid) return { valid: true, legacy: true }
  const db = readAuthorityDb(); const row = sessionFromDb(db, payload.sid); if (!row || row.revokedAt || new Date(row.expiresAt).getTime() <= Date.now() || row.userId !== payload.sub) return { valid: false, error: 'session_invalid' }
  return { valid: true, session: row }
}
export function touchSession(identifier) { if (!identifier) return; const db = readAuthorityDb(); const row = sessionFromDb(db, identifier); if (!row || Date.now() - new Date(row.lastActiveAt).getTime() < 5 * 60 * 1000) return; updateAuthorityDb(state => { const current = sessionFromDb(state, identifier); if (current && !current.revokedAt) current.lastActiveAt = nowIso() }) }
export async function touchSessionAsync(identifier) {
  if (!identifier) return
  if (!postgresWrites()) return touchSession(identifier)
  try { return await identitySessionRepository.touch(identifier, nowIso()) } catch (error) { if (!writeFallbackEnabled()) throw error; touchSession(identifier) }
}
export function revokeSession(userId, identifier) { return updateAuthorityDb(db => { const row = (db.userSessions || []).find(item => item.userId === userId && (item.sessionIdentifier === identifier || item.id === identifier)); if (!row) return { ok: false, error: 'session_not_found' }; row.revokedAt = nowIso(); event(db, { userId, sessionIdentifier: row.sessionIdentifier, eventType: 'session_revoked', metadata: { scope: 'single' } }); return { ok: true } }) }
export async function revokeSessionAsync(userId, identifier) { if (!postgresWrites()) return revokeSession(userId, identifier); try { return await identitySessionRepository.revokeByIdentifier(userId, identifier, { id: createId('auth_event'), userId, eventType: 'session_revoked', metadata: { scope: 'single' } }) } catch (error) { if (!writeFallbackEnabled()) throw error; return revokeSession(userId, identifier) } }
export function revokeAllSessions(userId, exceptIdentifier = null) { return updateAuthorityDb(db => { let count = 0; for (const row of db.userSessions || []) if (row.userId === userId && row.sessionIdentifier !== exceptIdentifier && !row.revokedAt) { row.revokedAt = nowIso(); count++ }; event(db, { userId, eventType: 'global_logout', metadata: { revokedCount: count } }); return { ok: true, revokedCount: count } }) }
export async function revokeAllSessionsAsync(userId, exceptIdentifier = null) { if (!postgresWrites()) return revokeAllSessions(userId, exceptIdentifier); try { return await identitySessionRepository.revokeAll(userId, exceptIdentifier, { id: createId('auth_event'), userId, eventType: 'global_logout', metadata: {} }) } catch (error) { if (!writeFallbackEnabled()) throw error; return revokeAllSessions(userId, exceptIdentifier) } }
export function listSessions(userId, currentIdentifier) { const db = readAuthorityDb(); return (db.userSessions || []).filter(row => row.userId === userId && !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now()).map(row => ({ id: row.id, sessionIdentifier: row.sessionIdentifier, deviceName: row.deviceName, platform: row.platform, browser: row.browser, ipAddress: row.ipAddress, createdAt: row.createdAt, lastActiveAt: row.lastActiveAt, expiresAt: row.expiresAt, current: row.sessionIdentifier === currentIdentifier })) }
export async function listSessionsAsync(userId, currentIdentifier) { if (!postgresWrites()) return listSessions(userId, currentIdentifier); try { return await identitySessionRepository.listActive(userId, currentIdentifier) } catch (error) { if (!writeFallbackEnabled()) throw error; return listSessions(userId, currentIdentifier) } }
export function cleanupSessions() { return updateAuthorityDb(db => { const cutoff = Date.now() - 90 * 86400000; const sessions = db.userSessions || []; const before = sessions.length; db.userSessions = sessions.filter(row => !row.revokedAt || new Date(row.revokedAt).getTime() > cutoff || new Date(row.expiresAt).getTime() > cutoff); db.authSecurityEvents = (db.authSecurityEvents || []).filter(row => new Date(row.createdAt).getTime() > cutoff); return { removed: before - db.userSessions.length } }) }
export async function cleanupSessionsAsync() { if (!postgresWrites()) return cleanupSessions(); try { return await identitySessionRepository.cleanup(new Date(Date.now() - 90 * 86400000).toISOString()) } catch (error) { if (!writeFallbackEnabled()) throw error; return cleanupSessions() } }
export { ACCESS_TTL_SECONDS, browserRequest }
