import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { createClient } from 'redis'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATION_PATH = path.join(__dirname, '../../migrations/postgres/001_discovery_intelligence.sql')
const VECTOR_DIMENSIONS = 128
const CACHE_TTL_SECONDS = Math.max(30, Number(process.env.DISCOVERY_CACHE_TTL_SECONDS || 300))
// Per-surface cadence (see BACKEND/docs/PLATFORM_IMPLEMENTATION_PLAN_P0_P4_2026-10-01.md §4):
//   people you may know -> short TTL, invalidated on follow/connect/profile change
//   opportunities       -> longer TTL, invalidated on new opportunity/post
// The general feed keeps the baseline TTL.
const PEOPLE_TTL_SECONDS = Math.max(30, Number(process.env.DISCOVERY_PEOPLE_TTL_SECONDS || 600))
const OPPORTUNITY_TTL_SECONDS = Math.max(30, Number(process.env.DISCOVERY_OPPORTUNITY_TTL_SECONDS || 3600))
const PEOPLE_TYPES = new Set(['people', 'person', 'founder', 'collaborator', 'investor'])
const OPPORTUNITY_TYPES = new Set(['opportunities', 'opportunity'])
const QUEUE_KEY = process.env.DISCOVERY_QUEUE_KEY || 'techit:discovery:refresh'

let pool
let redis

export function discoveryPostgresEnabled() {
  return Boolean(process.env.DISCOVERY_DATABASE_URL)
}

export function discoveryRedisEnabled() {
  return Boolean(process.env.DISCOVERY_REDIS_URL || process.env.REDIS_URL)
}

function getPool() {
  if (!discoveryPostgresEnabled()) return null
  pool ||= new Pool({ connectionString: process.env.DISCOVERY_DATABASE_URL, max: Number(process.env.DISCOVERY_DB_POOL_SIZE || 10), connectionTimeoutMillis: 5000 })
  return pool
}

async function getRedis() {
  if (!discoveryRedisEnabled()) return null
  if (!redis) {
    redis = createClient({ url: process.env.DISCOVERY_REDIS_URL || process.env.REDIS_URL })
    redis.on('error', error => console.error(JSON.stringify({ event: 'discovery_redis_error', error: error.message })))
    await redis.connect()
  }
  return redis
}

export function deterministicEmbedding(text) {
  const vector = Array(VECTOR_DIMENSIONS).fill(0)
  const tokens = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []
  for (const token of tokens) {
    let hash = 2166136261
    for (const char of token) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
    vector[Math.abs(hash) % VECTOR_DIMENSIONS] += hash % 2 === 0 ? 1 : -1
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map(value => Math.round((value / norm) * 1_000_000) / 1_000_000)
}

function vectorLiteral(vector) {
  return `[${vector.join(',')}]`
}

export async function initializeDiscoveryInfrastructure() {
  const db = getPool()
  if (!db) return { postgres: false, redis: discoveryRedisEnabled() }
  await db.query(await fs.readFile(MIGRATION_PATH, 'utf8'))
  return { postgres: true, redis: discoveryRedisEnabled() }
}

export function recommendationCacheKey(userId, options = {}) {
  return `techit:discovery:recommendations:${userId}:${options.surface || 'discovery'}:${options.type || 'all'}:${options.limit || 'default'}`
}

/** Cache TTL for a recommendation request, by surface type. */
export function discoveryCacheTtlSeconds(options = {}) {
  const type = String(options.type || '').toLowerCase()
  if (PEOPLE_TYPES.has(type)) return PEOPLE_TTL_SECONDS
  if (OPPORTUNITY_TYPES.has(type)) return OPPORTUNITY_TTL_SECONDS
  return CACHE_TTL_SECONDS
}

export async function getCachedDiscovery(key) {
  const client = await getRedis()
  if (!client) return null
  const value = await client.get(key)
  return value ? JSON.parse(value) : null
}

export async function setCachedDiscovery(key, value, options = {}) {
  const client = await getRedis()
  if (!client) return false
  await client.set(key, JSON.stringify(value), { EX: discoveryCacheTtlSeconds(options) })
  return true
}

export async function invalidateDiscoveryUser(userId) {
  const client = await getRedis()
  if (!client) return false
  for await (const key of client.scanIterator({ MATCH: `techit:discovery:recommendations:${userId}:*`, COUNT: 100 })) await client.del(key)
  return true
}

// Type aliases used only for targeted surface invalidation (a new opportunity
// should clear the opportunities surface, not every user's whole cache).
const INVALIDATION_TYPE_ALIASES = {
  people: ['people', 'person', 'founder', 'collaborator', 'investor'],
  person: ['people', 'person', 'founder', 'collaborator', 'investor'],
  opportunities: ['opportunities', 'opportunity'],
  opportunity: ['opportunities', 'opportunity'],
}

/**
 * Targeted invalidation for one recommendation type across all users. Used when
 * an entity that feeds a single surface changes (e.g. a new opportunity), so we
 * do not flush unrelated caches. Prefer invalidateDiscoveryUser for events that
 * only affect one user's own signals.
 */
export async function invalidateDiscoveryType(type) {
  const client = await getRedis()
  if (!client) return false
  const normalized = String(type || '').toLowerCase()
  if (!normalized) return false
  const aliases = INVALIDATION_TYPE_ALIASES[normalized] || [normalized]
  for (const alias of aliases) {
    for await (const key of client.scanIterator({ MATCH: `techit:discovery:recommendations:*:*:${alias}:*`, COUNT: 100 })) await client.del(key)
  }
  return true
}

export async function enqueueDiscoveryRefresh(userId, reason = 'signal_changed') {
  const client = await getRedis()
  if (!client) return false
  await client.lPush(QUEUE_KEY, JSON.stringify({ userId, reason, queuedAt: new Date().toISOString() }))
  return true
}

export async function waitForDiscoveryRefresh(timeoutSeconds = 5) {
  const client = await getRedis()
  if (!client) {
    await new Promise(resolve => setTimeout(resolve, Math.max(1, timeoutSeconds) * 1000))
    return null
  }
  const result = await client.brPop(QUEUE_KEY, timeoutSeconds)
  return result?.element ? JSON.parse(result.element) : null
}

export async function persistDiscoveryState(snapshot) {
  const db = getPool()
  if (!db) return false
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const event of snapshot.recommendationEvents || []) await client.query(`INSERT INTO discovery_events(event_id,user_id,actor_id,event_type,entity_type,entity_id,importance,surface,metadata,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(event_id) DO NOTHING`, [event.id,event.userId,event.actorId,event.eventType,event.entityType,event.entityId,event.importance,event.surface,event.metadata || {},event.createdAt])
    for (const item of snapshot.recommendationFeedback || []) await client.query(`INSERT INTO discovery_feedback(feedback_id,user_id,recommendation_id,entity_type,entity_id,feedback_type,metadata,created_at,undone_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(feedback_id) DO UPDATE SET undone_at=excluded.undone_at`, [item.id,item.userId,item.recommendationId,item.entityType,item.entityId,item.type,item.metadata || {},item.createdAt,item.undoneAt || null])
    for (const item of snapshot.recommendationExposures || []) await client.query(`INSERT INTO discovery_exposures(exposure_id,user_id,recommendation_id,entity_type,entity_id,surface,exposure_type,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(exposure_id) DO NOTHING`, [item.id,item.userId,item.recommendationId,item.entityType,item.entityId,item.surface,item.exposureType,item.createdAt])
    for (const state of snapshot.userActivityStates || []) await client.query(`INSERT INTO discovery_activity_state(user_id,last_meaningful_at,return_anchor_at,return_detected_at,payload,updated_at)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id) DO UPDATE SET last_meaningful_at=excluded.last_meaningful_at,return_anchor_at=excluded.return_anchor_at,return_detected_at=excluded.return_detected_at,payload=excluded.payload,updated_at=excluded.updated_at`, [state.userId,state.lastMeaningfulAt || null,state.returnAnchorAt || null,state.returnDetectedAt || null,state,state.updatedAt || new Date().toISOString()])
    for (const state of snapshot.catchUpStates || []) await client.query(`INSERT INTO discovery_catchup_state(user_id,anchor,seen_ids,dismissed_ids,started_at,completed_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,anchor) DO UPDATE SET seen_ids=excluded.seen_ids,dismissed_ids=excluded.dismissed_ids,started_at=excluded.started_at,completed_at=excluded.completed_at,updated_at=excluded.updated_at`, [state.userId,state.anchor,state.seenIds || [],state.dismissedIds || [],state.startedAt || null,state.completedAt || null,state.updatedAt || new Date().toISOString()])
    for (const config of snapshot.recommendationConfigs || []) await client.query(`INSERT INTO discovery_config(config_id,value,updated_at) VALUES($1,$2,$3) ON CONFLICT(config_id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`, [config.id,config.value,config.updatedAt || new Date().toISOString()])
    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function persistDiscoveryBatch(result) {
  const db = getPool()
  if (!db || !result?.profile) return false
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`INSERT INTO discovery_profiles(user_id, role, interests, skills, intent, recent_interests, payload, updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role, interests=excluded.interests, skills=excluded.skills, intent=excluded.intent, recent_interests=excluded.recent_interests, payload=excluded.payload, updated_at=now()`,
    [result.profile.userId, result.profile.role, result.profile.interests, result.profile.skills, result.profile.intent, result.profile.recentInterests || {}, result.profile])
    for (const recommendation of result.recommendations || []) {
      const entity = recommendation.entity || {}
      const body = [entity.title, entity.subtitle, entity.description, ...(entity.skills || []), ...(entity.industries || [])].filter(Boolean).join(' ')
      await client.query(`INSERT INTO discovery_entities(entity_type,entity_id,creator_id,owner_id,organization_id,workspace_id,visibility,classification,title,body,tags,embedding,trust_score,gsis_score,payload,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector,$13,$14,$15,$16,$17) ON CONFLICT(entity_type,entity_id) DO UPDATE SET creator_id=excluded.creator_id,owner_id=excluded.owner_id,organization_id=excluded.organization_id,workspace_id=excluded.workspace_id,visibility=excluded.visibility,classification=excluded.classification,title=excluded.title,body=excluded.body,tags=excluded.tags,embedding=excluded.embedding,trust_score=excluded.trust_score,gsis_score=excluded.gsis_score,payload=excluded.payload,updated_at=excluded.updated_at`,
      [recommendation.entityType, recommendation.entityId, entity.creatorId || null, entity.ownerId || entity.creatorId || null, entity.organizationId || null, entity.workspaceId || null, entity.visibility || 'public', entity.classification || 'PUBLIC', entity.title || 'Untitled', body, [...new Set([...(entity.skills || []), ...(entity.industries || [])])], vectorLiteral(deterministicEmbedding(body)), Number(entity.trustScore || 0), Number(entity.gsis || 0), entity, entity.createdAt || null, entity.updatedAt || new Date().toISOString()])
      await client.query(`INSERT INTO discovery_recommendations(recommendation_id,user_id,surface,entity_type,entity_id,score,rank,reason_type,reason_text,features,payload,config_version,generated_at,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(recommendation_id) DO UPDATE SET score=excluded.score,rank=excluded.rank,reason_type=excluded.reason_type,reason_text=excluded.reason_text,features=excluded.features,payload=excluded.payload,config_version=excluded.config_version,generated_at=excluded.generated_at,expires_at=excluded.expires_at`,
      [recommendation.id, recommendation.userId, recommendation.surface, recommendation.entityType, recommendation.entityId, recommendation.score, recommendation.rank || 0, recommendation.reasonType, recommendation.reasonText, recommendation.features || {}, recommendation, recommendation.configVersion, recommendation.generatedAt, recommendation.expiresAt])
    }
    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function semanticEntitySearch(query, options = {}) {
  const db = getPool()
  if (!db || !String(query || '').trim()) return []
  const limit = Math.max(1, Math.min(100, Number(options.limit || 30)))
  const actorId = String(options.userId || options.ownerId || '').trim()
  if (!actorId) return []
  const values = [vectorLiteral(deterministicEmbedding(query)), `%${String(query).trim()}%`, limit, actorId]
  let typeClause = ''
  if (options.type) { values.push(options.type); typeClause = `AND entity_type = $${values.length}` }
  const scope = [`(owner_id = $4 OR visibility = 'public')`]
  if (options.organizationId) { values.push(String(options.organizationId)); scope.push(`(organization_id IS NULL OR organization_id = $${values.length})`) }
  if (options.workspaceId) { values.push(String(options.workspaceId)); scope.push(`(workspace_id IS NULL OR workspace_id = $${values.length})`) }
  const classifications = Array.isArray(options.classifications) && options.classifications.length ? options.classifications.map(String) : ['PUBLIC', 'INTERNAL']
  values.push(classifications); scope.push(`classification = ANY($${values.length})`)
  const result = await db.query(`SELECT entity_type, entity_id, payload,
      1 - (embedding <=> $1::vector) AS semantic_score,
      CASE WHEN title ILIKE $2 OR body ILIKE $2 THEN 1 ELSE 0 END AS lexical_match
    FROM discovery_entities WHERE embedding IS NOT NULL AND ${scope.join(' AND ')} ${typeClause}
    ORDER BY lexical_match DESC, semantic_score DESC LIMIT $3`, values)
  return result.rows.map(row => ({ ...row.payload, entityId: row.entity_id, type: row.entity_type, semanticScore: Number(row.semantic_score || 0), lexicalMatch: Boolean(row.lexical_match) }))
}

export async function closeDiscoveryInfrastructure() {
  if (redis?.isOpen) await redis.quit()
  if (pool) await pool.end()
  redis = null
  pool = null
}
