// aiRouterClient.js
//
// Thin, dependency-free outbound client to the ai-router service.
// ai-router verifies the same HS256 JWT_SECRET as this backend, so we forward
// the end user's own Bearer token (see middlewares/auth.js -> req.user.token).
//
// This is used only to ENRICH real, already-computed aggregates with narrative
// recommendations. Every caller must degrade gracefully: if ai-router is
// unreachable this returns null and the caller falls back to deterministic,
// rule-based text. It never fabricates numeric data.

const AI_ROUTER_URL = (process.env.AI_ROUTER_URL || 'http://localhost:8000').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.AI_ROUTER_TIMEOUT_MS || '6000') || 6000

/**
 * Ask ai-router to compute a GSIS narrative for a set of component scores.
 * @param {string} token   Raw platform JWT to forward.
 * @param {Record<string, number>} componentScores  Real derived/aggregated scores.
 * @returns {Promise<object|null>}  ai-router output, or null on any failure.
 */
export async function computeGsisNarrative(token, componentScores) {
  if (!token) return null
  try {
    const res = await fetch(`${AI_ROUTER_URL}/api/v1/gsis/compute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ component_scores: componentScores, ...componentScores }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    const text = await res.text()
    return text ? JSON.parse(text) : null
  } catch {
    // Network error, timeout, ai-router down, bad JSON — degrade gracefully.
    return null
  }
}

/**
 * Best-effort extraction of a human-readable recommendation string from the
 * (LLM-driven, variable-shape) ai-router response. Returns null if none found.
 */
export function extractRecommendation(payload) {
  if (!payload || typeof payload !== 'object') return null
  const candidates = [
    payload.recommendation,
    payload.do_now,
    payload.narrative,
    payload.summary,
    payload.advice,
    payload.weekly_priority,
    Array.isArray(payload.next_steps) ? payload.next_steps[0] : null,
    Array.isArray(payload.recommendations) ? payload.recommendations[0] : null,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

export async function recordGsisRecommendationOutcome(token, recommendationId, outcome) {
  if (!token || !recommendationId) return null
  try {
    const res = await fetch(`${AI_ROUTER_URL}/api/v2/gsis/recommendations/${encodeURIComponent(recommendationId)}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(outcome),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function requestInvestorAdvisory(token, evidence) {
  if (!token) return null
  try {
    const res = await fetch(`${AI_ROUTER_URL}/api/v1/investor/intelligence/advisory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ evidence }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function requestOrganizationAdvisory(token, evidence) {
  if (!token) return null
  try {
    const res = await fetch(`${AI_ROUTER_URL}/api/v1/organization/intelligence/advisory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ evidence }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}
