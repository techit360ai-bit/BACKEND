import { createHash } from 'node:crypto'
import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'

const DAY = 86400000
const INTERNAL_ROLES = new Set(['owner', 'admin', 'executive', 'program_director', 'program_manager', 'mentor_manager', 'reviewer', 'analyst', 'operations', 'communications', 'finance', 'partner', 'read_only', 'mentor'])
const PERMISSIONS = Object.freeze({
  view: new Set([...INTERNAL_ROLES]),
  edit: new Set(['owner', 'admin', 'executive']),
  members: new Set(['owner', 'admin', 'executive']),
  programs: new Set(['owner', 'admin', 'executive', 'program_director', 'program_manager']),
  startups: new Set(['owner', 'admin', 'executive', 'program_director', 'program_manager', 'mentor_manager', 'mentor', 'reviewer', 'analyst', 'operations', 'read_only', 'partner']),
  metrics: new Set(['owner', 'admin', 'executive', 'program_director', 'program_manager', 'reviewer', 'analyst', 'operations', 'read_only', 'partner']),
  risks: new Set(['owner', 'admin', 'executive', 'program_director', 'program_manager', 'mentor_manager', 'reviewer', 'analyst', 'operations']),
  actions: new Set(['owner', 'admin', 'executive', 'program_director', 'program_manager', 'mentor_manager', 'operations']),
  kpis: new Set(['owner', 'admin', 'executive', 'program_director', 'program_manager', 'analyst']),
  audit: new Set(['owner', 'admin', 'executive', 'analyst']),
})

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const clean = value => typeof value === 'string' ? value.trim() : value
const timestamp = value => { const time = new Date(value || 0).getTime(); return Number.isFinite(time) ? time : 0 }
const ageDays = value => Math.max(0, Math.floor((Date.now() - timestamp(value)) / DAY))
const sha = value => createHash('sha256').update(String(value || '')).digest('hex')

function membershipFor(db, userId, organizationId) {
  return rows(db, 'organizationMemberships').find(row => row.organizationId === organizationId && row.userId === userId && row.status === 'active') || null
}

function legacyOrganizationAccess(db, userId, organizationId) {
  if (organizationId !== userId) return false
  return rows(db, 'organizations').some(row => row.id === userId) || rows(db, 'projects').some(row => row.organizationId === userId) || rows(db, 'organizationDashboards').some(row => row.ownerId === userId)
}

export function resolveOrganizationContext(userId, requestedOrganizationId = null) {
  const db = readDb()
  const active = rows(db, 'activeContexts').find(row => row.userId === userId && row.status === 'active')
  const candidate = requestedOrganizationId || active?.organizationId || null
  const organizationId = candidate || (legacyOrganizationAccess(db, userId, userId) ? userId : null)
  if (!organizationId) return { ok: false, error: 'organization_context_required' }
  const membership = membershipFor(db, userId, organizationId)
  const legacy = !membership && legacyOrganizationAccess(db, userId, organizationId)
  if (!membership && !legacy) return { ok: false, error: 'organization_access_denied' }
  const role = membership?.role || 'owner'
  if (!INTERNAL_ROLES.has(role)) return { ok: false, error: 'organization_role_invalid' }
  return { ok: true, organizationId, role, membership, legacy }
}

export function requireOrganizationPermission(userId, permission, organizationId = null) {
  const context = resolveOrganizationContext(userId, organizationId)
  if (!context.ok) return context
  if (!PERMISSIONS[permission]?.has(context.role)) return { ...context, ok: false, error: 'organization_permission_denied', permission }
  return context
}

function inWindow(value, since) { return timestamp(value) >= since }
function scoped(db, name, organizationId, fields = ['organizationId']) { return rows(db, name).filter(row => fields.some(field => row[field] === organizationId)) }
function projectRows(db, organizationId) { return rows(db, 'projects').filter(row => row.organizationId === organizationId) }
function programRows(db, organizationId) { return scoped(db, 'organizationPrograms', organizationId) }
function membershipRows(db, organizationId) { return rows(db, 'organizationMemberships').filter(row => row.organizationId === organizationId && row.status === 'active') }
function score(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null }
function average(values) { const usable = values.filter(value => value !== null && Number.isFinite(value)); return usable.length ? Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length) : null }
function healthDimensions(db, organizationId) {
  const projects = projectRows(db, organizationId); const programs = programRows(db, organizationId); const members = membershipRows(db, organizationId)
  const tasks = scoped(db, 'workspaceTasks', organizationId, ['organizationId', 'ownerOrganizationId']); const mentors = scoped(db, 'mentorshipRooms', organizationId)
  const risks = scoped(db, 'organizationRiskSignals', organizationId)
  const programPerformance = programs.length ? Math.round(programs.filter(row => !['archived', 'completed', 'closed'].includes(String(row.status))).length / programs.length * 100) : null
  const startupPerformance = average(projects.map(row => score(row.gsisScore ?? row.progress)))
  const memberEngagement = members.length ? Math.round(members.filter(row => ageDays(row.lastActiveAt || row.updatedAt) <= 30).length / members.length * 100) : null
  const mentorship = mentors.length ? Math.round(mentors.filter(row => ageDays(row.updatedAt || row.createdAt) <= 30).length / mentors.length * 100) : null
  const execution = average(projects.map(row => score(row.progress)))
  const risk = risks.length ? Math.max(0, 100 - Math.round(risks.reduce((sum, row) => sum + ({ critical: 100, high: 70, medium: 40, low: 15 }[String(row.severity).toLowerCase()] || 0), 0) / risks.length)) : null
  const dimensions = { programPerformance, startupPerformance, memberEngagement, mentorship, execution, risk }
  return { dimensions, score: average(Object.values(dimensions)), availability: Object.fromEntries(Object.entries(dimensions).map(([key, value]) => [key, value !== null])) }
}

function audit(db, context, actorId, action, resourceType, resourceId, previousState = null, newState = null, metadata = {}) {
  const events = rows(db, 'organizationAuditEvents').filter(row => row.organizationId === context.organizationId); const previous = events.at(-1); const createdAt = nowIso(); const payload = { organizationId: context.organizationId, actorId, action, resourceType, resourceId, previousState, newState, metadata, createdAt }; const event = { id: createId('org_audit'), ...payload, previousHash: previous?.eventHash || 'GENESIS', eventHash: sha(`${previous?.eventHash || 'GENESIS'}|${JSON.stringify(payload)}`) }; rows(db, 'organizationAuditEvents').push(event); return event
}

export function organizationOverview(userId, organizationId = null) {
  const context = requireOrganizationPermission(userId, 'metrics', organizationId); if (!context.ok) return context
  const db = readDb(); const projects = projectRows(db, context.organizationId); const programs = programRows(db, context.organizationId); const members = membershipRows(db, context.organizationId); const mentors = scoped(db, 'mentorshipRooms', context.organizationId); const partners = scoped(db, 'organizationPartners', context.organizationId); const health = healthDimensions(db, context.organizationId); const risks = scoped(db, 'organizationRiskSignals', context.organizationId).filter(row => !['resolved', 'dismissed'].includes(row.status)); const actions = scoped(db, 'organizationActions', context.organizationId).filter(row => !['completed', 'dismissed'].includes(row.status));
  return { ok: true, organizationId: context.organizationId, role: context.role, metrics: { activePrograms: programs.filter(row => !['archived', 'completed', 'closed'].includes(String(row.status))).length, activeCohorts: programs.reduce((sum, row) => sum + Number(row.cohortCount || 0), 0), startups: projects.length, mentors: mentors.length, members: members.length, partners: partners.length }, health, risks: { total: risks.length, critical: risks.filter(row => row.severity === 'critical').length, high: risks.filter(row => row.severity === 'high').length, medium: risks.filter(row => row.severity === 'medium').length, low: risks.filter(row => row.severity === 'low').length }, actions: { total: actions.length, critical: actions.filter(row => row.priority === 'critical').length, high: actions.filter(row => row.priority === 'high').length }, generatedAt: nowIso(), deterministic: true }
}

export function organizationPulse(userId, { organizationId = null, window = '7d' } = {}) {
  const context = requireOrganizationPermission(userId, 'metrics', organizationId); if (!context.ok) return context
  const db = readDb(); const days = ({ today: 1, yesterday: 2, '7d': 7, '30d': 30 }[window] || 7); const since = Date.now() - days * DAY; const projects = projectRows(db, context.organizationId); const programs = programRows(db, context.organizationId); const risks = scoped(db, 'organizationRiskSignals', context.organizationId); const actions = scoped(db, 'organizationActions', context.organizationId); const activities = scoped(db, 'organizationActivityEvents', context.organizationId); const changed = list => list.filter(row => inWindow(row.updatedAt || row.createdAt || row.detectedAt, since));
  return { ok: true, organizationId: context.organizationId, window, since: new Date(since).toISOString(), changes: { startupsUpdated: changed(projects).length, programsUpdated: changed(programs).length, risksDetected: changed(risks).filter(row => !['resolved', 'dismissed'].includes(row.status)).length, actionsCreated: changed(actions).filter(row => row.status !== 'completed').length, activities: changed(activities).length }, activity: changed([...activities, ...projects.map(row => ({ id: `startup:${row.id}`, type: 'startup_updated', message: `${row.title || row.name || row.id} updated`, updatedAt: row.updatedAt }))]).sort((a, b) => timestamp(b.updatedAt || b.createdAt) - timestamp(a.updatedAt || a.createdAt)).slice(0, 50), deterministic: true }
}

export function organizationRisks(userId, filters = {}) {
  const context = requireOrganizationPermission(userId, 'risks', filters.organizationId); if (!context.ok) return context; const db = readDb(); let risks = scoped(db, 'organizationRiskSignals', context.organizationId).filter(row => !['resolved', 'dismissed'].includes(row.status)); for (const key of ['severity', 'type', 'ownerId', 'status']) if (filters[key]) risks = risks.filter(row => row[key] === filters[key]); return { ok: true, organizationId: context.organizationId, risks: risks.sort((a, b) => ({ critical: 4, high: 3, medium: 2, low: 1 }[b.severity] || 0) - ({ critical: 4, high: 3, medium: 2, low: 1 }[a.severity] || 0)), deterministic: true } }

export function listOrganizationActions(userId, filters = {}) { const context = requireOrganizationPermission(userId, 'actions', filters.organizationId); if (!context.ok) return context; const db = readDb(); let actions = scoped(db, 'organizationActions', context.organizationId); for (const key of ['status', 'priority', 'ownerId', 'sourceType']) if (filters[key]) actions = actions.filter(row => row[key] === filters[key]); return { ok: true, organizationId: context.organizationId, actions: actions.sort((a, b) => timestamp(a.dueDate) - timestamp(b.dueDate)), deterministic: true } }
export function createOrganizationAction(userId, body = {}) { const context = requireOrganizationPermission(userId, 'actions', body.organizationId); if (!context.ok) return context; const title = clean(body.title); if (!title) return { ok: false, error: 'action_title_required' }; const priority = ['critical', 'high', 'normal', 'low'].includes(body.priority) ? body.priority : 'normal'; return updateDb(db => { const row = { id: createId('org_action'), organizationId: context.organizationId, title, reason: clean(body.reason) || null, evidence: Array.isArray(body.evidence) ? body.evidence.slice(0, 20) : [], sourceType: clean(body.sourceType) || 'manual', sourceId: clean(body.sourceId) || null, ownerId: clean(body.ownerId) || userId, priority, dueDate: body.dueDate || null, status: 'open', createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }; rows(db, 'organizationActions').push(row); audit(db, context, userId, 'action_created', 'organization_action', row.id, null, row); return { ok: true, action: row } }) }
export function updateOrganizationAction(userId, actionId, body = {}) { return updateDb(db => { const context = requireOrganizationPermission(userId, 'actions', body.organizationId); if (!context.ok) return context; const row = rows(db, 'organizationActions').find(item => item.id === actionId && item.organizationId === context.organizationId); if (!row) return { ok: false, error: 'action_not_found' }; if (body.status !== undefined && !['open', 'in_progress', 'blocked', 'completed', 'dismissed'].includes(body.status)) return { ok: false, error: 'invalid_action_status' }; const previous = { ...row }; for (const key of ['status', 'ownerId', 'priority', 'dueDate', 'reason']) if (body[key] !== undefined) row[key] = clean(body[key]); row.updatedAt = nowIso(); audit(db, context, userId, 'action_updated', 'organization_action', row.id, previous, row); return { ok: true, action: row } }) }

export function listOrganizationKpis(userId, organizationId = null) { const context = requireOrganizationPermission(userId, 'kpis', organizationId); if (!context.ok) return context; const db = readDb(); const definitions = rows(db, 'organizationKpiDefinitions').filter(row => row.organizationId === context.organizationId); return { ok: true, organizationId: context.organizationId, kpis: definitions.map(definition => ({ ...definition, values: rows(db, 'organizationKpiValues').filter(row => row.definitionId === definition.id).sort((a, b) => timestamp(b.periodEnd || b.createdAt) - timestamp(a.periodEnd || a.createdAt)).slice(0, 12) })), deterministic: true } }
export function saveOrganizationKpi(userId, body = {}) { const context = requireOrganizationPermission(userId, 'kpis', body.organizationId); if (!context.ok) return context; const name = clean(body.name); if (!name) return { ok: false, error: 'kpi_name_required' }; return updateDb(db => { let definition = rows(db, 'organizationKpiDefinitions').find(row => row.id === body.id && row.organizationId === context.organizationId); if (!definition) { definition = { id: createId('org_kpi'), organizationId: context.organizationId, name, definition: clean(body.definition) || null, unit: clean(body.unit) || 'count', target: body.target == null ? null : Number(body.target), frequency: clean(body.frequency) || 'monthly', ownerId: clean(body.ownerId) || userId, visibility: clean(body.visibility) || 'organization', createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }; rows(db, 'organizationKpiDefinitions').push(definition) } else { for (const key of ['name', 'definition', 'unit', 'frequency', 'ownerId', 'visibility']) if (body[key] !== undefined) definition[key] = clean(body[key]); if (body.target !== undefined) definition.target = Number(body.target); definition.updatedAt = nowIso() } if (body.value !== undefined) rows(db, 'organizationKpiValues').push({ id: createId('org_kpi_value'), definitionId: definition.id, organizationId: context.organizationId, value: Number(body.value), source: clean(body.source) || 'manual', periodStart: body.periodStart || null, periodEnd: body.periodEnd || null, recordedBy: userId, createdAt: nowIso() }); audit(db, context, userId, 'kpi_updated', 'organization_kpi', definition.id, null, definition); return { ok: true, kpi: definition } }) }

export function verifyOrganizationAudit(userId, organizationId = null) { const context = requireOrganizationPermission(userId, 'audit', organizationId); if (!context.ok) return context; const events = rows(readDb(), 'organizationAuditEvents').filter(row => row.organizationId === context.organizationId); let previous = 'GENESIS'; const failures = []; for (const event of events) { const expected = sha(`${previous}|${JSON.stringify({ organizationId: event.organizationId, actorId: event.actorId, action: event.action, resourceType: event.resourceType, resourceId: event.resourceId, previousState: event.previousState, newState: event.newState, metadata: event.metadata, createdAt: event.createdAt })}`); if (event.previousHash !== previous || event.eventHash !== expected) failures.push(event.id); previous = event.eventHash } return { ok: true, organizationId: context.organizationId, valid: failures.length === 0, eventCount: events.length, failures } }

export function organizationBriefingEvidence(userId, organizationId = null) { const overview = organizationOverview(userId, organizationId); if (!overview.ok) return overview; const pulse = organizationPulse(userId, { organizationId: overview.organizationId, window: '7d' }); const risks = organizationRisks(userId, { organizationId: overview.organizationId }); return { organizationId: overview.organizationId, overview, pulse, risks, instructions: 'Provide an evidence-grounded organizational briefing. Do not invent metrics, authorize access, mutate state, or make billing decisions.' } }

function riskRecommendation(risk) {
  const actions = { startup_inactivity: 'Schedule a startup progress review and confirm the next milestone.', low_startup_health: 'Review the startup evidence and assign a targeted intervention.', program_deadline: 'Review the program timeline, owners, and incomplete deliverables.', mentorship_inactivity: 'Confirm mentor availability and consider reassignment.' }
  return actions[risk.type] || 'Assign an owner to review the evidence and record an outcome.'
}

export function refreshOrganizationIntelligence(userId, organizationId = null) {
  const context = requireOrganizationPermission(userId, 'risks', organizationId); if (!context.ok) return context
  return updateDb(db => {
    const detected = []; const current = nowIso(); const projects = projectRows(db, context.organizationId); const programs = programRows(db, context.organizationId); const mentorship = scoped(db, 'mentorshipRooms', context.organizationId)
    for (const project of projects) {
      const inactivity = ageDays(project.updatedAt || project.createdAt)
      if (inactivity >= 14) detected.push({ type: 'startup_inactivity', severity: inactivity >= 30 ? 'high' : 'medium', title: `${project.title || 'Startup'} is inactive`, reason: `No recorded startup update for ${inactivity} days.`, evidence: [{ type: 'inactivity_days', value: inactivity }], sourceType: 'startup', sourceId: project.id })
      if (Number(project.gsisScore || 0) > 0 && Number(project.gsisScore) < 40) detected.push({ type: 'low_startup_health', severity: 'high', title: `${project.title || 'Startup'} requires attention`, reason: `GSIS is ${Number(project.gsisScore)}.`, evidence: [{ type: 'gsis', value: Number(project.gsisScore) }], sourceType: 'startup', sourceId: project.id })
    }
    for (const program of programs) if (program.endDate && timestamp(program.endDate) < Date.now() && !['completed', 'closed', 'archived'].includes(String(program.status))) detected.push({ type: 'program_deadline', severity: 'high', title: `${program.name || program.title || 'Program'} passed its end date`, reason: 'The program remains active after its recorded end date.', evidence: [{ type: 'end_date', value: program.endDate }], sourceType: 'program', sourceId: program.id })
    for (const room of mentorship) { const inactivity = ageDays(room.updatedAt || room.createdAt); if (inactivity >= 30) detected.push({ type: 'mentorship_inactivity', severity: 'medium', title: `${room.name || 'Mentorship room'} is inactive`, reason: `No mentorship update for ${inactivity} days.`, evidence: [{ type: 'inactivity_days', value: inactivity }], sourceType: 'mentorship', sourceId: room.id }) }
    const risks = rows(db, 'organizationRiskSignals'); const recommendations = rows(db, 'organizationRecommendations')
    for (const item of detected) {
      const fingerprint = sha(`${context.organizationId}|${item.type}|${item.sourceType}|${item.sourceId}`); let risk = risks.find(row => row.fingerprint === fingerprint && !['resolved', 'dismissed'].includes(row.status))
      if (!risk) { risk = { id: createId('org_risk'), organizationId: context.organizationId, fingerprint, ...item, ownerId: null, status: 'open', detectedAt: current, updatedAt: current }; risks.push(risk); audit(db, context, userId, 'risk_detected', 'organization_risk', risk.id, null, risk) } else Object.assign(risk, item, { updatedAt: current })
      if (!recommendations.some(row => row.riskId === risk.id && row.status === 'active')) recommendations.push({ id: createId('org_recommendation'), organizationId: context.organizationId, riskId: risk.id, recommendation: riskRecommendation(risk), why: risk.reason, evidence: risk.evidence, confidence: risk.evidence.length > 1 ? 'high' : 'medium', priority: risk.severity, expectedOutcome: 'Documented review and a measurable follow-up action.', suggestedOwnerRole: risk.type.startsWith('program') ? 'program_manager' : risk.type.startsWith('mentorship') ? 'mentor_manager' : 'program_manager', status: 'active', deterministic: true, createdAt: current, updatedAt: current })
    }
    const health = healthDimensions(db, context.organizationId); const snapshot = { id: createId('org_health'), organizationId: context.organizationId, ...health, capturedAt: current, createdBy: userId }; rows(db, 'organizationHealthSnapshots').push(snapshot)
    return { ok: true, organizationId: context.organizationId, detected: detected.length, risks: risks.filter(row => row.organizationId === context.organizationId && !['resolved', 'dismissed'].includes(row.status)), recommendations: recommendations.filter(row => row.organizationId === context.organizationId && row.status === 'active'), snapshot, deterministic: true }
  })
}

export function organizationRecommendations(userId, organizationId = null) { const context = requireOrganizationPermission(userId, 'risks', organizationId); if (!context.ok) return context; return { ok: true, organizationId: context.organizationId, recommendations: scoped(readDb(), 'organizationRecommendations', context.organizationId).filter(row => row.status === 'active'), deterministic: true } }
export function organizationActivity(userId, { organizationId = null, limit = 50, cursor = null } = {}) { const context = requireOrganizationPermission(userId, 'view', organizationId); if (!context.ok) return context; const maximum = Math.min(100, Math.max(1, Number(limit) || 50)); const events = scoped(readDb(), 'organizationActivityEvents', context.organizationId).filter(row => !cursor || timestamp(row.createdAt) < timestamp(cursor)).sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)).slice(0, maximum); return { ok: true, organizationId: context.organizationId, events, nextCursor: events.length === maximum ? events.at(-1)?.createdAt : null } }
export function organizationMembers(userId, organizationId = null) { const context = requireOrganizationPermission(userId, 'view', organizationId); if (!context.ok) return context; const db = readDb(); const profiles = rows(db, 'profiles'); return { ok: true, organizationId: context.organizationId, members: membershipRows(db, context.organizationId).map(row => ({ ...row, profile: (() => { const profile = profiles.find(item => item.id === row.userId); return profile ? { firstName: profile.firstName, lastName: profile.lastName, avatarUrl: profile.avatarUrl } : null })() })) } }
export function updateOrganizationMember(userId, memberId, body = {}) { return updateDb(db => { const context = requireOrganizationPermission(userId, 'members', body.organizationId); if (!context.ok) return context; const member = rows(db, 'organizationMemberships').find(row => row.id === memberId && row.organizationId === context.organizationId); if (!member) return { ok: false, error: 'organization_member_not_found' }; const previous = { ...member }; if (body.role !== undefined) { const role = clean(body.role); if (!INTERNAL_ROLES.has(role)) return { ok: false, error: 'organization_role_invalid' }; if (member.role === 'owner' && role !== 'owner' && membershipRows(db, context.organizationId).filter(row => row.role === 'owner').length <= 1) return { ok: false, error: 'last_organization_owner_required' }; member.role = role } if (body.status !== undefined) { if (!['active', 'suspended', 'revoked'].includes(body.status)) return { ok: false, error: 'organization_member_status_invalid' }; member.status = body.status } member.updatedAt = nowIso(); audit(db, context, userId, 'member_updated', 'organization_membership', member.id, previous, member); return { ok: true, member } }) }

function createScopedRecord(userId, permission, collectionName, prefix, body, requiredField = 'name') {
  const context = requireOrganizationPermission(userId, permission, body.organizationId)
  if (!context.ok) return context
  const value = clean(body[requiredField])
  if (!value) return { ok: false, error: `${requiredField}_required` }
  return updateDb(db => {
    const { id: _ignoredId, organizationId: _ignoredOrganizationId, organization_id: _ignoredSnakeOrganizationId, createdBy: _ignoredCreatedBy, createdAt: _ignoredCreatedAt, updatedAt: _ignoredUpdatedAt, ...attributes } = body
    const row = { id: createId(prefix), ...attributes, [requiredField]: value, organizationId: context.organizationId, createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
    rows(db, collectionName).push(row)
    audit(db, context, userId, `${prefix}_created`, prefix, row.id, null, row)
    return { ok: true, record: row }
  })
}
export function listOrganizationCohorts(userId, organizationId = null) { const context = requireOrganizationPermission(userId, 'programs', organizationId); if (!context.ok) return context; return { ok: true, cohorts: scoped(readDb(), 'organizationCohorts', context.organizationId) } }
export const createOrganizationCohort = (userId, body = {}) => createScopedRecord(userId, 'programs', 'organizationCohorts', 'org_cohort', body)
export function listOrganizationPartners(userId, organizationId = null) { const context = requireOrganizationPermission(userId, 'view', organizationId); if (!context.ok) return context; return { ok: true, partners: scoped(readDb(), 'organizationPartners', context.organizationId) } }
export const createOrganizationPartner = (userId, body = {}) => createScopedRecord(userId, 'edit', 'organizationPartners', 'org_partner', body)
export function listOrganizationResources(userId, organizationId = null) { const context = requireOrganizationPermission(userId, 'view', organizationId); if (!context.ok) return context; return { ok: true, resources: scoped(readDb(), 'organizationResources', context.organizationId).filter(row => row.visibility === 'organization' || row.createdBy === userId || context.role !== 'partner') } }
export const createOrganizationResource = (userId, body = {}) => createScopedRecord(userId, 'programs', 'organizationResources', 'org_resource', body, 'title')
export function listReportSchedules(userId, organizationId = null) { const context = requireOrganizationPermission(userId, 'metrics', organizationId); if (!context.ok) return context; return { ok: true, schedules: scoped(readDb(), 'organizationReportSchedules', context.organizationId) } }
export function createReportSchedule(userId, body = {}) {
  const context = requireOrganizationPermission(userId, 'kpis', body.organizationId)
  if (!context.ok) return context
  if (!['daily', 'weekly', 'monthly', 'quarterly'].includes(body.frequency)) return { ok: false, error: 'report_frequency_invalid' }
  return updateDb(db => {
    const memberIds = new Set(membershipRows(db, context.organizationId).map(row => row.userId))
    memberIds.add(context.organizationId)
    const recipients = Array.isArray(body.recipients)
      ? body.recipients.filter(recipient => memberIds.has(String(recipient))).slice(0, 50)
      : []
    const row = { id: createId('org_report_schedule'), organizationId: context.organizationId, reportType: clean(body.reportType) || 'executive', frequency: body.frequency, recipients, filters: body.filters && typeof body.filters === 'object' ? body.filters : {}, active: body.active !== false, createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
    rows(db, 'organizationReportSchedules').push(row)
    audit(db, context, userId, 'report_schedule_created', 'organization_report_schedule', row.id, null, row)
    return { ok: true, schedule: row }
  })
}
export function organizationAuditEvents(userId, { organizationId = null, limit = 50 } = {}) { const context = requireOrganizationPermission(userId, 'audit', organizationId); if (!context.ok) return context; return { ok: true, organizationId: context.organizationId, events: scoped(readDb(), 'organizationAuditEvents', context.organizationId).slice(-Math.min(100, Math.max(1, Number(limit) || 50))).reverse() } }

export function organizationStartupPortfolio(userId, filters = {}) {
  const context = requireOrganizationPermission(userId, 'startups', filters.organizationId); if (!context.ok) return context
  const db = readDb(); const limit = Math.min(100, Math.max(1, Number(filters.limit) || 25)); const offset = Math.max(0, Number(filters.offset) || 0); let projects = projectRows(db, context.organizationId)
  if (filters.programId) projects = projects.filter(row => row.programId === filters.programId); if (filters.cohortId) projects = projects.filter(row => row.cohortId === filters.cohortId); if (filters.stage) projects = projects.filter(row => row.stage === filters.stage); if (filters.search) { const query = String(filters.search).toLowerCase(); projects = projects.filter(row => String(row.title || row.name || '').toLowerCase().includes(query)) }
  const risks = scoped(db, 'organizationRiskSignals', context.organizationId); const total = projects.length; const items = projects.sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt)).slice(offset, offset + limit).map(row => ({ id: row.id, title: row.title || row.name || 'Untitled', stage: row.stage || null, programId: row.programId || null, cohortId: row.cohortId || null, health: score(row.gsisScore ?? row.progress), execution: score(row.progress), milestoneProgress: score(row.milestoneProgress), founderEngagement: score(row.founderEngagement), marketReady: score(row.marketReadyScore), risk: risks.filter(risk => risk.sourceId === row.id && !['resolved', 'dismissed'].includes(risk.status)).sort((a, b) => ({ critical: 4, high: 3, medium: 2, low: 1 }[b.severity] || 0) - ({ critical: 4, high: 3, medium: 2, low: 1 }[a.severity] || 0))[0]?.severity || 'unavailable', updatedAt: row.updatedAt || null }))
  return { ok: true, organizationId: context.organizationId, items, pagination: { offset, limit, total, hasMore: offset + items.length < total }, deterministic: true }
}

export function organizationProgramHealth(userId, programId, organizationId = null) { const context = requireOrganizationPermission(userId, 'metrics', organizationId); if (!context.ok) return context; const db = readDb(); const program = programRows(db, context.organizationId).find(row => row.id === programId); if (!program) return { ok: false, error: 'organization_program_not_found' }; const startups = projectRows(db, context.organizationId).filter(row => row.programId === programId); const cohorts = scoped(db, 'organizationCohorts', context.organizationId).filter(row => row.programId === programId); const mentors = scoped(db, 'mentorshipRooms', context.organizationId).filter(row => row.programId === programId); const dimensions = { startupProgress: average(startups.map(row => score(row.progress))), startupHealth: average(startups.map(row => score(row.gsisScore))), engagement: average(startups.map(row => score(row.founderEngagement))), milestoneProgress: average(startups.map(row => score(row.milestoneProgress))) }; return { ok: true, organizationId: context.organizationId, program, metrics: { startups: startups.length, cohorts: cohorts.length, mentors: mentors.length }, health: { score: average(Object.values(dimensions)), dimensions }, deterministic: true } }

export function generateOrganizationReport(userId, body = {}) { const context = requireOrganizationPermission(userId, 'metrics', body.organizationId); if (!context.ok) return context; const overview = organizationOverview(userId, context.organizationId); const pulse = organizationPulse(userId, { organizationId: context.organizationId, window: body.window || '30d' }); const kpis = listOrganizationKpis(userId, context.organizationId); const risks = organizationRisks(userId, { organizationId: context.organizationId }); return updateDb(db => { const report = { id: createId('org_report'), organizationId: context.organizationId, type: clean(body.type) || 'executive', window: body.window || '30d', filters: body.filters && typeof body.filters === 'object' ? body.filters : {}, sections: { overview, pulse, kpis: kpis.kpis, risks: risks.risks }, generatedBy: userId, generatedAt: nowIso(), sourceLabels: { overview: 'platform_calculated', pulse: 'platform_calculated', kpis: 'organization_defined', risks: 'platform_calculated' }, deterministic: true }; rows(db, 'organizationReports').push(report); audit(db, context, userId, 'report_generated', 'organization_report', report.id, null, { type: report.type, window: report.window }); return { ok: true, report } }) }

export function runOrganizationIntelligenceMaintenance() {
  return updateDb(db => {
    const current = Date.now(); let overdue = 0; let reports = 0
    for (const action of rows(db, 'organizationActions')) if (action.dueDate && timestamp(action.dueDate) < current && !['completed', 'dismissed', 'overdue'].includes(action.status)) { action.status = 'overdue'; action.updatedAt = nowIso(); overdue += 1; if (action.ownerId) rows(db, 'notifications').push({ id: createId('notif'), userId: action.ownerId, type: 'organization_action_required', content: 'An organization action is overdue.', linkTo: '/org/dashboard', metadata: { organizationId: action.organizationId, actionId: action.id }, read: false, createdAt: nowIso() }) }
    for (const schedule of rows(db, 'organizationReportSchedules').filter(row => row.active !== false)) { const interval = { daily: DAY, weekly: 7 * DAY, monthly: 30 * DAY, quarterly: 90 * DAY }[schedule.frequency]; if (!interval || (schedule.lastRunAt && current - timestamp(schedule.lastRunAt) < interval)) continue; const report = { id: createId('org_report'), organizationId: schedule.organizationId, type: schedule.reportType, scheduleId: schedule.id, filters: schedule.filters || {}, generatedAt: nowIso(), status: 'ready', deterministic: true }; rows(db, 'organizationReports').push(report); schedule.lastRunAt = report.generatedAt; schedule.updatedAt = report.generatedAt; reports += 1; for (const userId of schedule.recipients || []) rows(db, 'notifications').push({ id: createId('notif'), userId, type: 'organization_report_ready', content: 'A scheduled organization report is ready.', linkTo: '/org/analytics', metadata: { organizationId: schedule.organizationId, reportId: report.id }, read: false, createdAt: nowIso() }) }
    return { ok: true, overdueActions: overdue, reportsGenerated: reports }
  })
}
