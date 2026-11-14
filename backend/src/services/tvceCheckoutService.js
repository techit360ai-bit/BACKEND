import { updateAuthorityDb } from '../config/database.js'
import { createPaymentIntentAsync } from './domainService.js'
import { beginPaymentIntentCheckoutPostgres, financePostgresEnabled, markPaymentIntentCheckoutFailurePostgres, markPaymentIntentCheckoutPostgres } from '../repositories/financeRepository.js'
import { minorToMajorString } from '../utils/money.js'
import { enabledCheckoutProviders } from './billingProviderConfig.js'

const providerSet = new Set(['stripe', 'paystack', 'flutterwave'])
const text = value => typeof value === 'string' ? value.trim() : ''

// Provider routing: Paystack and Flutterwave serve African payers, Stripe
// serves everyone else when it is configured. A provider that is not fully
// configured (API secret plus webhook secret/hash) never receives a checkout,
// because its payments could not be verified and fulfilled.
const AFRICAN_COUNTRIES = new Set(['DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW'])
const AFRICAN_CURRENCIES = new Set(['NGN', 'GHS', 'KES', 'ZAR', 'EGP', 'UGX', 'TZS', 'RWF', 'XOF', 'XAF', 'ZMW', 'MWK', 'MAD', 'ETB', 'DZD', 'TND', 'BWP', 'NAD', 'MZN', 'AOA', 'SLE', 'GMD', 'LRD', 'CDF', 'BIF', 'DJF', 'SOS', 'SDG', 'SSP', 'LYD', 'MGA', 'MUR', 'SCR', 'SZL', 'LSL', 'CVE', 'STN', 'KMF', 'GNF', 'MRU', 'ERN'])
const AFRICA_ORDER = ['paystack', 'flutterwave', 'stripe']
const GLOBAL_ORDER = ['stripe', 'flutterwave', 'paystack']
// Currencies each provider settles by default; <PROVIDER>_CURRENCIES (comma
// separated) overrides, e.g. when a merchant account enables more. null = any.
const DEFAULT_PROVIDER_CURRENCIES = {
  paystack: ['NGN', 'GHS', 'ZAR', 'KES', 'USD'],
  flutterwave: ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'RWF', 'ZAR', 'ZMW', 'MWK', 'XAF', 'XOF', 'EGP', 'USD', 'EUR', 'GBP'],
  stripe: null,
}

function providerCurrencies(provider) {
  const override = text(process.env[`${provider.toUpperCase()}_CURRENCIES`])
  if (override) return override.split(',').map(item => item.trim().toUpperCase()).filter(Boolean)
  return DEFAULT_PROVIDER_CURRENCIES[provider]
}

export function providerSupportsCurrency(provider, currency) {
  const supported = providerCurrencies(provider)
  return !supported || supported.includes(String(currency || '').toUpperCase())
}

export function isAfricanPayer({ countryCode, currency } = {}) {
  const country = String(countryCode || '').trim().toUpperCase()
  if (country) return AFRICAN_COUNTRIES.has(country)
  return AFRICAN_CURRENCIES.has(String(currency || '').trim().toUpperCase())
}

// The provider for a checkout: an explicitly requested provider when it is
// fully configured and settles the currency, otherwise the first configured
// provider for the payer's region that settles it. null when none can.
export function selectCheckoutProvider({ requested, currency, countryCode, available = enabledCheckoutProviders() } = {}) {
  const usable = provider => available.includes(provider) && providerSupportsCurrency(provider, currency)
  const wanted = String(requested || '').trim().toLowerCase()
  if (wanted && usable(wanted)) return wanted
  const order = isAfricanPayer({ countryCode, currency }) ? AFRICA_ORDER : GLOBAL_ORDER
  return order.find(usable) || null
}

function formBody(values) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') params.set(key, String(value)) })
  return params
}

// Stripe Price ids are server configuration. A client-supplied `priceId` could
// point a subscription checkout at any (cheaper) price while the webhook still
// grants the requested plan, so only the configured price is ever used.
export function stripePriceForPlan(planId) {
  const raw = String(planId || '').trim()
  if (!raw) return ''
  const exact = process.env[`STRIPE_PRICE_${raw.toUpperCase()}`]
  if (exact) return exact.trim()
  return text(process.env[`STRIPE_PRICE_${raw.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`])
}

function allowedRedirectOrigins() {
  const origins = new Set()
  for (const value of [
    ...String(process.env.CORS_ORIGINS || '').split(','),
    process.env.FRONTEND_URL,
    process.env.BILLING_SUCCESS_URL,
    process.env.BILLING_CANCEL_URL,
  ]) {
    try { if (value && value.trim()) origins.add(new URL(value.trim()).origin) } catch { /* ignore malformed entries */ }
  }
  return origins
}

// Only same-platform https origins may receive the post-checkout redirect;
// anything else falls back to the configured URL (no open redirect through the
// provider's hosted page).
export function checkoutRedirect(candidate, fallback) {
  const value = text(candidate)
  if (!value) return text(fallback)
  try {
    const url = new URL(value)
    const local = ['localhost', '127.0.0.1'].includes(url.hostname) && process.env.NODE_ENV !== 'production'
    if ((url.protocol === 'https:' || local) && allowedRedirectOrigins().has(url.origin)) return url.toString()
  } catch { /* fall through */ }
  return text(fallback)
}

function stripeMetadata(prefix, payment) {
  return {
    [`${prefix}[paymentIntentId]`]: payment.id,
    [`${prefix}[userId]`]: payment.userId,
    [`${prefix}[packageId]`]: payment.packageId || '',
    [`${prefix}[planId]`]: payment.planId || '',
    [`${prefix}[organizationId]`]: payment.organizationId || '',
    [`${prefix}[purchaseType]`]: payment.purchaseType || '',
  }
}

async function providerCheckout(provider, payment, input = {}) {
  const successUrl = checkoutRedirect(input.successUrl, process.env.BILLING_SUCCESS_URL)
  const cancelUrl = checkoutRedirect(input.cancelUrl, process.env.BILLING_CANCEL_URL)
  if (!successUrl || !cancelUrl) return { ok: false, status: 503, error: 'checkout_redirects_not_configured' }
  if (provider === 'stripe') {
    const secret = text(process.env.STRIPE_SECRET_KEY)
    if (!secret) return { ok: false, status: 503, error: 'stripe_not_configured' }
    const priceId = payment.planId ? stripePriceForPlan(payment.planId) : ''
    if (payment.planId && !priceId) return { ok: false, status: 503, error: 'stripe_price_not_configured' }
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `checkout:${payment.id}`,
      },
      body: formBody({
        mode: payment.planId ? 'subscription' : 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: payment.id,
        'metadata[paymentIntentId]': payment.id,
        'metadata[userId]': payment.userId,
        'metadata[packageId]': payment.packageId || '',
        'metadata[planId]': payment.planId || '',
        'metadata[organizationId]': payment.organizationId || '',
        'metadata[purchaseType]': payment.purchaseType || '',
        'metadata[programId]': payment.programId || '',
        'metadata[hackathonId]': payment.hackathonId || '',
        'metadata[sponsorApplicationId]': payment.sponsorApplicationId || '',
        'metadata[credits]': payment.credits,
        // Session metadata is not copied to the subscription/PaymentIntent, so
        // renewal, cancellation, refund and dispute events would otherwise
        // arrive without any link back to the platform user or intent.
        ...stripeMetadata(payment.planId ? 'subscription_data[metadata]' : 'payment_intent_data[metadata]', payment),
        ...(payment.planId ? {
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': 1,
        } : {
          'line_items[0][price_data][currency]': String(payment.currency).toLowerCase(),
          'line_items[0][price_data][product_data][name]': input.name || 'TechIT execution credits',
          'line_items[0][price_data][unit_amount]': Math.round(Number(payment.amount)),
          'line_items[0][quantity]': 1,
        }),
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.url) return { ok: false, status: 502, error: 'stripe_checkout_failed', providerResponse: data }
    return { ok: true, checkoutUrl: data.url, providerSessionId: data.id }
  }
  if (provider === 'paystack') {
    const secret = text(process.env.PAYSTACK_SECRET_KEY)
    if (!secret) return { ok: false, status: 503, error: 'paystack_not_configured' }
    const response = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Math.round(Number(payment.amount)), currency: payment.currency, callback_url: successUrl, email: input.email, reference: payment.id, metadata: { paymentIntentId: payment.id, userId: payment.userId, packageId: payment.packageId, planId: payment.planId, organizationId: payment.organizationId, purchaseType: payment.purchaseType, programId: payment.programId, hackathonId: payment.hackathonId, sponsorApplicationId: payment.sponsorApplicationId, credits: payment.credits }, cancel_action: cancelUrl }) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.data?.authorization_url) return { ok: false, status: 502, error: 'paystack_checkout_failed', providerResponse: data }
    return { ok: true, checkoutUrl: data.data.authorization_url, providerReference: data.data.reference }
  }
  const secret = text(process.env.FLUTTERWAVE_SECRET_KEY)
  if (!secret) return { ok: false, status: 503, error: 'flutterwave_not_configured' }
  // Payment intents store minor units; Flutterwave charges MAJOR units. Sending
  // the stored value unchanged charged customers 100x the price.
  const majorAmount = Number(minorToMajorString(payment.amount, payment.currency))
  const response = await fetch('https://api.flutterwave.com/v3/payments', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tx_ref: payment.id, amount: majorAmount, currency: payment.currency, redirect_url: successUrl, customer: { email: input.email || 'billing@techit.local' }, customizations: { title: input.name || 'TechIT Network' }, meta: { paymentIntentId: payment.id, userId: payment.userId, packageId: payment.packageId, planId: payment.planId, organizationId: payment.organizationId, purchaseType: payment.purchaseType, programId: payment.programId, hackathonId: payment.hackathonId, sponsorApplicationId: payment.sponsorApplicationId, credits: payment.credits }, payment_options: input.paymentOptions || undefined }) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.data?.link) return { ok: false, status: 502, error: 'flutterwave_checkout_failed', providerResponse: data }
  return { ok: true, checkoutUrl: data.data.link, providerReference: payment.id }
}

export async function createTvceCheckout(userId, input = {}) {
  const requested = text(input.provider || process.env.DEFAULT_BILLING_PROVIDER).toLowerCase()
  if (requested && !providerSet.has(requested)) return { ok: false, status: 400, error: 'unsupported_provider' }
  const available = enabledCheckoutProviders()
  // Nothing can take the payment: do not create an intent that cannot proceed.
  if (!available.length) return { ok: false, status: 503, error: requested ? `${requested}_not_configured` : 'unsupported_provider' }
  const countryCode = text(input.country_code || input.countryCode)
  const idemKey = text(input.idemKey || input.idempotencyKey || input.idempotency_key)
  // The provider is chosen once the intent has fixed the (server-side)
  // currency: the requested provider when it is fully configured and settles
  // that currency, otherwise the payer's regional default. So a missing Stripe
  // key never blocks Paystack/Flutterwave for a payment they can take.
  const intent = await createPaymentIntentAsync(userId, { ...input, provider: null, ...(idemKey ? { idemKey } : {}) })
  if (intent?.ok === false) return intent
  let payment = intent.paymentIntent
  const provider = selectCheckoutProvider({ requested, currency: payment.currency, countryCode, available })
  if (!provider) {
    return requested && !available.includes(requested)
      ? { ok: false, status: 503, error: `${requested}_not_configured`, availableProviders: available, paymentIntent: payment }
      : { ok: false, status: 422, error: 'no_provider_for_currency', currency: payment.currency, availableProviders: available, paymentIntent: payment }
  }
  if (payment.provider && payment.provider !== provider) {
    return { ok: false, status: 409, error: 'payment_provider_mismatch', paymentIntent: payment }
  }
  if (payment.status === 'successful') {
    return { ok: false, status: 409, error: 'payment_intent_already_completed', paymentIntent: payment }
  }
  if (payment.status === 'expired') {
    return { ok: false, status: 409, error: 'payment_intent_expired', paymentIntent: payment }
  }
  if (payment.checkoutUrl) {
    return { ok: true, paymentIntent: payment, checkoutUrl: payment.checkoutUrl, provider, idempotent: true }
  }
  const begun = financePostgresEnabled()
    ? await beginPaymentIntentCheckoutPostgres(userId, payment.id)
    : beginCheckout(payment.id, userId)
  if (begun?.ok === false) return begun
  payment = begun.paymentIntent
  if (payment.checkoutUrl) {
    return { ok: true, paymentIntent: payment, checkoutUrl: payment.checkoutUrl, provider, idempotent: true }
  }
  const checkout = await providerCheckout(provider, { ...payment, userId }, input)
  if (!checkout.ok) {
    const failed = financePostgresEnabled()
      ? await markPaymentIntentCheckoutFailurePostgres(userId, payment.id, { ...checkout, provider }).catch(() => null)
      : persistCheckoutFailure(userId, payment.id, { ...checkout, provider })
    return {
      ok: false,
      status: checkout.status || 502,
      error: checkout.error || 'provider_checkout_failed',
      paymentIntent: failed?.paymentIntent || payment,
    }
  }
  const persisted = financePostgresEnabled()
    ? await markPaymentIntentCheckoutPostgres(userId, payment.id, { ...checkout, provider })
    : persistCheckout(userId, payment.id, { ...checkout, provider })
  if (persisted?.ok === false) return persisted
  payment = persisted.paymentIntent
  return { ok: true, paymentIntent: payment, checkoutUrl: payment.checkoutUrl, provider, idempotent: Boolean(persisted.idempotent) }
}

function persistCheckout(userId, paymentId, checkout) {
  return updateAuthorityDb(db => {
    const payment = (db.paymentIntents || []).find(row => row.id === paymentId && row.userId === userId)
    if (!payment) return { ok: false, status: 404, error: 'payment_not_found' }
    if (payment.checkoutUrl) return { ok: true, idempotent: true, paymentIntent: payment }
    const now = new Date().toISOString()
    Object.assign(payment, {
      provider: checkout.provider,
      checkoutUrl: checkout.checkoutUrl,
      providerSessionId: checkout.providerSessionId || null,
      providerReference: checkout.providerReference || null,
      checkoutStatus: 'created',
      checkoutCreatedAt: now,
      lastCheckoutError: null,
      updatedAt: now,
    })
    return { ok: true, paymentIntent: payment }
  })
}

function beginCheckout(paymentId, userId) {
  return updateAuthorityDb(db => {
    const payment = (db.paymentIntents || []).find(row => row.id === paymentId && row.userId === userId)
    if (!payment) return { ok: false, status: 404, error: 'payment_not_found' }
    if (payment.checkoutUrl) return { ok: true, idempotent: true, paymentIntent: payment }
    if (payment.status === 'successful') return { ok: false, status: 409, error: 'payment_intent_already_completed', paymentIntent: payment }
    if (payment.status === 'expired') return { ok: false, status: 409, error: 'payment_intent_expired', paymentIntent: payment }
    const lockMs = Math.max(30, Number(process.env.PAYMENT_CHECKOUT_LOCK_SECONDS || 120)) * 1000
    const lockedAt = payment.checkoutLockedAt ? new Date(payment.checkoutLockedAt).getTime() : 0
    if (payment.checkoutStatus === 'creating' && lockedAt && Date.now() - lockedAt < lockMs) {
      return { ok: false, status: 409, error: 'checkout_in_progress', paymentIntent: payment }
    }
    const now = new Date().toISOString()
    Object.assign(payment, {
      checkoutStatus: 'creating',
      checkoutLockedAt: now,
      checkoutAttempts: Number(payment.checkoutAttempts || 0) + 1,
      updatedAt: now,
    })
    return { ok: true, paymentIntent: payment }
  })
}

function persistCheckoutFailure(userId, paymentId, failure) {
  return updateAuthorityDb(db => {
    const payment = (db.paymentIntents || []).find(row => row.id === paymentId && row.userId === userId)
    if (!payment) return null
    const now = new Date().toISOString()
    Object.assign(payment, {
      provider: failure.provider || payment.provider || null,
      checkoutStatus: 'failed',
      lastCheckoutError: String(failure.error || 'provider_checkout_failed').slice(0, 200),
      lastCheckoutFailedAt: now,
      updatedAt: now,
    })
    return { paymentIntent: payment }
  })
}
