import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import crypto from 'node:crypto'
import { ensureTrustProfile } from './capabilityAuthorization.js'
import { issueExecutionGrant } from './usageGrantService.js'
import { analyzeVerificationEvidence } from './aiRouterClient.js'

const collections = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const roleName = value => String(value || '').toLowerCase() === 'organisation' ? 'organization' : String(value || '').toLowerCase()
const EVIDENCE_STRENGTH = Object.freeze({ VERY_STRONG: 5, STRONG: 4, MODERATE: 3, WEAK: 1, UNVERIFIED: 0, CONTRADICTED: -5 })
const METHOD_STRENGTH = Object.freeze({ email_domain: 'VERY_STRONG', dns: 'VERY_STRONG', manual: 'VERY_STRONG', institutional_credential: 'VERY_STRONG', official_document: 'STRONG', professional_profile: 'STRONG', investment_history: 'STRONG', organization_affiliation: 'STRONG', public_evidence: 'MODERATE', self_reported: 'WEAK' })

function userProfile(db, userId) { return collections(db, 'profiles').find(row => row.id === userId) || null }
function audit(db, payload) {
  const event = { id: createId('verification_audit'), policyVersion: 'trust-v1', createdAt: nowIso(), ...payload }
  const secret = process.env.VERIFICATION_AUDIT_HMAC_KEY || process.env.JWT_SECRET
  if (secret && secret.length >= 32) {
    const canonical = JSON.stringify(Object.keys(event).sort().reduce((out, key) => { out[key] = event[key]; return out }, {}))
    event.signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex')
  }
  collections(db, 'verificationAuditLogs').push(event)
}

function normalizedDomain(value) {
  if (!value) return null
  try { return new URL(String(value).includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
}

function calculateAssurance(evidence, profile, role) {
  const rows = evidence.filter(row => row.status !== 'rejected')
  const values = rows.map(row => EVIDENCE_STRENGTH[row.strength] || 0)
  const veryStrong = values.filter(value => value >= 5).length
  const strong = values.filter(value => value >= 4).length
  const contradictions = evidence.some(row => row.strength === 'CONTRADICTED' || row.status === 'contradicted')
  if (contradictions) return { assurance: 'PARTIALLY_VERIFIED', trustScore: Math.max(0, 25 - 20), reason: 'contradictory_evidence' }
  if (role === 'organization' && veryStrong >= 2 && strong >= 2) return { assurance: 'INSTITUTIONAL', trustScore: 95, reason: 'institutional_evidence' }
  if (veryStrong >= 1 && strong >= 2) return { assurance: 'TRUSTED', trustScore: 85, reason: 'corroborated_evidence' }
  if (veryStrong >= 1 || strong >= 2) return { assurance: 'VERIFIED', trustScore: 75, reason: 'sufficient_evidence' }
  if (strong >= 1 || values.some(value => value >= 3)) return { assurance: 'PARTIALLY_VERIFIED', trustScore: 55, reason: 'partial_evidence' }
  if (profile?.isOnboarded) return { assurance: 'PROFILED', trustScore: 25, reason: 'profile_only' }
  return { assurance: 'CLAIMED', trustScore: 10, reason: 'self_claimed' }
}

export function getVerificationProfile(userId, role) {
  const db = readAuthorityDb()
  const target = roleName(role)
  const profile = collections(db, 'verificationProfiles').find(row => row.userId === userId && (!target || roleName(row.role) === target))
  const evidence = collections(db, 'verificationEvidence').filter(row => row.userId === userId && (!target || roleName(row.role) === target))
  const requests = collections(db, 'verificationRequests').filter(row => row.userId === userId && (!target || roleName(row.role) === target))
  return { profile: profile || null, evidence, requests }
}

export function requestVerification(userId, body = {}) {
  const role = roleName(body.role)
  if (!['investor', 'organization'].includes(role)) return { ok: false, error: 'verification_role_unsupported' }
  return updateAuthorityDb(db => {
    const profile = userProfile(db, userId)
    if (!profile) return { ok: false, error: 'profile_not_found' }
    const existing = collections(db, 'verificationRequests').find(row => row.userId === userId && row.role === role && ['pending', 'in_review'].includes(row.status))
    if (existing) return { ok: true, idempotent: true, request: existing }
    const now = nowIso()
    const request = { id: createId('verification_request'), userId, role, claimType: String(body.claimType || 'role').slice(0, 80), status: 'pending', requestedCapability: body.requestedCapability || null, createdAt: now, updatedAt: now }
    collections(db, 'verificationRequests').push(request)
    const verification = collections(db, 'verificationProfiles').find(row => row.userId === userId && row.role === role) || { id: createId('verification_profile'), userId, role, assurance: 'PROFILED', trustScore: 25, createdAt: now }
    verification.status = 'in_review'; verification.updatedAt = now
    const profiles = collections(db, 'verificationProfiles')
    if (!profiles.some(row => row.id === verification.id)) profiles.push(verification)
    audit(db, { userId, role, action: 'verification_requested', previousState: 'CLAIMED', newState: 'PROFILED', requestId: request.id })
    return { ok: true, request, profile: verification }
  })
}

export function submitEvidence(userId, requestId, body = {}) {
  const method = String(body.method || '').toLowerCase()
  if (!METHOD_STRENGTH[method]) return { ok: false, error: 'unsupported_verification_method' }
  return updateAuthorityDb(db => {
    const request = collections(db, 'verificationRequests').find(row => row.id === requestId && row.userId === userId)
    if (!request) return { ok: false, error: 'verification_request_not_found' }
    const evidence = { id: createId('verification_evidence'), requestId, userId, role: request.role, method, strength: METHOD_STRENGTH[method], status: 'submitted', source: body.source || null, metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {}, submittedAt: nowIso() }
    collections(db, 'verificationEvidence').push(evidence)
    request.status = 'in_review'; request.updatedAt = nowIso()
    const all = collections(db, 'verificationEvidence').filter(row => row.userId === userId && row.role === request.role)
    const calculated = calculateAssurance(all, userProfile(db, userId), request.role)
    const profileRows = collections(db, 'verificationProfiles')
    const verification = profileRows.find(row => row.userId === userId && row.role === request.role) || { id: createId('verification_profile'), userId, role: request.role, createdAt: nowIso() }
    verification.assurance = calculated.assurance; verification.trustScore = calculated.trustScore; verification.evidenceQuality = calculated.reason; verification.updatedAt = nowIso()
    if (!profileRows.some(row => row.id === verification.id)) profileRows.push(verification)
    ensureTrustProfile(db, userId, request.role)
    audit(db, { userId, role: request.role, action: 'evidence_submitted', previousState: 'PROFILED', newState: calculated.assurance, evidenceId: evidence.id, requestId })
    return { ok: true, evidence, profile: verification }
  })
}

export async function analyzeEvidence(userId, token, requestId, body = {}) {
  const db = readAuthorityDb(); const request = collections(db, 'verificationRequests').find(row => row.id === requestId && row.userId === userId)
  if (!request) return { ok: false, error: 'verification_request_not_found' }
  const requestKey = `verification-analysis-${requestId}-${String(body.evidenceId || createId('evidence')).slice(-32)}`
  const grant = issueExecutionGrant({ userId, requestId: requestKey, taskType: 'evidence_research', estimatedCredits: 1, fundingSource: body.fundingSource || 'payg', maxInputTokens: 4000, maxOutputTokens: 1500 })
  if (!grant.ok) return grant
  const advisory = await analyzeVerificationEvidence(token, grant.grant.token, { role: request.role, claim: request.claimType, source: body.source, metadata: body.metadata, evidence_text: body.evidenceText })
  if (!advisory) return { ok: false, error: 'ai_advisory_unavailable' }
  return updateAuthorityDb(state => { const evidence = (state.verificationEvidence || []).find(row => row.id === body.evidenceId && row.userId === userId); if (evidence) { evidence.aiAdvisory = advisory; evidence.updatedAt = nowIso() }; return { ok: true, advisory, authorizationAuthority: false } })
}

export function reviewVerification(adminId, requestId, body = {}) {
  const decision = String(body.decision || '').toLowerCase()
  if (!['approve', 'reject', 'request_evidence', 'escalate'].includes(decision)) return { ok: false, error: 'invalid_review_decision' }
  return updateAuthorityDb(db => {
    const request = collections(db, 'verificationRequests').find(row => row.id === requestId)
    if (!request) return { ok: false, error: 'verification_request_not_found' }
    const old = collections(db, 'verificationProfiles').find(row => row.userId === request.userId && row.role === request.role) || { id: createId('verification_profile'), userId: request.userId, role: request.role, createdAt: nowIso() }
    const previousState = old.assurance || 'PROFILED'
    const next = decision === 'approve' ? (request.role === 'organization' ? 'TRUSTED' : 'VERIFIED') : decision === 'reject' ? 'CLAIMED' : old.assurance || 'PROFILED'
    old.assurance = next; old.status = decision === 'approve' ? 'verified' : decision === 'reject' ? 'rejected' : 'in_review'; old.verifiedBy = decision === 'approve' ? adminId : null; old.lastReviewedAt = nowIso(); old.expiresAt = decision === 'approve' ? new Date(Date.now() + 365 * 86400000).toISOString() : null; old.updatedAt = nowIso()
    const profiles = collections(db, 'verificationProfiles'); if (!profiles.some(row => row.id === old.id)) profiles.push(old)
    request.status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'in_review'; request.updatedAt = nowIso()
    collections(db, 'manualReviews').push({ id: createId('manual_review'), requestId, adminId, decision, note: String(body.note || '').slice(0, 1000), createdAt: nowIso() })
    audit(db, { userId: request.userId, role: request.role, action: 'verification_reviewed', previousState, newState: next, requestId, actorId: adminId, decision })
    ensureTrustProfile(db, request.userId, request.role)
    return { ok: true, request, profile: old }
  })
}

export function createOrganization(userId, body = {}) {
  return updateAuthorityDb(db => {
    const name = String(body.name || body.orgName || '').trim()
    if (!name) return { ok: false, error: 'organization_name_required' }
    const domain = normalizedDomain(body.website || body.domain || body.workEmail)
    const existingDomain = domain && collections(db, 'organizationDomains').find(row => row.domain === domain && row.status !== 'revoked')
    if (existingDomain) return { ok: false, error: 'organization_domain_already_claimed', organizationId: existingDomain.organizationId }
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const duplicate = collections(db, 'organizations').find(row => row.status !== 'revoked' && String(row.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === normalizedName && (!body.country || !row.country || String(row.country).toLowerCase() === String(body.country).toLowerCase()))
    if (duplicate) return { ok: false, error: 'organization_duplicate_detected', organizationId: duplicate.id }
    const now = nowIso()
    const org = { id: createId('organization'), name, website: body.website || '', country: body.country || '', type: body.type || body.orgType || 'other', status: 'claimed', createdBy: userId, createdAt: now, updatedAt: now }
    collections(db, 'organizations').push(org)
    if (domain) collections(db, 'organizationDomains').push({ id: createId('org_domain'), organizationId: org.id, domain, status: 'unverified', createdAt: now, updatedAt: now })
    collections(db, 'organizationMemberships').push({ id: createId('org_membership'), organizationId: org.id, userId, role: 'owner', status: 'active', verified: false, createdAt: now, updatedAt: now })
    return { ok: true, organization: org }
  })
}

export function claimOrganization(userId, organizationId, body = {}) {
  return updateAuthorityDb(db => {
    const organization = collections(db, 'organizations').find(row => row.id === organizationId)
    if (!organization) return { ok: false, error: 'organization_not_found' }
    const domain = normalizedDomain(body.domain || body.website || body.workEmail)
    if (domain) {
      const owner = collections(db, 'organizationDomains').find(row => row.domain === domain && row.organizationId !== organizationId && row.status !== 'revoked')
      if (owner) return { ok: false, error: 'organization_domain_already_claimed' }
    }
    const claim = { id: createId('organization_claim'), organizationId, userId, method: body.method || 'self_reported', domain, status: 'pending', createdAt: nowIso(), updatedAt: nowIso() }
    collections(db, 'organizationClaims').push(claim)
    return { ok: true, claim }
  })
}

export function organizationMemberships(userId, organizationId) {
  const db = readAuthorityDb()
  return collections(db, 'organizationMemberships').filter(row => row.userId === userId && (!organizationId || row.organizationId === organizationId))
}

export function addOrganizationMember(actorId, organizationId, body = {}) {
  return updateAuthorityDb(db => {
    const organization = collections(db, 'organizations').find(row => row.id === organizationId)
    const actor = collections(db, 'organizationMemberships').find(row => row.organizationId === organizationId && row.userId === actorId && row.status === 'active' && ['owner', 'admin'].includes(row.role))
    const target = collections(db, 'users').find(row => row.id === body.userId)
    if (!organization) return { ok: false, error: 'organization_not_found' }
    if (!actor) return { ok: false, error: 'organization_admin_required' }
    if (!target) return { ok: false, error: 'member_user_not_found' }
    const existing = collections(db, 'organizationMemberships').find(row => row.organizationId === organizationId && row.userId === target.id)
    if (existing) { existing.role = body.role || existing.role; existing.status = 'active'; existing.updatedAt = nowIso(); return { ok: true, membership: existing, idempotent: true } }
    const membership = { id: createId('org_membership'), organizationId, userId: target.id, role: body.role || 'member', status: 'active', verified: false, createdAt: nowIso(), updatedAt: nowIso() }
    collections(db, 'organizationMemberships').push(membership)
    return { ok: true, membership }
  })
}

export function updateRiskState(adminId, userId, state, note = '') {
  const allowed = new Set(['LOW', 'NORMAL', 'ELEVATED', 'HIGH', 'RESTRICTED'])
  const normalized = String(state || '').toUpperCase()
  if (!allowed.has(normalized)) return { ok: false, error: 'invalid_risk_state' }
  return updateAuthorityDb(db => {
    const rows = collections(db, 'riskProfiles')
    const existing = rows.find(row => row.userId === userId)
    const previousState = existing?.state || 'NORMAL'
    const row = existing || { id: createId('risk_profile'), userId, createdAt: nowIso() }
    Object.assign(row, { state: normalized, note: String(note).slice(0, 1000), updatedAt: nowIso(), updatedBy: adminId })
    if (!existing) rows.push(row)
    audit(db, { userId, action: 'risk_state_updated', actorId: adminId, previousState, newState: normalized, note: row.note })
    return { ok: true, risk: row }
  })
}

export function generateReverificationNotifications(at = new Date()) {
  return updateAuthorityDb(db => {
    const now = at.getTime(); const windows = [30, 14, 7, 1]; let created = 0
    for (const profile of collections(db, 'verificationProfiles')) {
      if (!profile.expiresAt) continue
      const days = Math.ceil((new Date(profile.expiresAt).getTime() - now) / 86400000)
      const window = windows.find(value => days <= value && days > value - 7)
      if (!window) continue
      const digestKey = `reverification:${profile.userId}:${profile.role}:${profile.expiresAt}:${window}`
      if (collections(db, 'notifications').some(row => row.metadata?.digestKey === digestKey)) continue
      collections(db, 'notifications').push({ id: createId('notif'), userId: profile.userId, type: 'verification', author: 'TechIT Trust', content: `Your ${profile.role} verification expires in ${Math.max(1, days)} day${days === 1 ? '' : 's'}. Renew it to keep affected capabilities.`, linkTo: `/verification/${profile.role}`, read: false, metadata: { digestKey, role: profile.role, expiresAt: profile.expiresAt }, createdAt: nowIso() }); created++
    }
    collections(db, 'verificationNotificationRuns').push({ id: createId('verification_notification_run'), created, runAt: nowIso() })
    return { ok: true, created }
  })
}

export function verificationAnalytics() {
  const db = readAuthorityDb(); const events = collections(db, 'capabilityAnalytics'); const decisions = collections(db, 'authorizationAuditLogs')
  const byCapability = {}
  for (const event of events) { const row = byCapability[event.capability] ||= { allowed: 0, denied: 0, completed: 0, released: 0 }; if (event.eventType === 'capability_allowed') row.allowed++; if (event.eventType === 'capability_denied') row.denied++; if (event.eventType === 'capability_completed') row.completed++; if (event.eventType === 'capability_released') row.released++ }
  return { generatedAt: nowIso(), requests: collections(db, 'verificationRequests').length, pendingReviews: collections(db, 'verificationRequests').filter(row => ['pending', 'in_review'].includes(row.status)).length, evidence: collections(db, 'verificationEvidence').length, decisions: decisions.length, byCapability }
}
