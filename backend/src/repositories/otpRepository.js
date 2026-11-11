// Row-level OTP / email-verification store (§5 cutover).
//
// OTP rows are keyed by email (a login can be requested before any session
// exists) and verification tokens are keyed by the same email. Both used to be
// read/written from the whole-DB snapshot so a pre-auth request loaded every
// row in the platform. These helpers scope reads/writes to the email. Gated by
// OTP_SOURCE=postgres; OTP_FALLBACK_SQLITE keeps the snapshot until deletion.
import { withPlatformTransaction, listRecordsByField, upsertRecord, deleteRecord } from './platformCollectionRepository.js'

export function otpStoreEnabled() {
  return process.env.OTP_SOURCE === 'postgres' || process.env.OTP_READ_SOURCE === 'postgres' || process.env.OTP_WRITE_SOURCE === 'postgres'
}
export function otpFallbackEnabled() { return process.env.OTP_FALLBACK_SQLITE !== 'false' }

// Live (non-expired) OTP for the email; expired rows are pruned as a side effect.
export async function loadOtp(email) {
  return withPlatformTransaction(async client => {
    const now = Date.now()
    let live = null
    for (const row of await listRecordsByField(client, 'otps', 'email', email)) {
      if (new Date(row.expiresAt).getTime() > now) live = live || row
      else if (row.id) await deleteRecord(client, 'otps', row.id)
    }
    return live
  })
}

// Replace the previous OTP for the email (a fresh code supersedes any old one).
export async function replaceOtp(row) {
  return withPlatformTransaction(async client => {
    for (const existing of await listRecordsByField(client, 'otps', 'email', row.email)) if (existing.id) await deleteRecord(client, 'otps', existing.id)
    await upsertRecord(client, 'otps', row, { operation: 'insert', idempotencyKey: `otp:${row.email}:${row.sentAt}` })
  })
}

export async function deleteOtp(email) {
  return withPlatformTransaction(async client => {
    for (const existing of await listRecordsByField(client, 'otps', 'email', email)) if (existing.id) await deleteRecord(client, 'otps', existing.id)
  })
}

export async function saveEmailVerification(row) {
  return withPlatformTransaction(async client => {
    for (const existing of await listRecordsByField(client, 'emailVerifications', 'email', row.email)) if (existing.id) await deleteRecord(client, 'emailVerifications', existing.id)
    await upsertRecord(client, 'emailVerifications', row, { operation: 'insert', idempotencyKey: `ev:${row.id}` })
  })
}

// Look up the live (unconsumed, unexpired) verification row for an email whose
// token hash matches. Read-only: the caller consumes it only after the account
// was created, so a failed signup never burns a valid token.
export async function loadEmailVerification(email, tokenHash) {
  return withPlatformTransaction(async client => {
    const now = Date.now()
    for (const row of await listRecordsByField(client, 'emailVerifications', 'email', email)) {
      if (row.tokenHash === tokenHash && !row.consumedAt && new Date(row.expiresAt).getTime() > now) return row
    }
    return null
  })
}

export async function consumeEmailVerificationRow(row) {
  return withPlatformTransaction(async client => {
    await upsertRecord(client, 'emailVerifications', { ...row, consumedAt: new Date().toISOString() }, { operation: 'update', idempotencyKey: `ev-consume:${row.id}` })
  })
}
