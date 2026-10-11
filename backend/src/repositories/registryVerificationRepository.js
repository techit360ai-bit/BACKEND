// Row-level registry/domain verification store (§5 cutover).
//
// Organization registry checks, domain challenges, verified domains, manual
// reviews and the admin operations view run directly against
// platform_collection_records instead of the whole-database snapshot. The
// country registry catalog is no longer stored at all — it is derived from the
// in-tree constants + environment in the service. Enabled with
// REGISTRY_SOURCE=postgres; the snapshot fallback is retained in the service.
import { withPlatformTransaction, getRecord, upsertRecord, listRecords, listRecordsForOwner } from './platformCollectionRepository.js'

const ORGANIZATIONS = 'organizations'
const MEMBERSHIPS = 'organizationMemberships'
const DOMAINS = 'organizationDomains'

export function registryStoreEnabled() {
  return ['REGISTRY_SOURCE', 'REGISTRY_READ_SOURCE', 'REGISTRY_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function registryFallbackEnabled() { return process.env.REGISTRY_FALLBACK_SQLITE !== 'false' }

export async function loadOrganization(organizationId) {
  return withPlatformTransaction(client => getRecord(client, ORGANIZATIONS, organizationId))
}

export async function actorMembership(userId, organizationId) {
  return withPlatformTransaction(async client => {
    const rows = await listRecordsForOwner(client, MEMBERSHIPS, userId, { ownerFields: ['userId'] })
    return rows.find(row => row.organizationId === organizationId && row.status === 'active' && ['owner', 'admin', 'authorized_representative'].includes(row.role)) || null
  })
}

export async function insertRow(collectionName, row, { userId = null } = {}) {
  return withPlatformTransaction(
    client => upsertRecord(client, collectionName, row, { operation: 'insert', idempotencyKey: `${collectionName}:${row.id}` }),
    { userId: userId || row.requestedBy || row.userId || row.adminId || row.createdBy || null },
  )
}

export async function findRow(collectionName, rowId) {
  return withPlatformTransaction(client => getRecord(client, collectionName, rowId))
}

export async function saveRow(collectionName, row, { userId = null } = {}) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, collectionName, row.id)
    await upsertRecord(client, collectionName, row, {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `${collectionName}:${row.id}:${row.updatedAt || Date.now()}`,
    })
    return row
  }, { userId: userId || row.requestedBy || row.userId || row.adminId || row.createdBy || null })
}

export async function listAllRows(collectionName) {
  return withPlatformTransaction(client => listRecords(client, collectionName, {}))
}

export async function upsertOrganizationDomain(row) {
  return withPlatformTransaction(async client => {
    const rows = await listRecordsForOwner(client, DOMAINS, row.organizationId, { ownerFields: ['organizationId'] })
    const existing = rows.find(item => item.organizationId === row.organizationId && item.domain === row.domain)
    const record = existing ? { ...row, id: existing.id } : row
    await upsertRecord(client, DOMAINS, record, { operation: existing ? 'update' : 'insert', idempotencyKey: `${DOMAINS}:${record.id}:${record.updatedAt}` })
    return record
  }, { userId: row.verifiedBy || null })
}
