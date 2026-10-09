import { describe, expect, it } from 'vitest'
import { listRevenueProviders, platformCredentialFor, resolveRevenueConfig, resolveRevenueProvider } from '../config/trustRevenueSources.js'

describe('revenue provider configuration', () => {
  it('reuses the payment gateway env credential names', () => {
    expect(platformCredentialFor('stripe', { STRIPE_SECRET_KEY: 'sk_live_x' })).toBe('sk_live_x')
    expect(platformCredentialFor('paystack', { PAYSTACK_SECRET_KEY: 'sk_live_y' })).toBe('sk_live_y')
    expect(platformCredentialFor('flutterwave', { FLUTTERWAVE_SECRET_KEY: 'FLWSECK-abc' })).toBe('FLWSECK-abc')
    expect(platformCredentialFor('razorpay', { RAZORPAY_KEY_ID: 'rzp_live_1', RAZORPAY_KEY_SECRET: 's' })).toBe('rzp_live_1:s')
    expect(platformCredentialFor('razorpay', { RAZORPAY_KEY_ID: 'rzp_live_1' })).toBeNull()
    expect(platformCredentialFor('square', {})).toBeNull()
  })

  it('defaults to stripe-only and is disabled until the master flag is on', () => {
    const config = resolveRevenueConfig({})
    expect(config.enabled).toBe(false)
    expect(config.allowedProviders).toEqual(['stripe'])
    expect(resolveRevenueProvider('stripe', {}).availability).toBe('coming_soon')
    expect(resolveRevenueProvider('stripe', {}).availability_reason).toBe('feature_disabled')
  })

  it('unlocks a provider when enabled and DPIA is satisfied', () => {
    const env = { TRUST_REVENUE_ENABLED: 'true', TRUST_REVENUE_PROVIDERS: 'stripe,paystack,flutterwave' }
    for (const provider of ['stripe', 'paystack', 'flutterwave']) {
      expect(resolveRevenueProvider(provider, env).availability).toBe('available')
    }
    expect(listRevenueProviders().map(provider => provider.provider)).toEqual(['stripe', 'paystack', 'flutterwave', 'paddle', 'razorpay'])
  })

  it('honours the DPIA gate and per-provider disable switch', () => {
    const dpia = resolveRevenueProvider('stripe', { TRUST_REVENUE_ENABLED: 'true', TRUST_REVENUE_REQUIRE_DPIA: 'true' })
    expect(dpia.availability_reason).toBe('pending_dpia_approval')
    const approved = resolveRevenueProvider('stripe', { TRUST_REVENUE_ENABLED: 'true', TRUST_REVENUE_REQUIRE_DPIA: 'true', TRUST_REVENUE_DPIA_APPROVAL_REF: 'DPIA-1' })
    expect(approved.availability).toBe('available')
    const off = resolveRevenueProvider('paystack', { TRUST_REVENUE_ENABLED: 'true', TRUST_REVENUE_PAYSTACK_ENABLED: 'false' })
    expect(off.availability_reason).toBe('provider_disabled')
  })

  it('reads anti-fraud thresholds from env with safe defaults', () => {
    const config = resolveRevenueConfig({ TRUST_REVENUE_MIN_MRR: '250', TRUST_REVENUE_MAX_MRR_JUMP_PCT: '120' })
    expect(config.minMrr).toBe(250)
    expect(config.maxMrrJumpPct).toBe(120)
    expect(config.requireLivemode).toBe(true)
    expect(resolveRevenueConfig({ TRUST_REVENUE_REQUIRE_LIVEMODE: 'false' }).requireLivemode).toBe(false)
  })
})
