import { describe, expect, it } from 'vitest'
import {
  findAnalyticsProvider,
  listAnalyticsProviders,
  platformAnalyticsCredential,
  platformAnalyticsSubject,
  resolveAnalyticsConfig,
  resolveAnalyticsProvider,
  resolveAnalyticsProviderAvailability,
} from '../config/trustAnalyticsSources.js'

const enabled = { TRUST_ANALYTICS_ENABLED: 'true' }

describe('analytics source config', () => {
  it('defaults to disabled, posthog-only, and conservative windows', () => {
    const config = resolveAnalyticsConfig({})
    expect(config.enabled).toBe(false)
    expect(config.allowedProviders).toEqual(['posthog'])
    expect(config.windowDays).toBe(30)
    expect(config.timeoutMs).toBe(15000)
    expect(config.maxFreshnessHours).toBe(72)
    expect(config.syncIntervalMs).toBe(24 * 3600_000)
    expect(config.dpiaApproved).toBe(true)
  })

  it('parses env overrides and clamps minimums', () => {
    const config = resolveAnalyticsConfig({
      TRUST_ANALYTICS_PROVIDERS: 'posthog, ga4 ,mixpanel',
      TRUST_ANALYTICS_WINDOW_DAYS: '7',
      TRUST_ANALYTICS_TIMEOUT_MS: '500',
      TRUST_ANALYTICS_SYNC_INTERVAL_MS: '1000',
      TRUST_ANALYTICS_REQUIRE_DPIA: 'true',
    })
    expect(config.allowedProviders).toEqual(['posthog', 'ga4', 'mixpanel'])
    expect(config.windowDays).toBe(7)
    expect(config.timeoutMs).toBe(2000)
    expect(config.syncIntervalMs).toBe(3600_000)
    expect(config.dpiaApproved).toBe(false)
  })

  it('reports DPIA approval only when a reference is present', () => {
    const env = { ...enabled, TRUST_ANALYTICS_REQUIRE_DPIA: 'true', TRUST_ANALYTICS_DPIA_APPROVAL_REF: 'DPIA-2026-01' }
    expect(resolveAnalyticsConfig(env).dpiaApproved).toBe(true)
    expect(resolveAnalyticsProvider('posthog', env).availability).toBe('available')
  })

  it('marks providers coming soon with a machine reason', () => {
    expect(resolveAnalyticsProvider('posthog', {}).availability_reason).toBe('feature_disabled')
    expect(resolveAnalyticsProvider('ga4', enabled).availability_reason).toBe('provider_not_allowed')
    expect(resolveAnalyticsProvider('posthog', { ...enabled, TRUST_ANALYTICS_POSTHOG_ENABLED: 'false' }).availability_reason).toBe('provider_disabled')
    expect(resolveAnalyticsProvider('supabase', { ...enabled, TRUST_ANALYTICS_PROVIDERS: 'supabase' }).availability_reason).toBe('producer_not_wired')
    expect(resolveAnalyticsProvider('unknown', enabled).availability_reason).toBe('unsupported_provider')
  })

  it('resolves platform credential and subject env names', () => {
    const env = { POSTHOG_API_KEY: 'ph_key', POSTHOG_PROJECT_ID: '12345', GA4_ACCESS_TOKEN: 'tok' }
    expect(platformAnalyticsCredential('posthog', env)).toBe('ph_key')
    expect(platformAnalyticsSubject('posthog', env)).toBe('12345')
    expect(platformAnalyticsCredential('ga4', env)).toBe('tok')
    expect(platformAnalyticsCredential('unknown', env)).toBeNull()
  })

  it('lists all providers and their availability map', () => {
    expect(listAnalyticsProviders().map(p => p.provider)).toEqual(['posthog', 'ga4', 'firebase', 'mixpanel', 'amplitude', 'supabase'])
    const map = resolveAnalyticsProviderAvailability(enabled)
    expect(Object.keys(map)).toContain('posthog')
    expect(map.posthog.availability).toBe('available')
    expect(findAnalyticsProvider('POSTHOG')?.provider).toBe('posthog')
    expect(findAnalyticsProvider('nope')).toBeNull()
  })
})
