// Read-only shipping / deployment cadence adapters (WS5).
//
// Cadence metrics are derived server-side from the founder's own CI/CD provider
// with a read-only credential. The verified path never accepts client-supplied
// deploy/PR counts: only provider responses feed `buildCadence`.
//
// `buildCadence` and the `normalize*` reducers are pure and unit tested. Network
// calls go through safeFetch with a host allow-list.

import { safeFetch } from './outboundHttpService.js'
import { findShippingProvider, resolveShippingConfig } from '../config/trustShippingSources.js'

const int = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
}
const timeOf = value => {
  if (value === null || value === undefined || value === '') return null
  const ms = typeof value === 'number' ? value : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

// Accepts 0..1 or 0..100 and returns a clamped fraction (null if absent).
export function toFraction(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  const fraction = parsed > 1 ? parsed / 100 : parsed
  return Math.round(Math.min(1, fraction) * 1e6) / 1e6
}

function countInWindow(items, fromMs, toMs) {
  return items.filter(item => item.at != null && item.at >= fromMs && item.at <= toMs).length
}

// Pure reducer: turns provider-reported delivery events into the canonical
// cadence envelope. `now` is injectable for deterministic tests.
export function buildCadence({ deploys = [], mergedPrs = [], releases = [], uptimes = [], leadTimeHours = [], now = Date.now(), windowDays = 30 } = {}) {
  const asOf = new Date(now).toISOString()
  const primaryMs = Math.max(1, int(windowDays) || 30) * 86400000
  const extendedMs = primaryMs * 3
  const from30 = now - primaryMs
  const from90 = now - extendedMs

  const deploys30 = deploys.filter(item => item.at != null && item.at >= from30 && item.at <= now)
  const successful30 = deploys30.filter(item => item.success === true)
  const lastDeploy = deploys.reduce((max, item) => (item.at != null && item.at > max ? item.at : max), 0)
  const uptimeValues = uptimes.map(toFraction).filter(value => value != null)
  const leadValues = leadTimeHours.map(value => Number(value)).filter(value => Number.isFinite(value) && value >= 0)

  return {
    deploys_30d: deploys30.length,
    deploys_90d: countInWindow(deploys, from90, now),
    deploy_success_rate_30d: deploys30.length ? Math.round((successful30.length / deploys30.length) * 1e6) / 1e6 : null,
    last_deploy_at: lastDeploy ? new Date(lastDeploy).toISOString() : null,
    merged_prs_30d: countInWindow(mergedPrs, from30, now),
    merged_prs_90d: countInWindow(mergedPrs, from90, now),
    releases_30d: countInWindow(releases, from30, now),
    releases_90d: countInWindow(releases, from90, now),
    uptime_30d: uptimeValues.length ? Math.round((uptimeValues.reduce((sum, value) => sum + value, 0) / uptimeValues.length) * 1e6) / 1e6 : null,
    lead_time_hours: leadValues.length ? Math.round((leadValues.reduce((sum, value) => sum + value, 0) / leadValues.length) * 100) / 100 : null,
    as_of: asOf,
    freshness_hours: 0,
    window_days: int(windowDays) || 30,
  }
}

// --- provider normalizers ---------------------------------------------------

export function normalizeGithubActions({ runs = [], pulls = [], releases = [] } = {}) {
  const deploys = runs
    .filter(run => run && (run.status === 'completed' || run.conclusion))
    .map(run => ({
      at: timeOf(run.updated_at || run.created_at),
      success: String(run.conclusion || '').toLowerCase() === 'success',
    }))
    .filter(item => item.at != null)
  const mergedPrs = pulls
    .map(pr => ({ at: timeOf(pr.merged_at) }))
    .filter(item => item.at != null)
  const releaseEvents = releases
    .map(release => ({ at: timeOf(release.published_at || release.created_at) }))
    .filter(item => item.at != null)
  return { deploys, mergedPrs, releases: releaseEvents }
}

export function normalizeVercelDeployments(list = []) {
  return {
    deploys: (Array.isArray(list) ? list : []).map(item => ({
      at: timeOf(item?.createdAt ?? item?.created ?? item?.buildingAt),
      success: String(item?.state || item?.readyState || '').toUpperCase() === 'READY',
    })).filter(item => item.at != null),
    uptimes: [],
  }
}

export function normalizeRenderDeploys(list = []) {
  return {
    deploys: (Array.isArray(list) ? list : []).map(item => {
      const deploy = item?.deploy || item
      const status = String(deploy?.status || '').toLowerCase()
      return { at: timeOf(deploy?.finishedAt || deploy?.createdAt), success: status === 'live' }
    }).filter(item => item.at != null),
    uptimes: [],
  }
}

export function normalizeRailwayDeployments(list = []) {
  return {
    deploys: (Array.isArray(list) ? list : []).map(item => ({
      at: timeOf(item?.createdAt),
      success: String(item?.status || '').toUpperCase() === 'SUCCESS',
    })).filter(item => item.at != null),
    uptimes: [],
  }
}

export function normalizeCloudflareDeployments(list = []) {
  return {
    deploys: (Array.isArray(list) ? list : []).map(item => ({
      at: timeOf(item?.created_on),
      success: ['success', 'active'].includes(String(item?.latest_stage?.status || item?.stage?.status || '').toLowerCase()),
    })).filter(item => item.at != null),
    uptimes: [],
  }
}

export function normalizeNetlifyDeploys(list = []) {
  return {
    deploys: (Array.isArray(list) ? list : []).map(item => ({
      at: timeOf(item?.published_at || item?.created_at),
      success: String(item?.state || '').toLowerCase() === 'ready',
    })).filter(item => item.at != null),
    uptimes: [],
  }
}

// --- network fetchers -------------------------------------------------------

async function getJson(fetchImpl, url, { method = 'GET', headers, body, timeoutMs, hosts }) {
  const response = await fetchImpl(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) }, { schemes: ['https'], allowHosts: hosts })
  if (!response.ok) return { ok: false, status: response.status, error: 'shipping_provider_rejected' }
  const data = await response.json().catch(() => null)
  if (data == null) return { ok: false, status: 502, error: 'shipping_provider_invalid_response' }
  return { ok: true, data }
}

const bearer = token => ({ authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': 'techit-trust' })

async function fetchGithubActions(credential, { config, fetchImpl, subject }, entry) {
  const repo = String(subject || '').trim()
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) return { ok: false, status: 400, error: 'shipping_subject_required' }
  const base = `${entry.base_url}/repos/${repo}`
  const headers = bearer(credential)
  const [runs, pulls, releases] = await Promise.all([
    getJson(fetchImpl, `${base}/actions/runs?per_page=100`, { headers, timeoutMs: config.timeoutMs, hosts: entry.hosts }),
    getJson(fetchImpl, `${base}/pulls?state=closed&per_page=100&sort=updated&direction=desc`, { headers, timeoutMs: config.timeoutMs, hosts: entry.hosts }),
    getJson(fetchImpl, `${base}/releases?per_page=100`, { headers, timeoutMs: config.timeoutMs, hosts: entry.hosts }),
  ])
  const failed = [runs, pulls, releases].find(item => !item.ok)
  if (failed) return failed
  const normalized = normalizeGithubActions({ runs: runs.data?.workflow_runs || [], pulls: pulls.data || [], releases: releases.data || [] })
  return { ok: true, provider: 'github_actions', subject: repo, accountDomain: null, ...normalized }
}

async function fetchVercel(credential, { config, fetchImpl, subject }, entry) {
  const url = subject ? `${entry.base_url}/v6/deployments?limit=100&projectId=${encodeURIComponent(subject)}` : `${entry.base_url}/v6/deployments?limit=100`
  const result = await getJson(fetchImpl, url, { headers: bearer(credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!result.ok) return result
  const normalized = normalizeVercelDeployments(result.data?.deployments || [])
  return { ok: true, provider: 'vercel', subject: subject || null, accountDomain: null, ...normalized }
}

async function fetchRender(credential, { config, fetchImpl, subject }, entry) {
  if (!subject) return { ok: false, status: 400, error: 'shipping_subject_required' }
  const result = await getJson(fetchImpl, `${entry.base_url}/v1/services/${encodeURIComponent(subject)}/deploys?limit=100`, { headers: bearer(credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!result.ok) return result
  const normalized = normalizeRenderDeploys(result.data || [])
  return { ok: true, provider: 'render', subject, accountDomain: null, ...normalized }
}

const RAILWAY_QUERY = 'query TrustDeployments($projectId: String!, $first: Int!) { deployments(first: $first, input: { projectId: $projectId }) { edges { node { id status createdAt } } } }'

async function fetchRailway(credential, { config, fetchImpl, subject }, entry) {
  if (!subject) return { ok: false, status: 400, error: 'shipping_subject_required' }
  const result = await getJson(fetchImpl, `${entry.base_url}/graphql/v2`, {
    method: 'POST',
    headers: { ...bearer(credential), 'content-type': 'application/json' },
    body: JSON.stringify({ query: RAILWAY_QUERY, variables: { projectId: subject, first: 100 } }),
    timeoutMs: config.timeoutMs,
    hosts: entry.hosts,
  })
  if (!result.ok) return result
  if (Array.isArray(result.data?.errors) && result.data.errors.length) return { ok: false, status: 502, error: 'shipping_provider_rejected' }
  const nodes = (result.data?.data?.deployments?.edges || []).map(edge => edge?.node).filter(Boolean)
  const normalized = normalizeRailwayDeployments(nodes)
  return { ok: true, provider: 'railway', subject, accountDomain: null, ...normalized }
}

async function fetchCloudflare(credential, { config, fetchImpl, env, subject }, entry) {
  const [accountId, project] = String(subject || '').split('/')
  const account = accountId || String(env.CLOUDFLARE_ACCOUNT_ID || '').trim()
  const projectName = project || String(env.CLOUDFLARE_PAGES_PROJECT || '').trim()
  if (!account || !projectName) return { ok: false, status: 400, error: 'shipping_subject_required' }
  const url = `${entry.base_url}/client/v4/accounts/${encodeURIComponent(account)}/pages/projects/${encodeURIComponent(projectName)}/deployments?per_page=100`
  const result = await getJson(fetchImpl, url, { headers: bearer(credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!result.ok) return result
  const normalized = normalizeCloudflareDeployments(result.data?.result || [])
  return { ok: true, provider: 'cloudflare', subject: `${account}/${projectName}`, accountDomain: null, ...normalized }
}

async function fetchNetlify(credential, { config, fetchImpl, subject }, entry) {
  if (!subject) return { ok: false, status: 400, error: 'shipping_subject_required' }
  const result = await getJson(fetchImpl, `${entry.base_url}/api/v1/sites/${encodeURIComponent(subject)}/deploys?per_page=100`, { headers: bearer(credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!result.ok) return result
  const normalized = normalizeNetlifyDeploys(result.data || [])
  return { ok: true, provider: 'netlify', subject, accountDomain: null, ...normalized }
}

const FETCHERS = { github_actions: fetchGithubActions, vercel: fetchVercel, render: fetchRender, railway: fetchRailway, cloudflare: fetchCloudflare, netlify: fetchNetlify }

export async function fetchProviderShipping(provider, credential, { env = process.env, fetchImpl = safeFetch, subject = null } = {}) {
  const key = String(provider || '').toLowerCase()
  const entry = findShippingProvider(key)
  if (!entry) return { ok: false, status: 404, error: 'unsupported_shipping_provider' }
  const fetcher = FETCHERS[key]
  if (!fetcher) return { ok: false, status: 501, error: 'shipping_provider_not_implemented' }
  const config = resolveShippingConfig(env)
  try {
    const result = await fetcher(credential, { config, fetchImpl, env, subject }, entry)
    return result
  } catch (error) {
    const code = /timeout|abort/i.test(error?.name || '') ? 'shipping_provider_timeout' : 'shipping_provider_unavailable'
    return { ok: false, status: 502, error: code, detail: error?.message }
  }
}
