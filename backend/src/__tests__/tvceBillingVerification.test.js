import crypto from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { handleBillingWebhook, verifyChargedAmount } from '../services/tvceBillingService.js'
import { checkoutRedirect, createTvceCheckout, stripePriceForPlan } from '../services/tvceCheckoutService.js'
import { majorToMinor, minorToMajorString } from '../utils/money.js'

vi.mock('../config/database.js', () => ({ readAuthorityDb: vi.fn(), updateAuthorityDb: vi.fn() }))

const ENV_KEYS = ['STRIPE_WEBHOOK_SECRET', 'PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_HASH', 'FLUTTERWAVE_SECRET_KEY', 'STRIPE_SECRET_KEY', 'BILLING_SUCCESS_URL', 'BILLING_CANCEL_URL', 'CORS_ORIGINS', 'FRONTEND_URL', 'STRIPE_PRICE_PRO_MONTHLY', 'STRIPE_PRICE_FOUNDER_PRO']
let saved

function stripeSigned(payloadObject) {
  const payload = JSON.stringify(payloadObject)
  const timestamp = Math.floor(Date.now() / 1000)
  const digest = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest('hex')
  return [JSON.parse(payload), { 'stripe-signature': `t=${timestamp},v1=${digest}` }, payload]
}

function paystackSigned(payloadObject) {
  const payload = JSON.stringify(payloadObject)
  const digest = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(payload).digest('hex')
  return [JSON.parse(payload), { 'x-paystack-signature': digest }, payload]
}

describe('money conversion', () => {
  it('converts between minor and major units exactly', () => {
    expect(minorToMajorString(199900, 'NGN')).toBe('1999.00')
    expect(minorToMajorString(5, 'USD')).toBe('0.05')
    expect(minorToMajorString(1000, 'XOF')).toBe('1000')
    expect(majorToMinor('19.99', 'USD')).toBe(1999)
    expect(majorToMinor(19.99, 'USD')).toBe(1999)
    expect(majorToMinor(1999, 'NGN')).toBe(199900)
    expect(majorToMinor('19.995', 'USD')).toBe(2000)
    expect(majorToMinor('abc', 'USD')).toBeNull()
  })
})

describe('hosted checkout hardening', () => {
  let db
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))
    db = { users: [{ id: 'u1' }], profiles: [{ id: 'u1' }], paymentIntents: [], creditPackages: [{ id: 'pack_ng', amount: 199900, currency: 'NGN', credits: 400, active: true }], billingPlans: [{ id: 'pro_monthly', amount: 2900, currency: 'USD', includedCredits: 1000, active: true }], subscriptions: [], accountEntitlements: [], creditLedger: [], billingWebhookEvents: [] }
    readAuthorityDb.mockReturnValue(db)
    updateAuthorityDb.mockImplementation(fn => fn(db))
    process.env.BILLING_SUCCESS_URL = 'https://beta.techitnetwork.com/wallet?checkout=success'
    process.env.BILLING_CANCEL_URL = 'https://beta.techitnetwork.com/wallet?checkout=cancelled'
    process.env.CORS_ORIGINS = 'https://beta.techitnetwork.com,https://admin.techitnetwork.com'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  })

  it('charges Flutterwave in major units (stored minor units were sent as-is: 100x overcharge)', async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-x'
    process.env.FLUTTERWAVE_SECRET_HASH = 'flw-hash' // a provider is offered only when fully configured
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success', data: { link: 'https://flw.test/pay' } }) })
    vi.stubGlobal('fetch', fetchMock)
    const result = await createTvceCheckout('u1', { provider: 'flutterwave', packageId: 'pack_ng', idemKey: 'flw-1' })
    expect(result.ok).toBe(true)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.amount).toBe(1999)
    expect(sent.currency).toBe('NGN')
    expect(sent.tx_ref).toBe(result.paymentIntent.id)
  })

  it('never lets the client choose the Stripe price of a subscription', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test' // a provider is offered only when fully configured
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_server_configured'
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' }) })
    vi.stubGlobal('fetch', fetchMock)
    const result = await createTvceCheckout('u1', { provider: 'stripe', planId: 'pro_monthly', priceId: 'price_attacker_cheap', idemKey: 'sub-1' })
    expect(result.ok).toBe(true)
    const params = new URLSearchParams(fetchMock.mock.calls[0][1].body.toString())
    expect(params.get('line_items[0][price]')).toBe('price_server_configured')
    // Subscription events must be traceable to the platform user and intent.
    expect(params.get('subscription_data[metadata][userId]')).toBe('u1')
    expect(params.get('subscription_data[metadata][paymentIntentId]')).toBe(result.paymentIntent.id)
  })

  it('refuses a subscription checkout without a configured Stripe price', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    delete process.env.STRIPE_PRICE_PRO_MONTHLY
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await createTvceCheckout('u1', { provider: 'stripe', planId: 'pro_monthly', priceId: 'price_attacker_cheap', idemKey: 'sub-2' })
    expect(result).toMatchObject({ ok: false, error: 'stripe_price_not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps plan ids with separators to env-safe Stripe price names', () => {
    process.env.STRIPE_PRICE_FOUNDER_PRO = 'price_founder'
    expect(stripePriceForPlan('founder-pro')).toBe('price_founder')
  })

  it('only redirects back to platform origins', () => {
    const fallback = process.env.BILLING_SUCCESS_URL
    expect(checkoutRedirect('https://evil.example/steal', fallback)).toBe(fallback)
    expect(checkoutRedirect('javascript:alert(1)', fallback)).toBe(fallback)
    expect(checkoutRedirect('https://beta.techitnetwork.com/wallet?from=upgrade', fallback)).toBe('https://beta.techitnetwork.com/wallet?from=upgrade')
  })

  it('attaches payment metadata so refunds and disputes can be traced', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    db.creditPackages.push({ id: 'pack_usd', amount: 1900, currency: 'USD', credits: 100, active: true })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'cs_2', url: 'https://checkout.stripe.test/cs_2' }) })
    vi.stubGlobal('fetch', fetchMock)
    const result = await createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_usd', idemKey: 'pay-1' })
    const params = new URLSearchParams(fetchMock.mock.calls[0][1].body.toString())
    expect(params.get('payment_intent_data[metadata][paymentIntentId]')).toBe(result.paymentIntent.id)
    expect(params.get('line_items[0][price_data][unit_amount]')).toBe('1900')
  })
})

describe('verified webhook fulfilment', () => {
  let db
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))
    db = {
      users: [{ id: 'u1' }, { id: 'u2' }], profiles: [{ id: 'u1' }, { id: 'u2' }],
      paymentIntents: [
        { id: 'pay_usd', userId: 'u1', credits: 100, amount: 1900, currency: 'USD', status: 'pending', provider: 'stripe' },
        { id: 'pay_ngn', userId: 'u1', credits: 400, amount: 199900, currency: 'NGN', status: 'pending', provider: 'paystack' },
        { id: 'pay_flw', userId: 'u1', credits: 400, amount: 199900, currency: 'NGN', status: 'pending', provider: 'flutterwave' },
      ],
      subscriptions: [], accountEntitlements: [], creditLedger: [], billingWebhookEvents: [], paymentRiskEvents: [],
    }
    readAuthorityDb.mockReturnValue(db)
    updateAuthorityDb.mockImplementation(fn => fn(db))
    process.env.STRIPE_WEBHOOK_SECRET = 'stripe-secret'
    process.env.PAYSTACK_SECRET_KEY = 'paystack-secret'
    process.env.FLUTTERWAVE_SECRET_HASH = 'flw-hash'
    process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-x'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  })

  it('rejects an underpaid Stripe checkout and parks it for reconciliation', async () => {
    const result = await handleBillingWebhook('stripe', ...stripeSigned({ id: 'evt_under', type: 'checkout.session.completed', data: { object: { id: 'cs_1', object: 'checkout.session', client_reference_id: 'pay_usd', payment_status: 'paid', amount_total: 100, currency: 'usd', metadata: { userId: 'u1', paymentIntentId: 'pay_usd' } } } }))
    expect(result).toMatchObject({ ok: true, reconciliationRequired: true, reason: 'amount_underpaid' })
    expect(db.paymentIntents[0].status).toBe('pending')
    expect(db.paymentIntents[0].reconciliationRequired).toBe(true)
    expect(db.creditLedger).toHaveLength(0)
  })

  it('rejects a currency mismatch', async () => {
    const result = await handleBillingWebhook('stripe', ...stripeSigned({ id: 'evt_cur', type: 'checkout.session.completed', data: { object: { id: 'cs_2', client_reference_id: 'pay_usd', payment_status: 'paid', amount_total: 1900, currency: 'eur', metadata: { userId: 'u1', paymentIntentId: 'pay_usd' } } } }))
    expect(result.reason).toBe('currency_mismatch')
    expect(db.creditLedger).toHaveLength(0)
  })

  it('does not grant an unpaid (delayed method) Checkout Session', async () => {
    const result = await handleBillingWebhook('stripe', ...stripeSigned({ id: 'evt_unpaid', type: 'checkout.session.completed', data: { object: { id: 'cs_3', client_reference_id: 'pay_usd', payment_status: 'unpaid', amount_total: 1900, currency: 'usd', metadata: { userId: 'u1', paymentIntentId: 'pay_usd' } } } }))
    expect(result.ignored).toBe(true)
    expect(db.paymentIntents[0].status).toBe('pending')
    const later = await handleBillingWebhook('stripe', ...stripeSigned({ id: 'evt_async_ok', type: 'checkout.session.async_payment_succeeded', data: { object: { id: 'cs_3', client_reference_id: 'pay_usd', payment_status: 'paid', amount_total: 1900, currency: 'usd', metadata: { userId: 'u1', paymentIntentId: 'pay_usd' } } } }))
    expect(later.ok).toBe(true)
    expect(db.paymentIntents[0].status).toBe('successful')
    expect(db.creditLedger.reduce((sum, row) => sum + row.deltaCredits, 0)).toBe(100)
  })

  it('fulfils a paid Stripe checkout using the intent owner and amount', async () => {
    const result = await handleBillingWebhook('stripe', ...stripeSigned({ id: 'evt_ok', type: 'checkout.session.completed', data: { object: { id: 'cs_4', client_reference_id: 'pay_usd', payment_intent: 'pi_123', payment_status: 'paid', amount_total: 1900, currency: 'usd', metadata: { userId: 'u1', paymentIntentId: 'pay_usd' } } } }))
    expect(result.ok).toBe(true)
    expect(db.paymentIntents[0]).toMatchObject({ status: 'successful', providerPaymentIntentId: 'pi_123', providerAmountMinor: 1900 })
  })

  it('refuses metadata that names a different user than the intent owner', async () => {
    const result = await handleBillingWebhook('paystack', ...paystackSigned({ event: 'charge.success', data: { id: 77, reference: 'pay_ngn', amount: 199900, currency: 'NGN', metadata: { userId: 'u2', paymentIntentId: 'pay_ngn' } } }))
    expect(result).toMatchObject({ reconciliationRequired: true, reason: 'payment_user_mismatch' })
    expect(db.creditLedger).toHaveLength(0)
  })

  it('resolves a Paystack charge by its reference when metadata is absent', async () => {
    const result = await handleBillingWebhook('paystack', ...paystackSigned({ event: 'charge.success', data: { id: 78, reference: 'pay_ngn', amount: 199900, currency: 'NGN' } }))
    expect(result.ok).toBe(true)
    expect(db.paymentIntents[1].status).toBe('successful')
    expect(db.creditLedger[0]).toMatchObject({ userId: 'u1', deltaCredits: 400 })
  })

  it('confirms Flutterwave charges with the provider before granting (webhooks carry no metadata)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'success', data: { id: 555, status: 'successful', amount: 1999, currency: 'NGN', tx_ref: 'pay_flw' } }) })
    vi.stubGlobal('fetch', fetchMock)
    const payload = { event: 'charge.completed', data: { id: 555, tx_ref: 'pay_flw', amount: 1999, currency: 'NGN', status: 'successful' } }
    const result = await handleBillingWebhook('flutterwave', payload, { 'verif-hash': 'flw-hash' }, JSON.stringify(payload))
    expect(result.ok).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.flutterwave.com/v3/transactions/555/verify')
    expect(db.paymentIntents[2].status).toBe('successful')
    expect(db.creditLedger[0]).toMatchObject({ userId: 'u1', deltaCredits: 400 })
  })

  it('does not trust a Flutterwave body the provider does not confirm', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'success', data: { id: 556, status: 'pending', amount: 1999, currency: 'NGN', tx_ref: 'pay_flw' } }) }))
    const payload = { event: 'charge.completed', data: { id: 556, tx_ref: 'pay_flw', amount: 1999, currency: 'NGN', status: 'successful' } }
    const result = await handleBillingWebhook('flutterwave', payload, { 'verif-hash': 'flw-hash' }, JSON.stringify(payload))
    expect(result).toMatchObject({ reconciliationRequired: true, reason: 'provider_not_successful' })
    expect(db.paymentIntents[2].status).toBe('pending')
  })

  it('defers (no record) when Flutterwave cannot be reached so the provider retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))
    const payload = { event: 'charge.completed', data: { id: 557, tx_ref: 'pay_flw', amount: 1999, currency: 'NGN', status: 'successful' } }
    const result = await handleBillingWebhook('flutterwave', payload, { 'verif-hash': 'flw-hash' }, JSON.stringify(payload))
    expect(result).toMatchObject({ ok: false, status: 503 })
    expect(db.billingWebhookEvents).toHaveLength(0)
  })

  it('cancels a subscription from a metadata-less Stripe event via the provider subscription id', async () => {
    db.subscriptions.push({ id: 'sub_row', userId: 'u1', planId: 'pro_monthly', provider: 'stripe', providerId: 'sub_123', status: 'active' })
    db.accountEntitlements.push({ id: 'ent', userId: 'u1', source: 'subscription', status: 'active' })
    const result = await handleBillingWebhook('stripe', ...stripeSigned({ id: 'evt_cancel', type: 'customer.subscription.deleted', data: { object: { id: 'sub_123', object: 'subscription', status: 'canceled', metadata: {} } } }))
    expect(result.ok).toBe(true)
    expect(db.subscriptions[0].status).toBe('cancelled')
    expect(db.accountEntitlements[0].status).toBe('inactive')
  })

  it('reverses purchased credits on a refund traced through the provider PaymentIntent', async () => {
    await handleBillingWebhook('stripe', ...stripeSigned({ id: 'evt_paid', type: 'checkout.session.completed', data: { object: { id: 'cs_5', client_reference_id: 'pay_usd', payment_intent: 'pi_refund', payment_status: 'paid', amount_total: 1900, currency: 'usd', metadata: { userId: 'u1', paymentIntentId: 'pay_usd' } } } }))
    const result = await handleBillingWebhook('stripe', ...stripeSigned({ id: 'evt_refund', type: 'charge.refunded', data: { object: { id: 'ch_1', object: 'charge', payment_intent: 'pi_refund', amount: 1900, currency: 'usd', metadata: {} } } }))
    expect(result.ok).toBe(true)
    expect(db.creditLedger.reduce((sum, row) => sum + row.deltaCredits, 0)).toBe(0)
    expect(db.paymentIntents[0].status).toBe('refunded')
  })

  it('verifyChargedAmount accepts overpayment but not underpayment', () => {
    const intent = { amount: 1900, currency: 'USD' }
    expect(verifyChargedAmount(intent, 'stripe', { amount: 1950, currency: 'usd' }).ok).toBe(true)
    expect(verifyChargedAmount(intent, 'stripe', { amount: 1899, currency: 'usd' }).reason).toBe('amount_underpaid')
    expect(verifyChargedAmount({ amount: 199900, currency: 'NGN' }, 'flutterwave', { amount: '1999.00', currency: 'NGN' }).ok).toBe(true)
  })
})
