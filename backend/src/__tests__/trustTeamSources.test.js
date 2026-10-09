import { describe, expect, it } from 'vitest'
import {
  findHrisProvider,
  findRegistryProvider,
  listTeamProviders,
  platformHrisCredential,
  platformRegistryCredential,
  resolveTeamConfig,
  resolveHrisProvider,
  resolveRegistryProvider,
  resolveTeamProviderAvailability,
  resolveWorkEmailAvailability,
} from '../config/trustTeamSources.js'

const enabled = { TRUST_TEAM_ENABLED: 'true' }

describe('team source config', () => {
  it('defaults to disabled with conservative OTP + cadence policy', () => {
    const config = resolveTeamConfig({})
    expect(config.enabled).toBe(false)
    expect(config.allowedRegistryProviders).toEqual(['opencorporates'])
    expect(config.allowedHrisProviders).toEqual(['gusto'])
    expect(config.otpTtlMinutes).toBe(30)
    expect(config.otpMaxAttempts).toBe(5)
    expect(config.proofTtlDays).toBe(90)
    expect(config.timeoutMs).toBe(15000)
    expect(config.dpiaApproved).toBe(true)
  })

  it('parses env overrides and clamps minimums', () => {
    const config = resolveTeamConfig({
      TRUST_TEAM_REGISTRY_PROVIDERS: 'opencorporates, companies_house',
      TRUST_TEAM_HRIS_PROVIDERS: 'gusto,rippling',
      TRUST_TEAM_OTP_TTL_MINUTES: '0',
      TRUST_TEAM_TIMEOUT_MS: '500',
      TRUST_TEAM_SYNC_INTERVAL_MS: '1000',
      TRUST_TEAM_REQUIRE_DPIA: 'true',
    })
    expect(config.allowedRegistryProviders).toEqual(['opencorporates', 'companies_house'])
    expect(config.allowedHrisProviders).toEqual(['gusto', 'rippling'])
    expect(config.otpTtlMinutes).toBe(1)
    expect(config.timeoutMs).toBe(2000)
    expect(config.syncIntervalMs).toBe(3600_000)
    expect(config.dpiaApproved).toBe(false)
  })

  it('reports work-email availability with machine reasons', () => {
    expect(resolveWorkEmailAvailability({}).availability_reason).toBe('feature_disabled')
    expect(resolveWorkEmailAvailability({ ...enabled, TRUST_TEAM_WORK_EMAIL_ENABLED: 'false' }).availability_reason).toBe('work_email_disabled')
    expect(resolveWorkEmailAvailability({ ...enabled, TRUST_TEAM_REQUIRE_DPIA: 'true' }).availability_reason).toBe('pending_dpia_approval')
    expect(resolveWorkEmailAvailability({ ...enabled }).availability_reason).toBe('awaiting_email_provider')
    expect(resolveWorkEmailAvailability({ ...enabled, RESEND_API_KEY: 're_x' }).availability).toBe('available')
    expect(resolveWorkEmailAvailability({ ...enabled, TRUST_TEAM_OTP_DEV_MODE: 'true' }).availability).toBe('available')
  })

  it('resolves registry providers with allow-list, kill switch, and credential state', () => {
    const enabled = { TRUST_TEAM_ENABLED: 'true', TRUST_TEAM_REGISTRY_PROVIDERS: 'opencorporates,companies_house' }
    expect(resolveRegistryProvider('opencorporates', enabled).availability).toBe('available')
    expect(resolveRegistryProvider('opencorporates', { ...enabled, OPENCORPORATES_API_KEY: 'k' }).platform_credential_configured).toBe(true)
    expect(resolveRegistryProvider('opencorporates', { TRUST_TEAM_ENABLED: 'true', TRUST_TEAM_REGISTRY_PROVIDERS: 'companies_house' }).availability_reason).toBe('provider_not_allowed')
    expect(resolveRegistryProvider('companies_house', { ...enabled, TRUST_TEAM_REGISTRY_COMPANIES_HOUSE_ENABLED: 'false' }).availability_reason).toBe('provider_disabled')
    expect(resolveRegistryProvider('opencorporates', { ...enabled, TRUST_TEAM_REQUIRE_DPIA: 'true' }).availability_reason).toBe('pending_dpia_approval')
    expect(resolveRegistryProvider('nope', enabled).availability_reason).toBe('unsupported_provider')
  })

  it('resolves HRIS providers and lists both catalogs', () => {
    const enabled = { TRUST_TEAM_ENABLED: 'true', TRUST_TEAM_HRIS_PROVIDERS: 'gusto,rippling' }
    expect(resolveHrisProvider('gusto', enabled).availability).toBe('available')
    expect(resolveHrisProvider('bamboohr', enabled).availability_reason).toBe('provider_not_allowed')
    expect(resolveHrisProvider('nope', enabled).availability_reason).toBe('unsupported_provider')
    expect(findRegistryProvider('OpenCorporates').provider).toBe('opencorporates')
    expect(findHrisProvider('GUSTO').provider).toBe('gusto')
    const providers = listTeamProviders().map(entry => entry.provider)
    expect(providers).toEqual(expect.arrayContaining(['opencorporates', 'companies_house', 'gusto', 'rippling', 'bamboohr', 'linkedin_company']))
    const availability = resolveTeamProviderAvailability(enabled)
    expect(availability.registry.opencorporates.availability).toBe('available')
    expect(availability.hris.rippling.availability).toBe('available')
  })

  it('resolves platform credentials from env names only', () => {
    expect(platformRegistryCredential('opencorporates', { OPENCORPORATES_API_KEY: 'secret' })).toBe('secret')
    expect(platformHrisCredential('gusto', { GUSTO_API_KEY: 'secret2' })).toBe('secret2')
    expect(platformRegistryCredential('companies_house', {})).toBeNull()
    expect(platformHrisCredential('nope', { GUSTO_API_KEY: 'x' })).toBeNull()
  })
})
