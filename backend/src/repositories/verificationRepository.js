// Row-level verification / organization-claim store (§5 cutover).
//
// Verification profiles, evidence and requests, the trust/risk projections, the
// manual review + audit trails, the reverification notification tick and the
// organization create/claim/membership flows previously read and wrote the
// whole-DB snapshot. This repository resolves only the owner/addressed rows with
// bounded queries and writes back only the rows a mutation changed. Enabled with
// VERIFICATION_SOURCE=postgres; the snapshot fallback stays in the service until
// the authority is deleted.
import { withPlatformTransaction, getRecord, upsertRecord, listRecords, listRecordsForOwner, listRecordsByField } from './platformCollectionRepository.js'
import { runDatabaseAuthority } from '../config/database.js'
import { createId } from '../utils/api.js'

export function verificationStoreEnabled() {
  return ['VERIFICATION_SOURCE', 'VERIFICATION_READ_SOURCE', 'VERIFICATION_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function verificationFallbackEnabled() { return process.env.VERIFICATION_FALLBACK_SQLITE !== 'false' }

// Owner-scoped collections resolved for the addressed user, with the payload
// fields that may carry the owner id.
const OWNER_COLLECTIONS = {
  verificationProfiles: ['userId'],
  verificationEvidence: ['userId'],
  verificationRequests: ['userId'],
  riskProfiles: ['userId'],
  trustProfiles: ['userId'],
  userRoles: ['userId'],
  organizationMemberships: ['userId'],
}
// Collections the service writes back.
const WRITE_COLLECTIONS = [
  'verificationProfiles', 'verificationEvidence', 'verificationRequests', 'verificationAuditLogs', 'manualReviews',
  'trustProfiles', 'riskProfiles', 'organizations', 'organizationDomains', 'organizationMemberships',
  'organizationClaims', 'notifications', 'verificationNotificationRuns',
]

function mergeById(target, additions) {
  for (const row of additions) {
    if (!row) continue
    const index = target.findIndex(item => item.id === row.id)
    if (index >= 0) target[index] = row
    else target.push(row)
  }
  return target
}

async function buildVerificationDb(client, { userId = null, requestId = null, organizationId = null, targetUserId = null, organizations = false, analytics = false, adminQueue = false, reverification = false } = {}) {
  const db = {}
  for (const name of WRITE_COLLECTIONS) db[name] = []

  if (analytics) {
    db.capabilityAnalytics = await listRecords(client, 'capabilityAnalytics')
    db.authorizationAuditLogs = await listRecords(client, 'authorizationAuditLogs')
    db.verificationRequests = await listRecords(client, 'verificationRequests')
    db.verificationEvidence = await listRecords(client, 'verificationEvidence')
    return db
  }

  if (adminQueue) {
    db.verificationRequests = await listRecords(client, 'verificationRequests')
    db.verificationEvidence = await listRecords(client, 'verificationEvidence')
    db.manualReviews = await listRecords(client, 'manualReviews')
    return db
  }

  if (reverification) {
    db.verificationProfiles = await listRecords(client, 'verificationProfiles')
    const ownerIds = [...new Set(db.verificationProfiles.map(row => row.userId).filter(Boolean))]
    for (const id of ownerIds) mergeById(db.notifications, await listRecordsForOwner(client, 'notifications', id, { ownerFields: ['userId'] }))
    return db
  }

  // Resolve the request (any owner) so an admin review loads the right owner bundle.
  let ownerId = userId
  if (requestId) {
    const request = await getRecord(client, 'verificationRequests', requestId)
    if (request) { db.verificationRequests.push(request); ownerId ||= request.userId }
  }
  if (ownerId) {
    db.profiles = [await getRecord(client, 'profiles', ownerId)].filter(Boolean)
    for (const name of Object.keys(OWNER_COLLECTIONS)) mergeById(db[name], await listRecordsForOwner(client, name, ownerId, { ownerFields: OWNER_COLLECTIONS[name] }))
  } else {
    db.profiles = []
  }

  if (organizations) {
    db.organizations = await listRecords(client, 'organizations')
    db.organizationDomains = await listRecords(client, 'organizationDomains')
  }
  if (organizationId) {
    mergeById(db.organizations, [await getRecord(client, 'organizations', organizationId)])
    mergeById(db.organizationDomains, await listRecords(client, 'organizationDomains'))
    mergeById(db.organizationMemberships, await listRecordsByField(client, 'organizationMemberships', 'organizationId', organizationId))
  }
  if (targetUserId) {
    db.users ||= []
    mergeById(db.users, [await getRecord(client, 'users', targetUserId)])
  }
  return db
}

async function persistChanges(client, db, originals) {
  for (const name of WRITE_COLLECTIONS) {
    for (const row of db[name] || []) {
      if (!row) continue
      if (!row.id) row.id = createId('verification_row')
      const key = `${name}:${row.id}`
      const next = JSON.stringify(row)
      if (originals.get(key) === next) continue
      await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
    }
  }
}

// Run a read against a bounded snapshot built from the row-level store.
export async function runVerificationRead(options, read) {
  return withPlatformTransaction(async client => {
    const db = await buildVerificationDb(client, options)
    return runDatabaseAuthority(db, async () => read())
  }, { userId: options.userId || null })
}

// Run a sync mutation against a bounded snapshot and persist only what changed.
export async function applyVerificationMutation(options, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildVerificationDb(client, options)
    const originals = new Map()
    for (const name of WRITE_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runDatabaseAuthority(db, async () => mutate())
    await persistChanges(client, db, originals)
    return result
  }, { userId: options.userId || null })
}
