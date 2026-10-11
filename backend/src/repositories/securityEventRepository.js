// Row-level security-event audit store (§5 cutover).
//
// Replaces the whole-DB snapshot read/write in securityEventService when
// SECURITY_EVENT_SOURCE=postgres. Rows live in platform_collection_records
// (indexed by collection_name), so writes and the admin listing never load the
// entire platform database. The sqlite/json fallback stays for local dev until
// the snapshot authority is deleted.
import { getPlatformPool, withPlatformTransaction, upsertRecord } from './platformCollectionRepository.js'

const COLLECTION = 'securityEvents'

const enabled = () => process.env.SECURITY_EVENT_SOURCE === 'postgres' || process.env.SECURITY_EVENTS_SOURCE === 'postgres'
const fallback = () => process.env.SECURITY_EVENT_FALLBACK_SQLITE !== 'false'

export function securityEventStoreEnabled() { return enabled() }
export function securityEventFallbackEnabled() { return fallback() }

export async function insertSecurityEvent(row, { client } = {}) {
  const write = tx => upsertRecord(tx, COLLECTION, row, { operation: 'insert', idempotencyKey: `security-event:${row.id}` })
  if (client) return write(client)
  return withPlatformTransaction(write)
}

export async function listRecentSecurityEvents(limit = 100) {
  const count = Math.max(1, Math.min(1000, Number(limit) || 100))
  const result = await getPlatformPool().query(
    `SELECT payload, created_at FROM platform_collection_records
     WHERE collection_name=$1 AND deleted_at IS NULL
     ORDER BY updated_at DESC LIMIT $2`,
    [COLLECTION, count],
  )
  return result.rows.map(row => ({ ...(row.payload || {}), createdAt: row.payload?.createdAt || row.created_at }))
}
