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

import crypto from 'node:crypto'

const AI_ROUTER_URL = (process.env.AI_ROUTER_URL || 'http://localhost:8000').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.AI_ROUTER_TIMEOUT_MS || '6000') || 6000
const MAX_IN_FLIGHT = Math.max(1, Number(process.env.AI_ROUTER_MAX_IN_FLIGHT || '64') || 64)
const MAX_QUEUE = Math.max(0, Number(process.env.AI_ROUTER_MAX_QUEUE || '256') || 256)
let inFlight = 0
const waiters = []
let circuitOpenedUntil = 0
let consecutiveFailures = 0

async function acquireSlot() {
  if (inFlight < MAX_IN_FLIGHT) { inFlight += 1; return () => releaseSlot() }
  if (waiters.length >= MAX_QUEUE) throw new Error('ai_router_capacity_exhausted')
  await new Promise(resolve => waiters.push(resolve))
  inFlight += 1
  return () => releaseSlot()
}

function releaseSlot() {
  inFlight = Math.max(0, inFlight - 1)
  const next = waiters.shift()
  if (next) next()
}

async function requestJson(path, { method = 'POST', token, body, headers = {}, timeoutMs = TIMEOUT_MS } = {}) {
  if (Date.now() < circuitOpenedUntil) return null
  const release = await acquireSlot()
  try {
    let lastResponse = null
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(`${AI_ROUTER_URL}${path}`, {
          method,
          headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(timeoutMs),
        })
        lastResponse = response
        if (response.ok) {
          consecutiveFailures = 0
          return await response.json()
        }
        if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break
        const retryAfter = Number(response.headers.get('retry-after'))
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 100 * (2 ** attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      } catch (error) {
        if (attempt === 2) throw error
        await new Promise(resolve => setTimeout(resolve, 100 * (2 ** attempt)))
      }
    }
    if (lastResponse && [429, 500, 502, 503, 504].includes(lastResponse.status)) {
      consecutiveFailures += 1
      if (consecutiveFailures >= 3) circuitOpenedUntil = Date.now() + 10_000
    }
    return null
  } finally {
    release()
  }
}

export async function requestAdminRouterTelemetry() {
  const secret = process.env.ADMIN_AI_ROUTER_TELEMETRY_SECRET || ''
  const serviceId = process.env.ADMIN_AI_ROUTER_TELEMETRY_SERVICE_ID || 'platform-backend'
  if (!secret) return { ok: false, status: 503, error: 'admin_telemetry_service_not_configured' }
  const path = '/internal/admin/telemetry'
  const timestamp = String(Math.floor(Date.now() / 1000))
  const canonical = `${timestamp}.GET.${path}.`
  const signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex')
  try {
    const response = await fetch(`${AI_ROUTER_URL}${path}`, {
      headers: {
        'X-TechIT-Service-Id': serviceId,
        'X-TechIT-Timestamp': timestamp,
        'X-TechIT-Signature': signature,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return { ok: false, status: response.status, error: 'ai_router_admin_telemetry_rejected' }
    return { ok: true, status: 200, telemetry: await response.json() }
  } catch {
    return { ok: false, status: 502, error: 'ai_router_admin_telemetry_unavailable' }
  }
}

/**
 * Ask ai-router to compute a GSIS narrative for a set of component scores.
 * @param {string} token   Raw platform JWT to forward.
 * @param {Record<string, number>} componentScores  Real derived/aggregated scores.
 * @returns {Promise<object|null>}  ai-router output, or null on any failure.
 */
export async function computeGsisNarrative(token, componentScores) {
  if (!token) return null
  try { return await requestJson('/api/v1/gsis/compute', { token, body: { component_scores: componentScores, ...componentScores } }) } catch { return null }
}

// Workspace callers can attach an explicit provider funding policy. The router
// remains responsible for provider execution; this metadata prevents a BYOK
// request from being silently billed to TechIT when a personal connection fails.
export async function requestWorkspaceAI(token, input, routing = {}) {
  if (!token) return null
  try {
    return await requestJson('/api/v1/workspace/execute', { token, body: {
      ...input,
      workspace_id: routing.workspaceId,
      provider_mode: routing.providerMode || 'platform',
      connection_id: routing.connectionId || undefined,
      model_id: routing.modelId || undefined,
      operation: routing.operation || 'chat',
      privacy_policy_version: routing.privacyPolicyVersion || 'workspace-byok-v1',
    } })
  } catch { return null }
}

/**
 * Workspace copilot / agent conversation. Used by the coding area and the
 * Agents console. Returns null when ai-router is unavailable so callers can
 * degrade honestly instead of inventing an answer.
 */
export async function requestWorkspaceConversation(token, body) {
  if (!token) return null
  try {
    return await requestJson('/api/v1/workspace/conversation', {
      token,
      body,
      timeoutMs: Number(process.env.AI_ROUTER_WORKSPACE_TIMEOUT_MS || '45000') || 45_000,
    })
  } catch { return null }
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
  try { return await requestJson(`/api/v2/gsis/recommendations/${encodeURIComponent(recommendationId)}/outcome`, { token, body: outcome }) } catch { return null }
}

export async function requestInvestorAdvisory(token, evidence) {
  if (!token) return null
  try { return await requestJson('/api/v1/investor/intelligence/advisory', { token, body: { evidence } }) } catch { return null }
}

export async function requestInvestorEvi(token, projectId, startupData) {
  if (!token || !projectId) return null
  try { return await requestJson(`/api/v1/investor/evi/${encodeURIComponent(projectId)}`, { token, body: startupData || {} }) } catch { return null }
}

export async function requestOrganizationAdvisory(token, evidence) {
  if (!token) return null
  try { return await requestJson('/api/v1/organization/intelligence/advisory', { token, body: { evidence } }) } catch { return null }
}

/**
 * Request non-authoritative AI analysis of verification evidence.
 * Deterministic assurance and authorization remain owned by the backend.
 */
export async function analyzeVerificationEvidence(token, executionGrant, evidence) {
  if (!token || !executionGrant) return null
  try { return await requestJson('/api/v1/incubation/evidence/research', { token, body: evidence || {}, headers: { 'X-AI-Execution-Grant': executionGrant } }) } catch { return null }
}

export async function requestSupportIntelligence(token, input = {}) {
  if (!token) return null
  try { return await requestJson('/api/v1/support/intelligence', { token, body: input }) } catch { return null }
}

export async function requestAcademyEnrichment(token, input = {}) {
  if (!token) return null
  try { return await requestJson('/api/v1/training/modules/enrich', { token, body: input }) } catch { return null }
}

export async function requestAcademyModuleGeneration(token, input = {}) {
  if (!token) return null
  try { return await requestJson('/api/v1/training/modules/generate', { token, body: input }) } catch { return null }
}

export async function requestAcademyExerciseReview(token, input = {}) {
  if (!token) return null
  try { return await requestJson('/api/v1/training/exercises/review', { token, body: input }) } catch { return null }
}
