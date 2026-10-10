// Founder identity / KYC source configuration (WS8).
//
// Two provider-observed paths:
//   - KYC: government ID + liveness via an allowlisted provider. Only status,
//     provider reference, and a result hash are ever stored — never documents.
//   - Sanctions/PEP: OFAC SDN (public list, no credential) plus an optional
//     provider screening feed. Results are append-only.
// Business-registry (legal entity + officers) reuses the WS6 registry adapters.
//
// The hard compliance gate lives in trustComplianceGate.js (fail closed until
// TRUST_KYC_ENABLED + allowlisted provider + DPIA ref + regions). Code here
// enforces invariants; the provider catalog and every threshold are env-driven.

import { resolveKycConfig } from '../services/trustComplianceGate.js'
import { findRegistryProvider } from './trustTeamSources.js'

const isTrue = value => String(value ?? '').trim().toLowerCase() === 'true'
const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const list = value => String(value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)

// Read-only KYC providers. `credential_env` names platform-level credentials
// (UI gating + fallback); a founder may also store an encrypted key in the
// vault. Documents are never fetched or persisted — only the decision + hash.
export const KYC_PROVIDERS = Object.freeze({
  stripe_identity: Object.freeze({
    provider: 'stripe_identity', display_name: 'Stripe Identity', kind: 'kyc',
    base_url: 'https://api.stripe.com', hosts: Object.freeze(['api.stripe.com']),
    credential_env: Object.freeze(['STRIPE_IDENTITY_SECRET_KEY', 'STRIPE_SECRET_KEY']),
    auth: 'bearer', docs_url: 'https://docs.stripe.com/identity',
  }),
  persona: Object.freeze({
    provider: 'persona', display_name: 'Persona', kind: 'kyc',
    base_url: 'https://api.withpersona.com', hosts: Object.freeze(['api.withpersona.com']),
    credential_env: Object.freeze(['PERSONA_API_KEY']),
    auth: 'persona', docs_url: 'https://docs.withpersona.com/',
  }),
  onfido: Object.freeze({
    provider: 'onfido', display_name: 'Onfido', kind: 'kyc',
    base_url: 'https://api.onfido.com', hosts: Object.freeze(['api.onfido.com']),
    credential_env: Object.freeze(['ONFIDO_API_TOKEN']),
    auth: 'bearer', docs_url: 'https://documentation.onfido.com/',
  }),
  veriff: Object.freeze({
    provider: 'veriff', display_name: 'Veriff', kind: 'kyc',
    base_url: 'https://stationapi.veriff.com', hosts: Object.freeze(['stationapi.veriff.com']),
    credential_env: Object.freeze(['VERIFF_API_KEY']),
    auth: 'x-auth-client', docs_url: 'https://developers.veriff.com/',
  }),
})

// Sanctions / PEP screening sources. `ofac` reads the public US Treasury SDN
// list (no credential); provider feeds need a read-only key.
export const SCREENING_PROVIDERS = Object.freeze({
  ofac: Object.freeze({
    provider: 'ofac', display_name: 'OFAC SDN (US Treasury)', kind: 'public_list',
    base_url: 'https://sanctionslistservice.ofac.treas.gov', hosts: Object.freeze(['sanctionslistservice.ofac.treas.gov']),
    credential_env: Object.freeze([]), auth: 'none', list_path: '/api/download/sdn.csv',
    docs_url: 'https://sanctionslist.ofac.treas.gov/',
  }),
  sanctions_io: Object.freeze({
    provider: 'sanctions_io', display_name: 'Sanctions.io', kind: 'provider',
    base_url: 'https://api.sanctions.io', hosts: Object.freeze(['api.sanctions.io']),
    credential_env: Object.freeze(['SANCTIONS_IO_API_KEY']), auth: 'bearer',
    docs_url: 'https://docs.sanctions.io/',
  }),
})

export function findKycProvider(provider) {
  return KYC_PROVIDERS[String(provider || '').trim().toLowerCase()] || null
}

export function findScreeningProvider(provider) {
  return SCREENING_PROVIDERS[String(provider || '').trim().toLowerCase()] || null
}

export function listKycProviders() {
  return Object.values(KYC_PROVIDERS)
}

export function listScreeningProviders() {
  return Object.values(SCREENING_PROVIDERS)
}

function platformCredential(entry, env) {
  if (!entry) return null
  for (const name of entry.credential_env) {
    const value = String(env[name] || '').trim()
    if (value) return value
  }
  return null
}

export function platformKycCredential(provider, env = process.env) {
  return platformCredential(findKycProvider(provider), env)
}

export function platformScreeningCredential(provider, env = process.env) {
  return platformCredential(findScreeningProvider(provider), env)
}

export function resolveIdentityConfig(env = process.env) {
  const kyc = resolveKycConfig(env)
  const screeningProviders = list(env.TRUST_IDENTITY_SCREENING_PROVIDERS)
  return {
    enabled: kyc.enabled,
    kycProvider: kyc.provider,
    regions: kyc.regions,
    reasons: kyc.reasons,
    rescreenDays: kyc.sanctionRescreenDays,
    screeningEnabled: String(env.TRUST_IDENTITY_SCREENING_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    screeningProviders: screeningProviders.length ? screeningProviders : ['ofac'],
    requireScreening: isTrue(env.TRUST_IDENTITY_REQUIRE_SCREENING),
    proofTtlDays: Math.max(1, num(env.TRUST_IDENTITY_PROOF_TTL_DAYS, 365)),
    syncIntervalMs: Math.max(3600_000, num(env.TRUST_IDENTITY_SYNC_INTERVAL_MS, 24 * 3600_000)),
    retentionDays: Math.max(1, num(env.TRUST_KYC_RETENTION_DAYS, 365)),
    timeoutMs: Math.max(2000, num(env.TRUST_IDENTITY_TIMEOUT_MS, 15000)),
  }
}

function availabilityReason(reasons = []) {
  if (reasons.includes('kyc_disabled')) return 'feature_disabled'
  if (reasons.includes('dpia_approval_ref_missing')) return 'pending_dpia_approval'
  if (reasons.includes('provider_missing') || reasons.includes('provider_not_allowlisted')) return 'provider_not_configured'
  if (reasons.includes('regions_missing')) return 'regions_not_declared'
  return 'feature_disabled'
}

export function resolveIdentityAvailability(env = process.env) {
  const config = resolveIdentityConfig(env)
  const available = config.enabled
  return {
    provider: 'identity',
    enabled: available,
    availability: available ? 'available' : 'coming_soon',
    availability_reason: available ? null : availabilityReason(config.reasons),
    kyc_provider: config.kycProvider || null,
    regions: config.regions,
    screening_enabled: config.screeningEnabled,
    retention_days: config.retentionDays,
    raw_documents_stored: false,
  }
}

export function resolveKycProvider(provider, env = process.env) {
  const entry = findKycProvider(provider)
  if (!entry) return { provider: String(provider || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_kyc_provider' }
  const config = resolveIdentityConfig(env)
  let availability = 'available'
  let availability_reason = null
  if (!config.enabled) { availability = 'coming_soon'; availability_reason = availabilityReason(config.reasons) }
  else if (config.kycProvider !== entry.provider) { availability = 'coming_soon'; availability_reason = 'provider_not_active' }
  return { ...entry, enabled: availability === 'available', availability, availability_reason, platform_credential_configured: Boolean(platformCredential(entry, env)), supports_founder_key: true }
}

export function resolveScreeningProvider(provider, env = process.env) {
  const entry = findScreeningProvider(provider)
  if (!entry) return { provider: String(provider || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_screening_provider' }
  const config = resolveIdentityConfig(env)
  let availability = 'available'
  let availability_reason = null
  if (!config.screeningEnabled) { availability = 'coming_soon'; availability_reason = 'screening_disabled' }
  else if (!config.screeningProviders.includes(entry.provider)) { availability = 'coming_soon'; availability_reason = 'provider_not_allowed' }
  else if (entry.credential_env.length && !platformCredential(entry, env)) { availability = 'coming_soon'; availability_reason = 'awaiting_provider_credentials' }
  return { ...entry, enabled: availability === 'available', availability, availability_reason, platform_credential_configured: Boolean(platformCredential(entry, env)) }
}

// Business registry for identity: gated by the identity compliance gate, not
// the WS6 team gate. Reuses the WS6 registry host allow-lists + credentials.
export function resolveIdentityRegistryProvider(provider, env = process.env) {
  const entry = findRegistryProvider(provider)
  if (!entry) return { provider: String(provider || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_registry_provider' }
  const config = resolveIdentityConfig(env)
  const availability = config.enabled ? 'available' : 'coming_soon'
  return { ...entry, enabled: config.enabled, availability, availability_reason: config.enabled ? null : availabilityReason(config.reasons), platform_credential_configured: Boolean(platformCredential(entry, env)), supports_founder_key: true }
}

export function resolveIdentityCatalog(env = process.env) {
  return {
    identity: resolveIdentityAvailability(env),
    kyc: Object.fromEntries(listKycProviders().map(entry => [entry.provider, resolveKycProvider(entry.provider, env)])),
    screening: Object.fromEntries(listScreeningProviders().map(entry => [entry.provider, resolveScreeningProvider(entry.provider, env)])),
    registry: Object.fromEntries(['opencorporates', 'companies_house'].map(provider => [provider, resolveIdentityRegistryProvider(provider, env)])),
  }
}
