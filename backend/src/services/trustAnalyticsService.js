// Product analytics verification authority (WS4).
//
// Only the Node backend may mint a *verified* product_analytics proof, and only
// from a server-observed provider read using an encrypted read-only credential.
// Client-supplied MAU/DAU can never reach the verified path.

import { createId, nowIso } from '../utils/api.js'
import * as repo from '../repositories/trustRepository.js'
import { trustCore } from './trustVerificationAuthority.js'
import { appendTrustProof } from './trustAuthority.js'
import { resolveAnalyticsConfig, resolveAnalyticsProvider, findAnalyticsProvider, platformAnalyticsCredential, platformAnalyticsSubject } from '../config/trustAnalyticsSources.js'
import { credentialVaultConfigured, decryptCredential, encryptCredential, describeCredential } from './trustCredentialVault.js'
import { fetchProviderAnalytics } from './trustAnalyticsAdapter.js'

const { hash, normalizeDomain, clean } = trustCore
const SOURCE = 'product_analytics'

function writeAuthorityRequired() {
  return process.env.TRUST_WRITE_SOURCE === 'postgres'
}

function analyticsProofMetadata(metrics, provider, credentialSource) {
  return {
    provider,
    credentialSource,
    mau: metrics.mau,
    dau: metrics.dau,
    wau: metrics.wau,
    retentionD1: metrics.retention_d1,
    retentionD7: metrics.retention_d7,
    retentionD30: metrics.retention_d30,
    activationRate: metrics.activation_rate,
    asOf: metrics.as_of,
    freshnessHours: metrics.freshness_hours,
    windowDays: metrics.window_days,
    metricWindow: 'p30d',
  }
}

export async function connectAnalyticsSource(userId, input = {}, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'analytics_requires_postgres_authority' }
  const provider = String(input.provider || '').trim().toLowerCase()
  const resolved = resolveAnalyticsProvider(provider, env)
  if (!findAnalyticsProvider(provider)) return { ok: false, status: 404, error: 'unsupported_analytics_provider' }
  if (resolved.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: resolved.availability_reason }
  if (!credentialVaultConfigured(env)) return { ok: false, status: 503, error: 'credential_vault_not_configured' }
  const credential = String(input.credential || input.key || '').trim()
  if (!credential) return { ok: false, status: 400, error: 'credential_required' }
  const subject = clean(input.subject || input.projectId || input.propertyId, 200) || null
  const now = nowIso()
  const row = await repo.upsertCredential({
    id: createId('trust_credential'),
    userId,
    provider,
    source: SOURCE,
    encryptedPayload: encryptCredential(credential, { env }),
    scopes: ['read_only'],
    status: 'active',
    subject,
    createdAt: now,
    updatedAt: now,
  }, { env })
  return { ok: true, credential: describeCredential(provider, { scopes: row.scopes, created_at: row.createdAt }) }
}

export async function listAnalyticsCredentials(userId) {
  if (!writeAuthorityRequired()) return { ok: true, credentials: [] }
  const rows = await repo.listActiveCredentials(userId)
  return { ok: true, credentials: rows.filter(row => row.source === SOURCE).map(row => describeCredential(row.provider, { scopes: row.scopes, created_at: row.createdAt, last_synced_at: row.lastSyncedAt })) }
}

export async function disconnectAnalyticsSource(userId, provider) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'analytics_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  await repo.revokeCredential(userId, key)
  await repo.withTrustTransaction(async client => {
    const revoked = await repo.revokeVerifiedProofs(userId, SOURCE, { client })
    for (const proof of revoked) {
      await repo.insertHistory({ id: createId('trust_event'), verificationId: proof.id, userId, projectId: proof.projectId, source: SOURCE, status: 'revoked', confidence: proof.confidence, metadataHash: proof.evidenceHash, eventType: 'trust_revoked', createdAt: nowIso(), expiresAt: proof.expiresAt }, { client })
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

export async function verifyAnalyticsSource(userId, provider, { env = process.env, fetchImpl } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'analytics_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  const resolved = resolveAnalyticsProvider(key, env)
  if (!findAnalyticsProvider(key)) return { ok: false, status: 404, error: 'unsupported_analytics_provider' }
  if (resolved.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: resolved.availability_reason }

  const credentialRow = await repo.getActiveCredential(userId, key)
  let credential = credentialRow ? decryptCredential(credentialRow.encryptedPayload, { env }) : null
  let credentialSource = credentialRow ? 'founder' : null
  let subject = credentialRow?.subject || null
  if (!credential) {
    const platform = platformAnalyticsCredential(key, env)
    if (platform) { credential = platform; credentialSource = 'platform'; subject = subject || platformAnalyticsSubject(key, env) }
  }
  if (!credential) return { ok: false, status: 409, error: 'analytics_credential_not_connected' }

  const fetched = await fetchProviderAnalytics(key, credential, { env, fetchImpl, subject })
  if (!fetched.ok) return fetched
  const metrics = fetched.metrics
  const config = resolveAnalyticsConfig(env)

  if (metrics.mau < config.minMau) return { ok: false, status: 422, error: 'analytics_below_threshold', detail: { mau: metrics.mau, min_mau: config.minMau } }
  if (metrics.freshness_hours != null && metrics.freshness_hours > config.maxFreshnessHours) {
    return { ok: false, status: 422, error: 'analytics_stale_data', detail: { freshness_hours: metrics.freshness_hours, max: config.maxFreshnessHours } }
  }

  const previous = await repo.latestAnalyticsSnapshot(userId, key)
  if (previous && previous.mau > 0 && metrics.mau > previous.mau * config.maxMauJumpRatio) {
    await repo.recordAnomaly({ id: createId('trust_anomaly'), userId, kind: 'analytics_implausible_growth', severity: 'warning', detail: { previous_mau: previous.mau, mau: metrics.mau, max_ratio: config.maxMauJumpRatio }, createdAt: nowIso() })
    return { ok: false, status: 422, error: 'analytics_implausible_growth', detail: { previous_mau: previous.mau, mau: metrics.mau } }
  }

  if (config.requireDomainMatch) {
    const domains = await verifiedDomains(userId)
    const claimed = normalizeDomain(fetched.accountDomain)
    if (!claimed || !domains.has(claimed)) return { ok: false, status: 422, error: 'analytics_domain_mismatch', detail: { account_domain: claimed, verified_domains: [...domains] } }
  }

  const now = nowIso()
  const expiresAt = new Date(Date.now() + config.proofTtlDays * 86400000).toISOString()
  const metadata = analyticsProofMetadata(metrics, key, credentialSource)
  await repo.withTrustTransaction(async client => {
    await repo.revokeVerifiedProofs(userId, SOURCE, { client })
    await repo.insertAnalyticsSnapshot({
      id: createId('trust_analytics'), userId, provider: key, credentialId: credentialRow?.id || null,
      mau: metrics.mau, dau: metrics.dau, wau: metrics.wau,
      retentionD1: metrics.retention_d1, retentionD7: metrics.retention_d7, retentionD30: metrics.retention_d30,
      activationRate: metrics.activation_rate, asOf: metrics.as_of, freshnessHours: metrics.freshness_hours,
      metrics: metadata, createdAt: now,
    }, { client })
  })
  if (credentialRow) await repo.markCredentialSynced(credentialRow.id, { subject: fetched.subject, metrics: metadata, verifiedAt: now })

  const proof = await appendTrustProof(userId, {
    source: SOURCE,
    status: 'verified',
    method: `${key}_readonly`,
    providerSubjectId: credentialSource === 'founder' ? (clean(fetched.subject, 200) || null) : null,
    confidence: 0.9,
    metadata,
    evidenceHash: hash({ provider: key, subject: fetched.subject, mau: metrics.mau, dau: metrics.dau }),
    expiresAt,
    attestationLevel: 'provider_observed',
    correlationGroup: 'product',
    metricWindow: 'p30d',
  })
  if (!proof.ok) return proof
  return { ok: true, provider: key, status: 'verified', metrics, credential: describeCredential(key, { scopes: credentialRow ? credentialRow.scopes : [], created_at: credentialRow ? credentialRow.createdAt : null, last_synced_at: now }), verification: proof.proof, profile: proof.profile }
}

export async function runAnalyticsRefresh({ env = process.env, fetchImpl, limit = 100 } = {}) {
  if (!writeAuthorityRequired()) return { ok: true, skipped: 'analytics_requires_postgres_authority' }
  const config = resolveAnalyticsConfig(env)
  if (!config.enabled) return { ok: true, skipped: 'analytics_disabled' }
  const due = await repo.listCredentialsDueForSync({ intervalMs: config.syncIntervalMs, limit })
  const results = []
  for (const row of due) {
    if (row.source !== SOURCE) continue
    try {
      const result = await verifyAnalyticsSource(row.userId, row.provider, { env, fetchImpl })
      results.push({ userId: row.userId, provider: row.provider, ok: result.ok, error: result.error || null })
    } catch (error) {
      results.push({ userId: row.userId, provider: row.provider, ok: false, error: 'refresh_failed', detail: error.message })
    }
  }
  return { ok: true, refreshed: results.length, results }
}
