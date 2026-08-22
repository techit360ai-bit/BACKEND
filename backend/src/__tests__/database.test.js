import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  closeDbForTests,
  migrateSqlite,
  readDb,
  rollbackLatestSqliteMigration,
  updateDb,
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
    expect(rolledBack.version).toBe('010_organization_intelligence_operations')
    expect(afterDryRuns.notifications).toHaveLength(1)
    expect(afterDryRuns.notifications[0].id).toBe('notif-dry-run')
    expect(afterDryRuns.hackathonInvitations).toEqual([])
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

  it('applies updateDb mutations atomically and returns the mutator result', () => {
    const result = updateDb(db => {
      db.notifications.push({
        id: 'notif-atomic',
        userId: 'user-1',
        type: 'milestone',
        read: false,
        content: 'Atomic',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
      return { id: 'notif-atomic' }
    })

    expect(result).toEqual({ id: 'notif-atomic' })
    expect(readDb().notifications.map(n => n.id)).toContain('notif-atomic')
  })

  it('rolls back updateDb mutations when the mutator throws', () => {
    expect(() => updateDb(db => {
      db.notifications.push({
        id: 'notif-rolled-back',
        userId: 'user-1',
        type: 'milestone',
        read: false,
        content: 'Rolled back',
        createdAt: '2026-01-01T00:00:00.000Z',
      })
      throw new Error('abort mutation')
    })).toThrow(/abort mutation/)

    expect(readDb().notifications.map(n => n.id)).not.toContain('notif-rolled-back')
  })

  it('rejects async updateDb mutators to avoid holding transactions across awaits', () => {
    expect(() => updateDb(async () => ({ ok: true }))).toThrow(/must be synchronous/i)
  })

  it('preserves overlapping updateDb writes against the same collection', async () => {
    await Promise.all(Array.from({ length: 5 }, (_, index) => new Promise(resolve => {
      setImmediate(() => {
        updateDb(db => {
          db.notifications.push({
            id: `notif-update-${index}`,
            userId: 'user-1',
            type: 'milestone',
            read: false,
            content: `Event ${index}`,
            createdAt: '2026-01-01T00:00:00.000Z',
          })
        })
        resolve()
      })
    })))

    const db = readDb()
    expect(db.notifications.map(n => n.id).sort()).toEqual([
      'notif-update-0',
      'notif-update-1',
      'notif-update-2',
      'notif-update-3',
      'notif-update-4',
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
