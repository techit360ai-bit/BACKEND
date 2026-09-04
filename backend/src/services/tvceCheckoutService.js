import { createPaymentIntent } from './domainService.js'

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
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: formBody({ mode: payment.planId ? 'subscription' : 'payment', success_url: successUrl, cancel_url: cancelUrl, client_reference_id: payment.id, 'metadata[paymentIntentId]': payment.id, 'metadata[userId]': payment.userId, 'metadata[planId]': payment.planId || '', 'metadata[credits]': payment.credits, ...(payment.planId ? { 'line_items[0][price]': input.priceId || process.env[`STRIPE_PRICE_${String(payment.planId).toUpperCase()}`], 'line_items[0][quantity]': 1 } : { 'line_items[0][price_data][currency]': String(payment.currency).toLowerCase(), 'line_items[0][price_data][product_data][name]': input.name || 'TechIT execution credits', 'line_items[0][price_data][unit_amount]': payment.amount, 'line_items[0][quantity]': 1 }) }) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.url) return { ok: false, status: 502, error: 'stripe_checkout_failed', providerResponse: data }
    return { ok: true, checkoutUrl: data.url, providerSessionId: data.id }
  }
  if (provider === 'paystack') {
    const secret = text(process.env.PAYSTACK_SECRET_KEY)
    if (!secret) return { ok: false, status: 503, error: 'paystack_not_configured' }
    const response = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: payment.amount, currency: payment.currency, callback_url: successUrl, email: input.email, reference: payment.id, metadata: { paymentIntentId: payment.id, userId: payment.userId, planId: payment.planId, credits: payment.credits }, cancel_action: cancelUrl }) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.data?.authorization_url) return { ok: false, status: 502, error: 'paystack_checkout_failed', providerResponse: data }
    return { ok: true, checkoutUrl: data.data.authorization_url, providerReference: data.data.reference }
  }
  const secret = text(process.env.FLUTTERWAVE_SECRET_KEY)
  if (!secret) return { ok: false, status: 503, error: 'flutterwave_not_configured' }
  const response = await fetch('https://api.flutterwave.com/v3/payments', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tx_ref: payment.id, amount: payment.amount, currency: payment.currency, redirect_url: successUrl, customer: { email: input.email || 'billing@techit.local' }, customizations: { title: input.name || 'TechIT Network' }, meta: { paymentIntentId: payment.id, userId: payment.userId, planId: payment.planId, credits: payment.credits }, payment_options: input.paymentOptions || undefined }) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.data?.link) return { ok: false, status: 502, error: 'flutterwave_checkout_failed', providerResponse: data }
  return { ok: true, checkoutUrl: data.data.link, providerReference: payment.id }
}

export async function createTvceCheckout(userId, input = {}) {
  const provider = text(input.provider || process.env.DEFAULT_BILLING_PROVIDER).toLowerCase()
  if (!providerSet.has(provider)) return { ok: false, status: 400, error: 'unsupported_provider' }
  const intent = createPaymentIntent(userId, { ...input, provider, idemKey: text(input.idemKey || `${userId}:${provider}:${input.packageId || input.planId || input.amount}:${input.workflowId || ''}`) })
  if (intent?.ok === false) return { ...intent, status: 400 }
  const payment = intent.paymentIntent
  if (payment.checkoutUrl) return { ok: true, paymentIntent: payment, checkoutUrl: payment.checkoutUrl, idempotent: true }
  const checkout = await providerCheckout(provider, { ...payment, userId }, input)
  if (!checkout.ok) return { ...checkout, paymentIntent: payment }
  payment.provider = provider; payment.checkoutUrl = checkout.checkoutUrl; payment.providerSessionId = checkout.providerSessionId || null; payment.providerReference = checkout.providerReference || null
  return { ok: true, paymentIntent: payment, checkoutUrl: checkout.checkoutUrl, provider }
}
