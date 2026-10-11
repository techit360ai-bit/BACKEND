// Row-level discovery / recommendation store (§5 cutover).
//
// Discovery mixes two shapes of data:
//   * the viewer's personalization state (recommendation profile, interest/
//     skill/intent signals, generated recommendations + reasons, exposures,
//     feedback, preferences, activity/catch-up state, edges) which is strictly
//     owner-scoped, and
//   * the cross-platform candidate pool (people, projects, opportunities, ideas,
//     posts) which the ranking engine scores.
//
// The candidate pool cannot be owner-scoped, so instead of the whole-DB snapshot
// it is resolved as a bounded window: the most-recently-updated
// DISCOVERY_CANDIDATE_LIMIT rows per candidate collection (plus the owner
// profiles those rows reference). The viewer's own rows are loaded individually
// and only changed rows are written back. Candidate execution-history signals
// degrade to the score embedded on the profile row (the existing fallback), which
// removes the per-candidate cross-domain fan-out. When DISCOVERY_DATABASE_URL is
// set the vector index (discovery_entities) is the preferred candidate source and
// this window is the fallback.
import { withPlatformTransaction, getRecord, upsertRecord, listRecords, listRecordsForOwner, listRecordsByField, listRecordsLimited, listRecordsByIds } from './platformCollectionRepository.js'
import { runDatabaseAuthority } from '../config/database.js'
import { createId } from '../utils/api.js'

export function discoveryStoreEnabled() {
  return ['DISCOVERY_SOURCE', 'DISCOVERY_READ_SOURCE', 'DISCOVERY_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function discoveryFallbackEnabled() { return process.env.DISCOVERY_FALLBACK_SQLITE !== 'false' }
export function discoveryCandidateLimit() { return Math.max(50, Number(process.env.DISCOVERY_CANDIDATE_LIMIT || 500)) }

// Owner-scoped personalization collections, with the payload fields that may
// carry the owner id.
const OWNER_FIELDS = {
  recommendationProfiles: ['userId'],
  userInterests: ['userId'],
  userSkills: ['userId'],
  userIntents: ['userId'],
  recommendations: ['userId'],
  recommendationExposures: ['userId'],
  recommendationFeedback: ['userId'],
  recommendationPreferences: ['userId'],
  recommendationEvents: ['userId', 'actorId'],
  networkEdges: ['fromEntityId'],
  entityRelationships: ['userId'],
  catchUpStates: ['userId'],
  userActivityStates: ['userId'],
  notifications: ['userId'],
}
// Cross-platform candidate pool loaded as a bounded recent window.
const CANDIDATE_COLLECTIONS = ['profiles', 'projects', 'opportunities', 'ventureIntakes', 'feedPosts']
const CANDIDATE_OWNER_FIELDS = ['ownerId', 'founderId', 'organizationId', 'userId', 'createdBy', 'authorId']
// Collections the service writes back.
const WRITE_COLLECTIONS = [
  'recommendationProfiles', 'userInterests', 'userSkills', 'userIntents', 'recommendations', 'recommendationReasons',
  'recommendationExposures', 'recommendationFeedback', 'recommendationPreferences', 'recommendationEvents',
  'networkEdges', 'entityRelationships', 'catchUpStates', 'userActivityStates', 'notifications', 'recommendationConfigs',
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

async function loadCandidates(client, db) {
  const limit = discoveryCandidateLimit()
  for (const name of CANDIDATE_COLLECTIONS) {
    const window = await listRecordsLimited(client, name, { limit })
    if (name === 'profiles') mergeById(db.profiles, window)
    else db[name] = window
  }
  const ownerIds = []
  for (const name of CANDIDATE_COLLECTIONS) {
    if (name === 'profiles') continue
    for (const row of db[name] || []) for (const field of CANDIDATE_OWNER_FIELDS) ownerIds.push(row?.[field])
  }
  const missing = [...new Set(ownerIds.filter(id => id && !db.profiles.some(profile => profile.id === id)))]
  if (missing.length) mergeById(db.profiles, await listRecordsByIds(client, 'profiles', missing))
}

async function buildDiscoveryDb(client, { userId = null, global = false, candidates = true, profileIds = [] } = {}) {
  const db = {}
  for (const name of WRITE_COLLECTIONS) db[name] = []
  db.profiles = []
  db.recommendationConfigs = await listRecords(client, 'recommendationConfigs')

  if (global) {
    db.profiles = await listRecords(client, 'profiles')
    db.recommendations = await listRecords(client, 'recommendations')
    db.recommendationReasons = await listRecords(client, 'recommendationReasons')
    db.recommendationEvents = await listRecords(client, 'recommendationEvents')
    db.recommendationExposures = await listRecords(client, 'recommendationExposures')
    db.recommendationFeedback = await listRecords(client, 'recommendationFeedback')
    db.userActivityStates = await listRecords(client, 'userActivityStates')
    db.catchUpStates = await listRecords(client, 'catchUpStates')
    db.notifications = await listRecords(client, 'notifications')
    if (candidates) {
      for (const name of CANDIDATE_COLLECTIONS) {
        if (name === 'profiles') continue
        db[name] = await listRecordsLimited(client, name, { limit: discoveryCandidateLimit() })
      }
    }
    if (profileIds.length) mergeById(db.profiles, await listRecordsByIds(client, 'profiles', profileIds))
    return db
  }

  if (userId) {
    for (const [name, fields] of Object.entries(OWNER_FIELDS)) {
      mergeById(db[name], await listRecordsForOwner(client, name, userId, { ownerFields: fields }))
    }
    mergeById(db.profiles, [await getRecord(client, 'profiles', userId)])
    for (const recommendation of db.recommendations) {
      if (recommendation?.id) mergeById(db.recommendationReasons, await listRecordsByField(client, 'recommendationReasons', 'recommendationId', recommendation.id))
    }
  }
  if (candidates) await loadCandidates(client, db)
  if (profileIds.length) mergeById(db.profiles, await listRecordsByIds(client, 'profiles', profileIds))
  return db
}

async function persistChanges(client, db, originals) {
  for (const name of WRITE_COLLECTIONS) {
    for (const row of db[name] || []) {
      if (!row) continue
      if (!row.id) row.id = createId('discovery_row')
      const key = `${name}:${row.id}`
      const next = JSON.stringify(row)
      if (originals.get(key) === next) continue
      await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
    }
  }
}

export async function runDiscoveryRead(options, read) {
  return withPlatformTransaction(async client => {
    const db = await buildDiscoveryDb(client, options)
    return runDatabaseAuthority(db, async () => read())
  }, { userId: options.userId || null })
}

export async function applyDiscoveryMutation(options, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildDiscoveryDb(client, options)
    const originals = new Map()
    for (const name of WRITE_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runDatabaseAuthority(db, async () => mutate())
    await persistChanges(client, db, originals)
    return result
  }, { userId: options.userId || null })
}
