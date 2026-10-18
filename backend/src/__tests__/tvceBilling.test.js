import crypto from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { handleBillingWebhook } from '../services/tvceBillingService.js'
import { createTvceCheckout } from '../services/tvceCheckoutService.js'
import { createPaymentIntent } from '../services/domainService.js'

vi.mock('../config/database.js', () => ({ readAuthorityDb: vi.fn(), updateAuthorityDb: vi.fn() }))

describe('TVCE billing webhook contracts', () => {
  let db
  beforeEach(() => {
    db = { users: [{ id: 'u1' }], profiles: [{ id: 'u1', role: 'founder' }], paymentIntents: [{ id: 'p1', userId: 'u1', credits: 20, status: 'pending', provider: 'stripe' }], subscriptions: [], accountEntitlements: [], creditLedger: [], billingWebhookEvents: [], creditPackages: [], billingPlans: [] }
    readAuthorityDb.mockReturnValue(db)
    updateAuthorityDb.mockImplementation(fn => fn(db))
    process.env.STRIPE_WEBHOOK_SECRET = 'stripe-secret'
    process.env.PAYSTACK_SECRET_KEY = 'paystack-secret'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('verifies Stripe signatures and fulfills a payment once', async () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1', metadata: { userId: 'u1', paymentIntentId: 'p1' } } } })
    const timestamp = Math.floor(Date.now() / 1000)
    const digest = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex')
    const first = await handleBillingWebhook('stripe', JSON.parse(payload), { 'stripe-signature': `t=${timestamp},v1=${digest}` }, payload)
    expect(first.ok).toBe(true)
    expect(db.paymentIntents[0].status).toBe('successful')
    expect(db.accountEntitlements[0].status).toBe('active')
    const repeat = await handleBillingWebhook('stripe', JSON.parse(payload), { 'stripe-signature': `t=${timestamp},v1=${digest}` }, payload)
    expect(repeat.idempotent).toBe(true)
  })

  it('rejects invalid Paystack signatures', async () => {
    const payload = JSON.stringify({ id: 'evt_2', event: 'charge.success', data: { id: 2, reference: 'ref_2', metadata: { userId: 'u1', paymentIntentId: 'p1' } } })
    const result = await handleBillingWebhook('paystack', JSON.parse(payload), { 'x-paystack-signature': 'invalid' }, payload)
    expect(result.error).toBe('invalid_webhook_signature')
  })

  it('applies the same risk policy in the synchronous fallback store', () => {
    db.creditPackages = [{ id: 'pack_1', amount: 1900, currency: 'USD', credits: 100, active: true }]
    db.riskProfiles = [{ id: 'risk_1', userId: 'u1', state: 'HIGH' }]
    const result = createPaymentIntent('u1', { packageId: 'pack_1', idemKey: 'sync-risk' })
    expect(result).toMatchObject({ ok: false, status: 403, error: 'purchase_risk_review_required' })
    expect(db.paymentIntents.filter(row => row.idemKey === 'sync-risk')).toHaveLength(0)
    expect(db.paymentRiskEvents.at(-1)).toMatchObject({ decision: 'rejected', riskState: 'HIGH' })
  })

  it('fails closed when hosted checkout credentials or redirects are absent', async () => {
    const previous = { provider: process.env.DEFAULT_BILLING_PROVIDER, success: process.env.BILLING_SUCCESS_URL, cancel: process.env.BILLING_CANCEL_URL, key: process.env.STRIPE_SECRET_KEY }
    delete process.env.DEFAULT_BILLING_PROVIDER; delete process.env.BILLING_SUCCESS_URL; delete process.env.BILLING_CANCEL_URL; delete process.env.STRIPE_SECRET_KEY
    try {
      const result = await createTvceCheckout('u1', { provider: 'stripe', amount: 100, currency: 'USD', credits: 5 })
      expect(result.ok).toBe(false)
      expect(['checkout_redirects_not_configured', 'stripe_not_configured']).toContain(result.error)
    } finally {
      if (previous.provider === undefined) delete process.env.DEFAULT_BILLING_PROVIDER; else process.env.DEFAULT_BILLING_PROVIDER = previous.provider
      if (previous.success === undefined) delete process.env.BILLING_SUCCESS_URL; else process.env.BILLING_SUCCESS_URL = previous.success
      if (previous.cancel === undefined) delete process.env.BILLING_CANCEL_URL; else process.env.BILLING_CANCEL_URL = previous.cancel
      if (previous.key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previous.key
    }
  })

  it('persists provider checkout state and reuses the same idempotent intent', async () => {
    db.creditPackages = [{ id: 'pack_1', amount: 1900, currency: 'USD', credits: 100, active: true }]
    process.env.BILLING_SUCCESS_URL = 'https://beta.techitnetwork.com/wallet?checkout=success'
    process.env.BILLING_CANCEL_URL = 'https://beta.techitnetwork.com/wallet?checkout=cancelled'
    process.env.STRIPE_SECRET_KEY = 'sk_test_checkout'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.test/cs_test_1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = await createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_1', idemKey: 'checkout-attempt-1' })
    expect(first.ok).toBe(true)
    expect(first.paymentIntent).toMatchObject({
      packageId: 'pack_1',
      status: 'pending',
      checkoutStatus: 'created',
      provider: 'stripe',
      providerSessionId: 'cs_test_1',
      checkoutUrl: 'https://checkout.stripe.test/cs_test_1',
    })
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers['Idempotency-Key']).toBe(`checkout:${first.paymentIntent.id}`)

    const second = await createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_1', idemKey: 'checkout-attempt-1' })
    expect(second).toMatchObject({ ok: true, idempotent: true, checkoutUrl: first.checkoutUrl })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(db.paymentIntents.filter(row => row.packageId === 'pack_1')).toHaveLength(1)
  })

  it('returns checkout_in_progress while the same intent is creating a provider session', async () => {
    db.paymentIntents = []
    db.creditPackages = [{ id: 'pack_race', amount: 1900, currency: 'USD', credits: 100, active: true }]
    process.env.BILLING_SUCCESS_URL = 'https://beta.techitnetwork.com/wallet?checkout=success'
    process.env.BILLING_CANCEL_URL = 'https://beta.techitnetwork.com/wallet?checkout=cancelled'
    process.env.STRIPE_SECRET_KEY = 'sk_test_checkout'
    let resolveFetch
    const fetchMock = vi.fn().mockImplementation(() => new Promise(resolve => { resolveFetch = resolve }))
    vi.stubGlobal('fetch', fetchMock)

    const first = createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_race', idemKey: 'checkout-race' })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const second = await createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_race', idemKey: 'checkout-race' })
    expect(second).toMatchObject({ ok: false, status: 409, error: 'checkout_in_progress' })

    resolveFetch({ ok: true, json: async () => ({ id: 'cs_race', url: 'https://checkout.stripe.test/cs_race' }) })
    expect(await first).toMatchObject({ ok: true, checkoutUrl: 'https://checkout.stripe.test/cs_race' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('credits a signed late capture but marks it for reconciliation', async () => {
    Object.assign(db.paymentIntents[0], {
      status: 'expired',
      expiresAt: '2026-10-18T11:00:00.000Z',
      amount: 1_000,
      currency: 'USD',
      lateFulfillment: false,
    })
    const payload = JSON.stringify({ id: 'evt_late', type: 'payment_intent.succeeded', data: { object: { id: 'pi_late', metadata: { userId: 'u1', paymentIntentId: 'p1' } } } })
    const timestamp = Math.floor(Date.now() / 1000)
    const digest = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex')
    const result = await handleBillingWebhook('stripe', JSON.parse(payload), { 'stripe-signature': `t=${timestamp},v1=${digest}` }, payload)
    expect(result.ok).toBe(true)
    expect(db.paymentIntents[0]).toMatchObject({
      status: 'successful',
      lateFulfillment: true,
      reconciliationRequired: true,
      reconciliationReason: 'provider_capture_after_intent_expiry',
    })
    expect(db.creditLedger).toHaveLength(1)
    expect(db.paymentRiskEvents.at(-1)).toMatchObject({ operation: 'payment_intent_late_capture', decision: 'allowed' })
  })
})
