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

function badRequest(res, error) {
  return res.status(400).json({ error: error instanceof Error ? error.message : String(error) })
}

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
  await Promise.allSettled([setCachedDiscovery(cacheKey, result), persistDiscoveryBatch(result)])
  return res.json({ ...result, intelligence: { schema_version: 'intelligence-v1', deterministic: intelligenceFlags.deterministicEnabled, ai_enrichment: false } })
}

export function putRecommendationProfile(req, res) {
  const profile = updateRecommendationProfile(req.user.id, req.body)
  if (!profile) return res.status(404).json({ error: 'Profile not found' })
  void invalidateDiscoveryUser(req.user.id)
  void enqueueDiscoveryRefresh(req.user.id, 'profile_updated')
  return res.json({ profile })
}

export function createRecommendationEvent(req, res) {
  try {
    const event = recordRecommendationEvent(req.user.id, req.body)
    void invalidateDiscoveryUser(req.user.id)
    void enqueueDiscoveryRefresh(req.user.id, event.eventType)
    return res.status(201).json({ event })
  } catch (error) {
    return badRequest(res, error)
  }
}

export function createExposure(req, res) {
  const exposure = recordExposure(req.user.id, req.params.id, req.body)
  if (!exposure) return res.status(404).json({ error: 'Recommendation not found' })
  return res.status(201).json({ exposure })
}

export function createFeedback(req, res) {
  try {
    const feedback = recordFeedback(req.user.id, req.params.id, req.body)
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

export function markCatchUpSeen(req, res) {
  const state = markCatchUpItem(req.user.id, req.params.id, req.body.action)
  if (!state) return res.status(404).json({ error: 'Active catch-up session not found' })
  return res.json({ state })
}

export function finishCatchUp(req, res) {
  const result = completeCatchUp(req.user.id)
  if (!result) return res.status(404).json({ error: 'Active catch-up session not found' })
  return res.json(result)
}

export function recordActivity(req, res) {
  const eventType = String(req.body.eventType || '').trim().toLowerCase()
  if (!eventType) return res.status(400).json({ error: 'eventType is required' })
  const state = noteUserActivity(req.user.id, eventType, req.body.surface)
  return res.status(201).json({ state })
}

export async function search(req, res) {
  const query = String(req.query.q || '')
  const local = searchDiscovery(req.user.id, query, { type: req.query.type, limit: req.query.limit, personalized: req.query.personalized })
  const semantic = await semanticEntitySearch(query, { type: req.query.type, limit: req.query.limit }).catch(() => [])
  const semanticScores = new Map(semantic.map(item => [`${item.type}:${item.entityId}`, item.semanticScore]))
  local.results = local.results.map(item => ({ ...item, semanticScore: semanticScores.get(`${item.type}:${item.entityId}`) || 0 }))
    .sort((a, b) => (b.score + b.semanticScore * 0.15) - (a.score + a.semanticScore * 0.15))
  return res.json(local)
}
