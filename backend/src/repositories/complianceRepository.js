// Row-level compliance store (§5 cutover).
//
// Consent records, data-subject requests, residency preferences, the public
// registries and subject export/erasure run directly against
// platform_collection_records instead of the whole-database snapshot. Enabled
// with COMPLIANCE_SOURCE=postgres; the snapshot fallback is retained in the
// service until the authority is deleted.
import {
  withPlatformTransaction,
  upsertRecord,
  listRecords,
  listRecordsForOwner,
  listRecordsAcrossCollections,
  deleteRecordsAcrossCollections,
} from './platformCollectionRepository.js'

// Mirrors the service's legacy OWNER_FIELDS so export/erasure stay equivalent.
const OWNER_FIELDS = ['ownerId', 'userId', 'founderId', 'collaboratorId', 'investorId', 'organizationId', 'createdBy']

export function complianceStoreEnabled() {
  return ['COMPLIANCE_SOURCE', 'COMPLIANCE_READ_SOURCE', 'COMPLIANCE_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function complianceFallbackEnabled() { return process.env.COMPLIANCE_FALLBACK_SQLITE !== 'false' }

export async function loadUserRecords(collectionName, userId) {
  return withPlatformTransaction(client => listRecordsForOwner(client, collectionName, userId, { ownerFields: ['userId', 'createdBy'] }))
}

export async function listCollection(collectionName) {
  return withPlatformTransaction(client => listRecords(client, collectionName, {}))
}

export async function insertRecord(collectionName, row) {
  return withPlatformTransaction(
    client => upsertRecord(client, collectionName, row, { operation: 'insert', idempotencyKey: `${collectionName}:${row.id}` }),
    { userId: row.userId || row.createdBy || null },
  )
}

export async function saveResidency(row) {
  return withPlatformTransaction(async client => {
    const result = await client.query(
      `SELECT * FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL AND (owner_id=$2 OR payload->>'userId'=$2) LIMIT 1`,
      ['dataResidencyPreferences', row.userId],
    )
    const existing = result.rows[0]?.payload
    const record = existing ? { ...row, id: result.rows[0].record_id } : row
    await upsertRecord(client, 'dataResidencyPreferences', record, { operation: existing ? 'update' : 'insert', idempotencyKey: `dataResidencyPreferences:${record.id}:${record.updatedAt}` })
    return record
  }, { userId: row.userId })
}

export async function exportOwnedRecords(userId) {
  return withPlatformTransaction(client => listRecordsAcrossCollections(client, userId, { ownerFields: OWNER_FIELDS }))
}

export async function eraseOwnedRecords(userId) {
  return withPlatformTransaction(client => deleteRecordsAcrossCollections(client, userId, { ownerFields: OWNER_FIELDS }))
}
