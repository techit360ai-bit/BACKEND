import { previewTrustSurfaceNotifications } from '../services/trustSurfaceService.js'
import { appendTrustProof, beginProviderVerification, createDomainProofChallenge, disconnectTrustSource, publicTrustFor, reviewTrustProof, trustHistoryFor, trustOperations, verifyDomainProofChallenge } from '../services/trustAuthority.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { safeFetch } from '../services/outboundHttpService.js'
import { findTrustSourceByProvider, listTrustSources } from '../config/trustSources.js'
import { getTrustRefreshPlan, inviteTrustTeamMember, previewTrustShareProfile, runTrustContinuousVerification, verifyTrustAdapter, verifyTrustTeamMember } from '../services/trustAdapterClient.js'
import { connectRevenueSource, disconnectRevenueSource, listRevenueCredentials, runRevenueRefresh, verifyRevenueSource } from '../services/trustRevenueService.js'
import { connectAnalyticsSource, disconnectAnalyticsSource, listAnalyticsCredentials, runAnalyticsRefresh, verifyAnalyticsSource } from '../services/trustAnalyticsService.js'
import { connectShippingSource, disconnectShippingSource, listShippingCredentials, runShippingRefresh, verifyShippingSource } from '../services/trustShippingService.js'
import { connectTeamSource, disconnectTeamSource, listTeamCredentials, requestWorkEmailChallenge, runTeamRefresh, verifyHrisSource, verifyRegistrySource, verifyWorkEmailChallenge } from '../services/trustTeamService.js'
import { createMilestoneEvidenceUpload, finalizeMilestoneEvidence, listMilestones, reviewMilestoneProof, submitMilestone } from '../services/trustMilestoneService.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

export async function profile(req, res) { return res.json(await publicTrustFor(req.user.id, req.query.projectId || null)) }
export async function badges(req, res) { const profile = await publicTrustFor(req.user.id, req.query.projectId || null); return res.json({ badges: profile.signals.map(source => ({ badge_type: source, label: source.replace(/_/g, ' '), source: source.replace(/_verified$/, ''), status: 'verified', active: true })), active_badges: profile.signals, privacy: 'metadata_only' }) }
export async function history(req, res) { return res.json({ history: await trustHistoryFor(req.user.id, req.query.limit), append_only: true, privacy: 'metadata_only' }) }
export async function integrations(req, res) {
  let connected = new Set()
  try {
    const history = await trustHistoryFor(req.user.id, 100)
    connected = new Set(history.filter(row => row.status === 'verified').map(row => row.source))
  } catch { /* history is best-effort; availability is still returned */ }
  return res.json({
    integrations: listTrustSources().map(entry => ({
      provider: entry.provider,
      source: entry.source,
      display_name: entry.display_name,
      category: entry.category,
      auth_method: entry.auth_method,
      scopes: [],
      sync_frequency_seconds: 86400,
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
    })),
  })
}
export async function refresh(req, res) { return res.json(await beginProviderVerification(req.user.id, String(req.params.source).toLowerCase())) }
export async function verify(req, res) { return res.json(await beginProviderVerification(req.user.id, String(req.params.source).toLowerCase())) }
export async function disconnect(req, res) { return res.json(await disconnectTrustSource(req.user.id, String(req.params.source).toLowerCase())) }
export function notificationsPreview(req, res) { return res.json(previewTrustSurfaceNotifications(req.user.id)) }
export async function domainChallenge(req, res) { const result = await createDomainProofChallenge(req.user.id, req.body || {}); return result.ok ? res.status(201).json(result) : res.status(400).json(result) }
export async function domainVerify(req, res) { const result = await verifyDomainProofChallenge(req.user.id, req.params.challengeId); return result.ok ? res.json(result) : res.status(result.error === 'challenge_not_found' ? 404 : 400).json(result) }
export async function proofSubmit(req, res) { const result = await appendTrustProof(req.user.id, { ...req.body, status: 'pending', method: 'user_submitted' }); return result.ok ? res.status(201).json(result) : res.status(400).json(result) }
export async function operations(_req, res) { return res.json(await trustOperations()) }
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
  const entry = findTrustSourceByProvider(String(req.params.provider || ''))
  if (!entry) return res.status(404).json({ error: 'trust_provider_unknown' })
  const userId = String(req.body?.userId || req.body?.user_id || '').trim()
  if (!userId) return res.status(400).json({ error: 'user_id_required' })
  const userToken = String(req.get('x-techit-user-token') || '').trim()
  const result = await verifyTrustAdapter(entry.provider, req.body?.payload || req.body?.metadata || {}, { token: userToken })
  if (!result.ok) return res.status(result.status && result.status < 500 ? result.status : 502).json({ error: result.error })
  const normalized = result.data || {}
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
  const db = readAuthorityDb(); const entry = (db.linkedinOauthStates || []).find(row => row.state === state && new Date(row.createdAt).getTime() > Date.now() - 10 * 60 * 1000); if (!entry) return res.status(400).json({ error: 'linkedin_state_invalid' })
  updateAuthorityDb(current => { current.linkedinOauthStates = (current.linkedinOauthStates || []).filter(row => row.state !== state); return current })
  const clientId = process.env.LINKEDIN_CLIENT_ID; const clientSecret = process.env.LINKEDIN_CLIENT_SECRET; const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${process.env.PUBLIC_API_URL || 'http://localhost:3000'}/api/trust/linkedin/callback`
  if (!clientId || !clientSecret) return res.redirect(`${FRONTEND_URL}/founder/trust?linkedin=manual_review_required`)
  try {
    const tokenResponse = await safeFetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }) }, { schemes: ['https'], allowHosts: ['www.linkedin.com'] })
    const tokenPayload = await tokenResponse.json().catch(() => ({})); if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error('linkedin_token_exchange_failed')
    const profileResponse = await safeFetch('https://api.linkedin.com/v2/userinfo', { headers: { authorization: `Bearer ${tokenPayload.access_token}`, accept: 'application/json' } }, { schemes: ['https'], allowHosts: ['api.linkedin.com'] })
    const profile = await profileResponse.json().catch(() => ({})); if (!profileResponse.ok || !profile.sub) throw new Error('linkedin_profile_lookup_failed')
    updateAuthorityDb(current => { const connections = current.linkedinConnections || []; current.linkedinConnections = [...connections.filter(row => row.userId !== entry.userId), { id: `li_${profile.sub}`, userId: entry.userId, providerSubjectId: String(profile.sub), connectedAt: nowIso(), status: 'connected' }]; return current })
    appendTrustProof(entry.userId, { source: 'linkedin', method: 'linkedin_oidc', status: 'verified', providerSubjectId: String(profile.sub), confidence: 0.96, metadata: { providerSubjectId: String(profile.sub), username: cleanLinkedinName(profile), profileUrl: typeof profile.profile === 'string' ? profile.profile : '' } })
    return res.redirect(`${FRONTEND_URL}/founder/trust?linkedin=connected`)
  } catch { return res.redirect(`${FRONTEND_URL}/founder/trust?linkedin=manual_review_required`) }
}

function cleanLinkedinName(profile) { return [profile.given_name, profile.family_name].filter(value => typeof value === 'string').join(' ').slice(0, 160) }
