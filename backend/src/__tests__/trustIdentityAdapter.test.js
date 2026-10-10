import { describe, expect, it, vi } from 'vitest'
import {
  fetchKycSession,
  fetchSanctionsScreening,
  normalizeOfacSdnList,
  parseCsvRows,
  reduceKycResult,
  reduceSanctionsProvider,
  screenNameAgainstList,
} from '../services/trustIdentityAdapter.js'

describe('KYC result reducers', () => {
  it('verifies only an explicitly-approved provider result', () => {
    expect(reduceKycResult('stripe_identity', { id: 'vs_1', status: 'verified' })).toMatchObject({ status: 'verified', verified: true, reference: 'vs_1' })
    expect(reduceKycResult('stripe_identity', { id: 'vs_1', status: 'requires_input' })).toMatchObject({ status: 'pending', verified: false })
    expect(reduceKycResult('stripe_identity', { id: 'vs_1', status: 'canceled' })).toMatchObject({ status: 'failed', verified: false })
  })

  it('reduces persona, onfido and veriff payloads', () => {
    expect(reduceKycResult('persona', { data: { id: 'inq_1', attributes: { status: 'completed', decision: 'approved' } } }).verified).toBe(true)
    expect(reduceKycResult('persona', { data: { id: 'inq_1', attributes: { status: 'completed', decision: 'declined' } } }).status).toBe('failed')
    expect(reduceKycResult('onfido', { id: 'chk_1', status: 'complete', result: 'clear' }).verified).toBe(true)
    expect(reduceKycResult('onfido', { id: 'chk_1', status: 'complete', result: 'consider' }).status).toBe('failed')
    expect(reduceKycResult('veriff', { verification: { id: 's_1', status: 'approved' } }).verified).toBe(true)
    expect(reduceKycResult('veriff', { verification: { id: 's_1', status: 'declined' } }).status).toBe('failed')
  })

  it('never verifies an unknown or pending provider', () => {
    expect(reduceKycResult('unknown', { status: 'verified' }).verified).toBe(false)
    expect(reduceKycResult('onfido', { id: 'c', status: 'in_progress' }).status).toBe('pending')
  })
})

describe('OFAC sanctions screening', () => {
  const csv = 'ent_num,SDN_Name,SDN_Type,Program\n1,"ACME, LIMITED",Entity,X\n2,SDN_Name,Type,Program\n3,-0-,Entity,X\n4,"IVAN TEST PERSON",Individual,Y\n'

  it('parses quoted CSV fields', () => {
    const rows = parseCsvRows(csv)
    expect(rows[1][1]).toBe('ACME, LIMITED')
  })

  it('normalizes the SDN list and drops placeholders', () => {
    const entries = normalizeOfacSdnList(csv)
    expect(entries.map(entry => entry.name)).toEqual(['ACME, LIMITED', 'IVAN TEST PERSON'])
  })

  it('matches by normalized name tokens', () => {
    const entries = normalizeOfacSdnList(csv)
    expect(screenNameAgainstList('Ivan Test Person', entries)).toMatchObject({ status: 'match', matchCount: 1 })
    expect(screenNameAgainstList('Someone Else', entries)).toMatchObject({ status: 'clear', matchCount: 0 })
    expect(screenNameAgainstList('', entries).status).toBe('clear')
  })

  it('reduces a provider screening feed', () => {
    expect(reduceSanctionsProvider('sanctions_io', { results: [{ caption: 'Bad Actor' }] })).toMatchObject({ status: 'match', matchCount: 1 })
    expect(reduceSanctionsProvider('sanctions_io', { results: [] })).toMatchObject({ status: 'clear' })
  })
})

describe('identity network fetchers', () => {
  it('reads a server-observed KYC session through the host allow-list', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'inq_1', status: 'approved' }) }))
    const env = { TRUST_KYC_ENABLED: 'true', TRUST_KYC_PROVIDER: 'persona', TRUST_DPIA_APPROVAL_REF: 'D', TRUST_KYC_REGIONS: 'HU' }
    const result = await fetchKycSession('persona', 'key', { env, fetchImpl, subject: 'inq_1' })
    expect(result).toMatchObject({ ok: true, provider: 'persona', verified: true })
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/v1/inquiries/inq_1')
  })

  it('refuses unsupported providers and missing subjects', async () => {
    expect((await fetchKycSession('unknown', 'k', { subject: 'x' })).error).toBe('unsupported_kyc_provider')
    expect((await fetchKycSession('persona', 'k', { subject: null })).error).toBe('identity_subject_required')
  })

  it('screens against a supplied OFAC list without a network read', async () => {
    const fetchImpl = vi.fn()
    const list = normalizeOfacSdnList('ent,SDN_Name,Type,Program\n1,"IVAN TEST PERSON",Individual,Y\n')
    const env = { TRUST_KYC_ENABLED: 'true', TRUST_KYC_PROVIDER: 'persona', TRUST_DPIA_APPROVAL_REF: 'D', TRUST_KYC_REGIONS: 'HU' }
    const result = await fetchSanctionsScreening('ofac', null, { env, fetchImpl, name: 'Ivan Test Person', list })
    expect(result).toMatchObject({ ok: true, status: 'match', matchCount: 1 })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
