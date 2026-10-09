import { describe, expect, it } from 'vitest'
import { evaluateAntiGaming, loadAntiGamingConfig } from '../services/trustAntiGaming.js'

const proof = (over = {}) => ({ userId: 'u1', source: 'github', status: 'verified', evidenceHash: 'h1', providerSubjectId: null, metadata: {}, createdAt: new Date().toISOString(), ...over })
const scope = (proofs = []) => ({ trustVerificationProofs: proofs })

describe('anti-gaming config', () => {
  it('defaults safely and reports invalid overrides', () => {
    const { config, warnings } = loadAntiGamingConfig({ TRUST_VELOCITY_MAX_PROOFS_PER_HOUR: 'abc' })
    expect(config.maxProofsPerHour).toBe(12)
    expect(warnings).toContain('TRUST_VELOCITY_MAX_PROOFS_PER_HOUR_invalid')
  })

  it('honors valid env overrides', () => {
    const { config } = loadAntiGamingConfig({ TRUST_VELOCITY_MAX_PROOFS_PER_HOUR: '3', TRUST_CONSISTENCY_STRICT: 'true' })
    expect(config.maxProofsPerHour).toBe(3)
    expect(config.strictConsistency).toBe(true)
  })
})

describe('anti-gaming detection', () => {
  it('is clean with no signals', async () => {
    const decision = await evaluateAntiGaming({ scope: scope([]), proof: proof() })
    expect(decision.allow).toBe(true)
    expect(decision.reasons).toEqual([])
  })

  it('blocks evidence reused across accounts', async () => {
    const decision = await evaluateAntiGaming({ scope: scope([]), proof: proof(), lookups: { byEvidenceHash: async () => [{ userId: 'u2', evidenceHash: 'h1' }] } })
    expect(decision.allow).toBe(false)
    expect(decision.severity).toBe('critical')
    expect(decision.reasons).toContain('evidence_reused_across_accounts')
  })

  it('blocks provider subject reuse across accounts', async () => {
    const decision = await evaluateAntiGaming({
      scope: scope([]),
      proof: proof({ source: 'github', providerSubjectId: 'gh-9' }),
      lookups: { byProviderSubject: async () => [{ userId: 'u2' }] },
    })
    expect(decision.allow).toBe(false)
    expect(decision.reasons).toContain('provider_subject_reused_across_accounts')
  })

  it('flags proof velocity', async () => {
    const now = Date.now()
    const many = Array.from({ length: 12 }, () => ({ userId: 'u1', createdAt: new Date(now - 1000).toISOString(), status: 'verified' }))
    const decision = await evaluateAntiGaming({ scope: scope(many), proof: proof(), now })
    expect(decision.reasons).toContain('velocity_proofs_per_hour')
    expect(decision.allow).toBe(true)
  })

  it('flags a cross-source domain mismatch without blocking by default', async () => {
    const existing = [{ userId: 'u1', source: 'domain', status: 'verified', expiresAt: null, metadata: { domain: 'acme.com' } }]
    const decision = await evaluateAntiGaming({ scope: scope(existing), proof: proof({ source: 'email', metadata: { domain: 'evil.example' } }) })
    expect(decision.reasons).toContain('cross_source_domain_mismatch')
    expect(decision.allow).toBe(true)
  })
})
