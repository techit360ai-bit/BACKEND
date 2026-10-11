// Row-level security-posture store (§5 cutover).
//
// The posture snapshot only needs to know whether the audit collections exist
// and the recent posture trend. Both are read/written directly against
// platform_collection_records instead of a whole-database snapshot. Enabled
// with POSTURE_SOURCE=postgres; the snapshot fallback is retained in the
// service until the authority is deleted.
import { getPlatformPool, withPlatformTransaction, upsertRecord } from './platformCollectionRepository.js'

const HISTORY = 'securityPostureHistory'

export function postureStoreEnabled() {
  return ['POSTURE_SOURCE', 'SECURITY_POSTURE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function postureFallbackEnabled() { return process.env.POSTURE_FALLBACK_SQLITE !== 'false' }

export async function hasCollectionRows(collectionName) {
  const result = await getPlatformPool().query(
    'SELECT 1 FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL LIMIT 1',
    [collectionName],
  )
  return result.rowCount > 0
}

export async function listPostureHistory(limit = 30) {
  const result = await getPlatformPool().query(
    'SELECT * FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT $2',
    [HISTORY, Math.max(1, Number(limit) || 30)],
  )
  return result.rows.map(row => ({ ...(row.payload || {}), id: row.record_id }))
}

export async function insertPostureHistory(row) {
  return withPlatformTransaction(client => upsertRecord(client, HISTORY, row, { operation: 'insert', idempotencyKey: `posture:${row.id}` }))
}
