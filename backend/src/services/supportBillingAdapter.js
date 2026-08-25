import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'

async function verifyProvider(payment) {
  const provider = String(payment.provider || '').toLowerCase()
  const reference = payment.providerReference || payment.reference || payment.transactionId || payment.id
  let url; let headers = {}
  if (provider === 'paystack' && process.env.PAYSTACK_SECRET_KEY) { url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`; headers.Authorization = `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
  else if (provider === 'flutterwave' && process.env.FLUTTERWAVE_SECRET_KEY) { url = `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(reference)}/verify`; headers.Authorization = `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` }
  else if (provider === 'stripe' && process.env.STRIPE_SECRET_KEY) { url = `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(reference)}`; headers.Authorization = `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  else return { ok: false, error: 'billing_provider_not_configured', provider }
  try { const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) }); if (!response.ok) return { ok: false, error: 'billing_provider_rejected', status: response.status, provider }; const data = await response.json(); const status = provider === 'paystack' ? data?.data?.status : provider === 'flutterwave' ? data?.data?.status : data?.status; return { ok: ['success', 'successful', 'succeeded'].includes(String(status).toLowerCase()), provider, providerStatus: status } } catch { return { ok: false, error: 'billing_provider_unavailable', provider } }
}

export async function reconcileEntitlement(adminId, caseId, reason) {
  const db = readDb(); const supportCase = (db.supportCases || []).find(row => row.id === caseId || row.caseNumber === caseId); if (!supportCase) return { ok: false, status: 404, error: 'case_not_found' }
  const payment = (db.paymentIntents || []).filter(row => row.userId === supportCase.userId).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
  if (!payment) return { ok: false, status: 409, error: 'payment_not_found' }
  const verification = await verifyProvider(payment); if (!verification.ok) return { ok: false, status: 409, error: verification.error, verification }
  return updateDb(state => {
    const currentPayment = state.paymentIntents.find(row => row.id === payment.id); const subscription = state.subscriptions.find(row => row.userId === supportCase.userId) || { id: createId('subscription'), userId: supportCase.userId, createdAt: nowIso() }; const before = { payment: { ...currentPayment }, subscription: { ...subscription } }
    currentPayment.status = 'successful'; currentPayment.verifiedAt = nowIso(); subscription.status = 'active'; subscription.updatedAt = nowIso(); if (!state.subscriptions.some(row => row.id === subscription.id)) state.subscriptions.push(subscription)
    const after = { payment: { ...currentPayment }, subscription: { ...subscription } }; (state.supportAuditLogs || (state.supportAuditLogs = [])).push({ id: createId('support_action'), caseId: supportCase.id, action: 'recalculate_entitlement', actorId: adminId, before, after, metadata: { reason, provider: verification.provider }, createdAt: nowIso() })
    return { ok: true, result: { status: 'completed', provider: verification.provider }, before, after }
  })
}
