import { readDb as readAuthorityDb } from '../config/database.js'
import { withPlatformTransaction, upsertRecord, listRecords } from './platformCollectionRepository.js'

const collections = [
  'recommendationProfiles', 'recommendationPreferences', 'recommendationConfigs',
  'recommendations', 'recommendationReasons', 'recommendationEvents', 'recommendationFeedback',
  'recommendationExposures', 'userInterests', 'userIntents', 'userSkills', 'entityRelationships',
  'networkEdges', 'userActivityStates', 'catchUpStates', 'techitMoments', 'techitMomentShares',
  'techitMomentReferrals', 'techitMomentEvents', 'academyCurricula', 'academyModules',
  'academyProgress', 'academyAssessments', 'academyEvents', 'academyBadges',
]
const enabled = () => process.env.INTELLIGENCE_SOURCE === 'postgres' || process.env.INTELLIGENCE_WRITE_SOURCE === 'postgres' || process.env.INTELLIGENCE_READ_SOURCE === 'postgres'
const fallback = () => process.env.INTELLIGENCE_FALLBACK_SQLITE !== 'false'

export async function syncIntelligenceState(userId) {
  if (!enabled()) return { enabled: false }
  const db = readAuthorityDb()
  return withPlatformTransaction(async client => {
    let records = 0
    for (const collectionName of collections) for (const row of (db[collectionName] || []).filter(item => item.userId === userId || item.ownerId === userId || item.actorId === userId || item.createdBy === userId)) { await upsertRecord(client, collectionName, row, { operation: 'replay', idempotencyKey: `intelligence:${collectionName}:${row.id}:${row.updatedAt || row.createdAt || ''}` }); records += 1 }
    return { enabled: true, userId, records }
  }, { userId })
}

export async function listIntelligenceState(userId, collectionName) {
  if (!enabled()) return null
  return withPlatformTransaction(client => listRecords(client, collectionName, { ownerId: userId }))
}
export function intelligenceStateEnabled() { return enabled() }
export function intelligenceStateFallbackEnabled() { return fallback() }
