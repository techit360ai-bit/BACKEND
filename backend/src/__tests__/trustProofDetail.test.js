import { describe, expect, it } from 'vitest'
import { latestProofBySource, proofDetail } from '../controllers/trustSurfaceController.js'

const base = {
  source: 'revenue', status: 'verified', confidence: 0.94,
  attestationLevel: 'provider_observed', verifiedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2099-01-01T00:00:00.000Z', metadata: { mrr: 12000, currency: 'usd' },
}

describe('WS10 proof detail enrichment', () => {
  it('keeps only the first (most recent) proof per source', () => {
    const older = { ...base, confidence: 0.5 }
    const newer = { ...base, confidence: 0.9 }
    const map = latestProofBySource([newer, older])
    expect(map.get('revenue')).toBe(newer)
    expect(map.size).toBe(1)
  })

  it('exposes consented metrics only for provider-observed proofs', () => {
    const observed = proofDetail(base)
    expect(observed.attestation_level).toBe('provider_observed')
    expect(observed.metrics).toEqual({ mrr: 12000, currency: 'usd' })
    expect(observed.confidence).toBe(0.94)
    expect(observed.expires_at).toBe(base.expiresAt)

    const selfReported = proofDetail({ ...base, attestationLevel: 'self' })
    expect(selfReported.metrics).toBeNull()
  })

  it('flips a lapsed proof to expired and flags manual review', () => {
    const lapsed = proofDetail({ ...base, expiresAt: '2000-01-01T00:00:00.000Z' })
    expect(lapsed.status).toBe('expired')

    const reviewed = proofDetail({ ...base, reviewNote: 'goodwill credit' })
    expect(reviewed.manual_review).toBe(true)
  })

  it('returns a safe empty detail when there is no proof', () => {
    const empty = proofDetail(null)
    expect(empty.status).toBeNull()
    expect(empty.attestation_level).toBe('self')
    expect(empty.metrics).toBeNull()
    expect(empty.manual_review).toBe(false)
  })
})
