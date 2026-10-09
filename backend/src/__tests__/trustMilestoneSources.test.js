import { describe, expect, it } from 'vitest'
import {
  findAttestationProvider,
  findMilestoneType,
  listAttestationProviders,
  listMilestoneTypes,
  platformAttestationCredential,
  resolveAttestationProvider,
  resolveMilestoneAvailability,
  resolveMilestoneCatalog,
  resolveMilestoneConfig,
  resolveMilestoneType,
} from '../config/trustMilestoneSources.js'

describe('milestone source config', () => {
  it('defaults to disabled with evidence required and DPIA satisfied', () => {
    const config = resolveMilestoneConfig({})
    expect(config.enabled).toBe(false)
    expect(config.requireEvidence).toBe(true)
    expect(config.requireAttestation).toBe(false)
    expect(config.dpiaApproved).toBe(true)
    expect(config.proofTtlDays).toBe(365)
    expect(config.timeoutMs).toBe(15000)
    expect(config.allowedTypes).toEqual(expect.arrayContaining(['funding', 'audit', 'launch']))
  })

  it('parses env overrides and clamps minimums', () => {
    const config = resolveMilestoneConfig({
      TRUST_MILESTONE_TYPES: 'funding, audit',
      TRUST_MILESTONE_REQUIRE_EVIDENCE: 'false',
      TRUST_MILESTONE_REQUIRE_ATTESTATION: 'true',
      TRUST_MILESTONE_REQUIRE_DPIA: 'true',
      TRUST_MILESTONE_TIMEOUT_MS: '1',
      TRUST_MILESTONE_PROOF_TTL_DAYS: '0',
    })
    expect(config.allowedTypes).toEqual(['funding', 'audit'])
    expect(config.requireEvidence).toBe(false)
    expect(config.requireAttestation).toBe(true)
    expect(config.dpiaApproved).toBe(false)
    expect(config.timeoutMs).toBe(2000)
    expect(config.proofTtlDays).toBe(1)
  })

  it('reports availability with machine reasons', () => {
    expect(resolveMilestoneAvailability({}).availability_reason).toBe('feature_disabled')
    expect(resolveMilestoneAvailability({ TRUST_MILESTONES_ENABLED: 'true', TRUST_MILESTONE_REQUIRE_DPIA: 'true' }).availability_reason).toBe('pending_dpia_approval')
    expect(resolveMilestoneAvailability({ TRUST_MILESTONES_ENABLED: 'true' }).availability).toBe('available')
  })

  it('resolves milestone types with allow-list and attestation requirement', () => {
    const enabled = { TRUST_MILESTONES_ENABLED: 'true' }
    expect(resolveMilestoneType('audit', enabled).requires_attestation).toBe(true)
    expect(resolveMilestoneType('funding', enabled).requires_attestation).toBe(false)
    expect(resolveMilestoneType('nope', enabled).availability_reason).toBe('unsupported_milestone_type')
    expect(resolveMilestoneType('audit', { ...enabled, TRUST_MILESTONE_TYPES: 'funding' }).availability_reason).toBe('type_not_allowed')
    expect(resolveMilestoneType('funding', { ...enabled, TRUST_MILESTONE_REQUIRE_ATTESTATION: 'true' }).requires_attestation).toBe(true)
  })

  it('resolves attestation providers and their credential state', () => {
    const enabled = { TRUST_MILESTONES_ENABLED: 'true' }
    expect(resolveAttestationProvider('docusign', enabled).kind).toBe('esign')
    expect(resolveAttestationProvider('docusign', { ...enabled, DOCUSIGN_ACCESS_TOKEN: 'd' }).platform_credential_configured).toBe(true)
    expect(resolveAttestationProvider('auditor_letter', enabled).kind).toBe('documented')
    expect(resolveAttestationProvider('nope', enabled).availability_reason).toBe('unsupported_attestation_provider')
    expect(platformAttestationCredential('hellosign', { HELLOSIGN_API_KEY: 'h' })).toBe('h')
    expect(platformAttestationCredential('notary', {})).toBeNull()
  })

  it('lists every type and provider and builds a catalog', () => {
    expect(findMilestoneType('FUNDING').type).toBe('funding')
    expect(findAttestationProvider('DOCUSIGN').provider).toBe('docusign')
    expect(listMilestoneTypes().map(entry => entry.type)).toEqual(expect.arrayContaining(['funding', 'contract_loi', 'invoice', 'cap_table', 'audit', 'patent', 'launch']))
    expect(listAttestationProviders().map(entry => entry.provider)).toEqual(expect.arrayContaining(['docusign', 'hellosign', 'auditor_letter', 'notary']))
    const catalog = resolveMilestoneCatalog({ TRUST_MILESTONES_ENABLED: 'true' })
    expect(catalog.milestone.availability).toBe('available')
    expect(catalog.types.funding.availability).toBe('available')
    expect(catalog.attestation.docusign.availability).toBe('available')
  })
})
