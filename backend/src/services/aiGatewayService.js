import crypto from 'node:crypto'
import { issueExecutionGrantAsync } from './usageGrantService.js'
import { resolveGatewayTarget } from './aiGatewayPolicy.js'

const active = new Map()
const PASS = ['content-type', 'content-disposition', 'etag', 'retry-after']
const num = (name, fallback) => Number(process.env[name] || '') || fallback

// Authenticated pass-through to ai-router: the user's own token plus a fresh backend-signed execution grant.
export async function forwardToAiRouter(req, res) {
  const target = resolveGatewayTarget(req.method, req.url)
  if (!target.ok) return res.status(target.status).json({ error: target.error })
  const write = !['GET', 'HEAD'].includes(req.method)
  if (write && String(req.headers['content-type'] || '').startsWith('multipart/')) return res.status(415).json({ error: 'unsupported_media_type' })
  const userId = req.user.id
  if (write) {
    const running = active.get(userId) || 0
    if (running >= num('AI_GATEWAY_MAX_CONCURRENT_WRITES', 3)) return res.status(429).json({ error: 'too_many_concurrent_ai_requests' })
    active.set(userId, running + 1)
  }
  const ac = new AbortController()
  res.on('close', () => { if (!res.writableEnded) ac.abort() })
  const timer = setTimeout(() => ac.abort(), num('AI_GATEWAY_TIMEOUT_MS', 120000))
  try {
    const grant = await issueExecutionGrantAsync({
      userId, requestId: `gw_${crypto.randomUUID()}`, taskType: `gateway:${target.path.split('/')[3]}`,
      workspaceId: req.user.workspaceId, estimatedCredits: 1,
      fundingSource: process.env.AI_GATEWAY_FUNDING_SOURCE || 'platform_subsidy', bindTaskType: false,
      // Subscribed or paying accounts get the premium chain; everyone else runs
      // on the Router's standard-tier (fallback) providers.
      routingTier: req.user.accountEntitlement?.active ? 'premium' : 'standard',
    })
    if (!grant.ok) {
      console.error(JSON.stringify({ event: 'ai_gateway_grant_failed', requestId: req.id, error: grant.error }))
      return res.status(503).json({ error: 'ai_grant_unavailable' })
    }
    const headers = { Authorization: `Bearer ${req.user.token}`, 'X-AI-Execution-Grant': grant.grant.token, Accept: req.get('accept') || 'application/json' }
    if (req.get('if-none-match')) headers['If-None-Match'] = req.get('if-none-match')
    const hasBody = write && req.body !== undefined
    if (hasBody) headers['Content-Type'] = 'application/json'
    const base = String(process.env.AI_ROUTER_URL || 'http://localhost:8000').replace(/\/$/, '')
    const upstream = await fetch(`${base}${target.path}${target.query ? `?${target.query}` : ''}`, {
      method: req.method, headers, signal: ac.signal, ...(hasBody ? { body: JSON.stringify(req.body) } : {}),
    })
    if (String(upstream.headers.get('content-type') || '').includes('text/event-stream')) {
      ac.abort()
      return res.status(501).json({ error: 'streaming_not_supported' })
    }
    for (const name of PASS) { const value = upstream.headers.get(name); if (value) res.setHeader(name, value) }
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    const timedOut = error?.name === 'AbortError' || error?.name === 'TimeoutError'
    console.error(JSON.stringify({ event: 'ai_gateway_failed', requestId: req.id, path: target.path, error: String(error?.message || error).slice(0, 200) }))
    if (!res.headersSent) return res.status(timedOut ? 504 : 502).json({ error: timedOut ? 'ai_router_timeout' : 'ai_router_unreachable' })
    return res.end()
  } finally {
    clearTimeout(timer)
    if (write) { const left = (active.get(userId) || 1) - 1; if (left > 0) active.set(userId, left); else active.delete(userId) }
  }
}
