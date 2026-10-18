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
import jwt from 'jsonwebtoken'
import { issueExecutionGrant } from './usageGrantService.js'

const AI_ROUTER_URL = (process.env.AI_ROUTER_URL || 'http://localhost:8000').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.AI_ROUTER_TIMEOUT_MS || '6000') || 6000
const MAX_IN_FLIGHT = Math.max(1, Number(process.env.AI_ROUTER_MAX_IN_FLIGHT || '64') || 64)
const MAX_QUEUE = Math.max(0, Number(process.env.AI_ROUTER_MAX_QUEUE || '256') || 256)
let inFlight = 0
const waiters = []
let circuitOpenedUntil = 0
let consecutiveFailures = 0

// Attach a backend-minted execution grant to every outbound router call so that
// flipping REQUIRE_AI_EXECUTION_GRANT=true on ai-router cannot 403 the platform.
// Defaults ON when grant signing material is configured; override with
// AI_ROUTER_ATTACH_EXECUTION_GRANT.
function grantAttachEnabled() {
  const flag = process.env.AI_ROUTER_ATTACH_EXECUTION_GRANT
  if (flag !== undefined && flag !== '') return ['1', 'true', 'yes'].includes(String(flag).toLowerCase())
  return Boolean(process.env.AI_EXECUTION_GRANT_SECRET || process.env.AI_EXECUTION_GRANT_PRIVATE_KEY || process.env.JWT_PRIVATE_KEY)
}

function tokenSubject(token) {
  try {
    const decoded = jwt.decode(token)
    return decoded && typeof decoded === 'object' ? String(decoded.sub || decoded.user_id || '') : ''
  } catch { return '' }
}

/**
 * Mint a short-lived grant for one backend->router call. The grant binds the
 * reservation to the caller's own subject. When the caller knows the exact
 * router task type it is bound to it; otherwise the reservation still records the
 * task and the router authorizes by subject + reservation + expiry.
 *
 * Non-fatal by design: on any failure the call proceeds without the header and
 * degrades exactly as before (callers already return null on router errors).
 */
function executionGrantHeader(token, { taskType, workspaceId } = {}) {
  if (!grantAttachEnabled() || !token) return null
  const userId = tokenSubject(token)
  if (!userId) return null
  try {
    const result = issueExecutionGrant({
      userId,
      requestId: `router_${crypto.randomUUID()}`,
      taskType: taskType || 'router_enrichment',
      workspaceId,
      estimatedCredits: 1,
      fundingSource: 'platform_subsidy',
      bindTaskType: Boolean(taskType),
    })
    return result && result.ok ? { 'X-AI-Execution-Grant': result.grant.token } : null
  } catch { return null }
}

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

async function requestJson(path, { method = 'POST', token, body, headers = {}, timeoutMs = TIMEOUT_MS, taskType, workspaceId } = {}) {
  if (Date.now() < circuitOpenedUntil) return null
  const requestHeaders = { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }
  if (token && !requestHeaders['X-AI-Execution-Grant']) {
    const grantHeaders = executionGrantHeader(token, { taskType, workspaceId })
    if (grantHeaders) Object.assign(requestHeaders, grantHeaders)
  }
  const release = await acquireSlot()
  try {
    let lastResponse = null
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(`${AI_ROUTER_URL}${path}`, {
          method,
          headers: requestHeaders,
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

function adminRouterServiceConfig() {
  const secret = process.env.ADMIN_AI_ROUTER_TELEMETRY_SECRET || ''
  const serviceId = process.env.ADMIN_AI_ROUTER_TELEMETRY_SERVICE_ID || 'platform-backend'
  return { secret, serviceId }
}

async function requestAdminRouter(path, { method = 'GET', body } = {}) {
  const { secret, serviceId } = adminRouterServiceConfig()
  if (!secret) return { ok: false, status: 503, error: 'admin_telemetry_service_not_configured' }
  const payload = body === undefined ? '' : JSON.stringify(body || {})
  const timestamp = String(Math.floor(Date.now() / 1000))
  // FastAPI's request.url.path excludes the query string; sign the same value
  // while still sending the query to the Router.
  const canonicalPath = path.split('?')[0]
  const canonical = `${timestamp}.${method}.${canonicalPath}.${payload}`
  const signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex')
  try {
    const response = await fetch(`${AI_ROUTER_URL}${path}`, {
      method,
      headers: {
        'X-TechIT-Service-Id': serviceId,
        'X-TechIT-Timestamp': timestamp,
        'X-TechIT-Signature': signature,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: payload }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
      let detail = null
      try { detail = await response.json() } catch { detail = null }
      return { ok: false, status: response.status, error: 'ai_router_admin_request_rejected', detail }
    }
    return { ok: true, status: response.status, data: await response.json() }
  } catch {
    return { ok: false, status: 502, error: 'ai_router_admin_request_unavailable' }
  }
}

export async function requestAdminRouterTelemetry() {
  const result = await requestAdminRouter('/internal/admin/telemetry')
  if (!result.ok) return result
  return { ...result, telemetry: result.data }
}

export async function requestAdminProviderStatus({ refreshCredentials = false } = {}) {
  const query = refreshCredentials ? '?refresh_credentials=true' : ''
  return requestAdminRouter(`/internal/admin/provider-status${query}`)
}

export async function requestAdminProviderRefresh(input = {}) {
  return requestAdminRouter('/internal/admin/provider-refresh', { method: 'POST', body: input })
}

export async function updateAdminProviderPolicy(input = {}) {
  return requestAdminRouter('/internal/admin/provider-policy', { method: 'PATCH', body: input })
}

export async function updateAdminModelLease(providerId, modelId, input = {}) {
  if (!providerId || !modelId) return { ok: false, status: 400, error: 'provider_and_model_required' }
  const path = `/internal/admin/model-leases/${encodeURIComponent(providerId)}/${encodeURIComponent(modelId)}`
  return requestAdminRouter(path, { method: 'PATCH', body: input })
}

/**
 * Ask ai-router to compute a GSIS narrative for a set of component scores.
 * @param {string} token   Raw platform JWT to forward.
 * @param {Record<string, number>} componentScores  Real derived/aggregated scores.
 * @returns {Promise<object|null>}  ai-router output, or null on any failure.
 */
export async function computeGsisNarrative(token, componentScores) {
  if (!token) return null
  try { return await requestJson('/api/v1/gsis/compute', { token, body: { component_scores: componentScores, ...componentScores }, taskType: 'gsis_compute' }) } catch { return null }
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
    }, workspaceId: routing.workspaceId })
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
      taskType: 'workspace_conversation',
      workspaceId: body && typeof body === 'object' ? (body.workspace_id || body.workspaceId) : undefined,
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
  try { return await requestJson(`/api/v1/investor/evi/${encodeURIComponent(projectId)}`, { token, body: startupData || {}, taskType: 'investor_evi' }) } catch { return null }
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
  try { return await requestJson('/api/v1/incubation/evidence/research', { token, body: evidence || {}, headers: { 'X-AI-Execution-Grant': executionGrant }, taskType: 'evidence_research' }) } catch { return null }
}

export async function requestSupportIntelligence(token, input = {}) {
  if (!token) return null
  try { return await requestJson('/api/v1/support/intelligence', { token, body: input, taskType: 'customer_support_intelligence' }) } catch { return null }
}

export async function requestAcademyEnrichment(token, input = {}) {
  if (!token) return null
  try { return await requestJson('/api/v1/training/modules/enrich', { token, body: input, taskType: 'training_generation' }) } catch { return null }
}

export async function requestAcademyModuleGeneration(token, input = {}) {
  if (!token) return null
  try { return await requestJson('/api/v1/training/modules/generate', { token, body: input, taskType: 'training_generation' }) } catch { return null }
}

export async function requestAcademyExerciseReview(token, input = {}) {
  if (!token) return null
  try { return await requestJson('/api/v1/training/exercises/review', { token, body: input, taskType: 'training_generation' }) } catch { return null }
}
