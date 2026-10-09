// Shipping / deployment cadence verification authority (WS5).
//
// Only the Node backend may mint a *verified* deployment proof, and only from a
// server-observed provider read using an encrypted read-only credential.
// Client-supplied deploy/PR counts can never reach the verified path.

import { createId, nowIso } from '../utils/api.js'
import * as repo from '../repositories/trustRepository.js'
import { trustCore } from './trustVerificationAuthority.js'
import { appendTrustProof } from './trustAuthority.js'
import { resolveShippingConfig, resolveShippingProvider, findShippingProvider, platformShippingCredential, platformShippingSubject } from '../config/trustShippingSources.js'
import { credentialVaultConfigured, decryptCredential, encryptCredential, describeCredential } from './trustCredentialVault.js'
import { buildCadence, fetchProviderShipping } from './trustShippingAdapter.js'

const { hash, normalizeDomain, clean } = trustCore
const CREDENTIAL_SOURCE = 'shipping'
const PROOF_SOURCE = 'deployment'

function writeAuthorityRequired() {
  return process.env.TRUST_WRITE_SOURCE === 'postgres'
}

function cadenceProofMetadata(cadence, provider, credentialSource) {
  return {
    provider,
    credentialSource,
    deploys30d: cadence.deploys_30d,
    deployments30d: cadence.deploys_30d,
    deploys90d: cadence.deploys_90d,
    deploySuccessRate30d: cadence.deploy_success_rate_30d,
    lastDeployAt: cadence.last_deploy_at,
    mergedPrs30d: cadence.merged_prs_30d,
    mergedPrs90d: cadence.merged_prs_90d,
    releases30d: cadence.releases_30d,
    releases90d: cadence.releases_90d,
    uptime30d: cadence.uptime_30d,
    leadTimeHours: cadence.lead_time_hours,
    asOf: cadence.as_of,
    freshnessHours: cadence.freshness_hours,
    windowDays: cadence.window_days,
    metricWindow: 'p30d',
  }
}

export async function connectShippingSource(userId, input = {}, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'shipping_requires_postgres_authority' }
  const provider = String(input.provider || '').trim().toLowerCase()
  const resolved = resolveShippingProvider(provider, env)
  if (!findShippingProvider(provider)) return { ok: false, status: 404, error: 'unsupported_shipping_provider' }
  if (resolved.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: resolved.availability_reason }
  if (!credentialVaultConfigured(env)) return { ok: false, status: 503, error: 'credential_vault_not_configured' }
  const credential = String(input.credential || input.token || '').trim()
  if (!credential) return { ok: false, status: 400, error: 'credential_required' }
  const subject = clean(input.subject || input.projectId || input.repository || input.siteId, 200) || null
  const now = nowIso()
  const row = await repo.upsertCredential({
    id: createId('trust_credential'),
    userId,
    provider,
    source: CREDENTIAL_SOURCE,
    encryptedPayload: encryptCredential(credential, { env }),
    scopes: ['read_only'],
    status: 'active',
    subject,
    createdAt: now,
    updatedAt: now,
  }, { env })
  return { ok: true, credential: describeCredential(provider, { scopes: row.scopes, created_at: row.createdAt }) }
}

export async function listShippingCredentials(userId) {
  if (!writeAuthorityRequired()) return { ok: true, credentials: [] }
  const rows = await repo.listActiveCredentials(userId)
  return { ok: true, credentials: rows.filter(row => row.source === CREDENTIAL_SOURCE).map(row => describeCredential(row.provider, { scopes: row.scopes, created_at: row.createdAt, last_synced_at: row.lastSyncedAt })) }
}

export async function disconnectShippingSource(userId, provider) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'shipping_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  await repo.revokeCredential(userId, key)
  await repo.withTrustTransaction(async client => {
    const revoked = await repo.revokeVerifiedProofs(userId, PROOF_SOURCE, { client })
    for (const proof of revoked) {
      await repo.insertHistory({ id: createId('trust_event'), verificationId: proof.id, userId, projectId: proof.projectId, source: PROOF_SOURCE, status: 'revoked', confidence: proof.confidence, metadataHash: proof.evidenceHash, eventType: 'trust_revoked', createdAt: nowIso(), expiresAt: proof.expiresAt }, { client })
    }
  })
  return { ok: true, provider: key, status: 'disconnected' }
}

async function verifiedDomains(userId) {
  const proofs = await repo.listProofs(userId)
  const now = Date.now()
  return new Set(proofs
    .filter(proof => proof.status === 'verified' && (!proof.expiresAt || new Date(proof.expiresAt).getTime() > now))
    .filter(proof => proof.source === 'domain' || proof.source === 'website')
    .map(proof => normalizeDomain(proof.metadata?.domain || proof.metadata?.website))
    .filter(Boolean))
}

export async function verifyShippingSource(userId, provider, { env = process.env, fetchImpl } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'shipping_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  const resolved = resolveShippingProvider(key, env)
  if (!findShippingProvider(key)) return { ok: false, status: 404, error: 'unsupported_shipping_provider' }
  if (resolved.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: resolved.availability_reason }

  const credentialRow = await repo.getActiveCredential(userId, key)
  let credential = credentialRow ? decryptCredential(credentialRow.encryptedPayload, { env }) : null
  let credentialSource = credentialRow ? 'founder' : null
  let subject = credentialRow?.subject || null
  if (!credential) {
    const platform = platformShippingCredential(key, env)
    if (platform) { credential = platform; credentialSource = 'platform'; subject = subject || platformShippingSubject(key, env) }
  }
  if (!credential) return { ok: false, status: 409, error: 'shipping_credential_not_connected' }

  const fetched = await fetchProviderShipping(key, credential, { env, fetchImpl, subject })
  if (!fetched.ok) return fetched
  const cadence = buildCadence({ deploys: fetched.deploys, mergedPrs: fetched.mergedPrs, releases: fetched.releases, uptimes: fetched.uptimes, leadTimeHours: fetched.leadTimeHours })
  const config = resolveShippingConfig(env)

  if (cadence.deploys_30d < config.minDeploys30d) return { ok: false, status: 422, error: 'shipping_below_threshold', detail: { deploys_30d: cadence.deploys_30d, min_deploys_30d: config.minDeploys30d } }

  const previous = await repo.latestShippingSnapshot(userId, key)
  if (previous && previous.deploys30d > 0 && cadence.deploys_30d > previous.deploys30d * config.maxDeploysJumpRatio) {
    await repo.recordAnomaly({ id: createId('trust_anomaly'), userId, kind: 'shipping_implausible_growth', severity: 'warning', detail: { previous_deploys: previous.deploys30d, deploys: cadence.deploys_30d, max_ratio: config.maxDeploysJumpRatio }, createdAt: nowIso() })
    return { ok: false, status: 422, error: 'shipping_implausible_growth', detail: { previous_deploys: previous.deploys30d, deploys: cadence.deploys_30d } }
  }

  if (config.requireDomainMatch) {
    const domains = await verifiedDomains(userId)
    const claimed = normalizeDomain(fetched.accountDomain)
    if (!claimed || !domains.has(claimed)) return { ok: false, status: 422, error: 'shipping_domain_mismatch', detail: { account_domain: claimed, verified_domains: [...domains] } }
  }

  const now = nowIso()
  const expiresAt = new Date(Date.now() + config.proofTtlDays * 86400000).toISOString()
  const metadata = cadenceProofMetadata(cadence, key, credentialSource)
  await repo.withTrustTransaction(async client => {
    await repo.revokeVerifiedProofs(userId, PROOF_SOURCE, { client })
    await repo.insertShippingSnapshot({
      id: createId('trust_shipping'), userId, provider: key, credentialId: credentialRow?.id || null,
      deploys30d: cadence.deploys_30d, deploys90d: cadence.deploys_90d,
      deploySuccessRate30d: cadence.deploy_success_rate_30d, lastDeployAt: cadence.last_deploy_at,
      mergedPrs30d: cadence.merged_prs_30d, mergedPrs90d: cadence.merged_prs_90d,
      releases30d: cadence.releases_30d, releases90d: cadence.releases_90d,
      uptime30d: cadence.uptime_30d, leadTimeHours: cadence.lead_time_hours,
      asOf: cadence.as_of, freshnessHours: cadence.freshness_hours, metrics: metadata, createdAt: now,
    }, { client })
  })
  if (credentialRow) await repo.markCredentialSynced(credentialRow.id, { subject: fetched.subject, metrics: metadata, verifiedAt: now })

  const proof = await appendTrustProof(userId, {
    source: PROOF_SOURCE,
    status: 'verified',
    method: `${key}_readonly`,
    providerSubjectId: credentialSource === 'founder' ? (clean(fetched.subject, 200) || null) : null,
    confidence: 0.9,
    metadata,
    evidenceHash: hash({ provider: key, subject: fetched.subject, deploys30d: cadence.deploys_30d, mergedPrs30d: cadence.merged_prs_30d }),
    expiresAt,
    attestationLevel: 'provider_observed',
    correlationGroup: 'delivery',
    metricWindow: 'p30d',
  })
  if (!proof.ok) return proof
  return { ok: true, provider: key, status: 'verified', cadence, credential: describeCredential(key, { scopes: credentialRow ? credentialRow.scopes : [], created_at: credentialRow ? credentialRow.createdAt : null, last_synced_at: now }), verification: proof.proof, profile: proof.profile }
}

export async function runShippingRefresh({ env = process.env, fetchImpl, limit = 100 } = {}) {
  if (!writeAuthorityRequired()) return { ok: true, skipped: 'shipping_requires_postgres_authority' }
  const config = resolveShippingConfig(env)
  if (!config.enabled) return { ok: true, skipped: 'shipping_disabled' }
  const due = await repo.listCredentialsDueForSync({ intervalMs: config.syncIntervalMs, limit })
  const results = []
  for (const row of due) {
    if (row.source !== CREDENTIAL_SOURCE) continue
    try {
      const result = await verifyShippingSource(row.userId, row.provider, { env, fetchImpl })
      results.push({ userId: row.userId, provider: row.provider, ok: result.ok, error: result.error || null })
    } catch (error) {
      results.push({ userId: row.userId, provider: row.provider, ok: false, error: 'refresh_failed', detail: error.message })
    }
  }
  return { ok: true, refreshed: results.length, results }
}
