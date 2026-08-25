import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'

const CATEGORIES = new Set(['account', 'billing', 'credits', 'platform', 'projects', 'privacy', 'security', 'other'])
const STATUSES = new Set(['received', 'triaging', 'processing', 'waiting_for_user', 'escalated', 'resolved', 'closed', 'reopened'])
const PRIORITIES = new Set(['critical', 'high', 'medium', 'low'])
const EXEMPT_CATEGORIES = new Set(['security', 'privacy'])
const DEFAULT_SLA = {
  critical: { firstResponseMinutes: 60, resolutionMinutes: 240 },
  high: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
  medium: { firstResponseMinutes: 480, resolutionMinutes: 2880 },
  low: { firstResponseMinutes: 1440, resolutionMinutes: 7200 },
}

export function supportEnabled() {
  return process.env.CUSTOMER_SUPPORT_SYSTEM !== '0'
}

function rows(db, name) {
  if (!Array.isArray(db[name])) db[name] = []
  return db[name]
}

function text(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function priorityFor(category, body = {}) {
  const haystack = `${category} ${body.subject || ''} ${body.description || ''}`.toLowerCase()
  if (category === 'security' || /hacked|fraud|unauthori[sz]ed|breach|multiple charge|money deducted/.test(haystack)) return 'critical'
  if (category === 'billing' || category === 'credits' || /cannot log|can't log|payment|subscription|access denied|not working/.test(haystack)) return 'high'
  if (category === 'platform' || category === 'projects') return 'medium'
  return 'low'
}

function slaFor(db, priority) {
  const configured = rows(db, 'supportSlaPolicies').find(row => row.priority === priority && row.active !== false)
  const value = configured || DEFAULT_SLA[priority] || DEFAULT_SLA.medium
  return { firstResponseMinutes: Number(value.firstResponseMinutes), resolutionMinutes: Number(value.resolutionMinutes) }
}

function caseNumber(db) {
  const year = new Date().getUTCFullYear()
  const count = rows(db, 'supportCases').filter(row => String(row.caseNumber || '').startsWith(`TKT-${year}-`)).length + 1
  return `TKT-${year}-${String(count).padStart(6, '0')}`
}

function event(db, caseId, eventType, actorId, metadata = {}) {
  rows(db, 'supportEvents').push({ id: createId('support_event'), caseId, eventType, actorId: actorId || 'system', metadata, createdAt: nowIso() })
}

function publicCase(row) {
  if (!row) return null
  const { internalContext, ...safe } = row
  return safe
}

function canAccessCase(row, userId, admin = false) {
  return Boolean(row && (admin || row.userId === userId))
}

export function createCase(userId, body = {}, role = 'explorer') {
  if (!supportEnabled()) return { ok: false, status: 404, error: 'support_disabled' }
  const category = text(body.category, 40).toLowerCase()
  if (!CATEGORIES.has(category)) return { ok: false, status: 400, error: 'invalid_category' }
  const subject = text(body.subject, 180)
  const description = text(body.description, 4000)
  if (!subject || !description) return { ok: false, status: 400, error: 'subject_and_description_required' }
  return updateDb(db => {
    const exempt = EXEMPT_CATEGORIES.has(category)
    const recent = rows(db, 'supportCases').find(row => row.userId === userId && row.category === category && !['resolved', 'closed'].includes(row.status) && !exempt)
    if (recent) return { ok: false, status: 409, error: 'existing_case', case: publicCase(recent) }
    const duplicateWindow = Date.now() - 24 * 60 * 60 * 1000
    const duplicate = rows(db, 'supportCases').find(row => row.userId === userId && row.category === category && new Date(row.createdAt).getTime() > duplicateWindow && !exempt)
    if (duplicate) return { ok: false, status: 409, error: 'case_cooldown', case: publicCase(duplicate) }
    const priority = PRIORITIES.has(body.priority) ? body.priority : priorityFor(category, body)
    const sla = slaFor(db, priority)
    const createdAt = nowIso()
    const row = {
      id: createId('support_case'), caseNumber: caseNumber(db), userId, userRole: role,
      category, subcategory: text(body.subcategory, 80) || null, subject, description,
      priority, severity: text(body.severity, 40) || priority, status: 'received',
      assignedAdminId: null, assignedTeam: null, escalationStatus: 'none',
      firstResponseDueAt: new Date(Date.now() + sla.firstResponseMinutes * 60000).toISOString(),
      resolutionDueAt: new Date(Date.now() + sla.resolutionMinutes * 60000).toISOString(),
      firstRespondedAt: null, resolvedAt: null, closedAt: null, createdAt, updatedAt: createdAt,
    }
    rows(db, 'supportCases').push(row)
    rows(db, 'supportMessages').push({ id: createId('support_message'), caseId: row.id, senderType: 'system', senderId: 'system', message: `We've received your request and created support case ${row.caseNumber}.`, isInternal: false, createdAt })
    event(db, row.id, 'support_case_created', userId, { category, priority })
    event(db, row.id, 'support_case_sla_started', 'system', { firstResponseDueAt: row.firstResponseDueAt, resolutionDueAt: row.resolutionDueAt })
    return { ok: true, case: publicCase(row) }
  })
}

export function listCases(userId) {
  if (!supportEnabled()) return { ok: false, status: 404, error: 'support_disabled' }
  const db = readDb()
  return { ok: true, cases: rows(db, 'supportCases').filter(row => row.userId === userId).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(publicCase) }
}

export function getCase(userId, caseId, admin = false) {
  if (!supportEnabled()) return { ok: false, status: 404, error: 'support_disabled' }
  const db = readDb()
  const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
  if (!canAccessCase(supportCase, userId, admin)) return { ok: false, status: 404, error: 'case_not_found' }
  const messages = rows(db, 'supportMessages').filter(row => row.caseId === supportCase.id && (admin || !row.isInternal))
  const events = rows(db, 'supportEvents').filter(row => row.caseId === supportCase.id)
  return { ok: true, case: publicCase(supportCase), messages, events }
}

export function addMessage(userId, caseId, body = {}, admin = false) {
  const message = text(body.message, 4000)
  if (!message) return { ok: false, status: 400, error: 'message_required' }
  return updateDb(db => {
    const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
    if (!canAccessCase(supportCase, userId, admin)) return { ok: false, status: 404, error: 'case_not_found' }
    if (['closed'].includes(supportCase.status)) return { ok: false, status: 409, error: 'case_closed' }
    const now = nowIso()
    const item = { id: createId('support_message'), caseId: supportCase.id, senderType: admin ? 'admin' : 'customer', senderId: userId, message, isInternal: admin && body.internal === true, createdAt: now }
    rows(db, 'supportMessages').push(item)
    if (!item.isInternal) {
      supportCase.status = admin ? supportCase.status : 'triaging'
      if (admin && !supportCase.firstRespondedAt) supportCase.firstRespondedAt = now
    }
    supportCase.updatedAt = now
    event(db, supportCase.id, 'support_case_message_received', userId, { senderType: item.senderType, internal: item.isInternal })
    return { ok: true, message: item, case: publicCase(supportCase) }
  })
}

export function listAdminCases(filters = {}) {
  const db = readDb()
  let cases = rows(db, 'supportCases').slice()
  if (filters.status) cases = cases.filter(row => row.status === filters.status)
  if (filters.priority) cases = cases.filter(row => row.priority === filters.priority)
  if (filters.category) cases = cases.filter(row => row.category === filters.category)
  const query = text(filters.q, 120).toLowerCase()
  if (query) cases = cases.filter(row => [row.caseNumber, row.subject, row.description, row.userId].some(value => String(value || '').toLowerCase().includes(query)))
  return { ok: true, cases: cases.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(publicCase) }
}

export function updateCase(adminId, caseId, body = {}) {
  return updateDb(db => {
    const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
    if (!supportCase) return { ok: false, status: 404, error: 'case_not_found' }
    const previous = { status: supportCase.status, priority: supportCase.priority, assignedAdminId: supportCase.assignedAdminId }
    if (body.status && STATUSES.has(body.status)) supportCase.status = body.status
    if (body.priority && PRIORITIES.has(body.priority)) supportCase.priority = body.priority
    if (body.assignedAdminId !== undefined) supportCase.assignedAdminId = body.assignedAdminId || null
    if (body.assignedTeam !== undefined) supportCase.assignedTeam = text(body.assignedTeam, 80) || null
    if (body.status === 'resolved') supportCase.resolvedAt = nowIso()
    if (body.status === 'closed') supportCase.closedAt = nowIso()
    supportCase.updatedAt = nowIso()
    event(db, supportCase.id, 'support_case_updated', adminId, { previous, next: { status: supportCase.status, priority: supportCase.priority, assignedAdminId: supportCase.assignedAdminId } })
    return { ok: true, case: publicCase(supportCase) }
  })
}

export function submitFeedback(userId, caseId, body = {}) {
  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, status: 400, error: 'rating_must_be_1_to_5' }
  return updateDb(db => {
    const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
    if (!supportCase || supportCase.userId !== userId) return { ok: false, status: 404, error: 'case_not_found' }
    const existing = rows(db, 'supportFeedback').find(row => row.caseId === supportCase.id)
    if (existing) return { ok: false, status: 409, error: 'feedback_already_submitted' }
    const feedback = { id: createId('support_feedback'), caseId: supportCase.id, userId, rating, resolutionStatus: text(body.resolutionStatus, 30) || null, comment: text(body.comment, 1000) || null, createdAt: nowIso() }
    rows(db, 'supportFeedback').push(feedback)
    event(db, supportCase.id, 'support_feedback_received', userId, { rating })
    return { ok: true, feedback }
  })
}

export function supportOverview() {
  const db = readDb()
  const cases = rows(db, 'supportCases')
  const now = Date.now()
  return { ok: true, metrics: {
    open: cases.filter(row => !['resolved', 'closed'].includes(row.status)).length,
    newToday: cases.filter(row => now - new Date(row.createdAt).getTime() < 86400000).length,
    processing: cases.filter(row => row.status === 'processing').length,
    waitingForUser: cases.filter(row => row.status === 'waiting_for_user').length,
    escalated: cases.filter(row => row.status === 'escalated').length,
    slaAtRisk: cases.filter(row => !['resolved', 'closed'].includes(row.status) && new Date(row.firstResponseDueAt).getTime() - now < 3600000).length,
    resolvedToday: cases.filter(row => row.resolvedAt && now - new Date(row.resolvedAt).getTime() < 86400000).length,
  } }
}
