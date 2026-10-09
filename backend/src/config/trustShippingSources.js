// Shipping / deployment cadence verification source configuration (WS5).
//
// Env-driven: which CI/CD sub-providers are supported, their read-only API
// hosts, credential/subject env names, timeouts, refresh cadence, and the
// anti-gaming thresholds. Code only enforces invariants (allow-listed hosts,
// aggregates-only, cadence metrics can never come from founder input).

const isTrue = value => String(value ?? '').trim().toLowerCase() === 'true'
const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const list = value => String(value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)

// Read-only provider registry. `credential_env` names the platform-level
// credential env vars (used for UI gating + the platform fallback); founders
// that self-supply a read-only token have it stored encrypted in the vault.
export const SHIPPING_PROVIDERS = Object.freeze({
  github_actions: Object.freeze({
    provider: 'github_actions',
    display_name: 'GitHub Actions',
    base_url: 'https://api.github.com',
    hosts: Object.freeze(['api.github.com']),
    credential_env: Object.freeze(['GITHUB_ACTIONS_TOKEN', 'GITHUB_TOKEN']),
    subject_env: Object.freeze(['GITHUB_ACTIONS_REPO']),
    auth: 'bearer',
    deliverables: Object.freeze(['merged_prs', 'releases', 'deploy_success_rate', 'lead_time']),
    docs_url: 'https://docs.github.com/en/rest/actions',
  }),
  vercel: Object.freeze({
    provider: 'vercel',
    display_name: 'Vercel',
    base_url: 'https://api.vercel.com',
    hosts: Object.freeze(['api.vercel.com']),
    credential_env: Object.freeze(['VERCEL_TOKEN']),
    subject_env: Object.freeze(['VERCEL_PROJECT_ID']),
    auth: 'bearer',
    deliverables: Object.freeze(['deploys', 'deploy_success_rate', 'uptime']),
    docs_url: 'https://vercel.com/docs/rest-api',
  }),
  render: Object.freeze({
    provider: 'render',
    display_name: 'Render',
    base_url: 'https://api.render.com',
    hosts: Object.freeze(['api.render.com']),
    credential_env: Object.freeze(['RENDER_API_KEY']),
    subject_env: Object.freeze(['RENDER_SERVICE_ID']),
    auth: 'bearer',
    deliverables: Object.freeze(['deploys', 'deploy_success_rate']),
    docs_url: 'https://api-docs.render.com/reference/introduction',
  }),
  railway: Object.freeze({
    provider: 'railway',
    display_name: 'Railway',
    base_url: 'https://backboard.railway.app',
    hosts: Object.freeze(['backboard.railway.app']),
    credential_env: Object.freeze(['RAILWAY_TOKEN']),
    subject_env: Object.freeze(['RAILWAY_PROJECT_ID']),
    auth: 'bearer',
    deliverables: Object.freeze(['deploys', 'deploy_success_rate']),
    docs_url: 'https://docs.railway.com/reference/public-api',
  }),
  cloudflare: Object.freeze({
    provider: 'cloudflare',
    display_name: 'Cloudflare Pages',
    base_url: 'https://api.cloudflare.com',
    hosts: Object.freeze(['api.cloudflare.com']),
    credential_env: Object.freeze(['CLOUDFLARE_API_TOKEN']),
    subject_env: Object.freeze(['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_PAGES_PROJECT']),
    auth: 'bearer',
    deliverables: Object.freeze(['deploys', 'deploy_success_rate']),
    docs_url: 'https://developers.cloudflare.com/api/',
  }),
  netlify: Object.freeze({
    provider: 'netlify',
    display_name: 'Netlify',
    base_url: 'https://api.netlify.com',
    hosts: Object.freeze(['api.netlify.com']),
    credential_env: Object.freeze(['NETLIFY_AUTH_TOKEN']),
    subject_env: Object.freeze(['NETLIFY_SITE_ID']),
    auth: 'bearer',
    deliverables: Object.freeze(['deploys', 'deploy_success_rate']),
    docs_url: 'https://docs.netlify.com/api/get-started/',
  }),
})

export function findShippingProvider(provider) {
  return SHIPPING_PROVIDERS[String(provider || '').trim().toLowerCase()] || null
}

export function listShippingProviders() {
  return Object.values(SHIPPING_PROVIDERS)
}

export function platformShippingCredential(provider, env = process.env) {
  const entry = findShippingProvider(provider)
  if (!entry) return null
  for (const name of entry.credential_env) {
    const value = String(env[name] || '').trim()
    if (value) return value
  }
  return null
}

export function platformShippingSubject(provider, env = process.env) {
  const entry = findShippingProvider(provider)
  if (!entry) return null
  for (const name of entry.subject_env || []) {
    const value = String(env[name] || '').trim()
    if (value) return value
  }
  return null
}

// Global shipping config. `enabled` is the master gate; the rest tunes once on.
export function resolveShippingConfig(env = process.env) {
  const allowedProviders = list(env.TRUST_SHIPPING_PROVIDERS)
  const requireDpia = isTrue(env.TRUST_SHIPPING_REQUIRE_DPIA)
  const dpiaRef = String(env.TRUST_SHIPPING_DPIA_APPROVAL_REF || '').trim()
  return {
    enabled: isTrue(env.TRUST_SHIPPING_ENABLED ?? env.TRUST_DEPLOYMENT_ENABLED),
    // Default: github_actions. `TRUST_SHIPPING_PROVIDERS=github_actions,vercel` opts in more.
    allowedProviders: allowedProviders.length ? allowedProviders : ['github_actions'],
    dpiaRequired: requireDpia,
    dpiaApproved: !requireDpia || Boolean(dpiaRef),
    requireDomainMatch: isTrue(env.TRUST_SHIPPING_REQUIRE_DOMAIN_MATCH),
    minDeploys30d: num(env.TRUST_SHIPPING_MIN_DEPLOYS_30D, 0),
    maxDeploysJumpRatio: num(env.TRUST_SHIPPING_MAX_DEPLOYS_JUMP_RATIO, 5),
    maxFreshnessHours: num(env.TRUST_SHIPPING_MAX_FRESHNESS_HOURS, 72),
    syncIntervalMs: Math.max(3600_000, num(env.TRUST_SHIPPING_SYNC_INTERVAL_MS, 24 * 3600_000)),
    proofTtlDays: Math.max(1, num(env.TRUST_SHIPPING_PROOF_TTL_DAYS, 7)),
    timeoutMs: Math.max(2000, num(env.TRUST_SHIPPING_TIMEOUT_MS, 15000)),
    windowDays: Math.max(1, num(env.TRUST_SHIPPING_WINDOW_DAYS, 30)),
  }
}

// Per-provider resolution: is this provider usable now, and if not, why.
export function resolveShippingProvider(provider, env = process.env) {
  const entry = findShippingProvider(provider)
  if (!entry) return { provider: String(provider || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_provider' }
  const config = resolveShippingConfig(env)
  const flag = `TRUST_SHIPPING_${entry.provider.toUpperCase()}_ENABLED`
  const providerEnabled = String(env[flag] ?? 'true').trim().toLowerCase() !== 'false'
  let availability = 'available'
  let availability_reason = null
  if (!config.enabled) { availability = 'coming_soon'; availability_reason = 'feature_disabled' }
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

export function resolveShippingProviderAvailability(env = process.env) {
  return Object.fromEntries(listShippingProviders().map(entry => [entry.provider, resolveShippingProvider(entry.provider, env)]))
}
