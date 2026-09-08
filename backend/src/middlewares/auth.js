import jwt from 'jsonwebtoken'
import { readDb as readAuthorityDb } from '../config/database.js'
import { accessTokenFromRequest, touchSessionAsync } from '../services/sessionService.js'
import { normalizeRole } from '../services/multiRoleContextService.js'
import { accountEntitlement } from '../services/tvceService.js'
import { compareIdentityProjection } from '../services/identityPostgresProjection.js'
import { findIdentityById, validateSessionBindingAsync } from '../repositories/identityRepository.js'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_ISSUER = process.env.JWT_ISSUER
const JWT_AUDIENCE = process.env.JWT_AUDIENCE
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'This secret must match the value used by ai-router and ' +
    'BACKEND/messaging-backend so platform tokens verify across services.'
  )
}

export async function requireAuth(req, res, next) {
  const credential = accessTokenFromRequest(req)
  if (!credential) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = credential.token
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
      ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
    })
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  const binding = await validateSessionBindingAsync(payload)
  if (!binding.valid) return res.status(401).json({ error: binding.error || 'Session invalid' })
  await touchSessionAsync(payload.sid)

  const identity = await findIdentityById(payload.sub)
  const user = identity?.user
  if (!user) return res.status(401).json({ error: 'User not found' })
  const profile = identity.profile
  if (!profile && process.env.NODE_ENV !== 'test') {
    return res.status(401).json({ error: 'User profile is unavailable' })
  }
  const persistedRole = profile?.role || 'explorer'
  const assignmentRows = (identity.roles || []).filter(row => row.active !== false && row.status === 'active')
  const persistedRoles = [...new Set(['explorer', ...assignmentRows.map(row => normalizeRole(row.role)), persistedRole, ...(profile?.secondaryRoles || []).map(normalizeRole), ...(profile?.roles || []).map(normalizeRole)])]
  const activeContext = identity.activeContext
  const requestedActiveRole = normalizeRole(activeContext?.role || profile?.activeRole || persistedRole)
  const activeRole = persistedRoles.includes(requestedActiveRole) ? requestedActiveRole : 'explorer'
  req.user = {
    id: user.id,
    email: user.email,
    // Authorization comes from current backend state, not stale token claims.
    // Test fixtures historically model role in the JWT only; production and
    // staging always use the persisted role authority.
    role: process.env.NODE_ENV === 'test' ? (payload.role || activeRole) : activeRole,
    roles: process.env.NODE_ENV === 'test' ? [...new Set([payload.role, ...persistedRoles].filter(Boolean))] : persistedRoles,
    workspaceId: profile?.workspaceId || `user-${user.id}`,
    activeContext: activeContext || { role: activeRole, workspaceId: null, organizationId: null, resourceType: null, resourceId: null },
    accountEntitlement: accountEntitlement(user.id),
    // Raw platform JWT, so controllers can forward it to ai-router
    // (which verifies the same JWT_SECRET). See aiRouterClient.js.
    token,
    sessionId: payload.sid || null,
    authSource: credential.source,
    user_metadata: {},
  }
  try {
    await compareIdentityProjection(user.id, user, profile)
  } catch {
    return res.status(503).json({ error: 'identity_verification_temporarily_unavailable' })
  }
  return next()
}

export function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' })
  const token = authHeader.slice(7)
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
      ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
    })
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  const db = readAuthorityDb()
  const admin = (db.adminUsers || []).find(row => row.id === payload.sub && row.active !== false)
  if (!admin) return res.status(401).json({ error: 'Admin not found or inactive' })
  req.user = { id: admin.id, email: admin.email, role: admin.role, permissions: admin.permissions || [], token }
  return next()
}
