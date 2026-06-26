import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { readDb, writeDb } from '../config/database.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'This secret must match the value used by ai-router and ' +
    'BACKEND/feat/messaging-backend so platform tokens verify across services.'
  )
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10)

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
    isVerified: false,
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

export async function signup(req, res) {
  const {
    email, password, firstName, lastName,
    phone = '', country = '', countryCode = '', role = 'founder',
    otpVerified,   // frontend passes true after OTP step
  } = req.body

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Email, password, first name, and last name are required' })
  }

  if (!otpVerified) {
    return res.status(400).json({ error: 'Email must be verified before creating an account' })
  }

  const db = readDb()
  if (db.users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already in use' })
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
  const { email, password } = req.body

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
