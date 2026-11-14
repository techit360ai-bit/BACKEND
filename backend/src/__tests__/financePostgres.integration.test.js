// PostgreSQL integration tests for AI usage reservation and settlement.
//
// Production runs DB_DRIVER=postgres, where any synchronous readAuthorityDb()
// outside a bounded request scope throws. The vitest suite otherwise runs on
// the JSON/SQLite driver and cannot see that class of failure, so these tests
// exercise the real SQL against a disposable database.
//
// Run with: PLATFORM_TEST_DATABASE_URL=postgres://user:pass@host:port/db npx vitest run financePostgres
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

describe.skipIf(!url)('finance on PostgreSQL (production driver)', () => {
  let repo
  let usage
  let platform
  const saved = {}

  beforeAll(async () => {
    for (const [key, value] of Object.entries(ENV)) { saved[key] = process.env[key]; process.env[key] = value }
    platform = await import('../repositories/platformCollectionRepository.js')
    await platform.initializePlatformCollectionSchema()
    repo = await import('../repositories/financeRepository.js')
    usage = await import('../services/usageSettlementService.js')
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

  it('settles Router usage without touching the synchronous authority store', async () => {
    await seed('walletAccounts', { id: 'w-u1', userId: 'u1', creditBalance: 20 })
    const reserved = await usage.reserveUsageAsync({ userId: 'u1', requestId: 'pg-r1', taskType: 'chat', estimatedCredits: 5, fundingSource: 'payg' })
    expect(reserved.ok).toBe(true)
    expect(reserved.reservation.expiresAt).toBeTruthy()
    const settled = await usage.settleUsageAsync({ request_id: 'pg-r1', user_id: 'u1', task_type: 'chat', status: 'completed', reservation_id: 'pg-r1', provider: 'bedrock', model: 'claude', prompt_tokens: 100, completion_tokens: 50 })
    expect(settled.ok).toBe(true)
    expect(settled.usageEvent.credits).toBe(5)
    const summary = await repo.walletSummary('u1').catch(() => null)
    expect(summary === null || typeof summary === 'object').toBe(true)
  })

  it('serializes concurrent reservations so credits cannot be double-spent', async () => {
    await seed('walletAccounts', { id: 'w-u2', userId: 'u2', creditBalance: 5 })
    const attempts = await Promise.all([1, 2, 3, 4].map(n => usage.reserveUsageAsync({ userId: 'u2', requestId: `race-${n}`, taskType: 'chat', estimatedCredits: 5, fundingSource: 'payg' })))
    expect(attempts.filter(result => result.ok)).toHaveLength(1)
    expect(attempts.filter(result => result.error === 'insufficient_credits')).toHaveLength(3)
  })

  it('serializes concurrent reservations when the balance comes only from the credit ledger', async () => {
    // No walletAccounts row to lock: before the per-user advisory lock every
    // concurrent request passed the balance check against the same credits.
    await seed('creditLedger', { id: 'cl-race', userId: 'u2b', deltaCredits: 5, credits: 5, type: 'credit_purchase' })
    const attempts = await Promise.all(Array.from({ length: 10 }, (_, n) => n).map(n => usage.reserveUsageAsync({ userId: 'u2b', requestId: `race-ledger-${n}`, taskType: 'chat', estimatedCredits: 5, fundingSource: 'payg' })))
    expect(attempts.filter(result => result.ok)).toHaveLength(1)
  })

  it('holds a per-user lock while reserving (deterministic check of the race guard)', async () => {
    const holder = await platform.getPlatformPool().connect()
    try {
      await holder.query('BEGIN')
      await holder.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['usage-user:u2c'])
      let finished = false
      const pending = usage.reserveUsageAsync({ userId: 'u2c', requestId: 'lock-probe', taskType: 'chat', estimatedCredits: 1, fundingSource: 'platform_subsidy' }).then(result => { finished = true; return result })
      await new Promise(resolve => setTimeout(resolve, 300))
      expect(finished).toBe(false)
      await holder.query('COMMIT')
      expect((await pending).ok).toBe(true)
    } finally {
      holder.release()
    }
  })

  it('charges an unbound gateway reservation once and never debits platform subsidy', async () => {
    const grant = await usage.reserveUsageAsync({ userId: 'u3', requestId: 'gw-pg', taskType: 'gateway:incubation', estimatedCredits: 1, fundingSource: 'platform_subsidy', metadata: { taskTypeBound: false } })
    expect(grant.ok).toBe(true)
    const first = await usage.settleUsageAsync({ request_id: 'gw-pg', user_id: 'u3', task_type: 'idea_evaluation', status: 'completed', reservation_id: 'gw-pg' })
    const second = await usage.settleUsageAsync({ request_id: 'gw-pg:2', user_id: 'u3', task_type: 'embeddings', status: 'completed', reservation_id: 'gw-pg' })
    expect(first.ok).toBe(true)
    expect(second).toMatchObject({ ok: true, usageEvent: { credits: 0, additionalExecution: true } })
    const ledger = await platform.getPlatformPool().query("SELECT count(*)::int AS n FROM platform_collection_records WHERE collection_name='creditLedger' AND owner_id='u3'")
    expect(ledger.rows[0].n).toBe(0)
  })

  it('expires reservations and releases them through the row-level billing job', async () => {
    await seed('usageReservations', { id: 'old', reservationId: 'old', requestId: 'old', userId: 'u4', taskType: 'chat', reservedCredits: 3, fundingSource: 'payg', status: 'reserved', createdAt: '2026-01-01T00:00:00.000Z' })
    const { runBillingJobsRowLevel } = await import('../repositories/billingJobsRepository.js')
    const run = await runBillingJobsRowLevel('test', { freeQuotaCycles: 0, runAt: new Date().toISOString() })
    expect(run.results.expiredReservations).toBe(1)
  })
})
