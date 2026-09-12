import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { AsyncLocalStorage } from 'node:async_hooks'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')
const DEFAULT_JSON_DB_PATH = path.join(DATA_DIR, 'db.json')
const DEFAULT_SQLITE_DB_PATH = path.join(DATA_DIR, 'techit.sqlite')
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations/sqlite')
const require = createRequire(import.meta.url)

const INITIAL = {
  users: [],
  profiles: [],
  otps: [],
  emailVerifications: [],
  passwordResets: [],
  notifications: [],
  files: [],
  endorsements: [],
  mentorshipRooms: [],
  mentorshipMentees: [],
  mentorshipTasks: [],
  mentorshipApplications: [],
  mentorshipInvitations: [],
  mentorshipMessages: [],
  mentorshipResources: [],
  feedPosts: [],
  feedComments: [],
  feedLikes: [],
  haviThreads: [],
  projects: [],
  workspaces: [],
  workspaceInvitations: [],
  workspaceMembers: [],
  projectAnalyses: [],
  equityGrants: [],
  dilutionEvents: [],
  collaboratorEarnings: [],
  payouts: [],
  contributions: [],
  organizationDashboards: [],
  investorWatchlists: [],
  investorTrustAccessRequests: [],
  investorTrustAccessHistory: [],
  dealFlowSnapshots: [],
  investorIntelligenceSnapshots: [],
  investorRiskSignals: [],
  investorRecommendations: [],
  investorIntelligenceAudits: [],
  dealRooms: [],
  dealRoomParticipants: [],
  ndaTemplates: [],
  ndaSignatures: [],
  diligenceItems: [],
  diligenceEvidenceLinks: [],
  dataRoomFolders: [],
  dataRoomDocuments: [],
  dataRoomDocumentVersions: [],
  investorQuestionnaireTemplates: [],
  investorQuestionnaireSubmissions: [],
  revenueVerifications: [],
  referenceRequests: [],
  comparableTransactions: [],
  icApprovalHistory: [],
  investorPacks: [],
  dealClosingItems: [],
  dealQuestions: [],
  dealQuestionMessages: [],
  investorInternalNotes: [],
  icReviews: [],
  termSheetVersions: [],
  dealStatusEvents: [],
  dealAuditEvents: [],
  capitalPools: [],
  dealRooms: [],
  termSheets: [],
  dealDocuments: [],
  dataRooms: [],
  dataRoomAccess: [],
  investorReputation: [],
  investorReviews: [],
  ventureIntakes: [],
  ventureAnalyses: [],
  venturePipelineRuns: [],
  hackathons: [],
  hackathonTeams: [],
  hackathonMembers: [],
  hackathonInvitations: [],
  hackathonBriefs: [],
  hackathonCheckIns: [],
  hackathonScores: [],
  hackathonTeamWorkspaces: [],
  hackathonTeamReports: [],
  hackathonFinalSubmissions: [],
  opportunities: [],
  workspaceTasks: [],
  workspaceAgents: [],
  workspaceConnectors: [],
  workspaceReports: [],
  projectActivities: [],
  startupActivities: [],
  projectFiles: [],
  projectFileVersions: [],
  codeChangeEvents: [],
  codeSyncStates: [],
  codeRuntimeSessions: [],
  codeDeploymentRecords: [],
  codeBridgeGrants: [],
  codeBridgeSessions: [],
  codeExecutionRuns: [],
  codeExecutionStepEvents: [],
  codeReviewDecisions: [],
  codeDeploymentVerifications: [],
  walletAccounts: [],
  creditLedger: [],
  usageEvents: [],
  usageReservations: [],
  billingPlans: [],
  creditPackages: [],
  paymentIntents: [],
  subscriptions: [],
  invoices: [],
  notificationPreferences: [],
  settingsEvents: [],
  contracts: [],
  opportunityApplications: [],
  githubConnections: [],
  githubOauthStates: [],
  linkedinConnections: [],
  linkedinOauthStates: [],
  videoLessons: [],
  videoProgress: [],
  userStateMachine: [],
  userContextCheckpoints: [],
  userSuggestions: [],
  userSessionLogs: [],
  recommendationProfiles: [],
  recommendationPreferences: [],
  recommendationConfigs: [],
  recommendations: [],
  recommendationReasons: [],
  recommendationEvents: [],
  migrationOutbox: [],
  recommendationFeedback: [],
  recommendationExposures: [],
  userInterests: [],
  userIntents: [],
  userSkills: [],
  entityRelationships: [],
  networkEdges: [],
  userActivityStates: [],
  catchUpStates: [],
  adminUsers: [],
  adminTelemetrySnapshots: [],
  organizationMarketplace: [],
  organizationTalent: [],
  organizationSettings: [],
  organizationIntegrations: [],
  organizationPrograms: [],
  organizationAiOperations: [],
  organizationMarketReadiness: [],
  organizationCommunity: [],
  organizationHealthSnapshots: [],
  organizationRiskSignals: [],
  organizationActions: [],
  organizationActivityEvents: [],
  organizationKpiDefinitions: [],
  organizationKpiValues: [],
  organizationAuditEvents: [],
  organizationReportSchedules: [],
  organizationPartners: [],
  organizationCohorts: [],
  organizationResources: [],
  organizationRecommendations: [],
  organizationReports: [],
  organizationEntitlements: [],
  organizationBudgets: [],
  organizationUsage: [],
  organizationSponsorshipPackages: [],
  sponsorshipApplications: [],
  sponsorshipBenefits: [],
  startupCandidates: [],
  foundingPartnerAgreements: [],
  organizationBillingEvents: [],
  sponsorshipTransactions: [],
  managedHackathonOperations: [],
  organizationInstitutionalSettings: [],
  organizationAbuseReviews: [],
  consentRecords: [],
  dataSubjectRequests: [],
  dataResidencyPreferences: [],
  subprocessors: [],
  breachRecords: [],
  userRoles: [],
  roleProfiles: [],
  verificationProfiles: [],
  verificationRequests: [],
  verificationEvidence: [],
  trustProfiles: [],
  trustSignals: [],
  organizations: [],
  organizationDomains: [],
  organizationMemberships: [],
  organizationClaims: [],
  riskProfiles: [],
  manualReviews: [],
  verificationAuditLogs: [],
  capabilityPolicies: [],
  authorizationAuditLogs: [],
  supportCases: [],
  supportMessages: [],
  supportEvents: [],
  supportAssignments: [],
  supportFeedback: [],
  supportSlaPolicies: [],
  supportCategories: [],
  supportTeams: [],
  supportKnowledgeBase: [],
  supportTemplates: [],
  supportAuditLogs: [],
  supportLocks: [],
  supportAttachments: [],
  supportIncidents: [],
  supportIntelligenceSignals: [],
  supportSettings: [],
  mfaProfiles: [],
  mfaAssertions: [],
  evidenceObjects: [],
  capabilityConsumptions: [],
  capabilityAnalytics: [],
  accountEntitlements: [],
  paywallEvents: [],
  workflowSnapshots: [],
  billingWebhookEvents: [],
  rateCards: [],
  geoPricingProfiles: [],
  profitabilityEvents: [],
  marginAlerts: [],
  workspaceTeamEntitlements: [],
  billingJobRuns: [],
  tvceConfig: { freeQuotas: {}, capabilities: {} },
  verificationNotificationRuns: [],
  userSessions: [],
  authSecurityEvents: [],
  activeContexts: [],
  contextHistory: [],
  roleHistory: [],
  techitMoments: [],
  techitMomentShares: [],
  techitMomentReferrals: [],
  techitMomentEvents: [],
  academyCurricula: [],
  academyModules: [],
  academyProgress: [],
  academyAssessments: [],
  academyEvents: [],
  academyBadges: [],
  workspaceBuildProfiles: [],
  workspaceCostEstimates: [],
  workspaceLifecycleEvents: [],
  workspacePreviewContexts: [],
  userModelConnections: [],
  workspaceModelBindings: [],
  modelUsageEvents: [],
  hackathonProjectEntries: [],
  countryRegistryConfigurations: [],
  organizationRegistryChecks: [],
  organizationDomainChallenges: [],
  trustVerificationHistory: [],
  trustVerificationProofs: [],
  trustVerificationChallenges: [],
  verifiedSkills: [],
  trustScoreSnapshots: [],
  trustProjectionOutbox: [],
}

let sqliteDb = null
let sqliteDbPath = null
let DatabaseSync = null
const authorityStorage = new AsyncLocalStorage()

export function currentDatabaseAuthority() {
  return authorityStorage.getStore() || null
}

export function runDatabaseAuthority(snapshot, callback) {
  return authorityStorage.run({ snapshot, dirty: false }, callback)
}

function currentDriver() {
  const configured = process.env.DB_DRIVER?.trim().toLowerCase()
  if (configured) return configured
  return process.env.NODE_ENV === 'production' ? 'postgres' : 'json'
}

function jsonDbPath() {
  return process.env.JSON_DB_PATH || DEFAULT_JSON_DB_PATH
}

function sqlitePath() {
  return process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_DB_PATH
}

function cloneInitial() {
  return structuredClone(INITIAL)
}

function normalizeDb(data = {}) {
  const normalized = cloneInitial()
  for (const key of Object.keys(INITIAL)) {
    if (Array.isArray(data[key])) normalized[key] = data[key]
  }
  return normalized
}

function loadSqlite() {
  if (DatabaseSync) return DatabaseSync
  try {
    ;({ DatabaseSync } = require('node:sqlite'))
    return DatabaseSync
  } catch (err) {
    throw new Error(
      `SQLite persistence requires Node's built-in node:sqlite support. ` +
      `Use Node 22.5+ or set DB_DRIVER=json outside production. Cause: ${err.message}`
    )
  }
}

function ensureDirForFile(filePath) {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  }
}

function openSqlite(dbPath = sqlitePath()) {
  const Sqlite = loadSqlite()
  ensureDirForFile(dbPath)
  const db = new Sqlite(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA busy_timeout = 5000')
  return db
}

function migrationVersion(fileName) {
  return fileName.replace(/\.up\.sql$/, '')
}

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.up.sql'))
    .sort()
}

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `)
}

function ensureCollectionRows(db) {
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO app_collections (name, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO NOTHING
  `)
  for (const [key, value] of Object.entries(INITIAL)) {
    stmt.run(key, JSON.stringify(value), now)
  }
}

export function migrateSqlite({ dbPath = sqlitePath(), dryRun = false } = {}) {
  const db = openSqlite(dbPath)
  try {
    if (dryRun) db.exec('BEGIN IMMEDIATE')
    ensureMigrationTable(db)
    const appliedRows = db.prepare('SELECT version FROM schema_migrations').all()
    const applied = new Set(appliedRows.map(row => row.version))
    const insertMigration = db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')

    for (const fileName of migrationFiles()) {
      const version = migrationVersion(fileName)
      if (applied.has(version)) continue
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf-8')
      db.exec(sql)
      insertMigration.run(version, fileName)
    }

    ensureCollectionRows(db)
    if (dryRun) db.exec('ROLLBACK')
  } catch (err) {
    if (dryRun) {
      try { db.exec('ROLLBACK') } catch {}
    }
    throw err
  } finally {
    db.close()
  }
}

export function rollbackLatestSqliteMigration({ dbPath = sqlitePath(), dryRun = false } = {}) {
  const db = openSqlite(dbPath)
  try {
    ensureMigrationTable(db)
    const latest = db.prepare(`
      SELECT version, name
      FROM schema_migrations
      ORDER BY version DESC
      LIMIT 1
    `).get()
    if (!latest) return null

    const downFile = `${latest.version}.down.sql`
    const downPath = path.join(MIGRATIONS_DIR, downFile)
    if (!fs.existsSync(downPath)) {
      throw new Error(`Missing rollback migration: ${downFile}`)
    }

    db.exec('BEGIN IMMEDIATE')
    db.exec(fs.readFileSync(downPath, 'utf-8'))
    db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(latest.version)
    if (dryRun) db.exec('ROLLBACK')
    else db.exec('COMMIT')
    return latest
  } catch (err) {
    try { db.exec('ROLLBACK') } catch {}
    throw err
  } finally {
    db.close()
  }
}

function getSqliteDb() {
  const dbPath = sqlitePath()
  if (!sqliteDb || sqliteDbPath !== dbPath) {
    if (sqliteDb) sqliteDb.close()
    sqliteDb = openSqlite(dbPath)
    sqliteDbPath = dbPath
    ensureMigrationTable(sqliteDb)
    const appliedRows = sqliteDb.prepare('SELECT version FROM schema_migrations').all()
    const applied = new Set(appliedRows.map(row => row.version))
    const insertMigration = sqliteDb.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
    for (const fileName of migrationFiles()) {
      const version = migrationVersion(fileName)
      if (applied.has(version)) continue
      sqliteDb.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf-8'))
      insertMigration.run(version, fileName)
    }
    ensureCollectionRows(sqliteDb)
  }
  return sqliteDb
}

function readJsonDb() {
  const dbPath = jsonDbPath()
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    fs.writeFileSync(dbPath, JSON.stringify(INITIAL, null, 2))
    return cloneInitial()
  }
  return normalizeDb(JSON.parse(fs.readFileSync(dbPath, 'utf-8')))
}

function writeJsonDb(data) {
  const dbPath = jsonDbPath()
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  fs.writeFileSync(dbPath, JSON.stringify(normalizeDb(data), null, 2))
}

function readSqliteDb() {
  const db = getSqliteDb()
  return readSqliteCollections(db)
}

function readSqliteCollections(db) {
  const data = cloneInitial()
  const rows = db.prepare('SELECT name, value FROM app_collections').all()
  for (const row of rows) {
    if (!Object.prototype.hasOwnProperty.call(INITIAL, row.name)) continue
    const parsed = JSON.parse(row.value)
    data[row.name] = Array.isArray(parsed) ? parsed : []
  }
  return data
}

function writeSqliteDb(data) {
  const db = getSqliteDb()
  writeSqliteCollections(db, data)
}

function writeSqliteCollections(db, data, { transaction = true } = {}) {
  const normalized = normalizeDb(data)
  const stmt = db.prepare(`
    INSERT INTO app_collections (name, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `)

  if (transaction) db.exec('BEGIN IMMEDIATE')
  try {
    const now = new Date().toISOString()
    for (const key of Object.keys(INITIAL)) {
      stmt.run(key, JSON.stringify(normalized[key]), now)
    }
    if (transaction) db.exec('COMMIT')
  } catch (err) {
    if (transaction) {
      try { db.exec('ROLLBACK') } catch {}
    }
    throw err
  }
}

function assertSyncMutation(result) {
  if (result && typeof result.then === 'function') {
    throw new Error('updateAuthorityDb mutator must be synchronous')
  }
}

function updateJsonDb(mutator) {
  const data = readJsonDb()
  const result = mutator(data)
  assertSyncMutation(result)
  writeJsonDb(data)
  return result
}

function updateSqliteDb(mutator) {
  const db = getSqliteDb()
  db.exec('BEGIN IMMEDIATE')
  try {
    const data = readSqliteCollections(db)
    const result = mutator(data)
    assertSyncMutation(result)
    writeSqliteCollections(db, data, { transaction: false })
    db.exec('COMMIT')
    return result
  } catch (err) {
    try { db.exec('ROLLBACK') } catch {}
    throw err
  }
}

export function validateDatabaseConfig() {
  const driver = currentDriver()
  if (process.env.NODE_ENV === 'production' && !['single-node', 'multi-replica'].includes(process.env.SCALE_PROFILE || 'single-node')) {
    throw new Error('SCALE_PROFILE must be single-node or multi-replica.')
  }
  if (process.env.NODE_ENV === 'production' && process.env.SCALE_PROFILE === 'multi-replica' && !process.env.DATABASE_URL) {
    throw new Error('SCALE_PROFILE=multi-replica requires DATABASE_URL; configure the PostgreSQL migration before scaling replicas.')
  }
  if (process.env.NODE_ENV === 'production' && process.env.SCALE_PROFILE === 'multi-replica' && !process.env.REDIS_URL) {
    throw new Error('SCALE_PROFILE=multi-replica requires REDIS_URL for shared rate limits and coordination.')
  }
  if (process.env.NODE_ENV === 'production' && process.env.SCALE_PROFILE === 'multi-replica') {
    if (process.env.PLATFORM_REQUEST_AUTHORITY !== 'postgres' || process.env.PLATFORM_AUTHORITY_FALLBACK_SQLITE === 'true') {
      throw new Error('SCALE_PROFILE=multi-replica requires PLATFORM_REQUEST_AUTHORITY=postgres with SQLite fallback disabled.')
    }
    const domains = ['IDENTITY', 'WORKSPACE', 'CONTENT', 'INVESTOR', 'ORGANIZATION', 'FINANCE']
    for (const domain of domains) {
      if (process.env[`${domain}_READ_SOURCE`] !== 'postgres' || process.env[`${domain}_WRITE_SOURCE`] !== 'postgres') {
        throw new Error(`SCALE_PROFILE=multi-replica requires ${domain}_READ_SOURCE and ${domain}_WRITE_SOURCE to be postgres.`)
      }
      if (process.env[`${domain}_READ_FALLBACK_SQLITE`] === 'true' || process.env[`${domain}_WRITE_FALLBACK_SQLITE`] === 'true') {
        throw new Error(`SCALE_PROFILE=multi-replica requires ${domain} SQLite fallbacks to be disabled after rollback drills.`)
      }
    }
  }
  if (!['json', 'sqlite', 'postgres'].includes(driver)) {
    throw new Error(`Unsupported DB_DRIVER "${driver}". Use "sqlite", "postgres", or "json".`)
  }
  if (process.env.NODE_ENV === 'production' && driver === 'json') {
    throw new Error('DB_DRIVER=json is not allowed in production. Use DB_DRIVER=postgres.')
  }
  if (process.env.NODE_ENV === 'production' && driver === 'postgres' && !process.env.PLATFORM_DATABASE_URL && !process.env.DATABASE_URL) {
    throw new Error('PLATFORM_DATABASE_URL or DATABASE_URL is required in production for DB_DRIVER=postgres.')
  }
  if (process.env.NODE_ENV === 'production' && driver === 'sqlite' && !process.env.SQLITE_DB_PATH) {
    throw new Error('SQLITE_DB_PATH is required when explicitly using SQLite in production; set DB_DRIVER=postgres for the migrated platform.')
  }
  if (driver === 'sqlite') {
    migrateSqlite({ dbPath: sqlitePath(), dryRun: false })
  }
}

export function readAuthorityDb() {
  const authority = authorityStorage.getStore()
  if (authority?.snapshot) return authority.snapshot
  if (currentDriver() === 'postgres') throw new Error('PostgreSQL request authority context is required for synchronous collection access')
  return currentDriver() === 'sqlite' ? readSqliteDb() : readJsonDb()
}

export function writeAuthorityDb(data) {
  const authority = authorityStorage.getStore()
  if (authority?.snapshot) { authority.snapshot = data; authority.dirty = true; return }
  if (currentDriver() === 'postgres') throw new Error('PostgreSQL request authority context is required for synchronous collection access')
  if (currentDriver() === 'sqlite') writeSqliteDb(data)
  else writeJsonDb(data)
}

export function updateAuthorityDb(mutator) {
  const authority = authorityStorage.getStore()
  if (authority?.snapshot) { const result = mutator(authority.snapshot); authority.dirty = true; return result }
  if (currentDriver() === 'postgres') throw new Error('PostgreSQL request authority context is required for synchronous collection access')
  return currentDriver() === 'sqlite' ? updateSqliteDb(mutator) : updateJsonDb(mutator)
}

// Legacy names remain as adapter aliases for tests and one-time migration
// tooling. Application services use the authority-prefixed API above.
export const readDb = (...args) => readAuthorityDb(...args)
export const writeDb = (...args) => writeAuthorityDb(...args)
export const updateDb = (...args) => updateAuthorityDb(...args)

export function closeDbForTests() {
  if (sqliteDb) sqliteDb.close()
  sqliteDb = null
  sqliteDbPath = null
}
