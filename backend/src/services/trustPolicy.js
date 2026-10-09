// Versioned trust scoring policy.
//
// POLICY_V2 is the current, additive behavior implemented in
// trustVerificationAuthority.js. POLICY_V3 is the proposed model: capped,
// decayed, attestation-weighted, and correlation-aware.
//
// SAFETY: shipping this file does NOT change live scores. V3 only activates
// when TRUST_POLICY_VERSION=trust-v3 AND TRUST_POLICY_V3_SIGNED_OFF=true.
// Until product signs off, resolveTrustPolicy() returns v2.

export const POLICY_V2 = 'trust-v2'
export const POLICY_V3 = 'trust-v3'

// Proposed caps (sum of independent source caps = 100). Pending product sign-off.
export const TRUST_V3_DRAFT = Object.freeze({
  version: POLICY_V3,
  status: 'draft_pending_signoff',
  sourceCaps: Object.freeze({
    identity: 18,
    revenue: 15,
    product_analytics: 12,
    shipping: 12,
    team: 10,
    domain: 8,
    website: 8,
    github: 8,
    organization: 6,
    milestone: 6,
    linkedin: 5,
    email: 4,
    phone: 4,
    verified_skills: 20,
  }),
  halfLifeDays: Object.freeze({
    identity: 365,
    revenue: 30,
    product_analytics: 7,
    shipping: 7,
    team: 90,
    domain: 180,
    website: 180,
    github: 45,
    organization: 180,
    milestone: 365,
    linkedin: 180,
    email: 730,
    phone: 730,
  }),
  // 'self' means the founder asserted it and an admin approved it without a
  // provider-observed result. It must not carry full weight.
  attestationWeights: Object.freeze({ self: 0.35, provider_observed: 1, third_party_attested: 1 }),
  correlationGroups: Object.freeze({
    github: 'code',
    shipping: 'delivery',
    deployment: 'delivery',
    domain: 'web_presence',
    website: 'web_presence',
    email: 'web_presence',
    phone: 'web_presence',
    organization: 'org',
    team: 'org',
    revenue: 'financials',
    milestone: 'financials',
    product_analytics: 'product',
    identity: 'identity',
  }),
  tierThresholds: Object.freeze({ highly_trusted: 80, verified: 60, building: 30 }),
  metricWindows: Object.freeze({ product_analytics: 'p30d', revenue: 'p30d', shipping: 'p30d' }),
  signOff: Object.freeze({ requiredEnv: 'TRUST_POLICY_V3_SIGNED_OFF', owner: 'product' }),
})

export function resolveTrustPolicy(env = process.env) {
  const requested = String(env.TRUST_POLICY_VERSION || POLICY_V2).trim().toLowerCase()
  if (requested !== POLICY_V3) return { active: POLICY_V2, requested, gated: false, reason: 'default' }
  const signedOff = String(env.TRUST_POLICY_V3_SIGNED_OFF || '').trim().toLowerCase() === 'true'
  if (!signedOff) return { active: POLICY_V2, requested, gated: true, reason: 'trust_v3_requires_signoff', policy: TRUST_V3_DRAFT }
  return { active: POLICY_V3, requested, gated: false, reason: 'signed_off', policy: TRUST_V3_DRAFT }
}

// Env overrides. Every tunable knob is configurable, but invalid values never
// take effect: they are ignored and reported as warnings so a typo cannot
// silently weaken or break scoring. Credentials/feature flags are already env;
// this makes the *policy numbers* env too, while code holds the safe defaults.
function positiveNumber(env, key, fallback) {
  const raw = env[key]
  if (raw === undefined || raw === null || String(raw).trim() === '') return { value: fallback, warning: null }
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) return { value: fallback, warning: `${key}_invalid` }
  return { value, warning: null }
}

export function loadTrustPolicyFromEnv(env = process.env, base = TRUST_V3_DRAFT) {
  const warnings = []

  const sourceCaps = { ...base.sourceCaps }
  for (const source of Object.keys(sourceCaps)) {
    const { value, warning } = positiveNumber(env, `TRUST_CAP_${source.toUpperCase()}`, sourceCaps[source])
    if (warning) warnings.push(warning)
    sourceCaps[source] = value
  }

  const halfLifeDays = { ...base.halfLifeDays }
  for (const source of Object.keys(halfLifeDays)) {
    const { value, warning } = positiveNumber(env, `TRUST_HALFLIFE_${source.toUpperCase()}`, halfLifeDays[source])
    if (warning) warnings.push(warning)
    halfLifeDays[source] = value
  }

  const selfWeight = positiveNumber(env, 'TRUST_ATTESTATION_SELF_WEIGHT', base.attestationWeights.self)
  const providerWeight = positiveNumber(env, 'TRUST_ATTESTATION_PROVIDER_WEIGHT', base.attestationWeights.provider_observed)
  const thirdPartyWeight = positiveNumber(env, 'TRUST_ATTESTATION_THIRD_PARTY_WEIGHT', base.attestationWeights.third_party_attested)
  for (const result of [selfWeight, providerWeight, thirdPartyWeight]) if (result.warning) warnings.push(result.warning)

  let tierThresholds = { ...base.tierThresholds }
  const highly = positiveNumber(env, 'TRUST_TIER_HIGHLY_TRUSTED', base.tierThresholds.highly_trusted)
  const verified = positiveNumber(env, 'TRUST_TIER_VERIFIED', base.tierThresholds.verified)
  const building = positiveNumber(env, 'TRUST_TIER_BUILDING', base.tierThresholds.building)
  for (const result of [highly, verified, building]) if (result.warning) warnings.push(result.warning)
  if (highly.value > verified.value && verified.value > building.value) {
    tierThresholds = { highly_trusted: highly.value, verified: verified.value, building: building.value }
  } else {
    warnings.push('trust_tier_thresholds_invalid')
  }

  return {
    policy: {
      ...base,
      sourceCaps,
      halfLifeDays,
      attestationWeights: { self: selfWeight.value, provider_observed: providerWeight.value, third_party_attested: thirdPartyWeight.value },
      tierThresholds,
    },
    warnings,
  }
}

export function resolveActivePolicy(env = process.env) {
  const resolved = resolveTrustPolicy(env)
  if (resolved.active !== POLICY_V3) return { ...resolved, warnings: [] }
  const { policy, warnings } = loadTrustPolicyFromEnv(env, resolved.policy)
  return { ...resolved, policy, warnings }
}

const clamp01 = value => Math.min(1, Math.max(0, Number(value)))

function freshness(ageDays, halfLifeDays) {
  const days = Number(ageDays)
  const halfLife = Number(halfLifeDays)
  if (!Number.isFinite(halfLife) || halfLife <= 0) return 1
  return 0.5 ** (Math.max(0, Number.isFinite(days) ? days : 0) / halfLife)
}

// Returns the same shape as trustVerificationAuthority.trustScoreFor so the two
// policies are drop-in comparable. Pure function: no IO, fully unit-testable.
export function computeTrustV3({ proofs = [], skills = [], now = Date.now(), policy = TRUST_V3_DRAFT }) {
  const caps = policy.sourceCaps
  const groups = policy.correlationGroups
  const halfLives = policy.halfLifeDays
  const weights = policy.attestationWeights

  const bestByGroup = new Map()
  for (const proof of proofs) {
    if (proof.status !== 'verified') continue
    if (proof.expiresAt && new Date(proof.expiresAt).getTime() <= now) continue
    const cap = Number(caps[proof.source] ?? 0)
    if (!cap) continue
    const attested = String(proof.attestationLevel || 'self')
    const attestationWeight = Number(weights[attested] ?? weights.self)
    const ageDays = proof.verifiedAt ? (now - new Date(proof.verifiedAt).getTime()) / 86400000 : 0
    const fresh = freshness(ageDays, halfLives[proof.source])
    const confidence = clamp01(proof.confidence ?? 0.5)
    const points = cap * attestationWeight * fresh * confidence
    const group = groups[proof.source] || proof.source
    const previous = bestByGroup.get(group)
    if (!previous || points > previous.points) bestByGroup.set(group, { points, source: proof.source })
  }

  const breakdown = {}
  const signals = []
  let score = 0
  for (const entry of bestByGroup.values()) {
    breakdown[entry.source] = Math.round(entry.points * 100) / 100
    score += entry.points
    signals.push(`${entry.source}_verified`)
  }

  const activeSkills = skills.filter(skill => skill.status === 'verified' && (!skill.expiresAt || new Date(skill.expiresAt).getTime() > now))
  const skillPoints = Math.min(Number(caps.verified_skills ?? 20), activeSkills.reduce((sum, skill) => sum + Math.min(4, clamp01(skill.confidence ?? 0.5) * 4), 0))
  if (skillPoints > 0) {
    breakdown.verified_skills = Math.round(skillPoints * 100) / 100
    score += skillPoints
    signals.push('verified_skills')
  }

  const trustScore = Math.min(100, Math.round(score * 100) / 100)
  const t = policy.tierThresholds
  const tier = trustScore >= t.highly_trusted ? 'Highly Trusted' : trustScore >= t.verified ? 'Verified' : trustScore >= t.building ? 'Building' : 'Claimed'
  return {
    trustScore,
    tier,
    verificationStatus: trustScore > 0 ? 'verified' : 'unverified',
    breakdown,
    signals,
    proofCount: proofs.filter(proof => proof.status === 'verified').length,
    verifiedSkillCount: activeSkills.length,
    policyVersion: policy.version,
  }
}
