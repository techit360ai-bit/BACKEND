// Read-only founder-identity adapters (WS8).
//
// Three independent read paths, all provider-observed:
//   - KYC: government ID + liveness status (Stripe Identity / Persona /
//     Onfido / Veriff). Only the decision + a reference id leave the adapter;
//     documents are never fetched or stored.
//   - Business registry: legal entity + officers (reuses the WS6 registry
//     adapters so the two cannot drift).
//   - Sanctions/PEP: the public OFAC SDN list, or a provider screening feed.
//
// All reducers are pure; network calls go through safeFetch with a host
// allow-list.

import { safeFetch } from './outboundHttpService.js'
import { findKycProvider, findScreeningProvider, resolveIdentityConfig } from '../config/trustIdentitySources.js'
import { normalizePersonName } from './trustTeamAdapter.js'

const clean = (value, max = 160) => (typeof value === 'string' ? value.replace(/[<>\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')
const int = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
}

// --- KYC status reducers ----------------------------------------------------

// A KYC result is normalized to exactly one of verified / failed / pending.
// Anything the provider did not explicitly approve stays pending or failed —
// never verified.
export function reduceKycResult(provider, payload = {}) {
  const key = String(provider || '').toLowerCase()
  if (key === 'stripe_identity') {
    const status = clean(payload.status, 40).toLowerCase()
    if (status === 'verified') return { status: 'verified', verified: true, reference: clean(payload.id, 200) || null, completedAt: payload.last_verification_report?.created || null }
    if (status === 'canceled') return { status: 'failed', verified: false, reference: clean(payload.id, 200) || null, reason: 'canceled' }
    return { status: 'pending', verified: false, reference: clean(payload.id, 200) || null, reason: status || 'unknown' }
  }
  if (key === 'persona') {
    const attributes = payload?.data?.attributes || payload
    const status = clean(attributes.status, 40).toLowerCase()
    const decision = clean(attributes.decision || attributes['verification-status'], 40).toLowerCase()
    if (decision === 'approved' || status === 'approved') return { status: 'verified', verified: true, reference: clean(payload?.data?.id || payload.id, 200) || null, completedAt: attributes['completed-at'] || null }
    if (decision === 'declined' || status === 'declined') return { status: 'failed', verified: false, reference: clean(payload?.data?.id || payload.id, 200) || null, reason: 'declined' }
    return { status: 'pending', verified: false, reference: clean(payload?.data?.id || payload.id, 200) || null, reason: status || 'unknown' }
  }
  if (key === 'onfido') {
    const status = clean(payload.status, 40).toLowerCase()
    const result = clean(payload.result, 40).toLowerCase()
    if (status === 'complete' && result === 'clear') return { status: 'verified', verified: true, reference: clean(payload.id, 200) || null, completedAt: payload.completed_at || null }
    if (result === 'consider' || result === 'unidentified' || payload?.breakdown?.document?.result === 'rejected') return { status: 'failed', verified: false, reference: clean(payload.id, 200) || null, reason: result || 'unidentified' }
    return { status: 'pending', verified: false, reference: clean(payload.id, 200) || null, reason: status || 'unknown' }
  }
  if (key === 'veriff') {
    const verification = payload.verification || payload
    const status = clean(verification.status, 40).toLowerCase()
    if (status === 'approved') return { status: 'verified', verified: true, reference: clean(verification.id || payload.id, 200) || null, completedAt: verification.decisionTime || null }
    if (status === 'declined') return { status: 'failed', verified: false, reference: clean(verification.id || payload.id, 200) || null, reason: 'declined' }
    return { status: 'pending', verified: false, reference: clean(verification.id || payload.id, 200) || null, reason: status || 'unknown' }
  }
  return { status: 'pending', verified: false, reference: null, reason: 'unsupported_provider' }
}

// --- sanctions / PEP reducers ----------------------------------------------

// Minimal CSV row parser that honors double-quoted fields (OFAC SDN names may
// contain commas). Returns arrays of string cells.
export function parseCsvRows(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const value = String(text || '')
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    if (quoted) {
      if (char === '"') {
        if (value[i + 1] === '"') { field += '"'; i += 1 } else quoted = false
      } else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

export function normalizeOfacSdnList(text) {
  const rows = parseCsvRows(text)
  const entries = []
  for (const row of rows) {
    if (!row.length || row.length < 3) continue
    const name = clean(row[1], 200)
    const type = clean(row[2], 40)
    if (!name || name === '-0-' || /^sdn_?name$/i.test(name)) continue
    entries.push({ name, type: type || null, program: clean(row[3], 120) || null })
  }
  return entries
}

export function screenNameAgainstList(name, entries = [], { maxMatches = 5 } = {}) {
  const target = normalizePersonName(name)
  if (!target) return { status: 'clear', matchCount: 0, matches: [] }
  const tokens = target.split(' ').filter(token => token.length > 1)
  if (!tokens.length) return { status: 'clear', matchCount: 0, matches: [] }
  const matches = []
  for (const entry of entries) {
    const candidate = normalizePersonName(entry?.name)
    if (!candidate) continue
    if (tokens.every(token => candidate.includes(token))) matches.push(entry.name)
    if (matches.length >= maxMatches) break
  }
  return { status: matches.length ? 'match' : 'clear', matchCount: matches.length, matches }
}

export function reduceSanctionsProvider(provider, payload = {}) {
  const key = String(provider || '').toLowerCase()
  if (key === 'sanctions_io') {
    const results = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : []
    const matches = results.slice(0, 5).map(row => clean(row?.caption || row?.name || row?.entity_name, 200)).filter(Boolean)
    return { status: matches.length ? 'match' : 'clear', matchCount: matches.length, matches }
  }
  return { status: 'clear', matchCount: 0, matches: [] }
}

// --- network fetchers -------------------------------------------------------

function authHeaders(entry, credential) {
  if (entry.auth === 'persona') return { authorization: `Bearer ${credential}`, 'persona-version': '2023-01-05', accept: 'application/json' }
  if (entry.auth === 'x-auth-client') return { 'x-auth-client': credential, accept: 'application/json' }
  if (entry.auth === 'none') return { accept: 'application/json' }
  return { authorization: `Bearer ${credential}`, accept: 'application/json' }
}

async function getJson(fetchImpl, url, { headers, timeoutMs, hosts }) {
  const response = await fetchImpl(url, { method: 'GET', headers, signal: AbortSignal.timeout(timeoutMs) }, { schemes: ['https'], allowHosts: hosts })
  if (!response.ok) return { ok: false, status: response.status, error: 'identity_provider_rejected' }
  const data = await response.json().catch(() => null)
  if (data == null) return { ok: false, status: 502, error: 'identity_provider_invalid_response' }
  return { ok: true, data }
}

const KYC_PATHS = {
  stripe_identity: subject => `/v1/identity/verification_sessions/${encodeURIComponent(subject)}`,
  persona: subject => `/api/v1/inquiries/${encodeURIComponent(subject)}`,
  onfido: subject => `/v3.6/checks/${encodeURIComponent(subject)}`,
  veriff: subject => `/v1/sessions/${encodeURIComponent(subject)}/decision`,
}

export async function fetchKycSession(provider, credential, { env = process.env, fetchImpl = safeFetch, subject = null } = {}) {
  const key = String(provider || '').toLowerCase()
  const entry = findKycProvider(key)
  if (!entry) return { ok: false, status: 404, error: 'unsupported_kyc_provider' }
  if (!subject) return { ok: false, status: 400, error: 'identity_subject_required' }
  const config = resolveIdentityConfig(env)
  try {
    const result = await getJson(fetchImpl, `${entry.base_url}${KYC_PATHS[key](subject)}`, { headers: authHeaders(entry, credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
    if (!result.ok) return result
    const reduced = reduceKycResult(key, result.data)
    return { ok: true, provider: key, subject, ...reduced }
  } catch (error) {
    return { ok: false, status: 502, error: /timeout|abort/i.test(error?.name || '') ? 'identity_provider_timeout' : 'identity_provider_unavailable', detail: error?.message }
  }
}

export async function fetchOfacSdnList({ env = process.env, fetchImpl = safeFetch } = {}) {
  const entry = findScreeningProvider('ofac')
  const config = resolveIdentityConfig(env)
  try {
    const response = await fetchImpl(`${entry.base_url}${entry.list_path}`, { method: 'GET', headers: { accept: 'text/csv' }, signal: AbortSignal.timeout(config.timeoutMs) }, { schemes: ['https'], allowHosts: entry.hosts })
    if (!response.ok) return { ok: false, status: response.status, error: 'screening_provider_rejected' }
    const text = await response.text()
    const entries = normalizeOfacSdnList(text)
    if (!entries.length) return { ok: false, status: 502, error: 'screening_list_empty' }
    return { ok: true, provider: 'ofac', entries }
  } catch (error) {
    return { ok: false, status: 502, error: /timeout|abort/i.test(error?.name || '') ? 'screening_provider_timeout' : 'screening_provider_unavailable', detail: error?.message }
  }
}

export async function fetchSanctionsScreening(provider, credential, { env = process.env, fetchImpl = safeFetch, name = null, country = null, list = null } = {}) {
  const key = String(provider || '').toLowerCase()
  const entry = findScreeningProvider(key)
  if (!entry) return { ok: false, status: 404, error: 'unsupported_screening_provider' }
  if (!name) return { ok: false, status: 400, error: 'screening_name_required' }
  if (entry.kind === 'public_list') {
    const listResult = list ? { ok: true, entries: list } : await fetchOfacSdnList({ env, fetchImpl })
    if (!listResult.ok) return listResult
    return { ok: true, provider: key, reference: null, screenedName: name, country: country || null, ...screenNameAgainstList(name, listResult.entries) }
  }
  const config = resolveIdentityConfig(env)
  try {
    const query = new URLSearchParams({ name: String(name) })
    if (country) query.set('country', String(country))
    const result = await getJson(fetchImpl, `${entry.base_url}/v2/sanctions?${query.toString()}`, { headers: authHeaders(entry, credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
    if (!result.ok) return result
    return { ok: true, provider: key, reference: null, screenedName: name, country: country || null, ...reduceSanctionsProvider(key, result.data) }
  } catch (error) {
    return { ok: false, status: 502, error: /timeout|abort/i.test(error?.name || '') ? 'screening_provider_timeout' : 'screening_provider_unavailable', detail: error?.message }
  }
}

export function screeningEntryCount(entries = []) {
  return Array.isArray(entries) ? entries.length : int(entries)
}
