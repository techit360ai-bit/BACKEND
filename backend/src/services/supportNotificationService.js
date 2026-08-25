import { Resend } from 'resend'
import { readDb } from '../config/database.js'
import { configuredFromEmail, assertEmailAccepted } from '../utils/emailDelivery.js'

let resendClient
function resend() { if (resendClient) return resendClient; if (!process.env.RESEND_API_KEY) return null; resendClient = new Resend(process.env.RESEND_API_KEY); return resendClient }

export async function deliverSupportNotification({ userId, subject, message, caseNumber, eventType }) {
  const db = readDb(); const user = (db.users || []).find(row => row.id === userId); if (!user) return { ok: false, error: 'user_not_found' }
  const deliveries = []
  const client = resend()
  if (client && user.email) {
    try { const result = await client.emails.send({ from: configuredFromEmail('support notifications'), to: [user.email], subject: `[TechIT Support] ${subject}`, text: `${message}\n\nCase: ${caseNumber}` }); assertEmailAccepted(result, 'support notification'); deliveries.push('email') } catch (error) { deliveries.push({ channel: 'email', error: error.message }) }
  }
  const pushUrl = process.env.PUSH_NOTIFICATION_URL
  if (pushUrl) {
    try { const response = await fetch(pushUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.PUSH_NOTIFICATION_SECRET ? { 'X-TechIT-Signature': process.env.PUSH_NOTIFICATION_SECRET } : {}) }, body: JSON.stringify({ userId, title: subject, body: message, caseNumber, eventType }), signal: AbortSignal.timeout(5000) }); if (response.ok) deliveries.push('push'); else deliveries.push({ channel: 'push', error: `HTTP ${response.status}` }) } catch (error) { deliveries.push({ channel: 'push', error: error.message }) }
  }
  return { ok: deliveries.length > 0, deliveries }
}
