import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { createTvceCheckout, isAfricanPayer, providerSupportsCurrency, selectCheckoutProvider } from '../services/tvceCheckoutService.js'

vi.mock('../config/database.js', () => ({ readAuthorityDb: vi.fn(), updateAuthorityDb: vi.fn() }))

// Paystack and Flutterwave serve African payers; Stripe serves everyone else
// when configured. A missing Stripe key must not block a payment Paystack or
// Flutterwave can take.
const ENV_KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_SECRET_HASH', 'PAYSTACK_CURRENCIES', 'DEFAULT_BILLING_PROVIDER', 'BILLING_SUCCESS_URL', 'BILLING_CANCEL_URL', 'CORS_ORIGINS']
let saved

describe('provider selection rules', () => {
  it('treats the payer country first, then the currency, as the region', () => {
    expect(isAfricanPayer({ countryCode: 'NG' })).toBe(true)
    expect(isAfricanPayer({ countryCode: 'KE', currency: 'USD' })).toBe(true)
    expect(isAfricanPayer({ countryCode: 'GB', currency: 'NGN' })).toBe(false)
    expect(isAfricanPayer({ currency: 'GHS' })).toBe(true)
    expect(isAfricanPayer({ currency: 'USD' })).toBe(false)
  })

  it('prefers Paystack then Flutterwave for African payers and Stripe for everyone else', () => {
    const all = ['stripe', 'paystack', 'flutterwave']
    expect(selectCheckoutProvider({ currency: 'NGN', available: all })).toBe('paystack')
    expect(selectCheckoutProvider({ currency: 'UGX', available: all })).toBe('flutterwave') // Paystack does not settle UGX
    expect(selectCheckoutProvider({ currency: 'USD', countryCode: 'US', available: all })).toBe('stripe')
  })

  it('falls back to Paystack/Flutterwave when Stripe is not configured', () => {
    expect(selectCheckoutProvider({ requested: 'stripe', currency: 'USD', available: ['paystack', 'flutterwave'] })).toBe('flutterwave')
    expect(selectCheckoutProvider({ requested: 'stripe', currency: 'EUR', available: ['paystack', 'flutterwave'] })).toBe('flutterwave')
    expect(selectCheckoutProvider({ requested: 'stripe', currency: 'USD', available: ['paystack'] })).toBe('paystack')
    expect(selectCheckoutProvider({ requested: 'stripe', currency: 'EUR', available: ['paystack'] })).toBeNull()
  })

  it('honours a configured requested provider that settles the currency', () => {
    expect(selectCheckoutProvider({ requested: 'flutterwave', currency: 'NGN', available: ['paystack', 'flutterwave'] })).toBe('flutterwave')
    expect(selectCheckoutProvider({ requested: 'stripe', currency: 'NGN', available: ['stripe', 'paystack'] })).toBe('stripe')
  })

  it('lets operators declare the currencies a merchant account settles', () => {
    process.env.PAYSTACK_CURRENCIES = 'NGN,EUR'
    try {
      expect(providerSupportsCurrency('paystack', 'EUR')).toBe(true)
      expect(providerSupportsCurrency('paystack', 'USD')).toBe(false)
    } finally {
      delete process.env.PAYSTACK_CURRENCIES
    }
  })
})

describe('checkout without Stripe', () => {
  let db
  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))
    for (const key of ENV_KEYS) delete process.env[key]
    db = {
      users: [{ id: 'u1' }], profiles: [{ id: 'u1' }], paymentIntents: [], subscriptions: [], accountEntitlements: [], creditLedger: [], billingWebhookEvents: [],
      creditPackages: [
        { id: 'pack_ng', amount: 199900, currency: 'NGN', credits: 400, active: true },
        { id: 'pack_usd', amount: 1900, currency: 'USD', credits: 400, active: true },
        { id: 'pack_eur', amount: 1900, currency: 'EUR', credits: 400, active: true },
      ],
      billingPlans: [],
    }
    readAuthorityDb.mockReturnValue(db)
    updateAuthorityDb.mockImplementation(fn => fn(db))
    process.env.BILLING_SUCCESS_URL = 'https://beta.techitnetwork.com/wallet?checkout=success'
    process.env.BILLING_CANCEL_URL = 'https://beta.techitnetwork.com/wallet?checkout=cancelled'
    process.env.CORS_ORIGINS = 'https://beta.techitnetwork.com'
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack'
    process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-x'
    process.env.FLUTTERWAVE_SECRET_HASH = 'flw-hash'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  })

  function providerFetch() {
    const fetchMock = vi.fn(async url => String(url).includes('paystack')
      ? { ok: true, json: async () => ({ status: true, data: { authorization_url: 'https://paystack.test/pay', reference: 'ref' } }) }
      : { ok: true, json: async () => ({ status: 'success', data: { link: 'https://flw.test/pay' } }) })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('routes a Stripe request for a Naira package to Paystack', async () => {
    const fetchMock = providerFetch()
    const result = await createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_ng', idemKey: 'ng-1' })
    expect(result).toMatchObject({ ok: true, provider: 'paystack', checkoutUrl: 'https://paystack.test/pay' })
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.paystack.co')
    expect(db.paymentIntents[0].provider).toBe('paystack')
  })

  it('routes a global (USD) payer to Flutterwave when Stripe is missing', async () => {
    const fetchMock = providerFetch()
    const result = await createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_usd', idemKey: 'usd-1' })
    expect(result).toMatchObject({ ok: true, provider: 'flutterwave' })
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.flutterwave.com')
  })

  it('picks the regional provider when the caller names none (payment gateway path)', async () => {
    providerFetch()
    const result = await createTvceCheckout('u1', { packageId: 'pack_ng', country_code: 'NG', idemKey: 'gw-1' })
    expect(result).toMatchObject({ ok: true, provider: 'paystack' })
  })

  it('keeps the same provider on an idempotent retry', async () => {
    providerFetch()
    const first = await createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_ng', idemKey: 'retry-1' })
    const again = await createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_ng', idemKey: 'retry-1' })
    expect(again).toMatchObject({ ok: true, provider: first.provider, idempotent: true })
  })

  it('reports a currency no configured provider settles instead of calling a provider', async () => {
    delete process.env.FLUTTERWAVE_SECRET_KEY
    const fetchMock = providerFetch()
    const result = await createTvceCheckout('u1', { provider: 'paystack', packageId: 'pack_eur', idemKey: 'eur-1' })
    expect(result).toMatchObject({ ok: false, status: 422, error: 'no_provider_for_currency', currency: 'EUR' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('creates no payment intent when no provider is configured at all', async () => {
    for (const key of ['PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY', 'FLUTTERWAVE_SECRET_HASH']) delete process.env[key]
    const result = await createTvceCheckout('u1', { provider: 'stripe', packageId: 'pack_ng', idemKey: 'none-1' })
    expect(result).toMatchObject({ ok: false, status: 503, error: 'stripe_not_configured' })
    expect(db.paymentIntents).toHaveLength(0)
  })

  it('never offers a provider whose webhook secret is missing', async () => {
    delete process.env.FLUTTERWAVE_SECRET_HASH
    delete process.env.PAYSTACK_SECRET_KEY
    const result = await createTvceCheckout('u1', { provider: 'flutterwave', packageId: 'pack_ng', idemKey: 'nohash-1' })
    expect(result).toMatchObject({ ok: false, status: 503, error: 'flutterwave_not_configured' })
  })
})
