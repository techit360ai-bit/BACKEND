import crypto from 'crypto'
import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'
import { fulfillPayment } from './tvceService.js'

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

function normalize(provider, payload) {
  if (provider === 'stripe') {
    const object = payload.data?.object || {}
    const metadata = object.metadata || object.subscription_details?.metadata || {}
    return { eventId: payload.id, type: payload.type, paymentId: metadata.paymentIntentId || metadata.payment_id || object.client_reference_id, userId: metadata.userId || metadata.user_id, planId: metadata.planId || metadata.plan_id, credits: Number(metadata.credits || 0), providerReference: object.id, success: ['payment_intent.succeeded', 'checkout.session.completed', 'invoice.paid'].includes(payload.type) }
  }
  if (provider === 'paystack') {
    const data = payload.data || {}; const metadata = data.metadata || {}
    return { eventId: payload.id || data.id || data.reference, type: payload.event, paymentId: metadata.paymentIntentId || metadata.payment_id, userId: metadata.userId || metadata.user_id || data.customer?.metadata?.userId, planId: metadata.planId || metadata.plan_id, credits: Number(metadata.credits || 0), providerReference: data.reference || String(data.id || ''), success: payload.event === 'charge.success' }
  }
  const data = payload.data || payload; const metadata = data.meta || data.metadata || {}
  return { eventId: payload.id || data.id || data.tx_ref, type: payload.event || payload.type, paymentId: metadata.paymentIntentId || metadata.payment_id, userId: metadata.userId || metadata.user_id, planId: metadata.planId || metadata.plan_id, credits: Number(metadata.credits || 0), providerReference: data.tx_ref || String(data.id || ''), success: ['charge.completed', 'payment.completed'].includes(payload.event || payload.type) && String(data.status || '').toLowerCase() === 'successful' }
}

export async function handleBillingWebhook(providerInput, payload, headers = {}, rawBody = '') {
  const provider = String(providerInput || '').toLowerCase()
  if (!supported.has(provider)) return { ok: false, status: 400, error: 'unsupported_provider' }
  if (!verifySignature(provider, rawBody, headers)) return { ok: false, status: 401, error: 'invalid_webhook_signature' }
  const event = normalize(provider, payload || {})
  if (!event.eventId) return { ok: false, status: 400, error: 'webhook_event_id_required' }
  const prior = (readDb().billingWebhookEvents || []).find(row => row.provider === provider && row.eventId === String(event.eventId))
  if (prior) return { ok: true, idempotent: true, event: prior }
  if (provider === 'stripe' && ['customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type) && event.userId) {
    const status = event.type.endsWith('deleted') ? 'cancelled' : String(payload.data?.object?.status || 'active')
    return updateDb(db => {
      const subscriptions = db.subscriptions || (db.subscriptions = [])
      const current = subscriptions.find(row => row.userId === event.userId && (row.providerId === event.providerReference || row.planId === event.planId)) || { id: createId('subscription'), userId: event.userId, createdAt: nowIso() }
      Object.assign(current, { provider: 'stripe', providerId: event.providerReference, planId: event.planId || current.planId || null, status, updatedAt: nowIso() })
      if (!subscriptions.includes(current)) subscriptions.push(current)
      if (!Array.isArray(db.billingWebhookEvents)) db.billingWebhookEvents = []
      const row = { id: createId('billing_event'), provider, eventId: String(event.eventId), type: event.type, status: 'processed', userId: event.userId, createdAt: nowIso() }; db.billingWebhookEvents.push(row)
      return { ok: true, event: row, subscription: current }
    })
  }
  if (!event.success) {
    return updateDb(db => { if (!Array.isArray(db.billingWebhookEvents)) db.billingWebhookEvents = []; const row = { id: createId('billing_event'), provider, eventId: String(event.eventId), type: event.type, status: 'ignored', createdAt: nowIso() }; db.billingWebhookEvents.push(row); return { ok: true, ignored: true, event: row } })
  }
  let result = null
  if (event.paymentId && event.userId) result = await fulfillPayment(event.userId, event.paymentId, { verified: true, planId: event.planId, providerReference: event.providerReference })
  if (result?.ok === false) return result
  return updateDb(db => { if (!Array.isArray(db.billingWebhookEvents)) db.billingWebhookEvents = []; const row = { id: createId('billing_event'), provider, eventId: String(event.eventId), type: event.type, status: result?.idempotent ? 'idempotent' : 'processed', userId: event.userId || null, paymentIntentId: event.paymentId || null, createdAt: nowIso() }; db.billingWebhookEvents.push(row); return { ok: true, event: row, result } })
}
