import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  closeDbForTests,
  migrateSqlite,
  readDb,
  rollbackLatestSqliteMigration,
  validateDatabaseConfig,
  writeDb,
} from '../config/database.js'

const ORIGINAL_ENV = { ...process.env }

function makeTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'techit-sqlite-'))
  return path.join(dir, 'techit.sqlite')
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  process.env.DB_DRIVER = 'sqlite'
  process.env.SQLITE_DB_PATH = makeTempDbPath()
  closeDbForTests()
})

afterEach(() => {
  closeDbForTests()
  process.env = { ...ORIGINAL_ENV }
})

describe('database persistence adapter', () => {
  it('persists auth, profile, notification, and file metadata through SQLite restarts', () => {
    const db = readDb()
    db.users.push({
      id: 'user-1',
      email: 'alice@example.com',
      passwordHash: 'hash',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    db.profiles.push({
      id: 'user-1',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'founder',
      isOnboarded: false,
    })
    db.notifications.push({
      id: 'notif-1',
      userId: 'user-1',
      type: 'milestone',
      read: false,
      content: 'Welcome',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    db.files.push({
      id: 'file-1',
      ownerId: 'user-1',
      workspaceId: 'default',
      name: 'pitch.md',
      type: 'file',
      sizeBytes: 42,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    writeDb(db)
    closeDbForTests()

    const persisted = readDb()
    expect(persisted.users).toHaveLength(1)
    expect(persisted.profiles[0].email).toBe('alice@example.com')
    expect(persisted.notifications[0].content).toBe('Welcome')
    expect(persisted.files[0].name).toBe('pitch.md')
  })

  it('supports migration apply, apply dry-run, and rollback dry-run against a disposable SQLite database', () => {
    migrateSqlite({ dbPath: process.env.SQLITE_DB_PATH, dryRun: false })

    const db = readDb()
    db.notifications.push({
      id: 'notif-dry-run',
      userId: 'user-1',
      type: 'milestone',
      read: false,
      content: 'Persistent',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    writeDb(db)

    migrateSqlite({ dbPath: process.env.SQLITE_DB_PATH, dryRun: true })
    const rolledBack = rollbackLatestSqliteMigration({
      dbPath: process.env.SQLITE_DB_PATH,
      dryRun: true,
    })

    closeDbForTests()
    const afterDryRuns = readDb()
    expect(rolledBack.version).toBe('001_app_collections')
    expect(afterDryRuns.notifications).toHaveLength(1)
    expect(afterDryRuns.notifications[0].id).toBe('notif-dry-run')
  })

  it('preserves sequential writes under event-loop concurrency', async () => {
    await Promise.all(Array.from({ length: 5 }, (_, index) => new Promise(resolve => {
      setImmediate(() => {
        const db = readDb()
        db.notifications.push({
          id: `notif-${index}`,
          userId: 'user-1',
          type: 'milestone',
          read: false,
          content: `Event ${index}`,
          createdAt: '2026-01-01T00:00:00.000Z',
        })
        writeDb(db)
        resolve()
      })
    })))

    const db = readDb()
    expect(db.notifications.map(n => n.id).sort()).toEqual([
      'notif-0',
      'notif-1',
      'notif-2',
      'notif-3',
      'notif-4',
    ])
  })

  it('rejects JSON storage in production', () => {
    process.env.NODE_ENV = 'production'
    process.env.DB_DRIVER = 'json'
    expect(() => validateDatabaseConfig()).toThrow(/not allowed in production/i)
  })

  it('requires an explicit production SQLite path', () => {
    process.env.NODE_ENV = 'production'
    process.env.DB_DRIVER = 'sqlite'
    delete process.env.SQLITE_DB_PATH
    expect(() => validateDatabaseConfig()).toThrow(/SQLITE_DB_PATH is required/i)
  })
})
