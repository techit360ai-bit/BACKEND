import { intelligenceFlags } from './featureFlags.js'

const ALLOWED_TASKS = new Set(['gsis_explanation', 'recommendation_summary', 'evidence_gap', 'training_coaching', 'admin_anomaly'])
const timeoutMs = Math.max(500, Number(process.env.AI_NARRATIVE_TIMEOUT_MS || 4000))
const maxInput = Math.max(256, Number(process.env.AI_NARRATIVE_MAX_INPUT_CHARS || 8000))
const cache = new Map()
let failures = 0
let circuitOpenedAt = 0

export async function requestNarrative({ task, payload, token, cacheKey = task, ttlMs = 300_000 } = {}) {
  if (!intelligenceFlags.narrativeEnrichmentEnabled || !ALLOWED_TASKS.has(task) || !token) return null
  if (failures >= 3 && Date.now() - circuitOpenedAt < 30_000) return null
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const url = `${(process.env.AI_ROUTER_URL || '').replace(/\/$/, '')}/api/v1/intelligence/narrative`
  if (url === '/api/v1/intelligence/narrative') return null
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ task, payload: JSON.stringify(payload || {}).slice(0, maxInput) }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`narrative_http_${response.status}`)
    const value = await response.json()
    failures = 0
    cache.set(cacheKey, { value, expiresAt: Date.now() + ttlMs })
    return value
  } catch {
    failures += 1
    circuitOpenedAt = Date.now()
    return null
  }
}
