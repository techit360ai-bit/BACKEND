import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/database.js', () => ({ readAuthorityDb: vi.fn(), updateAuthorityDb: vi.fn(), writeAuthorityDb: vi.fn() }))
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { applyTrustOverride, listTrustOverrides, revokeTrustOverride } from '../services/trustOverrideService.js'
import { applyScoreOverrides, validateOverrideInput } from '../services/trustScoreOverrides.js'

const future = () => new Date(Date.now() + 3600_000).toISOString()
const pastIso = () => new Date(Date.now() - 3600_000).toISOString()

let db
beforeEach(() => {
  db = {
    users: [{ id: 'u1' }], profiles: [{ id: 'u1' }], projects: [],
    trustVerificationProofs: [{ id: 'p1', userId: 'u1', projectId: null, source: 'github', status: 'verified', confidence: 0.98, points: 15, metadata: {}, evidenceHash: 'h', attestationLevel: 'provider_observed', expiresAt: future(), verifiedAt: pastIso(), createdAt: pastIso(), updatedAt: pastIso() }],
    trustVerificationHistory: [], verifiedSkills: [], trustProfiles: [], trustScoreSnapshots: [], trustProjectionOutbox: [], trustScoreOverrides: [], manualReviews: [], notifications: [],
  }
  readAuthorityDb.mockReturnValue(db)
  updateAuthorityDb.mockImplementation(mutator => mutator(db))
})

describe('override validation (WS9)', () => {
  it('requires an allowlisted reason code', () => {
    expect(validateOverrideInput({ delta: 5, expiresAt: future() }).error).toBe('override_reason_code_required')
    expect(validateOverrideInput({ reasonCode: 'not_real', delta: 5, expiresAt: future() }).error).toBe('override_reason_code_not_allowed')
  })

  it('bounds the delta and requires a future expiry', () => {
    expect(validateOverrideInput({ reasonCode: 'goodwill_credit', delta: 0, expiresAt: future() }).error).toBe('override_delta_invalid')
    expect(validateOverrideInput({ reasonCode: 'goodwill_credit', delta: 999, expiresAt: future() }).error).toBe('override_delta_out_of_range')
    expect(validateOverrideInput({ reasonCode: 'goodwill_credit', delta: 5 }).error).toBe('override_expiry_required')
    expect(validateOverrideInput({ reasonCode: 'goodwill_credit', delta: 5, expiresAt: pastIso() }).error).toBe('override_expiry_in_past')
    expect(validateOverrideInput({ reasonCode: 'goodwill_credit', delta: 5, expiresAt: future() }).ok).toBe(true)
  })
})

describe('applyScoreOverrides (WS9)', () => {
  const base = { trustScore: 40, tier: 'Building', verificationStatus: 'verified', breakdown: { github: 15 }, signals: ['github_verified'] }

  it('adds the delta, recomputes tier, and surfaces it in the breakdown', () => {
    const result = applyScoreOverrides(base, [{ id: 'o1', userId: 'u1', projectId: null, delta: 25, reasonCode: 'goodwill_credit', expiresAt: future() }], { userId: 'u1' })
    expect(result.trustScore).toBe(65)
    expect(result.tier).toBe('Verified')
    expect(result.breakdown.manual_override).toBe(25)
    expect(result.signals).toContain('manual_override')
    expect(result.overrides).toHaveLength(1)
  })

  it('clamps at 0..100 and ignores revoked/expired/mismatched overrides', () => {
    const capped = applyScoreOverrides(base, [{ id: 'o1', userId: 'u1', delta: 999, reasonCode: 'x', expiresAt: future() }], { userId: 'u1' })
    expect(capped.trustScore).toBe(100)
    const ignored = applyScoreOverrides(base, [
      { id: 'o1', userId: 'u1', delta: 10, expiresAt: pastIso() },
      { id: 'o2', userId: 'u1', delta: 10, expiresAt: future(), revokedAt: pastIso() },
      { id: 'o3', userId: 'u1', delta: 10, expiresAt: future(), projectId: 'other' },
    ], { userId: 'u1', projectId: null })
    expect(ignored.trustScore).toBe(40)
  })
})

describe('applyTrustOverride (WS9 legacy path)', () => {
  const env = { TRUST_OVERRIDE_REASON_CODES: 'goodwill_credit,provider_outage' }

  it('persists the override, audits it, and recomputes the profile', async () => {
    const result = await applyTrustOverride('admin1', 'u1', { delta: 10, reasonCode: 'goodwill_credit', expiresAt: future() }, { env })
    expect(result.ok).toBe(true)
    expect(db.trustScoreOverrides).toHaveLength(1)
    expect(db.manualReviews.some(row => row.operationKind === 'trust_score_override' && row.decision === 'applied')).toBe(true)
    expect(result.score.breakdown.manual_override).toBe(10)
    expect((await listTrustOverrides('u1')).overrides).toHaveLength(1)
  })

  it('rejects an unknown reason code without writing anything', async () => {
    const result = await applyTrustOverride('admin1', 'u1', { delta: 10, reasonCode: 'nope', expiresAt: future() }, { env })
    expect(result.ok).toBe(false)
    expect(db.trustScoreOverrides).toHaveLength(0)
  })

  it('revokes an override and removes it from the score', async () => {
    const applied = await applyTrustOverride('admin1', 'u1', { delta: 10, reasonCode: 'goodwill_credit', expiresAt: future() }, { env })
    const revoked = await revokeTrustOverride('admin1', 'u1', applied.override.id)
    expect(revoked.ok).toBe(true)
    expect(revoked.override.revokedAt).toBeTruthy()
    expect(revoked.score.breakdown.manual_override).toBeUndefined()
    expect(db.manualReviews.some(row => row.decision === 'revoked')).toBe(true)
  })
})
