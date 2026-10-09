// Read-only milestone attestation adapters (WS7).
//
// Milestone evidence is founder-supplied and must be scanned + hashed before it
// reaches the review queue. Third-party attestation is the only thing that can
// raise a milestone to `third_party_attested`:
//   - e-sign: a read-only envelope status check (DocuSign / Dropbox Sign)
//   - documented: an admin confirms an auditor/accountant letter or notary
//
// All reducers are pure; network calls go through safeFetch with a host
// allow-list. Evidence bytes never leave evidenceStorageService.

import { safeFetch } from './outboundHttpService.js'
import { findMilestoneType, findAttestationProvider, resolveMilestoneConfig } from '../config/trustMilestoneSources.js'

const clean = (value, max = 160) => (typeof value === 'string' ? value.replace(/[<>\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')

export function normalizeMilestoneType(type) {
  return findMilestoneType(type)
}

// Founder/attestation reference normalized for storage. The envelope id is an
// opaque provider id, never a founder-authored date or amount.
export function normalizeAttestation(input = {}) {
  const provider = clean(input.provider, 40).toLowerCase() || null
  return {
    provider,
    envelopeId: clean(input.envelopeId || input.envelope_id || input.reference, 200) || null,
    issuer: clean(input.issuer, 160) || null,
    accountId: clean(input.accountId || input.account_id, 80) || null,
  }
}

export function reduceEsignEnvelope(provider, payload = {}) {
  if (provider === 'hellosign') {
    const request = payload?.signature_request || {}
    const completed = request.is_complete === true || request.is_complete === 'true'
    return { status: completed ? 'completed' : 'pending', completed, completedAt: request.signing_completed_at || null, title: clean(request.title, 200) || null }
  }
  // DocuSign default shape.
  const status = clean(payload.status, 40).toLowerCase()
  return { status: status || 'unknown', completed: status === 'completed', completedAt: payload.completedDateTime || null, title: clean(payload.emailSubject, 200) || null }
}

// Only a server-observed completed envelope (or an admin-confirmed documented
// attestation) counts as third-party.
export function attestationLevelFor(entry, reduced = {}) {
  if (!entry) return 'self'
  if (entry.kind === 'esign') return reduced.completed ? 'third_party_attested' : 'self'
  return 'self'
}

export function buildMilestoneMetadata({ type, evidenceObjectId, evidenceHash, attestation, crossLinks, now } = {}) {
  const metadata = { milestoneType: clean(type, 60), count: 1, asOf: now || new Date().toISOString() }
  if (evidenceObjectId) metadata.evidenceObjectId = clean(evidenceObjectId, 120)
  if (evidenceHash) metadata.evidenceSha256 = clean(evidenceHash, 128)
  if (attestation?.provider) metadata.attestationProvider = clean(attestation.provider, 40)
  if (attestation?.envelopeId) metadata.envelopeId = clean(attestation.envelopeId, 200)
  if (attestation?.issuer) metadata.issuer = clean(attestation.issuer, 160)
  if (crossLinks?.contractId) metadata.contractId = clean(crossLinks.contractId, 120)
  if (crossLinks?.revenueVerificationId) metadata.revenueVerificationId = clean(crossLinks.revenueVerificationId, 120)
  return metadata
}

const bearer = token => ({ authorization: `Bearer ${token}`, accept: 'application/json' })
const basic = token => ({ authorization: `Basic ${Buffer.from(`${token}:`).toString('base64')}`, accept: 'application/json' })

async function getJson(fetchImpl, url, { headers, timeoutMs, hosts }) {
  const response = await fetchImpl(url, { method: 'GET', headers, signal: AbortSignal.timeout(timeoutMs) }, { schemes: ['https'], allowHosts: hosts })
  if (!response.ok) return { ok: false, status: response.status, error: 'milestone_provider_rejected' }
  const data = await response.json().catch(() => null)
  if (data == null) return { ok: false, status: 502, error: 'milestone_provider_invalid_response' }
  return { ok: true, data }
}

export async function fetchEsignAttestation(provider, credential, { env = process.env, fetchImpl = safeFetch, attestation = {} } = {}) {
  const key = String(provider || '').toLowerCase()
  const entry = findAttestationProvider(key)
  if (!entry || entry.kind !== 'esign') return { ok: false, status: 404, error: 'unsupported_attestation_provider' }
  if (!attestation.envelopeId) return { ok: false, status: 400, error: 'attestation_envelope_required' }
  const config = resolveMilestoneConfig(env)
  try {
    let url
    let headers
    if (key === 'docusign') {
      if (!attestation.accountId) return { ok: false, status: 400, error: 'attestation_account_required' }
      url = `${entry.base_url}/restapi/v2.1/accounts/${encodeURIComponent(attestation.accountId)}/envelopes/${encodeURIComponent(attestation.envelopeId)}`
      headers = bearer(credential)
    } else {
      url = `${entry.base_url}/v3/signature_request/${encodeURIComponent(attestation.envelopeId)}`
      headers = basic(credential)
    }
    const result = await getJson(fetchImpl, url, { headers, timeoutMs: config.timeoutMs, hosts: entry.hosts })
    if (!result.ok) return result
    const reduced = reduceEsignEnvelope(key, result.data)
    return { ok: true, provider: key, envelopeId: attestation.envelopeId, ...reduced }
  } catch (error) {
    const code = /timeout|abort/i.test(error?.name || '') ? 'milestone_provider_timeout' : 'milestone_provider_unavailable'
    return { ok: false, status: 502, error: code, detail: error?.message }
  }
}
