import { readAuthorityDb } from '../config/database.js'
import { withPlatformTransaction, getRecord, upsertRecord, listRecords, listRecordsForOwner } from './platformCollectionRepository.js'

const collections = ['supportCases','supportMessages','supportEvents','supportAssignments','supportFeedback','supportAttachments','supportAuditLogs','supportSettings','supportSlaPolicies','supportCategories','supportTeams','supportKnowledgeBase','supportTemplates','consentRecords','dataSubjectRequests','dataResidencyPreferences','subprocessors','breachRecords','evidenceObjects','adminUsers','adminTelemetrySnapshots']
const enabled = () => process.env.OPERATIONAL_SOURCE === 'postgres' || process.env.OPERATIONAL_WRITE_SOURCE === 'postgres' || process.env.OPERATIONAL_READ_SOURCE === 'postgres'
const fallback = () => process.env.OPERATIONAL_FALLBACK_SQLITE !== 'false'
export async function syncOperationalState(actorId = null, selected = collections) { if (!enabled()) return { enabled: false }; const db = readAuthorityDb(); return withPlatformTransaction(async client => { let records = 0; for (const collectionName of selected) for (const row of (db[collectionName] || []).filter(item => !actorId || item.userId === actorId || item.ownerId === actorId || item.createdBy === actorId || item.actorId === actorId || collectionName === 'supportSettings')) { await upsertRecord(client, collectionName, row, { operation: 'replay', idempotencyKey: `operational:${collectionName}:${row.id}:${row.updatedAt || row.createdAt || ''}` }); records++ } return { enabled: true, records } }, { userId: actorId }) }
export async function listOperationalState(actorId, collectionName) { if (!enabled()) return null; return withPlatformTransaction(client => listRecords(client, collectionName, { ownerId: actorId })) }
export function operationalStateEnabled() { return enabled() }
export function operationalStateFallbackEnabled() { return fallback() }

// --- Row-level primitives for the evidence/verification service path --------
export async function loadOperationalStateById(collectionName, id) {
  return withPlatformTransaction(client => getRecord(client, collectionName, id))
}
export async function listOperationalStateForOwner(collectionName, ownerId, ownerFields = ['userId']) {
  return withPlatformTransaction(client => listRecordsForOwner(client, collectionName, ownerId, { ownerFields }))
}
export async function saveOperationalStateRow(collectionName, row) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, collectionName, row.id)
    await upsertRecord(client, collectionName, row, {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `operational-row:${collectionName}:${row.id}:${row.updatedAt || row.createdAt || Date.now()}`,
    })
    return row
  }, { userId: row.userId || row.ownerId || null })
}
