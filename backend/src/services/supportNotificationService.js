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

function normalisePhone(value) {
  const phone = String(value || '').trim().replace(/[\s().-]/g, '')
  return /^\+?[1-9]\d{7,19}$/.test(phone) ? phone : null
}

/**
 * Team delivery is deliberately provider-neutral. Email reuses Resend; WhatsApp
 * is sent to the configured notification adapter so the backend never embeds a
 * vendor SDK or exposes provider credentials to the dashboard.
 */
export async function deliverSupportTeamNotification({ team, subject, message, caseNumber, eventType, adminUsers = [] }) {
  const emails = new Set((team?.notificationEmails || []).map(value => String(value || '').trim().toLowerCase()).filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))
  const phones = new Set((team?.whatsappNumbers || []).map(normalisePhone).filter(Boolean))
  for (const adminId of team?.memberAdminIds || []) {
    const admin = adminUsers.find(row => row.id === adminId && row.active !== false)
    if (admin?.email) emails.add(String(admin.email).trim().toLowerCase())
    const phone = normalisePhone(admin?.phone || admin?.whatsapp)
    if (phone) phones.add(phone)
  }

  const deliveries = []
  const client = resend()
  if (client && team?.notifyEmail !== false && emails.size) {
    try {
      const result = await client.emails.send({ from: configuredFromEmail('support team notifications'), to: [...emails], subject: `[TechIT Support] ${subject}`, text: `${message}\n\nCase: ${caseNumber}` })
      assertEmailAccepted(result, 'support team notification')
      deliveries.push({ channel: 'email', recipients: emails.size })
    } catch (error) {
      deliveries.push({ channel: 'email', error: error.message })
    }
  }

  const whatsappUrl = process.env.WHATSAPP_NOTIFICATION_URL
  if (whatsappUrl && team?.notifyWhatsapp !== false && phones.size) {
    for (const to of phones) {
      try {
        const response = await fetch(whatsappUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(process.env.WHATSAPP_NOTIFICATION_SECRET ? { 'X-TechIT-Signature': process.env.WHATSAPP_NOTIFICATION_SECRET } : {}) },
          body: JSON.stringify({ to, title: subject, body: message, caseNumber, eventType }),
          signal: AbortSignal.timeout(5000),
        })
        deliveries.push(response.ok ? { channel: 'whatsapp', to } : { channel: 'whatsapp', to, error: `HTTP ${response.status}` })
      } catch (error) {
        deliveries.push({ channel: 'whatsapp', to, error: error.message })
      }
    }
  }
  return { ok: deliveries.some(item => !item.error), deliveries }
}
