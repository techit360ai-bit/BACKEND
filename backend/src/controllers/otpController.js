import { Resend } from 'resend'
import { randomInt } from 'crypto'
import { readDb, writeDb } from '../config/database.js'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM      = process.env.FROM_EMAIL         || 'TechIT <onboarding@resend.dev>'
const EXPIRES   = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10)
const RESEND_COOLDOWN_SECONDS = 60   // minimum gap between sends per email
const MAX_ATTEMPTS = 5               // wrong guesses before OTP is invalidated

// ── helpers ──────────────────────────────────────────────────────────────────

function generateCode() {
  // 6-digit zero-padded string
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

function cleanExpired(otps) {
  const now = Date.now()
  return otps.filter(o => new Date(o.expiresAt).getTime() > now)
}

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
export async function sendOtp(req, res) {
  const { email } = req.body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' })
  }

  const db  = readDb()
  const now = Date.now()

  // Purge expired records first
  db.otps = cleanExpired(db.otps)

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

  db.otps.push({ email, code, expiresAt, sentAt, attempts: 0 })
  writeDb(db)

  // ── Send email via Resend ─────────────────────────────────────────────────
  try {
    await resend.emails.send({
      from:    FROM,
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
  } catch (err) {
    console.error('[OTP] Resend error:', err.message)
    return res.status(502).json({ error: 'Failed to send email. Please try again.' })
  }

  return res.json({ message: 'Verification code sent', expiresIn: EXPIRES * 60 })
}

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
export function verifyOtp(req, res) {
  const { email, code } = req.body
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' })
  }

  const db  = readDb()
  db.otps   = cleanExpired(db.otps)

  const record = db.otps.find(o => o.email === email)
  if (!record) {
    return res.status(400).json({ error: 'Code expired or not found. Please request a new one.' })
  }

  record.attempts += 1

  if (record.attempts > MAX_ATTEMPTS) {
    db.otps = db.otps.filter(o => o.email !== email)
    writeDb(db)
    return res.status(400).json({ error: 'Too many attempts. Please request a new code.' })
  }

  if (record.code !== String(code).trim()) {
    writeDb(db)
    const left = MAX_ATTEMPTS - record.attempts
    return res.status(400).json({
      error: `Incorrect code. ${left} attempt${left !== 1 ? 's' : ''} remaining.`,
      attemptsLeft: left,
    })
  }

  // ✅ Valid — remove it so it can't be reused
  db.otps = db.otps.filter(o => o.email !== email)
  writeDb(db)

  return res.json({ verified: true, message: 'Email verified successfully' })
}
