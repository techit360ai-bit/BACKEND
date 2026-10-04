import {
  completeCatchUp,
  getRecommendations,
  getReturnSummary,
  markCatchUpItem,
  noteUserActivity,
  recordExposure,
  recordFeedback,
  recordRecommendationEvent,
  searchDiscovery,
  updateRecommendationProfile,
} from '../services/discoveryService.js'
import {
  enqueueDiscoveryRefresh,
  getCachedDiscovery,
  invalidateDiscoveryUser,
  persistDiscoveryBatch,
  recommendationCacheKey,
  semanticEntitySearch,
  setCachedDiscovery,
} from '../services/discoveryInfrastructure.js'
import { intelligenceFlags } from '../services/intelligence/featureFlags.js'
import { intelligenceStateEnabled, intelligenceStateFallbackEnabled, syncIntelligenceState } from '../repositories/intelligenceStateRepository.js'

function badRequest(res, error) {
  return res.status(400).json({ error: error instanceof Error ? error.message : String(error) })
}
async function persisted(req, value) { if (!intelligenceStateEnabled() || value?.ok === false) return value; try { await syncIntelligenceState(req.user.id); return value } catch (error) { console.error(JSON.stringify({ event: 'intelligence_postgres_write_failed', error: error.message })); if (intelligenceStateFallbackEnabled()) return value; return { ok: false, error: 'intelligence_write_temporarily_unavailable' } } }

export async function listRecommendations(req, res) {
  const options = {
    surface: req.query.surface,
    type: req.query.type,
    limit: req.query.limit,
  }
  const cacheKey = recommendationCacheKey(req.user.id, options)
  const cached = await getCachedDiscovery(cacheKey).catch(() => null)
  if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true } })
  const result = getRecommendations(req.user.id, options)
  await Promise.allSettled([setCachedDiscovery(cacheKey, result, options), persistDiscoveryBatch(result)])
  return res.json({ ...result, intelligence: { schema_version: 'intelligence-v1', deterministic: intelligenceFlags.deterministicEnabled, ai_enrichment: false } })
}

export async function putRecommendationProfile(req, res) {
  const profile = await persisted(req, updateRecommendationProfile(req.user.id, req.body))
  if (!profile) return res.status(404).json({ error: 'Profile not found' })
  void invalidateDiscoveryUser(req.user.id)
  void enqueueDiscoveryRefresh(req.user.id, 'profile_updated')
  return res.json({ profile })
}

export async function createRecommendationEvent(req, res) {
  try {
    const event = await persisted(req, recordRecommendationEvent(req.user.id, req.body))
    void invalidateDiscoveryUser(req.user.id)
    void enqueueDiscoveryRefresh(req.user.id, event.eventType)
    return res.status(201).json({ event })
  } catch (error) {
    return badRequest(res, error)
  }
}

export async function createExposure(req, res) {
  const exposure = await persisted(req, recordExposure(req.user.id, req.params.id, req.body))
  if (!exposure) return res.status(404).json({ error: 'Recommendation not found' })
  return res.status(201).json({ exposure })
}

export async function createFeedback(req, res) {
  try {
    const feedback = await persisted(req, recordFeedback(req.user.id, req.params.id, req.body))
    if (!feedback) return res.status(404).json({ error: 'Recommendation not found' })
    void invalidateDiscoveryUser(req.user.id)
    void enqueueDiscoveryRefresh(req.user.id, 'feedback')
    return res.status(201).json({ feedback })
  } catch (error) {
    return badRequest(res, error)
  }
}

export function returnSummary(req, res) {
  return res.json({ ...getReturnSummary(req.user.id), intelligence: { schema_version: 'intelligence-v1', deterministic: true, ai_enrichment: false } })
}

export function catchUp(req, res) {
  return res.json(getReturnSummary(req.user.id))
}

export async function markCatchUpSeen(req, res) {
  const state = await persisted(req, markCatchUpItem(req.user.id, req.params.id, req.body.action))
  if (!state) return res.status(404).json({ error: 'Active catch-up session not found' })
  return res.json({ state })
}

export async function finishCatchUp(req, res) {
  const result = await persisted(req, completeCatchUp(req.user.id))
  if (!result) return res.status(404).json({ error: 'Active catch-up session not found' })
  return res.json(result)
}

export async function recordActivity(req, res) {
  const eventType = String(req.body.eventType || '').trim().toLowerCase()
  if (!eventType) return res.status(400).json({ error: 'eventType is required' })
  const state = await persisted(req, noteUserActivity(req.user.id, eventType, req.body.surface))
  return res.status(201).json({ state })
}

export async function search(req, res) {
  const query = String(req.query.q || '')
  const local = searchDiscovery(req.user.id, query, { type: req.query.type, limit: req.query.limit, personalized: req.query.personalized })
  const semantic = await semanticEntitySearch(query, { type: req.query.type, limit: req.query.limit, userId: req.user.id, organizationId: req.user.activeContext?.organizationId, workspaceId: req.user.activeContext?.workspaceId }).catch(() => [])
  const semanticScores = new Map(semantic.map(item => [`${item.type}:${item.entityId}`, item.semanticScore]))
  local.results = local.results.map(item => ({ ...item, semanticScore: semanticScores.get(`${item.type}:${item.entityId}`) || 0 }))
    .sort((a, b) => (b.score + b.semanticScore * 0.15) - (a.score + a.semanticScore * 0.15))
  return res.json(local)
}
