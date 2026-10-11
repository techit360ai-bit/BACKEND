// Row-level support store (§5 cutover).
//
// Support cases and their children, knowledge base/templates, SLA/category/team
// configuration, incidents/signals and the user contact lookup for notifications
// live in platform_collection_records rather than the whole-database snapshot.
// The loader resolves the caller/administrator-scoped cases (or the addressed
// cases) plus the global config and the case owners' cross-domain billing rows,
// then writes back only the rows a mutation changed. Enabled with
// SUPPORT_SOURCE=postgres; the snapshot fallback is retained in the service
// until the authority is deleted.
import { withPlatformTransaction, getRecord, upsertRecord, listRecords, listRecordsForOwner, listRecordsByField } from './platformCollectionRepository.js'
import { runDatabaseAuthority } from '../config/database.js'
import { createId } from '../utils/api.js'

export function supportStoreEnabled() {
  return ['SUPPORT_SOURCE', 'SUPPORT_READ_SOURCE', 'SUPPORT_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function supportFallbackEnabled() { return process.env.SUPPORT_FALLBACK_SQLITE !== 'false' }

// Child rows keyed by the parent case id.
const CASE_CHILD_COLLECTIONS = ['supportMessages', 'supportEvents', 'supportAuditLogs', 'supportAttachments', 'supportAssignments', 'supportFeedback']
// Admin-global configuration, catalogue and incident rows.
const GLOBAL_SUPPORT_COLLECTIONS = ['supportSettings', 'supportSlaPolicies', 'supportCategories', 'supportTeams', 'supportKnowledgeBase', 'supportTemplates', 'supportIncidents', 'supportIntelligenceSignals', 'adminUsers']
// Cross-domain rows read by search/diagnostics/corrective actions, with the
// payload fields each may use to identify its owner.
const SUBJECT_OWNER_FIELDS = {
  users: ['id', 'userId'],
  profiles: ['id', 'userId'],
  projects: ['ownerId', 'userId'],
  paymentIntents: ['userId'],
  subscriptions: ['userId'],
  walletAccounts: ['userId'],
  creditLedger: ['userId'],
}
// Collections the service writes back.
const WRITE_COLLECTIONS = [
  'supportCases', 'supportMessages', 'supportEvents', 'supportAuditLogs', 'supportAttachments', 'supportAssignments', 'supportFeedback', 'supportLocks',
  'supportSettings', 'supportSlaPolicies', 'supportCategories', 'supportTeams', 'supportKnowledgeBase', 'supportTemplates', 'supportIncidents', 'supportIntelligenceSignals',
  'notifications', 'walletAccounts', 'creditLedger',
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

async function buildSupportDb(client, { userId = null, admin = false, caseIds = [], allCases = false } = {}) {
  const db = {}
  const cases = allCases ? (admin ? await listRecords(client, 'supportCases') : (userId ? await listRecordsForOwner(client, 'supportCases', userId, { ownerFields: ['userId'] }) : [])) : []
  for (const id of caseIds) mergeById(cases, [await getRecord(client, 'supportCases', id)])
  db.supportCases = cases
  const ids = cases.map(row => row.id)
  for (const name of CASE_CHILD_COLLECTIONS) {
    db[name] = []
    for (const id of ids) mergeById(db[name], await listRecordsByField(client, name, 'caseId', id))
  }
  for (const name of GLOBAL_SUPPORT_COLLECTIONS) db[name] = await listRecords(client, name)
  const subjectIds = [...new Set(cases.map(row => row.userId).filter(Boolean))]
  for (const [name, fields] of Object.entries(SUBJECT_OWNER_FIELDS)) {
    if (admin && allCases) db[name] = await listRecords(client, name)
    else {
      db[name] = []
      for (const id of subjectIds) mergeById(db[name], await listRecordsForOwner(client, name, id, { ownerFields: fields }))
    }
  }
  db.notifications = userId ? await listRecordsForOwner(client, 'notifications', userId, { ownerFields: ['userId'] }) : []
  return db
}

async function persistChanges(client, db, originals) {
  for (const name of WRITE_COLLECTIONS) {
    for (const row of db[name] || []) {
      if (!row) continue
      if (!row.id) row.id = createId('support_row')
      const key = `${name}:${row.id}`
      const next = JSON.stringify(row)
      if (originals.get(key) === next) continue
      await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
    }
  }
}

// Run a read against a bounded snapshot built from the row-level store.
export async function runSupportRead(options, read) {
  return withPlatformTransaction(async client => {
    const db = await buildSupportDb(client, options)
    return runDatabaseAuthority(db, async () => read())
  }, { userId: options.userId || null })
}

// Run a sync mutation against a bounded snapshot and persist only what changed.
export async function applySupportMutation(options, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildSupportDb(client, options)
    const originals = new Map()
    for (const name of WRITE_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runDatabaseAuthority(db, async () => mutate())
    await persistChanges(client, db, originals)
    return result
  }, { userId: options.userId || null })
}
