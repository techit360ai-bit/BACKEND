// Revenue verification source configuration (WS3).
//
// Every knob here is env-driven: which sub-providers are supported, where their
// read-only API lives (host allow-list), timeouts, refresh cadence, anti-fraud
// thresholds, and the DPIA/livemode gates. Code only enforces invariants that
// must never be configurable (read-only credentials, allowlisted hosts,
// aggregates-only metadata, founder input can never mint a verified proof).

const isTrue = value => String(value ?? '').trim().toLowerCase() === 'true'
const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const list = value => String(value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)

// Read-only provider registry. `credential_env` names the platform-level
// capability env vars (used for gating/UI + OAuth apps); founders that use a
// self-supplied restricted key are stored encrypted in the vault instead. No
// secret value is ever read at module load.
export const REVENUE_PROVIDERS = Object.freeze({
  stripe: Object.freeze({
    provider: 'stripe',
    display_name: 'Stripe',
    base_url: 'https://api.stripe.com',
    hosts: Object.freeze(['api.stripe.com']),
    credential_env: Object.freeze(['STRIPE_RESTRICTED_KEY', 'STRIPE_SECRET_KEY']),
    connect_env: Object.freeze(['STRIPE_CONNECT_CLIENT_ID']),
    key_prefixes: Object.freeze({ live: ['rk_live_', 'sk_live_'], test: ['rk_test_', 'sk_test_'] }),
    supports_livemode: true,
    auth: 'bearer',
    docs_url: 'https://docs.stripe.com/keys/restricted',
  }),
  paystack: Object.freeze({
    provider: 'paystack',
    display_name: 'Paystack',
    base_url: 'https://api.paystack.co',
    hosts: Object.freeze(['api.paystack.co']),
    credential_env: Object.freeze(['PAYSTACK_SECRET_KEY']),
    connect_env: Object.freeze([]),
    key_prefixes: Object.freeze({ live: ['sk_live_'], test: ['sk_test_'] }),
    supports_livemode: true,
    auth: 'bearer',
    docs_url: 'https://paystack.com/docs/api/',
  }),
  flutterwave: Object.freeze({
    provider: 'flutterwave',
    display_name: 'Flutterwave',
    base_url: 'https://api.flutterwave.com',
    hosts: Object.freeze(['api.flutterwave.com']),
    credential_env: Object.freeze(['FLUTTERWAVE_SECRET_KEY']),
    connect_env: Object.freeze([]),
    key_prefixes: Object.freeze({ live: ['FLWSECK-'], test: ['FLWSECK_TEST'] }),
    supports_livemode: true,
    auth: 'bearer',
    docs_url: 'https://developer.flutterwave.com/reference/',
  }),
  paddle: Object.freeze({
    provider: 'paddle',
    display_name: 'Paddle',
    base_url: 'https://api.paddle.com',
    hosts: Object.freeze(['api.paddle.com']),
    credential_env: Object.freeze(['PADDLE_API_KEY']),
    connect_env: Object.freeze([]),
    key_prefixes: Object.freeze({ live: ['pdl_live_'], test: ['pdl_test_'] }),
    supports_livemode: true,
    auth: 'bearer',
    docs_url: 'https://developer.paddle.com/api-reference/overview',
  }),
  razorpay: Object.freeze({
    provider: 'razorpay',
    display_name: 'Razorpay',
    base_url: 'https://api.razorpay.com',
    hosts: Object.freeze(['api.razorpay.com']),
    credential_env: Object.freeze(['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']),
    connect_env: Object.freeze([]),
    key_prefixes: Object.freeze({ live: ['rzp_live_'], test: ['rzp_test_'] }),
    supports_livemode: true,
    auth: 'basic',
    docs_url: 'https://razorpay.com/docs/api/',
  }),
})

// Platform-configured credential for a provider, reusing the same env names the
// payment gateway uses (STRIPE_SECRET_KEY / PAYSTACK_SECRET_KEY /
// FLUTTERWAVE_SECRET_KEY). Never logged or returned. Razorpay needs both halves.
export function platformCredentialFor(provider, env = process.env) {
  const entry = findRevenueProvider(provider)
  if (!entry) return null
  if (entry.auth === 'basic') {
    const keyId = String(env[entry.credential_env[0]] || '').trim()
    const keySecret = String(env[entry.credential_env[1]] || '').trim()
    return keyId && keySecret ? `${keyId}:${keySecret}` : null
  }
  for (const name of entry.credential_env) {
    const value = String(env[name] || '').trim()
    if (value) return value
  }
  return null
}

export function findRevenueProvider(provider) {
  return REVENUE_PROVIDERS[String(provider || '').trim().toLowerCase()] || null
}

export function listRevenueProviders() {
  return Object.values(REVENUE_PROVIDERS)
}

// The global revenue config. `enabled` is the master switch; everything else
// tunes behaviour once enabled and defaults to safe values.
export function resolveRevenueConfig(env = process.env) {
  const allowedProviders = list(env.TRUST_REVENUE_PROVIDERS)
  const providerOverrides = Object.fromEntries(allowedProviders.map(provider => [provider, provider]))
  const requireDpia = isTrue(env.TRUST_REVENUE_REQUIRE_DPIA)
  const dpiaRef = String(env.TRUST_REVENUE_DPIA_APPROVAL_REF || '').trim()
  return {
    enabled: isTrue(env.TRUST_REVENUE_ENABLED),
    // Default: stripe. `TRUST_REVENUE_PROVIDERS=stripe,paystack` opts in more.
    allowedProviders: allowedProviders.length ? allowedProviders : ['stripe'],
    providerOverrides,
    dpiaRequired: requireDpia,
    dpiaApproved: !requireDpia || Boolean(dpiaRef),
    requireLivemode: String(env.TRUST_REVENUE_REQUIRE_LIVEMODE ?? 'true').trim().toLowerCase() !== 'false',
    requireDomainMatch: isTrue(env.TRUST_REVENUE_REQUIRE_DOMAIN_MATCH),
    minMrr: num(env.TRUST_REVENUE_MIN_MRR, 0),
    minPayingCustomers: num(env.TRUST_REVENUE_MIN_PAYING_CUSTOMERS, 0),
    maxMrrJumpPct: num(env.TRUST_REVENUE_MAX_MRR_JUMP_PCT, 500),
    syncIntervalMs: Math.max(3600_000, num(env.TRUST_REVENUE_SYNC_INTERVAL_MS, 24 * 3600_000)),
    proofTtlDays: Math.max(1, num(env.TRUST_REVENUE_PROOF_TTL_DAYS, 30)),
    timeoutMs: Math.max(2000, num(env.TRUST_REVENUE_TIMEOUT_MS, 15000)),
    maxRecords: Math.max(1, num(env.TRUST_REVENUE_MAX_RECORDS, 5000)),
  }
}

// Per-provider resolution: is this provider usable right now, and if not, why.
export function resolveRevenueProvider(provider, env = process.env) {
  const entry = findRevenueProvider(provider)
  if (!entry) return { provider: String(provider || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_provider' }
  const config = resolveRevenueConfig(env)
  const flag = `TRUST_REVENUE_${entry.provider.toUpperCase()}_ENABLED`
  const providerEnabled = String(env[flag] ?? 'true').trim().toLowerCase() !== 'false'
  const platformCredentialConfigured = [...entry.credential_env, ...entry.connect_env].some(name => String(env[name] || '').trim().length > 0)
  let availability = 'available'
  let availability_reason = null
  if (!config.enabled) { availability = 'coming_soon'; availability_reason = 'feature_disabled' }
  else if (!providerEnabled) { availability = 'coming_soon'; availability_reason = 'provider_disabled' }
  else if (!config.dpiaApproved) { availability = 'coming_soon'; availability_reason = 'pending_dpia_approval' }
  return {
    ...entry,
    enabled: availability === 'available',
    availability,
    availability_reason,
    platform_credential_configured: platformCredentialConfigured,
    supports_founder_key: true,
    timeout_ms: config.timeoutMs,
    max_records: config.maxRecords,
  }
}

export function resolveRevenueProviderAvailability(env = process.env) {
  return Object.fromEntries(listRevenueProviders().map(entry => [entry.provider, resolveRevenueProvider(entry.provider, env)]))
}
