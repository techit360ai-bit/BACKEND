import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getPlatformPool,
  closePlatformPool,
  hasPlatformDatabaseUrl,
  platformPoolStats,
} from '../repositories/platformCollectionRepository.js'

const ENV_KEYS = ['PLATFORM_DATABASE_URL', 'DATABASE_URL', 'IDENTITY_DATABASE_URL', 'PLATFORM_DB_POOL_SIZE', 'PLATFORM_DB_APP_NAME']
const saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))

beforeEach(async () => {
  await closePlatformPool()
  for (const key of ENV_KEYS) delete process.env[key]
})

afterEach(async () => {
  await closePlatformPool()
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('shared platform pool', () => {
  it('is a single process-wide pg.Pool (one connection budget, not one per domain)', async () => {
    process.env.PLATFORM_DATABASE_URL = 'postgres://techit:secret@db.example.com:5432/techit_db'
    const first = getPlatformPool()
    const second = getPlatformPool()
    expect(second).toBe(first)
    await closePlatformPool()
    const recreated = getPlatformPool()
    expect(recreated).not.toBe(first)
  })

  it('tags every connection with application_name for pg_stat_activity attribution', async () => {
    process.env.PLATFORM_DATABASE_URL = 'postgres://techit:secret@db.example.com:5432/techit_db'
    process.env.PLATFORM_DB_APP_NAME = 'techit-backend'
    const pool = getPlatformPool()
    expect(pool.options.application_name).toBe('techit-backend')
  })

  it('honours the single PLATFORM_DB_POOL_SIZE knob', async () => {
    process.env.PLATFORM_DATABASE_URL = 'postgres://techit:secret@db.example.com:5432/techit_db'
    process.env.PLATFORM_DB_POOL_SIZE = '20'
    expect(getPlatformPool().options.max).toBe(20)
  })

  it('reports hasPlatformDatabaseUrl from any canonical alias, and no stats before use', async () => {
    expect(hasPlatformDatabaseUrl()).toBe(false)
    expect(platformPoolStats()).toBeNull()
    process.env.IDENTITY_DATABASE_URL = 'postgres://techit:secret@db.example.com:5432/techit_db'
    expect(hasPlatformDatabaseUrl()).toBe(true)
    expect(platformPoolStats()).toBeNull()
    getPlatformPool()
    expect(platformPoolStats()).toMatchObject({ totalCount: 0, idleCount: 0, waitingCount: 0, max: 10 })
  })

  it('closePlatformPool is idempotent and safe under concurrent close (migration CLIs)', async () => {
    process.env.PLATFORM_DATABASE_URL = 'postgres://techit:secret@db.example.com:5432/techit_db'
    getPlatformPool()
    await expect(Promise.all([closePlatformPool(), closePlatformPool(), closePlatformPool()])).resolves.toBeDefined()
    expect(platformPoolStats()).toBeNull()
    await expect(closePlatformPool()).resolves.toBeUndefined()
  })
})

describe('single-pool architectural guard', () => {
  it('constructs pg.Pool in exactly one module (no per-domain pools can regress)', () => {
    const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const offenders = []
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) { walk(full); continue }
        if (!entry.name.endsWith('.js')) continue
        const text = fs.readFileSync(full, 'utf8')
        if (/new\s+pg\.Pool\(|new\s+Pool\(/.test(text)) offenders.push(path.relative(srcRoot, full))
      }
    }
    walk(srcRoot)
    expect(offenders).toEqual(['repositories/platformCollectionRepository.js'])
  })
})
