import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { readDb, writeDb } from '../config/database.js'
import { isAdminRole, normalizeEmail } from '../utils/authInputs.js'
import { createId, nowIso } from '../utils/api.js'
import { getDiscoveryAnalytics, getDiscoveryConfig, updateDiscoveryConfig } from '../services/discoveryService.js'
import { migrationTelemetrySnapshot } from '../services/intelligence/migrationTelemetry.js'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const JWT_ISSUER = process.env.JWT_ISSUER
const JWT_AUDIENCE = process.env.JWT_AUDIENCE
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10)

const INITIAL_SUPER_ADMIN_EMAIL = process.env.ADMIN_SUPER_EMAIL
const INITIAL_SUPER_ADMIN_PASSWORD = process.env.ADMIN_SUPER_PASSWORD
const ADMIN_PASSWORD_MIN_LENGTH = 14

function makeAdminToken(userId, role) {
  return jwt.sign(
    { sub: userId, role, workspaceId: `admin-${userId}` },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
      ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
    },
  )
}

function ensureSuperAdmin(db) {
  if (!db.adminUsers) db.adminUsers = []
  if (!INITIAL_SUPER_ADMIN_EMAIL || !INITIAL_SUPER_ADMIN_PASSWORD) return
  if (INITIAL_SUPER_ADMIN_PASSWORD.length < ADMIN_PASSWORD_MIN_LENGTH) {
    throw new Error(`ADMIN_SUPER_PASSWORD must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`)
  }
  const existing = db.adminUsers.find(u => u.email === INITIAL_SUPER_ADMIN_EMAIL)
  if (!existing) {
    const hash = bcrypt.hashSync(INITIAL_SUPER_ADMIN_PASSWORD, SALT_ROUNDS)
    db.adminUsers.push({
      id: createId('admin'),
      email: INITIAL_SUPER_ADMIN_EMAIL,
      passwordHash: hash,
      role: 'super_admin',
      firstName: 'Super',
      lastName: 'Admin',
      permissions: ['all'],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: null,
      active: true,
    })
    writeDb(db)
  }
}

export function adminLogin(req, res) {
  const email = normalizeEmail(req.body.email)
  const password = String(req.body.password || '')
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  const db = readDb()
  try {
    ensureSuperAdmin(db)
  } catch {
    return res.status(503).json({ error: 'Admin bootstrap configuration is invalid' })
  }

  const admin = (db.adminUsers || []).find(u => u.email === email && u.active !== false)
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = bcrypt.compareSync(password, admin.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  admin.lastLoginAt = nowIso()
  writeDb(db)

  const token = makeAdminToken(admin.id, admin.role)
  return res.json({
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      firstName: admin.firstName,
      lastName: admin.lastName,
      permissions: admin.permissions,
    },
  })
}

export function adminMe(req, res) {
  const db = readDb()
  const admin = (db.adminUsers || []).find(u => u.id === req.user.id)
  if (!admin) return res.status(404).json({ error: 'Admin not found' })
  return res.json({
    id: admin.id,
    email: admin.email,
    role: admin.role,
    firstName: admin.firstName,
    lastName: admin.lastName,
    permissions: admin.permissions,
    lastLoginAt: admin.lastLoginAt,
  })
}

export function adminIntelligenceTelemetry(_req, res) {
  return res.json({ telemetry: migrationTelemetrySnapshot() })
}

export function adminList(req, res) {
  const db = readDb()
  const admins = (db.adminUsers || []).map(u => ({
    id: u.id,
    email: u.email,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
    permissions: u.permissions,
    active: u.active,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }))
  return res.json({ admins })
}

export function adminCreate(req, res) {
  const email = normalizeEmail(req.body.email)
  const password = String(req.body.password || '')
  const role = req.body.role || 'admin'
  const firstName = String(req.body.firstName || '').trim()
  const lastName = String(req.body.lastName || '').trim()
  const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : ['read']

  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  if (!isAdminRole(role)) return res.status(400).json({ error: 'Invalid admin role' })
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters` })
  }

  const db = readDb()
  if (!db.adminUsers) db.adminUsers = []

  if (db.adminUsers.some(u => u.email === email)) {
    return res.status(409).json({ error: 'Admin with this email already exists' })
  }

  const hash = bcrypt.hashSync(password, SALT_ROUNDS)
  const admin = {
    id: createId('admin'),
    email,
    passwordHash: hash,
    role,
    firstName,
    lastName,
    permissions,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: null,
    active: true,
  }
  db.adminUsers.push(admin)
  writeDb(db)

  return res.status(201).json({
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      firstName: admin.firstName,
      lastName: admin.lastName,
      permissions: admin.permissions,
    },
  })
}

export function adminUpdate(req, res) {
  const db = readDb()
  if (!db.adminUsers) return res.status(404).json({ error: 'Admin not found' })

  const admin = db.adminUsers.find(u => u.id === req.params.id)
  if (!admin) return res.status(404).json({ error: 'Admin not found' })

  if (req.body.role && isAdminRole(req.body.role)) admin.role = req.body.role
  if (req.body.firstName) admin.firstName = String(req.body.firstName).trim()
  if (req.body.lastName) admin.lastName = String(req.body.lastName).trim()
  if (Array.isArray(req.body.permissions)) admin.permissions = req.body.permissions
  if (typeof req.body.active === 'boolean') admin.active = req.body.active
  if (req.body.password !== undefined) {
    const password = String(req.body.password)
    if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters` })
    }
    admin.passwordHash = bcrypt.hashSync(password, SALT_ROUNDS)
  }
  admin.updatedAt = nowIso()
  writeDb(db)

  return res.json({
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      firstName: admin.firstName,
      lastName: admin.lastName,
      permissions: admin.permissions,
      active: admin.active,
    },
  })
}

export function adminDelete(req, res) {
  const db = readDb()
  if (!db.adminUsers) return res.status(404).json({ error: 'Admin not found' })
  const before = db.adminUsers.length
  db.adminUsers = db.adminUsers.filter(u => u.id !== req.params.id)
  if (db.adminUsers.length === before) return res.status(404).json({ error: 'Admin not found' })
  writeDb(db)
  return res.json({ ok: true })
}

export function adminDiscoveryConfig(_req, res) {
  return res.json({ config: getDiscoveryConfig() })
}

export function adminUpdateDiscoveryConfig(req, res) {
  return res.json({ config: updateDiscoveryConfig(req.body) })
}

export function adminDiscoveryAnalytics(_req, res) {
  return res.json({ analytics: getDiscoveryAnalytics() })
}
