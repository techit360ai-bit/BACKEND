import { createHash } from 'crypto'
import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'

const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const clean = value => typeof value === 'string' ? value.trim() : value
const hash = value => createHash('sha256').update(String(value || '')).digest('hex')
const DEAL_STATES = Object.freeze(['interest', 'intro_requested', 'access_pending', 'diligence_open', 'diligence_complete', 'ic_review', 'term_sheet', 'negotiation', 'closing', 'closed', 'passed', 'withdrawn', 'expired'])
const TRANSITIONS = Object.freeze({ interest: ['intro_requested', 'passed', 'withdrawn'], intro_requested: ['access_pending', 'passed', 'withdrawn', 'expired'], access_pending: ['diligence_open', 'passed', 'withdrawn', 'expired'], diligence_open: ['diligence_complete', 'passed', 'withdrawn', 'expired'], diligence_complete: ['ic_review', 'term_sheet', 'passed', 'withdrawn'], ic_review: ['term_sheet', 'passed', 'withdrawn'], term_sheet: ['negotiation', 'passed', 'withdrawn'], negotiation: ['closing', 'passed', 'withdrawn'], closing: ['closed', 'passed', 'withdrawn'] })
const CHECKLIST = ['Company', 'Product', 'Market', 'Traction', 'Business Model', 'Team', 'Financials', 'Technology', 'Security', 'Legal/IP', 'Customers/References', 'Fundraise/Use of Funds']
const DEFAULT_FOLDERS = ['01 Corporate', '02 Product & Technology', '03 Market', '04 Traction & Customers', '05 Financials', '06 Legal & IP', '07 Team', '08 Fundraising', '09 Other']

function audit(db, dealId, actorId, action, metadata = {}) {
  const timestamp = nowIso(); const events = collection(db, 'dealAuditEvents').filter(row => row.dealId === dealId); const previous = events[events.length - 1]
  const sourceDataHash = hash(JSON.stringify(metadata)); const prevHash = previous?.eventHash || 'GENESIS'; const eventHash = hash(`${prevHash}|${dealId}|${actorId || ''}|${action}|${sourceDataHash}|${timestamp}`)
  collection(db, 'dealAuditEvents').push({ id: createId('deal_audit'), dealId, actorId, action, metadata, sourceDataHash, prevHash, eventHash, createdAt: timestamp })
  return timestamp
}

function investorRelationship(db, investorId, projectId) {
  const authorized = [...collection(db, 'investorWatchlists'), ...collection(db, 'dealFlowSnapshots'), ...collection(db, 'investments'), ...collection(db, 'investorRelationships')]
  return authorized.find(row => (row.investorId || row.ownerId || row.userId) === investorId && (row.projectId || row.startupId) === projectId) || null
}

function participant(db, dealId, userId) { return collection(db, 'dealRoomParticipants').find(row => row.dealId === dealId && row.userId === userId && row.status !== 'revoked') || null }
const INTERNAL_ROLES = new Set(['owner', 'reviewer', 'ic_member', 'legal', 'finance', 'read_only'])
function room(db, dealId) { return collection(db, 'dealRooms').find(row => row.id === dealId && row.status !== 'archived') || null }
function ndaActive(db, deal) { const template = collection(db, 'ndaTemplates').find(row => row.id === deal.ndaTemplateId && row.active !== false); const signature = collection(db, 'ndaSignatures').find(row => row.dealId === deal.id && row.userId === deal.investorId && row.templateVersion === template?.version && !row.revokedAt); return Boolean(template && signature) }
function publicDeal(db, deal, userId) {
  const member = participant(db, deal.id, userId)
  const items = collection(db, 'diligenceItems').filter(row => row.dealId === deal.id)
  return { ...deal, ndaRequired: true, ndaSigned: ndaActive(db, deal), participantRole: member?.role || null, diligence: { total: items.length, completed: items.filter(row => ['accepted', 'waived'].includes(row.status)).length } }
}

export function createDealRoom(investorId, body = {}) {
  const projectId = clean(body.projectId)
  if (!projectId) return { ok: false, error: 'project_id_required' }
  return updateDb(db => {
    if (!investorRelationship(db, investorId, projectId)) return { ok: false, error: 'investor_relationship_required' }
    const existing = collection(db, 'dealRooms').find(row => row.projectId === projectId && row.investorId === investorId && !['passed', 'withdrawn', 'expired'].includes(row.state))
    if (existing) return { ok: true, deal: publicDeal(db, existing, investorId), idempotent: true }
    const template = collection(db, 'ndaTemplates').find(row => row.active !== false) || { id: 'nda_default_v1', version: '1', title: 'TechIT Mutual Confidentiality Agreement', active: true }
    if (!collection(db, 'ndaTemplates').some(row => row.id === template.id)) collection(db, 'ndaTemplates').push(template)
    const timestamp = nowIso(); const deal = { id: createId('deal'), projectId, investorId, founderId: body.founderId || null, state: 'interest', ndaTemplateId: template.id, createdAt: timestamp, updatedAt: timestamp }
    collection(db, 'dealRooms').push(deal)
    collection(db, 'dealRoomParticipants').push({ id: createId('deal_participant'), dealId: deal.id, userId: investorId, role: 'owner', status: 'active', createdAt: timestamp })
    if (deal.founderId && deal.founderId !== investorId) collection(db, 'dealRoomParticipants').push({ id: createId('deal_participant'), dealId: deal.id, userId: deal.founderId, role: 'diligence_owner', status: 'active', createdAt: timestamp })
    for (const label of CHECKLIST) collection(db, 'diligenceItems').push({ id: createId('diligence'), dealId: deal.id, category: label, title: label, status: 'not_started', priority: 'standard', ownerId: deal.founderId || null, createdAt: timestamp, updatedAt: timestamp })
    for (const name of DEFAULT_FOLDERS) collection(db, 'dataRoomFolders').push({ id: createId('data_room_folder'), dealId: deal.id, name, category: name.replace(/^\d+\s+/, ''), system: true, createdBy: investorId, createdAt: timestamp, updatedAt: timestamp })
    audit(db, deal.id, investorId, 'deal_created', { projectId, state: deal.state }); audit(db, deal.id, investorId, 'nda_required', { templateVersion: template.version })
    return { ok: true, deal: publicDeal(db, deal, investorId) }
  })
}

export function listDealRooms(userId) {
  const db = readDb(); const deals = collection(db, 'dealRooms').filter(deal => deal.investorId === userId || Boolean(participant(db, deal.id, userId)))
  return { deals: deals.map(deal => publicDeal(db, deal, userId)) }
}

export function getDealRoom(userId, dealId, { requireNda = true } = {}) {
  const db = readDb(); const deal = room(db, dealId); const member = deal ? participant(db, deal.id, userId) : null
  if (!deal || !member) return { ok: false, error: 'deal_room_not_found' }
  if (requireNda && deal.investorId === userId && !ndaActive(db, deal)) return { ok: false, error: 'nda_required' }
  const items = collection(db, 'diligenceItems').filter(row => row.dealId === deal.id)
  const internal = INTERNAL_ROLES.has(member.role)
  const questions = collection(db, 'dealQuestions').filter(row => row.dealId === deal.id && (row.visibility !== 'investor_internal' || internal))
  const notes = internal ? collection(db, 'investorInternalNotes').filter(row => row.dealId === deal.id) : []
  const ic = internal ? collection(db, 'icReviews').filter(row => row.dealId === deal.id) : []
  return { ok: true, deal: publicDeal(db, deal, userId), checklist: items, questions, notes, ic }
}

export function signDealNda(userId, dealId, body = {}) {
  return updateDb(db => {
    const deal = room(db, dealId); if (!deal || deal.investorId !== userId) return { ok: false, error: 'deal_room_not_found' }
    const template = collection(db, 'ndaTemplates').find(row => row.id === deal.ndaTemplateId && row.active !== false); if (!template) return { ok: false, error: 'nda_template_unavailable' }
    const timestamp = nowIso(); const signature = { id: createId('nda_signature'), dealId, userId, templateVersion: template.version, signatureHash: hash(`${dealId}:${userId}:${template.version}:${timestamp}`), accepted: body.accepted === true, signedAt: body.accepted === true ? timestamp : null, ipAddress: body.ipAddress || null, userAgent: body.userAgent || null, createdAt: timestamp }
    if (!signature.accepted) return { ok: false, error: 'nda_acceptance_required' }
    collection(db, 'ndaSignatures').push(signature); audit(db, deal.id, userId, 'nda_signed', { templateVersion: template.version })
    if (deal.state === 'interest') { deal.state = 'diligence_open'; deal.updatedAt = timestamp; collection(db, 'dealStatusEvents').push({ id: createId('deal_status'), dealId: deal.id, actorId: userId, from: 'interest', to: 'diligence_open', createdAt: timestamp }) }
    return { ok: true, signature, deal: publicDeal(db, deal, userId) }
  })
}

export function transitionDeal(userId, dealId, nextState) {
  return updateDb(db => {
    const deal = room(db, dealId); const member = deal && participant(db, deal.id, userId); if (!deal || !member || member.role !== 'owner') return { ok: false, error: 'deal_room_not_found' }
    if (!DEAL_STATES.includes(nextState) || !(TRANSITIONS[deal.state] || []).includes(nextState)) return { ok: false, error: 'invalid_deal_transition', from: deal.state, to: nextState }
    if (['diligence_open', 'diligence_complete', 'ic_review', 'term_sheet', 'negotiation', 'closing', 'closed'].includes(nextState) && !ndaActive(db, deal)) return { ok: false, error: 'nda_required' }
    if (nextState === 'closed') {
      const required = collection(db, 'diligenceItems').filter(row => row.dealId === dealId && row.required !== false)
      const hasFinalTermSheet = collection(db, 'termSheetVersions').some(row => row.dealId === dealId && row.status === 'final')
      if (!required.length || required.some(row => !['accepted', 'waived'].includes(row.status)) || !hasFinalTermSheet) return { ok: false, error: 'closing_requirements_incomplete' }
    }
    const from = deal.state; deal.state = nextState; deal.updatedAt = nowIso(); collection(db, 'dealStatusEvents').push({ id: createId('deal_status'), dealId, actorId: userId, from, to: nextState, createdAt: deal.updatedAt }); audit(db, dealId, userId, 'deal_status_changed', { from, to: nextState }); return { ok: true, deal: publicDeal(db, deal, userId) }
  })
}

export function updateDiligenceItem(userId, dealId, itemId, body = {}) {
  return updateDb(db => {
    const deal = room(db, dealId); const member = deal && participant(db, dealId, userId); const item = collection(db, 'diligenceItems').find(row => row.id === itemId && row.dealId === dealId)
    if (!deal || !member || !item) return { ok: false, error: 'diligence_item_not_found' }
    if (!['owner', 'reviewer', 'diligence_owner'].includes(member.role) && userId !== item.ownerId) return { ok: false, error: 'diligence_permission_required' }
    const allowed = ['not_started', 'requested', 'submitted', 'under_review', 'accepted', 'needs_clarification', 'waived']; if (body.status !== undefined && !allowed.includes(body.status)) return { ok: false, error: 'invalid_diligence_status' }
    for (const key of ['status', 'priority', 'ownerId', 'dueDate', 'reviewerId', 'comments']) if (body[key] !== undefined) item[key] = clean(body[key]); item.updatedAt = nowIso(); audit(db, dealId, userId, 'diligence_item_updated', { itemId, status: item.status }); return { ok: true, item }
  })
}

export function createDealQuestion(userId, dealId, body = {}) {
  return updateDb(db => {
    const deal = room(db, dealId); const member = deal && participant(db, dealId, userId); if (!deal || !member || (INTERNAL_ROLES.has(member.role) && !ndaActive(db, deal))) return { ok: false, error: INTERNAL_ROLES.has(member?.role) ? 'nda_required' : 'deal_room_not_found' }
    const content = clean(body.content); if (!content) return { ok: false, error: 'content_required' }; const visibility = body.visibility === 'investor_internal' && INTERNAL_ROLES.has(member.role) ? 'investor_internal' : 'participants'
    const question = { id: createId('deal_question'), dealId, authorId: userId, checklistItemId: body.checklistItemId || null, documentId: body.documentId || null, assignedTo: body.assignedTo || null, visibility, status: 'open', content, createdAt: nowIso(), updatedAt: nowIso() }; collection(db, 'dealQuestions').push(question); audit(db, dealId, userId, 'question_created', { questionId: question.id, visibility }); return { ok: true, question }
  })
}

export function addDealQuestionMessage(userId, dealId, questionId, body = {}) {
  return updateDb(db => {
    const deal = room(db, dealId); const member = deal && participant(db, dealId, userId); const question = collection(db, 'dealQuestions').find(row => row.id === questionId && row.dealId === dealId); if (!deal || !member || !question) return { ok: false, error: 'question_not_found' }; if (question.visibility === 'investor_internal' && !INTERNAL_ROLES.has(member.role)) return { ok: false, error: 'internal_question' }; const content = clean(body.content); if (!content) return { ok: false, error: 'content_required' }; const message = { id: createId('deal_message'), questionId, dealId, authorId: userId, content, createdAt: nowIso() }; collection(db, 'dealQuestionMessages').push(message); question.status = body.status && ['open', 'answered', 'needs_clarification', 'resolved'].includes(body.status) ? body.status : 'answered'; question.updatedAt = nowIso(); audit(db, dealId, userId, 'question_answered', { questionId }); return { ok: true, message, question }
  })
}

export function createInternalNote(userId, dealId, body = {}) {
  return updateDb(db => { const deal = room(db, dealId); const member = deal && participant(db, dealId, userId); if (!deal || !member || !['owner', 'reviewer', 'ic_member'].includes(member.role)) return { ok: false, error: 'internal_permission_required' }; const note = { id: createId('investor_note'), dealId, investorId: userId, content: clean(body.content) || '', rating: body.rating || 'none', createdAt: nowIso(), updatedAt: nowIso() }; if (!note.content) return { ok: false, error: 'content_required' }; collection(db, 'investorInternalNotes').push(note); audit(db, dealId, userId, 'internal_note_created', { noteId: note.id }); return { ok: true, note } })
}

export function createIcReview(userId, dealId, body = {}) {
  return updateDb(db => { const deal = room(db, dealId); const member = deal && participant(db, dealId, userId); if (!deal || !member || !['owner', 'ic_member'].includes(member.role)) return { ok: false, error: 'ic_permission_required' }; const review = { id: createId('ic_review'), dealId, investorId: userId, thesis: clean(body.thesis) || '', risks: clean(body.risks) || '', mitigants: clean(body.mitigants) || '', recommendation: ['proceed', 'hold', 'pass'].includes(body.recommendation) ? body.recommendation : 'hold', proposedCheck: clean(body.proposedCheck) || '', createdAt: nowIso(), updatedAt: nowIso() }; collection(db, 'icReviews').push(review); audit(db, dealId, userId, 'ic_review_created', { reviewId: review.id, recommendation: review.recommendation }); return { ok: true, review } })
}

export function createTermSheet(userId, dealId, body = {}) {
  return updateDb(db => { const deal = room(db, dealId); const member = deal && participant(db, dealId, userId); if (!deal || !member || !['owner', 'legal'].includes(member.role) || !ndaActive(db, deal)) return { ok: false, error: 'nda_required' }; const version = { id: createId('term_sheet'), dealId, investorId: userId, version: collection(db, 'termSheetVersions').filter(row => row.dealId === dealId).length + 1, status: 'draft', terms: body.terms && typeof body.terms === 'object' ? body.terms : {}, disclaimer: 'Template only. This is not legal advice and is not a legally executed agreement.', createdAt: nowIso(), updatedAt: nowIso() }; collection(db, 'termSheetVersions').push(version); audit(db, dealId, userId, 'term_sheet_created', { version: version.version }); return { ok: true, termSheet: version } })
}

export { DEAL_STATES, CHECKLIST, DEFAULT_FOLDERS }
