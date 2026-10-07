import { Resend } from 'resend'
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto'
import { readDb as readAuthorityDb, writeDb as writeAuthorityDb } from '../config/database.js'
import { normalizeEmail } from '../utils/authInputs.js'
import {
  assertEmailAccepted,
  configuredFromEmail,
  describeEmailProviderError,
} from '../utils/emailDelivery.js'

// Lazy-initialize the Resend client so module load stays side-effect free.
// The Resend constructor throws when no API key is set; eager construction here
// brought the whole service down at boot for any caller — including the ones
// who never touch /api/auth/send-otp. Defer until sendOtp is actually called.
let _resend
function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    throw new Error('RESEND_API_KEY is required to send OTP emails')
  }
  if (_resend) return _resend
  _resend = new Resend(key)
  return _resend
}

// Dev-only delivery sink. With no provider key configured the code cannot be
// emailed, but a local signup must still be completable — so print it to the
// server console instead. Deliberately an allowlist on `development`: every
// other NODE_ENV (production, staging, test) keeps the original fail-closed
// behaviour of returning 502 when RESEND_API_KEY is missing.
function devConsoleDelivery() {
  return process.env.NODE_ENV === 'development' && !process.env.RESEND_API_KEY
}

const EXPIRES   = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10)
const RESEND_COOLDOWN_SECONDS = 60   // minimum gap between sends per email
const MAX_ATTEMPTS = 5               // wrong guesses before OTP is invalidated
const VERIFICATION_EXPIRES_MINUTES = parseInt(process.env.EMAIL_VERIFICATION_EXPIRES_MINUTES || '15', 10)

// ── helpers ──────────────────────────────────────────────────────────────────

function generateCode() {
  // 6-digit zero-padded string
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function cleanExpired(otps = []) {
  const now = Date.now()
  return otps.filter(o => new Date(o.expiresAt).getTime() > now)
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function codeHash(code) {
  return tokenHash(String(code).trim())
}

function codeHmac(code) {
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || ''
  if (!secret) throw new Error('OTP_HASH_SECRET is required to protect OTP records')
  return createHmac('sha256', secret).update(String(code).trim()).digest('hex')
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function cleanExpiredVerifications(records) {
  const now = Date.now()
  return records.filter(r => !r.consumedAt && new Date(r.expiresAt).getTime() > now)
}

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
export async function sendOtp(req, res) {
  const email = normalizeEmail(req.body.email)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' })
  }

  const db  = readAuthorityDb()
  const now = Date.now()

  // Purge expired records first
  db.otps = cleanExpired(db.otps)
  db.emailVerifications = cleanExpiredVerifications(db.emailVerifications || [])

  // Cooldown check — prevent spamming
  const recent = db.otps.find(o => o.email === email)
  if (recent) {
    const sentAt   = new Date(recent.sentAt).getTime()
    const waitSecs = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - (now - sentAt)) / 1000)
    if (waitSecs > 0) {
      return res.status(429).json({
        error: `Please wait ${waitSecs}s before requesting a new code`,
        retryAfter: waitSecs,
      })
    }
    // Remove the old record so we replace it
    db.otps = db.otps.filter(o => o.email !== email)
  }

  const code      = generateCode()
  const expiresAt = new Date(now + EXPIRES * 60 * 1000).toISOString()
  const sentAt    = new Date(now).toISOString()

  // ── Deliver the code ──────────────────────────────────────────────────────
  if (devConsoleDelivery()) {
    // No provider key in development: the code is printed to this terminal
    // and nowhere else. It is still never persisted in the clear (see below).
    console.log(`[dev-otp] ${email} -> ${code}`)
  } else {
    try {
      const delivery = await getResend().emails.send({
        from:    configuredFromEmail('OTP emails'),
        to:      [email],
        subject: 'Your TechIT verification code',
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"></head>
            <body style="margin:0;padding:0;background:#09090f;font-family:'Inter',Arial,sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090f;padding:40px 0;">
                <tr><td align="center">
                  <table width="480" cellpadding="0" cellspacing="0" style="background:#111120;border-radius:16px;border:1px solid rgba(139,92,246,.18);overflow:hidden;">
                    <!-- Header -->
                    <tr>
                      <td style="background:linear-gradient(135deg,#5b21b6,#4f46e5);padding:32px 40px;">
                        <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">TECHIT NETWORK</p>
                        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,.7);letter-spacing:3px;font-family:monospace;">EMAIL VERIFICATION</p>
                      </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                      <td style="padding:40px;">
                        <p style="margin:0 0 8px;font-size:15px;color:#ededf5;">Your verification code:</p>
                        <!-- OTP box -->
                        <div style="margin:20px 0;background:#1a1a2e;border:1px solid rgba(139,92,246,.3);border-radius:12px;padding:24px;text-align:center;">
                          <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#a78bfa;font-family:monospace;">${code}</span>
                        </div>
                        <p style="margin:0 0 6px;font-size:13px;color:#8080a0;">This code expires in <strong style="color:#c4b5fd;">${EXPIRES} minutes</strong>.</p>
                        <p style="margin:0;font-size:13px;color:#8080a0;">If you didn't request this, you can safely ignore this email.</p>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td style="padding:20px 40px;border-top:1px solid rgba(139,92,246,.1);">
                        <p style="margin:0;font-size:12px;color:#5c5c78;text-align:center;">TechIT Network · Building the future, together</p>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
          </html>
        `,
      })
      assertEmailAccepted(delivery, 'OTP email')
    } catch (err) {
      console.error(JSON.stringify({
        event: 'otp_email_send_failed',
        requestId: req.id,
        error: describeEmailProviderError(err),
      }))
      return res.status(502).json({ error: 'Failed to send email. Please try again.' })
    }
  }

  // Never persist the six-digit OTP itself. A database read must not be
  // sufficient to complete email verification.
  // The platform authority store only persists rows with a stable id (the
  // flush upserts by record_id and drops id-less rows). Without an id the OTP
  // is never written, so verify-otp always answers "Code expired or not found".
  db.otps.push({ id: randomUUID(), email, codeHmac: codeHmac(code), expiresAt, sentAt, attempts: 0 })
  writeAuthorityDb(db)

  return res.json({ message: 'Verification code sent', expiresIn: EXPIRES * 60 })
}

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
export function verifyOtp(req, res) {
  const email = normalizeEmail(req.body.email)
  const { code } = req.body
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' })
  }

  const db  = readAuthorityDb()
  db.otps   = cleanExpired(db.otps)

  const record = db.otps.find(o => o.email === email)
  if (!record) {
    return res.status(400).json({ error: 'Code expired or not found. Please request a new one.' })
  }

  record.attempts += 1

  if (record.attempts > MAX_ATTEMPTS) {
    db.otps = db.otps.filter(o => o.email !== email)
    writeAuthorityDb(db)
    return res.status(400).json({ error: 'Too many attempts. Please request a new code.' })
  }

  // Legacy plaintext records are accepted during the rolling deployment and
  // are removed immediately after success/expiry. New writes are hash-only.
  const submittedCode = String(code).trim()
  const keyedHashMatches = typeof record.codeHmac === 'string'
    && constantTimeEqual(record.codeHmac, codeHmac(submittedCode))
  const legacyHashMatches = typeof record.codeHash === 'string'
    && constantTimeEqual(record.codeHash, codeHash(submittedCode))
  const legacyMatches = typeof record.code === 'string'
    && constantTimeEqual(record.code, submittedCode)
  if (!keyedHashMatches && !legacyHashMatches && !legacyMatches) {
    writeAuthorityDb(db)
    const left = MAX_ATTEMPTS - record.attempts
    return res.status(400).json({
      error: `Incorrect code. ${left} attempt${left !== 1 ? 's' : ''} remaining.`,
      attemptsLeft: left,
    })
  }

  // ✅ Valid — remove it so it can't be reused
  db.otps = db.otps.filter(o => o.email !== email)
  db.emailVerifications = cleanExpiredVerifications(db.emailVerifications || [])

  const verificationToken = `${randomUUID()}.${randomBytes(32).toString('base64url')}`
  const now = Date.now()
  db.emailVerifications = [
    ...db.emailVerifications.filter(r => r.email !== email),
    {
      id: randomUUID(),
      email,
      tokenHash: tokenHash(verificationToken),
      expiresAt: new Date(now + VERIFICATION_EXPIRES_MINUTES * 60 * 1000).toISOString(),
      consumedAt: null,
      createdAt: new Date(now).toISOString(),
    },
  ]
  writeAuthorityDb(db)

  return res.json({
    verified: true,
    verificationToken,
    expiresIn: VERIFICATION_EXPIRES_MINUTES * 60,
    message: 'Email verified successfully',
  })
}
