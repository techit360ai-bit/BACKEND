// Backend -> AI-router trust adapter client.
//
// The AI-router owns privacy normalization (dropping forbidden fields). This
// client forwards signed, metadata-only payloads to it.
//
// Security: adapter normalization trusts supplied metadata, so this client is
// ONLY safe for server-observed results (a trusted worker that already fetched
// provider data) or for read-only previews. The founder-facing route must never
// use it to mint verified proofs from caller input. `buildTrustAdapterHeaders`
// is pure and unit-tested.

import crypto from 'node:crypto'

const TIMEOUT_MS = () => Number(process.env.TRUST_ADAPTER_TIMEOUT_MS || 8000) || 8000

const routerUrl = (env = process.env) => String(env.AI_ROUTER_URL || '').replace(/\/$/, '')
const signingSecret = (env = process.env) => String(env.AI_ROUTER_TRUST_SECRET || env.TRUST_PROJECTION_SECRET || '').trim()

export function buildTrustAdapterHeaders({ method = 'POST', path, rawBody = '', env = process.env, now = Date.now() } = {}) {
  const headers = {
    'content-type': 'application/json',
    'x-trust-authority': 'backend',
    'x-techit-service-id': String(env.AI_ROUTER_TRUST_SERVICE_ID || 'platform-backend'),
  }
  const secret = signingSecret(env)
  const body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {})
  if (secret) {
    const timestamp = String(Math.floor(now / 1000))
    headers['x-trust-timestamp'] = timestamp
    headers['x-trust-signature'] = crypto.createHmac('sha256', secret).update(`${timestamp}.${method.toUpperCase()}.${path}.${body}`).digest('hex')
  }
  return headers
}

async function postTrust(path, { token, body, env = process.env } = {}) {
  const base = routerUrl(env)
  if (!base) return { ok: false, status: 503, error: 'ai_router_not_configured' }
  const raw = JSON.stringify(body || {})
  const headers = buildTrustAdapterHeaders({ method: 'POST', path, rawBody: raw, env })
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers, body: raw, signal: AbortSignal.timeout(TIMEOUT_MS()) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, status: response.status, error: data?.detail || 'trust_adapter_rejected', data }
    return { ok: true, status: response.status, data }
  } catch (error) {
    return { ok: false, status: 502, error: 'trust_adapter_unavailable', detail: error.message }
  }
}

export const verifyTrustAdapter = (provider, body, { token, env } = {}) =>
  postTrust(`/api/v1/trust/adapters/${encodeURIComponent(provider)}/verify`, { token, body, env })

export const getTrustRefreshPlan = (body, { token, env } = {}) =>
  postTrust('/api/v1/trust/refresh-plan', { token, body, env })

export const runTrustContinuousVerification = (body, { token, env } = {}) =>
  postTrust('/api/v1/trust/continuous-verification/run', { token, body, env })

export const submitTrustMilestone = (body, { token, env } = {}) =>
  postTrust('/api/v1/trust/milestone', { token, body, env })

export const reviewTrustMilestone = (body, { token, env } = {}) =>
  postTrust('/api/v1/trust/milestone/review', { token, body, env })

export const inviteTrustTeamMember = (body, { token, env } = {}) =>
  postTrust('/api/v1/trust/team/invite', { token, body, env })

export const verifyTrustTeamMember = (body, { token, env } = {}) =>
  postTrust('/api/v1/trust/team/verify', { token, body, env })

export const previewTrustShareProfile = (body, { token, env } = {}) =>
  postTrust('/api/v1/trust/share-profile/preview', { token, body, env })
