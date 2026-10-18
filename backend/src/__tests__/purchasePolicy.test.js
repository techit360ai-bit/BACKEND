import { describe, expect, it } from 'vitest'
import { evaluatePurchasePolicy, highestRiskState, intentExpiry, purchasePolicyConfig, purchaseUsage, resolvePurchaseIdentity } from '../services/purchasePolicyService.js'

const now = new Date('2026-10-18T12:00:00.000Z')
const config = {
  monthlyMaxCredits: 1_000,
  monthlyMaxAmountUsd: 100,
  velocityMaxPerHour: 3,
  maxPendingIntents: 2,
  intentTtlMinutes: 30,
  kycThresholdCredits: 500,
  kycThresholdAmountUsd: 50,
  kycValidityDays: 365,
}

function intent(overrides = {}) {
  return {
    id: 'pay_1',
    status: 'successful',
    credits: 100,
    amount: 1_000,
    currency: 'USD',
    createdAt: '2026-10-10T10:00:00.000Z',
    expiresAt: '2026-10-10T10:30:00.000Z',
    ...overrides,
  }
}

describe('purchase policy', () => {
  it('counts only current-month non-expired purchase intents', () => {
    const usage = purchaseUsage([
      intent(),
      intent({ id: 'pay_old', createdAt: '2026-09-30T23:59:59.000Z' }),
      intent({ id: 'pay_expired', status: 'expired' }),
      intent({ id: 'pay_pending', status: 'pending', credits: 50, amount: 500, createdAt: '2026-10-18T11:30:00.000Z', expiresAt: '2026-10-18T12:10:00.000Z' }),
    ], now)
    expect(usage).toMatchObject({
      monthlyCredits: 150,
      monthlyAmountUsd: 15,
      hourlyPurchases: 1,
      pendingIntents: 1,
    })
  })

  it('rejects a purchase that exceeds the monthly credit ceiling', () => {
    const result = evaluatePurchasePolicy({
      credits: 950,
      amount: 1_000,
      intents: [intent()],
      now,
      config,
    })
    expect(result).toMatchObject({ ok: false, status: 409, error: 'monthly_credit_purchase_limit_exceeded' })
  })

  it('rejects a purchase that exceeds the monthly USD amount ceiling', () => {
    const result = evaluatePurchasePolicy({
      credits: 10,
      amount: 9_500,
      intents: [intent({ credits: 1, amount: 1_000 })],
      now,
      config,
    })
    expect(result).toMatchObject({ ok: false, status: 409, error: 'monthly_purchase_amount_limit_exceeded' })
  })

  it('rejects velocity and pending-intent abuse before contacting a provider', () => {
    const recent = ['a', 'b', 'c'].map((id, index) => intent({ id, status: 'failed', createdAt: `2026-10-18T11:${40 + index}:00.000Z` }))
    expect(evaluatePurchasePolicy({ credits: 10, amount: 100, intents: recent, now, config })).toMatchObject({
      ok: false,
      status: 429,
      error: 'purchase_velocity_exceeded',
    })
    const pending = [intent({ id: 'p1', status: 'pending', expiresAt: '2026-10-18T12:30:00.000Z' }), intent({ id: 'p2', status: 'pending', expiresAt: '2026-10-18T12:30:00.000Z' })]
    expect(evaluatePurchasePolicy({ credits: 10, amount: 100, intents: pending, now, config })).toMatchObject({
      ok: false,
      status: 409,
      error: 'too_many_pending_payment_intents',
    })
  })

  it('escalates high-risk and high-value purchases', () => {
    expect(evaluatePurchasePolicy({ credits: 10, amount: 100, riskState: 'HIGH', now, config })).toMatchObject({
      ok: false,
      status: 403,
      error: 'purchase_risk_review_required',
    })
    expect(evaluatePurchasePolicy({ credits: 500, amount: 100, now, config })).toMatchObject({
      ok: false,
      status: 403,
      error: 'kyc_required_for_high_value_purchase',
    })
    expect(evaluatePurchasePolicy({ credits: 500, amount: 100, kycVerified: true, now, config })).toMatchObject({
      ok: true,
      kycRequired: true,
    })
    expect(evaluatePurchasePolicy({ credits: 10, amount: 100, riskState: 'ELEVATED', now, config })).toMatchObject({
      ok: false,
      status: 403,
      error: 'kyc_required_for_elevated_risk',
      kycRequired: true,
    })
  })

  it('reads authoritative identity and screening signals without relying on projections', () => {
    const identity = resolvePurchaseIdentity({
      riskProfiles: [{ state: 'LOW' }],
      identityVerifications: [{ kind: 'kyc', status: 'verified', checkedAt: '2026-10-01T00:00:00.000Z' }],
      screeningResults: [{ status: 'potential_match', matchCount: 0, screenedAt: '2026-10-17T00:00:00.000Z' }],
      now,
      config,
    })
    expect(identity).toEqual({ riskState: 'REVIEW', kycVerified: true })
    expect(highestRiskState('LOW', 'HIGH', 'NORMAL')).toBe('HIGH')
    expect(resolvePurchaseIdentity({
      identityVerifications: [{ kind: 'kyc', status: 'verified', checkedAt: '2024-01-01T00:00:00.000Z' }],
      now,
      config,
    }).kycVerified).toBe(false)
  })

  it('reads configurable ceilings and creates bounded expiry timestamps', () => {
    expect(purchasePolicyConfig({ PAYMENT_INTENT_TTL_MINUTES: '15', PURCHASE_MONTHLY_MAX_CREDITS: '42' })).toMatchObject({
      intentTtlMinutes: 15,
      monthlyMaxCredits: 42,
      kycValidityDays: 365,
    })
    expect(intentExpiry('2026-10-18T12:00:00.000Z', 15)).toBe('2026-10-18T12:15:00.000Z')
  })
})
