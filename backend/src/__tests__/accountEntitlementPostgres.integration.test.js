// PostgreSQL integration test for the per-request account entitlement read.
//
// Production runs DB_DRIVER=postgres, where any synchronous readAuthorityDb()
// outside a bounded request scope throws. The vitest suite otherwise runs on
// the JSON/SQLite driver and cannot see that class of failure, so these tests
// exercise the real SQL against a disposable database.
//
// Run with: PLATFORM_TEST_DATABASE_URL=postgres://user:pass@host:port/db npx vitest run accountEntitlementPostgres
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const url = process.env.PLATFORM_TEST_DATABASE_URL
const ENV = {
  NODE_ENV: 'test',
  DB_DRIVER: 'postgres',
  PLATFORM_DATABASE_URL: url,
  DATABASE_URL: url,
  FINANCE_WRITE_SOURCE: 'postgres',
  FINANCE_READ_SOURCE: 'postgres',
  FINANCE_WRITE_FALLBACK_SQLITE: 'false',
  FINANCE_READ_FALLBACK_SQLITE: 'false',
  BILLING_JOBS_SOURCE: 'postgres',
  // Mirror ops/ec2/platform.env so the test exercises the production wiring.
  ORGANIZATION_READ_SOURCE: 'postgres',
  ORGANIZATION_WRITE_SOURCE: 'postgres',
}

describe.skipIf(!url)('account entitlement on PostgreSQL (production driver)', () => {
  let platform
  let tvce
  const saved = {}

  beforeAll(async () => {
    for (const [key, value] of Object.entries(ENV)) { saved[key] = process.env[key]; process.env[key] = value }
    platform = await import('../repositories/platformCollectionRepository.js')
    await platform.initializePlatformCollectionSchema()
    tvce = await import('../services/tvceService.js')
  })

  beforeEach(async () => {
    await platform.getPlatformPool().query('TRUNCATE platform_collection_records, platform_collection_events')
  })

  afterAll(async () => {
    await platform?.closePlatformPool?.()
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  })

  async function seed(collection, record) {
    await platform.withPlatformTransaction(client => platform.upsertRecord(client, collection, { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...record }, { operation: 'insert' }))
  }

  it('derives the per-request account entitlement from targeted queries', async () => {
    expect(await tvce.accountEntitlementAsync('nobody')).toMatchObject({ active: false, status: 'none' })
    await seed('creditLedger', { id: 'cl-1', userId: 'buyer', deltaCredits: 100, credits: 100, type: 'credit_purchase', paymentIntentId: 'p' })
    expect(await tvce.accountEntitlementAsync('buyer')).toMatchObject({ active: true, source: 'credits' })
    await seed('subscriptions', { id: 'sub-1', userId: 'subscriber', planId: 'pro', status: 'active' })
    expect(await tvce.accountEntitlementAsync('subscriber')).toMatchObject({ active: true, source: 'subscription' })
    await seed('subscriptions', { id: 'sub-2', userId: 'lapsed', planId: 'pro', status: 'cancelled' })
    expect((await tvce.accountEntitlementAsync('lapsed')).active).toBe(false)
  })

  it('reads the entitlement with two queries instead of the 26-query finance snapshot', async () => {
    // requireAuth attaches this to every authenticated request.
    const { default: pg } = await import('pg')
    const original = pg.Client.prototype.query
    let statements = 0
    pg.Client.prototype.query = function (...args) { statements += 1; return original.apply(this, args) }
    try {
      await tvce.accountEntitlementAsync('nobody')
    } finally {
      pg.Client.prototype.query = original
    }
    expect(statements).toBeLessThanOrEqual(2)
  })
})
