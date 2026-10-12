import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { investorStoreEnabled, investorFallbackEnabled, runInvestorRead, applyInvestorMutation } from '../repositories/investorIntelligenceRepository.js'
import { createId, nowIso } from '../utils/api.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const text = (value, max = 1000) => typeof value === 'string' ? value.replace(/[<>\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
const ownerId = project => project?.ownerId || project?.founderId || project?.creatorId || project?.userId || project?.createdBy || null

function projectFor(db, projectId) { return rows(db, 'projects').find(row => String(row.id) === String(projectId)) }
function publicRequest(row) { return { id: row.id, projectId: row.projectId, investorId: row.investorId, founderId: row.founderId, status: row.status, purpose: row.purpose, requestedScopes: row.requestedScopes, decisionNote: row.decisionNote || null, createdAt: row.createdAt, updatedAt: row.updatedAt, decidedAt: row.decidedAt || null } }
function event(db, request, actorId, action, metadata = {}) { rows(db, 'investorTrustAccessHistory').push({ id: createId('trust_access_event'), requestId: request.id, projectId: request.projectId, actorId, action, metadata, createdAt: nowIso() }) }
function notify(db, userId, type, request) { if (!userId) return; rows(db, 'notifications').push({ id: createId('notification'), userId, type, title: type === 'investor_trust_access_requested' ? 'Investor requested Trust access' : `Trust access request ${request.status}`, message: type === 'investor_trust_access_requested' ? 'An investor requested additional startup Trust access.' : `Your startup Trust access request was ${request.status}.`, read: false, metadata: { requestId: request.id, projectId: request.projectId }, createdAt: nowIso() }) }

export function requestInvestorTrustAccess(investorId, projectId, input = {}) {
  return updateAuthorityDb(db => {
    const project = projectFor(db, projectId)
    if (!project) return { ok: false, status: 404, error: 'startup_not_found' }
    const founderId = ownerId(project)
    if (!founderId) return { ok: false, status: 409, error: 'startup_owner_unavailable' }
    if (String(founderId) === String(investorId)) return { ok: false, status: 400, error: 'startup_owner_cannot_request_access' }
    const existing = rows(db, 'investorTrustAccessRequests').find(row => row.investorId === investorId && String(row.projectId) === String(projectId) && ['pending', 'approved'].includes(row.status))
    if (existing) return { ok: true, created: false, request: publicRequest(existing) }
    const now = nowIso()
    const requestedScopes = Array.isArray(input.requestedScopes) ? [...new Set(input.requestedScopes.map(value => text(String(value), 80)).filter(Boolean))].slice(0, 12) : ['approved_evidence_metadata']
    const request = { id: createId('trust_access'), projectId: String(projectId), investorId, founderId: String(founderId), status: 'pending', purpose: text(input.purpose, 1000), requestedScopes: requestedScopes.length ? requestedScopes : ['approved_evidence_metadata'], createdAt: now, updatedAt: now }
    rows(db, 'investorTrustAccessRequests').push(request)
    event(db, request, investorId, 'requested', { requestedScopes: request.requestedScopes })
    notify(db, request.founderId, 'investor_trust_access_requested', request)
    return { ok: true, created: true, request: publicRequest(request) }
  })
}

export function investorTrustAccessStatus(investorId, projectId) {
  const db = readAuthorityDb()
  const request = rows(db, 'investorTrustAccessRequests').filter(row => row.investorId === investorId && String(row.projectId) === String(projectId)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0]
  return { ok: true, request: request ? publicRequest(request) : null, requestAccessAllowed: !request || ['rejected', 'cancelled', 'expired'].includes(request.status) }
}

export function listFounderTrustAccessRequests(founderId, status = null) {
  const db = readAuthorityDb()
  const allowedProjects = new Set(rows(db, 'projects').filter(project => String(ownerId(project)) === String(founderId)).map(project => String(project.id)))
  const requests = rows(db, 'investorTrustAccessRequests').filter(row => allowedProjects.has(String(row.projectId)) && (!status || row.status === status)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(publicRequest)
  return { ok: true, requests }
}

export function decideInvestorTrustAccess(founderId, requestId, input = {}) {
  const decision = text(input.decision || input.status, 40).toLowerCase()
  if (!['approved', 'rejected'].includes(decision)) return { ok: false, status: 400, error: 'invalid_access_decision' }
  return updateAuthorityDb(db => {
    const request = rows(db, 'investorTrustAccessRequests').find(row => row.id === requestId)
    if (!request) return { ok: false, status: 404, error: 'access_request_not_found' }
    const project = projectFor(db, request.projectId)
    if (!project || String(ownerId(project)) !== String(founderId)) return { ok: false, status: 403, error: 'startup_owner_required' }
    if (request.status !== 'pending') return { ok: false, status: 409, error: 'access_request_already_decided' }
    request.status = decision
    request.decisionNote = text(input.note, 1000)
    request.decidedBy = founderId
    request.decidedAt = nowIso()
    request.updatedAt = request.decidedAt
    event(db, request, founderId, decision, { note: request.decisionNote })
    notify(db, request.investorId, 'investor_trust_access_decided', request)
    return { ok: true, request: publicRequest(request) }
  })
}
// Row-level (§5) wrappers — sub-slice: investor trust access. Bounded to the
// caller's own projects/requests (investor or founder) so the request/decision
// path no longer loads the snapshot. Gated by INVESTOR_*_SOURCE=postgres.
const trustScope = (userId, extra = {}) => ({ userId, trustAccess: true, ...extra })

async function trustRead(options, read, fallback) {
  if (!investorStoreEnabled()) return fallback()
  try { return await runInvestorRead(options, read) } catch (error) {
    console.error(JSON.stringify({ event: 'investor_read_failed', slice: 'trust_access', error: error.message }))
    if (!investorFallbackEnabled('READ')) throw error
    return fallback()
  }
}
async function trustMutation(options, mutate, fallback) {
  if (!investorStoreEnabled()) return fallback()
  try { return await applyInvestorMutation(options, mutate) } catch (error) {
    console.error(JSON.stringify({ event: 'investor_write_failed', slice: 'trust_access', error: error.message }))
    if (!investorFallbackEnabled('WRITE')) throw error
    return fallback()
  }
}

export async function requestInvestorTrustAccessAsync(investorId, projectId, input = {}) {
  return trustMutation(trustScope(investorId, { startupId: projectId }), () => requestInvestorTrustAccess(investorId, projectId, input), () => requestInvestorTrustAccess(investorId, projectId, input))
}
export async function investorTrustAccessStatusAsync(investorId, projectId) {
  return trustRead(trustScope(investorId), () => investorTrustAccessStatus(investorId, projectId), () => investorTrustAccessStatus(investorId, projectId))
}
export async function listFounderTrustAccessRequestsAsync(founderId, status = null) {
  return trustRead(trustScope(founderId), () => listFounderTrustAccessRequests(founderId, status), () => listFounderTrustAccessRequests(founderId, status))
}
export async function decideInvestorTrustAccessAsync(founderId, requestId, input = {}) {
  return trustMutation(trustScope(founderId, { requestId }), () => decideInvestorTrustAccess(founderId, requestId, input), () => decideInvestorTrustAccess(founderId, requestId, input))
}
