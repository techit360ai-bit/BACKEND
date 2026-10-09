import { describe, expect, it, vi } from 'vitest'
import {
  attestationLevelFor,
  buildMilestoneMetadata,
  fetchEsignAttestation,
  normalizeAttestation,
  normalizeMilestoneType,
  reduceEsignEnvelope,
} from '../services/trustMilestoneAdapter.js'

describe('milestone normalization', () => {
  it('resolves a known milestone type and rejects an unknown one', () => {
    expect(normalizeMilestoneType('funding').type).toBe('funding')
    expect(normalizeMilestoneType('nope')).toBeNull()
  })

  it('normalizes an attestation reference', () => {
    expect(normalizeAttestation({ provider: 'DocuSign', envelope_id: 'env-1', issuer: 'Acme LLP' })).toMatchObject({ provider: 'docusign', envelopeId: 'env-1', issuer: 'Acme LLP' })
    expect(normalizeAttestation({})).toEqual({ provider: null, envelopeId: null, issuer: null, accountId: null })
  })
})

describe('e-sign reducers', () => {
  it('reduces DocuSign and Dropbox Sign envelopes', () => {
    expect(reduceEsignEnvelope('docusign', { status: 'completed', completedDateTime: '2026-01-01', emailSubject: 'SAFE' })).toMatchObject({ status: 'completed', completed: true })
    expect(reduceEsignEnvelope('docusign', { status: 'sent' })).toMatchObject({ status: 'sent', completed: false })
    expect(reduceEsignEnvelope('hellosign', { signature_request: { is_complete: true, signing_completed_at: '2026-01-01' } })).toMatchObject({ completed: true })
    expect(reduceEsignEnvelope('hellosign', { signature_request: { is_complete: false } })).toMatchObject({ completed: false })
  })

  it('only a completed e-sign envelope (or explicit admin attestation) counts as third-party', () => {
    const esign = { kind: 'esign' }
    const documented = { kind: 'documented' }
    expect(attestationLevelFor(esign, { completed: true })).toBe('third_party_attested')
    expect(attestationLevelFor(esign, { completed: false })).toBe('self')
    expect(attestationLevelFor(documented, {})).toBe('self')
    expect(attestationLevelFor(null, {})).toBe('self')
  })
})

describe('milestone metadata', () => {
  it('keeps provider-observed fields and drops empties', () => {
    const metadata = buildMilestoneMetadata({
      type: 'funding',
      evidenceObjectId: 'ev-1',
      evidenceHash: 'sha-1',
      attestation: { provider: 'docusign', envelopeId: 'env-1' },
      crossLinks: { contractId: 'c-1', revenueVerificationId: 'r-1' },
      now: '2026-07-31T00:00:00.000Z',
    })
    expect(metadata).toMatchObject({ milestoneType: 'funding', count: 1, evidenceObjectId: 'ev-1', evidenceSha256: 'sha-1', attestationProvider: 'docusign', envelopeId: 'env-1', contractId: 'c-1', revenueVerificationId: 'r-1', asOf: '2026-07-31T00:00:00.000Z' })
    expect(buildMilestoneMetadata({ type: 'launch', now: 'n' })).toEqual({ milestoneType: 'launch', count: 1, asOf: 'n' })
  })
})

describe('e-sign fetchers', () => {
  it('reads a DocuSign envelope with an account id', async () => {
    const fetchImpl = vi.fn(async url => {
      const value = String(url)
      if (value.includes('/accounts/acc-1/envelopes/env-1')) return { ok: true, status: 200, json: async () => ({ status: 'completed', completedDateTime: '2026-01-01' }) }
      throw new Error(`unexpected ${value}`)
    })
    const result = await fetchEsignAttestation('docusign', 'token', { env: {}, fetchImpl, attestation: { envelopeId: 'env-1', accountId: 'acc-1' } })
    expect(result.ok).toBe(true)
    expect(result.completed).toBe(true)
    expect(new URL(String(fetchImpl.mock.calls[0][0])).hostname).toBe('na3.docusign.net')
  })

  it('reads a Dropbox Sign request with basic auth', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ signature_request: { is_complete: true } }) }))
    const result = await fetchEsignAttestation('hellosign', 'key', { env: {}, fetchImpl, attestation: { envelopeId: 'env-2' } })
    expect(result.ok).toBe(true)
    expect(result.completed).toBe(true)
    expect(new URL(String(fetchImpl.mock.calls[0][0])).hostname).toBe('api.hellosign.com')
  })

  it('requires an envelope id and an account id for DocuSign', async () => {
    const fetchImpl = vi.fn()
    expect((await fetchEsignAttestation('docusign', 'x', { env: {}, fetchImpl })).error).toBe('attestation_envelope_required')
    expect((await fetchEsignAttestation('docusign', 'x', { env: {}, fetchImpl, attestation: { envelopeId: 'e' } })).error).toBe('attestation_account_required')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports unsupported providers and surface read failures', async () => {
    const fetchImpl = vi.fn()
    expect((await fetchEsignAttestation('auditor_letter', 'x', { env: {}, fetchImpl, attestation: { envelopeId: 'e' } })).error).toBe('unsupported_attestation_provider')

    const reject = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    expect((await fetchEsignAttestation('hellosign', 'bad', { env: {}, fetchImpl: reject, attestation: { envelopeId: 'e' } })).error).toBe('milestone_provider_rejected')

    const boom = vi.fn(async () => { const error = new Error('aborted'); error.name = 'AbortError'; throw error })
    expect((await fetchEsignAttestation('hellosign', 'x', { env: {}, fetchImpl: boom, attestation: { envelopeId: 'e' } })).error).toBe('milestone_provider_timeout')
  })
})
