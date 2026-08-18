import { describe, expect, it } from 'vitest'
import {
  computeBss,
  computeDecayFactor,
  computeEvi,
  computeGsis,
  computeInvestmentScore,
  computeMatchScore,
  computePps,
  computeUnicornPotentialScore,
} from '../services/intelligence/scoreKernels.js'

describe('deterministic intelligence score kernels', () => {
  it('computes GSIS without external services', () => {
    const result = computeGsis({
      product_progress: 80, execution_velocity: 70, market_readiness: 60,
      beta_satisfaction: 50, revenue_growth: 40, founder_reputation: 90,
      community_influence: 50, investor_interest: 30, compliance: 100,
    })
    expect(result.gsis).toBe(63)
    expect(result.aiAvailable).toBeUndefined()
    expect(result.policyId).toBe('techit-scoring-2026-08-14-v1')
  })

  it('keeps score kernels bounded and evidence-neutral', () => {
    expect(computeDecayFactor(30)).toBe(0.5488)
    expect(computePps({ completedTasks: 5, totalTasks: 10, qualityFactor: 0.8 })).toBe(40)
    expect(computeBss({ avgUxRating: 10, avgPerformanceRating: 10, nps: 100, willingnessToPayPct: 100 })).toBe(100)
    expect(computeInvestmentScore({ market_readiness: 100, traction: 100, team: 100, risk_inverse: 100, growth: 100, differentiation: 100 })).toBe(100)
    expect(computeMatchScore({ skill: 1, goal: 1, execution_style: 1, availability: 1, trust: 1, domain: 1 })).toBe(100)
  })

  it('returns a provisional heuristic UPS rather than a probability', () => {
    const result = computeUnicornPotentialScore({ market_size: 10, problem_severity: 10, founder_advantage: 10, technological_moat: 10, scalability: 10, network_effects: 10, revenue_model_strength: 10, market_timing: 10, competition_landscape: 10, capital_efficiency: 10 })
    expect(result.unicornPotentialScore).toBe(100)
    expect(result.probabilityCalibrated).toBe(false)
    expect(result.humanReviewRequired).toBe(true)
  })

  it('does not require an AI or provider key', () => {
    expect(() => computeEvi({ milestonesCompleted30d: 4, avgResponseTimeHours: 4, iterationsPerMonth: 10, codeDesignContributions: 25, stagnationDays: 0 })).not.toThrow()
  })
})
