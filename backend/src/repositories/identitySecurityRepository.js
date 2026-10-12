import { readAuthorityDb } from '../config/database.js'
import { withPlatformTransaction, getRecord, upsertRecord, listRecords, listRecordsForOwner } from './platformCollectionRepository.js'

const collections = ['userRoles', 'roleProfiles', 'activeContexts', 'trustProfiles', 'verificationProfiles', 'verificationRequests', 'verificationEvidence', 'riskProfiles', 'mfaProfiles', 'organizationMemberships']
const enabled = () => process.env.IDENTITY_SECURITY_SOURCE === 'postgres' || process.env.IDENTITY_READ_SOURCE === 'postgres' || process.env.IDENTITY_WRITE_SOURCE === 'postgres'
const fallback = () => process.env.IDENTITY_SECURITY_FALLBACK_SQLITE !== 'false'

export async function syncIdentitySecurity(userId) {
  if (!enabled()) return { enabled: false }
  const db = readAuthorityDb()
  return withPlatformTransaction(async client => {
    let records = 0
    for (const collectionName of collections) {
      for (const row of (db[collectionName] || []).filter(item => item.userId === userId || item.ownerId === userId || item.createdBy === userId)) {
        await upsertRecord(client, collectionName, row, { operation: 'replay', idempotencyKey: `identity-security:${collectionName}:${row.id}:${row.updatedAt || row.createdAt || ''}` })
        records += 1
      }
    }
    return { enabled: true, userId, records }
  }, { userId })
}

export async function listIdentitySecurity(userId, collectionName) {
  if (!enabled()) return null
  return withPlatformTransaction(client => listRecords(client, collectionName, { ownerId: userId }))
}

export function identitySecurityEnabled() { return enabled() }
export function identitySecurityFallbackEnabled() { return fallback() }

// --- Row-level primitives for the identity/security service path ------------
export async function loadIdentitySecurityById(collectionName, id) {
  return withPlatformTransaction(client => getRecord(client, collectionName, id))
}

export async function listIdentitySecurityForOwner(collectionName, userId, ownerFields = ['userId']) {
  return withPlatformTransaction(client => listRecordsForOwner(client, collectionName, userId, { ownerFields }))
}

export async function saveIdentitySecurityRow(collectionName, row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, collectionName, row.id)
    await upsertRecord(client, collectionName, row, {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `identity-security-row:${collectionName}:${row.id}:${row.updatedAt || row.createdAt || Date.now()}`,
    })
    return row
  }, { userId: row.userId || row.ownerId || null })
}
