import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Resend } from 'resend'
import { createHash, randomBytes, randomUUID } from 'crypto'
import { readDb, writeDb } from '../config/database.js'
import { isAllowedRole, normalizeEmail } from '../utils/authInputs.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'This secret must match the value used by ai-router and ' +
    'BACKEND/messaging-backend so platform tokens verify across services.'
  )
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10)
const RESET_EXPIRES_MINUTES = parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '30', 10)
const FROM = process.env.FROM_EMAIL || 'TechIT <onboarding@resend.dev>'
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
    role: profile?.role || 'founder',
    workspaceId: profile?.workspaceId || `user-${userId}`,
  }
  return jwt.sign(claims, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
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
    role: data.role || 'founder',
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

async function persistPasswordReset(db, user) {
  const resetToken = makePasswordResetToken()
  const now = Date.now()
  db.passwordResets = cleanPasswordResets(db.passwordResets)
    .filter(r => r.userId !== user.id)
  db.passwordResets.push({
    id: randomUUID(),
    userId: user.id,
    email: user.email,
    tokenHash: hashToken(resetToken),
    expiresAt: new Date(now + RESET_EXPIRES_MINUTES * 60 * 1000).toISOString(),
    consumedAt: null,
    createdAt: new Date(now).toISOString(),
  })
  return resetToken
}

async function sendPasswordResetEmail(email, resetUrl) {
  await getResend().emails.send({
    from: FROM,
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

  if (!isAllowedRole(role)) {
    return res.status(400).json({ error: 'Role is invalid' })
  }

  if (!emailVerificationToken) {
    return res.status(400).json({ error: 'Email must be verified before creating an account' })
  }

  const db = readDb()
  if (db.users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already in use' })
  }

  if (!consumeEmailVerification(db, email, emailVerificationToken)) {
    return res.status(400).json({ error: 'Email verification is invalid or expired' })
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const id = randomUUID()
  const now = new Date().toISOString()

  db.users.push({ id, email, passwordHash, createdAt: now, updatedAt: now })
  const profile = buildProfile({ id, email, firstName, lastName, phone, country, countryCode, role }, now)
  db.profiles.push(profile)
  writeDb(db)

  return res.status(201).json({
    token: makeToken(id, profile),
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

  const db = readDb()
  const user = db.users.find(u => u.email === email)
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const profile = db.profiles.find(p => p.id === user.id) || null

  return res.json({
    token: makeToken(user.id, profile),
    user: { id: user.id, email: user.email, user_metadata: {} },
    profile,
  })
}

export function session(req, res) {
  const db = readDb()
  const profile = db.profiles.find(p => p.id === req.user.id) || null
  return res.json({ user: req.user, profile })
}

export function signout(_req, res) {
  return res.json({ message: 'Signed out' })
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
    resetToken = await persistPasswordReset(db, user)
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
    writeDb(db)
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

  const db = readDb()
  db.passwordResets = cleanPasswordResets(db.passwordResets)

  const tokenHash = hashToken(token)
  const record = db.passwordResets.find(r => r.email === email && r.tokenHash === tokenHash)
  if (!record) {
    return res.status(400).json({ error: 'Password reset token is invalid or expired' })
  }

  const user = db.users.find(u => u.id === record.userId && u.email === email)
  if (!user) {
    return res.status(400).json({ error: 'Password reset token is invalid or expired' })
  }

  const now = new Date().toISOString()
  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  user.updatedAt = now
  record.consumedAt = now
  writeDb(db)

  return res.json({ message: 'Password reset successfully' })
}
