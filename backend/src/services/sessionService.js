import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'

const ACCESS_COOKIE = 'techit_access'
const REFRESH_COOKIE = 'techit_refresh'
const ACCESS_TTL_SECONDS = Math.max(300, Number(process.env.AUTH_ACCESS_TTL_SECONDS || 900))
const REFRESH_TTL_SECONDS = Math.max(3600, Number(process.env.AUTH_REFRESH_TTL_SECONDS || 30 * 86400))
const SESSION_TTL_SECONDS = Math.max(3600, Number(process.env.AUTH_SESSION_TTL_SECONDS || 30 * 86400))
const cookieBase = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.AUTH_COOKIE_SAMESITE || 'lax', path: '/' })

function randomToken() { return crypto.randomBytes(48).toString('base64url') }
function hashToken(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function browserRequest(req) { return !req.headers.authorization && Boolean(req.headers.cookie || req.headers['x-techit-client'] === 'web') }
function cookieOptions(maxAge) { return { ...cookieBase(), maxAge: maxAge * 1000 } }
function sessionFromDb(db, identifier) { return (db.userSessions || []).find(row => row.sessionIdentifier === identifier) }
function userAgentParts(userAgent = '') { const value = String(userAgent); return { browser: /Edg/i.test(value) ? 'Edge' : /Chrome/i.test(value) ? 'Chrome' : /Safari/i.test(value) ? 'Safari' : /Firefox/i.test(value) ? 'Firefox' : 'Unknown', platform: /Android/i.test(value) ? 'Android' : /iPhone|iPad/i.test(value) ? 'iOS' : /Windows/i.test(value) ? 'Windows' : /Mac OS/i.test(value) ? 'macOS' : /Linux/i.test(value) ? 'Linux' : 'Unknown' } }
function event(db, payload) { (db.authSecurityEvents || (db.authSecurityEvents = [])).push({ id: createId('auth_event'), createdAt: nowIso(), ...payload }) }

export function issueSession(user, profile, req, { rememberMe = true } = {}) {
  const sessionIdentifier = randomToken(); const refreshToken = randomToken(); const now = Date.now(); const parts = userAgentParts(req.get('user-agent'))
  const session = { id: createId('session'), userId: user.id, sessionIdentifier, refreshTokenHash: hashToken(refreshToken), deviceIdentifier: String(req.get('x-device-id') || '').slice(0, 160) || null, deviceName: String(req.get('x-device-name') || '').slice(0, 120) || null, platform: parts.platform, browser: parts.browser, ipAddress: req.ip || null, userAgent: String(req.get('user-agent') || '').slice(0, 500), createdAt: new Date(now).toISOString(), lastActiveAt: new Date(now).toISOString(), expiresAt: new Date(now + (rememberMe ? SESSION_TTL_SECONDS : 86400) * 1000).toISOString(), lastRefreshedAt: new Date(now).toISOString(), revokedAt: null, rememberMe, rotationCounter: 0 }
  const accessToken = jwt.sign({ sub: user.id, role: profile?.role || 'founder', workspaceId: profile?.workspaceId || `user-${user.id}`, sid: sessionIdentifier, token_use: 'access' }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS, ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}), ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}) })
  if (process.env.NODE_ENV !== 'test' || req.get('x-techit-client') === 'web') updateDb(db => { (db.userSessions || (db.userSessions = [])).push(session); event(db, { userId: user.id, sessionIdentifier, eventType: 'session_created', ipAddress: req.ip || null, userAgent: session.userAgent, metadata: { rememberMe, browser: parts.browser, platform: parts.platform } }) })
  return { accessToken, refreshToken, session }
}

export function setSessionCookies(res, credentials) { res.cookie(ACCESS_COOKIE, credentials.accessToken, cookieOptions(ACCESS_TTL_SECONDS)); res.cookie(REFRESH_COOKIE, credentials.refreshToken, cookieOptions(credentials.session.rememberMe ? REFRESH_TTL_SECONDS : 86400)) }
export function clearSessionCookies(res) { const options = cookieBase(); res.clearCookie(ACCESS_COOKIE, options); res.clearCookie(REFRESH_COOKIE, options) }
export function accessTokenFromRequest(req) { const header = req.headers.authorization; if (header?.startsWith('Bearer ')) return { token: header.slice(7), source: 'bearer' }; const match = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${ACCESS_COOKIE}=`)); return match ? { token: decodeURIComponent(match.slice(ACCESS_COOKIE.length + 1)), source: 'cookie' } : null }
export function refreshTokenFromRequest(req) { const match = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${REFRESH_COOKIE}=`)); return match ? decodeURIComponent(match.slice(REFRESH_COOKIE.length + 1)) : null }

export function rotateSession(refreshToken, req) {
  if (!refreshToken) return { ok: false, error: 'refresh_token_missing' }
  return updateDb(db => {
    const row = (db.userSessions || []).find(item => item.refreshTokenHash === hashToken(refreshToken))
    if (!row || row.revokedAt || new Date(row.expiresAt).getTime() <= Date.now()) { if (row) { row.revokedAt = nowIso(); event(db, { userId: row.userId, sessionIdentifier: row.sessionIdentifier, eventType: 'refresh_token_rejected', ipAddress: req.ip || null, userAgent: req.get('user-agent') || '', metadata: { reason: row.revokedAt ? 'revoked' : 'expired' } }) }; return { ok: false, error: 'refresh_token_invalid' } }
    const user = db.users.find(item => item.id === row.userId); const profile = db.profiles.find(item => item.id === row.userId); if (!user) return { ok: false, error: 'user_not_found' }
    const nextRefresh = randomToken(); const now = nowIso(); row.refreshTokenHash = hashToken(nextRefresh); row.rotationCounter = Number(row.rotationCounter || 0) + 1; row.lastRefreshedAt = now; row.lastActiveAt = now
    const accessToken = jwt.sign({ sub: user.id, role: profile?.role || 'founder', workspaceId: profile?.workspaceId || `user-${user.id}`, sid: row.sessionIdentifier, token_use: 'access' }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL_SECONDS, ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}), ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}) })
    event(db, { userId: row.userId, sessionIdentifier: row.sessionIdentifier, eventType: 'session_refreshed', ipAddress: req.ip || null, userAgent: req.get('user-agent') || '', metadata: { rotationCounter: row.rotationCounter } })
    return { ok: true, accessToken, refreshToken: nextRefresh, session: row, user, profile }
  })
}

export function validateSessionBinding(payload) {
  if (!payload?.sid) return { valid: true, legacy: true }
  const db = readDb(); const row = sessionFromDb(db, payload.sid); if (!row || row.revokedAt || new Date(row.expiresAt).getTime() <= Date.now() || row.userId !== payload.sub) return { valid: false, error: 'session_invalid' }
  return { valid: true, session: row }
}
export function revokeSession(userId, identifier) { return updateDb(db => { const row = (db.userSessions || []).find(item => item.userId === userId && (item.sessionIdentifier === identifier || item.id === identifier)); if (!row) return { ok: false, error: 'session_not_found' }; row.revokedAt = nowIso(); event(db, { userId, sessionIdentifier: row.sessionIdentifier, eventType: 'session_revoked', metadata: { scope: 'single' } }); return { ok: true } }) }
export function revokeAllSessions(userId, exceptIdentifier = null) { return updateDb(db => { let count = 0; for (const row of db.userSessions || []) if (row.userId === userId && row.sessionIdentifier !== exceptIdentifier && !row.revokedAt) { row.revokedAt = nowIso(); count++ }; event(db, { userId, eventType: 'global_logout', metadata: { revokedCount: count } }); return { ok: true, revokedCount: count } }) }
export function listSessions(userId, currentIdentifier) { const db = readDb(); return (db.userSessions || []).filter(row => row.userId === userId && !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now()).map(row => ({ id: row.id, sessionIdentifier: row.sessionIdentifier, deviceName: row.deviceName, platform: row.platform, browser: row.browser, ipAddress: row.ipAddress, createdAt: row.createdAt, lastActiveAt: row.lastActiveAt, expiresAt: row.expiresAt, current: row.sessionIdentifier === currentIdentifier })) }
export function cleanupSessions() { return updateDb(db => { const cutoff = Date.now() - 90 * 86400000; const sessions = db.userSessions || []; const before = sessions.length; db.userSessions = sessions.filter(row => !row.revokedAt || new Date(row.revokedAt).getTime() > cutoff || new Date(row.expiresAt).getTime() > cutoff); db.authSecurityEvents = (db.authSecurityEvents || []).filter(row => new Date(row.createdAt).getTime() > cutoff); return { removed: before - db.userSessions.length } }) }
export { ACCESS_TTL_SECONDS, browserRequest }
