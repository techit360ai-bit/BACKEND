// Product analytics verification source configuration (WS4).
//
// Env-driven: which analytics sub-providers are supported, their read-only API
// hosts, credential env names, timeouts, refresh cadence, and the anti-gaming
// thresholds. Code only enforces invariants (allowlisted hosts, aggregates-only,
// provider-observed metrics can never come from founder input).

const isTrue = value => String(value ?? '').trim().toLowerCase() === 'true'
const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const list = value => String(value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)

export const ANALYTICS_PROVIDERS = Object.freeze({
  posthog: Object.freeze({
    provider: 'posthog',
    display_name: 'PostHog',
    base_url: 'https://app.posthog.com',
    hosts: Object.freeze(['app.posthog.com', 'us.posthog.com', 'eu.posthog.com']),
    credential_env: Object.freeze(['POSTHOG_API_KEY']),
    subject_env: Object.freeze(['POSTHOG_PROJECT_ID']),
    host_env: 'POSTHOG_HOST',
    auth: 'bearer',
    docs_url: 'https://posthog.com/docs/api/query',
  }),
  ga4: Object.freeze({
    provider: 'ga4',
    display_name: 'Google Analytics 4',
    base_url: 'https://analyticsdata.googleapis.com',
    hosts: Object.freeze(['analyticsdata.googleapis.com', 'oauth2.googleapis.com']),
    credential_env: Object.freeze(['GA4_ACCESS_TOKEN', 'GA4_SERVICE_ACCOUNT_JSON']),
    subject_env: Object.freeze(['GA4_PROPERTY_ID']),
    auth: 'oauth2_service_account',
    docs_url: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
  }),
  firebase: Object.freeze({
    provider: 'firebase',
    display_name: 'Firebase Analytics',
    base_url: 'https://analyticsdata.googleapis.com',
    hosts: Object.freeze(['analyticsdata.googleapis.com', 'oauth2.googleapis.com']),
    credential_env: Object.freeze(['FIREBASE_ACCESS_TOKEN', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_APPLICATION_CREDENTIALS_JSON']),
    subject_env: Object.freeze(['FIREBASE_PROPERTY_ID']),
    auth: 'oauth2_service_account',
    docs_url: 'https://firebase.google.com/docs/analytics',
  }),
  mixpanel: Object.freeze({
    provider: 'mixpanel',
    display_name: 'Mixpanel',
    base_url: 'https://mixpanel.com',
    hosts: Object.freeze(['mixpanel.com', 'api.mixpanel.com']),
    credential_env: Object.freeze(['MIXPANEL_SECRET', 'MIXPANEL_API_SECRET']),
    subject_env: Object.freeze(['MIXPANEL_PROJECT_ID']),
    auth: 'basic',
    docs_url: 'https://developer.mixpanel.com/reference/query-api',
  }),
  amplitude: Object.freeze({
    provider: 'amplitude',
    display_name: 'Amplitude',
    base_url: 'https://amplitude.com',
    hosts: Object.freeze(['amplitude.com']),
    credential_env: Object.freeze(['AMPLITUDE_API_KEY']),
    subject_env: Object.freeze(['AMPLITUDE_SECRET_KEY']),
    auth: 'basic',
    docs_url: 'https://amplitude.com/docs/apis/analytics/dashboard-rest',
  }),
  supabase: Object.freeze({
    provider: 'supabase',
    display_name: 'Supabase',
    base_url: 'https://api.supabase.com',
    hosts: Object.freeze(['api.supabase.com']),
    credential_env: Object.freeze(['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANALYTICS_TOKEN']),
    subject_env: Object.freeze(['SUPABASE_PROJECT_REF']),
    auth: 'bearer',
    // Supabase exposes platform usage, not product MAU/DAU. Gated until a
    // founder-controlled producer (RPC/view) is wired.
    implementation: 'producer_required',
    docs_url: 'https://supabase.com/docs/reference/api/introduction',
  }),
})

export function findAnalyticsProvider(provider) {
  return ANALYTICS_PROVIDERS[String(provider || '').trim().toLowerCase()] || null
}

export function platformAnalyticsCredential(provider, env = process.env) {
  const entry = findAnalyticsProvider(provider)
  if (!entry) return null
  for (const name of entry.credential_env) {
    const value = String(env[name] || '').trim()
    if (value) return value
  }
  return null
}

export function platformAnalyticsSubject(provider, env = process.env) {
  const entry = findAnalyticsProvider(provider)
  if (!entry) return null
  for (const name of entry.subject_env || []) {
    const value = String(env[name] || '').trim()
    if (value) return value
  }
  return null
}

export function listAnalyticsProviders() {
  return Object.values(ANALYTICS_PROVIDERS)
}

export function resolveAnalyticsConfig(env = process.env) {
  const allowedProviders = list(env.TRUST_ANALYTICS_PROVIDERS)
  return {
    enabled: isTrue(env.TRUST_ANALYTICS_ENABLED ?? env.TRUST_PRODUCT_ANALYTICS_ENABLED),
    allowedProviders: allowedProviders.length ? allowedProviders : ['posthog'],
    requireDpia: isTrue(env.TRUST_ANALYTICS_REQUIRE_DPIA),
    dpiaApproved: !isTrue(env.TRUST_ANALYTICS_REQUIRE_DPIA) || Boolean(String(env.TRUST_ANALYTICS_DPIA_APPROVAL_REF || '').trim()),
    minMau: num(env.TRUST_ANALYTICS_MIN_MAU, 0),
    maxMauJumpRatio: num(env.TRUST_ANALYTICS_MAX_MAU_JUMP_RATIO, num(env.TRUST_ANOMALY_MAU_JUMP_RATIO, 5)),
    maxFreshnessHours: num(env.TRUST_ANALYTICS_MAX_FRESHNESS_HOURS, 72),
    requireDomainMatch: isTrue(env.TRUST_ANALYTICS_REQUIRE_DOMAIN_MATCH),
    syncIntervalMs: Math.max(3600_000, num(env.TRUST_ANALYTICS_SYNC_INTERVAL_MS, 24 * 3600_000)),
    proofTtlDays: Math.max(1, num(env.TRUST_ANALYTICS_PROOF_TTL_DAYS, 7)),
    timeoutMs: Math.max(2000, num(env.TRUST_ANALYTICS_TIMEOUT_MS, 15000)),
    windowDays: Math.max(1, num(env.TRUST_ANALYTICS_WINDOW_DAYS, 30)),
  }
}

export function resolveAnalyticsProvider(provider, env = process.env) {
  const entry = findAnalyticsProvider(provider)
  if (!entry) return { provider: String(provider || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_provider' }
  const config = resolveAnalyticsConfig(env)
  const flag = `TRUST_ANALYTICS_${entry.provider.toUpperCase()}_ENABLED`
  const providerEnabled = String(env[flag] ?? 'true').trim().toLowerCase() !== 'false'
  let availability = 'available'
  let availability_reason = null
  if (entry.implementation === 'producer_required') { availability = 'coming_soon'; availability_reason = 'producer_not_wired' }
  else if (!config.enabled) { availability = 'coming_soon'; availability_reason = 'feature_disabled' }
  else if (!config.allowedProviders.includes(entry.provider)) { availability = 'coming_soon'; availability_reason = 'provider_not_allowed' }
  else if (!providerEnabled) { availability = 'coming_soon'; availability_reason = 'provider_disabled' }
  else if (!config.dpiaApproved) { availability = 'coming_soon'; availability_reason = 'pending_dpia_approval' }
  return {
    ...entry,
    enabled: availability === 'available',
    availability,
    availability_reason,
    platform_credential_configured: entry.credential_env.some(name => String(env[name] || '').trim().length > 0),
    supports_founder_key: true,
    timeout_ms: config.timeoutMs,
    window_days: config.windowDays,
  }
}

export function resolveAnalyticsProviderAvailability(env = process.env) {
  return Object.fromEntries(listAnalyticsProviders().map(entry => [entry.provider, resolveAnalyticsProvider(entry.provider, env)]))
}
