import bcrypt from 'bcryptjs'
import { signJwt } from '../services/jwtKeyService.js'
import { readDb as readAuthorityDb, writeDb as writeAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { isAdminRole, normalizeEmail } from '../utils/authInputs.js'
import { createId, nowIso } from '../utils/api.js'
import { getDiscoveryAnalyticsAsync, getDiscoveryConfigAsync, updateDiscoveryConfigAsync } from '../services/discoveryService.js'
import { migrationTelemetrySnapshot } from '../services/intelligence/migrationTelemetry.js'
import { upsertComparableAsync } from '../services/investorDealRoomCompletionService.js'
import { requestAdminRouterTelemetry } from '../services/aiRouterClient.js'
import { securityPostureSnapshot } from '../services/securityPostureService.js'
import { listSecurityEvents } from '../services/securityEventService.js'
import { adminAuthEnabled, findAdminById, findAdminByEmail, listAdminRecords, saveAdmin, deleteAdminRecord, adminTelemetryCollections, appendAdminTelemetry } from '../repositories/adminAuthRepository.js'

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const JWT_ISSUER = process.env.JWT_ISSUER
const JWT_AUDIENCE = process.env.JWT_AUDIENCE
const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10)

const INITIAL_SUPER_ADMIN_EMAIL = process.env.ADMIN_SUPER_EMAIL
const INITIAL_SUPER_ADMIN_PASSWORD = process.env.ADMIN_SUPER_PASSWORD
const ADMIN_PASSWORD_MIN_LENGTH = 14

function makeAdminToken(userId, role) {
    return signJwt(
      { sub: userId, role, workspaceId: `admin-${userId}` },
      {
        expiresIn: JWT_EXPIRES_IN,
        ...(JWT_ISSUER ? { issuer: JWT_ISSUER } : {}),
        ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
      },
    )
  }

function publicAdmin(admin) {
  return {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    firstName: admin.firstName,
    lastName: admin.lastName,
    permissions: admin.permissions,
  }
}

// Row-level super-admin bootstrap (§5): mirrors ensureSuperAdmin without the
// whole-database request snapshot.
async function ensureSuperAdminRow() {
  if (!INITIAL_SUPER_ADMIN_EMAIL || !INITIAL_SUPER_ADMIN_PASSWORD) return
  if (INITIAL_SUPER_ADMIN_PASSWORD.length < ADMIN_PASSWORD_MIN_LENGTH) {
    throw new Error(`ADMIN_SUPER_PASSWORD must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`)
  }
  if (await findAdminByEmail(INITIAL_SUPER_ADMIN_EMAIL)) return
  await saveAdmin({
    id: createId('admin'),
    email: INITIAL_SUPER_ADMIN_EMAIL,
    passwordHash: bcrypt.hashSync(INITIAL_SUPER_ADMIN_PASSWORD, SALT_ROUNDS),
    role: 'super_admin',
    firstName: 'Super',
    lastName: 'Admin',
    permissions: ['all'],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: null,
    active: true,
  })
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
    writeAuthorityDb(db)
  }
}

export async function adminLogin(req, res) {
  const email = normalizeEmail(req.body.email)
  const password = String(req.body.password || '')
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  if (adminAuthEnabled()) {
    try {
      await ensureSuperAdminRow()
    } catch {
      return res.status(503).json({ error: 'Admin bootstrap configuration is invalid' })
    }
    const admin = await findAdminByEmail(email)
    if (!admin || admin.active === false || !bcrypt.compareSync(password, admin.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const updated = { ...admin, lastLoginAt: nowIso(), updatedAt: nowIso() }
    await saveAdmin(updated)
    return res.json({ token: makeAdminToken(updated.id, updated.role), admin: publicAdmin(updated) })
  }

  const db = readAuthorityDb()
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
  writeAuthorityDb(db)

  const token = makeAdminToken(admin.id, admin.role)
  return res.json({ token, admin: publicAdmin(admin) })
}

export async function adminMe(req, res) {
  if (adminAuthEnabled()) {
    const admin = await findAdminById(req.user.id)
    if (!admin) return res.status(404).json({ error: 'Admin not found' })
    return res.json({ ...publicAdmin(admin), lastLoginAt: admin.lastLoginAt })
  }
  const db = readAuthorityDb()
  const admin = (db.adminUsers || []).find(u => u.id === req.user.id)
  if (!admin) return res.status(404).json({ error: 'Admin not found' })
  return res.json({ ...publicAdmin(admin), lastLoginAt: admin.lastLoginAt })
}

export async function adminIntelligenceTelemetry(_req, res) {
  const rowLevel = adminAuthEnabled()
  const db = rowLevel ? await adminTelemetryCollections() : readAuthorityDb()
  const count = name => Array.isArray(db[name]) ? db[name].length : 0
  const telemetry = migrationTelemetrySnapshot()
  const platform = {
    users: count('users'),
    verifiedUsers: (db.profiles || []).filter(row => row.isVerified === true).length,
    projects: count('projects'),
    activeProjects: (db.projects || []).filter(row => !['completed', 'archived', 'closed'].includes(String(row.status || '').toLowerCase())).length,
    mentorshipRooms: count('mentorshipRooms'),
    mentorshipApplications: count('mentorshipApplications'),
    mentorshipTasks: count('mentorshipTasks'),
    organizations: count('organizations'),
    organizationMembers: count('organizationMemberships'),
    organizationPrograms: count('organizationPrograms'),
    organizationCohorts: count('organizationCohorts'),
    organizationRisks: count('organizationRiskSignals'),
    organizationActions: count('organizationActions'),
    investorDealRooms: count('dealRooms'),
    diligenceItems: count('diligenceItems'),
    investorRecommendations: count('investorRecommendations'),
    notifications: count('notifications'),
    authSecurityEvents: count('authSecurityEvents'),
    authorizationAuditLogs: count('authorizationAuditLogs'),
    investorNdaSignatures: count('ndaSignatures'),
    investorQuestionnaires: count('investorQuestionnaireSubmissions'),
    investorVerifiedRevenue: (db.revenueVerifications || []).filter(row => row.status === 'verified').length,
    investorReferencesCompleted: (db.referenceRequests || []).filter(row => ['completed', 'submitted'].includes(row.status)).length,
    investorIcProceed: (db.icReviews || []).filter(row => row.recommendation === 'proceed').length,
    mentorshipActiveRooms: (db.mentorshipRooms || []).filter(row => row.status === 'published').length,
    mentorshipAcceptedApplications: (db.mentorshipApplications || []).filter(row => row.status === 'accepted').length,
    mentorshipCompletedTasks: (db.mentorshipTasks || []).filter(row => ['completed', 'done'].includes(String(row.status || '').toLowerCase())).length,
    organizationOpenRisks: (db.organizationRiskSignals || []).filter(row => !['resolved', 'dismissed'].includes(row.status)).length,
    organizationOverdueActions: (db.organizationActions || []).filter(row => row.dueDate && new Date(row.dueDate).getTime() < Date.now() && !['completed', 'dismissed'].includes(row.status)).length,
    generatedAt: new Date().toISOString(),
  }
  const snapshot = { id: createId('admin_telemetry'), ...platform }
  if (rowLevel) {
    const history = [...(db.adminTelemetrySnapshots || []), snapshot].slice(-100)
    await appendAdminTelemetry(snapshot)
    return res.json({ telemetry, platform, history })
  }
  updateAuthorityDb(current => {
    if (!Array.isArray(current.adminTelemetrySnapshots)) current.adminTelemetrySnapshots = []
    current.adminTelemetrySnapshots.push(snapshot)
    if (current.adminTelemetrySnapshots.length > 1000) current.adminTelemetrySnapshots.splice(0, current.adminTelemetrySnapshots.length - 1000)
    return current
  })
  return res.json({ telemetry, platform, history: (db.adminTelemetrySnapshots || []).slice(-100) })
}
export async function adminAiRouterTelemetry(_req, res) {
  const result = await requestAdminRouterTelemetry()
  if (!result.ok) return res.status(result.status).json({ error: result.error })
  return res.json({ source: 'ai-router', telemetry: result.telemetry, generatedAt: new Date().toISOString() })
}
export async function adminSecurityPosture(_req, res) { return res.json(await securityPostureSnapshot()) }
export async function adminSecurityEvents(req, res) { return res.json({ events: await listSecurityEvents(req.query.limit) }) }
export async function adminComparableUpsert(req, res) { const value = await upsertComparableAsync(req.user.id, req.body); return value.ok ? res.status(req.body.id ? 200 : 201).json(value) : res.status(400).json(value) }

export async function adminList(req, res) {
  const records = adminAuthEnabled() ? await listAdminRecords() : (readAuthorityDb().adminUsers || [])
  const admins = records.map(u => ({ ...publicAdmin(u), active: u.active, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt }))
  return res.json({ admins })
}

export async function adminCreate(req, res) {
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
  if (adminAuthEnabled()) {
    if (await findAdminByEmail(email)) return res.status(409).json({ error: 'Admin with this email already exists' })
    await saveAdmin(admin)
    return res.status(201).json({ admin: publicAdmin(admin) })
  }
  const db = readAuthorityDb()
  if (!db.adminUsers) db.adminUsers = []
  if (db.adminUsers.some(u => u.email === email)) {
    return res.status(409).json({ error: 'Admin with this email already exists' })
  }
  db.adminUsers.push(admin)
  writeAuthorityDb(db)
  return res.status(201).json({ admin: publicAdmin(admin) })
}

export async function adminUpdate(req, res) {
  const rowLevel = adminAuthEnabled()
  const current = rowLevel ? await findAdminById(req.params.id) : (readAuthorityDb().adminUsers || []).find(u => u.id === req.params.id)
  if (!current) return res.status(404).json({ error: 'Admin not found' })

  const admin = { ...current }
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
  if (rowLevel) {
    await saveAdmin(admin)
  } else {
    const db = readAuthorityDb()
    const idx = (db.adminUsers || []).findIndex(u => u.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Admin not found' })
    db.adminUsers[idx] = admin
    writeAuthorityDb(db)
  }
  return res.json({ admin: { ...publicAdmin(admin), active: admin.active } })
}

export async function adminDelete(req, res) {
  if (adminAuthEnabled()) {
    const deleted = await deleteAdminRecord(req.params.id)
    if (!deleted) return res.status(404).json({ error: 'Admin not found' })
    return res.json({ ok: true })
  }
  const db = readAuthorityDb()
  if (!db.adminUsers) return res.status(404).json({ error: 'Admin not found' })
  const before = db.adminUsers.length
  db.adminUsers = db.adminUsers.filter(u => u.id !== req.params.id)
  if (db.adminUsers.length === before) return res.status(404).json({ error: 'Admin not found' })
  writeAuthorityDb(db)
  return res.json({ ok: true })
}

export async function adminDiscoveryConfig(_req, res) {
  return res.json({ config: await getDiscoveryConfigAsync() })
}

export async function adminUpdateDiscoveryConfig(req, res) {
  return res.json({ config: await updateDiscoveryConfigAsync(req.body) })
}

export async function adminDiscoveryAnalytics(_req, res) {
  return res.json({ analytics: await getDiscoveryAnalyticsAsync() })
}
