// Row-level password-reset store (§5 cutover).
//
// Password-reset records are keyed by email (a forgot-password request is
// pre-auth) and consumed by (email, tokenHash). They used to be read and written
// from the whole-DB snapshot, so a pre-auth request loaded every row in the
// platform. These helpers scope reads/writes to the email. Gated by
// IDENTITY_WRITE_SOURCE=postgres; IDENTITY_WRITE_FALLBACK_SQLITE keeps the
// snapshot until the authority is deleted.
import { withPlatformTransaction, listRecordsByField, upsertRecord, deleteRecord } from './platformCollectionRepository.js'

export function passwordResetStoreEnabled() { return process.env.IDENTITY_WRITE_SOURCE === 'postgres' }
export function passwordResetFallbackEnabled() { return process.env.IDENTITY_WRITE_FALLBACK_SQLITE !== 'false' }

// Replace any previous reset for the email with the freshly minted one.
export async function replacePasswordReset(record) {
  return withPlatformTransaction(async client => {
    for (const existing of await listRecordsByField(client, 'passwordResets', 'email', record.email)) {
      if (existing.id) await deleteRecord(client, 'passwordResets', existing.id)
    }
    await upsertRecord(client, 'passwordResets', record, { operation: 'insert', idempotencyKey: `pwreset:${record.id}` })
  })
}

// Find an unconsumed, unexpired reset for (email, tokenHash), mark it consumed
// and return it. Expired/consumed rows for the email are pruned as a side effect.
export async function consumePasswordReset(email, tokenHash, consumedAt) {
  return withPlatformTransaction(async client => {
    const rows = await listRecordsByField(client, 'passwordResets', 'email', email)
    const now = Date.now()
    let match = null
    for (const row of rows) {
      const expired = new Date(row.expiresAt).getTime() <= now
      if (row.consumedAt || expired) { if (row.id) await deleteRecord(client, 'passwordResets', row.id); continue }
      if (row.tokenHash === tokenHash) match = row
    }
    if (!match) return null
    const next = { ...match, consumedAt }
    await upsertRecord(client, 'passwordResets', next, { operation: 'update', idempotencyKey: `pwreset-consume:${match.id}` })
    return next
  })
}
