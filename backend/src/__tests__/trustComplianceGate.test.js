import { describe, expect, it } from 'vitest'
import { assertFounderKycEnabled, isRegionAllowed, kycRetentionPolicy, resolveKycConfig } from '../services/trustComplianceGate.js'

describe('founder KYC compliance gate', () => {
  it('fails closed with no configuration', () => {
    const config = resolveKycConfig({})
    expect(config.enabled).toBe(false)
    expect(config.reasons).toContain('kyc_disabled')
    expect(() => assertFounderKycEnabled({})).toThrow(/founder_kyc_blocked/)
  })

  it('refuses non-allowlisted providers', () => {
    const config = resolveKycConfig({ TRUST_KYC_ENABLED: 'true', TRUST_KYC_PROVIDER: 'shady_kyc', TRUST_DPIA_APPROVAL_REF: 'DPIA-1', TRUST_KYC_REGIONS: 'HU' })
    expect(config.enabled).toBe(false)
    expect(config.reasons).toContain('provider_not_allowlisted')
  })

  it('requires a DPIA approval reference', () => {
    const config = resolveKycConfig({ TRUST_KYC_ENABLED: 'true', TRUST_KYC_PROVIDER: 'persona', TRUST_KYC_REGIONS: 'HU' })
    expect(config.reasons).toContain('dpia_approval_ref_missing')
  })

  it('enables only when fully configured', () => {
    const env = { TRUST_KYC_ENABLED: 'true', TRUST_KYC_PROVIDER: 'persona', TRUST_DPIA_APPROVAL_REF: 'DPIA-2026-01', TRUST_KYC_REGIONS: 'HU,DE' }
    const config = assertFounderKycEnabled(env)
    expect(config.enabled).toBe(true)
    expect(isRegionAllowed('hu', env)).toBe(true)
    expect(isRegionAllowed('us', env)).toBe(false)
  })

  it('stores metadata only', () => {
    const policy = kycRetentionPolicy({ TRUST_KYC_RETENTION_DAYS: '90' })
    expect(policy.rawDocumentsStored).toBe(false)
    expect(policy.retentionDays).toBe(90)
  })
})
