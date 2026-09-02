import crypto from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readDb, updateDb } from '../config/database.js'
import { handleBillingWebhook } from '../services/tvceBillingService.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn() }))

describe('TVCE billing webhook contracts', () => {
  let db
  beforeEach(() => {
    db = { users: [{ id: 'u1' }], profiles: [{ id: 'u1', role: 'founder' }], paymentIntents: [{ id: 'p1', userId: 'u1', credits: 20, status: 'pending', provider: 'stripe' }], subscriptions: [], accountEntitlements: [], creditLedger: [], billingWebhookEvents: [] }
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
})
