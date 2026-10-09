// Anti-gaming + consistency checks for trust proof ingestion.
//
// All thresholds are env-configurable; safe defaults live here. Detection is a
// pure function over the user's scope plus injected lookups, so it is fully
// unit-testable without a database.

const isTrue = value => String(value ?? '').trim().toLowerCase() === 'true'

function configNumber(env, key, fallback, warnings) {
  const raw = env[key]
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) { warnings.push(`${key}_invalid`); return fallback }
  return value
}

export function loadAntiGamingConfig(env = process.env) {
  const warnings = []
  return {
    config: {
      maxProofsPerHour: configNumber(env, 'TRUST_VELOCITY_MAX_PROOFS_PER_HOUR', 12, warnings),
      maxSubmitsPerDay: configNumber(env, 'TRUST_VELOCITY_MAX_SUBMITS_PER_DAY', 40, warnings),
      evidenceReuseWindowDays: configNumber(env, 'TRUST_EVIDENCE_REUSE_WINDOW_DAYS', 3650, warnings),
      mauJumpRatio: configNumber(env, 'TRUST_ANOMALY_MAU_JUMP_RATIO', 5, warnings),
      burstWindowMinutes: configNumber(env, 'TRUST_ANOMALY_BURST_WINDOW_MINUTES', 10, warnings),
      burstMaxProofs: configNumber(env, 'TRUST_ANOMALY_BURST_MAX_PROOFS', 6, warnings),
      strictConsistency: isTrue(env.TRUST_CONSISTENCY_STRICT),
      strictEvidenceReuse: isTrue(env.TRUST_EVIDENCE_REUSE_STRICT),
    },
    warnings,
  }
}

const normalizeDomain = value => String(value || '').trim().toLowerCase().replace(/^www\./, '')

function verifiedDomains(scope, userId) {
  const now = Date.now()
  return new Set(
    scope.trustVerificationProofs
      .filter(proof => proof.userId === userId && proof.status === 'verified' && (!proof.expiresAt || new Date(proof.expiresAt).getTime() > now))
      .filter(proof => proof.source === 'domain' || proof.source === 'website')
      .map(proof => normalizeDomain(proof.metadata?.domain || proof.metadata?.website))
      .filter(Boolean),
  )
}

function consistencyAnomalies(scope, proof) {
  const anomalies = []
  const claimed = normalizeDomain(proof.metadata?.domain || proof.metadata?.website || proof.metadata?.company_domain)
  if (!claimed) return anomalies
  if (proof.source !== 'email' && proof.source !== 'revenue' && proof.source !== 'organization') return anomalies
  const domains = verifiedDomains(scope, proof.userId)
  if (domains.size > 0 && !domains.has(claimed)) {
    anomalies.push({ kind: 'cross_source_domain_mismatch', severity: 'warning', detail: { claimed, verified: [...domains] } })
  }
  return anomalies
}

function evidenceAnomalies(proof, externalMatches) {
  const anomalies = []
  if (proof.evidenceHash && externalMatches.evidence?.length) {
    anomalies.push({ kind: 'evidence_reused_across_accounts', severity: 'critical', detail: { evidenceHash: proof.evidenceHash.slice(0, 16), accounts: externalMatches.evidence.length } })
  }
  if (proof.providerSubjectId && externalMatches.subject?.length) {
    anomalies.push({ kind: 'provider_subject_reused_across_accounts', severity: 'critical', detail: { source: proof.source, subject: proof.providerSubjectId.slice(0, 24), accounts: externalMatches.subject.length } })
  }
  return anomalies
}

export async function evaluateAntiGaming({ scope, proof, lookups = {}, env = process.env, now = Date.now() } = {}) {
  const { config, warnings } = loadAntiGamingConfig(env)
  const reasons = []
  const anomalies = []
  const userProofs = (scope?.trustVerificationProofs || []).filter(row => row.userId === proof.userId)

  const hourAgo = now - 3600 * 1000
  const recent = userProofs.filter(row => new Date(row.createdAt || 0).getTime() >= hourAgo).length
  if (recent + 1 > config.maxProofsPerHour) {
    reasons.push('velocity_proofs_per_hour')
    anomalies.push({ kind: 'velocity_proofs_per_hour', severity: 'warning', detail: { count: recent + 1, limit: config.maxProofsPerHour } })
  }

  const burstStart = now - config.burstWindowMinutes * 60 * 1000
  const burst = userProofs.filter(row => new Date(row.createdAt || 0).getTime() >= burstStart).length
  if (burst + 1 > config.burstMaxProofs) {
    reasons.push('burst_anomaly')
    anomalies.push({ kind: 'burst_anomaly', severity: 'warning', detail: { count: burst + 1, windowMinutes: config.burstWindowMinutes } })
  }

  const externalMatches = { evidence: [], subject: [] }
  if (proof.evidenceHash && typeof lookups.byEvidenceHash === 'function') {
    const matches = await lookups.byEvidenceHash(proof.evidenceHash)
    externalMatches.evidence = (matches || []).filter(row => row.userId !== proof.userId)
  }
  if (proof.providerSubjectId && typeof lookups.byProviderSubject === 'function') {
    const matches = await lookups.byProviderSubject(proof.source, proof.providerSubjectId)
    externalMatches.subject = (matches || []).filter(row => row.userId !== proof.userId)
  }
  anomalies.push(...evidenceAnomalies(proof, externalMatches))

  const consistency = consistencyAnomalies(scope, proof)
  anomalies.push(...consistency)
  if (config.strictConsistency && consistency.length) reasons.push('cross_source_mismatch')

  for (const anomaly of anomalies) if (!reasons.includes(anomaly.kind)) reasons.push(anomaly.kind)

  const critical = anomalies.some(anomaly => anomaly.severity === 'critical')
  const blocking = critical && (proof.status === 'verified' || config.strictEvidenceReuse)
  return {
    allow: !blocking,
    blocking,
    severity: critical ? 'critical' : anomalies.length ? 'warning' : 'info',
    reasons: [...new Set(reasons)],
    anomalies,
    warnings,
  }
}
