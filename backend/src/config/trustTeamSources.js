// Team verification source configuration (WS6).
//
// Env-driven: which work-email/registry/HRIS sources are enabled, their hosts,
// credential env names, timeouts, OTP policy, refresh cadence, and the
// anti-gaming thresholds. Code only enforces invariants:
//   - a work email must be on a domain the founder already proved ownership of
//   - only provider-observed results may mint a verified team/organization proof.

const isTrue = value => String(value ?? '').trim().toLowerCase() === 'true'
const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const list = value => String(value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)

// Read-only company-registry providers. `credential_env` names platform-level
// credentials (UI gating + fallback); founder-supplied tokens are stored
// encrypted in the vault.
export const REGISTRY_PROVIDERS = Object.freeze({
  opencorporates: Object.freeze({
    provider: 'opencorporates',
    display_name: 'OpenCorporates',
    base_url: 'https://api.opencorporates.com',
    hosts: Object.freeze(['api.opencorporates.com']),
    credential_env: Object.freeze(['OPENCORPORATES_API_KEY']),
    auth: 'query_token',
    docs_url: 'https://api.opencorporates.com/documentation/API-Reference',
  }),
  companies_house: Object.freeze({
    provider: 'companies_house',
    display_name: 'UK Companies House',
    base_url: 'https://api.company-information.service.gov.uk',
    hosts: Object.freeze(['api.company-information.service.gov.uk']),
    credential_env: Object.freeze(['COMPANIES_HOUSE_API_KEY']),
    auth: 'basic',
    docs_url: 'https://developer.company-information.service.gov.uk/',
  }),
})

// Read-only HRIS / company-profile providers. Only headcount + role aggregates
// are stored; individual employee PII never leaves the adapter.
export const HRIS_PROVIDERS = Object.freeze({
  gusto: Object.freeze({
    provider: 'gusto',
    display_name: 'Gusto',
    base_url: 'https://api.gusto.com',
    hosts: Object.freeze(['api.gusto.com']),
    credential_env: Object.freeze(['GUSTO_API_KEY']),
    auth: 'bearer',
    docs_url: 'https://docs.gusto.com/app-integrations/docs/authentication',
  }),
  rippling: Object.freeze({
    provider: 'rippling',
    display_name: 'Rippling',
    base_url: 'https://api.rippling.com',
    hosts: Object.freeze(['api.rippling.com']),
    credential_env: Object.freeze(['RIPPLING_API_KEY']),
    auth: 'bearer',
    docs_url: 'https://developer.rippling.com/docs',
  }),
  bamboohr: Object.freeze({
    provider: 'bamboohr',
    display_name: 'BambooHR',
    base_url: 'https://api.bamboohr.com',
    hosts: Object.freeze(['api.bamboohr.com']),
    credential_env: Object.freeze(['BAMBOOHR_API_KEY']),
    auth: 'basic',
    docs_url: 'https://documentation.bamboohr.com/docs/getting-started',
  }),
  linkedin_company: Object.freeze({
    provider: 'linkedin_company',
    display_name: 'LinkedIn Company',
    base_url: 'https://api.linkedin.com',
    hosts: Object.freeze(['api.linkedin.com']),
    credential_env: Object.freeze(['LINKEDIN_COMPANY_ACCESS_TOKEN']),
    auth: 'bearer',
    docs_url: 'https://learn.microsoft.com/en-us/linkedin/marketing/',
  }),
})

export function findRegistryProvider(provider) {
  return REGISTRY_PROVIDERS[String(provider || '').trim().toLowerCase()] || null
}

export function findHrisProvider(provider) {
  return HRIS_PROVIDERS[String(provider || '').trim().toLowerCase()] || null
}

export function listTeamProviders() {
  return [...Object.values(REGISTRY_PROVIDERS), ...Object.values(HRIS_PROVIDERS)]
}

function platformCredential(entry, env) {
  if (!entry) return null
  for (const name of entry.credential_env) {
    const value = String(env[name] || '').trim()
    if (value) return value
  }
  return null
}

export function platformRegistryCredential(provider, env = process.env) { return platformCredential(findRegistryProvider(provider), env) }
export function platformHrisCredential(provider, env = process.env) { return platformCredential(findHrisProvider(provider), env) }

// Global team config. OTP policy and cadence live here; the verified-domain
// requirement for work emails is a hard invariant and is not configurable.
export function resolveTeamConfig(env = process.env) {
  const registryProviders = list(env.TRUST_TEAM_REGISTRY_PROVIDERS)
  const hrisProviders = list(env.TRUST_TEAM_HRIS_PROVIDERS)
  const requireDpia = isTrue(env.TRUST_TEAM_REQUIRE_DPIA)
  const dpiaRef = String(env.TRUST_TEAM_DPIA_APPROVAL_REF || '').trim()
  return {
    enabled: isTrue(env.TRUST_TEAM_ENABLED),
    workEmailEnabled: String(env.TRUST_TEAM_WORK_EMAIL_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
    allowedRegistryProviders: registryProviders.length ? registryProviders : ['opencorporates'],
    allowedHrisProviders: hrisProviders.length ? hrisProviders : ['gusto'],
    dpiaRequired: requireDpia,
    dpiaApproved: !requireDpia || Boolean(dpiaRef),
    otpTtlMinutes: Math.max(1, num(env.TRUST_TEAM_OTP_TTL_MINUTES, 30)),
    otpMaxAttempts: Math.max(1, num(env.TRUST_TEAM_OTP_MAX_ATTEMPTS, 5)),
    otpResendCooldownSeconds: Math.max(0, num(env.TRUST_TEAM_OTP_RESEND_COOLDOWN_SECONDS, 60)),
    otpDevMode: isTrue(env.TRUST_TEAM_OTP_DEV_MODE),
    minHeadcount: num(env.TRUST_TEAM_MIN_HEADCOUNT, 0),
    maxHeadcountJumpRatio: num(env.TRUST_TEAM_MAX_HEADCOUNT_JUMP_RATIO, 5),
    maxFreshnessHours: num(env.TRUST_TEAM_MAX_FRESHNESS_HOURS, 72),
    syncIntervalMs: Math.max(3600_000, num(env.TRUST_TEAM_SYNC_INTERVAL_MS, 24 * 3600_000)),
    proofTtlDays: Math.max(1, num(env.TRUST_TEAM_PROOF_TTL_DAYS, 90)),
    timeoutMs: Math.max(2000, num(env.TRUST_TEAM_TIMEOUT_MS, 15000)),
  }
}

// Work-email availability: needs the master gate, the work-email flag, an email
// provider (RESEND_API_KEY) unless in dev mode, and DPIA when required.
export function resolveWorkEmailAvailability(env = process.env) {
  const config = resolveTeamConfig(env)
  let availability = 'available'
  let availability_reason = null
  if (!config.enabled) { availability = 'coming_soon'; availability_reason = 'feature_disabled' }
  else if (!config.workEmailEnabled) { availability = 'coming_soon'; availability_reason = 'work_email_disabled' }
  else if (!config.dpiaApproved) { availability = 'coming_soon'; availability_reason = 'pending_dpia_approval' }
  else if (!config.otpDevMode && !String(env.RESEND_API_KEY || '').trim()) { availability = 'coming_soon'; availability_reason = 'awaiting_email_provider' }
  return { provider: 'work_email', enabled: availability === 'available', availability, availability_reason, requires_verified_domain: true, otp_ttl_minutes: config.otpTtlMinutes }
}

// Per-registry-provider resolution.
export function resolveRegistryProvider(provider, env = process.env) {
  const entry = findRegistryProvider(provider)
  if (!entry) return { provider: String(provider || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_provider' }
  const config = resolveTeamConfig(env)
  const flag = `TRUST_TEAM_REGISTRY_${entry.provider.toUpperCase()}_ENABLED`
  const providerEnabled = String(env[flag] ?? 'true').trim().toLowerCase() !== 'false'
  let availability = 'available'
  let availability_reason = null
  if (!config.enabled) { availability = 'coming_soon'; availability_reason = 'feature_disabled' }
  else if (!config.allowedRegistryProviders.includes(entry.provider)) { availability = 'coming_soon'; availability_reason = 'provider_not_allowed' }
  else if (!providerEnabled) { availability = 'coming_soon'; availability_reason = 'provider_disabled' }
  else if (!config.dpiaApproved) { availability = 'coming_soon'; availability_reason = 'pending_dpia_approval' }
  return { ...entry, enabled: availability === 'available', availability, availability_reason, platform_credential_configured: Boolean(platformCredential(entry, env)), supports_founder_key: true }
}

// Per-HRIS-provider resolution.
export function resolveHrisProvider(provider, env = process.env) {
  const entry = findHrisProvider(provider)
  if (!entry) return { provider: String(provider || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_provider' }
  const config = resolveTeamConfig(env)
  const flag = `TRUST_TEAM_HRIS_${entry.provider.toUpperCase()}_ENABLED`
  const providerEnabled = String(env[flag] ?? 'true').trim().toLowerCase() !== 'false'
  let availability = 'available'
  let availability_reason = null
  if (!config.enabled) { availability = 'coming_soon'; availability_reason = 'feature_disabled' }
  else if (!config.allowedHrisProviders.includes(entry.provider)) { availability = 'coming_soon'; availability_reason = 'provider_not_allowed' }
  else if (!providerEnabled) { availability = 'coming_soon'; availability_reason = 'provider_disabled' }
  else if (!config.dpiaApproved) { availability = 'coming_soon'; availability_reason = 'pending_dpia_approval' }
  return { ...entry, enabled: availability === 'available', availability, availability_reason, platform_credential_configured: Boolean(platformCredential(entry, env)), supports_founder_key: true }
}

export function resolveTeamProviderAvailability(env = process.env) {
  return {
    work_email: resolveWorkEmailAvailability(env),
    registry: Object.fromEntries(Object.values(REGISTRY_PROVIDERS).map(entry => [entry.provider, resolveRegistryProvider(entry.provider, env)])),
    hris: Object.fromEntries(Object.values(HRIS_PROVIDERS).map(entry => [entry.provider, resolveHrisProvider(entry.provider, env)])),
  }
}
