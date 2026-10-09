import { describe, expect, it } from 'vitest'
import {
  findShippingProvider,
  listShippingProviders,
  platformShippingCredential,
  platformShippingSubject,
  resolveShippingConfig,
  resolveShippingProvider,
  resolveShippingProviderAvailability,
} from '../config/trustShippingSources.js'

const enabled = { TRUST_SHIPPING_ENABLED: 'true' }

describe('shipping source config', () => {
  it('defaults to disabled, github_actions-only, and conservative windows', () => {
    const config = resolveShippingConfig({})
    expect(config.enabled).toBe(false)
    expect(config.allowedProviders).toEqual(['github_actions'])
    expect(config.windowDays).toBe(30)
    expect(config.timeoutMs).toBe(15000)
    expect(config.maxFreshnessHours).toBe(72)
    expect(config.syncIntervalMs).toBe(24 * 3600_000)
    expect(config.proofTtlDays).toBe(7)
    expect(config.dpiaApproved).toBe(true)
  })

  it('parses env overrides and clamps minimums', () => {
    const config = resolveShippingConfig({
      TRUST_SHIPPING_PROVIDERS: 'github_actions, vercel ,render',
      TRUST_SHIPPING_WINDOW_DAYS: '14',
      TRUST_SHIPPING_TIMEOUT_MS: '500',
      TRUST_SHIPPING_SYNC_INTERVAL_MS: '1000',
      TRUST_SHIPPING_REQUIRE_DPIA: 'true',
    })
    expect(config.allowedProviders).toEqual(['github_actions', 'vercel', 'render'])
    expect(config.windowDays).toBe(14)
    expect(config.timeoutMs).toBe(2000)
    expect(config.syncIntervalMs).toBe(3600_000)
    expect(config.dpiaApproved).toBe(false)
  })

  it('marks providers coming soon with a machine reason', () => {
    expect(resolveShippingProvider('github_actions', {}).availability_reason).toBe('feature_disabled')
    expect(resolveShippingProvider('vercel', enabled).availability_reason).toBe('provider_not_allowed')
    expect(resolveShippingProvider('github_actions', { ...enabled, TRUST_SHIPPING_GITHUB_ACTIONS_ENABLED: 'false' }).availability_reason).toBe('provider_disabled')
    expect(resolveShippingProvider('github_actions', { ...enabled, TRUST_SHIPPING_REQUIRE_DPIA: 'true' }).availability_reason).toBe('pending_dpia_approval')
    expect(resolveShippingProvider('unknown', enabled).availability_reason).toBe('unsupported_provider')
  })

  it('resolves platform credential and subject env names', () => {
    const env = { GITHUB_ACTIONS_TOKEN: 'ghp_x', GITHUB_ACTIONS_REPO: 'acme/app', VERCEL_TOKEN: 'v', CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_PAGES_PROJECT: 'site' }
    expect(platformShippingCredential('github_actions', env)).toBe('ghp_x')
    expect(platformShippingSubject('github_actions', env)).toBe('acme/app')
    expect(platformShippingCredential('vercel', env)).toBe('v')
    expect(platformShippingCredential('unknown', env)).toBeNull()
  })

  it('lists all providers and their availability map', () => {
    expect(listShippingProviders().map(p => p.provider)).toEqual(['github_actions', 'vercel', 'render', 'railway', 'cloudflare', 'netlify'])
    const map = resolveShippingProviderAvailability(enabled)
    expect(map.github_actions.availability).toBe('available')
    expect(findShippingProvider('VERCEL')?.provider).toBe('vercel')
    expect(findShippingProvider('nope')).toBeNull()
  })
})
