// Outcomes / milestone verification source configuration (WS7).
//
// Env-driven: which milestone types are enabled, which third-party attestation
// providers may upgrade a milestone to `third_party_attested`, evidence limits,
// and the DPIA gate. Code only enforces invariants:
//   - every milestone requires a scanned, hashed evidence object to be reviewed
//   - only a server-observed e-sign envelope or an admin-confirmed third-party
//     letter/notary may raise the proof to `third_party_attested`

const isTrue = value => String(value ?? '').trim().toLowerCase() === 'true'
const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const list = value => String(value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean)

// Milestone catalog. `requires_attestation` milestones cannot reach full weight
// on a founder's own word alone; `cross_links` names the trust source the
// milestone may reference (contract / revenue / deployment) when present.
export const MILESTONE_TYPES = Object.freeze({
  funding: Object.freeze({ type: 'funding', display_name: 'Funding round', category: 'financials', requires_attestation: false, cross_links: Object.freeze(['revenue']) }),
  contract_loi: Object.freeze({ type: 'contract_loi', display_name: 'Contract / LOI', category: 'commercial', requires_attestation: false, cross_links: Object.freeze(['contract']) }),
  invoice: Object.freeze({ type: 'invoice', display_name: 'Invoice', category: 'financials', requires_attestation: false, cross_links: Object.freeze(['revenue']) }),
  cap_table: Object.freeze({ type: 'cap_table', display_name: 'Cap table', category: 'financials', requires_attestation: false, cross_links: Object.freeze([]) }),
  audit: Object.freeze({ type: 'audit', display_name: 'Audit', category: 'compliance', requires_attestation: true, cross_links: Object.freeze([]) }),
  patent: Object.freeze({ type: 'patent', display_name: 'Patent', category: 'ip', requires_attestation: false, cross_links: Object.freeze([]) }),
  launch: Object.freeze({ type: 'launch', display_name: 'Launch', category: 'execution', requires_attestation: false, cross_links: Object.freeze(['deployment']) }),
})

// Third-party attestation providers.
//   - esign: server-observed envelope status via a read-only provider token
//   - documented: an auditor/accountant letter or notary the admin confirms
export const ATTESTATION_PROVIDERS = Object.freeze({
  docusign: Object.freeze({ provider: 'docusign', display_name: 'DocuSign', kind: 'esign', base_url: 'https://na3.docusign.net', hosts: Object.freeze(['na3.docusign.net']), credential_env: Object.freeze(['DOCUSIGN_ACCESS_TOKEN']), auth: 'bearer' }),
  hellosign: Object.freeze({ provider: 'hellosign', display_name: 'Dropbox Sign', kind: 'esign', base_url: 'https://api.hellosign.com', hosts: Object.freeze(['api.hellosign.com']), credential_env: Object.freeze(['HELLOSIGN_API_KEY']), auth: 'basic' }),
  auditor_letter: Object.freeze({ provider: 'auditor_letter', display_name: 'Auditor / accountant letter', kind: 'documented', base_url: null, hosts: Object.freeze([]), credential_env: Object.freeze([]), auth: 'admin_review' }),
  notary: Object.freeze({ provider: 'notary', display_name: 'Notary', kind: 'documented', base_url: null, hosts: Object.freeze([]), credential_env: Object.freeze([]), auth: 'admin_review' }),
})

export function findMilestoneType(type) {
  return MILESTONE_TYPES[String(type || '').trim().toLowerCase()] || null
}

export function findAttestationProvider(provider) {
  return ATTESTATION_PROVIDERS[String(provider || '').trim().toLowerCase()] || null
}

export function listMilestoneTypes() {
  return Object.values(MILESTONE_TYPES)
}

export function listAttestationProviders() {
  return Object.values(ATTESTATION_PROVIDERS)
}

function platformCredential(entry, env) {
  if (!entry) return null
  for (const name of entry.credential_env) {
    const value = String(env[name] || '').trim()
    if (value) return value
  }
  return null
}

export function platformAttestationCredential(provider, env = process.env) {
  return platformCredential(findAttestationProvider(provider), env)
}

export function resolveMilestoneConfig(env = process.env) {
  const allowed = list(env.TRUST_MILESTONE_TYPES)
  const requireDpia = isTrue(env.TRUST_MILESTONE_REQUIRE_DPIA)
  const dpiaRef = String(env.TRUST_MILESTONE_DPIA_APPROVAL_REF || '').trim()
  return {
    enabled: isTrue(env.TRUST_MILESTONES_ENABLED),
    allowedTypes: allowed.length ? allowed : listMilestoneTypes().map(entry => entry.type),
    requireEvidence: String(env.TRUST_MILESTONE_REQUIRE_EVIDENCE ?? 'true').trim().toLowerCase() !== 'false',
    requireAttestation: isTrue(env.TRUST_MILESTONE_REQUIRE_ATTESTATION),
    dpiaRequired: requireDpia,
    dpiaApproved: !requireDpia || Boolean(dpiaRef),
    maxEvidenceBytes: Math.max(1024, num(env.TRUST_MILESTONE_EVIDENCE_MAX_BYTES, 25 * 1024 * 1024)),
    maxEvidencePerMilestone: Math.max(1, num(env.TRUST_MILESTONE_MAX_EVIDENCE, 10)),
    freshnessHours: Math.max(1, num(env.TRUST_MILESTONE_FRESHNESS_HOURS, 24 * 365)),
    proofTtlDays: Math.max(1, num(env.TRUST_MILESTONE_PROOF_TTL_DAYS, 365)),
    timeoutMs: Math.max(2000, num(env.TRUST_MILESTONE_TIMEOUT_MS, 15000)),
  }
}

export function resolveMilestoneAvailability(env = process.env) {
  const config = resolveMilestoneConfig(env)
  let availability = 'available'
  let availability_reason = null
  if (!config.enabled) { availability = 'coming_soon'; availability_reason = 'feature_disabled' }
  else if (!config.dpiaApproved) { availability = 'coming_soon'; availability_reason = 'pending_dpia_approval' }
  return { provider: 'milestone', enabled: availability === 'available', availability, availability_reason, evidence_required: config.requireEvidence, attestation_required: config.requireAttestation }
}

export function resolveMilestoneType(type, env = process.env) {
  const entry = findMilestoneType(type)
  if (!entry) return { type: String(type || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_milestone_type' }
  const config = resolveMilestoneConfig(env)
  const availability = resolveMilestoneAvailability(env)
  if (!availability.enabled) return { ...entry, enabled: false, availability: availability.availability, availability_reason: availability.availability_reason }
  if (!config.allowedTypes.includes(entry.type)) return { ...entry, enabled: false, availability: 'coming_soon', availability_reason: 'type_not_allowed' }
  return { ...entry, enabled: true, availability: 'available', availability_reason: null, requires_attestation: entry.requires_attestation || config.requireAttestation }
}

export function resolveAttestationProvider(provider, env = process.env) {
  const entry = findAttestationProvider(provider)
  if (!entry) return { provider: String(provider || '').toLowerCase() || null, enabled: false, availability: 'coming_soon', availability_reason: 'unsupported_attestation_provider' }
  const config = resolveMilestoneConfig(env)
  if (!config.enabled) return { ...entry, enabled: false, availability: 'coming_soon', availability_reason: 'feature_disabled' }
  return { ...entry, enabled: true, availability: 'available', availability_reason: null, platform_credential_configured: Boolean(platformCredential(entry, env)) }
}

export function resolveMilestoneCatalog(env = process.env) {
  return {
    milestone: resolveMilestoneAvailability(env),
    types: Object.fromEntries(listMilestoneTypes().map(entry => [entry.type, resolveMilestoneType(entry.type, env)])),
    attestation: Object.fromEntries(listAttestationProviders().map(entry => [entry.provider, resolveAttestationProvider(entry.provider, env)])),
  }
}
