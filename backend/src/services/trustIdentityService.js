// Founder identity / KYC verification authority (WS8).
//
// Invariants that live here and are NOT env-tunable:
//   1. Only a server-observed, explicitly-approved KYC result mints a verified
//      identity proof. Failed or pending KYC never yields a verified badge, and
//      a failure revokes any prior verified identity proof.
//   2. No documents are ever fetched, held, or stored — only the decision, an
//      opaque provider reference, and a result hash.
//   3. Sanctions/PEP screening results are append-only: rows are inserted,
//      never updated. Re-screening adds a new row.
//
// The hard compliance gate (feature flag + allowlisted provider + DPIA ref +
// regions) is enforced before any provider call.

import { createId, nowIso } from '../utils/api.js'
import * as repo from '../repositories/trustRepository.js'
import { trustCore } from './trustVerificationAuthority.js'
import { appendTrustProof } from './trustAuthority.js'
import { isRegionAllowed, resolveKycConfig } from './trustComplianceGate.js'
import {
  findKycProvider,
  findScreeningProvider,
  platformKycCredential,
  platformScreeningCredential,
  resolveIdentityConfig,
  resolveIdentityAvailability,
  resolveIdentityRegistryProvider,
  resolveKycProvider,
  resolveScreeningProvider,
} from '../config/trustIdentitySources.js'
import { findRegistryProvider, platformRegistryCredential } from '../config/trustTeamSources.js'
import { fetchProviderRegistry } from './trustTeamAdapter.js'
import { fetchKycSession, fetchSanctionsScreening } from './trustIdentityAdapter.js'
import { credentialVaultConfigured, decryptCredential, encryptCredential, describeCredential } from './trustCredentialVault.js'

const { hash, clean } = trustCore
const CREDENTIAL_SOURCE = 'identity'

function writeAuthorityRequired() {
  return process.env.TRUST_WRITE_SOURCE === 'postgres'
}

function comingSoon(reason) {
  return { ok: false, status: 409, error: 'trust_source_coming_soon', reason }
}

function unavailable(availability) {
  return comingSoon(availability.availability_reason)
}

async function resolveCredential(userId, key, platformResolver, env) {
  const row = await repo.getActiveCredential(userId, key)
  if (row) {
    const decrypted = decryptCredential(row.encryptedPayload, { env })
    if (decrypted) return { credential: decrypted, source: 'founder', row, subject: row.subject || null }
  }
  const platform = platformResolver(key, env)
  if (platform) return { credential: platform, source: 'platform', row: null, subject: null }
  return { credential: null, source: null, row: null, subject: null }
}

// --- credential connect / list / disconnect --------------------------------

export async function connectIdentitySource(userId, input = {}, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'identity_requires_postgres_authority' }
  const provider = String(input.provider || input.kycProvider || '').trim().toLowerCase()
  const mfa = findKycProvider(provider)
  const registry = findRegistryProvider(provider)
  if (!mfa && !registry) return { ok: false, status: 404, error: 'unsupported_identity_provider' }
  const resolved = mfa ? resolveKycProvider(provider, env) : resolveIdentityRegistryProvider(provider, env)
  if (resolved.availability !== 'available') return unavailable(resolved)
  if (!credentialVaultConfigured(env)) return { ok: false, status: 503, error: 'credential_vault_not_configured' }
  const credential = String(input.credential || input.token || '').trim()
  if (!credential) return { ok: false, status: 400, error: 'credential_required' }
  const subject = clean(input.subject || input.reference, 200) || null
  const now = nowIso()
  const row = await repo.upsertCredential({
    id: createId('trust_credential'), userId, provider, source: CREDENTIAL_SOURCE,
    encryptedPayload: encryptCredential(credential, { env }), scopes: ['read_only'], status: 'active', subject,
    createdAt: now, updatedAt: now,
  })
  return { ok: true, kind: mfa ? 'kyc' : 'registry', credential: describeCredential(provider, { scopes: row.scopes, created_at: row.createdAt }) }
}

export async function listIdentityCredentials(userId) {
  if (!writeAuthorityRequired()) return { ok: true, credentials: [] }
  const rows = await repo.listActiveCredentials(userId)
  return { ok: true, credentials: rows.filter(row => row.source === CREDENTIAL_SOURCE).map(row => describeCredential(row.provider, { scopes: row.scopes, created_at: row.createdAt, last_synced_at: row.lastSyncedAt })) }
}

export async function disconnectIdentitySource(userId, provider) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'identity_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  if (key) await repo.revokeCredential(userId, key)
  await repo.withTrustTransaction(async client => {
    const revoked = await repo.revokeVerifiedProofs(userId, 'identity', { client })
    for (const proof of revoked) {
      await repo.insertHistory({ id: createId('trust_event'), verificationId: proof.id, userId, projectId: proof.projectId, source: 'identity', status: 'revoked', confidence: proof.confidence, metadataHash: proof.evidenceHash, eventType: 'trust_revoked', createdAt: nowIso(), expiresAt: proof.expiresAt }, { client })
    }
  })
  return { ok: true, provider: key || null, status: 'disconnected' }
}

// --- KYC verification -------------------------------------------------------

export async function verifyIdentity(userId, input = {}, { env = process.env, fetchImpl } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'identity_requires_postgres_authority' }
  const availability = resolveIdentityAvailability(env)
  if (!availability.enabled) return comingSoon(availability.availability_reason)

  const provider = clean(input.provider || input.kycProvider, 40).toLowerCase() || resolveKycConfig(env).provider
  const resolved = resolveKycProvider(provider, env)
  if (!findKycProvider(provider)) return { ok: false, status: 404, error: 'unsupported_kyc_provider' }
  if (resolved.availability !== 'available') return unavailable(resolved)

  const country = clean(input.country, 2).toUpperCase() || null
  if (country && !isRegionAllowed(country, env)) return { ok: false, status: 422, error: 'identity_region_not_allowed', detail: { country } }

  const config = resolveIdentityConfig(env)
  if (config.requireScreening) {
    const screening = await runSanctionsScreening(userId, { provider: config.screeningProviders[0], name: input.legalName || input.name, country }, { env, fetchImpl })
    if (!screening.ok) return screening
    if (screening.screening.status !== 'clear') return { ok: false, status: 422, error: 'identity_screening_not_clear', detail: { status: screening.screening.status } }
  }

  const { credential, source, row, subject } = await resolveCredential(userId, provider, platformKycCredential, env)
  if (!credential) return { ok: false, status: 409, error: 'identity_credential_not_connected' }
  const reference = clean(input.reference || input.subject || subject, 200) || null
  if (!reference) return { ok: false, status: 400, error: 'identity_subject_required' }

  const fetched = await fetchKycSession(provider, credential, { env, fetchImpl, subject: reference })
  if (!fetched.ok) return fetched

  const now = nowIso()
  const resultHash = hash({ provider, reference, status: fetched.status, userId })
  await repo.withTrustTransaction(async client => {
    await repo.insertIdentityVerification({
      id: createId('trust_identity'), userId, provider, kind: 'kyc', status: fetched.status,
      providerReference: fetched.reference || reference, subject: clean(input.subject, 200) || null,
      country, resultHash, checkedAt: now, createdAt: now,
    }, { client })
  })

  if (fetched.status === 'failed') {
    // A failed/canceled KYC must never leave a verified identity badge behind.
    await repo.withTrustTransaction(async client => {
      const revoked = await repo.revokeVerifiedProofs(userId, 'identity', { client })
      for (const proof of revoked) {
        await repo.insertHistory({ id: createId('trust_event'), verificationId: proof.id, userId, projectId: proof.projectId, source: 'identity', status: 'revoked', confidence: proof.confidence, metadataHash: proof.evidenceHash, eventType: 'trust_revoked', createdAt: now, expiresAt: proof.expiresAt }, { client })
      }
    })
    return { ok: false, status: 422, error: 'identity_kyc_failed', detail: { provider, reference: fetched.reference || reference } }
  }
  if (!fetched.verified) return { ok: false, status: 202, error: 'identity_kyc_pending', detail: { provider, status: fetched.status } }

  if (row) await repo.markCredentialSynced(row.id, { subject: reference, verifiedAt: now })

  const metadata = { identityKind: 'kyc', kycProvider: provider, kycStatus: 'verified', country, asOf: now, freshnessHours: 0 }
  const proof = await appendTrustProof(userId, {
    source: 'identity', status: 'verified', method: `kyc_${provider}`,
    providerSubjectId: source === 'founder' ? (clean(fetched.reference || reference, 200) || null) : null,
    confidence: 0.97, metadata, evidenceHash: resultHash,
    expiresAt: new Date(Date.now() + config.proofTtlDays * 86400000).toISOString(),
    attestationLevel: 'provider_observed', correlationGroup: 'identity',
  })
  if (!proof.ok) return proof
  return { ok: true, provider, kind: 'kyc', status: 'verified', profile: proof.profile, verification: proof.proof }
}

// --- business registry (legal entity + officers) ----------------------------

export async function verifyBusinessRegistry(userId, input = {}, { env = process.env, fetchImpl } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'identity_requires_postgres_authority' }
  const availability = resolveIdentityAvailability(env)
  if (!availability.enabled) return comingSoon(availability.availability_reason)

  const provider = clean(input.provider, 40).toLowerCase() || 'opencorporates'
  if (!findRegistryProvider(provider)) return { ok: false, status: 404, error: 'unsupported_registry_provider' }
  const resolved = resolveIdentityRegistryProvider(provider, env)
  if (resolved.availability !== 'available') return unavailable(resolved)

  const { credential, source, row, subject: storedSubject } = await resolveCredential(userId, provider, platformRegistryCredential, env)
  if (!credential) return { ok: false, status: 409, error: 'identity_credential_not_connected' }
  const subject = clean(input.companyNumber || input.subject || storedSubject, 200) || null

  const fetched = await fetchProviderRegistry(provider, credential, { env, fetchImpl, subject, founderName: input.founderName || input.legalName })
  if (!fetched.ok) return fetched
  if (!fetched.entityExists || !fetched.entity) return { ok: false, status: 422, error: 'registry_entity_not_found' }
  if (!fetched.founderIsOfficer) return { ok: false, status: 422, error: 'registry_officer_not_found', detail: { entity: fetched.entity.name } }

  const config = resolveIdentityConfig(env)
  const now = nowIso()
  const resultHash = hash({ provider, companyNumber: fetched.entity.companyNumber, founder: true })
  await repo.withTrustTransaction(async client => {
    await repo.insertIdentityVerification({
      id: createId('trust_identity'), userId, provider, kind: 'registry', status: 'verified',
      providerReference: clean(fetched.subject, 200) || null, subject, country: null, resultHash, checkedAt: now, createdAt: now,
    }, { client })
  })
  if (row) await repo.markCredentialSynced(row.id, { subject: fetched.subject, verifiedAt: now })

  const metadata = { identityKind: 'registry', entityName: fetched.entity.name, companyNumber: fetched.entity.companyNumber, jurisdiction: fetched.entity.jurisdiction || null, officerVerified: true, asOf: now, freshnessHours: 0 }
  const proof = await appendTrustProof(userId, {
    source: 'identity', status: 'verified', method: 'registry',
    providerSubjectId: source === 'founder' ? (clean(fetched.subject, 200) || null) : null,
    confidence: 0.95, metadata, evidenceHash: resultHash,
    expiresAt: new Date(Date.now() + config.proofTtlDays * 86400000).toISOString(),
    attestationLevel: 'provider_observed', correlationGroup: 'identity',
  })
  if (!proof.ok) return proof
  return { ok: true, provider, kind: 'registry', status: 'verified', entity: fetched.entity, profile: proof.profile, verification: proof.proof }
}

// --- sanctions / PEP screening (append-only) --------------------------------

export async function runSanctionsScreening(userId, input = {}, { env = process.env, fetchImpl, list = null } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'identity_requires_postgres_authority' }
  const availability = resolveIdentityAvailability(env)
  if (!availability.enabled) return comingSoon(availability.availability_reason)

  const provider = clean(input.provider, 40).toLowerCase() || resolveIdentityConfig(env).screeningProviders[0]
  const resolved = resolveScreeningProvider(provider, env)
  if (!findScreeningProvider(provider)) return { ok: false, status: 404, error: 'unsupported_screening_provider' }
  if (resolved.availability !== 'available') return unavailable(resolved)

  const name = clean(input.name || input.legalName, 160) || null
  if (!name) return { ok: false, status: 400, error: 'screening_name_required' }
  const country = clean(input.country, 2).toUpperCase() || null
  const { credential } = await resolveCredential(userId, provider, platformScreeningCredential, env)
  if (findScreeningProvider(provider).credential_env.length && !credential) return { ok: false, status: 409, error: 'screening_credential_not_connected' }

  const screened = await fetchSanctionsScreening(provider, credential, { env, fetchImpl, name, country, list })
  if (!screened.ok) return screened
  const now = nowIso()
  const resultHash = hash({ provider, name, country, status: screened.status, matchCount: screened.matchCount, userId })
  await repo.withTrustTransaction(async client => {
    await repo.insertScreeningResult({
      id: createId('trust_screening'), userId, provider, subjectHash: hash({ provider, name: name.toLowerCase() }),
      status: screened.status, matchCount: screened.matchCount, country, resultHash, screenedAt: now, createdAt: now,
    }, { client })
  })
  return { ok: true, provider, screening: { status: screened.status, match_count: screened.matchCount, country, screened_at: now, rescreen_days: resolveIdentityConfig(env).rescreenDays } }
}

// --- read models ------------------------------------------------------------

export async function listSanctionsScreening(userId) {
  if (!writeAuthorityRequired()) return { ok: true, screening: [] }
  const rows = await repo.listScreeningResults(userId)
  return { ok: true, screening: rows.map(row => ({ id: row.id, provider: row.provider, status: row.status, match_count: row.matchCount, country: row.country, screened_at: row.screenedAt })) }
}

export async function listIdentity(userId) {
  if (!writeAuthorityRequired()) return { ok: true, verifications: [], screening: [], screening_due: false, proofs: [] }
  const config = resolveIdentityConfig(process.env)
  const [verifications, screening, proofs] = await Promise.all([repo.listIdentityVerifications(userId), repo.listScreeningResults(userId), repo.listProofs(userId)])
  const latest = screening[0] || null
  const dueAt = latest ? new Date(latest.screenedAt).getTime() + config.rescreenDays * 86400000 : 0
  return {
    ok: true,
    verifications: verifications.map(row => ({ id: row.id, provider: row.provider, kind: row.kind, status: row.status, reference: row.providerReference, country: row.country, checked_at: row.checkedAt })),
    screening: screening.map(row => ({ id: row.id, provider: row.provider, status: row.status, match_count: row.matchCount, country: row.country, screened_at: row.screenedAt })),
    screening_due: !latest || Date.now() >= dueAt,
    rescreen_days: config.rescreenDays,
    proofs: proofs.filter(proof => proof.source === 'identity').map(proof => ({ id: proof.id, method: proof.method, status: proof.status, attestation_level: proof.attestationLevel || 'self', expires_at: proof.expiresAt })),
  }
}

// --- refresh worker ---------------------------------------------------------

export async function runIdentityRefresh({ env = process.env, fetchImpl, limit = 100 } = {}) {
  if (!writeAuthorityRequired()) return { ok: true, skipped: 'identity_requires_postgres_authority' }
  const availability = resolveIdentityAvailability(env)
  if (!availability.enabled) return { ok: true, skipped: 'identity_disabled' }
  const config = resolveIdentityConfig(env)
  const due = await repo.listCredentialsDueForSync({ intervalMs: config.syncIntervalMs, limit })
  const results = []
  for (const row of due) {
    if (row.source !== CREDENTIAL_SOURCE || !findKycProvider(row.provider)) continue
    try {
      const result = await verifyIdentity(row.userId, { provider: row.provider, reference: row.subject }, { env, fetchImpl })
      results.push({ userId: row.userId, provider: row.provider, ok: result.ok, error: result.error || null })
    } catch (error) {
      results.push({ userId: row.userId, provider: row.provider, ok: false, error: 'refresh_failed', detail: error.message })
    }
  }
  return { ok: true, refreshed: results.length, results }
}
