// Row-level LinkedIn trust-connector store (§5 cutover).
//
// The LinkedIn OIDC callback validates a short-lived oauth state, then upserts
// the caller's connector. It used to read/update the whole-DB snapshot. These
// helpers keep the state + connector rows bounded by owner. Gated by
// TRUST_SOURCE=postgres (LinkedIn is a Trust Engine surface); snapshot fallback
// stays until the authority is deleted.
import { withPlatformTransaction, listRecordsByField, upsertRecord, deleteRecord, deleteRecordsForOwner } from './platformCollectionRepository.js'

export function linkedinStoreEnabled() {
  return process.env.TRUST_SOURCE === 'postgres' || process.env.TRUST_READ_SOURCE === 'postgres' || process.env.TRUST_WRITE_SOURCE === 'postgres'
}
export function linkedinFallbackEnabled() { return process.env.TRUST_READ_FALLBACK_SQLITE !== 'false' && process.env.TRUST_WRITE_FALLBACK_SQLITE !== 'false' }

const STATE_TTL_MS = 10 * 60 * 1000

export async function consumeLinkedinOauthState(state) {
  return withPlatformTransaction(async client => {
    const rows = await listRecordsByField(client, 'linkedinOauthStates', 'state', state)
    const entry = rows.find(row => new Date(row.createdAt).getTime() > Date.now() - STATE_TTL_MS)
    if (!entry) return null
    if (entry.id) await deleteRecord(client, 'linkedinOauthStates', entry.id)
    return entry
  })
}

export async function saveLinkedinConnection(connection) {
  return withPlatformTransaction(async client => {
    await deleteRecordsForOwner(client, 'linkedinConnections', connection.userId, { ownerFields: ['userId'] })
    await upsertRecord(client, 'linkedinConnections', connection, { operation: 'insert', idempotencyKey: `${connection.id}:insert` })
  }, { userId: connection.userId })
}
