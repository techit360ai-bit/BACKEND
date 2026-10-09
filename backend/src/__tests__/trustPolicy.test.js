import { describe, expect, it } from 'vitest'
import { computeTrustV3, loadTrustPolicyFromEnv, resolveActivePolicy, resolveTrustPolicy, TRUST_V3_DRAFT } from '../services/trustPolicy.js'

const proof = (over = {}) => ({
  id: over.id || 'p1',
  status: 'verified',
  source: 'github',
  confidence: 1,
  verifiedAt: new Date().toISOString(),
  expiresAt: null,
  attestationLevel: 'provider_observed',
  ...over,
})

describe('trust policy v3 gate', () => {
  it('defaults to v2', () => {
    expect(resolveTrustPolicy({}).active).toBe('trust-v2')
  })

  it('refuses to activate v3 without explicit sign-off', () => {
    const resolved = resolveTrustPolicy({ TRUST_POLICY_VERSION: 'trust-v3' })
    expect(resolved.active).toBe('trust-v2')
    expect(resolved.gated).toBe(true)
    expect(resolved.reason).toBe('trust_v3_requires_signoff')
  })

  it('activates v3 only when signed off', () => {
    const resolved = resolveTrustPolicy({ TRUST_POLICY_VERSION: 'trust-v3', TRUST_POLICY_V3_SIGNED_OFF: 'true' })
    expect(resolved.active).toBe('trust-v3')
    expect(resolved.gated).toBe(false)
  })
})

describe('trust policy v3 scoring', () => {
  it('caps a source at its policy cap', () => {
    const score = computeTrustV3({ proofs: [proof({ source: 'github', confidence: 1 })], skills: [] })
    expect(score.breakdown.github).toBe(TRUST_V3_DRAFT.sourceCaps.github)
    expect(score.trustScore).toBe(TRUST_V3_DRAFT.sourceCaps.github)
  })

  it('down-weights self-attested proofs', () => {
    const attested = computeTrustV3({ proofs: [proof({ attestationLevel: 'provider_observed' })], skills: [] })
    const self = computeTrustV3({ proofs: [proof({ attestationLevel: 'self' })], skills: [] })
    expect(self.trustScore).toBeLessThan(attested.trustScore)
    expect(self.trustScore).toBeCloseTo(TRUST_V3_DRAFT.sourceCaps.github * 0.35, 1)
  })

  it('decays with age using the source half-life', () => {
    const halfLifeAgo = new Date(Date.now() - TRUST_V3_DRAFT.halfLifeDays.github * 86400000).toISOString()
    const decayed = computeTrustV3({ proofs: [proof({ verifiedAt: halfLifeAgo })], skills: [] })
    expect(decayed.breakdown.github).toBeCloseTo(TRUST_V3_DRAFT.sourceCaps.github / 2, 1)
  })

  it('never double-counts correlated sources', () => {
    const score = computeTrustV3({
      proofs: [proof({ id: 'a', source: 'domain' }), proof({ id: 'b', source: 'website' })],
      skills: [],
    })
    const counted = Object.keys(score.breakdown).filter(key => key !== 'verified_skills')
    expect(counted).toHaveLength(1)
  })

  it('ignores expired and non-verified proofs', () => {
    const score = computeTrustV3({
      proofs: [proof({ expiresAt: new Date(Date.now() - 1000).toISOString() }), proof({ id: 'p2', status: 'pending' })],
      skills: [],
    })
    expect(score.trustScore).toBe(0)
  })
})

describe('trust policy env overrides', () => {
  it('applies valid overrides to caps and half-lives', () => {
    const { policy, warnings } = loadTrustPolicyFromEnv({ TRUST_CAP_GITHUB: '3', TRUST_HALFLIFE_REVENUE: '10' })
    expect(policy.sourceCaps.github).toBe(3)
    expect(policy.halfLifeDays.revenue).toBe(10)
    expect(warnings).toEqual([])
  })

  it('ignores invalid overrides and reports a warning instead of weakening scoring', () => {
    const { policy, warnings } = loadTrustPolicyFromEnv({ TRUST_CAP_GITHUB: 'not-a-number' })
    expect(policy.sourceCaps.github).toBe(TRUST_V3_DRAFT.sourceCaps.github)
    expect(warnings).toContain('TRUST_CAP_GITHUB_invalid')
  })

  it('falls back to default tiers when overrides are non-monotonic', () => {
    const { policy, warnings } = loadTrustPolicyFromEnv({ TRUST_TIER_HIGHLY_TRUSTED: '10', TRUST_TIER_VERIFIED: '60', TRUST_TIER_BUILDING: '30' })
    expect(policy.tierThresholds.highly_trusted).toBe(TRUST_V3_DRAFT.tierThresholds.highly_trusted)
    expect(warnings).toContain('trust_tier_thresholds_invalid')
  })

  it('resolveActivePolicy stays gated without sign-off', () => {
    const resolved = resolveActivePolicy({ TRUST_POLICY_VERSION: 'trust-v3' })
    expect(resolved.active).toBe('trust-v2')
    expect(resolved.warnings).toEqual([])
  })
})
