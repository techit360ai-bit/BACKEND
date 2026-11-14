// PostgreSQL integration tests for verified payment fulfilment.
//
// Production runs DB_DRIVER=postgres, where any synchronous readAuthorityDb()
// outside a bounded request scope throws. The vitest suite otherwise runs on
// the JSON/SQLite driver and cannot see that class of failure, so these tests
// exercise the real SQL against a disposable database.
//
// Run with: PLATFORM_TEST_DATABASE_URL=postgres://user:pass@host:port/db npx vitest run paymentsPostgres
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

describe.skipIf(!url)('payment fulfilment on PostgreSQL (production driver)', () => {
  let platform
  let tvce
  let billing
  const saved = {}

  beforeAll(async () => {
    for (const [key, value] of Object.entries(ENV)) { saved[key] = process.env[key]; process.env[key] = value }
    platform = await import('../repositories/platformCollectionRepository.js')
    await platform.initializePlatformCollectionSchema()
    tvce = await import('../services/tvceService.js')
    billing = await import('../services/tvceBillingService.js')
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

  it('fulfils a verified webhook payment and parks an underpayment', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'pg-paystack-secret'
    const crypto = await import('node:crypto')
    await seed('paymentIntents', { id: 'pay_pg', userId: 'u5', amount: 199900, currency: 'NGN', credits: 400, status: 'pending', provider: 'paystack' })
    await seed('paymentIntents', { id: 'pay_pg_low', userId: 'u5', amount: 199900, currency: 'NGN', credits: 400, status: 'pending', provider: 'paystack' })
    const send = async payload => {
      const raw = JSON.stringify(payload)
      const digest = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex')
      return billing.handleBillingWebhook('paystack', payload, { 'x-paystack-signature': digest }, raw)
    }
    expect((await send({ event: 'charge.success', data: { id: 901, reference: 'pay_pg', amount: 199900, currency: 'NGN' } })).ok).toBe(true)
    const low = await send({ event: 'charge.success', data: { id: 902, reference: 'pay_pg_low', amount: 100, currency: 'NGN' } })
    expect(low).toMatchObject({ reconciliationRequired: true, reason: 'amount_underpaid' })
    const intents = await platform.getPlatformPool().query("SELECT record_id, payload->>'status' AS status, payload->>'reconciliationRequired' AS rec FROM platform_collection_records WHERE collection_name='paymentIntents' ORDER BY record_id")
    expect(intents.rows).toEqual([
      { record_id: 'pay_pg', status: 'successful', rec: 'false' },
      { record_id: 'pay_pg_low', status: 'pending', rec: 'true' },
    ])
    const entitlement = await tvce.accountEntitlementAsync('u5')
    expect(entitlement.active).toBe(true)
  })

  it('creates a Paystack checkout when Stripe is requested but not configured', async () => {
    const { vi } = await import('vitest')
    const { createTvceCheckout } = await import('../services/tvceCheckoutService.js')
    const saved = Object.fromEntries(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYSTACK_SECRET_KEY', 'BILLING_SUCCESS_URL', 'BILLING_CANCEL_URL'].map(key => [key, process.env[key]]))
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
    process.env.PAYSTACK_SECRET_KEY = 'pg-paystack-secret'
    process.env.BILLING_SUCCESS_URL = 'https://beta.techitnetwork.com/wallet?checkout=success'
    process.env.BILLING_CANCEL_URL = 'https://beta.techitnetwork.com/wallet?checkout=cancelled'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: true, data: { authorization_url: 'https://paystack.test/pay', reference: 'ref-pg' } }) })))
    try {
      await seed('creditPackages', { id: 'pack_pg_ng', amount: 199900, currency: 'NGN', credits: 400, active: true })
      const result = await createTvceCheckout('u6', { provider: 'stripe', packageId: 'pack_pg_ng', idemKey: 'pg-fallback-1' })
      expect(result).toMatchObject({ ok: true, provider: 'paystack', checkoutUrl: 'https://paystack.test/pay' })
      const row = await platform.getPlatformPool().query("SELECT payload->>'provider' AS provider FROM platform_collection_records WHERE collection_name='paymentIntents' AND record_id=$1", [result.paymentIntent.id])
      expect(row.rows[0].provider).toBe('paystack')
    } finally {
      vi.unstubAllGlobals()
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    }
  })
})
