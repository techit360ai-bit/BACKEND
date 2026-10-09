// Team verification authority (WS6).
//
// Two invariants live here and are NOT env-tunable:
//   1. A work-email proof is only minted for an address on a domain the founder
//      already proved ownership of (domain/website/organization proof).
//   2. Only provider-observed reads may mint verified team/organization proofs;
//      client-supplied headcount/roles can never reach the verified path.
//
// Emails are sent via Resend when RESEND_API_KEY is set; otherwise the OTP is
// only returned when TRUST_TEAM_OTP_DEV_MODE=true (never in production).

import crypto from 'node:crypto'
import { createId, nowIso } from '../utils/api.js'
import * as repo from '../repositories/trustRepository.js'
import { trustCore } from './trustVerificationAuthority.js'
import { appendTrustProof } from './trustAuthority.js'
import { normalizeEmail } from '../utils/authInputs.js'
import {
  findRegistryProvider,
  findHrisProvider,
  resolveTeamConfig,
  resolveWorkEmailAvailability,
  resolveRegistryProvider,
  resolveHrisProvider,
  platformRegistryCredential,
  platformHrisCredential,
} from '../config/trustTeamSources.js'
import { credentialVaultConfigured, decryptCredential, encryptCredential, describeCredential } from './trustCredentialVault.js'
import { fetchProviderRegistry, fetchProviderHris } from './trustTeamAdapter.js'

const { hash, normalizeDomain, clean } = trustCore
const CREDENTIAL_SOURCE = 'team'

function writeAuthorityRequired() {
  return process.env.TRUST_WRITE_SOURCE === 'postgres'
}

function otpSecret(env) {
  const secret = String(env.TRUST_TEAM_OTP_HASH_SECRET || env.OTP_HASH_SECRET || env.JWT_SECRET || '').trim()
  return secret || null
}

export function hashWorkEmailCode(code, challengeSalt, env = process.env) {
  const secret = otpSecret(env) || challengeSalt
  return crypto.createHmac('sha256', String(secret)).update(`${String(code).trim()}:${challengeSalt}`).digest('hex')
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function verifiedDomains(userId) {
  const proofs = await repo.listProofs(userId)
  const now = Date.now()
  return new Set(proofs
    .filter(proof => proof.status === 'verified' && (!proof.expiresAt || new Date(proof.expiresAt).getTime() > now))
    .filter(proof => proof.source === 'domain' || proof.source === 'website' || proof.source === 'organization')
    .map(proof => normalizeDomain(proof.metadata?.domain || proof.metadata?.website || proof.metadata?.url))
    .filter(Boolean))
}

async function sendWorkEmailOtp(email, code, { env }) {
  if (env.TRUST_TEAM_OTP_DEV_MODE === true || String(env.TRUST_TEAM_OTP_DEV_MODE || '').toLowerCase() === 'true') return { delivered: false, dev_code: code }
  const apiKey = String(env.RESEND_API_KEY || '').trim()
  if (!apiKey) return { delivered: false, error: 'work_email_provider_not_configured' }
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const from = String(env.FROM_EMAIL || 'TechIT <onboarding@resend.dev>').trim()
    const result = await resend.emails.send({ from, to: email, subject: 'Verify your work email for TechIT', text: `Your TechIT work-email verification code is ${code}. It expires shortly.` })
    if (result?.error) return { delivered: false, error: 'work_email_send_failed' }
    return { delivered: true }
  } catch {
    return { delivered: false, error: 'work_email_send_failed' }
  }
}

export async function requestWorkEmailChallenge(userId, input = {}, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'team_requires_postgres_authority' }
  const availability = resolveWorkEmailAvailability(env)
  if (availability.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: availability.availability_reason }
  if (!otpSecret(env)) return { ok: false, status: 503, error: 'work_email_otp_not_configured' }
  const email = normalizeEmail(input.email)
  if (!email) return { ok: false, status: 400, error: 'work_email_invalid' }
  const emailDomain = normalizeDomain(email.split('@')[1])
  if (!emailDomain) return { ok: false, status: 400, error: 'work_email_invalid' }

  const domains = await verifiedDomains(userId)
  if (!domains.has(emailDomain)) return { ok: false, status: 422, error: 'work_email_domain_not_verified', detail: { email_domain: emailDomain, verified_domains: [...domains] } }

  const config = resolveTeamConfig(env)
  const previous = await repo.latestWorkEmailChallenge(userId, emailDomain)
  if (previous && previous.status === 'pending' && Date.now() - new Date(previous.createdAt).getTime() < config.otpResendCooldownSeconds * 1000) {
    return { ok: false, status: 429, error: 'work_email_resend_too_soon', detail: { retry_after_seconds: config.otpResendCooldownSeconds } }
  }

  const id = createId('trust_work_email')
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  const now = nowIso()
  const challenge = await repo.insertWorkEmailChallenge({
    id, userId, email, emailDomain, role: clean(input.role, 80) || null,
    tokenHash: hashWorkEmailCode(code, id, env), status: 'pending', attempts: 0, maxAttempts: config.otpMaxAttempts,
    expiresAt: new Date(Date.now() + config.otpTtlMinutes * 60000).toISOString(), createdAt: now, updatedAt: now,
  })
  const delivery = await sendWorkEmailOtp(email, code, { env })
  if (delivery.error) return { ok: false, status: 502, error: delivery.error }
  return {
    ok: true,
    challenge: { id: challenge.id, email_domain: emailDomain, role: challenge.role, status: 'pending', expires_at: challenge.expiresAt, max_attempts: config.otpMaxAttempts },
    ...(delivery.dev_code ? { dev_code: delivery.dev_code } : {}),
  }
}

export async function verifyWorkEmailChallenge(userId, input = {}, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'team_requires_postgres_authority' }
  const challengeId = String(input.challengeId || '').trim()
  const code = String(input.code || '').trim()
  if (!challengeId || !code) return { ok: false, status: 400, error: 'work_email_challenge_and_code_required' }
  const challenge = await repo.getWorkEmailChallenge(challengeId)
  if (!challenge || challenge.userId !== userId) return { ok: false, status: 404, error: 'work_email_challenge_not_found' }
  if (challenge.status !== 'pending') return { ok: false, status: 409, error: 'work_email_challenge_not_pending' }
  if (new Date(challenge.expiresAt).getTime() < Date.now()) { await repo.updateWorkEmailChallenge(challenge.id, { status: 'expired' }); return { ok: false, status: 410, error: 'work_email_challenge_expired' } }

  const expected = hashWorkEmailCode(code, challenge.id, env)
  if (!safeEqual(expected, challenge.tokenHash)) {
    const attempts = challenge.attempts + 1
    await repo.updateWorkEmailChallenge(challenge.id, { attempts, status: attempts >= challenge.maxAttempts ? 'failed' : 'pending' })
    return { ok: false, status: 401, error: 'work_email_code_invalid', detail: { attempts, max_attempts: challenge.maxAttempts } }
  }

  // Re-check the domain at verification time (hard invariant).
  const domains = await verifiedDomains(userId)
  if (!domains.has(challenge.emailDomain)) return { ok: false, status: 422, error: 'work_email_domain_not_verified', detail: { email_domain: challenge.emailDomain, verified_domains: [...domains] } }

  const config = resolveTeamConfig(env)
  const now = nowIso()
  await repo.updateWorkEmailChallenge(challenge.id, { status: 'verified', verifiedAt: now })
  const metadata = {
    provider: 'work_email', credentialSource: 'founder', workEmailVerified: true, emailDomain: challenge.emailDomain,
    role: challenge.role || null, verifiedCount: 1, asOf: now, freshnessHours: 0, method: 'work_email_otp',
  }
  await repo.withTrustTransaction(async client => {
    await repo.insertTeamSnapshot({ id: createId('trust_team'), userId, provider: 'work_email', kind: 'work_email', entityName: null, headcount: 1, roles: [], asOf: now, freshnessHours: 0, metrics: metadata, createdAt: now }, { client })
  })
  const proof = await appendTrustProof(userId, {
    source: 'team', status: 'verified', method: 'work_email_otp', confidence: 0.85, metadata,
    evidenceHash: hash({ userId, emailDomain: challenge.emailDomain, challengeId: challenge.id }),
    expiresAt: new Date(Date.now() + config.proofTtlDays * 86400000).toISOString(),
    attestationLevel: 'provider_observed', correlationGroup: 'org',
  })
  if (!proof.ok) return proof
  return { ok: true, status: 'verified', profile: proof.profile, verification: proof.proof }
}

export async function connectTeamSource(userId, input = {}, { env = process.env } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'team_requires_postgres_authority' }
  const kind = String(input.kind || '').trim().toLowerCase() === 'registry' ? 'registry' : 'hris'
  const provider = String(input.provider || '').trim().toLowerCase()
  const resolved = kind === 'registry' ? resolveRegistryProvider(provider, env) : resolveHrisProvider(provider, env)
  const known = kind === 'registry' ? findRegistryProvider(provider) : findHrisProvider(provider)
  if (!known) return { ok: false, status: 404, error: kind === 'registry' ? 'unsupported_registry_provider' : 'unsupported_hris_provider' }
  if (resolved.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: resolved.availability_reason }
  if (!credentialVaultConfigured(env)) return { ok: false, status: 503, error: 'credential_vault_not_configured' }
  const credential = String(input.credential || input.token || '').trim()
  if (!credential) return { ok: false, status: 400, error: 'credential_required' }
  const subject = clean(input.subject || input.companyNumber || input.companyId || input.organizationId, 200) || null
  const now = nowIso()
  const row = await repo.upsertCredential({
    id: createId('trust_credential'), userId, provider, source: CREDENTIAL_SOURCE,
    encryptedPayload: encryptCredential(credential, { env }), scopes: ['read_only'], status: 'active', subject,
    createdAt: now, updatedAt: now,
  }, { env })
  return { ok: true, kind, credential: describeCredential(provider, { scopes: row.scopes, created_at: row.createdAt }) }
}

export async function listTeamCredentials(userId) {
  if (!writeAuthorityRequired()) return { ok: true, credentials: [] }
  const rows = await repo.listActiveCredentials(userId)
  return { ok: true, credentials: rows.filter(row => row.source === CREDENTIAL_SOURCE).map(row => describeCredential(row.provider, { scopes: row.scopes, created_at: row.createdAt, last_synced_at: row.lastSyncedAt })) }
}

export async function disconnectTeamSource(userId, provider) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'team_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  await repo.revokeCredential(userId, key)
  await repo.withTrustTransaction(async client => {
    for (const source of ['team', 'organization']) {
      const revoked = await repo.revokeVerifiedProofs(userId, source, { client })
      for (const proof of revoked) {
        await repo.insertHistory({ id: createId('trust_event'), verificationId: proof.id, userId, projectId: proof.projectId, source, status: 'revoked', confidence: proof.confidence, metadataHash: proof.evidenceHash, eventType: 'trust_revoked', createdAt: nowIso(), expiresAt: proof.expiresAt }, { client })
      }
    }
  })
  return { ok: true, provider: key, status: 'disconnected' }
}

export async function verifyRegistrySource(userId, provider, input = {}, { env = process.env, fetchImpl } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'team_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  const resolved = resolveRegistryProvider(key, env)
  if (!findRegistryProvider(key)) return { ok: false, status: 404, error: 'unsupported_registry_provider' }
  if (resolved.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: resolved.availability_reason }

  const credentialRow = await repo.getActiveCredential(userId, key)
  let credential = credentialRow ? decryptCredential(credentialRow.encryptedPayload, { env }) : null
  let credentialSource = credentialRow ? 'founder' : null
  let subject = credentialRow?.subject || null
  if (!credential) {
    const platform = platformRegistryCredential(key, env)
    if (platform) { credential = platform; credentialSource = 'platform' }
  }
  if (!credential) return { ok: false, status: 409, error: 'team_credential_not_connected' }
  if (!subject) subject = clean(input.companyNumber || input.subject, 200) || null

  const fetched = await fetchProviderRegistry(key, credential, { env, fetchImpl, subject, founderName: input.founderName })
  if (!fetched.ok) return fetched
  if (!fetched.entityExists || !fetched.entity) return { ok: false, status: 422, error: 'registry_entity_not_found' }
  if (!fetched.founderIsOfficer) {
    await repo.recordAnomaly({ id: createId('trust_anomaly'), userId, kind: 'registry_officer_mismatch', severity: 'warning', detail: { provider: key, company_number: fetched.entity.companyNumber }, createdAt: nowIso() })
    return { ok: false, status: 422, error: 'registry_officer_not_found', detail: { entity: fetched.entity.name } }
  }

  const config = resolveTeamConfig(env)
  const now = nowIso()
  const metadata = {
    provider: key, credentialSource, entityName: fetched.entity.name, companyNumber: fetched.entity.companyNumber,
    jurisdiction: fetched.entity.jurisdiction, entityExists: true, officerVerified: true, asOf: now, freshnessHours: 0,
  }
  await repo.withTrustTransaction(async client => {
    await repo.insertTeamSnapshot({ id: createId('trust_team'), userId, provider: key, kind: 'registry', credentialId: credentialRow?.id || null, entityName: fetched.entity.name, companyNumber: fetched.entity.companyNumber, jurisdiction: fetched.entity.jurisdiction, asOf: now, freshnessHours: 0, metrics: metadata, createdAt: now }, { client })
  })
  if (credentialRow) await repo.markCredentialSynced(credentialRow.id, { subject: fetched.subject, metrics: metadata, verifiedAt: now })

  const proof = await appendTrustProof(userId, {
    source: 'organization', status: 'verified', method: `${key}_registry`,
    providerSubjectId: credentialSource === 'founder' ? (clean(fetched.subject, 200) || null) : null,
    confidence: 0.9, metadata, evidenceHash: hash({ provider: key, companyNumber: fetched.entity.companyNumber, officer: true }),
    expiresAt: new Date(Date.now() + config.proofTtlDays * 86400000).toISOString(),
    attestationLevel: 'provider_observed', correlationGroup: 'org',
  })
  if (!proof.ok) return proof
  return { ok: true, provider: key, status: 'verified', entity: fetched.entity, profile: proof.profile, verification: proof.proof }
}

export async function verifyHrisSource(userId, provider, { env = process.env, fetchImpl } = {}) {
  if (!writeAuthorityRequired()) return { ok: false, status: 503, error: 'team_requires_postgres_authority' }
  const key = String(provider || '').trim().toLowerCase()
  const resolved = resolveHrisProvider(key, env)
  if (!findHrisProvider(key)) return { ok: false, status: 404, error: 'unsupported_hris_provider' }
  if (resolved.availability !== 'available') return { ok: false, status: 409, error: 'trust_source_coming_soon', reason: resolved.availability_reason }

  const credentialRow = await repo.getActiveCredential(userId, key)
  let credential = credentialRow ? decryptCredential(credentialRow.encryptedPayload, { env }) : null
  let credentialSource = credentialRow ? 'founder' : null
  const subject = credentialRow?.subject || null
  if (!credential) {
    const platform = platformHrisCredential(key, env)
    if (platform) { credential = platform; credentialSource = 'platform' }
  }
  if (!credential) return { ok: false, status: 409, error: 'team_credential_not_connected' }

  const fetched = await fetchProviderHris(key, credential, { env, fetchImpl, subject })
  if (!fetched.ok) return fetched
  const config = resolveTeamConfig(env)
  if (Number(fetched.headcount || 0) < config.minHeadcount) return { ok: false, status: 422, error: 'team_below_threshold', detail: { headcount: fetched.headcount, min_headcount: config.minHeadcount } }

  const previous = await repo.latestTeamSnapshot(userId, 'hris', key)
  if (previous && previous.headcount > 0 && Number(fetched.headcount) > previous.headcount * config.maxHeadcountJumpRatio) {
    await repo.recordAnomaly({ id: createId('trust_anomaly'), userId, kind: 'team_implausible_growth', severity: 'warning', detail: { previous_headcount: previous.headcount, headcount: fetched.headcount, max_ratio: config.maxHeadcountJumpRatio }, createdAt: nowIso() })
    return { ok: false, status: 422, error: 'team_implausible_growth', detail: { previous_headcount: previous.headcount, headcount: fetched.headcount } }
  }

  const now = nowIso()
  const roles = (fetched.roles || []).slice(0, 10).map(entry => `${entry.role}:${entry.count}`)
  const metadata = { provider: key, credentialSource, headcount: fetched.headcount, verifiedCount: fetched.headcount, roles, asOf: now, freshnessHours: 0 }
  await repo.withTrustTransaction(async client => {
    await repo.insertTeamSnapshot({ id: createId('trust_team'), userId, provider: key, kind: 'hris', credentialId: credentialRow?.id || null, headcount: fetched.headcount, roles: fetched.roles || [], asOf: now, freshnessHours: 0, metrics: metadata, createdAt: now }, { client })
  })
  if (credentialRow) await repo.markCredentialSynced(credentialRow.id, { subject: fetched.subject, metrics: metadata, verifiedAt: now })

  const proof = await appendTrustProof(userId, {
    source: 'team', status: 'verified', method: `${key}_hris`,
    providerSubjectId: credentialSource === 'founder' ? (clean(fetched.subject, 200) || null) : null,
    confidence: 0.9, metadata, evidenceHash: hash({ provider: key, headcount: fetched.headcount, subject: fetched.subject }),
    expiresAt: new Date(Date.now() + config.proofTtlDays * 86400000).toISOString(),
    attestationLevel: 'provider_observed', correlationGroup: 'org',
  })
  if (!proof.ok) return proof
  return { ok: true, provider: key, status: 'verified', headcount: fetched.headcount, roles: fetched.roles, profile: proof.profile, verification: proof.proof }
}

export async function runTeamRefresh({ env = process.env, fetchImpl, limit = 100 } = {}) {
  if (!writeAuthorityRequired()) return { ok: true, skipped: 'team_requires_postgres_authority' }
  const config = resolveTeamConfig(env)
  if (!config.enabled) return { ok: true, skipped: 'team_disabled' }
  const due = await repo.listCredentialsDueForSync({ intervalMs: config.syncIntervalMs, limit })
  const results = []
  for (const row of due) {
    if (row.source !== CREDENTIAL_SOURCE) continue
    try {
      const result = findRegistryProvider(row.provider)
        ? await verifyRegistrySource(row.userId, row.provider, {}, { env, fetchImpl })
        : await verifyHrisSource(row.userId, row.provider, { env, fetchImpl })
      results.push({ userId: row.userId, provider: row.provider, ok: result.ok, error: result.error || null })
    } catch (error) {
      results.push({ userId: row.userId, provider: row.provider, ok: false, error: 'refresh_failed', detail: error.message })
    }
  }
  return { ok: true, refreshed: results.length, results }
}
