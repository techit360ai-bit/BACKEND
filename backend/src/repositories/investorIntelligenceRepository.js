// Row-level investor store (§5 cutover 2c): investor intelligence + trust access.
//
// Both surfaces used to run against the whole-DB snapshot at the top of every
// handler. This store resolves only the investor-authorized startup bundle (the
// watchlist / deal-flow / relationship rows, the referenced projects and their
// progress, mentorship and activity children, and the investor's own
// intelligence snapshots) plus the trust-access request rows the investor or
// founder can see. Gated by INVESTOR_SOURCE / INVESTOR_READ_SOURCE /
// INVESTOR_WRITE_SOURCE=postgres; the snapshot path stays as the fallback until
// the authority is deleted.
import {
  withPlatformTransaction,
  getRecord,
  upsertRecord,
  deleteRecord,
  listRecordsForOwner,
  listRecordsByIds,
  listRecordsByFieldIn,
  listRecordsLimited,
} from './platformCollectionRepository.js'
import { runBoundedDatabase } from '../config/database.js'

export function investorStoreEnabled() {
  return ['INVESTOR_SOURCE', 'INVESTOR_READ_SOURCE', 'INVESTOR_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function investorFallbackEnabled(kind = 'READ') {
  return process.env.INVESTOR_FALLBACK_SQLITE !== 'false' && process.env[`INVESTOR_${kind}_FALLBACK_SQLITE`] !== 'false'
}
export function investorCandidateLimit() {
  return Math.max(50, Number(process.env.INVESTOR_CANDIDATE_LIMIT || process.env.DOMAIN_CANDIDATE_LIMIT || 500))
}

// Collections owned by the investor surface, with every payload field that may
// carry the investor id.
const INVESTOR_OWNER_FIELDS = {
  investorWatchlists: ['investorId', 'ownerId', 'userId'],
  dealFlowSnapshots: ['investorId', 'ownerId', 'userId'],
  investments: ['investorId', 'userId', 'ownerId'],
  portfolioInvestments: ['investorId', 'userId', 'ownerId'],
  investorPortfolio: ['investorId', 'userId', 'ownerId'],
  investorRelationships: ['investorId', 'userId', 'ownerId'],
  dealRooms: ['investorId', 'ownerId', 'userId'],
  dataRooms: ['investorId', 'ownerId', 'userId'],
  investorIntelligenceSnapshots: ['investorId'],
  investorIntelligenceAudits: ['investorId'],
}
const TRUST_ACCESS_OWNER_FIELDS = ['investorId', 'founderId', 'userId', 'ownerId']
const AUTHORIZED_PROJECT_COLLECTIONS = ['investorWatchlists', 'dealFlowSnapshots', 'investments', 'portfolioInvestments', 'investorPortfolio', 'investorRelationships', 'dealRooms', 'dataRooms']

function mergeById(target, additions) {
  for (const row of additions || []) {
    if (!row) continue
    const index = target.findIndex(item => item.id === row.id)
    if (index >= 0) target[index] = row
    else target.push(row)
  }
  return target
}

async function buildInvestorDb(client, { userId = null, intelligence = false, trustAccess = false, startupId = null, requestId = null } = {}) {
  const db = {
    projects: [], milestones: [], mentorshipRooms: [], mentorshipMentees: [], mentorshipTasks: [],
    projectActivities: [], startupActivities: [], recommendationEvents: [],
    investorWatchlists: [], dealFlowSnapshots: [], investments: [], portfolioInvestments: [], investorPortfolio: [],
    investorRelationships: [], dealRooms: [], dataRooms: [],
    investorIntelligenceSnapshots: [], investorIntelligenceAudits: [],
    investorTrustAccessRequests: [], investorTrustAccessHistory: [], notifications: [],
  }
  if (!userId) return db
  const limit = investorCandidateLimit()
  for (const [name, ownerFields] of Object.entries(INVESTOR_OWNER_FIELDS)) {
    mergeById(db[name], await listRecordsForOwner(client, name, userId, { ownerFields }))
  }
  mergeById(db.notifications, await listRecordsForOwner(client, 'notifications', userId, { ownerFields: ['userId'] }))
  if (trustAccess) {
    // Requests the caller raised (investor) or must decide (founder), plus the
    // addressed request by id so the owner check can return 403 (not 404) for a
    // request that exists but belongs to someone else.
    mergeById(db.investorTrustAccessRequests, await listRecordsForOwner(client, 'investorTrustAccessRequests', userId, { ownerFields: TRUST_ACCESS_OWNER_FIELDS }))
    if (requestId) mergeById(db.investorTrustAccessRequests, [await getRecord(client, 'investorTrustAccessRequests', requestId)])
    mergeById(db.projects, await listRecordsByIds(client, 'projects', db.investorTrustAccessRequests.map(row => row.projectId).filter(Boolean)))
  }
  if (startupId) mergeById(db.projects, [await getRecord(client, 'projects', startupId)])
  mergeById(db.projects, await listRecordsForOwner(client, 'projects', userId, { ownerFields: ['ownerId'] }))
  const authorizedIds = [...new Set(AUTHORIZED_PROJECT_COLLECTIONS.flatMap(name => (db[name] || []).map(row => row.projectId || row.startupId || row.resourceId)))].filter(Boolean)
  if (authorizedIds.length) mergeById(db.projects, await listRecordsByIds(client, 'projects', authorizedIds))

  if (intelligence) {
    const projectIds = db.projects.map(row => row.id).filter(Boolean)
    if (projectIds.length) {
      mergeById(db.milestones, await listRecordsByFieldIn(client, 'milestones', 'projectId', projectIds, { limit }))
      mergeById(db.milestones, await listRecordsByFieldIn(client, 'milestones', 'startupId', projectIds, { limit }))
      mergeById(db.mentorshipRooms, await listRecordsByFieldIn(client, 'mentorshipRooms', 'projectId', projectIds, { limit }))
      mergeById(db.mentorshipRooms, await listRecordsByFieldIn(client, 'mentorshipRooms', 'startupId', projectIds, { limit }))
      mergeById(db.mentorshipTasks, await listRecordsByFieldIn(client, 'mentorshipTasks', 'projectId', projectIds, { limit }))
      mergeById(db.mentorshipTasks, await listRecordsByFieldIn(client, 'mentorshipTasks', 'startupId', projectIds, { limit }))
      mergeById(db.projectActivities, await listRecordsByFieldIn(client, 'projectActivities', 'projectId', projectIds, { limit }))
      mergeById(db.startupActivities, await listRecordsByFieldIn(client, 'startupActivities', 'startupId', projectIds, { limit }))
      mergeById(db.recommendationEvents, await listRecordsByFieldIn(client, 'recommendationEvents', 'projectId', projectIds, { limit }))
      mergeById(db.recommendationEvents, await listRecordsByFieldIn(client, 'recommendationEvents', 'startupId', projectIds, { limit }))
    }
    const roomIds = db.mentorshipRooms.map(row => row.id).filter(Boolean)
    if (roomIds.length) {
      mergeById(db.mentorshipMentees, await listRecordsByFieldIn(client, 'mentorshipMentees', 'roomId', roomIds, { limit }))
      mergeById(db.mentorshipTasks, await listRecordsByFieldIn(client, 'mentorshipTasks', 'roomId', roomIds, { limit }))
    }
    // Public deal-flow snapshots the caller does not own (bounded window), used
    // as the fallback snapshot when the investor has none of their own.
    mergeById(db.dealFlowSnapshots, await listRecordsLimited(client, 'dealFlowSnapshots', { limit, payloadField: 'visibility', payloadValue: 'public' }))
  }

  const requestIds = db.investorTrustAccessRequests.map(row => row.id).filter(Boolean)
  if (requestIds.length) mergeById(db.investorTrustAccessHistory, await listRecordsByFieldIn(client, 'investorTrustAccessHistory', 'requestId', requestIds, { limit }))
  return db
}

function writeCollectionsFor({ intelligence = false, trustAccess = false } = {}) {
  const set = new Set()
  if (intelligence) { set.add('investorIntelligenceSnapshots'); set.add('investorIntelligenceAudits') }
  if (trustAccess) { set.add('investorTrustAccessRequests'); set.add('investorTrustAccessHistory'); set.add('notifications') }
  return set
}

async function persistChanges(client, db, originals, collections) {
  for (const name of collections) {
    const seen = new Set()
    for (const row of db[name] || []) {
      if (!row?.id) continue
      const key = `${name}:${row.id}`
      seen.add(key)
      const next = JSON.stringify(row)
      if (originals.get(key) === next) continue
      await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
    }
    for (const key of originals.keys()) {
      if (!key.startsWith(`${name}:`) || seen.has(key)) continue
      await deleteRecord(client, name, key.slice(name.length + 1))
    }
  }
}

export async function runInvestorRead(options, read) {
  return withPlatformTransaction(async client => {
    const db = await buildInvestorDb(client, options)
    return runBoundedDatabase(db, async () => read())
  }, { userId: options.userId || null })
}

export async function applyInvestorMutation(options, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildInvestorDb(client, options)
    const collections = writeCollectionsFor(options)
    const originals = new Map()
    for (const name of collections) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runBoundedDatabase(db, async () => mutate())
    await persistChanges(client, db, originals, collections)
    return result
  }, { userId: options.userId || null })
}
