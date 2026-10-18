import { updateAuthorityDb } from '../config/database.js'
import { createPaymentIntentAsync } from './domainService.js'
import { beginPaymentIntentCheckoutPostgres, financePostgresEnabled, markPaymentIntentCheckoutFailurePostgres, markPaymentIntentCheckoutPostgres } from '../repositories/financeRepository.js'

const providerSet = new Set(['stripe', 'paystack', 'flutterwave'])
const text = value => typeof value === 'string' ? value.trim() : ''

function formBody(values) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') params.set(key, String(value)) })
  return params
}

async function providerCheckout(provider, payment, input = {}) {
  const successUrl = text(input.successUrl || process.env.BILLING_SUCCESS_URL)
  const cancelUrl = text(input.cancelUrl || process.env.BILLING_CANCEL_URL)
  if (!successUrl || !cancelUrl) return { ok: false, status: 503, error: 'checkout_redirects_not_configured' }
  if (provider === 'stripe') {
    const secret = text(process.env.STRIPE_SECRET_KEY)
    if (!secret) return { ok: false, status: 503, error: 'stripe_not_configured' }
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
        ...(payment.planId ? {
          'line_items[0][price]': input.priceId || process.env[`STRIPE_PRICE_${String(payment.planId).toUpperCase()}`],
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
  const response = await fetch('https://api.flutterwave.com/v3/payments', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tx_ref: payment.id, amount: payment.amount, currency: payment.currency, redirect_url: successUrl, customer: { email: input.email || 'billing@techit.local' }, customizations: { title: input.name || 'TechIT Network' }, meta: { paymentIntentId: payment.id, userId: payment.userId, packageId: payment.packageId, planId: payment.planId, organizationId: payment.organizationId, purchaseType: payment.purchaseType, programId: payment.programId, hackathonId: payment.hackathonId, sponsorApplicationId: payment.sponsorApplicationId, credits: payment.credits }, payment_options: input.paymentOptions || undefined }) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.data?.link) return { ok: false, status: 502, error: 'flutterwave_checkout_failed', providerResponse: data }
  return { ok: true, checkoutUrl: data.data.link, providerReference: payment.id }
}

export async function createTvceCheckout(userId, input = {}) {
  const provider = text(input.provider || process.env.DEFAULT_BILLING_PROVIDER).toLowerCase()
  if (!providerSet.has(provider)) return { ok: false, status: 400, error: 'unsupported_provider' }
  const idemKey = text(input.idemKey || input.idempotencyKey || input.idempotency_key)
  const intent = await createPaymentIntentAsync(userId, { ...input, provider, ...(idemKey ? { idemKey } : {}) })
  if (intent?.ok === false) return intent
  let payment = intent.paymentIntent
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
      ? await markPaymentIntentCheckoutFailurePostgres(userId, payment.id, checkout).catch(() => null)
      : persistCheckoutFailure(userId, payment.id, checkout)
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
      checkoutStatus: 'failed',
      lastCheckoutError: String(failure.error || 'provider_checkout_failed').slice(0, 200),
      lastCheckoutFailedAt: now,
      updatedAt: now,
    })
    return { paymentIntent: payment }
  })
}
