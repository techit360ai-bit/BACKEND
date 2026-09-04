import crypto from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readDb, updateDb } from '../config/database.js'
import { handleBillingWebhook } from '../services/tvceBillingService.js'
import { createTvceCheckout } from '../services/tvceCheckoutService.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn() }))

describe('TVCE billing webhook contracts', () => {
  let db
  beforeEach(() => {
    db = { users: [{ id: 'u1' }], profiles: [{ id: 'u1', role: 'founder' }], paymentIntents: [{ id: 'p1', userId: 'u1', credits: 20, status: 'pending', provider: 'stripe' }], subscriptions: [], accountEntitlements: [], creditLedger: [], billingWebhookEvents: [], creditPackages: [], billingPlans: [] }
    readDb.mockReturnValue(db)
    updateDb.mockImplementation(fn => fn(db))
    process.env.STRIPE_WEBHOOK_SECRET = 'stripe-secret'
    process.env.PAYSTACK_SECRET_KEY = 'paystack-secret'
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
})
