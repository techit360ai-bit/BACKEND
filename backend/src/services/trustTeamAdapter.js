// Read-only team verification adapters (WS6).
//
// Two independent read paths:
//   - company registry: entity exists + founder is a listed officer/director
//   - HRIS / company profile: consented headcount + role aggregates only
//
// Work-email OTP is handled in trustTeamService (no network read). All
// normalizers here are pure; network calls go through safeFetch with a host
// allow-list. Individual employee PII never leaves the adapter.

import { safeFetch } from './outboundHttpService.js'
import { findRegistryProvider, findHrisProvider, resolveTeamConfig } from '../config/trustTeamSources.js'

const clean = (value, max = 160) => (typeof value === 'string' ? value.replace(/[<>\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')
const int = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
}

// Normalized name comparison for officer matching: lowercase, drop punctuation
// and common corporate suffixes, then require every founder name token to appear.
export function normalizePersonName(value) {
  return clean(value, 160).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\b(ltd|limited|llc|ltd\.|inc|incorporated|plc|gmbh|pvt|private|company|co)\b/g, ' ').replace(/\s+/g, ' ').trim()
}

export function matchOfficer(officers = [], founderName) {
  const target = normalizePersonName(founderName)
  if (!target) return false
  const tokens = target.split(' ').filter(token => token.length > 1)
  if (!tokens.length) return false
  return officers.some(officer => {
    const name = normalizePersonName(officer?.name)
    return Boolean(name) && tokens.every(token => name.includes(token))
  })
}

// --- registry normalizers ---------------------------------------------------

export function normalizeOpenCorporatesCompany(payload = {}) {
  const company = payload?.results?.company || payload?.company || {}
  const name = clean(company.name)
  if (!name) return null
  return { name, companyNumber: clean(company.company_number, 80), jurisdiction: clean(company.jurisdiction_code, 40), status: clean(company.current_status, 40) }
}

export function normalizeOpenCorporatesSearch(payload = {}) {
  const rows = payload?.results?.companies || []
  return rows.map(row => normalizeOpenCorporatesCompany(row)).filter(Boolean)
}

export function normalizeOpenCorporatesOfficers(payload = {}) {
  const rows = payload?.results?.officers || []
  return rows.map(row => ({ name: clean(row?.officer?.name), role: clean(row?.officer?.position, 80) })).filter(officer => officer.name)
}

export function normalizeCompaniesHouseProfile(payload = {}) {
  const name = clean(payload.company_name)
  if (!name) return null
  return { name, companyNumber: clean(payload.company_number, 80), jurisdiction: 'gb', status: clean(payload.company_status, 40) }
}

export function normalizeCompaniesHouseOfficers(payload = {}) {
  const rows = payload?.items || []
  return rows.map(row => ({ name: clean(row?.name), role: clean(row?.officer_role, 80) })).filter(officer => officer.name)
}

// --- HRIS normalizers (aggregates only) -------------------------------------

function roleCounts(employees, roleOf) {
  const counts = new Map()
  for (const employee of employees) {
    const role = clean(roleOf(employee), 80).toLowerCase() || 'unspecified'
    counts.set(role, (counts.get(role) || 0) + 1)
  }
  return [...counts.entries()].map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count)
}

export function normalizeGustoEmployees(list = []) {
  const employees = Array.isArray(list) ? list : []
  return { headcount: employees.length, roles: roleCounts(employees, e => e?.jobs?.[0]?.title || e?.title) }
}

export function normalizeRipplingEmployees(list = []) {
  const employees = Array.isArray(list) ? list : []
  return { headcount: employees.length, roles: roleCounts(employees, e => e?.role || e?.title || e?.workEmail) }
}

export function normalizeBambooHrDirectory(payload = {}) {
  const employees = Array.isArray(payload?.employees) ? payload.employees : Array.isArray(payload) ? payload : []
  return { headcount: employees.length, roles: roleCounts(employees, e => e?.jobTitle) }
}

export function normalizeLinkedinCompany(payload = {}) {
  const headcount = int(payload?.staffCount ?? payload?.staffCountRange?.start ?? payload?.employeeCount)
  return { headcount, roles: [] }
}

// --- network fetchers -------------------------------------------------------

async function getJson(fetchImpl, url, { method = 'GET', headers, body, timeoutMs, hosts }) {
  const response = await fetchImpl(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) }, { schemes: ['https'], allowHosts: hosts })
  if (!response.ok) return { ok: false, status: response.status, error: 'team_provider_rejected' }
  const data = await response.json().catch(() => null)
  if (data == null) return { ok: false, status: 502, error: 'team_provider_invalid_response' }
  return { ok: true, data }
}

const bearer = token => ({ authorization: `Bearer ${token}`, accept: 'application/json' })
const basic = token => ({ authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`, accept: 'application/json' })

async function fetchOpenCorporates(credential, { config, fetchImpl, subject }, entry) {
  const parts = String(subject || '').split('/')
  const tokenQuery = `api_token=${encodeURIComponent(credential)}`
  if (parts.length < 2) {
    // Search by name; the first result is treated as the candidate entity.
    const result = await getJson(fetchImpl, `${entry.base_url}/v0.4/companies/search?q=${encodeURIComponent(subject || '')}&${tokenQuery}`, { timeoutMs: config.timeoutMs, hosts: entry.hosts })
    if (!result.ok) return result
    const [candidate] = normalizeOpenCorporatesSearch(result.data)
    if (!candidate) return { ok: false, status: 404, error: 'registry_entity_not_found' }
    return { ok: true, provider: 'opencorporates', subject: subject || null, entityExists: true, entity: candidate, officers: [] }
  }
  const [jurisdiction, companyNumber] = parts
  const profile = await getJson(fetchImpl, `${entry.base_url}/v0.4/companies/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(companyNumber)}?${tokenQuery}`, { timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!profile.ok) return profile
  const entity = normalizeOpenCorporatesCompany(profile.data)
  if (!entity) return { ok: false, status: 404, error: 'registry_entity_not_found' }
  const officersResult = await getJson(fetchImpl, `${entry.base_url}/v0.4/companies/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(companyNumber)}/officers?${tokenQuery}`, { timeoutMs: config.timeoutMs, hosts: entry.hosts })
  const officers = officersResult.ok ? normalizeOpenCorporatesOfficers(officersResult.data) : []
  return { ok: true, provider: 'opencorporates', subject: `${jurisdiction}/${companyNumber}`, entityExists: true, entity, officers }
}

async function fetchCompaniesHouse(credential, { config, fetchImpl, subject }, entry) {
  const companyNumber = String(subject || '').trim()
  if (!companyNumber) return { ok: false, status: 400, error: 'team_subject_required' }
  const headers = basic(credential)
  const profile = await getJson(fetchImpl, `${entry.base_url}/company/${encodeURIComponent(companyNumber)}`, { headers, timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!profile.ok) return profile
  const entity = normalizeCompaniesHouseProfile(profile.data)
  if (!entity) return { ok: false, status: 404, error: 'registry_entity_not_found' }
  const officersResult = await getJson(fetchImpl, `${entry.base_url}/company/${encodeURIComponent(companyNumber)}/officers`, { headers, timeoutMs: config.timeoutMs, hosts: entry.hosts })
  const officers = officersResult.ok ? normalizeCompaniesHouseOfficers(officersResult.data) : []
  return { ok: true, provider: 'companies_house', subject: companyNumber, entityExists: true, entity, officers }
}

async function fetchGusto(credential, { config, fetchImpl, subject }, entry) {
  if (!subject) return { ok: false, status: 400, error: 'team_subject_required' }
  const result = await getJson(fetchImpl, `${entry.base_url}/v1/companies/${encodeURIComponent(subject)}/employees`, { headers: bearer(credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!result.ok) return result
  const aggregates = normalizeGustoEmployees(result.data)
  return { ok: true, provider: 'gusto', subject, ...aggregates }
}

async function fetchRippling(credential, { config, fetchImpl, subject }, entry) {
  const url = subject ? `${entry.base_url}/platform/api/employees?company=${encodeURIComponent(subject)}` : `${entry.base_url}/platform/api/employees`
  const result = await getJson(fetchImpl, url, { headers: bearer(credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!result.ok) return result
  const aggregates = normalizeRipplingEmployees(result.data)
  return { ok: true, provider: 'rippling', subject: subject || null, ...aggregates }
}

async function fetchBambooHr(credential, { config, fetchImpl, subject }, entry) {
  if (!subject) return { ok: false, status: 400, error: 'team_subject_required' }
  const result = await getJson(fetchImpl, `${entry.base_url}/api/gateway.php/${encodeURIComponent(subject)}/v1/employees/directory`, { headers: basic(credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!result.ok) return result
  const aggregates = normalizeBambooHrDirectory(result.data)
  return { ok: true, provider: 'bamboohr', subject, ...aggregates }
}

async function fetchLinkedinCompany(credential, { config, fetchImpl, subject }, entry) {
  if (!subject) return { ok: false, status: 400, error: 'team_subject_required' }
  const result = await getJson(fetchImpl, `${entry.base_url}/rest/organizations/${encodeURIComponent(subject)}`, { headers: bearer(credential), timeoutMs: config.timeoutMs, hosts: entry.hosts })
  if (!result.ok) return result
  const aggregates = normalizeLinkedinCompany(result.data)
  return { ok: true, provider: 'linkedin_company', subject, ...aggregates }
}

const REGISTRY_FETCHERS = { opencorporates: fetchOpenCorporates, companies_house: fetchCompaniesHouse }
const HRIS_FETCHERS = { gusto: fetchGusto, rippling: fetchRippling, bamboohr: fetchBambooHr, linkedin_company: fetchLinkedinCompany }

export async function fetchProviderRegistry(provider, credential, { env = process.env, fetchImpl = safeFetch, subject = null, founderName = null } = {}) {
  const key = String(provider || '').toLowerCase()
  const entry = findRegistryProvider(key)
  if (!entry) return { ok: false, status: 404, error: 'unsupported_registry_provider' }
  const config = resolveTeamConfig(env)
  try {
    const result = await REGISTRY_FETCHERS[key](credential, { config, fetchImpl, subject }, entry)
    if (!result.ok) return result
    return { ...result, founderIsOfficer: matchOfficer(result.officers, founderName) }
  } catch (error) {
    const code = /timeout|abort/i.test(error?.name || '') ? 'team_provider_timeout' : 'team_provider_unavailable'
    return { ok: false, status: 502, error: code, detail: error?.message }
  }
}

export async function fetchProviderHris(provider, credential, { env = process.env, fetchImpl = safeFetch, subject = null } = {}) {
  const key = String(provider || '').toLowerCase()
  const entry = findHrisProvider(key)
  if (!entry) return { ok: false, status: 404, error: 'unsupported_hris_provider' }
  const config = resolveTeamConfig(env)
  try {
    return await HRIS_FETCHERS[key](credential, { config, fetchImpl, subject }, entry)
  } catch (error) {
    const code = /timeout|abort/i.test(error?.name || '') ? 'team_provider_timeout' : 'team_provider_unavailable'
    return { ok: false, status: 502, error: code, detail: error?.message }
  }
}
