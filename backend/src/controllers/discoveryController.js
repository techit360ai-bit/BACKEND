import {
  completeCatchUp,
  getRecommendations,
  getReturnSummary,
  markCatchUpItem,
  noteUserActivity,
  recordExposure,
  recordFeedback,
  recordRecommendationEvent,
  updateRecommendationProfile,
} from '../services/discoveryService.js'

function badRequest(res, error) {
  return res.status(400).json({ error: error instanceof Error ? error.message : String(error) })
}

export function listRecommendations(req, res) {
  const result = getRecommendations(req.user.id, {
    surface: req.query.surface,
    type: req.query.type,
    limit: req.query.limit,
  })
  return res.json(result)
}

export function putRecommendationProfile(req, res) {
  const profile = updateRecommendationProfile(req.user.id, req.body)
  if (!profile) return res.status(404).json({ error: 'Profile not found' })
  return res.json({ profile })
}

export function createRecommendationEvent(req, res) {
  try {
    const event = recordRecommendationEvent(req.user.id, req.body)
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
    return res.status(201).json({ feedback })
  } catch (error) {
    return badRequest(res, error)
  }
}

export function returnSummary(req, res) {
  return res.json(getReturnSummary(req.user.id))
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
