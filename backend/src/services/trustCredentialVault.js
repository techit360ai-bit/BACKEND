// Encrypted-at-rest storage for founder-supplied read-only provider credentials
// (WS3). Mirrors the GITHUB_TOKEN_ENCRYPTION_KEY pattern: AES-256-GCM with a
// sha256-derived key and a `iv.tag.ciphertext` base64url envelope.
//
// Invariants:
// - Plaintext credentials are never logged, projected, or returned by any API.
// - The encryption key is env-only; absence fails closed.
// - Only read-only provider keys are accepted (enforced by the revenue service).

import crypto from 'node:crypto'

const KEY_ENV = 'TRUST_CREDENTIAL_ENCRYPTION_KEY'
const MIN_KEY_LENGTH = 32

export function credentialVaultConfigured(env = process.env) {
  return String(env[KEY_ENV] || '').trim().length >= MIN_KEY_LENGTH
}

function deriveKey(env) {
  const secret = String(env[KEY_ENV] || '').trim()
  if (secret.length < MIN_KEY_LENGTH) throw new Error('trust_credential_vault_not_configured')
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptCredential(plaintext, { env = process.env } = {}) {
  const value = String(plaintext ?? '')
  if (!value) throw new Error('credential_required')
  const key = deriveKey(env)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}

// Returns null on any tamper/format/key error (never throws into request paths).
export function decryptCredential(envelope, { env = process.env } = {}) {
  try {
    const [ivPart, tagPart, dataPart] = String(envelope || '').split('.')
    if (!ivPart || !tagPart || !dataPart) return null
    const key = deriveKey(env)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

// Never expose even the shape of a secret. Used for API responses.
export function describeCredential(provider, { scopes = [], mode = null, created_at = null, last_synced_at = null } = {}) {
  return {
    provider,
    scopes: Array.isArray(scopes) ? scopes : [],
    mode: mode || null,
    stored: true,
    created_at: created_at || null,
    last_synced_at: last_synced_at || null,
    secret_stored: false,
    raw_payload_stored: false,
  }
}
