import { describe, expect, it } from 'vitest'
import {
  findKycProvider,
  listKycProviders,
  listScreeningProviders,
  resolveIdentityAvailability,
  resolveIdentityCatalog,
  resolveIdentityConfig,
  resolveKycProvider,
  resolveScreeningProvider,
} from '../config/trustIdentitySources.js'
import { kycProviderAllowlist } from '../services/trustComplianceGate.js'

const kycEnv = () => ({ TRUST_KYC_ENABLED: 'true', TRUST_KYC_PROVIDER: 'persona', TRUST_DPIA_APPROVAL_REF: 'DPIA-2026-01', TRUST_KYC_REGIONS: 'HU,DE' })

describe('identity source catalog', () => {
  it('ships the allowlisted KYC providers and OFAC screening', () => {
    for (const provider of kycProviderAllowlist()) expect(findKycProvider(provider)).toBeTruthy()
    expect(listKycProviders().map(entry => entry.provider)).toEqual(expect.arrayContaining(['stripe_identity', 'persona', 'onfido', 'veriff']))
    expect(listScreeningProviders().map(entry => entry.provider)).toEqual(expect.arrayContaining(['ofac', 'sanctions_io']))
    // Every adapter call is host-allow-listed.
    for (const entry of [...listKycProviders(), ...listScreeningProviders()]) expect(entry.hosts.length).toBeGreaterThan(0)
  })

  it('fails closed until the compliance gate is fully configured', () => {
    expect(resolveIdentityAvailability({})).toMatchObject({ availability: 'coming_soon', availability_reason: 'feature_disabled' })
    expect(resolveIdentityAvailability({ TRUST_KYC_ENABLED: 'true' }).availability_reason).toBe('pending_dpia_approval')
    expect(resolveIdentityAvailability({ TRUST_KYC_ENABLED: 'true', TRUST_KYC_PROVIDER: 'persona', TRUST_DPIA_APPROVAL_REF: 'DPIA-1' }).availability_reason).toBe('regions_not_declared')
    expect(resolveIdentityAvailability(kycEnv())).toMatchObject({ availability: 'available', availability_reason: null, raw_documents_stored: false })
  })

  it('only enables the single active KYC provider', () => {
    expect(resolveKycProvider('persona', kycEnv())).toMatchObject({ enabled: true, availability: 'available' })
    expect(resolveKycProvider('onfido', kycEnv())).toMatchObject({ enabled: false, availability_reason: 'provider_not_active' })
    expect(resolveKycProvider('unknown', kycEnv()).availability_reason).toBe('unsupported_kyc_provider')
    expect(resolveKycProvider('persona', kycEnv()).platform_credential_configured).toBe(false)
    expect(resolveKycProvider('persona', { ...kycEnv(), PERSONA_API_KEY: 'p' }).platform_credential_configured).toBe(true)
  })

  it('gates screening providers by allow-list and credentials', () => {
    expect(resolveScreeningProvider('ofac', kycEnv())).toMatchObject({ enabled: true, availability: 'available' })
    const both = { ...kycEnv(), TRUST_IDENTITY_SCREENING_PROVIDERS: 'ofac,sanctions_io' }
    expect(resolveScreeningProvider('sanctions_io', both)).toMatchObject({ enabled: false, availability_reason: 'awaiting_provider_credentials' })
    expect(resolveScreeningProvider('sanctions_io', { ...both, SANCTIONS_IO_API_KEY: 'k' })).toMatchObject({ enabled: true, availability: 'available' })
    expect(resolveScreeningProvider('ofac', { ...both, TRUST_IDENTITY_SCREENING_ENABLED: 'false' }).availability_reason).toBe('screening_disabled')
  })

  it('exposes safe defaults and a full catalog', () => {
    const config = resolveIdentityConfig(kycEnv())
    expect(config.proofTtlDays).toBe(365)
    expect(config.rescreenDays).toBe(30)
    expect(config.retentionDays).toBe(365)
    expect(config.screeningProviders).toEqual(['ofac'])
    const catalog = resolveIdentityCatalog(kycEnv())
    expect(catalog.identity.enabled).toBe(true)
    expect(catalog.kyc.persona.enabled).toBe(true)
    expect(catalog.screening.ofac.enabled).toBe(true)
  })
})
