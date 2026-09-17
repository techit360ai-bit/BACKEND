import { describe, expect, it } from 'vitest'
import { calculateGsis, calculateMatch } from '../services/intelligence/deterministicServices.js'
import { embeddingRefreshDecision } from '../services/intelligence/embeddingPolicy.js'
import { buildTrainingPlan, evaluateAdminAnomaly, evaluateTrust } from '../services/intelligence/operationalServices.js'
import { migrationTelemetrySnapshot, recordParitySample } from '../services/intelligence/migrationTelemetry.js'

describe('backend-owned deterministic intelligence', () => {
  it('uses a stable envelope and reports missing evidence', () => {
    const result = calculateGsis({ product_progress: 80 })
    expect(result.schema_version).toBe('intelligence-v1')
    expect(result.status).toBe('insufficient_evidence')
    expect(result.ai_available).toBe(false)
  })

  it('calculates matches without provider access', () => {
    expect(calculateMatch({ skill: 1, goal: 1, execution_style: 1, availability: 1, trust: 1, domain: 1 }).score).toBe(100)
  })

  it('keeps trust and anomaly decisions rule based and reviewable', () => {
    expect(evaluateTrust({ blocked: true }).status).toBe('blocked')
    expect(evaluateAdminAnomaly({ abuseScore: 90 }).result.requiresHumanReview).toBe(true)
  })

  it('builds training gaps and background embedding decisions', () => {
    expect(buildTrainingPlan({ skills: ['JavaScript'], requiredSkills: ['JavaScript', 'SQL'] }).result.modules[0].skill).toBe('SQL')
    expect(embeddingRefreshDecision({ changed: true, eligible: true }).backgroundOnly).toBe(true)
  })

  it('records parity drift for staged rollout', () => {
    expect(recordParitySample({ kernel: 'gsis', legacyScore: 80, backendScore: 80 }).withinTolerance).toBe(true)
    expect(migrationTelemetrySnapshot().samples).toBeGreaterThan(0)
  })
})
