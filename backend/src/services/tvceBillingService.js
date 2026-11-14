import crypto from 'crypto'
import { createId, nowIso } from '../utils/api.js'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { fulfillPaymentAsync, reversePaymentCreditsAsync } from './tvceService.js'
import {
  billingEventExistsPostgres,
  markPaymentIntentReconciliationPostgres,
  paymentIntentByProviderPaymentIntentPostgres,
  paymentIntentPostgres,
  recordBillingEventPostgres,
  subscriptionUserPostgres,
  updateSubscriptionPostgres,
  financePostgresEnabled,
} from '../repositories/financeRepository.js'
import { applyOrganizationPaymentAsync, applyOrganizationPaymentLifecycleAsync } from './organizationBillingService.js'
import { majorToMinor } from '../utils/money.js'

const supported = new Set(['stripe', 'paystack', 'flutterwave'])
const signature = (value, expected) => {
  if (!value || !expected) return false
  const left = Buffer.from(String(value)); const right = Buffer.from(String(expected))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function verifySignature(provider, rawBody, headers = {}) {
  const body = String(rawBody || '')
  if (provider === 'stripe') {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    const header = headers['stripe-signature'] || headers['Stripe-Signature']
    if (!secret || !header) return false
    const timestamp = String(header).split(',').find(item => item.startsWith('t='))?.slice(2)
    const v1 = String(header).split(',').find(item => item.startsWith('v1='))?.slice(3)
    if (!timestamp || !v1 || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false
    return signature(v1, crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex'))
  }
  if (provider === 'paystack') {
    const secret = process.env.PAYSTACK_SECRET_KEY
    const received = headers['x-paystack-signature'] || headers['X-Paystack-Signature']
    return Boolean(secret && received && signature(received, crypto.createHmac('sha512', secret).update(body).digest('hex')))
  }
  const secret = process.env.FLUTTERWAVE_SECRET_HASH
  const received = headers['verif-hash'] || headers['Verif-Hash']
  return Boolean(secret && received && signature(received, secret))
}

const STRIPE_SUCCESS_TYPES = new Set(['payment_intent.succeeded', 'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'invoice.paid'])

function normalize(provider, payload) {
  if (provider === 'stripe') {
    const object = payload.data?.object || {}
    const metadata = object.metadata || object.subscription_details?.metadata || {}
    // A completed Checkout Session for a delayed payment method is not paid
    // yet (payment_status "unpaid"); it settles later via
    // checkout.session.async_payment_succeeded.
    const sessionPaid = !String(payload.type || '').startsWith('checkout.session') || ['paid', 'no_payment_required'].includes(object.payment_status)
    return {
      eventId: payload.id, type: payload.type,
      paymentId: metadata.paymentIntentId || metadata.payment_id || object.client_reference_id,
      userId: metadata.userId || metadata.user_id, planId: metadata.planId || metadata.plan_id,
      organizationId: metadata.organizationId || metadata.organization_id, purchaseType: metadata.purchaseType || metadata.purchase_type,
      credits: Number(metadata.credits || 0), providerReference: object.id,
      subscriptionId: object.subscription || (object.object === 'subscription' ? object.id : null) || object.id,
      providerPaymentIntentId: object.payment_intent || (object.object === 'payment_intent' ? object.id : null),
      status: object.status,
      amount: object.amount_total ?? object.amount_paid ?? object.amount_received ?? object.amount ?? object.amount_due,
      currency: object.currency, failureReason: object.last_payment_error?.message,
      success: STRIPE_SUCCESS_TYPES.has(payload.type) && sessionPaid,
    }
  }
  if (provider === 'paystack') {
    const data = payload.data || {}; const metadata = (data.metadata && typeof data.metadata === 'object') ? data.metadata : {}
    return { eventId: payload.id || data.id || data.reference, type: payload.event, paymentId: metadata.paymentIntentId || metadata.payment_id, userId: metadata.userId || metadata.user_id || data.customer?.metadata?.userId, planId: metadata.planId || metadata.plan_id, organizationId: metadata.organizationId || metadata.organization_id, purchaseType: metadata.purchaseType || metadata.purchase_type, credits: Number(metadata.credits || 0), providerReference: data.reference || String(data.id || ''), subscriptionId: data.subscription_code || metadata.subscriptionId, status: data.status, amount: data.amount, currency: data.currency, success: payload.event === 'charge.success' }
  }
  const data = payload.data || payload; const metadata = data.meta || data.metadata || payload.meta_data || {}
  return { eventId: payload.id || data.id || data.tx_ref, type: payload.event || payload.type, paymentId: metadata.paymentIntentId || metadata.payment_id, userId: metadata.userId || metadata.user_id, planId: metadata.planId || metadata.plan_id, organizationId: metadata.organizationId || metadata.organization_id, purchaseType: metadata.purchaseType || metadata.purchase_type, credits: Number(metadata.credits || 0), providerReference: data.tx_ref || String(data.id || ''), providerTransactionId: data.id, subscriptionId: metadata.subscriptionId, status: data.status, amount: data.amount, currency: data.currency, success: ['charge.completed', 'payment.completed'].includes(payload.event || payload.type) && String(data.status || '').toLowerCase() === 'successful' }
}

// The backend set the provider reference to the intent id for Paystack
// (`reference`) and Flutterwave (`tx_ref`), so the intent can be resolved even
// when the provider does not echo metadata back (Flutterwave never does).
function intentIdFor(provider, event) {
  if (event.paymentId) return String(event.paymentId)
  if (provider === 'paystack' || provider === 'flutterwave') return event.providerReference ? String(event.providerReference) : null
  return null
}

async function loadPaymentIntent(paymentId) {
  if (!paymentId) return null
  if (financePostgresEnabled()) return paymentIntentPostgres(paymentId)
  return (readAuthorityDb().paymentIntents || []).find(row => row.id === paymentId) || null
}

async function loadPaymentIntentByProviderPaymentIntent(providerPaymentIntentId) {
  if (!providerPaymentIntentId) return null
  if (financePostgresEnabled()) return paymentIntentByProviderPaymentIntentPostgres(providerPaymentIntentId)
  return (readAuthorityDb().paymentIntents || []).find(row => row.providerPaymentIntentId === providerPaymentIntentId) || null
}

async function subscriptionUser(providerId) {
  if (!providerId) return null
  if (financePostgresEnabled()) return subscriptionUserPostgres(providerId)
  return (readAuthorityDb().subscriptions || []).find(row => row.providerId === providerId)?.userId || null
}

async function flagForReconciliation(intent, reason, detail) {
  console.error(JSON.stringify({ event: 'billing_webhook_reconciliation_required', paymentIntentId: intent.id, reason, provider: detail.provider }))
  if (financePostgresEnabled()) return markPaymentIntentReconciliationPostgres(intent.id, reason, detail)
  return updateAuthorityDb(db => {
    const row = (db.paymentIntents || []).find(item => item.id === intent.id)
    if (row && row.status !== 'successful') Object.assign(row, { reconciliationRequired: true, reconciliationReason: reason, reconciliationDetail: detail, updatedAt: nowIso() })
    return { ok: true, payment: row || intent }
  })
}

// Provider-reported amount in minor units. Stripe and Paystack report minor
// units; Flutterwave reports major units.
function chargedMinor(provider, amount, currency) {
  if (amount === undefined || amount === null || amount === '') return null
  if (provider === 'flutterwave') return majorToMinor(amount, currency)
  const value = Number(amount)
  return Number.isFinite(value) ? Math.round(value) : null
}

// The provider must have charged at least the intent amount in the intent
// currency. Overpayment (e.g. provider-side fees passed to the customer) is
// accepted; underpayment or a different currency is never granted.
export function verifyChargedAmount(intent, provider, { amount, currency }) {
  const expectedCurrency = String(intent.currency || 'USD').toUpperCase()
  const receivedCurrency = String(currency || '').toUpperCase()
  if (!receivedCurrency || receivedCurrency !== expectedCurrency) return { ok: false, reason: 'currency_mismatch', expectedCurrency, receivedCurrency: receivedCurrency || null }
  const expected = Math.round(Number(intent.amount))
  const charged = chargedMinor(provider, amount, receivedCurrency)
  if (!Number.isFinite(expected) || charged === null) return { ok: false, reason: 'amount_missing', expectedAmountMinor: Number.isFinite(expected) ? expected : null, chargedAmountMinor: charged }
  if (charged < expected) return { ok: false, reason: 'amount_underpaid', expectedAmountMinor: expected, chargedAmountMinor: charged }
  return { ok: true, chargedAmountMinor: charged, currency: receivedCurrency }
}

// Flutterwave's verif-hash is a static shared secret, not a signature over the
// payload, so the charge is confirmed with Flutterwave before it is trusted.
export async function verifyFlutterwaveTransaction(transactionId) {
  const secret = String(process.env.FLUTTERWAVE_SECRET_KEY || '').trim()
  if (!secret) return { ok: false, retryable: true, error: 'flutterwave_not_configured' }
  if (!transactionId) return { ok: false, retryable: false, error: 'provider_transaction_id_missing' }
  let response
  try {
    response = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(transactionId))}/verify`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(Number(process.env.FLUTTERWAVE_VERIFY_TIMEOUT_MS || 10000)),
    })
  } catch {
    return { ok: false, retryable: true, error: 'flutterwave_verification_unavailable' }
  }
  const body = await response.json().catch(() => null)
  if (response.status >= 500 || (response.ok && !body)) return { ok: false, retryable: true, error: 'flutterwave_verification_unavailable' }
  if (!response.ok) return { ok: false, retryable: false, error: 'flutterwave_transaction_not_found' }
  const data = body?.data || {}
  return { ok: true, status: String(data.status || '').toLowerCase(), amount: data.amount, currency: data.currency, txRef: data.tx_ref }
}

async function recordEvent(row) {
  if (financePostgresEnabled()) return recordBillingEventPostgres(row)
  return updateAuthorityDb(db => {
    if (!Array.isArray(db.billingWebhookEvents)) db.billingWebhookEvents = []
    const record = { id: createId('billing_event'), ...row, eventId: String(row.eventId), createdAt: nowIso() }
    db.billingWebhookEvents.push(record)
    return record
  })
}

async function fulfillVerifiedPayment(provider, event) {
  const intent = await loadPaymentIntent(intentIdFor(provider, event))
  if (!intent) {
    // A signed event for a payment this platform never created: record it, do
    // not grant anything.
    const row = await recordEvent({ provider, eventId: event.eventId, type: event.type, status: 'unmatched' })
    return { ok: true, ignored: true, reason: 'payment_intent_not_found', event: row }
  }
  const evidence = { provider, eventId: String(event.eventId), providerReference: event.providerReference || null }
  if (event.userId && String(event.userId) !== String(intent.userId)) {
    await flagForReconciliation(intent, 'payment_user_mismatch', evidence)
    const row = await recordEvent({ provider, eventId: event.eventId, type: event.type, status: 'reconciliation_required', userId: intent.userId, paymentIntentId: intent.id })
    return { ok: true, reconciliationRequired: true, reason: 'payment_user_mismatch', event: row }
  }
  if (intent.status === 'successful') {
    const row = await recordEvent({ provider, eventId: event.eventId, type: event.type, status: 'idempotent', userId: intent.userId, paymentIntentId: intent.id })
    return { ok: true, event: row, result: { ok: true, idempotent: true, payment: intent } }
  }

  let charged = { amount: event.amount, currency: event.currency }
  if (provider === 'flutterwave') {
    const verified = await verifyFlutterwaveTransaction(event.providerTransactionId)
    // Not reachable: do not record the event, so the provider retries later.
    if (!verified.ok && verified.retryable) return { ok: false, status: 503, error: verified.error }
    if (!verified.ok || verified.status !== 'successful' || String(verified.txRef || '') !== String(intent.id)) {
      const reason = !verified.ok ? verified.error : verified.status !== 'successful' ? 'provider_not_successful' : 'tx_ref_mismatch'
      await flagForReconciliation(intent, reason, evidence)
      const row = await recordEvent({ provider, eventId: event.eventId, type: event.type, status: 'reconciliation_required', userId: intent.userId, paymentIntentId: intent.id })
      return { ok: true, reconciliationRequired: true, reason, event: row }
    }
    charged = { amount: verified.amount, currency: verified.currency }
  }
  const amountCheck = verifyChargedAmount(intent, provider, charged)
  if (!amountCheck.ok) {
    await flagForReconciliation(intent, amountCheck.reason, { ...evidence, ...amountCheck })
    const row = await recordEvent({ provider, eventId: event.eventId, type: event.type, status: 'reconciliation_required', userId: intent.userId, paymentIntentId: intent.id })
    return { ok: true, reconciliationRequired: true, reason: amountCheck.reason, event: row }
  }

  // Owner, plan and credits come from the server-side intent, never from
  // provider metadata.
  const result = await fulfillPaymentAsync(intent.userId, intent.id, {
    verified: true,
    providerReference: event.providerReference,
    providerPaymentIntentId: event.providerPaymentIntentId || null,
    providerSubscriptionId: intent.planId && provider === 'stripe' && event.subscriptionId !== event.providerReference ? event.subscriptionId : null,
    provider,
    providerAmountMinor: amountCheck.chargedAmountMinor,
    providerCurrency: amountCheck.currency,
  })
  if (result?.ok === false) return result
  const organizationPayment = await applyOrganizationPaymentAsync({ userId: intent.userId, paymentId: intent.id, provider, providerReference: event.providerReference, planId: intent.planId })
  if (organizationPayment?.ok === false) return organizationPayment
  const row = await recordEvent({ provider, eventId: event.eventId, type: event.type, status: result?.idempotent ? 'idempotent' : 'processed', userId: intent.userId, paymentIntentId: intent.id })
  return { ok: true, event: row, result }
}

export async function handleBillingWebhook(providerInput, payload, headers = {}, rawBody = '') {
  const provider = String(providerInput || '').toLowerCase()
  if (!supported.has(provider)) return { ok: false, status: 400, error: 'unsupported_provider' }
  if (!verifySignature(provider, rawBody, headers)) return { ok: false, status: 401, error: 'invalid_webhook_signature' }
  const event = normalize(provider, payload || {})
  if (!event.eventId) return { ok: false, status: 400, error: 'webhook_event_id_required' }
  const prior = financePostgresEnabled()
    ? (await billingEventExistsPostgres(provider, event.eventId) ? { provider, eventId: String(event.eventId) } : null)
    : (readAuthorityDb().billingWebhookEvents || []).find(row => row.provider === provider && row.eventId === String(event.eventId))
  if (prior) return { ok: true, idempotent: true, event: prior }
  const lifecycleTypes = new Set(['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'charge.refunded', 'charge.dispute.created', 'subscription.create', 'subscription.disable', 'subscription.not_renew'])
  if (lifecycleTypes.has(event.type) && !(event.success && event.paymentId)) {
    // Refund/dispute events carry the provider PaymentIntent; subscription
    // events carry the provider subscription id. Resolve the platform user and
    // intent server-side when the provider did not echo our metadata.
    if (!event.paymentId && event.providerPaymentIntentId) {
      const intent = await loadPaymentIntentByProviderPaymentIntent(event.providerPaymentIntentId)
      if (intent) { event.paymentId = intent.id; event.userId = event.userId || intent.userId }
    }
    if (!event.userId && event.subscriptionId) event.userId = await subscriptionUser(event.subscriptionId)
  }
  if (lifecycleTypes.has(event.type) && (event.userId || event.paymentId) && !(event.success && event.paymentId)) {
    const status = event.type.endsWith('deleted') || event.type === 'subscription.disable' ? 'cancelled'
      : event.type === 'invoice.payment_failed' ? 'past_due'
        : event.type === 'charge.refunded' ? 'refunded'
          : event.type === 'charge.dispute.created' ? 'disputed'
            : event.type === 'subscription.not_renew' ? 'cancelled'
              : String(event.status || payload.data?.object?.status || 'active')
    if ((status === 'refunded' || status === 'disputed') && event.paymentId && event.userId) {
      await reversePaymentCreditsAsync(event.userId, event.paymentId, status === 'disputed' ? 'dispute' : 'refund')
    }
    const userId = event.userId || (event.paymentId ? (await loadPaymentIntent(event.paymentId))?.userId : null)
    const organizationLifecycle = await applyOrganizationPaymentLifecycleAsync({ paymentId: event.paymentId, providerReference: event.providerReference, status })
    if (organizationLifecycle?.ok === false) return organizationLifecycle
    if (financePostgresEnabled() && userId) {
      const subscription = await updateSubscriptionPostgres({ userId, provider, providerId: event.subscriptionId || event.providerReference, planId: event.planId, status, amount: event.amount, currency: event.currency, failureReason: event.failureReason })
      const row = await recordBillingEventPostgres({ provider, eventId: event.eventId, type: event.type, status: 'processed', userId, paymentIntentId: event.paymentId || null, subscriptionId: event.subscriptionId || null })
      return { ok: true, event: row, subscription }
    }
    return updateAuthorityDb(db => {
      const subscriptions = db.subscriptions || (db.subscriptions = [])
      const current = subscriptions.find(row => row.userId === userId && (row.providerId === event.subscriptionId || row.providerId === event.providerReference || row.planId === event.planId)) || { id: createId('subscription'), userId, createdAt: nowIso() }
      Object.assign(current, { provider, providerId: event.subscriptionId || event.providerReference, planId: event.planId || current.planId || null, status, amount: event.amount ?? current.amount ?? null, currency: event.currency || current.currency || null, lastFailureReason: event.failureReason || (status === 'past_due' ? 'provider_payment_failed' : current.lastFailureReason || null), updatedAt: nowIso() })
      if (!subscriptions.includes(current)) subscriptions.push(current)
      const account = (db.accountEntitlements || []).find(row => row.userId === userId)
      if (account && account.source === 'subscription') account.status = status === 'past_due' ? 'grace_period' : ['cancelled', 'refunded', 'disputed'].includes(status) ? 'inactive' : status
      if (!Array.isArray(db.billingWebhookEvents)) db.billingWebhookEvents = []
      const row = { id: createId('billing_event'), provider, eventId: String(event.eventId), type: event.type, status: 'processed', userId: userId || null, paymentIntentId: event.paymentId || null, subscriptionId: event.subscriptionId || null, createdAt: nowIso() }; db.billingWebhookEvents.push(row)
      return { ok: true, event: row, subscription: current }
    })
  }
  if (!event.success) {
    const row = await recordEvent({ provider, eventId: event.eventId, type: event.type, status: 'ignored' })
    return { ok: true, ignored: true, event: row }
  }
  return fulfillVerifiedPayment(provider, event)
}
