import crypto from 'node:crypto'
import { signJwt, verifyJwt } from './jwtKeyService.js'
import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const issuer = encodeURIComponent(process.env.MFA_ISSUER || 'TechIT Network')

function base32(buffer) {
  let bits = ''; for (const byte of buffer) bits += byte.toString(2).padStart(8, '0')
  let out = ''; for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]
  return out
}
function decodeBase32(value) {
  const bits = [...String(value).replace(/=+$/, '').toUpperCase()].map(char => ALPHABET.indexOf(char).toString(2).padStart(5, '0')).join('')
  return Buffer.from((bits.match(/.{8}/g) || []).map(byte => parseInt(byte, 2)))
}
function totp(secret, time = Date.now()) {
  const counter = Math.floor(time / 30000); const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(counter))
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(buffer).digest(); const offset = digest[digest.length - 1] & 15
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}
function encrypt(value) {
  const key = crypto.createHash('sha256').update(process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || '').digest()
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(value), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}
function decrypt(value) {
  const [iv, tag, payload] = String(value).split('.'); const key = crypto.createHash('sha256').update(process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || '').digest()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url')); decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString()
}

export function beginMfaEnrollment(userId, email) {
  const secret = base32(crypto.randomBytes(20))
  return updateAuthorityDb(db => {
    const rows = db.mfaProfiles || (db.mfaProfiles = []); let row = rows.find(item => item.userId === userId)
    const next = { id: row?.id || createId('mfa'), userId, encryptedSecret: encrypt(secret), enabled: false, createdAt: row?.createdAt || nowIso(), updatedAt: nowIso() }
    if (row) Object.assign(row, next); else { row = next; rows.push(row) }
    return { ok: true, secret, otpauthUrl: `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}&digits=6&period=30` }
  })
}
export function verifyMfa(userId, code, enable = false) {
  return updateAuthorityDb(db => {
    const profile = (db.mfaProfiles || []).find(row => row.userId === userId)
    if (!profile) return { ok: false, error: 'mfa_not_enrolled' }
    const normalizedCode = String(code || '').replace(/\D/g, '')
    if (normalizedCode.length !== 6) return { ok: false, error: 'invalid_mfa_code' }
    let valid = false; for (const skew of [-30000, 0, 30000]) valid ||= crypto.timingSafeEqual(Buffer.from(totp(decrypt(profile.encryptedSecret), Date.now() + skew)), Buffer.from(normalizedCode))
    if (!valid) return { ok: false, error: 'invalid_mfa_code' }
    if (enable) { profile.enabled = true; profile.verifiedAt = nowIso(); profile.updatedAt = nowIso() }
    const token = signJwt({ sub: userId, purpose: 'mfa', amr: ['pwd', 'otp'] }, { expiresIn: '10m' })
    return { ok: true, enabled: profile.enabled, assertion: token, expiresIn: 600 }
  })
}
export function verifyMfaAssertion(userId, assertion) {
  if (!assertion) return false
  try { const claims = verifyJwt(assertion); return claims.sub === userId && claims.purpose === 'mfa' } catch { return false }
}
export function mfaStatus(userId) { const profile = (readAuthorityDb().mfaProfiles || []).find(row => row.userId === userId); return { enabled: Boolean(profile?.enabled), verifiedAt: profile?.verifiedAt || null } }
