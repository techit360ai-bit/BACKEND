import { describe, expect, it, vi } from 'vitest'
import {
  fetchProviderHris,
  fetchProviderRegistry,
  matchOfficer,
  normalizeBambooHrDirectory,
  normalizeCompaniesHouseOfficers,
  normalizeCompaniesHouseProfile,
  normalizeGustoEmployees,
  normalizeLinkedinCompany,
  normalizeOpenCorporatesCompany,
  normalizeOpenCorporatesOfficers,
  normalizeOpenCorporatesSearch,
  normalizePersonName,
  normalizeRipplingEmployees,
} from '../services/trustTeamAdapter.js'

describe('officer matching', () => {
  it('normalizes corporate suffixes and punctuation', () => {
    expect(normalizePersonName('Acme Ltd.')).toBe('acme')
    expect(normalizePersonName('  Jane   Q. Doe  ')).toBe('jane q doe')
  })

  it('requires every founder name token to appear in an officer name', () => {
    const officers = [{ name: 'Jane Doe' }, { name: 'John Q. Smith, Director' }]
    expect(matchOfficer(officers, 'Jane Doe')).toBe(true)
    expect(matchOfficer(officers, 'John Smith')).toBe(true)
    expect(matchOfficer(officers, 'Jane Smith')).toBe(false)
    expect(matchOfficer(officers, '')).toBe(false)
    expect(matchOfficer([], 'Jane Doe')).toBe(false)
  })
})

describe('registry normalizers', () => {
  it('reduces OpenCorporates search/company/officer payloads', () => {
    const company = normalizeOpenCorporatesCompany({ results: { company: { name: 'Acme Ltd', company_number: '123', jurisdiction_code: 'gb', current_status: 'Active' } } })
    expect(company).toEqual({ name: 'Acme Ltd', companyNumber: '123', jurisdiction: 'gb', status: 'Active' })
    expect(normalizeOpenCorporatesCompany({})).toBeNull()

    const search = normalizeOpenCorporatesSearch({ results: { companies: [{ company: { name: 'A' } }, { company: {} }] } })
    expect(search).toHaveLength(1)

    const officers = normalizeOpenCorporatesOfficers({ results: { officers: [{ officer: { name: 'Jane Doe', position: 'Director' } }, { officer: { name: '' } }] } })
    expect(officers).toEqual([{ name: 'Jane Doe', role: 'Director' }])
  })

  it('reduces Companies House profile and officer payloads', () => {
    const profile = normalizeCompaniesHouseProfile({ company_name: 'Acme Ltd', company_number: '0123', company_status: 'active' })
    expect(profile).toEqual({ name: 'Acme Ltd', companyNumber: '0123', jurisdiction: 'gb', status: 'active' })
    expect(normalizeCompaniesHouseProfile({})).toBeNull()
    const officers = normalizeCompaniesHouseOfficers({ items: [{ name: 'Jane Doe', officer_role: 'director' }, { name: '' }] })
    expect(officers).toEqual([{ name: 'Jane Doe', role: 'director' }])
  })
})

describe('HRIS normalizers (aggregates only)', () => {
  it('reduces Gusto employees to headcount and ranked roles without PII', () => {
    const result = normalizeGustoEmployees([
      { first_name: 'A', last_name: 'B', jobs: [{ title: 'Engineer' }], work_email: 'a@acme.com' },
      { first_name: 'C', jobs: [{ title: 'Engineer' }] },
      { first_name: 'D', jobs: [{ title: 'Designer' }] },
    ])
    expect(result.headcount).toBe(3)
    expect(result.roles[0]).toEqual({ role: 'engineer', count: 2 })
    expect(JSON.stringify(result)).not.toContain('a@acme.com')
    expect(JSON.stringify(result)).not.toContain('first_name')
  })

  it('reduces Rippling and BambooHR directories', () => {
    expect(normalizeRipplingEmployees([{ role: 'Engineer' }, { role: 'Engineer' }, { role: 'Sales' }]).headcount).toBe(3)
    expect(normalizeBambooHrDirectory({ employees: [{ jobTitle: 'Ops' }, { jobTitle: 'Ops' }] })).toMatchObject({ headcount: 2 })
    expect(normalizeBambooHrDirectory([{ jobTitle: 'Ops' }]).headcount).toBe(1)
  })

  it('reduces a LinkedIn company profile to an integer headcount', () => {
    expect(normalizeLinkedinCompany({ staffCount: 42 }).headcount).toBe(42)
    expect(normalizeLinkedinCompany({ staffCountRange: { start: 11 } }).headcount).toBe(11)
    expect(normalizeLinkedinCompany({ employeeCount: '7' }).headcount).toBe(7)
    expect(normalizeLinkedinCompany({}).headcount).toBe(0)
  })
})

describe('provider fetchers', () => {
  it('fetches and reduces OpenCorporates officers, then matches the founder', async () => {
    const fetchImpl = vi.fn(async url => {
      const value = String(url)
      if (value.includes('/officers')) return { ok: true, status: 200, json: async () => ({ results: { officers: [{ officer: { name: 'Jane Doe', position: 'Director' } }] } }) }
      return { ok: true, status: 200, json: async () => ({ results: { company: { name: 'Acme Ltd', company_number: '123', jurisdiction_code: 'gb' } } }) }
    })
    const result = await fetchProviderRegistry('opencorporates', 'token', { env: {}, fetchImpl, subject: 'gb/123', founderName: 'Jane Doe' })
    expect(result.ok).toBe(true)
    expect(result.entity.companyNumber).toBe('123')
    expect(result.founderIsOfficer).toBe(true)
    for (const call of fetchImpl.mock.calls) expect(new URL(String(call[0])).hostname).toBe('api.opencorporates.com')
  })

  it('treats OpenCorporates name search as a candidate with no officers', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: { companies: [{ company: { name: 'Acme Ltd' } }] } }) }))
    const result = await fetchProviderRegistry('opencorporates', 'token', { env: {}, fetchImpl, subject: 'Acme', founderName: 'Jane Doe' })
    expect(result.ok).toBe(true)
    expect(result.officers).toEqual([])
    expect(result.founderIsOfficer).toBe(false)
  })

  it('requires a subject for subject-bound HRIS providers', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchProviderHris('gusto', 'x', { env: {}, fetchImpl })
    expect(result.error).toBe('team_subject_required')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports unsupported providers without a network call', async () => {
    const fetchImpl = vi.fn()
    expect((await fetchProviderRegistry('nope', 'x', { env: {}, fetchImpl })).error).toBe('unsupported_registry_provider')
    expect((await fetchProviderHris('workday', 'x', { env: {}, fetchImpl })).error).toBe('unsupported_hris_provider')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('surfaces provider rejections and timeouts as errors, not aggregates', async () => {
    const reject = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    expect((await fetchProviderHris('gusto', 'bad', { env: {}, fetchImpl: reject, subject: 'c1' })).error).toBe('team_provider_rejected')

    const boom = vi.fn(async () => { const error = new Error('aborted'); error.name = 'AbortError'; throw error })
    const timeout = await fetchProviderHris('rippling', 'x', { env: {}, fetchImpl: boom })
    expect(timeout.error).toBe('team_provider_timeout')
  })
})
