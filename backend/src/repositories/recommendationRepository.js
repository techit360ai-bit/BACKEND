// Row-level recommendation-intelligence store (§5 cutover).
//
// The recommendation + continuous-intelligence surfaces previously loaded the
// whole-DB snapshot at the top of every handler: the caller profile, a
// cross-user candidate window, the ranking signals (execution scores, tasks,
// recommendation events), mentorship rooms/applications, and the investor
// portfolio used by the daily digest. This store resolves a bounded window of
// exactly those collections for the caller so the handlers never need the
// whole snapshot. Gated by INTELLIGENCE_SOURCE=postgres; the snapshot path
// stays as the fallback until the authority is deleted.
import { withPlatformTransaction, listRecordsByIds, listRecordsLimited, listRecordsByFieldIn, listRecordsForOwner, upsertRecord, deleteRecord } from './platformCollectionRepository.js'
import { runDatabaseAuthority } from '../config/database.js'

export function recommendationStoreEnabled() {
  return process.env.INTELLIGENCE_SOURCE === 'postgres' || process.env.INTELLIGENCE_WRITE_SOURCE === 'postgres' || process.env.INTELLIGENCE_READ_SOURCE === 'postgres'
}
export function recommendationFallbackEnabled() { return process.env.INTELLIGENCE_FALLBACK_SQLITE !== 'false' }
export function recommendationCandidateLimit() { return Math.max(50, Number(process.env.RECOMMENDATION_CANDIDATE_LIMIT || process.env.DOMAIN_CANDIDATE_LIMIT || 500)) }

// Collections owned by the investor surface, with every payload field that may
// carry the investor id (investorWatchlists/dealFlowSnapshots use several).
const INVESTOR_OWNER_FIELDS = {
  investments: ['investorId', 'userId', 'ownerId'],
  portfolioInvestments: ['investorId', 'userId', 'ownerId'],
  investorPortfolio: ['investorId', 'userId', 'ownerId'],
  investorRelationships: ['investorId', 'userId', 'ownerId'],
  investorWatchlists: ['investorId', 'ownerId', 'userId'],
  dealRooms: ['investorId', 'ownerId', 'userId'],
  dataRooms: ['investorId', 'ownerId', 'userId'],
  dealFlowSnapshots: ['investorId', 'ownerId', 'userId'],
  investorIntelligenceSnapshots: ['investorId'],
  investorIntelligenceAudits: ['investorId'],
}

function mergeById(target, additions) {
  const seen = new Map((target || []).map(row => [row.id, row]))
  for (const row of additions || []) { if (row?.id) seen.set(row.id, row) }
  const merged = [...seen.values()]
  target.length = 0
  target.push(...merged)
  return target
}

async function buildRecommendationDb(client, { userId = null, projectId = null, organizationId = null } = {}) {
  const limit = recommendationCandidateLimit()
  const db = {
    profiles: [], projects: [], workspaceMembers: [], milestones: [], projectActivities: [], startupActivities: [],
    mentorshipRooms: [], mentorshipMentees: [], mentorshipTasks: [], mentorshipApplications: [], organizationMemberships: [],
    executionScores: [], workspaceTasks: [], recommendationEvents: [],
    investments: [], portfolioInvestments: [], investorPortfolio: [], investorRelationships: [], investorWatchlists: [],
    dealRooms: [], dataRooms: [], dealFlowSnapshots: [], investorIntelligenceSnapshots: [], investorIntelligenceAudits: [],
  }
  if (userId) mergeById(db.profiles, await listRecordsByIds(client, 'profiles', [userId]))
  mergeById(db.profiles, await listRecordsLimited(client, 'profiles', { limit }))
  mergeById(db.projects, await listRecordsLimited(client, 'projects', { limit }))
  if (projectId) mergeById(db.projects, await listRecordsByIds(client, 'projects', [projectId]))
  if (userId) mergeById(db.organizationMemberships, await listRecordsForOwner(client, 'organizationMemberships', userId, { ownerFields: ['userId'] }))
  if (organizationId) mergeById(db.organizationMemberships, await listRecordsForOwner(client, 'organizationMemberships', organizationId, { ownerFields: ['organizationId'] }))
  mergeById(db.executionScores, await listRecordsLimited(client, 'executionScores', { limit }))
  mergeById(db.workspaceTasks, await listRecordsLimited(client, 'workspaceTasks', { limit }))
  mergeById(db.recommendationEvents, await listRecordsLimited(client, 'recommendationEvents', { limit }))
  if (userId) {
    for (const [name, ownerFields] of Object.entries(INVESTOR_OWNER_FIELDS)) {
      mergeById(db[name], await listRecordsForOwner(client, name, userId, { ownerFields }))
    }
    mergeById(db.mentorshipRooms, await listRecordsByFieldIn(client, 'mentorshipRooms', 'mentorId', [userId]))
  }
  mergeById(db.dealFlowSnapshots, await listRecordsLimited(client, 'dealFlowSnapshots', { limit, payloadField: 'visibility', payloadValue: 'public' }))

  const investorProjectIds = [...new Set(['investorWatchlists', 'dealFlowSnapshots', 'investments', 'portfolioInvestments', 'investorPortfolio', 'investorRelationships', 'dealRooms', 'dataRooms'].flatMap(name => (db[name] || []).map(row => row.projectId || row.startupId || row.resourceId)))].filter(Boolean)
  if (investorProjectIds.length) mergeById(db.projects, await listRecordsByIds(client, 'projects', investorProjectIds))

  const projectIds = db.projects.map(row => row.id).filter(Boolean)
  if (projectIds.length) {
    mergeById(db.mentorshipRooms, await listRecordsByFieldIn(client, 'mentorshipRooms', 'projectId', projectIds, { limit }))
    mergeById(db.mentorshipRooms, await listRecordsByFieldIn(client, 'mentorshipRooms', 'startupId', projectIds, { limit }))
    mergeById(db.milestones, await listRecordsByFieldIn(client, 'milestones', 'projectId', projectIds, { limit }))
    mergeById(db.milestones, await listRecordsByFieldIn(client, 'milestones', 'startupId', projectIds, { limit }))
    mergeById(db.projectActivities, await listRecordsByFieldIn(client, 'projectActivities', 'projectId', projectIds, { limit }))
    mergeById(db.startupActivities, await listRecordsByFieldIn(client, 'startupActivities', 'startupId', projectIds, { limit }))
  }
  const roomIds = db.mentorshipRooms.map(row => row.id).filter(Boolean)
  if (roomIds.length) {
    mergeById(db.mentorshipMentees, await listRecordsByFieldIn(client, 'mentorshipMentees', 'roomId', roomIds, { limit }))
    mergeById(db.mentorshipTasks, await listRecordsByFieldIn(client, 'mentorshipTasks', 'roomId', roomIds, { limit }))
  }
  const ownerIds = [...new Set(db.projects.flatMap(row => [row.ownerId, row.founderId, row.createdBy]).filter(Boolean))]
  if (ownerIds.length) {
    mergeById(db.profiles, await listRecordsByIds(client, 'profiles', ownerIds))
    mergeById(db.mentorshipApplications, await listRecordsByFieldIn(client, 'mentorshipApplications', 'applicantId', ownerIds, { limit }))
  }
  const workspaceIds = [...new Set(db.projects.filter(row => [row.ownerId, row.founderId, row.createdBy].includes(userId)).map(row => row.workspaceId).filter(Boolean))]
  if (workspaceIds.length) mergeById(db.workspaceMembers, await listRecordsByFieldIn(client, 'workspaceMembers', 'workspaceId', workspaceIds, { limit }))
  return db
}

function writeCollections() {
  return new Set(['continuousIntelligenceSnapshots', 'investorIntelligenceSnapshots', 'investorIntelligenceAudits'])
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

export async function runRecommendationRead(options, read) {
  return withPlatformTransaction(async client => {
    const db = await buildRecommendationDb(client, options)
    return runDatabaseAuthority(db, async () => read())
  }, { userId: options.userId || null })
}

export async function applyRecommendationMutation(options, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildRecommendationDb(client, options)
    const collections = writeCollections()
    const originals = new Map()
    for (const name of collections) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runDatabaseAuthority(db, async () => mutate())
    await persistChanges(client, db, originals, collections)
    return result
  }, { userId: options.userId || null })
}
