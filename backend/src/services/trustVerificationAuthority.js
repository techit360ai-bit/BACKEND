import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import { createId, nowIso } from '../utils/api.js'
import * as database from '../config/database.js'
import { safeFetch } from './outboundHttpService.js'
import { GITHUB_OAUTH_SCOPES_TRUST } from '../config/github.js'

const readAuthorityDb = (...args) => database.readDb(...args)
const updateAuthorityDb = mutator => {
  try { if (typeof database.updateDb === 'function') return database.updateDb(mutator) } catch {}
  const db = database.readDb()
  const result = mutator(db)
  return result
}

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const clean = (value, max = 240) => typeof value === 'string' ? value.replace(/[<>\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value || {})).digest('hex')
const token = () => crypto.randomBytes(32).toString('base64url')
const normalizeDomain = value => { try { return new URL(String(value).includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '') } catch { return null } }
// Canonical Trust Engine policy. The AI-router validates signed projections
// against the same values, while the Node authority remains the source of
// truth for proof lifecycle and score mutations.
const sourceWeights = Object.freeze({ email: 10, phone: 10, github: 15, github_activity: 5, linkedin: 10, domain: 15, website: 15, organization: 10, deployment: 15, product_analytics: 10, team: 10, milestone: 5 })
const supportedSources = new Set(Object.keys(sourceWeights))

function actorOwnsProfile(db, userId) { return rows(db, 'profiles').some(row => row.id === userId) || rows(db, 'users').some(row => row.id === userId) }
function activeProofs(db, userId, projectId = null) {
  const now = Date.now()
  return rows(db, 'trustVerificationProofs').filter(row => row.userId === userId && (!projectId || row.projectId == null || row.projectId === projectId) && row.status === 'verified' && (!row.expiresAt || new Date(row.expiresAt).getTime() > now))
}
function publicMetadata(source, metadata = {}) {
  const allowed = ['providerSubjectId', 'username', 'profileUrl', 'repoCount', 'commitCount', 'contributorCount', 'languages', 'domain', 'method', 'verifiedAt', 'skill', 'evidenceType', 'sourceProjectId']
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => allowed.includes(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value))).map(([key, value]) => [key, Array.isArray(value) ? value.slice(0, 30).map(item => clean(String(item), 80)) : typeof value === 'string' ? clean(value) : value]))
}

export function trustScoreFor(db, userId, projectId = null) {
  const proofs = activeProofs(db, userId, projectId)
  const verifiedProofIds = new Set(proofs.map(row => row.id))
  const verifiedSkills = rows(db, 'verifiedSkills').filter(row => row.userId === userId && row.status === 'verified' && (!projectId || row.projectId == null || row.projectId === projectId) && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now()) && (row.source === 'admin_review' || (row.proofId && verifiedProofIds.has(row.proofId))))
  const breakdown = {}; const signals = []; let score = 0
  for (const proof of proofs) {
    let points = Number(sourceWeights[proof.source] || proof.points || 0)
    const metadata = proof.metadata || {}
    if (proof.source === 'product_analytics') points = Math.min(sourceWeights.product_analytics, (Math.max(Number(metadata.mau || 0), Number(metadata.dau || 0)) / 500) * 10)
    if (proof.source === 'team') points = Math.min(sourceWeights.team, Number(metadata.verifiedCount || metadata.count || 1) * 2.5)
    if (proof.source === 'milestone') points = Math.min(sourceWeights.milestone, Number(metadata.count || 1) * 1.25)
    if (!points || breakdown[proof.source]) continue
    breakdown[proof.source] = points; score += points; signals.push(`${proof.source}_verified`)
    if (proof.source === 'github') { const activity = Math.min(sourceWeights.github_activity, Number(proof.metadata?.repoCount || 0) * 0.5 + Number(proof.metadata?.commitCount || 0) * 0.01 + Number(proof.metadata?.contributorCount || 0) * 0.25); if (activity > 0) { breakdown.github_activity = Math.round(activity * 100) / 100; score += activity; signals.push('github_activity') } }
    if (proof.source === 'deployment') { const bonus = Math.min(5, Number(proof.metadata?.deployments30d || 0) * 0.5); if (bonus > 0) { breakdown.deployment_activity = bonus; score += bonus; signals.push('deployment_activity') } }
  }
  const skillPoints = Math.min(20, verifiedSkills.reduce((sum, row) => sum + Math.min(4, Number(row.confidence || 0.5) * 4), 0))
  if (skillPoints > 0) { breakdown.verified_skills = Math.round(skillPoints * 100) / 100; score += skillPoints; signals.push('verified_skills') }
  const trustScore = Math.min(100, Math.round(score * 100) / 100)
  const tier = trustScore >= 80 ? 'Highly Trusted' : trustScore >= 60 ? 'Verified' : trustScore >= 30 ? 'Building' : 'Claimed'
  return { trustScore, tier, verificationStatus: trustScore > 0 ? 'verified' : 'unverified', breakdown, signals, proofCount: proofs.length, verifiedSkillCount: verifiedSkills.length }
}

export function appendTrustProof(userId, input = {}) {
  const source = clean(input.source, 60).toLowerCase()
  if (!supportedSources.has(source)) return { ok: false, error: 'unsupported_trust_source' }
  const result = updateAuthorityDb(db => {
    if (!actorOwnsProfile(db, userId)) return { ok: false, error: 'profile_not_found' }
    const status = input.status === 'verified' ? 'verified' : input.status === 'failed' ? 'failed' : 'pending'
    const now = nowIso(); const proof = { id: createId('trust_proof'), userId, projectId: clean(input.projectId, 120) || null, source, method: clean(input.method || 'backend_adapter', 80), providerSubjectId: clean(input.providerSubjectId, 200) || null, status, confidence: Math.max(0, Math.min(1, Number(input.confidence ?? (status === 'verified' ? 0.95 : 0.5)))), points: Number(sourceWeights[source] || 0), metadata: publicMetadata(source, input.metadata), evidenceHash: clean(input.evidenceHash, 128) || hash({ source, userId, metadata: publicMetadata(source, input.metadata) }), expiresAt: input.expiresAt || new Date(Date.now() + (source === 'github' ? 86400000 : source === 'linkedin' ? 30 : 90) * 86400000).toISOString(), verifiedAt: status === 'verified' ? now : null, createdAt: now, updatedAt: now }
    rows(db, 'trustVerificationProofs').push(proof)
    rows(db, 'trustVerificationHistory').push({ id: createId('trust_event'), verificationId: proof.id, userId, projectId: proof.projectId, source, status, confidence: proof.confidence, metadataHash: proof.evidenceHash, eventType: `trust_${status}`, createdAt: now, expiresAt: proof.expiresAt })
    const score = trustScoreFor(db, userId, proof.projectId)
    const profile = rows(db, 'trustProfiles').find(row => row.userId === userId) || { id: createId('trust'), userId, createdAt: now }
    Object.assign(profile, { trustScore: score.trustScore, assurance: score.tier, verificationStatus: score.verificationStatus, breakdown: score.breakdown, signals: score.signals, updatedAt: now })
    if (!rows(db, 'trustProfiles').some(row => row.id === profile.id)) rows(db, 'trustProfiles').push(profile)
    rows(db, 'trustScoreSnapshots').push({ id: createId('trust_snapshot'), userId, projectId: proof.projectId, score: score.trustScore, tier: score.tier, breakdown: score.breakdown, policyVersion: 'trust-v2', createdAt: now })
    rows(db, 'trustProjectionOutbox').push({ id: createId('trust_projection'), type: 'trust.updated', userId, projectId: proof.projectId, proofId: proof.id, score, createdAt: now, deliveredAt: null })
    return { ok: true, proof: { ...proof, metadata: proof.metadata }, profile: trustProfileFor(db, userId, proof.projectId) }
  })
  if (result.ok) import('./trustProjectionService.js').then(({ publishTrustProjection }) => publishTrustProjection(userId, result.proof.projectId)).catch(() => {})
  return result
}

export function addVerifiedSkill(userId, input = {}) {
  const skill = clean(input.skill, 100).toLowerCase()
  if (!skill) return { ok: false, error: 'skill_required' }
  const result = updateAuthorityDb(db => {
    const proof = input.proofId && rows(db, 'trustVerificationProofs').find(row => row.id === input.proofId && row.userId === userId && row.status === 'verified')
    if (!proof && input.source !== 'admin_review') return { ok: false, error: 'verified_proof_required' }
    const now = nowIso(); const existing = rows(db, 'verifiedSkills').find(row => row.userId === userId && row.skill === skill && row.status === 'verified')
    const row = existing || { id: createId('verified_skill'), userId, projectId: clean(input.projectId, 120) || null, skill, status: 'verified', createdAt: now }
    Object.assign(row, { source: clean(input.source || proof?.source || 'admin_review', 80), proofId: proof?.id || input.proofId || null, confidence: Math.max(0, Math.min(1, Number(input.confidence ?? proof?.confidence ?? 0.75))), evidenceHash: clean(input.evidenceHash || proof?.evidenceHash, 128) || hash({ userId, skill }), expiresAt: input.expiresAt || proof?.expiresAt || new Date(Date.now() + 180 * 86400000).toISOString(), updatedAt: now })
    if (!existing) rows(db, 'verifiedSkills').push(row)
    return { ok: true, skill: row }
  })
  if (result.ok) import('./trustProjectionService.js').then(({ publishTrustProjection }) => publishTrustProjection(userId, result.skill.projectId)).catch(() => {})
  return result
}

export function trustProfileFor(db, userId, projectId = null) {
  const score = trustScoreFor(db, userId, projectId)
  return { userId, projectId, trust_score: score.trustScore, tier: score.tier, verification_status: score.verificationStatus, confidence_score: Math.round(score.trustScore) / 100, breakdown: score.breakdown, signals: score.signals, verified_skill_count: score.verifiedSkillCount, proof_count: score.proofCount, last_sync_at: rows(db, 'trustVerificationProofs').filter(row => row.userId === userId).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]?.updatedAt || null, privacy: { metadata_only: true, raw_payload_stored: false, secrets_stored: false } }
}

export function publicTrustFor(userId, projectId = null, sourceDb = null) { const db = sourceDb || readAuthorityDb(); const trust = trustProfileFor(db, userId, projectId); const activeProofIds = new Set(activeProofs(db, userId, projectId).map(row => row.id)); const skills = rows(db, 'verifiedSkills').filter(row => row.userId === userId && row.status === 'verified' && (!projectId || row.projectId == null || row.projectId === projectId) && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now()) && (row.source === 'admin_review' || (row.proofId && activeProofIds.has(row.proofId)))).map(row => ({ skill: row.skill, source: row.source, confidence: row.confidence, verifiedAt: row.updatedAt, expiresAt: row.expiresAt })); return { ...trust, verifiedSkills: skills } }

export function trustHistoryFor(userId, limit = 50) { const db = readAuthorityDb(); return rows(db, 'trustVerificationHistory').filter(row => row.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, Math.min(100, Math.max(1, Number(limit) || 50))) }

export function createDomainProofChallenge(userId, input = {}) {
  return updateAuthorityDb(db => { const domain = normalizeDomain(input.domain || input.website); if (!domain) return { ok: false, error: 'domain_invalid' }; const plaintextToken = token(); const challenge = { id: createId('trust_domain'), userId, domain, tokenHash: hash(plaintextToken), recordName: `_techit-verification.${domain}`, method: input.method === 'https' ? 'https' : 'dns_txt', status: 'pending', expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: nowIso(), updatedAt: nowIso() }; rows(db, 'trustVerificationChallenges').push(challenge); const publicChallenge = { ...challenge, tokenHash: undefined }; return { ok: true, challenge: publicChallenge, token: plaintextToken, instructions: challenge.method === 'https' ? `Publish the token at https://${domain}/.well-known/techit-verification.txt.` : `Publish the token as a TXT value at ${challenge.recordName}.` } })
}

export async function verifyDomainProofChallenge(userId, challengeId) {
  const db = readAuthorityDb(); const challenge = rows(db, 'trustVerificationChallenges').find(row => row.id === challengeId && row.userId === userId); if (!challenge) return { ok: false, error: 'challenge_not_found' }; if (new Date(challenge.expiresAt).getTime() <= Date.now()) return updateAuthorityDb(state => { const row = rows(state, 'trustVerificationChallenges').find(item => item.id === challengeId); row.status = 'expired'; row.updatedAt = nowIso(); return { ok: false, error: 'challenge_expired' } }); let verified = false
  if (challenge.method === 'dns_txt') { try { const values = (await dns.resolveTxt(challenge.recordName)).flat().map(value => String(value).trim()); verified = values.some(value => hash(value) === challenge.tokenHash) } catch {} }
  if (challenge.method === 'https') { try { const response = await safeFetch(`https://${challenge.domain}/.well-known/techit-verification.txt`, { signal: AbortSignal.timeout(10000) }, { schemes: ['https'], allowHosts: [challenge.domain] }); if (response.ok) { const body = (await response.text()).slice(0, 4096); verified = body.split(/\s+/).some(value => hash(value.trim()) === challenge.tokenHash) || body.includes(challenge.tokenHash) } } catch {} }
  if (!verified) return updateAuthorityDb(state => { const row = rows(state, 'trustVerificationChallenges').find(item => item.id === challengeId); row.lastCheckedAt = nowIso(); row.status = 'pending'; row.updatedAt = nowIso(); return { ok: true, verified: false, challenge: { ...row, token: undefined } } })
  const proof = appendTrustProof(userId, { source: challenge.method === 'dns_txt' ? 'domain' : 'website', method: challenge.method, status: 'verified', confidence: 0.98, metadata: { domain: challenge.domain, method: challenge.method }, evidenceHash: challenge.tokenHash })
  return updateAuthorityDb(state => { const row = rows(state, 'trustVerificationChallenges').find(item => item.id === challengeId); row.status = 'verified'; row.updatedAt = nowIso(); return { ok: true, verified: true, proof: proof.proof, challenge: { ...row, token: undefined } } })
}

export function beginProviderVerification(userId, source) { const state = token(); return updateAuthorityDb(db => { if (!supportedSources.has(source)) return { ok: false, error: 'unsupported_trust_source' }; if (source === 'github' || source === 'linkedin') { const configured = source === 'github' ? Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) : Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET); if (!configured) return { ok: true, status: 'manual_review_required', manualReviewRequired: true, next_action: `${source} credentials are not configured; submit private evidence for admin review.` }; rows(db, `${source}OauthStates`).push({ state, userId, createdAt: nowIso(), purpose: 'trust' }); const base = source === 'github' ? 'https://github.com/login/oauth/authorize' : 'https://www.linkedin.com/oauth/v2/authorization'; const params = new URLSearchParams(source === 'github' ? { client_id: process.env.GITHUB_CLIENT_ID, redirect_uri: process.env.GITHUB_REDIRECT_URI || '', scope: GITHUB_OAUTH_SCOPES_TRUST, state } : { response_type: 'code', client_id: process.env.LINKEDIN_CLIENT_ID, redirect_uri: process.env.LINKEDIN_REDIRECT_URI || '', scope: process.env.LINKEDIN_SCOPES || 'openid profile email', state }); return { ok: true, status: 'pending', authorizationUrl: `${base}?${params}`, next_action: `Complete ${source} authorization to create a server-observed proof.` } } return { ok: true, status: 'pending', next_action: source === 'domain' || source === 'website' ? 'Create a domain or website challenge.' : 'Submit provider evidence for review.' } }) }

export function disconnectTrustSource(userId, source) { return updateAuthorityDb(db => { const now = nowIso(); const proofs = rows(db, 'trustVerificationProofs').filter(row => row.userId === userId && row.source === source && row.status === 'verified'); for (const proof of proofs) { proof.status = 'revoked'; proof.updatedAt = now } const score = trustScoreFor(db, userId); return { ok: true, source, status: 'disconnected', confidence: 0, persisted: true, profile: trustProfileFor(db, userId), score } }) }

export function trustOperations() { const db = readAuthorityDb(); return { proofs: rows(db, 'trustVerificationProofs').map(row => ({ ...row, metadata: publicMetadata(row.source, row.metadata) })), skills: rows(db, 'verifiedSkills'), challenges: rows(db, 'trustVerificationChallenges').map(row => ({ ...row, token: undefined, tokenHash: undefined })), history: rows(db, 'trustVerificationHistory') } }

export function reviewTrustProof(adminId, proofId, body = {}) { const decision = clean(body.decision || body.status, 40).toLowerCase(); if (!['verified', 'rejected', 'expired'].includes(decision)) return { ok: false, status: 400, error: 'invalid_proof_review_status' }; const result = updateAuthorityDb(db => { const row = rows(db, 'trustVerificationProofs').find(item => item.id === proofId); if (!row) return { ok: false, status: 404, error: 'trust_proof_not_found' }; const previousStatus = row.status; row.status = decision; row.reviewedBy = adminId; row.reviewedAt = nowIso(); row.reviewNote = clean(body.note, 1000); row.verifiedAt = decision === 'verified' ? (row.verifiedAt || nowIso()) : null; row.updatedAt = nowIso(); rows(db, 'manualReviews').push({ id: createId('manual_review'), operationKind: 'trust_proof', operationId: proofId, adminId, decision, note: row.reviewNote, createdAt: nowIso() }); rows(db, 'trustVerificationHistory').push({ id: createId('trust_event'), verificationId: row.id, userId: row.userId, projectId: row.projectId, source: row.source, status: decision, confidence: row.confidence, metadataHash: row.evidenceHash, eventType: `trust_${decision}`, createdAt: nowIso(), expiresAt: row.expiresAt }); const score = trustScoreFor(db, row.userId, row.projectId); const profile = rows(db, 'trustProfiles').find(item => item.userId === row.userId && (item.projectId || null) === (row.projectId || null)) || { id: createId('trust'), userId: row.userId, projectId: row.projectId || null, createdAt: nowIso() }; Object.assign(profile, { trustScore: score.trustScore, assurance: score.tier, verificationStatus: score.verificationStatus, breakdown: score.breakdown, signals: score.signals, updatedAt: nowIso() }); if (!rows(db, 'trustProfiles').some(item => item.id === profile.id)) rows(db, 'trustProfiles').push(profile); rows(db, 'trustScoreSnapshots').push({ id: createId('trust_snapshot'), userId: row.userId, projectId: row.projectId, score: score.trustScore, tier: score.tier, breakdown: score.breakdown, policyVersion: 'trust-v2', createdAt: nowIso() }); rows(db, 'trustProjectionOutbox').push({ id: createId('trust_projection'), type: 'trust.updated', userId: row.userId, projectId: row.projectId, proofId: row.id, score, createdAt: nowIso(), deliveredAt: null }); return { ok: true, proof: { ...row, metadata: publicMetadata(row.source, row.metadata) }, score, previousStatus } }); if (result.ok && result.previousStatus !== result.proof.status) import('./trustProjectionService.js').then(({ publishTrustProjection }) => publishTrustProjection(result.proof.userId, result.proof.projectId)).catch(() => {}); return result }
