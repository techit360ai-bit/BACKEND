// Read-only product-analytics adapters (WS4).
//
// Metrics are fetched from the founder's own analytics provider with a read-only
// credential and reduced server-side. The verified path never accepts
// client-supplied MAU/DAU: only provider responses (or a pre-minted Google
// access token) feed `buildMetrics`.
//
// `buildMetrics` and the `normalize*` reducers are pure and unit tested. Network
// calls go through safeFetch with a host allow-list.

import crypto from 'node:crypto'
import { safeFetch } from './outboundHttpService.js'
import { findAnalyticsProvider, resolveAnalyticsConfig } from '../config/trustAnalyticsSources.js'

const int = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
}
// Accepts either 0..1 or 0..100 and returns a clamped fraction (null if absent).
export function toFraction(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  const fraction = parsed > 1 ? parsed / 100 : parsed
  return Math.round(Math.min(1, fraction) * 1e6) / 1e6
}

// Pure reducer: turns provider-reported period actives + rates into the canonical
// metrics envelope. `now` is injectable for deterministic tests.
export function buildMetrics({ mau, dau, wau, retentionD1, retentionD7, retentionD30, activationRate, asOf, now = Date.now(), windowDays = 30 } = {}) {
  const asOfIso = asOf ? new Date(asOf).toISOString() : null
  const asOfTime = asOfIso ? new Date(asOfIso).getTime() : null
  const freshnessHours = asOfTime && Number.isFinite(asOfTime) ? Math.max(0, Math.round(((now - asOfTime) / 3600000) * 100) / 100) : null
  return {
    mau: int(mau),
    dau: int(dau),
    wau: int(wau),
    retention_d1: toFraction(retentionD1),
    retention_d7: toFraction(retentionD7),
    retention_d30: toFraction(retentionD30),
    activation_rate: toFraction(activationRate),
    as_of: asOfIso,
    freshness_hours: freshnessHours,
    window_days: int(windowDays) || 30,
  }
}

export function normalizePosthogScalar(payload) {
  const row = payload?.results?.[0]
  if (Array.isArray(row)) return int(row[0])
  if (row && typeof row === 'object') return int(Object.values(row)[0])
  return 0
}

export function normalizeGa4Report(report = {}) {
  const row = report?.rows?.[0]?.metricValues || []
  const byHeader = new Map((report?.metricHeaders || []).map((header, index) => [String(header?.name || index), index]))
  const read = name => (byHeader.has(name) ? int(row[byHeader.get(name)]?.value) : 0)
  const readRaw = name => (byHeader.has(name) ? row[byHeader.get(name)]?.value : undefined)
  return {
    dau: read('active1DayUsers') || read('activeUsers'),
    wau: read('active7DayUsers') || read('activeUsers'),
    mau: read('active28DayUsers') || read('activeUsers'),
    activationRate: toFraction(readRaw('engagementRate')),
  }
}

export function normalizeMixpanelSeries(payload = {}) {
  const values = payload?.data?.values || payload?.values || {}
  const series = Object.values(payload?.data?.series || payload?.series || {})
  const peak = series.reduce((max, list) => Math.max(max, ...(Array.isArray(list) ? list.map(int) : [0])), 0)
  return {
    mau: int(values.month ?? values.$month ?? peak),
    wau: int(values.week ?? values.$week),
    dau: int(values.day ?? values.$day),
    activationRate: toFraction(values.activation_rate ?? values.activationRate),
  }
}

export function normalizeAmplitudeSeries(payload = {}) {
  const series = payload?.data?.series || []
  const xValues = payload?.data?.xValues || []
  const latest = series.map(list => (Array.isArray(list) && list.length ? int(list[list.length - 1]) : 0))
  const peak = series.reduce((max, list) => Math.max(max, ...(Array.isArray(list) ? list.map(int) : [0])), 0)
  return {
    dau: latest[0] || 0,
    wau: peak,
    mau: peak,
    activationRate: null,
    asOf: xValues.length ? xValues[xValues.length - 1] : null,
  }
}

// --- network fetchers -------------------------------------------------------

async function getJson(fetchImpl, url, { method = 'GET', headers, body, timeoutMs, hosts }) {
  const response = await fetchImpl(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) }, { schemes: ['https'], allowHosts: hosts })
  if (!response.ok) return { ok: false, status: response.status, error: 'analytics_provider_rejected' }
  const data = await response.json().catch(() => null)
  if (!data) return { ok: false, status: 502, error: 'analytics_provider_invalid_response' }
  return { ok: true, data }
}

async function posthogScalar({ fetchImpl, host, projectId, apiKey, sql, timeoutMs, hosts }) {
  const result = await getJson(fetchImpl, `${host.replace(/\/$/, '')}/api/projects/${encodeURIComponent(projectId)}/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
    timeoutMs,
    hosts,
  })
  if (!result.ok) return result
  return { ok: true, value: normalizePosthogScalar(result.data) }
}

async function fetchPosthog(credential, { config, fetchImpl, env, subject }, entry) {
  const projectId = String(subject || env[entry.subject_env[0]] || '').trim()
  if (!projectId) return { ok: false, status: 400, error: 'analytics_subject_required' }
  const host = String(env[entry.host_env] || entry.base_url).trim()
  const hosts = [new URL(host).hostname, ...entry.hosts]
  const base = 'SELECT uniq(distinct_id) FROM events WHERE timestamp >= now()'
  const [dau, wau, mau] = await Promise.all([
    posthogScalar({ fetchImpl, host, projectId, apiKey: credential, sql: `${base} - INTERVAL 1 DAY`, timeoutMs: config.timeoutMs, hosts }),
    posthogScalar({ fetchImpl, host, projectId, apiKey: credential, sql: `${base} - INTERVAL 7 DAY`, timeoutMs: config.timeoutMs, hosts }),
    posthogScalar({ fetchImpl, host, projectId, apiKey: credential, sql: `${base} - INTERVAL 30 DAY`, timeoutMs: config.timeoutMs, hosts }),
  ])
  const failed = [dau, wau, mau].find(item => !item.ok)
  if (failed) return failed
  return { ok: true, provider: 'posthog', subject: projectId, accountDomain: null, metrics: buildMetrics({ mau: mau.value, dau: dau.value, wau: wau.value, asOf: new Date().toISOString(), windowDays: config.windowDays }) }
}

async function googleAccessToken(credential, { fetchImpl, timeoutMs }) {
  const value = String(credential || '').trim()
  if (!value.startsWith('{')) return value // already an access token
  let account
  try { account = JSON.parse(value) } catch { return null }
  if (!account.client_email || !account.private_key) return null
  const iat = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const claim = Buffer.from(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })).toString('base64url')
  const signature = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claim}`), account.private_key).toString('base64url')
  const assertion = `${header}.${claim}.${signature}`
  const result = await getJson(fetchImpl, 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    timeoutMs,
    hosts: ['oauth2.googleapis.com'],
  })
  if (!result.ok) return null
  return String(result.data?.access_token || '') || null
}

async function fetchGoogleAnalytics(provider, credential, { config, fetchImpl, env, subject }, entry) {
  const propertyId = String(subject || env[entry.subject_env[0]] || '').trim()
  if (!propertyId) return { ok: false, status: 400, error: 'analytics_subject_required' }
  const token = await googleAccessToken(credential, { fetchImpl, timeoutMs: config.timeoutMs })
  if (!token) return { ok: false, status: 401, error: 'analytics_credential_invalid' }
  const result = await getJson(fetchImpl, `${entry.base_url}/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate: `${config.windowDays}daysAgo`, endDate: 'today' }], metrics: [{ name: 'active1DayUsers' }, { name: 'active7DayUsers' }, { name: 'active28DayUsers' }] }),
    timeoutMs: config.timeoutMs,
    hosts: entry.hosts,
  })
  if (!result.ok) return result
  const metrics = normalizeGa4Report(result.data)
  return { ok: true, provider, subject: propertyId, accountDomain: null, metrics: buildMetrics({ ...metrics, asOf: new Date().toISOString(), windowDays: config.windowDays }) }
}

async function fetchAmplitude(credential, { config, fetchImpl, env, subject }, entry) {
  // Amplitude needs both halves; accept `apiKey:secretKey` (or apiKey + subject).
  const [apiKey, secret] = String(credential).includes(':') ? String(credential).split(':') : [String(credential), String(subject || env[entry.subject_env[0]] || '')]
  if (!apiKey || !secret) return { ok: false, status: 400, error: 'analytics_subject_required' }
  const auth = Buffer.from(`${apiKey}:${secret}`).toString('base64')
  const end = new Date()
  const start = new Date(end.getTime() - config.windowDays * 86400000)
  const fmt = date => date.toISOString().slice(0, 10).replace(/-/g, '')
  const result = await getJson(fetchImpl, `${entry.base_url}/api/2/users?start=${fmt(start)}&end=${fmt(end)}&m=active`, {
    headers: { authorization: `Basic ${auth}`, accept: 'application/json' }, timeoutMs: config.timeoutMs, hosts: entry.hosts,
  })
  if (!result.ok) return result
  const metrics = normalizeAmplitudeSeries(result.data)
  return { ok: true, provider: 'amplitude', subject: null, accountDomain: null, metrics: buildMetrics({ ...metrics, asOf: new Date().toISOString(), windowDays: config.windowDays }) }
}

async function fetchMixpanel(credential, { config, fetchImpl, env, subject }, entry) {
  const projectId = String(subject || env[entry.subject_env[0]] || '').trim()
  const secret = String(env.MIXPANEL_API_SECRET || '').trim() || credential
  if (!projectId || !secret) return { ok: false, status: 400, error: 'analytics_subject_required' }
  const auth = Buffer.from(`${secret}:`).toString('base64')
  const result = await getJson(fetchImpl, `${entry.base_url}/api/query/insights?project_id=${encodeURIComponent(projectId)}&interval=30`, {
    headers: { authorization: `Basic ${auth}`, accept: 'application/json' }, timeoutMs: config.timeoutMs, hosts: entry.hosts,
  })
  if (!result.ok) return result
  const metrics = normalizeMixpanelSeries(result.data)
  return { ok: true, provider: 'mixpanel', subject: projectId, accountDomain: null, metrics: buildMetrics({ ...metrics, asOf: new Date().toISOString(), windowDays: config.windowDays }) }
}

const FETCHERS = { posthog: fetchPosthog, ga4: (c, ctx, e) => fetchGoogleAnalytics('ga4', c, ctx, e), firebase: (c, ctx, e) => fetchGoogleAnalytics('firebase', c, ctx, e), amplitude: fetchAmplitude, mixpanel: fetchMixpanel }

export async function fetchProviderAnalytics(provider, credential, { env = process.env, fetchImpl = safeFetch, subject = null } = {}) {
  const key = String(provider || '').toLowerCase()
  const entry = findAnalyticsProvider(key)
  if (!entry) return { ok: false, status: 404, error: 'unsupported_analytics_provider' }
  if (entry.implementation === 'producer_required') return { ok: false, status: 501, error: 'provider_producer_not_wired' }
  const fetcher = FETCHERS[key]
  if (!fetcher) return { ok: false, status: 501, error: 'analytics_provider_not_implemented' }
  const config = resolveAnalyticsConfig(env)
  try {
    return await fetcher(credential, { config, fetchImpl, env, subject }, entry)
  } catch (error) {
    const code = /timeout|abort/i.test(error?.name || '') ? 'analytics_provider_timeout' : 'analytics_provider_unavailable'
    return { ok: false, status: 502, error: code, detail: error?.message }
  }
}
