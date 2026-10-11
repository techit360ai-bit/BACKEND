// Row-level session-claims store (§5 cutover).
//
// The access-token claims previously read the whole-database snapshot for the
// user's active context and active subscription. This repository resolves those
// two rows with bounded per-owner queries instead. It is gated by the identity
// source flags (IDENTITY_READ_SOURCE/IDENTITY_WRITE_SOURCE=postgres) so the
// claims follow the same authority as the identity bundle; the snapshot read is
// retained in sessionService as the fallback.
import { withPlatformTransaction, listRecordsForOwner } from './platformCollectionRepository.js'

export function sessionClaimsEnabled() {
  return process.env.IDENTITY_READ_SOURCE === 'postgres' || process.env.IDENTITY_WRITE_SOURCE === 'postgres'
}
export function sessionClaimsFallbackEnabled() {
  return process.env.IDENTITY_READ_FALLBACK_SQLITE !== 'false'
}

export async function loadActiveContext(userId) {
  return withPlatformTransaction(async client => {
    const rows = await listRecordsForOwner(client, 'activeContexts', userId, { ownerFields: ['userId'] })
    return rows.find(row => row.status === 'active') || null
  })
}

export async function loadActiveSubscription(userId) {
  return withPlatformTransaction(async client => {
    const rows = await listRecordsForOwner(client, 'subscriptions', userId, { ownerFields: ['userId'] })
    return rows.find(row => ['active', 'trialing'].includes(String(row.status || '').toLowerCase())) || null
  })
}
