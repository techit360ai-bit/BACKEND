import { describe, expect, it } from 'vitest'
import { findTrustSourceByProvider, listTrustSources, resolveSourceAvailability, trustRolloutSnapshot } from '../config/trustSources.js'

describe('trust source availability', () => {
  it('marks the already-wired sources available without config', () => {
    const sources = listTrustSources({})
    for (const source of ['github', 'linkedin', 'domain', 'website']) {
      expect(sources.find(item => item.source === source).availability).toBe('available')
    }
  })

  it('defaults execution sources to coming_soon', () => {
    const sources = listTrustSources({})
    for (const source of ['revenue', 'product_analytics', 'deployment', 'team', 'milestone']) {
      expect(sources.find(item => item.source === source).availability).toBe('coming_soon')
    }
  })

  it('unlocks identity only when the compliance gate is fully configured', () => {
    const env = { TRUST_IDENTITY_ENABLED: 'true', TRUST_KYC_ENABLED: 'true', TRUST_KYC_PROVIDER: 'persona', TRUST_DPIA_APPROVAL_REF: 'DPIA-1', TRUST_KYC_REGIONS: 'HU,DE' }
    const identity = findTrustSourceByProvider('identity', env)
    expect(identity.availability).toBe('available')
    expect(identity.availability_reason).toBeNull()
    expect(findTrustSourceByProvider('identity', { ...env, TRUST_IDENTITY_ENABLED: 'false' }).availability).toBe('coming_soon')
  })

  it('reports pending_dpia_approval for identity until compliance is configured', () => {
    const identity = findTrustSourceByProvider('identity', { TRUST_IDENTITY_ENABLED: 'true' })
    expect(identity.availability).toBe('coming_soon')
    expect(identity.availability_reason).toBe('pending_dpia_approval')
  })

  it('unlocks a source only when flag + credentials + ai-router are all present', () => {
    const partial = listTrustSources({ TRUST_REVENUE_ENABLED: 'true', AI_ROUTER_URL: 'http://ai-router:8000' })
    expect(partial.find(item => item.source === 'revenue').availability_reason).toBe('awaiting_provider_credentials')

    const full = listTrustSources({ TRUST_REVENUE_ENABLED: 'true', AI_ROUTER_URL: 'http://ai-router:8000', STRIPE_RESTRICTED_KEY: 'rk_test_123' })
    const revenue = full.find(item => item.source === 'revenue')
    expect(revenue.availability).toBe('available')
    expect(revenue.availability_reason).toBeNull()
  })

  it('unlocks revenue from payment-section credentials without the ai-router', () => {
    for (const key of ['STRIPE_SECRET_KEY', 'PAYSTACK_SECRET_KEY', 'FLUTTERWAVE_SECRET_KEY']) {
      const revenue = listTrustSources({ TRUST_REVENUE_ENABLED: 'true', [key]: 'secret' }).find(item => item.source === 'revenue')
      expect(revenue.availability, key).toBe('available')
      expect(revenue.availability_reason).toBeNull()
    }
  })

  it('unlocks product analytics node-locally from an analytics credential', () => {
    const analytics = listTrustSources({ TRUST_PRODUCT_ANALYTICS_ENABLED: 'true', POSTHOG_API_KEY: 'ph_key' }).find(item => item.source === 'product_analytics')
    expect(analytics.availability).toBe('available')
    expect(analytics.availability_reason).toBeNull()
  })

  it('unlocks shipping node-locally from a CI/CD token', () => {
    const shipping = listTrustSources({ TRUST_SHIPPING_ENABLED: 'true', VERCEL_TOKEN: 'v' }).find(item => item.source === 'deployment')
    expect(shipping.availability).toBe('available')
    expect(shipping.availability_reason).toBeNull()
  })

  it('keeps shipping coming soon until a feature flag + token exist', () => {
    const gated = listTrustSources({ TRUST_SHIPPING_ENABLED: 'true' }).find(item => item.source === 'deployment')
    expect(gated.availability_reason).toBe('awaiting_provider_credentials')
    const dpia = listTrustSources({ TRUST_SHIPPING_ENABLED: 'true', TRUST_SHIPPING_REQUIRE_DPIA: 'true', VERCEL_TOKEN: 'v' }).find(item => item.source === 'deployment')
    expect(dpia.availability_reason).toBe('pending_dpia_approval')
  })

  it('unlocks team and organization node-locally from a registry credential', () => {
    const env = { TRUST_TEAM_ENABLED: 'true', OPENCORPORATES_API_KEY: 'oc' }
    const team = listTrustSources(env).find(item => item.source === 'team')
    const org = listTrustSources(env).find(item => item.source === 'organization')
    expect(team.availability).toBe('available')
    expect(team.availability_reason).toBeNull()
    expect(org.availability).toBe('available')
  })

  it('unlocks milestones node-locally from the feature flag', () => {
    const milestone = listTrustSources({ TRUST_MILESTONES_ENABLED: 'true' }).find(item => item.source === 'milestone')
    expect(milestone.availability).toBe('available')
    expect(milestone.availability_reason).toBeNull()
    const dpia = listTrustSources({ TRUST_MILESTONES_ENABLED: 'true', TRUST_MILESTONE_REQUIRE_DPIA: 'true' }).find(item => item.source === 'milestone')
    expect(dpia.availability_reason).toBe('pending_dpia_approval')
  })

  it('keeps team coming soon until a feature flag + credential exist', () => {
    expect(listTrustSources({ TRUST_TEAM_ENABLED: 'true' }).find(item => item.source === 'team').availability_reason).toBe('awaiting_provider_credentials')
    const dpia = listTrustSources({ TRUST_TEAM_ENABLED: 'true', TRUST_TEAM_REQUIRE_DPIA: 'true', OPENCORPORATES_API_KEY: 'oc' }).find(item => item.source === 'team')
    expect(dpia.availability_reason).toBe('pending_dpia_approval')
  })

  it('surfaces pending_dpia_approval for revenue and analytics until a DPIA ref exists', () => {
    const gated = listTrustSources({ TRUST_REVENUE_ENABLED: 'true', TRUST_REVENUE_REQUIRE_DPIA: 'true', STRIPE_SECRET_KEY: 'sk', TRUST_PRODUCT_ANALYTICS_ENABLED: 'true', TRUST_ANALYTICS_REQUIRE_DPIA: 'true', POSTHOG_API_KEY: 'ph' })
    expect(gated.find(item => item.source === 'revenue').availability_reason).toBe('pending_dpia_approval')
    expect(gated.find(item => item.source === 'product_analytics').availability_reason).toBe('pending_dpia_approval')

    const approved = listTrustSources({ TRUST_REVENUE_ENABLED: 'true', TRUST_REVENUE_REQUIRE_DPIA: 'true', TRUST_REVENUE_DPIA_APPROVAL_REF: 'DPIA-1', STRIPE_SECRET_KEY: 'sk', TRUST_PRODUCT_ANALYTICS_ENABLED: 'true', TRUST_ANALYTICS_REQUIRE_DPIA: 'true', TRUST_ANALYTICS_DPIA_APPROVAL_REF: 'DPIA-2', POSTHOG_API_KEY: 'ph' })
    expect(approved.find(item => item.source === 'revenue').availability).toBe('available')
    expect(approved.find(item => item.source === 'product_analytics').availability).toBe('available')
  })

  it('exposes a per-source rollout view with the blocking flag or credentials', () => {
    const snapshot = trustRolloutSnapshot(
      { TRUST_REVENUE_ENABLED: 'false', TRUST_TEAM_ENABLED: 'true' },
      { generatedAt: '2026-07-06T10:00:00.000Z' },
    )
    expect(snapshot.generatedAt).toBe('2026-07-06T10:00:00.000Z')
    expect(snapshot.available).toEqual(expect.arrayContaining(['github', 'linkedin', 'domain', 'website']))

    const revenue = snapshot.per_source.find(entry => entry.source === 'revenue')
    expect(revenue.availability).toBe('coming_soon')
    expect(revenue.gated_by).toBe('TRUST_REVENUE_ENABLED')
    expect(revenue.flag_enabled).toBe(false)

    const team = snapshot.per_source.find(entry => entry.source === 'team')
    expect(team.flag_enabled).toBe(true)
    expect(team.missing_credentials.length).toBeGreaterThan(0)
  })

  it('keeps sources coming_soon when the ai-router is not configured', () => {
    const resolved = resolveSourceAvailability(
      { gatedBy: 'TRUST_TEAM_ENABLED', anyCredentials: ['REGISTRY_API_KEY'] },
      { TRUST_TEAM_ENABLED: 'true', REGISTRY_API_KEY: 'k' },
    )
    expect(resolved.availability_reason).toBe('ai_router_not_configured')
  })
})
