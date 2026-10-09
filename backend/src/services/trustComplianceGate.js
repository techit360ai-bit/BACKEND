// Hard gate for founder identity/KYC and sanctions screening (WS8).
//
// Regulatory work must fail closed. Identity verification, document handling,
// and sanctions/PEP screening must not run until:
//   - the feature is explicitly enabled,
//   - an allowlisted provider is configured,
//   - a DPIA / data-protection approval reference is recorded, and
//   - the covered regions are declared.
// Nothing here fetches or stores documents. It only decides whether the caller
// is allowed to proceed.

const ALLOWED_KYC_PROVIDERS = new Set(['stripe_identity', 'persona', 'onfido', 'veriff'])

export function kycProviderAllowlist() {
  return [...ALLOWED_KYC_PROVIDERS]
}

export function resolveKycConfig(env = process.env) {
  const enabled = String(env.TRUST_KYC_ENABLED || '').trim().toLowerCase() === 'true'
  const provider = String(env.TRUST_KYC_PROVIDER || '').trim().toLowerCase()
  const dpiaRef = String(env.TRUST_DPIA_APPROVAL_REF || '').trim()
  const regions = String(env.TRUST_KYC_REGIONS || '')
    .split(',')
    .map(value => value.trim().toUpperCase())
    .filter(Boolean)

  const reasons = []
  if (!enabled) reasons.push('kyc_disabled')
  if (!provider) reasons.push('provider_missing')
  else if (!ALLOWED_KYC_PROVIDERS.has(provider)) reasons.push('provider_not_allowlisted')
  if (!dpiaRef) reasons.push('dpia_approval_ref_missing')
  if (!regions.length) reasons.push('regions_missing')

  return {
    enabled: reasons.length === 0,
    provider,
    dpiaRef,
    regions,
    sanctionRescreenDays: Math.max(1, Number(env.TRUST_SANCTIONS_RESCREEN_DAYS || 30)),
    reasons,
  }
}

export function assertFounderKycEnabled(env = process.env) {
  const config = resolveKycConfig(env)
  if (!config.enabled) {
    const error = new Error(`founder_kyc_blocked: ${config.reasons.join(',')}`)
    error.code = 'founder_kyc_blocked'
    error.reasons = config.reasons
    throw error
  }
  return config
}

export function isRegionAllowed(countryCode, env = process.env) {
  const config = resolveKycConfig(env)
  return config.enabled && config.regions.includes(String(countryCode || '').trim().toUpperCase())
}

// Metadata-only retention posture for identity results.
export function kycRetentionPolicy(env = process.env) {
  return {
    rawDocumentsStored: false,
    store: ['status', 'provider_reference', 'result_hash', 'checked_at'],
    retentionDays: Math.max(1, Number(env.TRUST_KYC_RETENTION_DAYS || 365)),
  }
}
