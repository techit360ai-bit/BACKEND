// Trust source registry + availability.
//
// Drives the founder-facing "Coming soon" state. A source is only `available`
// when its feature flag is on, its credentials are configured, the AI-router is
// reachable, and (for identity) the DPIA/region compliance gate passes.
//
// This is presentation + gating metadata only. It never grants verification:
// proof creation is still decided by the authority/adapters.

import { resolveKycConfig } from '../services/trustComplianceGate.js'

const isTrue = value => String(value ?? '').trim().toLowerCase() === 'true'
const hasAny = (env, keys) => keys.some(key => String(env[key] || '').trim().length > 0)

export const TRUST_SOURCE_REGISTRY = Object.freeze([
  // --- Real, already-wired identity/ownership sources ---
  { source: 'github', provider: 'github', display_name: 'GitHub', category: 'profile', auth_method: 'oauth2', alwaysAvailable: true },
  { source: 'linkedin', provider: 'linkedin', display_name: 'LinkedIn', category: 'profile', auth_method: 'oauth2', alwaysAvailable: true },
  { source: 'domain', provider: 'domain', display_name: 'Domain', category: 'web', auth_method: 'dns', alwaysAvailable: true },
  { source: 'website', provider: 'website', display_name: 'Website', category: 'web', auth_method: 'https', alwaysAvailable: true },

  // --- Contact sources: no verified producer wired yet ---
  { source: 'email', provider: 'email', display_name: 'Email', category: 'contact', auth_method: 'email_otp', gatedBy: 'TRUST_CONTACT_SOURCES_ENABLED', comingSoonReason: 'producer_not_wired' },
  { source: 'phone', provider: 'phone', display_name: 'Phone', category: 'contact', auth_method: 'sms_otp', gatedBy: 'TRUST_CONTACT_SOURCES_ENABLED', comingSoonReason: 'producer_not_wired' },

  // --- Execution sources (WS3-WS8) ---
  { source: 'revenue', provider: 'revenue', display_name: 'Revenue', category: 'execution', auth_method: 'readonly_key',
    // Node-local: the backend reads the provider directly with the same
    // credentials the payment section uses, so the AI-router is not required.
    nodeLocal: true,
    gatedBy: 'TRUST_REVENUE_ENABLED',
    requireDpiaEnv: 'TRUST_REVENUE_REQUIRE_DPIA',
    dpiaRefEnv: 'TRUST_REVENUE_DPIA_APPROVAL_REF',
    anyCredentials: ['STRIPE_RESTRICTED_KEY', 'STRIPE_SECRET_KEY', 'PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY', 'PADDLE_API_KEY'] },
  { source: 'product_analytics', provider: 'product_analytics', display_name: 'Product analytics', category: 'execution', auth_method: 'readonly_key',
    // Node-local: the backend reads the analytics provider directly; no AI-router.
    nodeLocal: true,
    gatedBy: 'TRUST_PRODUCT_ANALYTICS_ENABLED',
    requireDpiaEnv: 'TRUST_ANALYTICS_REQUIRE_DPIA',
    dpiaRefEnv: 'TRUST_ANALYTICS_DPIA_APPROVAL_REF',
    anyCredentials: ['POSTHOG_API_KEY', 'MIXPANEL_SECRET', 'GA4_SERVICE_ACCOUNT_JSON', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'SUPABASE_SERVICE_ROLE_KEY'] },
  { source: 'deployment', provider: 'shipping', display_name: 'Shipping & deployment', category: 'execution', auth_method: 'readonly_token',
    // Node-local: the backend reads the CI/CD provider directly; no AI-router.
    nodeLocal: true,
    gatedBy: 'TRUST_SHIPPING_ENABLED',
    requireDpiaEnv: 'TRUST_SHIPPING_REQUIRE_DPIA',
    dpiaRefEnv: 'TRUST_SHIPPING_DPIA_APPROVAL_REF',
    anyCredentials: ['VERCEL_TOKEN', 'RENDER_API_KEY', 'RAILWAY_TOKEN', 'CLOUDFLARE_API_TOKEN', 'NETLIFY_AUTH_TOKEN', 'GITHUB_ACTIONS_TOKEN', 'GITHUB_TOKEN'] },
  { source: 'team', provider: 'team', display_name: 'Team', category: 'execution', auth_method: 'registry_hris',
    // Node-local: work-email OTP + registry/HRIS reads happen in the backend.
    nodeLocal: true,
    gatedBy: 'TRUST_TEAM_ENABLED',
    requireDpiaEnv: 'TRUST_TEAM_REQUIRE_DPIA',
    dpiaRefEnv: 'TRUST_TEAM_DPIA_APPROVAL_REF',
    anyCredentials: ['OPENCORPORATES_API_KEY', 'COMPANIES_HOUSE_API_KEY', 'GUSTO_API_KEY', 'RIPPLING_API_KEY', 'BAMBOOHR_API_KEY', 'LINKEDIN_COMPANY_ACCESS_TOKEN'] },
  { source: 'organization', provider: 'organization', display_name: 'Organization', category: 'execution', auth_method: 'business_registry',
    nodeLocal: true,
    gatedBy: 'TRUST_TEAM_ENABLED',
    requireDpiaEnv: 'TRUST_TEAM_REQUIRE_DPIA',
    dpiaRefEnv: 'TRUST_TEAM_DPIA_APPROVAL_REF',
    anyCredentials: ['OPENCORPORATES_API_KEY', 'COMPANIES_HOUSE_API_KEY'] },
  { source: 'milestone', provider: 'milestone', display_name: 'Milestones', category: 'outcome', auth_method: 'attested_evidence',
    // Node-local: evidence is scanned/hashed in the backend and reviewed here.
    nodeLocal: true,
    gatedBy: 'TRUST_MILESTONES_ENABLED',
    requireDpiaEnv: 'TRUST_MILESTONE_REQUIRE_DPIA',
    dpiaRefEnv: 'TRUST_MILESTONE_DPIA_APPROVAL_REF' },
  { source: 'identity', provider: 'identity', display_name: 'Founder identity', category: 'identity', auth_method: 'kyc', requiresDpia: true,
    gatedBy: 'TRUST_IDENTITY_ENABLED' },
])

export function findTrustSourceByProvider(provider, env = process.env) {
  const key = String(provider || '').trim().toLowerCase()
  const entry = TRUST_SOURCE_REGISTRY.find(item => item.provider === key || item.source === key)
  if (!entry) return null
  return { ...entry, ...resolveSourceAvailability(entry, env) }
}

export function resolveSourceAvailability(entry, env = process.env) {
  if (entry.alwaysAvailable) return { availability: 'available', availability_reason: null, missing_credentials: [] }
  if (entry.requiresDpia && !resolveKycConfig(env).enabled) {
    return { availability: 'coming_soon', availability_reason: 'pending_dpia_approval', missing_credentials: [] }
  }
  if (entry.requireDpiaEnv && isTrue(env[entry.requireDpiaEnv]) && !String(env[entry.dpiaRefEnv] || '').trim()) {
    return { availability: 'coming_soon', availability_reason: 'pending_dpia_approval', missing_credentials: [] }
  }
  if (entry.gatedBy && !isTrue(env[entry.gatedBy])) {
    return { availability: 'coming_soon', availability_reason: entry.comingSoonReason || 'feature_disabled', missing_credentials: [] }
  }
  if (entry.anyCredentials && !hasAny(env, entry.anyCredentials)) {
    return { availability: 'coming_soon', availability_reason: 'awaiting_provider_credentials', missing_credentials: entry.anyCredentials }
  }
  if (!entry.nodeLocal && !String(env.AI_ROUTER_URL || '').trim()) {
    return { availability: 'coming_soon', availability_reason: 'ai_router_not_configured', missing_credentials: [] }
  }
  return { availability: 'available', availability_reason: null, missing_credentials: [] }
}

export function listTrustSources(env = process.env) {
  return TRUST_SOURCE_REGISTRY.map(entry => ({ ...entry, ...resolveSourceAvailability(entry, env) }))
}
