import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Resend } from 'resend'
import { createHash, randomBytes, randomUUID } from 'crypto'
import { readDb, updateDb, writeDb } from '../config/database.js'
import { isAllowedRole, normalizeEmail } from '../utils/authInputs.js'
import { activateRoleAssignment, getActiveContext, normalizeRole, roleAssignments } from '../services/multiRoleContextService.js'
import { assertEmailAccepted, configuredFromEmail } from '../utils/emailDelivery.js'
import { recordActivityInDb } from '../services/discoveryService.js'
import { clearSessionCookies, issueSession, listSessions, mobileClient, refreshTokenFromRequest, revokeAllSessions, revokeSession, rotateSession, setSessionCookies } from '../services/sessionService.js'
import { recordMigrationEvent } from '../services/migrationOutboxService.js'
import { findIdentityByEmail, findIdentityById } from '../repositories/identityRepository.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'This secret must match the value used by ai-router and ' +
    'BACKEND/messaging-backend so platform tokens verify across services.'
  )
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const JWT_ISSUER = process.env.JWT_ISSUER
const JWT_AUDIENCE = process.env.JWT_AUDIENCE
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10)
const RESET_EXPIRES_MINUTES = parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '30', 10)
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

let _resend
function getResend() {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('RESEND_API_KEY is required to send password reset emails')
  }
  _resend = new Resend(key)
  return _resend
}

function makeToken(userId, profile = null) {
  const claims = {
    sub: userId,
    role: profile?.role || 'explorer',
    workspaceId: profile?.workspaceId || `user-${userId}`,
  }
  return jwt.sign(claims, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
    ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
  })
}

function buildProfile(data, now) {
  return {
    id: data.id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    username: null,
    phone: data.phone || '',
    country: data.country || '',
    countryCode: data.countryCode || '',
    avatarUrl: null,
    bio: null,
    role: normalizeRole(data.role || 'explorer'),
    secondaryRoles: [],
    creditBalance: 0,
    credibilityScore: 0,
    isVerified: true,
    isOnboarded: false,
    startupStage: null,
    industries: [],
    experience: null,
    skills: [],
    weeklyHours: null,
    riskTolerance: null,
    investmentFocus: [],
    ticketSize: null,
    orgName: null,
    orgType: null,
    website: null,
    linkedinUrl: null,
    githubUrl: null,
    portfolioUrl: null,
    timezone: null,
    certifications: [],
    createdAt: now,
    updatedAt: now,
  }
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function cleanEmailVerifications(records = []) {
  const now = Date.now()
  return records.filter(r => !r.consumedAt && new Date(r.expiresAt).getTime() > now)
}

function cleanPasswordResets(records = []) {
  const now = Date.now()
  return records.filter(r => !r.consumedAt && new Date(r.expiresAt).getTime() > now)
}

function consumeEmailVerification(db, email, token) {
  db.emailVerifications = cleanEmailVerifications(db.emailVerifications)
  const tokenHash = hashToken(token || '')
  const record = db.emailVerifications.find(r => r.email === email && r.tokenHash === tokenHash)
  if (!record) return false

  record.consumedAt = new Date().toISOString()
  return true
}

function makePasswordResetToken() {
  return `${randomUUID()}.${randomBytes(32).toString('base64url')}`
}

function makePasswordResetRecord(user) {
  const resetToken = makePasswordResetToken()
  const now = Date.now()
  return {
    resetToken,
    record: {
      id: randomUUID(),
      userId: user.id,
      email: user.email,
      tokenHash: hashToken(resetToken),
      expiresAt: new Date(now + RESET_EXPIRES_MINUTES * 60 * 1000).toISOString(),
      consumedAt: null,
      createdAt: new Date(now).toISOString(),
    },
  }
}

async function sendPasswordResetEmail(email, resetUrl) {
  const delivery = await getResend().emails.send({
    from: configuredFromEmail('password reset emails'),
    to: [email],
    subject: 'Reset your TechIT password',
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#09090f;font-family:'Inter',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090f;padding:40px 0;">
            <tr><td align="center">
              <table width="480" cellpadding="0" cellspacing="0" style="background:#111120;border-radius:16px;border:1px solid rgba(139,92,246,.18);overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg,#5b21b6,#4f46e5);padding:32px 40px;">
                    <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">TECHIT NETWORK</p>
                    <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,.7);letter-spacing:3px;font-family:monospace;">PASSWORD RESET</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px;">
                    <p style="margin:0 0 18px;font-size:15px;color:#ededf5;">Use this secure link to reset your password:</p>
                    <a href="${resetUrl}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px;font-size:14px;font-weight:700;">Reset password</a>
                    <p style="margin:18px 0 0;font-size:13px;color:#8080a0;">This link expires in ${RESET_EXPIRES_MINUTES} minutes. If you didn't request it, you can ignore this email.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>
    `,
  })
  assertEmailAccepted(delivery, 'password reset email')
}

export async function signup(req, res) {
  const {
    email: rawEmail, password, firstName, lastName,
    phone = '', country = '', countryCode = '', role = 'founder',
    emailVerificationToken,
  } = req.body
  const email = normalizeEmail(rawEmail)

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Email, password, first name, and last name are required' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  if (!isAllowedRole(role)) {
    return res.status(400).json({ error: 'Role is invalid' })
  }

  if (!emailVerificationToken) {
    return res.status(400).json({ error: 'Email must be verified before creating an account' })
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const id = randomUUID()
  const now = new Date().toISOString()
  const requestedRole = normalizeRole(role || 'founder')
  const profile = buildProfile({ id, email, firstName, lastName, phone, country, countryCode, role: requestedRole }, now)
  const result = updateDb(db => {
    if (db.users.find(u => u.email === email)) {
      return { status: 409, error: 'Email already in use' }
    }

    if (!consumeEmailVerification(db, email, emailVerificationToken)) {
      return { status: 400, error: 'Email verification is invalid or expired' }
    }

    db.users.push({ id, email, passwordHash, createdAt: now, updatedAt: now })
    db.profiles.push(profile)
    const roleAssignment = { id: randomUUID(), userId: id, role: requestedRole, status: 'active', active: true, assurance: 'CLAIMED', isPrimary: true, createdAt: now, updatedAt: now }
    ;(db.userRoles || (db.userRoles = [])).push(roleAssignment)
    ;(db.activeContexts || (db.activeContexts = [])).push({ id: randomUUID(), userId: id, role: requestedRole, roleAssignmentId: roleAssignment.id, organizationId: null, workspaceId: `user-${id}`, resourceType: null, resourceId: null, status: 'active', startedAt: now, lastActiveAt: now, updatedAt: now })
    recordMigrationEvent(db, { domain: 'identity', aggregateType: 'user', aggregateId: id, operation: 'upsert', payload: { userId: id, email, role: requestedRole }, version: 1 })
    return { status: 201, profile }
  })

  if (result.status !== 201) {
    return res.status(result.status).json({ error: result.error })
  }

  const credentials = issueSession({ id, email }, profile, req, { rememberMe: req.body.rememberMe !== false })
  if (!mobileClient(req)) setSessionCookies(res, credentials)
  return res.status(201).json({
    token: credentials.accessToken,
    ...(mobileClient(req) ? { refreshToken: credentials.refreshToken } : {}),
    user: { id, email, user_metadata: {} },
    profile,
  })
}

export async function signin(req, res) {
  const { email: rawEmail, password } = req.body
  const email = normalizeEmail(rawEmail)

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  const identity = await findIdentityByEmail(email)
  const user = identity?.user
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const profile = identity.profile
  const db = readDb()
  recordActivityInDb(db, user.id, 'login', 'auth')
  writeDb(db)
  roleAssignments(user.id)

  const credentials = issueSession(user, profile, req, { rememberMe: req.body.rememberMe !== false })
  if (!mobileClient(req)) setSessionCookies(res, credentials)
  return res.json({
    token: credentials.accessToken,
    ...(mobileClient(req) ? { refreshToken: credentials.refreshToken } : {}),
    user: { id: user.id, email: user.email, user_metadata: {} },
    profile,
  })
}

export async function session(req, res) {
  const identity = await findIdentityById(req.user.id)
  const db = readDb()
  const profile = identity?.profile || null
  const lastContext = (db.userContextCheckpoints || []).filter(row => row.userId === req.user.id && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now())).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  recordActivityInDb(db, req.user.id, 'session', 'auth')
  writeDb(db)
  const assignments = roleAssignments(req.user.id)
  return res.json({ user: req.user, profile, session: req.user.sessionId ? { id: req.user.sessionId } : null, lastContext, roleAssignments: assignments.contexts, activeContext: assignments.activeContext || getActiveContext(req.user.id), availableContexts: assignments.contexts })
}

export function signout(req, res) {
  if (req.user.sessionId) revokeSession(req.user.id, req.user.sessionId)
  clearSessionCookies(res)
  return res.json({ message: 'Signed out' })
}

export function refresh(req, res) {
  const result = rotateSession(refreshTokenFromRequest(req), req)
  if (!result.ok) { clearSessionCookies(res); return res.status(401).json({ error: result.error }) }
  if (!mobileClient(req)) setSessionCookies(res, result); return res.json({ token: result.accessToken, ...(mobileClient(req) ? { refreshToken: result.refreshToken } : {}), user: { id: result.user.id, email: result.user.email, user_metadata: {} }, profile: result.profile })
}

export function activeSessions(req, res) { return res.json({ sessions: listSessions(req.user.id, req.user.sessionId) }) }
export function revokeActiveSession(req, res) { const result = revokeSession(req.user.id, req.params.sessionId); return result.ok ? res.json(result) : res.status(404).json(result) }
export function revokeOtherSessions(req, res) { return res.json(revokeAllSessions(req.user.id, req.user.sessionId)) }
export function revokeEverySession(req, res) { const result = revokeAllSessions(req.user.id); clearSessionCookies(res); return res.json(result) }

export async function changePassword(req, res) {
  const currentPassword = String(req.body.currentPassword || '')
  const newPassword = String(req.body.newPassword || '')
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' })
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' })
  }

  const db = readDb()
  const user = db.users.find(row => row.id === req.user.id)
  if (!user || !await bcrypt.compare(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  const updated = updateDb(current => {
    const target = current.users.find(row => row.id === req.user.id)
    if (!target) return false
    target.passwordHash = passwordHash
    target.updatedAt = new Date().toISOString()
    for (const session of current.userSessions || []) if (session.userId === req.user.id && !session.revokedAt) session.revokedAt = new Date().toISOString()
    ;(current.authSecurityEvents || (current.authSecurityEvents = [])).push({ id: randomUUID(), userId: req.user.id, eventType: 'password_changed', createdAt: new Date().toISOString() })
    return true
  })
  if (!updated) return res.status(404).json({ error: 'User not found' })
  return res.json({ message: 'Password updated successfully' })
}

export async function forgotPassword(req, res) {
  const { email: rawEmail } = req.body
  const email = normalizeEmail(rawEmail)
  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  const db = readDb()
  const user = db.users.find(u => u.email === email)
  let resetToken = null
  if (user) {
    const reset = makePasswordResetRecord(user)
    resetToken = reset.resetToken
    if (process.env.NODE_ENV === 'production') {
      try {
        const resetUrl = `${FRONTEND_URL}/reset-password?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(resetToken)}`
        await sendPasswordResetEmail(user.email, resetUrl)
      } catch (err) {
        console.error('[Auth] password reset email error:', err.message)
        resetToken = null
        return res.json({
          message: 'If an account exists for that email, a password reset link has been sent.',
          expiresIn: RESET_EXPIRES_MINUTES * 60,
        })
      }
    }
    const persisted = updateDb(current => {
      const freshUser = current.users.find(u => u.id === user.id && u.email === email)
      if (!freshUser) return false
      current.passwordResets = cleanPasswordResets(current.passwordResets)
        .filter(r => r.userId !== user.id)
      current.passwordResets.push(reset.record)
      return true
    })
    if (!persisted) resetToken = null
  }

  const body = {
    message: 'If an account exists for that email, a password reset link has been sent.',
    expiresIn: RESET_EXPIRES_MINUTES * 60,
  }

  if (process.env.NODE_ENV === 'test' && resetToken) {
    body.resetToken = resetToken
  }
  if (process.env.NODE_ENV !== 'production' && resetToken) {
    body.resetUrl = `${FRONTEND_URL}/reset-password?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(resetToken)}`
  }

  return res.json(body)
}

export async function resetPassword(req, res) {
  const { email: rawEmail, token, password } = req.body
  const email = normalizeEmail(rawEmail)
  if (!email || !token || !password) {
    return res.status(400).json({ error: 'Email, token, and password are required' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const now = new Date().toISOString()
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const result = updateDb(db => {
    db.passwordResets = cleanPasswordResets(db.passwordResets)

    const tokenHash = hashToken(token)
    const record = db.passwordResets.find(r => r.email === email && r.tokenHash === tokenHash)
    if (!record) {
      return { ok: false }
    }

    const user = db.users.find(u => u.id === record.userId && u.email === email)
    if (!user) {
      return { ok: false }
    }

    user.passwordHash = passwordHash
    user.updatedAt = now
    record.consumedAt = now
    return { ok: true }
  })

  if (!result.ok) {
    return res.status(400).json({ error: 'Password reset token is invalid or expired' })
  }

  return res.json({ message: 'Password reset successfully' })
}
