import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { createPrivateUpload, finalizePrivateUpload, privateDownloadUrl } from './evidenceStorageService.js'
import { deliverSupportNotification, deliverSupportTeamNotification } from './supportNotificationService.js'

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

const SUPPORT_PERMISSIONS = new Set(['support.view', 'support.create', 'support.reply', 'support.assign', 'support.escalate', 'support.resolve', 'support.close', 'support.reopen', 'support.view_sensitive', 'support.modify_account', 'support.modify_billing', 'support.modify_credits', 'support.view_audit', 'support.view_intelligence', 'support.manage_sla', 'support.manage_categories', 'support.manage_teams', 'support.manage_knowledge_base', 'support.manage_templates', 'support.run_maintenance', 'support.manage_retention'])
const BUSINESS_DAYS = new Set([1, 2, 3, 4, 5])

export function supportEnabled() {
  return process.env.CUSTOMER_SUPPORT_SYSTEM !== '0'
}

function rows(db, name) {
  if (!Array.isArray(db[name])) db[name] = []
  return db[name]
}

function setting(db, key, fallback) {
  const row = rows(db, 'supportSettings').slice().reverse().find(item => item.key === key)
  return row?.value ?? fallback
}

function hasPermission(actor, permission) {
  if (!actor) return false
  if (actor.role === 'super_admin' || actor.permissions?.includes('all')) return true
  return actor.permissions?.includes(permission) === true
}
export function supportPermissionAllowed(actor, permission) { return hasPermission(actor, permission) }

function nextBusinessTime(timestamp, minutes) {
  const businessStart = Number(process.env.SUPPORT_BUSINESS_START_HOUR || 9)
  const businessEnd = Number(process.env.SUPPORT_BUSINESS_END_HOUR || 17)
  const zone = process.env.SUPPORT_BUSINESS_TIMEZONE || 'UTC'
  let cursor = new Date(timestamp)
  let remaining = Math.max(0, Number(minutes) || 0)
  const localParts = () => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(cursor).map(part => [part.type, part.value]))
  while (remaining > 0) {
    const local = localParts()
    const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[local.weekday] ?? 0
    const hour = Number(local.hour)
    if (!BUSINESS_DAYS.has(weekday) || hour < businessStart || hour >= businessEnd) {
      cursor = new Date(cursor.getTime() + 60 * 60 * 1000)
      continue
    }
    const available = Math.max(0, (businessEnd - hour) * 60 - Number(local.minute || 0))
    const step = Math.min(remaining, available || 60)
    cursor = new Date(cursor.getTime() + step * 60000)
    remaining -= step
  }
  return cursor.toISOString()
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

function slaDue(db, priority, createdAt) {
  const sla = slaFor(db, priority)
  if (setting(db, 'businessHoursEnabled', false) !== true) {
    return { firstResponseDueAt: new Date(new Date(createdAt).getTime() + sla.firstResponseMinutes * 60000).toISOString(), resolutionDueAt: new Date(new Date(createdAt).getTime() + sla.resolutionMinutes * 60000).toISOString() }
  }
  return { firstResponseDueAt: nextBusinessTime(createdAt, sla.firstResponseMinutes), resolutionDueAt: nextBusinessTime(createdAt, sla.resolutionMinutes) }
}

function caseNumber(db) {
  const year = new Date().getUTCFullYear()
  const count = rows(db, 'supportCases').filter(row => String(row.caseNumber || '').startsWith(`TKT-${year}-`)).length + 1
  return `TKT-${year}-${String(count).padStart(6, '0')}`
}

function event(db, caseId, eventType, actorId, metadata = {}) {
  const row = { id: createId('support_event'), caseId, eventType, actorId: actorId || 'system', metadata, createdAt: nowIso() }
  rows(db, 'supportEvents').push(row)
  rows(db, 'supportAuditLogs').push({ id: createId('support_audit'), caseId, action: eventType, actorId: actorId || 'system', metadata, createdAt: row.createdAt })
  return row
}

function notify(db, userId, content, caseId, type = 'milestone') {
  if (!userId) return
  rows(db, 'notifications').push({ id: createId('notif'), userId, actorId: 'system', type, read: false, content, author: 'TechIT Support', linkTo: `/support?case=${encodeURIComponent(caseId)}`, metadata: { supportCaseId: caseId }, createdAt: nowIso() })
  const supportCase = rows(db, 'supportCases').find(row => row.id === caseId)
  void deliverSupportNotification({ userId, subject: type === 'comment' ? 'New support response' : 'Support case update', message: content, caseNumber: supportCase?.caseNumber || caseId, eventType: type })
}

function notifyTeam(db, supportCase, team, content, eventType = 'assignment') {
  if (!team) return
  const admins = rows(db, 'adminUsers')
  const adminIds = new Set(team.memberAdminIds || [])
  for (const adminId of adminIds) {
    rows(db, 'notifications').push({ id: createId('notif'), userId: adminId, actorId: 'system', type: `support_${eventType}`, read: false, content, author: 'TechIT Support', linkTo: `/customer-care?case=${encodeURIComponent(supportCase.caseNumber)}`, metadata: { supportCaseId: supportCase.id, team: team.name }, createdAt: nowIso() })
  }
  void deliverSupportTeamNotification({ team, adminUsers: admins, subject: subjectForEvent(eventType), message: content, caseNumber: supportCase.caseNumber, eventType })
}

function subjectForEvent(eventType) {
  if (eventType === 'escalation') return 'Support case escalated'
  if (eventType === 'sla') return 'Support SLA alert'
  return 'Support case assigned'
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
  const configuredCategories = rows(readAuthorityDb(), 'supportCategories').filter(row => row.active !== false).map(row => row.key)
  if (!CATEGORIES.has(category) && !configuredCategories.includes(category)) return { ok: false, status: 400, error: 'invalid_category' }
  const subject = text(body.subject, 180)
  const description = text(body.description, 4000)
  if (!subject || !description) return { ok: false, status: 400, error: 'subject_and_description_required' }
  return updateAuthorityDb(db => {
    const exempt = EXEMPT_CATEGORIES.has(category)
    const recent = rows(db, 'supportCases').find(row => row.userId === userId && row.category === category && !['resolved', 'closed'].includes(row.status) && !exempt)
    if (recent) return { ok: false, status: 409, error: 'existing_case', case: publicCase(recent) }
    const duplicateWindow = Date.now() - Number(setting(db, 'duplicateCooldownHours', 24)) * 60 * 60 * 1000
    const duplicate = rows(db, 'supportCases').find(row => row.userId === userId && row.category === category && new Date(row.createdAt).getTime() > duplicateWindow && !exempt)
    if (duplicate) return { ok: false, status: 409, error: 'case_cooldown', case: publicCase(duplicate) }
    const priority = priorityFor(category, body)
    const createdAt = nowIso()
    const sla = slaDue(db, priority, createdAt)
    const row = {
      id: createId('support_case'), caseNumber: caseNumber(db), userId, userRole: role,
      category, subcategory: text(body.subcategory, 80) || null, subject, description,
      organizationId: text(body.organizationId, 120) || null, programId: text(body.programId, 120) || null, hackathonId: text(body.hackathonId, 120) || null,
      priority, severity: text(body.severity, 40) || priority, status: 'received',
      assignedAdminId: null, assignedTeam: null, escalationStatus: 'none',
      firstResponseDueAt: sla.firstResponseDueAt,
      resolutionDueAt: sla.resolutionDueAt,
      firstRespondedAt: null, resolvedAt: null, closedAt: null, createdAt, updatedAt: createdAt,
      escalationLevel: 1, lock: null, diagnosticSnapshot: null,
    }
    rows(db, 'supportCases').push(row)
    rows(db, 'supportMessages').push({ id: createId('support_message'), caseId: row.id, senderType: 'system', senderId: 'system', message: `We've received your request and created support case ${row.caseNumber}.`, isInternal: false, createdAt })
    event(db, row.id, 'support_case_created', userId, { category, priority })
    event(db, row.id, 'support_case_sla_started', 'system', { firstResponseDueAt: row.firstResponseDueAt, resolutionDueAt: row.resolutionDueAt })
    notify(db, userId, `Complaint received. Support case ${row.caseNumber} is now open.`, row.id)
    return { ok: true, case: publicCase(row) }
  })
}

export function listCases(userId) {
  if (!supportEnabled()) return { ok: false, status: 404, error: 'support_disabled' }
  const db = readAuthorityDb()
  return { ok: true, cases: rows(db, 'supportCases').filter(row => row.userId === userId).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(publicCase) }
}

export function getCase(userId, caseId, admin = false) {
  if (!supportEnabled()) return { ok: false, status: 404, error: 'support_disabled' }
  const db = readAuthorityDb()
  const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
  if (!canAccessCase(supportCase, userId, admin)) return { ok: false, status: 404, error: 'case_not_found' }
  const messages = rows(db, 'supportMessages').filter(row => row.caseId === supportCase.id && (admin || !row.isInternal))
  const events = rows(db, 'supportEvents').filter(row => row.caseId === supportCase.id)
  const attachments = rows(db, 'supportAttachments').filter(row => row.caseId === supportCase.id).map(({ objectKey, ...safe }) => safe)
  const feedback = rows(db, 'supportFeedback').find(row => row.caseId === supportCase.id) || null
  const assignments = rows(db, 'supportAssignments').filter(row => row.caseId === supportCase.id)
  return { ok: true, case: publicCase(supportCase), messages, events, attachments, feedback, assignments }
}

export function addMessage(userId, caseId, body = {}, admin = false) {
  const message = text(body.message, 4000)
  if (!message) return { ok: false, status: 400, error: 'message_required' }
  return updateAuthorityDb(db => {
    const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
    if (!canAccessCase(supportCase, userId, admin)) return { ok: false, status: 404, error: 'case_not_found' }
    if (['closed'].includes(supportCase.status)) return { ok: false, status: 409, error: 'case_closed' }
    const now = nowIso()
    const internal = admin && body.internal === true
    const item = { id: createId('support_message'), caseId: supportCase.id, senderType: admin ? 'admin' : 'customer', senderId: userId, message: maskSensitive(message), isInternal: internal, createdAt: now }
    rows(db, 'supportMessages').push(item)
    if (!item.isInternal) {
      if (!admin) supportCase.status = 'triaging'
      if (admin && !supportCase.firstRespondedAt) supportCase.firstRespondedAt = now
    }
    supportCase.updatedAt = now
    event(db, supportCase.id, 'support_case_message_received', userId, { senderType: item.senderType, internal: item.isInternal })
    if (admin && !item.isInternal) notify(db, supportCase.userId, `TechIT Support replied to ${supportCase.caseNumber}.`, supportCase.id, 'comment')
    if (!admin && !item.isInternal && supportCase.assignedTeam) {
      const team = rows(db, 'supportTeams').find(row => row.id === supportCase.assignedTeam || row.name === supportCase.assignedTeam)
      if (team) notifyTeam(db, supportCase, team, `New customer message on ${supportCase.caseNumber}: ${item.message}`, 'message')
    }
    return { ok: true, message: item, case: publicCase(supportCase) }
  })
}

export function listAdminCases(filters = {}) {
  const db = readAuthorityDb()
  let cases = rows(db, 'supportCases').slice()
  if (filters.status) cases = cases.filter(row => row.status === filters.status)
  if (filters.priority) cases = cases.filter(row => row.priority === filters.priority)
  if (filters.category) cases = cases.filter(row => row.category === filters.category)
  const query = text(filters.q, 120).toLowerCase()
  if (query) cases = cases.filter(row => {
    const user = rows(db, 'users').find(item => item.id === row.userId) || {}
    const profile = rows(db, 'profiles').find(item => item.id === row.userId) || {}
    const project = rows(db, 'projects').find(item => item.ownerId === row.userId || item.userId === row.userId) || {}
    const payments = rows(db, 'paymentIntents').filter(item => item.userId === row.userId)
    return [row.caseNumber, row.subject, row.description, row.userId, user.email, profile.firstName, profile.lastName, profile.orgName, project.name, project.title, ...payments.flatMap(item => [item.id, item.reference, item.transactionId, item.providerReference])].some(value => String(value || '').toLowerCase().includes(query))
  })
  return { ok: true, cases: cases.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(publicCase) }
}

export function supportDirectory() {
  const db = readAuthorityDb()
  return {
    ok: true,
    admins: rows(db, 'adminUsers').filter(row => row.active !== false).map(row => ({ id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName, role: row.role })),
    teams: rows(db, 'supportTeams').filter(row => row.active !== false).map(row => ({ id: row.id, name: row.name, level: row.level, categories: row.categories || [], memberAdminIds: row.memberAdminIds || [], notifyEmail: row.notifyEmail !== false, notifyWhatsapp: row.notifyWhatsapp !== false })),
  }
}

export function reopenCase(userId, caseId) {
  return updateAuthorityDb(db => {
    const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
    if (!supportCase || supportCase.userId !== userId) return { ok: false, status: 404, error: 'case_not_found' }
    if (supportCase.status !== 'resolved') return { ok: false, status: 409, error: 'case_not_reopenable' }
    const previous = supportCase.status; supportCase.status = 'reopened'; supportCase.closedAt = null; supportCase.resolvedAt = null; supportCase.updatedAt = nowIso()
    event(db, supportCase.id, 'support_case_reopened', userId, { previous })
    notify(db, supportCase.userId, `${supportCase.caseNumber} was reopened.`, supportCase.id)
    return { ok: true, case: publicCase(supportCase) }
  })
}

export function listKnowledgeBase() { const db = readAuthorityDb(); return { ok: true, articles: rows(db, 'supportKnowledgeBase').filter(row => row.active !== false) } }
export function saveKnowledgeArticle(adminId, body = {}) { return updateAuthorityDb(db => { const title = text(body.title, 180); const solution = text(body.solution, 5000); if (!title || !solution) return { ok: false, status: 400, error: 'knowledge_title_and_solution_required' }; const article = { id: body.id || createId('support_kb'), title, problem: text(body.problem, 2000), solution, category: text(body.category, 40) || 'other', escalationConditions: Array.isArray(body.escalationConditions) ? body.escalationConditions.slice(0, 20).map(item => text(item, 240)) : [], active: body.active !== false, updatedBy: adminId, updatedAt: nowIso(), createdAt: body.createdAt || nowIso() }; const existing = rows(db, 'supportKnowledgeBase').find(row => row.id === article.id); if (existing) Object.assign(existing, article); else rows(db, 'supportKnowledgeBase').push(article); event(db, article.id, 'support_knowledge_updated', adminId, { articleId: article.id }); return { ok: true, article } }) }

export function saveTemplate(adminId, body = {}) { return updateAuthorityDb(db => { const name = text(body.name, 120); const content = text(body.content, 4000); if (!name || !content) return { ok: false, status: 400, error: 'template_name_and_content_required' }; const template = { id: body.id || createId('support_template'), name, content, category: text(body.category, 40) || 'other', active: body.active !== false, updatedBy: adminId, updatedAt: nowIso(), createdAt: body.createdAt || nowIso() }; const existing = rows(db, 'supportTemplates').find(row => row.id === template.id); if (existing) Object.assign(existing, template); else rows(db, 'supportTemplates').push(template); event(db, template.id, 'support_template_updated', adminId, { templateId: template.id }); return { ok: true, template } }) }

export function listTemplates() { const db = readAuthorityDb(); return { ok: true, templates: rows(db, 'supportTemplates').filter(row => row.active !== false) } }
export function listKnowledgeBaseAdmin() { const db = readAuthorityDb(); return { ok: true, articles: rows(db, 'supportKnowledgeBase').filter(row => row.active !== false) } }

export function attachMetadata(userId, caseId, body = {}, admin = false) { return updateAuthorityDb(db => { const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId); if (!canAccessCase(supportCase, userId, admin)) return { ok: false, status: 404, error: 'case_not_found' }; const name = text(body.name, 180); const contentType = text(body.contentType, 120); const sizeBytes = Number(body.sizeBytes); if (!name || !contentType || !Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > 10 * 1024 * 1024) return { ok: false, status: 400, error: 'invalid_attachment_metadata' }; const item = { id: createId('support_attachment'), caseId: supportCase.id, name: maskSensitive(name), contentType, sizeBytes, objectKey: null, uploadedBy: userId, createdAt: nowIso() }; rows(db, 'supportAttachments').push(item); event(db, supportCase.id, 'support_attachment_added', userId, { attachmentId: item.id, sizeBytes }); return { ok: true, attachment: item } }) }

export function initAttachment(userId, caseId, body = {}, admin = false) { const supportCase = readAuthorityDb().supportCases?.find(row => row.id === caseId || row.caseNumber === caseId); if (!canAccessCase(supportCase, userId, admin)) return { ok: false, status: 404, error: 'case_not_found' }; const itemId = createId('support_attachment'); const upload = createPrivateUpload({ namespace: 'support', ownerId: supportCase.userId, objectId: itemId, contentType: body.contentType, sizeBytes: body.sizeBytes }); if (!upload.ok) return { ...upload, status: 503 }; return updateAuthorityDb(db => { const item = { id: itemId, caseId: supportCase.id, name: maskSensitive(text(body.name, 180)), contentType: String(body.contentType || '').toLowerCase(), sizeBytes: Number(body.sizeBytes), objectKey: upload.objectKey, status: 'upload_pending', uploadedBy: userId, createdAt: nowIso() }; rows(db, 'supportAttachments').push(item); event(db, supportCase.id, 'support_attachment_upload_started', userId, { attachmentId: item.id }); return { ok: true, attachment: item, uploadUrl: upload.uploadUrl, requiredHeaders: upload.requiredHeaders } }) }
export async function finalizeAttachment(userId, caseId, attachmentId, admin = false) { const db = readAuthorityDb(); const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId); const item = rows(db, 'supportAttachments').find(row => row.id === attachmentId && row.caseId === supportCase?.id); if (!canAccessCase(supportCase, userId, admin) || !item) return { ok: false, status: 404, error: 'attachment_not_found' }; const result = await finalizePrivateUpload({ objectKey: item.objectKey, contentType: item.contentType, expectedSizeBytes: item.sizeBytes }); return updateAuthorityDb(state => { const current = rows(state, 'supportAttachments').find(row => row.id === attachmentId); current.status = result.ok ? 'available' : 'quarantined'; current.sha256 = result.sha256 || null; current.updatedAt = nowIso(); event(state, supportCase.id, result.ok ? 'support_attachment_available' : 'support_attachment_quarantined', userId, { attachmentId }); return result.ok ? { ok: true, attachment: { ...current, downloadUrl: privateDownloadUrl(current.objectKey, 300) } } : { ok: false, status: 422, error: result.error, attachment: current } }) }

export function correctiveAction(adminId, caseId, body = {}) { return updateAuthorityDb(db => { const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId); if (!supportCase) return { ok: false, status: 404, error: 'case_not_found' }; if (body.confirm !== true || !text(body.reason, 500)) return { ok: false, status: 400, error: 'confirmation_and_reason_required' }; const action = text(body.action, 80); const allowed = new Set(['retry_entitlement_sync', 'recalculate_entitlement', 'reissue_credits', 'trigger_verification_email']); if (!allowed.has(action)) return { ok: false, status: 400, error: 'unsupported_corrective_action' }; const userId = supportCase.userId; const subscription = rows(db, 'subscriptions').find(row => row.userId === userId) || null; let wallet = rows(db, 'walletAccounts').find(row => row.userId === userId) || null; const before = { subscription: subscription ? { ...subscription } : null, wallet: wallet ? { ...wallet } : null }; let status = 'queued'; if (action === 'reissue_credits') { const amount = Number(body.amount); if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return { ok: false, status: 400, error: 'invalid_credit_amount' }; if (!wallet) { wallet = { id: createId('wallet'), userId, creditBalance: 0, createdAt: nowIso() }; rows(db, 'walletAccounts').push(wallet) } wallet.creditBalance = Number(wallet.creditBalance || 0) + amount; wallet.updatedAt = nowIso(); rows(db, 'creditLedger').push({ id: createId('credit'), userId, amount, type: 'support_adjustment', caseId: supportCase.id, adminId, reason: text(body.reason, 500), createdAt: nowIso() }); status = 'completed' } const after = { subscription: subscription ? { ...subscription } : null, wallet: wallet ? { ...wallet } : null }; const result = { action, status, reason: text(body.reason, 500), caseId: supportCase.id }; rows(db, 'supportAuditLogs').push({ id: createId('support_action'), caseId: supportCase.id, action, actorId: adminId, before, after, result, createdAt: nowIso() }); event(db, supportCase.id, 'support_corrective_action_recorded', adminId, { action, status, before, after }); notify(db, supportCase.userId, `An authorized support action was recorded for ${supportCase.caseNumber}.`, supportCase.id); return { ok: true, result, before, after } }) }

export function updateCase(adminId, caseId, body = {}) {
  return updateAuthorityDb(db => {
    const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
    if (!supportCase) return { ok: false, status: 404, error: 'case_not_found' }
    const previous = { status: supportCase.status, priority: supportCase.priority, assignedAdminId: supportCase.assignedAdminId, assignedTeam: supportCase.assignedTeam, escalationLevel: supportCase.escalationLevel }
    if (body.status && STATUSES.has(body.status)) supportCase.status = body.status
    if (body.priority && PRIORITIES.has(body.priority)) supportCase.priority = body.priority
    if (body.assignedAdminId !== undefined) {
      const assignedAdminId = text(body.assignedAdminId, 120) || null
      if (assignedAdminId && rows(db, 'adminUsers').length && !rows(db, 'adminUsers').some(row => row.id === assignedAdminId && row.active !== false)) return { ok: false, status: 400, error: 'assigned_admin_not_found' }
      supportCase.assignedAdminId = assignedAdminId
    }
    if (body.assignedTeam !== undefined) {
      const assignedTeam = text(body.assignedTeam, 80) || null
      if (assignedTeam && rows(db, 'supportTeams').length && !rows(db, 'supportTeams').some(row => (row.id === assignedTeam || row.name === assignedTeam) && row.active !== false)) return { ok: false, status: 400, error: 'assigned_team_not_found' }
      supportCase.assignedTeam = assignedTeam
    }
    if (body.escalationLevel !== undefined) supportCase.escalationLevel = Math.min(5, Math.max(1, Number(body.escalationLevel) || 1))
    if (body.status === 'resolved') supportCase.resolvedAt = nowIso()
    if (body.status === 'closed') supportCase.closedAt = nowIso()
    supportCase.updatedAt = nowIso()
    if (previous.assignedAdminId !== supportCase.assignedAdminId || previous.assignedTeam !== supportCase.assignedTeam) {
      rows(db, 'supportAssignments').push({ id: createId('support_assignment'), caseId: supportCase.id, previousAdminId: previous.assignedAdminId, previousTeam: previous.assignedTeam, adminId: supportCase.assignedAdminId, team: supportCase.assignedTeam, assignedAt: nowIso(), reason: text(body.assignmentReason, 500) || null })
      const team = rows(db, 'supportTeams').find(row => row.id === supportCase.assignedTeam || row.name === supportCase.assignedTeam)
      if (team) notifyTeam(db, supportCase, team, `${supportCase.caseNumber} was assigned to ${team.name}.`, 'assignment')
      const assignedAdmin = rows(db, 'adminUsers').find(row => row.id === supportCase.assignedAdminId && row.active !== false)
      if (assignedAdmin) notifyTeam(db, supportCase, { name: `${assignedAdmin.firstName || ''} ${assignedAdmin.lastName || ''}`.trim() || assignedAdmin.email, memberAdminIds: [assignedAdmin.id], notificationEmails: [assignedAdmin.email], whatsappNumbers: [assignedAdmin.phone || assignedAdmin.whatsapp] }, `You were assigned ${supportCase.caseNumber}: ${supportCase.subject}`, 'assignment')
    }
    event(db, supportCase.id, 'support_case_updated', adminId, { previous, next: { status: supportCase.status, priority: supportCase.priority, assignedAdminId: supportCase.assignedAdminId } })
    if (previous.status !== supportCase.status) {
      notify(db, supportCase.userId, `${supportCase.caseNumber} is now ${supportCase.status.replaceAll('_', ' ')}.`, supportCase.id)
      if (supportCase.assignedTeam) {
        const team = rows(db, 'supportTeams').find(row => row.id === supportCase.assignedTeam || row.name === supportCase.assignedTeam)
        if (team && ['escalated'].includes(supportCase.status)) notifyTeam(db, supportCase, team, `${supportCase.caseNumber} is now ${supportCase.status.replaceAll('_', ' ')}.`, 'escalation')
      }
    }
    return { ok: true, case: publicCase(supportCase) }
  })
}

function maskSensitive(value) {
  return String(value || '').replace(/\b\d{12,19}\b/g, '[redacted-number]').replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
}

export function acquireCaseLock(adminId, caseId) {
  return updateAuthorityDb(db => {
    const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
    if (!supportCase) return { ok: false, status: 404, error: 'case_not_found' }
    const now = Date.now(); const current = supportCase.lock
    if (current && current.adminId !== adminId && new Date(current.expiresAt).getTime() > now) return { ok: false, status: 409, error: 'case_locked', lockedBy: current.adminId }
    supportCase.lock = { adminId, acquiredAt: nowIso(), expiresAt: new Date(now + 5 * 60000).toISOString() }
    rows(db, 'supportLocks').push({ id: createId('support_lock'), caseId: supportCase.id, adminId, expiresAt: supportCase.lock.expiresAt, createdAt: nowIso() })
    event(db, supportCase.id, 'support_case_locked', adminId, { expiresAt: supportCase.lock.expiresAt })
    return { ok: true, case: publicCase(supportCase) }
  })
}

export function configureSupport(adminId, body = {}) {
  return updateAuthorityDb(db => {
    if (body.sla && typeof body.sla === 'object') {
      for (const priority of PRIORITIES) {
        const value = body.sla[priority]; if (!value) continue
        const next = { id: createId('support_sla'), priority, firstResponseMinutes: Math.max(1, Number(value.firstResponseMinutes) || 60), resolutionMinutes: Math.max(1, Number(value.resolutionMinutes) || 240), active: true, updatedBy: adminId, updatedAt: nowIso() }
        rows(db, 'supportSlaPolicies').filter(row => row.priority === priority).forEach(row => { row.active = false })
        rows(db, 'supportSlaPolicies').push(next)
      }
    }
    if (typeof body.businessHoursEnabled === 'boolean') rows(db, 'supportSettings').push({ id: createId('support_setting'), key: 'businessHoursEnabled', value: body.businessHoursEnabled, updatedBy: adminId, updatedAt: nowIso() })
    for (const key of ['duplicateCooldownHours', 'resolutionGraceHours', 'retentionDays', 'incidentThreshold']) if (body[key] !== undefined) rows(db, 'supportSettings').push({ id: createId('support_setting'), key, value: Math.max(1, Number(body[key]) || 1), updatedBy: adminId, updatedAt: nowIso() })
    if (Array.isArray(body.categories)) for (const item of body.categories) { const key = text(item.key, 40).toLowerCase(); if (!key) continue; const current = rows(db, 'supportCategories').find(row => row.key === key); const next = { id: current?.id || createId('support_category'), key, label: text(item.label, 100) || key, exemptFromCooldown: item.exemptFromCooldown === true, active: item.active !== false, updatedBy: adminId, updatedAt: nowIso() }; if (current) Object.assign(current, next); else rows(db, 'supportCategories').push(next) }
    if (Array.isArray(body.teams)) for (const item of body.teams) {
      const name = text(item.name, 80); if (!name) continue
      const current = rows(db, 'supportTeams').find(row => row.id === item.id || row.name === name)
      const next = {
        id: current?.id || text(item.id, 120) || createId('support_team'), name,
        level: Math.min(5, Math.max(1, Number(item.level) || 1)),
        categories: Array.isArray(item.categories) ? item.categories.slice(0, 30).map(value => text(value, 40)) : [],
        memberAdminIds: Array.isArray(item.memberAdminIds) ? item.memberAdminIds.slice(0, 100).map(value => text(value, 120)).filter(Boolean) : (current?.memberAdminIds || []),
        notificationEmails: Array.isArray(item.notificationEmails) ? item.notificationEmails.slice(0, 100).map(value => text(value, 180).toLowerCase()).filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) : (current?.notificationEmails || []),
        whatsappNumbers: Array.isArray(item.whatsappNumbers) ? item.whatsappNumbers.slice(0, 100).map(value => text(value, 30)).filter(value => /^\+?[1-9]\d{7,19}$/.test(value.replace(/[\s().-]/g, ''))) : (current?.whatsappNumbers || []),
        notifyEmail: item.notifyEmail !== false, notifyWhatsapp: item.notifyWhatsapp !== false,
        active: item.active !== false, updatedBy: adminId, updatedAt: nowIso(),
      }
      if (current) Object.assign(current, next); else rows(db, 'supportTeams').push(next)
    }
    event(db, null, 'support_configuration_updated', adminId, { keys: Object.keys(body) })
    return { ok: true, settings: rows(db, 'supportSettings'), sla: rows(db, 'supportSlaPolicies').filter(row => row.active !== false) }
  })
}

export function supportConfiguration() {
  const db = readAuthorityDb(); return { ok: true, settings: rows(db, 'supportSettings'), sla: rows(db, 'supportSlaPolicies').filter(row => row.active !== false), categories: rows(db, 'supportCategories'), teams: rows(db, 'supportTeams'), templates: rows(db, 'supportTemplates'), knowledgeBase: rows(db, 'supportKnowledgeBase') }
}

export function runMaintenance() {
  return updateAuthorityDb(db => {
    const now = Date.now(); const changed = []; const resolvedGrace = Number(setting(db, 'resolutionGraceHours', 72)) * 3600000
    for (const row of rows(db, 'supportCases')) {
      if (!['resolved', 'closed'].includes(row.status) && new Date(row.resolutionDueAt).getTime() <= now && row.status !== 'escalated') { row.status = 'escalated'; row.escalationLevel = Math.max(2, Number(row.escalationLevel) || 1); row.escalationStatus = 'sla_breached'; row.updatedAt = nowIso(); event(db, row.id, 'support_case_sla_breached', 'system', { resolutionDueAt: row.resolutionDueAt }); const team = rows(db, 'supportTeams').find(teamRow => teamRow.id === row.assignedTeam || teamRow.name === row.assignedTeam); if (team) notifyTeam(db, row, team, `${row.caseNumber} breached its resolution SLA and was escalated.`, 'sla'); changed.push(row.id) }
      if (row.status === 'escalated' && row.escalationStatus === 'sla_breached' && !row.slaBreachNotifiedAt) { row.slaBreachNotifiedAt = nowIso(); notify(db, row.userId, `${row.caseNumber} has been escalated because its resolution SLA was reached.`, row.id) }
      if (row.status === 'resolved' && row.resolvedAt && new Date(row.resolvedAt).getTime() + resolvedGrace <= now) { row.status = 'closed'; row.closedAt = nowIso(); row.updatedAt = nowIso(); event(db, row.id, 'support_case_closed', 'system', { reason: 'resolution_grace_expired' }); notify(db, row.userId, `${row.caseNumber} was closed after the resolution grace period.`, row.id); changed.push(row.id) }
    }
    const threshold = Number(setting(db, 'incidentThreshold', 5)); const cutoff = now - 30 * 60000
    for (const category of [...new Set(rows(db, 'supportCases').map(row => row.category))]) { const cluster = rows(db, 'supportCases').filter(row => row.category === category && new Date(row.createdAt).getTime() >= cutoff); if (cluster.length < threshold) continue; const existing = rows(db, 'supportIncidents').find(row => row.category === category && row.status === 'open'); if (!existing) { const incident = { id: createId('support_incident'), category, caseIds: cluster.map(row => row.id), count: cluster.length, status: 'open', detectedAt: nowIso() }; rows(db, 'supportIncidents').push(incident); rows(db, 'supportIntelligenceSignals').push({ id: createId('support_signal'), source: 'CUSTOMER_CARE', domain: 'ADMIN_INTELLIGENCE', type: 'incident_cluster', category, evidenceCount: cluster.length, referenceIds: incident.caseIds, createdAt: nowIso() }); event(db, null, 'support_incident_detected', 'system', { incidentId: incident.id, category, count: cluster.length }) } }
    const retentionCutoff = now - Number(setting(db, 'retentionDays', 730)) * 86400000
    for (const message of rows(db, 'supportMessages')) if (new Date(message.createdAt).getTime() < retentionCutoff && !message.retentionProcessedAt) { message.message = '[retained record redacted under support retention policy]'; message.retentionProcessedAt = nowIso(); event(db, message.caseId, 'support_message_retention_redaction', 'system', { messageId: message.id }) }
    return { ok: true, changed, incidents: rows(db, 'supportIncidents').filter(row => row.status === 'open').length }
  })
}

export function diagnostics(userId, caseId, admin = false) {
  const db = readAuthorityDb(); const supportCase = rows(db, 'supportCases').find(row => row.id === caseId || row.caseNumber === caseId)
  if (!canAccessCase(supportCase, userId, admin)) return { ok: false, status: 404, error: 'case_not_found' }
  const profile = rows(db, 'profiles').find(row => row.id === supportCase.userId) || {}
  const user = rows(db, 'users').find(row => row.id === supportCase.userId) || {}
  return { ok: true, diagnostics: { user: { id: user.id, email: admin ? maskSensitive(user.email) : undefined, role: profile.role }, subscription: rows(db, 'subscriptions').find(row => row.userId === user.id) || null, wallet: rows(db, 'walletAccounts').find(row => row.userId === user.id) || null, credits: rows(db, 'creditLedger').filter(row => row.userId === user.id).slice(-20), payments: rows(db, 'paymentIntents').filter(row => row.userId === user.id).slice(-20), projects: rows(db, 'projects').filter(row => row.ownerId === user.id || row.userId === user.id) } }
}

export function analytics() {
  const db = readAuthorityDb(); const cases = rows(db, 'supportCases'); const feedback = rows(db, 'supportFeedback')
  const by = key => Object.fromEntries([...new Set(cases.map(row => row[key]))].map(value => [value, cases.filter(row => row[key] === value).length]))
  const responseTimes = cases.filter(row => row.firstRespondedAt).map(row => new Date(row.firstRespondedAt) - new Date(row.createdAt)); const resolutionTimes = cases.filter(row => row.resolvedAt).map(row => new Date(row.resolvedAt) - new Date(row.createdAt)); const averageHours = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length / 36000) / 100 : null
  return { ok: true, analytics: { total: cases.length, byCategory: by('category'), byPriority: by('priority'), byStatus: by('status'), satisfaction: feedback.length ? Math.round(feedback.reduce((sum, row) => sum + row.rating, 0) / feedback.length * 100) / 100 : null, feedbackCount: feedback.length, averageFirstResponseHours: averageHours(responseTimes), averageResolutionHours: averageHours(resolutionTimes), reopenRate: cases.length ? Math.round(cases.filter(row => row.status === 'reopened').length / cases.length * 10000) / 100 : 0, incidents: rows(db, 'supportIncidents'), intelligenceSignals: rows(db, 'supportIntelligenceSignals') } }
}

export function intelligenceProjection() {
  const db = readAuthorityDb(); const cases = rows(db, 'supportCases'); const open = cases.filter(row => !['resolved', 'closed'].includes(row.status)); const topCategory = Object.entries(cases.reduce((acc, row) => { acc[row.category] = (acc[row.category] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])[0] || null
  return { ok: true, projection: { source: 'CUSTOMER_CARE', sourceClassification: 'PLATFORM_USER_EXPERIENCE_EVIDENCE', generatedAt: nowIso(), openCases: open.length, strongestComplaint: topCategory ? { category: topCategory[0], count: topCategory[1] } : null, incidents: rows(db, 'supportIncidents').filter(row => row.status === 'open'), signals: rows(db, 'supportIntelligenceSignals').slice(-50), recommendedAction: topCategory ? `Investigate recurring ${topCategory[0]} support complaints.` : null } }
}

export function submitFeedback(userId, caseId, body = {}) {
  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, status: 400, error: 'rating_must_be_1_to_5' }
  return updateAuthorityDb(db => {
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
  const db = readAuthorityDb()
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
