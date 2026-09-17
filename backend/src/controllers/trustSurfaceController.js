import { previewTrustSurfaceNotifications } from '../services/trustSurfaceService.js'
import { appendTrustProof, beginProviderVerification, createDomainProofChallenge, disconnectTrustSource, publicTrustFor, reviewTrustProof, trustHistoryFor, trustOperations, verifyDomainProofChallenge } from '../services/trustVerificationAuthority.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { safeFetch } from '../services/outboundHttpService.js'

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

export function profile(req, res) { return res.json(publicTrustFor(req.user.id, req.query.projectId || null)) }
export function badges(req, res) { const profile = publicTrustFor(req.user.id, req.query.projectId || null); return res.json({ badges: profile.signals.map(source => ({ badge_type: source, label: source.replace(/_/g, ' '), source: source.replace(/_verified$/, ''), status: 'verified', active: true })), active_badges: profile.signals, privacy: 'metadata_only' }) }
export function history(req, res) { return res.json({ history: trustHistoryFor(req.user.id, req.query.limit), append_only: true, privacy: 'metadata_only' }) }
export function integrations(_req, res) { return res.json({ integrations: ['email', 'phone', 'github', 'linkedin', 'domain', 'website', 'organization', 'deployment', 'product_analytics', 'team', 'milestone'].map(source => ({ provider: source, source, display_name: source.replace(/_/g, ' '), auth_method: ['github', 'linkedin'].includes(source) ? 'oauth2' : source === 'domain' || source === 'website' ? 'challenge' : 'backend_adapter', scopes: [], sync_frequency_seconds: 86400, stored_fields: ['status', 'metadata_hash', 'timestamps'], forbidden_fields: ['tokens', 'raw_payload'], access_description: 'Backend-observed proof only.', storage_description: 'Normalized proof metadata and hashes only.', token_policy: 'Encrypted server-side only.', revocation_supported: true, manual_reverification_supported: true, raw_payload_stored: false })) }) }
export function refresh(req, res) { return res.json(beginProviderVerification(req.user.id, String(req.params.source).toLowerCase())) }
export function verify(req, res) { return res.json(beginProviderVerification(req.user.id, String(req.params.source).toLowerCase())) }
export function disconnect(req, res) { return res.json(disconnectTrustSource(req.user.id, String(req.params.source).toLowerCase())) }
export function notificationsPreview(req, res) { return res.json(previewTrustSurfaceNotifications(req.user.id)) }
export function domainChallenge(req, res) { const result = createDomainProofChallenge(req.user.id, req.body || {}); return result.ok ? res.status(201).json(result) : res.status(400).json(result) }
export async function domainVerify(req, res) { const result = await verifyDomainProofChallenge(req.user.id, req.params.challengeId); return result.ok ? res.json(result) : res.status(result.error === 'challenge_not_found' ? 404 : 400).json(result) }
export function proofSubmit(req, res) { const result = appendTrustProof(req.user.id, { ...req.body, status: 'pending', method: 'user_submitted' }); return result.ok ? res.status(201).json(result) : res.status(400).json(result) }
export function operations(_req, res) { return res.json(trustOperations()) }
export function proofReview(req, res) { const result = reviewTrustProof(req.user.id, req.params.proofId, req.body || {}); return result.ok ? res.json(result) : res.status(result.status || 400).json(result) }

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
