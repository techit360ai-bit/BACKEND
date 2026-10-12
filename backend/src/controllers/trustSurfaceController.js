import { previewTrustSurfaceNotificationsAsync } from '../services/trustSurfaceService.js'
import { appendTrustProof, beginProviderVerification, createDomainProofChallenge, disconnectTrustSource, publicTrustFor, reviewTrustProof, trustHistoryFor, trustOperations, trustProofsFor, verifyDomainProofChallenge } from '../services/trustAuthority.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { linkedinStoreEnabled, linkedinFallbackEnabled, consumeLinkedinOauthState, saveLinkedinConnection } from '../repositories/linkedinRepository.js'
import { safeFetch } from '../services/outboundHttpService.js'
import { findTrustSourceByProvider, listTrustSources } from '../config/trustSources.js'
import { getTrustRefreshPlan, inviteTrustTeamMember, previewTrustShareProfile, runTrustContinuousVerification, verifyTrustAdapter, verifyTrustTeamMember } from '../services/trustAdapterClient.js'
import { connectRevenueSource, disconnectRevenueSource, listRevenueCredentials, runRevenueRefresh, verifyRevenueSource } from '../services/trustRevenueService.js'
import { connectAnalyticsSource, disconnectAnalyticsSource, listAnalyticsCredentials, runAnalyticsRefresh, verifyAnalyticsSource } from '../services/trustAnalyticsService.js'
import { connectShippingSource, disconnectShippingSource, listShippingCredentials, runShippingRefresh, verifyShippingSource } from '../services/trustShippingService.js'
import { connectTeamSource, disconnectTeamSource, listTeamCredentials, requestWorkEmailChallenge, runTeamRefresh, verifyHrisSource, verifyRegistrySource, verifyWorkEmailChallenge } from '../services/trustTeamService.js'
import { createMilestoneEvidenceUpload, finalizeMilestoneEvidence, listMilestones, reviewMilestoneProof, submitMilestone } from '../services/trustMilestoneService.js'
import { connectIdentitySource, disconnectIdentitySource, listIdentity, listIdentityCredentials, listSanctionsScreening, runIdentityRefresh, runSanctionsScreening, verifyBusinessRegistry, verifyIdentity } from '../services/trustIdentityService.js'
import { runTrustReverificationTick, trustReverificationDueAsync } from '../services/trustReverificationService.js'
import { applyTrustOverride, listTrustOverrides, revokeTrustOverride } from '../services/trustOverrideService.js'
import { syncIntervalMsFor } from '../config/trustSyncIntervals.js'
import { incTrustMetric, observeTrustLatency } from '../services/trustMetrics.js'
import { trustObservabilitySnapshot } from '../services/trustObservability.js'
import { trustPrometheusText } from '../services/trustMetricsPrometheus.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

export async function profile(req, res) { return res.json(await publicTrustFor(req.user.id, req.query.projectId || null)) }
// WS10: latest proof metadata is safe for the owner and lets the Trust Center
// show confidence / attestation / expiry per badge instead of a bare "verified".
const PROVIDER_ATTESTATION = new Set(['provider_observed', 'third_party_attested'])
export function latestProofBySource(proofs = []) {
  const map = new Map()
  for (const proof of proofs) {
    const source = String(proof.source || '')
    if (source && !map.has(source)) map.set(source, proof)
  }
  return map
}
export function proofDetail(proof) {
  if (!proof) return { confidence: null, attestation_level: 'self', issued_at: null, expires_at: null, status: null, metrics: null, manual_review: false }
  const attested = PROVIDER_ATTESTATION.has(String(proof.attestationLevel || ''))
  const expired = proof.expiresAt ? new Date(proof.expiresAt).getTime() <= Date.now() : false
  return {
    status: expired && proof.status === 'verified' ? 'expired' : proof.status,
    confidence: typeof proof.confidence === 'number' ? proof.confidence : null,
    attestation_level: proof.attestationLevel || 'self',
    issued_at: proof.verifiedAt || proof.createdAt || null,
    expires_at: proof.expiresAt || null,
    // Metrics are only ever present for provider-observed proofs (the metadata
    // allow-list strips them otherwise), so this is consented by construction.
    metrics: attested && proof.metadata && Object.keys(proof.metadata).length ? proof.metadata : null,
    manual_review: Boolean(proof.reviewNote) || proof.status === 'rejected',
  }
}
export async function badges(req, res) {
  const projectId = req.query.projectId || null
  const [profile, proofs] = await Promise.all([publicTrustFor(req.user.id, projectId), trustProofsFor(req.user.id, projectId)])
  const latest = latestProofBySource(proofs)
  const badges = profile.signals.map(source => {
    const base = source.replace(/_verified$/, '')
    const detail = proofDetail(latest.get(base))
    return {
      badge_type: source,
      label: source.replace(/_/g, ' '),
      source: base,
      status: detail.status || 'verified',
      active: detail.status ? detail.status === 'verified' : true,
      ...detail,
    }
  })
  return res.json({ badges, active_badges: profile.signals, privacy: 'metadata_only' })
}
export async function history(req, res) { return res.json({ history: await trustHistoryFor(req.user.id, req.query.limit), append_only: true, privacy: 'metadata_only' }) }
export async function integrations(req, res) {
  const projectId = req.query.projectId || null
  let connected = new Set()
  let latest = new Map()
  try {
    const history = await trustHistoryFor(req.user.id, 100)
    connected = new Set(history.filter(row => row.status === 'verified').map(row => row.source))
  } catch { /* history is best-effort; availability is still returned */ }
  try {
    latest = latestProofBySource(await trustProofsFor(req.user.id, projectId))
  } catch { /* proof detail is best-effort; the manifest still renders */ }
  return res.json({
    integrations: listTrustSources().map(entry => {
      const detail = proofDetail(latest.get(entry.source))
      return {
        provider: entry.provider,
        source: entry.source,
        display_name: entry.display_name,
        category: entry.category,
        auth_method: entry.auth_method,
        scopes: [],
        sync_frequency_seconds: Math.round(syncIntervalMsFor(entry.source) / 1000),
        stored_fields: ['status', 'metadata_hash', 'timestamps'],
        forbidden_fields: ['tokens', 'raw_payload'],
        access_description: 'Backend-observed proof only.',
        storage_description: 'Normalized proof metadata and hashes only.',
        token_policy: 'Encrypted server-side only.',
        revocation_supported: true,
        manual_reverification_supported: true,
        raw_payload_stored: false,
        availability: entry.availability,
        availability_reason: entry.availability_reason,
        coming_soon: entry.availability !== 'available',
        connected: connected.has(entry.source),
        latest_proof: detail.status ? detail : null,
      }
    }),
  })
}
export async function refresh(req, res) { return res.json(await beginProviderVerification(req.user.id, String(req.params.source).toLowerCase())) }
export async function verify(req, res) { return res.json(await beginProviderVerification(req.user.id, String(req.params.source).toLowerCase())) }
export async function disconnect(req, res) { return res.json(await disconnectTrustSource(req.user.id, String(req.params.source).toLowerCase())) }
export async function notificationsPreview(req, res) { return res.json(await previewTrustSurfaceNotificationsAsync(req.user.id)) }
export async function domainChallenge(req, res) { const result = await createDomainProofChallenge(req.user.id, req.body || {}); return result.ok ? res.status(201).json(result) : res.status(400).json(result) }
export async function domainVerify(req, res) { const result = await verifyDomainProofChallenge(req.user.id, req.params.challengeId); return result.ok ? res.json(result) : res.status(result.error === 'challenge_not_found' ? 404 : 400).json(result) }
export async function proofSubmit(req, res) { const result = await appendTrustProof(req.user.id, { ...req.body, status: 'pending', method: 'user_submitted' }); return result.ok ? res.status(201).json(result) : res.status(400).json(result) }
export async function operations(_req, res) { return res.json(await trustOperations()) }
export async function metrics(_req, res) { return res.json(await trustObservabilitySnapshot()) }
export async function trustMetricsProm(_req, res) { return res.type('text/plain; version=0.0.4; charset=utf-8').send(await trustPrometheusText()) }
export async function proofReview(req, res) { const result = await reviewTrustProof(req.user.id, req.params.proofId, req.body || {}); return result.ok ? res.json(result) : res.status(result.status || 400).json(result) }

// Founder-initiated connect. It NEVER mints a verified proof from caller input:
// adapter normalization trusts supplied metadata, so only the service-auth
// ingest path below may create verified proofs.
export async function adapterConnect(req, res) {
  const entry = findTrustSourceByProvider(String(req.params.provider || ''))
  if (!entry) return res.status(404).json({ error: 'trust_provider_unknown' })
  if (entry.availability !== 'available') return res.status(409).json({ ok: false, error: 'trust_source_coming_soon', provider: entry.provider, reason: entry.availability_reason })
  const result = await appendTrustProof(req.user.id, { source: entry.source, status: 'pending', method: `${entry.provider}_connect`, metadata: { provider: entry.provider } })
  return result.ok ? res.status(202).json({ ok: true, provider: entry.provider, status: 'pending', verification: result.proof, next_action: 'Awaiting server-observed provider data.' }) : res.status(400).json(result)
}

// Service-authenticated ingest for trusted verification workers. The worker has
// already fetched provider data; the AI-router adapter normalizes it (dropping
// forbidden fields) before the authority persists a proof.
export async function internalAdapterIngest(req, res) {
  const startedAt = Date.now()
  const entry = findTrustSourceByProvider(String(req.params.provider || ''))
  if (!entry) return res.status(404).json({ error: 'trust_provider_unknown' })
  const userId = String(req.body?.userId || req.body?.user_id || '').trim()
  if (!userId) return res.status(400).json({ error: 'user_id_required' })
  const userToken = String(req.get('x-techit-user-token') || '').trim()
  incTrustMetric('trust_adapter_attempts_total', { provider: entry.provider })
  const result = await verifyTrustAdapter(entry.provider, req.body?.payload || req.body?.metadata || {}, { token: userToken })
  if (!result.ok) {
    incTrustMetric('trust_adapter_failures_total', { provider: entry.provider, reason: result.error || 'adapter_error' })
    observeTrustLatency('trust_adapter_ms', Date.now() - startedAt)
    return res.status(result.status && result.status < 500 ? result.status : 502).json({ error: result.error })
  }
  const normalized = result.data || {}
  observeTrustLatency('trust_adapter_ms', Date.now() - startedAt)
  const rawStatus = String(normalized.status || 'pending').toLowerCase()
  const status = rawStatus === 'verified' ? 'verified' : rawStatus === 'failed' ? 'failed' : 'pending'
  const proof = await appendTrustProof(userId, {
    source: entry.source,
    status,
    method: `${entry.provider}_adapter`,
    confidence: normalized.confidence,
    metadata: normalized.metadata || {},
    evidenceHash: normalized.metadata_hash,
    expiresAt: normalized.expires_at,
    attestationLevel: 'provider_observed',
  })
  return res.json({ ok: true, provider: entry.provider, adapter: normalized, verification: proof.proof })
}


// --- WS3 revenue verification ---
// `connect` accepts a founder read-only credential and stores it encrypted; it
// never mints a proof. `verify` is the only path that mints a verified revenue
// proof and only after a server-observed provider read.
export async function revenueConnect(req, res) {
  const result = await connectRevenueSource(req.user.id, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function revenueVerify(req, res) {
  const provider = String(req.body?.provider || req.params.provider || '').toLowerCase()
  const result = await verifyRevenueSource(req.user.id, provider)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function revenueCredentials(req, res) {
  return res.json(await listRevenueCredentials(req.user.id))
}

export async function revenueDisconnect(req, res) {
  const result = await disconnectRevenueSource(req.user.id, req.params.provider)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

// Service-authenticated worker trigger for the 24h refresh cadence.
export async function revenueRefreshWorker(req, res) {
  const result = await runRevenueRefresh({ limit: Number(req.body?.limit) || 100 })
  return res.json(result)
}


// --- WS4 product analytics verification ---
export async function analyticsConnect(req, res) {
  const result = await connectAnalyticsSource(req.user.id, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function analyticsVerify(req, res) {
  const provider = String(req.body?.provider || req.params.provider || '').toLowerCase()
  const result = await verifyAnalyticsSource(req.user.id, provider)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function analyticsCredentials(req, res) {
  return res.json(await listAnalyticsCredentials(req.user.id))
}

export async function analyticsDisconnect(req, res) {
  const result = await disconnectAnalyticsSource(req.user.id, req.params.provider)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function analyticsRefreshWorker(req, res) {
  const result = await runAnalyticsRefresh({ limit: Number(req.body?.limit) || 100 })
  return res.json(result)
}

// --- WS5 shipping / deployment cadence verification ---
export async function shippingConnect(req, res) {
  const result = await connectShippingSource(req.user.id, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function shippingVerify(req, res) {
  const provider = String(req.body?.provider || req.params.provider || '').toLowerCase()
  const result = await verifyShippingSource(req.user.id, provider)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function shippingCredentials(req, res) {
  return res.json(await listShippingCredentials(req.user.id))
}

export async function shippingDisconnect(req, res) {
  const result = await disconnectShippingSource(req.user.id, req.params.provider)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function shippingRefreshWorker(req, res) {
  const result = await runShippingRefresh({ limit: Number(req.body?.limit) || 100 })
  return res.json(result)
}

// --- WS6 team / work-email / registry / HRIS verification ---
export async function teamWorkEmailChallenge(req, res) {
  const result = await requestWorkEmailChallenge(req.user.id, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function teamWorkEmailVerify(req, res) {
  const result = await verifyWorkEmailChallenge(req.user.id, req.body || {})
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function teamConnect(req, res) {
  const result = await connectTeamSource(req.user.id, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function teamCredentials(req, res) {
  return res.json(await listTeamCredentials(req.user.id))
}

export async function teamRegistryVerify(req, res) {
  const provider = String(req.body?.provider || req.params.provider || '').toLowerCase()
  const result = await verifyRegistrySource(req.user.id, provider, req.body || {})
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function teamHrisVerify(req, res) {
  const provider = String(req.body?.provider || req.params.provider || '').toLowerCase()
  const result = await verifyHrisSource(req.user.id, provider)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function teamDisconnect(req, res) {
  const result = await disconnectTeamSource(req.user.id, req.params.provider)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function teamRefreshWorker(req, res) {
  const result = await runTeamRefresh({ limit: Number(req.body?.limit) || 100 })
  return res.json(result)
}

export async function refreshPlan(req, res) {
  const result = await getTrustRefreshPlan(req.body || {}, { token: req.user?.token })
  return result.ok ? res.json(result.data) : res.status(502).json({ error: result.error })
}

export async function continuousVerification(req, res) {
  const result = await runTrustContinuousVerification(req.body || {}, { token: req.user?.token })
  return result.ok ? res.json(result.data) : res.status(502).json({ error: result.error })
}

export async function milestoneList(req, res) {
  const result = await listMilestones(req.user.id)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function milestoneEvidenceUpload(req, res) {
  const entry = findTrustSourceByProvider('milestone')
  if (entry && entry.availability !== 'available') return res.status(409).json({ ok: false, error: 'trust_source_coming_soon', reason: entry.availability_reason })
  const result = await createMilestoneEvidenceUpload(req.user.id, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function milestoneEvidenceFinalize(req, res) {
  const result = await finalizeMilestoneEvidence(req.user.id, req.params.evidenceId)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function milestoneSubmit(req, res) {
  const entry = findTrustSourceByProvider('milestone')
  if (entry && entry.availability !== 'available') return res.status(409).json({ ok: false, error: 'trust_source_coming_soon', reason: entry.availability_reason })
  const result = await submitMilestone(req.user.id, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function milestoneReview(req, res) {
  const proofId = req.params.proofId || req.body?.proofId || req.body?.proof_id
  const result = await reviewMilestoneProof(req.user.id, proofId, req.body || {})
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function identityList(req, res) {
  const result = await listIdentity(req.user.id)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function identityConnect(req, res) {
  const entry = findTrustSourceByProvider('identity')
  if (entry && entry.availability !== 'available') return res.status(409).json({ ok: false, error: 'trust_source_coming_soon', reason: entry.availability_reason })
  const result = await connectIdentitySource(req.user.id, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function identityCredentials(req, res) {
  const result = await listIdentityCredentials(req.user.id)
  return res.json(result)
}

export async function identityVerify(req, res) {
  const entry = findTrustSourceByProvider('identity')
  if (entry && entry.availability !== 'available') return res.status(409).json({ ok: false, error: 'trust_source_coming_soon', reason: entry.availability_reason })
  const result = await verifyIdentity(req.user.id, req.body || {})
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function identityRegistryVerify(req, res) {
  const entry = findTrustSourceByProvider('identity')
  if (entry && entry.availability !== 'available') return res.status(409).json({ ok: false, error: 'trust_source_coming_soon', reason: entry.availability_reason })
  const result = await verifyBusinessRegistry(req.user.id, req.body || {})
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function identityScreeningRun(req, res) {
  const result = await runSanctionsScreening(req.user.id, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function identityScreeningList(req, res) {
  const result = await listSanctionsScreening(req.user.id)
  return res.json(result)
}

export async function identityDisconnect(req, res) {
  const result = await disconnectIdentitySource(req.user.id, req.params.provider || req.body?.provider)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function identityRefreshWorker(req, res) {
  const result = await runIdentityRefresh()
  return res.json(result)
}

export async function teamInvite(req, res) {
  const entry = findTrustSourceByProvider('team')
  if (entry && entry.availability !== 'available') return res.status(409).json({ ok: false, error: 'trust_source_coming_soon', reason: entry.availability_reason })
  const result = await inviteTrustTeamMember(req.body || {}, { token: req.user?.token })
  return result.ok ? res.json(result.data) : res.status(502).json({ error: result.error })
}

export async function teamVerify(req, res) {
  const entry = findTrustSourceByProvider('team')
  if (entry && entry.availability !== 'available') return res.status(409).json({ ok: false, error: 'trust_source_coming_soon', reason: entry.availability_reason })
  const result = await verifyTrustTeamMember(req.body || {}, { token: req.user?.token })
  return result.ok ? res.json(result.data) : res.status(502).json({ error: result.error })
}

export async function shareProfilePreview(req, res) {
  const result = await previewTrustShareProfile(req.body || {}, { token: req.user?.token })
  return result.ok ? res.json(result.data) : res.status(502).json({ error: result.error })
}

export async function linkedinCallback(req, res) {
  const { code, state } = req.query; if (!code || !state) return res.status(400).json({ error: 'linkedin_callback_invalid' })
  const consumeFromSnapshot = () => {
    const db = readAuthorityDb()
    const entry = (db.linkedinOauthStates || []).find(row => row.state === state && new Date(row.createdAt).getTime() > Date.now() - 10 * 60 * 1000)
    if (entry) updateAuthorityDb(current => { current.linkedinOauthStates = (current.linkedinOauthStates || []).filter(row => row.state !== state); return current })
    return entry || null
  }
  let entry
  if (linkedinStoreEnabled()) {
    try { entry = await consumeLinkedinOauthState(state) } catch (error) {
      console.error(JSON.stringify({ event: 'linkedin_postgres_read_failed', error: error.message }))
      if (!linkedinFallbackEnabled()) throw error
      entry = consumeFromSnapshot()
    }
  } else entry = consumeFromSnapshot()
  if (!entry) return res.status(400).json({ error: 'linkedin_state_invalid' })
  const clientId = process.env.LINKEDIN_CLIENT_ID; const clientSecret = process.env.LINKEDIN_CLIENT_SECRET; const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${process.env.PUBLIC_API_URL || 'http://localhost:3000'}/api/trust/linkedin/callback`
  if (!clientId || !clientSecret) return res.redirect(`${FRONTEND_URL}/founder/trust?linkedin=manual_review_required`)
  try {
    const tokenResponse = await safeFetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }) }, { schemes: ['https'], allowHosts: ['www.linkedin.com'] })
    const tokenPayload = await tokenResponse.json().catch(() => ({})); if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error('linkedin_token_exchange_failed')
    const profileResponse = await safeFetch('https://api.linkedin.com/v2/userinfo', { headers: { authorization: `Bearer ${tokenPayload.access_token}`, accept: 'application/json' } }, { schemes: ['https'], allowHosts: ['api.linkedin.com'] })
    const profile = await profileResponse.json().catch(() => ({})); if (!profileResponse.ok || !profile.sub) throw new Error('linkedin_profile_lookup_failed')
    const connection = { id: `li_${profile.sub}`, userId: entry.userId, providerSubjectId: String(profile.sub), connectedAt: nowIso(), status: 'connected' }
    const saveToSnapshot = () => updateAuthorityDb(current => { const connections = current.linkedinConnections || []; current.linkedinConnections = [...connections.filter(row => row.userId !== entry.userId), connection]; return current })
    if (linkedinStoreEnabled()) {
      try { await saveLinkedinConnection(connection) } catch (error) {
        console.error(JSON.stringify({ event: 'linkedin_postgres_write_failed', error: error.message }))
        if (!linkedinFallbackEnabled()) throw error
        saveToSnapshot()
      }
    } else saveToSnapshot()
    appendTrustProof(entry.userId, { source: 'linkedin', method: 'linkedin_oidc', status: 'verified', providerSubjectId: String(profile.sub), confidence: 0.96, metadata: { providerSubjectId: String(profile.sub), username: cleanLinkedinName(profile), profileUrl: typeof profile.profile === 'string' ? profile.profile : '' } })
    return res.redirect(`${FRONTEND_URL}/founder/trust?linkedin=connected`)
  } catch { return res.redirect(`${FRONTEND_URL}/founder/trust?linkedin=manual_review_required`) }
}

// --- WS9 continuous re-verification / decay (scheduler + service worker) ---
export async function reverificationRun(req, res) {
  const result = await runTrustReverificationTick({ limit: Number(req.body?.limit) || 200 })
  return res.json(result)
}

export async function reverificationDue(_req, res) {
  return res.json(await trustReverificationDueAsync())
}

// --- WS9 manual score overrides (admin-only; reason code + expiry mandatory) ---
export async function overrideApply(req, res) {
  const userId = String(req.body?.userId || req.body?.user_id || '').trim()
  const result = await applyTrustOverride(req.user.id, userId, req.body || {})
  return result.ok ? res.status(201).json(result) : res.status(result.status || 400).json(result)
}

export async function overrideRevoke(req, res) {
  const userId = String(req.params.userId || req.query.userId || '').trim()
  const result = await revokeTrustOverride(req.user.id, userId, req.params.overrideId)
  return result.ok ? res.json(result) : res.status(result.status || 400).json(result)
}

export async function overrideList(req, res) {
  return res.json(await listTrustOverrides(String(req.params.userId || req.query.userId || '')))
}

function cleanLinkedinName(profile) { return [profile.given_name, profile.family_name].filter(value => typeof value === 'string').join(' ').slice(0, 160) }
