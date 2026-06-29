import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

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
  mentorshipRooms: [],
  mentorshipMentees: [],
  mentorshipTasks: [],
  mentorshipApplications: [],
  mentorshipMessages: [],
  feedPosts: [],
  feedComments: [],
  feedLikes: [],
  haviThreads: [],
}

let sqliteDb = null
let sqliteDbPath = null
let DatabaseSync = null

function currentDriver() {
  const configured = process.env.DB_DRIVER?.trim().toLowerCase()
  if (configured) return configured
  return process.env.NODE_ENV === 'production' ? 'sqlite' : 'json'
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
  const normalized = normalizeDb(data)
  const stmt = db.prepare(`
    INSERT INTO app_collections (name, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `)

  db.exec('BEGIN IMMEDIATE')
  try {
    const now = new Date().toISOString()
    for (const key of Object.keys(INITIAL)) {
      stmt.run(key, JSON.stringify(normalized[key]), now)
    }
    db.exec('COMMIT')
  } catch (err) {
    try { db.exec('ROLLBACK') } catch {}
    throw err
  }
}

export function validateDatabaseConfig() {
  const driver = currentDriver()
  if (!['json', 'sqlite'].includes(driver)) {
    throw new Error(`Unsupported DB_DRIVER "${driver}". Use "sqlite" or "json".`)
  }
  if (process.env.NODE_ENV === 'production' && driver === 'json') {
    throw new Error('DB_DRIVER=json is not allowed in production. Use DB_DRIVER=sqlite.')
  }
  if (process.env.NODE_ENV === 'production' && driver === 'sqlite' && !process.env.SQLITE_DB_PATH) {
    throw new Error('SQLITE_DB_PATH is required in production and must point at a persistent volume.')
  }
  if (driver === 'sqlite') {
    migrateSqlite({ dbPath: sqlitePath(), dryRun: false })
  }
}

export function readDb() {
  return currentDriver() === 'sqlite' ? readSqliteDb() : readJsonDb()
}

export function writeDb(data) {
  if (currentDriver() === 'sqlite') writeSqliteDb(data)
  else writeJsonDb(data)
}

export function closeDbForTests() {
  if (sqliteDb) sqliteDb.close()
  sqliteDb = null
  sqliteDbPath = null
}
