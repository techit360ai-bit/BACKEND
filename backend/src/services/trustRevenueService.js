// Revenue verification authority (WS3).
//
// The Node backend is the only component that may mint a *verified* revenue
// proof, and it does so only from server-observed, allowlisted provider reads
// using an encrypted read-only credential. Founder input can connect a
// credential but can never assert a verified total.

import { createId, nowIso } from '../utils/api.js'
import * as repo from '../repositories/trustRepository.js'
import { trustCore } from './trustVerificationAuthority.js'
import { appendTrustProof } from './trustAuthority.js'
import { resolveRevenueConfig, resolveRevenueProvider, findRevenueProvider, platformCredentialFor } from '../config/trustRevenueSources.js'
import { credentialVaultConfigured, decryptCredential, encryptCredential, describeCredential } from './trustCredentialVault.js'
import { computeRevenueAggregates, detectCredentialMode, fetchProviderRevenue } from './trustRevenueAdapter.js'

const { hash, normalizeDomain, clean } = trustCore

const READ_ONLY_PREFIXES = Object.freeze({
  stripe: key => String(key).startsWith('rk_'), // restricted read-only key only
})

function writeAuthorityRequired() {
  return process.env.TRUST_WRITE_SOURCE === 'postgres'
}

function revenueProofMetadata(aggregates, provider, livemode, credentialSource = 'founder') {
  return {
    provider,
    credentialSource,
    mrr: aggregates.mrr,
    arr: aggregates.arr,
    payingCustomers: aggregates.paying_customers,
    churnRate: aggregates.churn_rate,
    netRevenueRetention: aggregates.net_revenue_retention,
    grossMargin: aggregates.gross_margin,
    grossRevenue30d: aggregates.gross_revenue_30d,
    currency: aggregates.currency,
    currencies: aggregates.currencies,
    livemode: livemode === true,
    metricWindow: 'p30d',
    asOf: aggregates.as_of,
    activeSubscriptions: aggregates.active_subscriptions,
    windowDays: aggregates.window_days,
  }
}

// Store a founder-supplied read-only credential encrypted at rest. Returns a
// secret-free descriptor.
export async function connectRevenueSource(userId, input = {}, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'revenue_requires_postgres_authority' }
  const provider = String(input.provider || '').trim().toLowerCase()
  const resolved = resolveRevenueProvider(provider, env)
  if (!findRevenueProvider(provider)) return { ok: false, status: 404, error: 'unsupported_revenue_provider' }
  if (resolved.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: resolved.availability_reason }
  if (!credentialVaultConfigured(env)) return { ok: false, status: 503, error: 'credential_vault_not_configured' }

  const credential = String(input.credential || input.key || '').trim()
  if (!credential) return { ok: false, status: 400, error: 'credential_required' }
  const guard = READ_ONLY_PREFIXES[provider]
  const allowSecret = String(env.TRUST_REVENUE_ALLOW_SECRET_KEYS || '').trim().toLowerCase() === 'true'
  if (guard && !guard(credential) && !allowSecret) return { ok: false, status: 400, error: 'read_only_key_required' }

  const mode = detectCredentialMode(provider, credential)
  const now = nowIso()
  const row = await repo.upsertCredential({
    id: createId('trust_credential'),
    userId,
    provider,
    source: 'revenue',
    encryptedPayload: encryptCredential(credential, { env }),
    scopes: ['read_only'],
    status: 'active',
    mode,
    createdAt: now,
    updatedAt: now,
  }, { env })
  return { ok: true, credential: describeCredential(provider, { scopes: row.scopes, mode: row.mode, created_at: row.createdAt }) }
}

export async function listRevenueCredentials(userId) {
  if (!writeAuthorityRequired()) return { ok: true, credentials: [] }
  const rows = await repo.listActiveCredentials(userId)
  return { ok: true, credentials: rows.filter(row => row.source === 'revenue').map(row => describeCredential(row.provider, { scopes: row.scopes, mode: row.mode, created_at: row.createdAt, last_synced_at: row.lastSyncedAt })) }
}

export async function disconnectRevenueSource(userId, provider) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'revenue_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  await repo.revokeCredential(userId, key)
  await repo.withTrustTransaction(async client => {
    const revoked = await repo.revokeVerifiedProofs(userId, 'revenue', { client })
    for (const proof of revoked) {
      await repo.insertHistory({ id: createId('trust_event'), verificationId: proof.id, userId, projectId: proof.projectId, source: 'revenue', status: 'revoked', confidence: proof.confidence, metadataHash: proof.evidenceHash, eventType: 'trust_revoked', createdAt: nowIso(), expiresAt: proof.expiresAt }, { client })
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

// Fetch -> aggregate -> anti-fraud -> re-proof. Rejects (never mints verified)
// on mode mismatch, test-mode, sub-threshold, implausible growth, or domain
// mismatch.
export async function verifyRevenueSource(userId, provider, { env = process.env, fetchImpl } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'revenue_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  const resolved = resolveRevenueProvider(key, env)
  if (!findRevenueProvider(key)) return { ok: false, status: 404, error: 'unsupported_revenue_provider' }
  if (resolved.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: resolved.availability_reason }

  // Prefer the founder's own encrypted read-only credential; fall back to the
  // platform credential already configured for the payment section (Stripe /
  // Paystack / Flutterwave env keys). The platform fallback never exposes a
  // shared provider subject id, so multiple founders cannot trip the
  // cross-account reuse detector.
  const credentialRow = await repo.getActiveCredential(userId, key)
  let credential = credentialRow ? decryptCredential(credentialRow.encryptedPayload, { env }) : null
  let credentialSource = credentialRow ? 'founder' : null
  if (!credential) {
    const platform = platformCredentialFor(key, env)
    if (platform) { credential = platform; credentialSource = 'platform' }
  }
  if (!credential) return { ok: false, status: 409, error: 'revenue_credential_not_connected' }

  const fetched = await fetchProviderRevenue(key, credential, { env, fetchImpl })
  if (!fetched.ok) return fetched

  const config = resolveRevenueConfig(env)
  const keyMode = detectCredentialMode(key, credential)
  if (keyMode && fetched.mode && keyMode !== fetched.mode) return { ok: false, status: 400, error: 'revenue_mode_mismatch' }
  if (config.requireLivemode && fetched.livemode === false) return { ok: false, status: 400, error: 'revenue_test_mode_rejected' }

  const asOf = new Date()
  const aggregates = computeRevenueAggregates({
    subscriptions: fetched.subscriptions || [],
    charges: fetched.charges || [],
    asOf,
    windowDays: 30,
  })
  if (aggregates.mrr < config.minMrr) return { ok: false, status: 422, error: 'revenue_below_threshold', detail: { mrr: aggregates.mrr, min_mrr: config.minMrr } }
  if (aggregates.paying_customers < config.minPayingCustomers) return { ok: false, status: 422, error: 'revenue_below_threshold', detail: { paying_customers: aggregates.paying_customers, min_paying_customers: config.minPayingCustomers } }

  const previous = await repo.latestRevenueSnapshot(userId, key)
  if (previous && previous.mrr > 0 && aggregates.mrr > previous.mrr * (1 + config.maxMrrJumpPct / 100)) {
    await repo.recordAnomaly({ id: createId('trust_anomaly'), userId, kind: 'revenue_implausible_growth', severity: 'warning', detail: { previous_mrr: previous.mrr, mrr: aggregates.mrr, max_jump_pct: config.maxMrrJumpPct }, createdAt: nowIso() })
    return { ok: false, status: 422, error: 'revenue_implausible_growth', detail: { previous_mrr: previous.mrr, mrr: aggregates.mrr } }
  }

  if (config.requireDomainMatch) {
    const domains = await verifiedDomains(userId)
    const claimed = normalizeDomain(fetched.accountDomain)
    if (!claimed || !domains.has(claimed)) return { ok: false, status: 422, error: 'revenue_domain_mismatch', detail: { account_domain: claimed, verified_domains: [...domains] } }
  }

  const now = nowIso()
  const expiresAt = new Date(asOf.getTime() + config.proofTtlDays * 86400000).toISOString()
  const metadata = revenueProofMetadata(aggregates, key, fetched.livemode, credentialSource)
  await repo.withTrustTransaction(async client => {
    await repo.revokeVerifiedProofs(userId, 'revenue', { client })
    await repo.insertRevenueSnapshot({
      id: createId('trust_revenue'), userId, provider: key, credentialId: credentialRow?.id || null,
      mrr: aggregates.mrr, arr: aggregates.arr, payingCustomers: aggregates.paying_customers,
      churnRate: aggregates.churn_rate, netRevenueRetention: aggregates.net_revenue_retention,
      grossMargin: aggregates.gross_margin, currency: aggregates.currency, livemode: fetched.livemode,
      asOf: aggregates.as_of, metrics: metadata, createdAt: now,
    }, { client })
  })
  if (credentialRow) await repo.markCredentialSynced(credentialRow.id, { mode: fetched.mode, subject: fetched.subject, accountDomain: fetched.accountDomain, metrics: metadata, verifiedAt: now })

  const proof = await appendTrustProof(userId, {
    source: 'revenue',
    status: 'verified',
    method: `${key}_readonly`,
    providerSubjectId: credentialSource === 'founder' ? (clean(fetched.subject, 200) || null) : null,
    confidence: 0.95,
    metadata,
    evidenceHash: hash({ provider: key, subject: fetched.subject, mrr: aggregates.mrr, arr: aggregates.arr, paying_customers: aggregates.paying_customers }),
    expiresAt,
    attestationLevel: 'provider_observed',
    correlationGroup: 'financials',
    metricWindow: 'p30d',
  })
  if (!proof.ok) return proof
  return { ok: true, provider: key, status: 'verified', aggregates, credential: describeCredential(key, { scopes: credentialRow ? credentialRow.scopes : [], mode: fetched.mode, created_at: credentialRow ? credentialRow.createdAt : null, last_synced_at: now }), verification: proof.proof, profile: proof.profile }
}

// Worker: refresh every credential whose sync window has elapsed.
export async function runRevenueRefresh({ env = process.env, fetchImpl, limit = 100 } = {}) {
  if (!writeAuthorityRequired()) return { ok: true, skipped: 'revenue_requires_postgres_authority' }
  const config = resolveRevenueConfig(env)
  if (!config.enabled) return { ok: true, skipped: 'revenue_disabled' }
  const due = await repo.listCredentialsDueForSync({ intervalMs: config.syncIntervalMs, limit })
  const results = []
  for (const row of due) {
    try {
      const result = await verifyRevenueSource(row.userId, row.provider, { env, fetchImpl })
      results.push({ userId: row.userId, provider: row.provider, ok: result.ok, error: result.error || null })
    } catch (error) {
      results.push({ userId: row.userId, provider: row.provider, ok: false, error: 'refresh_failed', detail: error.message })
    }
  }
  return { ok: true, refreshed: results.length, results }
}
