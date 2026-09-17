import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { closeDbForTests, updateDb } from '../config/database.js'
import { markMigrationEvent, outboxStats, pendingMigrationEvents, recordMigrationEvent } from '../services/migrationOutboxService.js'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, DB_DRIVER: 'sqlite', SQLITE_DB_PATH: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'techit-outbox-')), 'techit.sqlite') }
  closeDbForTests()
})

afterEach(() => {
  closeDbForTests()
  process.env = { ...ORIGINAL_ENV }
})

describe('migration outbox', () => {
  it('records and processes an idempotent domain event in the existing transaction store', () => {
    let event
    updateDb(db => { event = recordMigrationEvent(db, { domain: 'identity', aggregateType: 'user', aggregateId: 'u1', operation: 'upsert', payload: { userId: 'u1' } }) })
    expect(pendingMigrationEvents()).toHaveLength(1)
    expect(outboxStats().pending).toBe(1)
    expect(markMigrationEvent(event.id)).toBe(true)
    expect(pendingMigrationEvents()).toHaveLength(0)
    expect(outboxStats().processed).toBe(1)
  })
})
