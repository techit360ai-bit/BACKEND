import { readAuthorityDb } from '../config/database.js'
import { cofounderModeEnabled } from '../config/runtimeConfig.js'
import { createId, nowIso } from '../utils/api.js'
import { applyCofounderMutation, runCofounderRead } from '../repositories/cofounderRepository.js'
import { getPublicTrust } from './trustAuthorityAsync.js'
import { executionIntelligenceFor } from './executionIntelligenceService.js'
import {
  ACTIVE_STATUSES,
  COFOUNDER_COMMITMENT_TYPES,
  COFOUNDER_DECISION_RESPONSES,
  COFOUNDER_PERMISSIONS,
  COFOUNDER_ROLE_TYPES,
  COFOUNDER_STATUSES,
  COFOUNDER_VENTURE_STAGES,
  PRE_ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  VISIBILITY_LAYERS,
  canViewLayer,
  normalizeVisibility,
  otherParty,
  profileName,
  publicRelationship,
  relationshipParty,
  relationshipPermissions,
  rows,
  text,
  textList,
} from './cofounderModel.js'

const DAY_MS = 86_400_000
const ACTIONABLE_STATUSES = [...PRE_ACTIVE_STATUSES, COFOUNDER_STATUSES.ACTIVE, COFOUNDER_STATUSES.PAUSED]
const HEALTH_POLICY_VERSION = 'cofounder-health-v1'
const HEALTH_WEIGHTS = Object.freeze({
  executionAlignment: 0.3,
  goalAlignment: 0.25,
  contribution: 0.15,
  communication: 0.15,
  decisionAlignment: 0.15,
})

function fail(error, status = 400, extra = {}) {
  return { ok: false, error, status, ...extra }
}

function feature(userId) {
  return cofounderModeEnabled(userId) ? null : fail('cofounder_mode_disabled', 404)
}

function cleanObject(value, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const allowed = new Set(allowedKeys)
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => allowed.has(key) && item !== undefined))
}

function boundedNumber(value, fallback = null, min = 0, max = 100) {
  if (value == null || value === '') return fallback
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(min, Math.min(max, number))
}

function isoDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function versionMatches(row, body = {}) {
  return body.version == null || Number(body.version) === Number(row.version || 1)
}

function projectFor(db, ventureId) {
  return rows(db, 'projects').find(row => String(row.id) === String(ventureId)) || null
}

function founderOwnsVenture(db, userId, ventureId) {
  const project = projectFor(db, ventureId)
  if (!project) return null
  const ownerId = project.ownerId || project.founderId || project.createdBy
  return String(ownerId || '') === String(userId) ? project : null
}

function profileFor(db, userId) {
  return rows(db, 'profiles').find(row => String(row.id) === String(userId)) || null
}

function relationshipById(db, relationshipId) {
  return rows(db, 'cofounderRelationships').find(row => String(row.id) === String(relationshipId)) || null
}

function requireRelationship(db, relationshipId, userId, { statuses = null, permission = null, candidateOnly = false, founderOnly = false } = {}) {
  const relationship = relationshipById(db, relationshipId)
  if (!relationship || !relationshipParty(relationship, userId)) return fail('cofounder_relationship_not_found', 404)
  if (candidateOnly && String(relationship.cofounderId) !== String(userId)) return fail('cofounder_relationship_not_found', 404)
  if (founderOnly && String(relationship.founderId) !== String(userId)) return fail('cofounder_relationship_not_found', 404)
  if (statuses && !statuses.includes(relationship.status)) return fail('invalid_cofounder_transition', 409, { currentStatus: relationship.status })
  if (permission && !relationshipPermissions(relationship, userId).includes(permission)) return fail('cofounder_permission_required', 403)
  return { ok: true, relationship, role: relationshipParty(relationship, userId) }
}

function touch(row, now = nowIso()) {
  row.updatedAt = now
  row.version = Number(row.version || 1) + 1
  return row
}

function sanitizeMetadata(metadata = {}) {
  const allowed = new Set(['entityType', 'entityId', 'status', 'from', 'to', 'kind', 'count', 'decisionId', 'objectiveId', 'responsibilityId'])
  return Object.fromEntries(Object.entries(metadata).filter(([key, value]) => allowed.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')))
}

function appendActivity(db, relationship, actorId, type, summary, visibilityLayer = VISIBILITY_LAYERS.SHARED, metadata = {}) {
  const now = nowIso()
  const activity = {
    id: createId('cofounder_activity'),
    relationshipId: relationship.id,
    ventureId: relationship.projectId,
    actorId,
    visibilityLayer: normalizeVisibility(visibilityLayer),
    type: text(type, 80),
    summary: text(summary, 500),
    entityType: text(metadata.entityType, 60) || null,
    entityId: text(metadata.entityId, 120) || null,
    sanitizedMetadata: sanitizeMetadata(metadata),
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
  rows(db, 'cofounderActivity').push(activity)
  return activity
}

function notify(db, userId, actorId, content, linkTo, metadata = {}) {
  if (!userId) return null
  const actor = profileFor(db, actorId)
  const notification = {
    id: createId('notif'),
    userId,
    actorId,
    type: 'cofounder',
    read: false,
    content: text(content, 300),
    author: profileName(actor),
    linkTo,
    metadata: {
      relationshipId: metadata.relationshipId || null,
      kind: metadata.kind || 'relationship',
      entityType: metadata.entityType || null,
      entityId: metadata.entityId || null,
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    version: 1,
  }
  rows(db, 'notifications').push(notification)
  return notification
}

function analytics(userId, eventType, metadata = {}) {
  // Product analytics are deliberately separate from relationship mutations.
  // Failure to record a metric must never roll back a lifecycle transition.
  void import('./discoveryService.js')
    .then(module => module.recordRecommendationEventAsync(userId, {
      eventType,
      surface: 'cofounder',
      entityType: 'cofounder',
      entityId: metadata.relationshipId || metadata.projectId || null,
      metadata: sanitizeMetadata(metadata),
    }))
    .catch(() => {})
}

function relationshipForProject(db, userId, projectId) {
  return rows(db, 'cofounderRelationships')
    .filter(row => String(row.projectId) === String(projectId) && relationshipParty(row, userId))
}

function publicResponsibility(row, relationship, userId) {
  if (!canViewLayer(row, relationship, userId)) return null
  return {
    id: row.id,
    relationshipId: row.relationshipId,
    ventureId: row.ventureId,
    ownerId: row.ownerId,
    ownerRole: relationshipParty(relationship, row.ownerId),
    title: row.title,
    description: row.description || '',
    areas: Array.isArray(row.areas) ? row.areas : [],
    status: row.status || 'active',
    visibilityLayer: normalizeVisibility(row.visibilityLayer),
    linkedObjectiveIds: Array.isArray(row.linkedObjectiveIds) ? row.linkedObjectiveIds : [],
    linkedTaskIds: Array.isArray(row.linkedTaskIds) ? row.linkedTaskIds : [],
    evidenceIds: Array.isArray(row.evidenceIds) ? row.evidenceIds : [],
    version: Number(row.version || 1),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function objectiveProgress(db, objective) {
  const taskIds = new Set((objective.linkedTaskIds || []).map(String))
  const linked = rows(db, 'workspaceTasks').filter(row => taskIds.has(String(row.id)))
  if (linked.length) {
    const completed = linked.filter(row => ['completed', 'done'].includes(String(row.status || '').toLowerCase())).length
    return { progress: Math.round((completed / linked.length) * 100), source: 'tasks', evidenceCount: linked.length }
  }
  if (objective.status === 'completed') return { progress: 100, source: 'status', evidenceCount: 1 }
  return { progress: boundedNumber(objective.progress, 0, 0, 100), source: 'reported', evidenceCount: 0 }
}

function publicObjective(db, objective, relationship, userId) {
  if (!canViewLayer(objective, relationship, userId)) return null
  const progress = objectiveProgress(db, objective)
  return {
    id: objective.id,
    relationshipId: objective.relationshipId,
    ventureId: objective.ventureId,
    title: objective.title,
    description: objective.description || '',
    kind: objective.kind || 'shared',
    ownerId: objective.ownerId || null,
    coOwnerIds: Array.isArray(objective.coOwnerIds) ? objective.coOwnerIds : [],
    responsibilityId: objective.responsibilityId || null,
    dueDate: objective.dueDate || null,
    progress: progress.progress,
    progressSource: progress.source,
    progressEvidenceCount: progress.evidenceCount,
    status: objective.status || 'active',
    visibilityLayer: normalizeVisibility(objective.visibilityLayer),
    linkedTaskIds: Array.isArray(objective.linkedTaskIds) ? objective.linkedTaskIds : [],
    milestoneIds: Array.isArray(objective.milestoneIds) ? objective.milestoneIds : [],
    evidenceIds: Array.isArray(objective.evidenceIds) ? objective.evidenceIds : [],
    publishedMilestoneId: objective.publishedMilestoneId || null,
    completedAt: objective.completedAt || null,
    version: Number(objective.version || 1),
    createdAt: objective.createdAt,
    updatedAt: objective.updatedAt,
  }
}

function publicDecision(decision, relationship, userId) {
  if (!canViewLayer(decision, relationship, userId)) return null
  return {
    id: decision.id,
    relationshipId: decision.relationshipId,
    ventureId: decision.ventureId,
    title: decision.title,
    description: decision.description || '',
    proposedBy: decision.proposedBy,
    status: decision.status,
    responses: Array.isArray(decision.responses) ? decision.responses.map(row => ({
      userId: row.userId,
      response: row.response,
      reason: row.reason || '',
      respondedAt: row.respondedAt,
    })) : [],
    deadline: decision.deadline || null,
    resolvedAt: decision.resolvedAt || null,
    resolutionReason: decision.resolutionReason || '',
    visibilityLayer: normalizeVisibility(decision.visibilityLayer),
    version: Number(decision.version || 1),
    createdAt: decision.createdAt,
    updatedAt: decision.updatedAt,
  }
}

function publicActivity(activity, relationship, userId) {
  if (!canViewLayer(activity, relationship, userId)) return null
  return {
    id: activity.id,
    relationshipId: activity.relationshipId,
    ventureId: activity.ventureId,
    actorId: activity.actorId,
    actorRole: relationshipParty(relationship, activity.actorId),
    visibilityLayer: normalizeVisibility(activity.visibilityLayer),
    type: activity.type,
    summary: activity.summary,
    entityType: activity.entityType || null,
    entityId: activity.entityId || null,
    metadata: sanitizeMetadata(activity.sanitizedMetadata || {}),
    createdAt: activity.createdAt,
  }
}

function modeSummary(db, relationships, userId) {
  const relationshipRows = relationships.filter(row => row.status === COFOUNDER_STATUSES.ACTIVE)
  const summaries = relationshipRows.map(relationship => {
    const responsibilities = rows(db, 'cofounderResponsibilities').filter(row => row.relationshipId === relationship.id && canViewLayer(row, relationship, userId))
    const objectives = rows(db, 'cofounderObjectives').filter(row => row.relationshipId === relationship.id && canViewLayer(row, relationship, userId))
    const decisions = rows(db, 'cofounderDecisions').filter(row => row.relationshipId === relationship.id && canViewLayer(row, relationship, userId))
    const activities = rows(db, 'cofounderActivity').filter(row => row.relationshipId === relationship.id && canViewLayer(row, relationship, userId))
    const completedResponsibilities = responsibilities.filter(row => row.status === 'completed').length
    const activeObjectives = objectives.filter(row => row.status === 'active').map(row => objectiveProgress(db, row).progress)
    const overallProgress = activeObjectives.length ? Math.round(activeObjectives.reduce((sum, value) => sum + value, 0) / activeObjectives.length) : null
    return {
      ...publicRelationship(relationship, userId, db),
      summary: {
        responsibilityCompletion: responsibilities.length ? { completed: completedResponsibilities, total: responsibilities.length } : null,
        sharedObjectives: { active: objectives.filter(row => row.status === 'active').length, progress: overallProgress },
        openDecisions: decisions.filter(row => ['open', 'discussion_requested'].includes(row.status)).length,
        recentActivity: activities.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5).map(row => publicActivity(row, relationship, userId)).filter(Boolean),
      },
    }
  })
  return {
    active: summaries.length > 0,
    relationships: summaries,
    team: summaries.map(summary => ({
      relationshipId: summary.id,
      userId: summary.otherParty.id,
      name: summary.otherParty.name,
      title: summary.role === 'founder' ? summary.otherParty.title || summary.roleTitle : summary.roleTitle,
      role: summary.role,
      avatarUrl: summary.otherParty.avatarUrl || '',
    })),
  }
}

function accessError(result) {
  return result?.ok === false ? result : null
}

export async function cofounderCapabilitiesAsync(userId) {
  return {
    ok: true,
    enabled: cofounderModeEnabled(userId),
    permissions: cofounderModeEnabled(userId) ? [...COFOUNDER_PERMISSIONS] : [],
    visibilityLayers: Object.values(VISIBILITY_LAYERS),
    healthPolicyVersion: HEALTH_POLICY_VERSION,
  }
}

export async function getRequirementsAsync(userId, ventureId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, { projectId: ventureId }, () => {
    const db = readAuthorityDb()
    if (!founderOwnsVenture(db, userId, ventureId)) return fail('venture_not_found', 404)
    const requirement = rows(db, 'cofounderRequirements')
      .filter(row => String(row.projectId) === String(ventureId) && String(row.founderId) === String(userId))
      .sort((a, b) => Number(b.version || 1) - Number(a.version || 1))[0] || null
    return { ok: true, requirement }
  })
}

export async function upsertRequirementsAsync(userId, ventureId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { projectId: ventureId }, () => {
    const db = readAuthorityDb()
    const project = founderOwnsVenture(db, userId, ventureId)
    if (!project) return fail('venture_not_found', 404)
    const roleType = String(body.roleType || '').toLowerCase()
    if (!COFOUNDER_ROLE_TYPES.includes(roleType)) return fail('invalid_cofounder_role_type')
    const commitmentType = String(body.commitment?.type || body.commitment || '').toLowerCase()
    if (commitmentType && !COFOUNDER_COMMITMENT_TYPES.includes(commitmentType)) return fail('invalid_cofounder_commitment')
    const ventureStage = String(body.ventureStage || project.stage || '').toLowerCase()
    if (ventureStage && !COFOUNDER_VENTURE_STAGES.includes(ventureStage)) return fail('invalid_cofounder_venture_stage')
    const now = nowIso()
    const existing = rows(db, 'cofounderRequirements').find(row => String(row.projectId) === String(ventureId) && String(row.founderId) === String(userId) && row.status !== 'archived')
    if (existing && !versionMatches(existing, body)) return fail('version_conflict', 409, { currentVersion: existing.version })
    const compatibility = cleanObject(body.compatibility, [
      'visionAlignment', 'riskTolerance', 'workingStyle', 'communicationPreference', 'timeCommitment',
      'decisionMakingStyle', 'longTermAmbition', 'timezoneCompatibility', 'contributionExpectations',
      'equityDiscussionPreference', 'visionAnswers',
    ])
    const payload = {
      id: existing?.id || createId('cofounder_requirement'),
      projectId: String(ventureId),
      ventureId: String(ventureId),
      founderId: userId,
      relationshipType: 'co_founder',
      roleType,
      roleTitle: text(body.roleTitle, 120),
      responsibilities: text(body.responsibilities, 4000),
      requiredSkills: textList(body.requiredSkills, 40, 80),
      experience: cleanObject(body.experience, ['years', 'startupYears', 'industryYears', 'leadershipYears', 'technicalYears', 'priorVentures']),
      commitment: {
        type: commitmentType || null,
        hoursPerWeek: boundedNumber(body.commitment?.hoursPerWeek ?? body.hoursPerWeek, null, 0, 168),
      },
      ventureStage: ventureStage || null,
      compatibility,
      status: 'active',
      policyVersion: 'cofounder-fit-v1',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      version: existing ? Number(existing.version || 1) + 1 : 1,
    }
    if (existing) Object.assign(existing, payload)
    else rows(db, 'cofounderRequirements').push(payload)
    analytics(userId, 'cofounder_search_started', { projectId: ventureId })
    return { ok: true, requirement: payload }
  })
}

export async function createInvitationAsync(userId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  const projectId = String(body.projectId || body.ventureId || '').trim()
  if (!projectId) return fail('project_id_required')
  return applyCofounderMutation(userId, { projectId }, () => {
    const db = readAuthorityDb()
    if (!founderOwnsVenture(db, userId, projectId)) return fail('venture_not_found', 404)
    const candidateId = String(body.candidateId || body.cofounderId || '').trim()
    if (!candidateId) return fail('candidate_id_required')
    if (candidateId === String(userId)) return fail('cannot_invite_self')
    const candidate = profileFor(db, candidateId)
    if (!candidate) return fail('candidate_not_found', 404)
    if (candidate.active === false || candidate.accountStatus === 'disabled') return fail('candidate_not_found', 404)
    if (['investor', 'investor_team', 'organization', 'organisation'].includes(String(candidate.role || '').toLowerCase())) {
      return fail('candidate_ineligible', 403)
    }
    const idempotencyKey = text(body.idempotencyKey || '', 160) || null
    const existing = rows(db, 'cofounderRelationships').find(row =>
      String(row.projectId) === String(projectId)
      && String(row.founderId) === String(userId)
      && String(row.cofounderId) === String(candidateId)
    )
    if (existing && idempotencyKey && existing.idempotencyKey === idempotencyKey) {
      return { ok: true, relationship: publicRelationship(existing, userId, db), idempotent: true }
    }
    if (existing && !TERMINAL_STATUSES.includes(existing.status)) return fail('cofounder_relationship_already_exists', 409, { relationshipId: existing.id })
    const now = nowIso()
    const proposedTerms = {
      roleTitle: text(body.roleTitle || body.proposedTerms?.roleTitle, 120),
      responsibilities: text(body.responsibilities || body.proposedTerms?.responsibilities, 4000),
      commitment: cleanObject(body.commitment || body.proposedTerms?.commitment, ['type', 'hoursPerWeek', 'description']),
      ventureStage: text(body.ventureStage || body.proposedTerms?.ventureStage, 40),
      initialPeriodMonths: boundedNumber(body.initialPeriodMonths ?? body.proposedTerms?.initialPeriodMonths, 3, 1, 24),
      equityDiscussionStatus: text(body.equityDiscussionStatus || body.proposedTerms?.equityDiscussionStatus, 80) || 'to_be_discussed',
      responsibilityAssignments: Array.isArray(body.proposedTerms?.responsibilityAssignments)
        ? body.proposedTerms.responsibilityAssignments.slice(0, 12)
        : [],
    }
    const relationship = {
      id: createId('cofounder_relationship'),
      founderId: userId,
      cofounderId: candidateId,
      projectId,
      ventureId: projectId,
      workspaceId: null,
      roleTitle: proposedTerms.roleTitle,
      responsibilities: proposedTerms.responsibilities,
      commitment: proposedTerms.commitment,
      proposedTerms,
      status: COFOUNDER_STATUSES.INVITED,
      revisions: 0,
      requestedChanges: [],
      mutualInterest: {},
      idempotencyKey,
      invitedAt: now,
      discussionAcceptedAt: null,
      proposedAt: null,
      acceptedAt: null,
      activatedAt: null,
      pausedAt: null,
      endedAt: null,
      endReason: null,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    rows(db, 'cofounderRelationships').push(relationship)
    appendActivity(db, relationship, userId, 'cofounder_invitation_sent', `${profileName(profileFor(db, userId))} invited ${profileName(candidate)} to co-founder discussion`, VISIBILITY_LAYERS.SHARED)
    notify(db, candidateId, userId, `invited you to explore building a venture as ${proposedTerms.roleTitle || 'Co-founder'}.`, `/cofounder-invitations/${relationship.id}`, { relationshipId: relationship.id, kind: 'invitation' })
    analytics(userId, 'cofounder_invitation_sent', { relationshipId: relationship.id, projectId })
    return { ok: true, relationship: publicRelationship(relationship, userId, db) }
  })
}

export async function listInvitationsAsync(userId, query = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, {}, () => {
    const db = readAuthorityDb()
    const direction = String(query.direction || 'all').toLowerCase()
    const invitations = rows(db, 'cofounderRelationships')
      .filter(row => relationshipParty(row, userId) && PRE_ACTIVE_STATUSES.includes(row.status))
      .filter(row => direction === 'received'
        ? String(row.cofounderId) === String(userId)
        : direction === 'sent' ? String(row.founderId) === String(userId) : true)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(row => publicRelationship(row, userId, db))
      .filter(Boolean)
    return { ok: true, invitations }
  })
}

export async function getInvitationAsync(userId, relationshipId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: [...ACTIONABLE_STATUSES, ...TERMINAL_STATUSES] })
    if (access.ok === false) return access
    return { ok: true, invitation: publicRelationship(access.relationship, userId, db) }
  })
}

function invitedCandidateAction(userId, relationshipId, action, body = {}) {
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: PRE_ACTIVE_STATUSES, candidateOnly: true })
    if (access.ok === false) return access
    const { relationship } = access
    if (!versionMatches(relationship, body)) return fail('version_conflict', 409, { currentVersion: relationship.version })
    const now = nowIso()
    if (action === 'accept-discussion') {
      if (relationship.status === COFOUNDER_STATUSES.DISCUSSION) return { ok: true, relationship: publicRelationship(relationship, userId, db), idempotent: true }
      if (relationship.status !== COFOUNDER_STATUSES.INVITED) return fail('invalid_cofounder_transition', 409, { currentStatus: relationship.status })
      relationship.status = COFOUNDER_STATUSES.DISCUSSION
      relationship.discussionAcceptedAt = now
      touch(relationship, now)
      appendActivity(db, relationship, userId, 'cofounder_discussion_accepted', 'Co-founder discussion accepted')
      notify(db, relationship.founderId, userId, 'accepted the co-founder discussion.', `/cofounder-invitations/${relationship.id}`, { relationshipId: relationship.id, kind: 'discussion_accepted' })
      analytics(userId, 'cofounder_invitation_accepted', { relationshipId: relationship.id })
      return { ok: true, relationship: publicRelationship(relationship, userId, db) }
    }
    if (action === 'decline') {
      relationship.status = COFOUNDER_STATUSES.DECLINED
      relationship.declinedAt = now
      relationship.endReason = text(body.reason, 500) || 'candidate_declined'
      touch(relationship, now)
      appendActivity(db, relationship, userId, 'cofounder_invitation_declined', 'Co-founder invitation declined')
      notify(db, relationship.founderId, userId, 'declined the co-founder invitation.', `/founder/dashboard`, { relationshipId: relationship.id, kind: 'invitation_declined' })
      analytics(userId, 'cofounder_invitation_declined', { relationshipId: relationship.id })
      return { ok: true, relationship: publicRelationship(relationship, userId, db) }
    }
    return fail('invalid_cofounder_action')
  })
}

export async function acceptDiscussionAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return invitedCandidateAction(userId, relationshipId, 'accept-discussion', body)
}

export async function declineInvitationAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return invitedCandidateAction(userId, relationshipId, 'decline', body)
}

export async function requestChangesAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: PRE_ACTIVE_STATUSES, candidateOnly: true })
    if (access.ok === false) return access
    const { relationship } = access
    if (!versionMatches(relationship, body)) return fail('version_conflict', 409, { currentVersion: relationship.version })
    const requestedChanges = text(body.requestedChanges || body.changes, 2000)
    if (!requestedChanges) return fail('changed_terms_required')
    const now = nowIso()
    relationship.status = COFOUNDER_STATUSES.DISCUSSION
    relationship.requestedChanges = [...(Array.isArray(relationship.requestedChanges) ? relationship.requestedChanges : []), {
      requestedBy: userId,
      changes: requestedChanges,
      createdAt: now,
    }].slice(-20)
    relationship.revisions = Number(relationship.revisions || 0) + 1
    touch(relationship, now)
    appendActivity(db, relationship, userId, 'cofounder_changes_requested', 'Requested changes to the co-founder terms')
    notify(db, relationship.founderId, userId, 'requested changes to the co-founder terms.', `/cofounder-invitations/${relationship.id}`, { relationshipId: relationship.id, kind: 'changes_requested' })
    return { ok: true, relationship: publicRelationship(relationship, userId, db) }
  })
}

export async function withdrawInvitationAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: PRE_ACTIVE_STATUSES, founderOnly: true })
    if (access.ok === false) return access
    const { relationship } = access
    if (!versionMatches(relationship, body)) return fail('version_conflict', 409, { currentVersion: relationship.version })
    const now = nowIso()
    relationship.status = COFOUNDER_STATUSES.WITHDRAWN
    relationship.withdrawnAt = now
    relationship.endReason = text(body.reason, 500) || 'founder_withdrew'
    touch(relationship, now)
    appendActivity(db, relationship, userId, 'cofounder_invitation_withdrawn', 'Co-founder invitation withdrawn')
    notify(db, relationship.cofounderId, userId, 'withdrew the co-founder invitation.', '/collaborator/dashboard', { relationshipId: relationship.id, kind: 'invitation_withdrawn' })
    return { ok: true, relationship: publicRelationship(relationship, userId, db) }
  })
}

const ADVANCE_TRANSITIONS = Object.freeze({
  [COFOUNDER_STATUSES.DISCUSSION]: [COFOUNDER_STATUSES.MUTUAL_INTEREST, COFOUNDER_STATUSES.DUE_DILIGENCE],
  [COFOUNDER_STATUSES.MUTUAL_INTEREST]: [COFOUNDER_STATUSES.DUE_DILIGENCE],
  [COFOUNDER_STATUSES.DUE_DILIGENCE]: [COFOUNDER_STATUSES.COFOUNDER_PROPOSAL],
})

export async function advanceRelationshipAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: PRE_ACTIVE_STATUSES })
    if (access.ok === false) return access
    const { relationship, role } = access
    if (!versionMatches(relationship, body)) return fail('version_conflict', 409, { currentVersion: relationship.version })
    const target = String(body.status || body.to || '').toUpperCase()
    if (!(ADVANCE_TRANSITIONS[relationship.status] || []).includes(target)) return fail('invalid_cofounder_transition', 409, { currentStatus: relationship.status, target })
    if (target === COFOUNDER_STATUSES.MUTUAL_INTEREST && role !== 'cofounder') return fail('cofounder_candidate_required', 403)
    if (target === COFOUNDER_STATUSES.COFOUNDER_PROPOSAL && role !== 'founder') return fail('cofounder_founder_required', 403)
    const now = nowIso()
    relationship.status = target
    if (target === COFOUNDER_STATUSES.MUTUAL_INTEREST) {
      relationship.mutualInterest = {
        confirmedBy: userId,
        confirmedAt: now,
        visionAlignment: boundedNumber(body.visionAlignment, null, 0, 100),
      }
    }
    if (target === COFOUNDER_STATUSES.COFOUNDER_PROPOSAL) {
      const terms = cleanObject(body.proposedTerms || {}, ['roleTitle', 'responsibilities', 'commitment', 'ventureStage', 'initialPeriodMonths', 'equityDiscussionStatus', 'responsibilityAssignments'])
      if (Object.keys(terms).length) relationship.proposedTerms = { ...(relationship.proposedTerms || {}), ...terms }
      relationship.proposedAt = now
    }
    touch(relationship, now)
    appendActivity(db, relationship, userId, `cofounder_${target.toLowerCase()}`, `Co-founder relationship advanced to ${target}`)
    const recipient = role === 'founder' ? relationship.cofounderId : relationship.founderId
    notify(db, recipient, userId, `advanced the co-founder relationship to ${target.toLowerCase().replaceAll('_', ' ')}.`, `/cofounder-invitations/${relationship.id}`, { relationshipId: relationship.id, kind: 'status_advanced' })
    return { ok: true, relationship: publicRelationship(relationship, userId, db) }
  })
}

function provisionRelationshipWorkspace(db, relationship, proposedTerms) {
  let workspace = relationship.workspaceId
    ? rows(db, 'workspaces').find(row => String(row.id) === String(relationship.workspaceId))
    : null
  const now = nowIso()
  if (!workspace) {
    const project = projectFor(db, relationship.projectId)
    workspace = {
      id: createId('workspace'),
      ownerId: relationship.founderId,
      projectId: relationship.projectId,
      cofounderRelationshipId: relationship.id,
      kind: 'cofounder',
      name: `${project?.title || project?.name || 'Venture'} Co-founder Workspace`,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    rows(db, 'workspaces').push(workspace)
    relationship.workspaceId = workspace.id
  }
  for (const [partyId, role, accessLevel] of [
    [relationship.founderId, 'founder', 'owner'],
    [relationship.cofounderId, 'cofounder', 'contributor'],
  ]) {
    const existing = rows(db, 'workspaceMembers').find(row => String(row.workspaceId) === String(workspace.id) && String(row.userId) === String(partyId))
    if (existing) {
      existing.status = 'active'
      existing.role = role
      existing.accessLevel = accessLevel
      existing.cofounderRelationshipId = relationship.id
      existing.updatedAt = now
      existing.version = Number(existing.version || 1) + 1
    } else {
      rows(db, 'workspaceMembers').push({
        id: createId('workspace_member'),
        workspaceId: workspace.id,
        userId: partyId,
        role,
        accessLevel,
        status: 'active',
        cofounderRelationshipId: relationship.id,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
        version: 1,
      })
    }
  }
  return workspace
}

function createActivationResponsibilities(db, relationship, proposedTerms) {
  const supplied = Array.isArray(proposedTerms.responsibilityAssignments) ? proposedTerms.responsibilityAssignments : []
  const now = nowIso()
  const assignments = supplied.length ? supplied : [
    {
      ownerRole: 'cofounder',
      title: proposedTerms.roleTitle || 'Co-founder',
      description: proposedTerms.responsibilities || '',
      areas: [],
    },
  ]
  const created = []
  for (const assignment of assignments.slice(0, 20)) {
    const ownerId = assignment.ownerId
      ? String(assignment.ownerId)
      : assignment.ownerRole === 'founder' ? relationship.founderId : relationship.cofounderId
    if (![String(relationship.founderId), String(relationship.cofounderId)].includes(ownerId)) continue
    const row = {
      id: createId('cofounder_responsibility'),
      relationshipId: relationship.id,
      ventureId: relationship.projectId,
      ownerId,
      title: text(assignment.title || proposedTerms.roleTitle || 'Co-founder responsibility', 160),
      description: text(assignment.description || proposedTerms.responsibilities, 4000),
      areas: textList(assignment.areas, 12, 80),
      status: 'active',
      visibilityLayer: VISIBILITY_LAYERS.SHARED,
      linkedObjectiveIds: [],
      linkedTaskIds: [],
      evidenceIds: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    rows(db, 'cofounderResponsibilities').push(row)
    created.push(row)
  }
  return created
}

export async function acceptProposalAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { candidateOnly: true })
    if (access.ok === false) return access
    const { relationship } = access
    if (relationship.status === COFOUNDER_STATUSES.ACTIVE) {
      return { ok: true, relationship: publicRelationship(relationship, userId, db), idempotent: true }
    }
    if (relationship.status !== COFOUNDER_STATUSES.COFOUNDER_PROPOSAL) return fail('invalid_cofounder_transition', 409, { currentStatus: relationship.status })
    if (!versionMatches(relationship, body)) return fail('version_conflict', 409, { currentVersion: relationship.version })
    const idempotencyKey = text(body.idempotencyKey || '', 160) || null
    if (relationship.activationIdempotencyKey && idempotencyKey && relationship.activationIdempotencyKey === idempotencyKey) {
      return { ok: true, relationship: publicRelationship(relationship, userId, db), idempotent: true }
    }
    const duplicate = rows(db, 'cofounderRelationships').some(row => row.id !== relationship.id
      && String(row.projectId) === String(relationship.projectId)
      && String(row.founderId) === String(relationship.founderId)
      && String(row.cofounderId) === String(relationship.cofounderId)
      && row.status === COFOUNDER_STATUSES.ACTIVE)
    if (duplicate) return fail('cofounder_relationship_already_active', 409)
    const proposedTerms = { ...(relationship.proposedTerms || {}), ...(body.acceptedTerms && typeof body.acceptedTerms === 'object' ? body.acceptedTerms : {}) }
    const now = nowIso()
    const workspace = provisionRelationshipWorkspace(db, relationship, proposedTerms)
    const responsibilities = createActivationResponsibilities(db, relationship, proposedTerms)
    relationship.proposedTerms = proposedTerms
    relationship.responsibilityIds = responsibilities.map(row => row.id)
    relationship.status = COFOUNDER_STATUSES.ACTIVE
    relationship.acceptedAt = now
    relationship.activatedAt = now
    relationship.activationIdempotencyKey = idempotencyKey
    touch(relationship, now)
    appendActivity(db, relationship, userId, 'cofounder_relationship_activated', 'Co-founder relationship activated', VISIBILITY_LAYERS.SHARED, { entityType: 'workspace', entityId: workspace.id })
    notify(db, relationship.founderId, userId, 'accepted the co-founder proposal.', `/workspaces/cofounder/${relationship.id}`, { relationshipId: relationship.id, kind: 'proposal_accepted' })
    notify(db, relationship.cofounderId, userId, 'Your co-founder workspace is ready.', `/workspaces/cofounder/${relationship.id}`, { relationshipId: relationship.id, kind: 'relationship_activated' })
    analytics(userId, 'cofounder_relationship_activated', { relationshipId: relationship.id, projectId: relationship.projectId })
    return { ok: true, relationship: publicRelationship(relationship, userId, db) }
  })
}

export async function listRelationshipsAsync(userId, query = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, {}, () => {
    const db = readAuthorityDb()
    const requestedStatus = query.status ? String(query.status).toUpperCase() : null
    const relationships = rows(db, 'cofounderRelationships')
      .filter(row => relationshipParty(row, userId) && (!query.projectId || String(row.projectId) === String(query.projectId)))
      .filter(row => !requestedStatus || row.status === requestedStatus)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(row => publicRelationship(row, userId, db))
      .filter(Boolean)
    return { ok: true, relationships }
  })
}

export async function getRelationshipAsync(userId, relationshipId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: [...ACTIONABLE_STATUSES, ...TERMINAL_STATUSES] })
    if (access.ok === false) return access
    return { ok: true, relationship: publicRelationship(access.relationship, userId, db) }
  })
}

export async function getRelationshipModeAsync(userId, ventureId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, { projectId: ventureId }, () => {
    const db = readAuthorityDb()
    const project = projectFor(db, ventureId)
    if (!project) return fail('venture_not_found', 404)
    const relationships = relationshipForProject(db, userId, ventureId)
    const isOwner = String(project.ownerId || project.founderId || project.createdBy || '') === String(userId)
    if (!isOwner && !relationships.length) return fail('venture_not_found', 404)
    return { ok: true, projectId: String(ventureId), ...modeSummary(db, relationships, userId) }
  })
}

export async function getRelationshipWorkspaceAsync(userId, relationshipId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'VIEW_COFOUNDER_RELATIONSHIP' })
    if (access.ok === false) return access
    const workspace = rows(db, 'workspaces').find(row => String(row.id) === String(access.relationship.workspaceId)) || null
    if (!workspace) return fail('cofounder_workspace_not_found', 404)
    return {
      ok: true,
      relationship: publicRelationship(access.relationship, userId, db),
      workspace: {
        id: workspace.id,
        projectId: workspace.projectId,
        name: workspace.name,
        kind: workspace.kind,
        status: workspace.status,
      },
    }
  })
}

export async function pauseRelationshipAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'MANAGE_COFOUNDER_RELATIONSHIP' })
    if (access.ok === false) return access
    const { relationship } = access
    if (!versionMatches(relationship, body)) return fail('version_conflict', 409, { currentVersion: relationship.version })
    relationship.status = COFOUNDER_STATUSES.PAUSED
    relationship.pausedAt = nowIso()
    touch(relationship)
    const workspace = rows(db, 'workspaces').find(row => row.id === relationship.workspaceId)
    if (workspace) touch(workspace)
    appendActivity(db, relationship, userId, 'cofounder_relationship_paused', 'Co-founder relationship paused')
    notify(db, userId === relationship.founderId ? relationship.cofounderId : relationship.founderId, userId, 'paused the co-founder relationship.', `/cofounder-invitations/${relationship.id}`, { relationshipId: relationship.id, kind: 'relationship_paused' })
    analytics(userId, 'cofounder_relationship_paused', { relationshipId: relationship.id })
    return { ok: true, relationship: publicRelationship(relationship, userId, db) }
  })
}

export async function resumeRelationshipAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: [COFOUNDER_STATUSES.PAUSED], permission: 'MANAGE_COFOUNDER_RELATIONSHIP' })
    if (access.ok === false) return access
    const { relationship } = access
    if (!versionMatches(relationship, body)) return fail('version_conflict', 409, { currentVersion: relationship.version })
    relationship.status = COFOUNDER_STATUSES.ACTIVE
    relationship.resumedAt = nowIso()
    relationship.pausedAt = null
    touch(relationship)
    appendActivity(db, relationship, userId, 'cofounder_relationship_resumed', 'Co-founder relationship resumed')
    notify(db, userId === relationship.founderId ? relationship.cofounderId : relationship.founderId, userId, 'resumed the co-founder relationship.', `/workspaces/cofounder/${relationship.id}`, { relationshipId: relationship.id, kind: 'relationship_resumed' })
    return { ok: true, relationship: publicRelationship(relationship, userId, db) }
  })
}

export async function endRelationshipAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: [COFOUNDER_STATUSES.ACTIVE, COFOUNDER_STATUSES.PAUSED], permission: 'MANAGE_COFOUNDER_RELATIONSHIP' })
    if (access.ok === false) return access
    const { relationship } = access
    if (!versionMatches(relationship, body)) return fail('version_conflict', 409, { currentVersion: relationship.version })
    const now = nowIso()
    relationship.status = COFOUNDER_STATUSES.ENDED
    relationship.endedAt = now
    relationship.endReason = text(body.reason, 500) || 'relationship_ended'
    relationship.endedBy = userId
    touch(relationship, now)
    const workspace = rows(db, 'workspaces').find(row => row.id === relationship.workspaceId)
    if (workspace) {
      workspace.status = 'ended'
      touch(workspace, now)
      for (const member of rows(db, 'workspaceMembers').filter(row => row.workspaceId === workspace.id)) {
        member.status = 'revoked'
        member.revokedAt = now
        touch(member, now)
      }
    }
    appendActivity(db, relationship, userId, 'cofounder_relationship_ended', 'Co-founder relationship ended')
    notify(db, userId === relationship.founderId ? relationship.cofounderId : relationship.founderId, userId, 'ended the co-founder relationship.', '/feed/notifications', { relationshipId: relationship.id, kind: 'relationship_ended' })
    analytics(userId, 'cofounder_relationship_ended', { relationshipId: relationship.id })
    return { ok: true, relationship: publicRelationship(relationship, userId, db), evidencePreserved: true }
  })
}

export async function listResponsibilitiesAsync(userId, relationshipId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'VIEW_COFOUNDER_RELATIONSHIP' })
    if (access.ok === false) return access
    const responsibilities = rows(db, 'cofounderResponsibilities')
      .filter(row => row.relationshipId === relationshipId)
      .map(row => publicResponsibility(row, access.relationship, userId))
      .filter(Boolean)
    return { ok: true, responsibilities }
  })
}

export async function createResponsibilityAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'ASSIGN_COFOUNDER_TASK' })
    if (access.ok === false) return access
    const { relationship } = access
    const title = text(body.title, 160)
    if (!title) return fail('responsibility_title_required')
    const ownerId = String(body.ownerId || userId)
    if (![String(relationship.founderId), String(relationship.cofounderId)].includes(ownerId)) return fail('responsibility_owner_invalid')
    const visibilityLayer = normalizeVisibility(body.visibilityLayer)
    if (visibilityLayer === VISIBILITY_LAYERS.PERSONAL && ownerId !== String(userId)) return fail('personal_responsibility_owner_mismatch', 403)
    const now = nowIso()
    const row = {
      id: createId('cofounder_responsibility'),
      relationshipId,
      ventureId: relationship.projectId,
      ownerId,
      title,
      description: text(body.description, 4000),
      areas: textList(body.areas, 12, 80),
      status: text(body.status, 30) || 'active',
      visibilityLayer,
      allowedUserIds: visibilityLayer === VISIBILITY_LAYERS.RESTRICTED ? textList(body.allowedUserIds, 2, 120) : [],
      linkedObjectiveIds: [],
      linkedTaskIds: textList(body.linkedTaskIds, 50, 120),
      evidenceIds: textList(body.evidenceIds, 50, 120),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    rows(db, 'cofounderResponsibilities').push(row)
    appendActivity(db, relationship, userId, 'cofounder_responsibility_created', `Created responsibility: ${title}`, visibilityLayer, { entityType: 'responsibility', entityId: row.id })
    return { ok: true, responsibility: publicResponsibility(row, relationship, userId) }
  })
}

export async function patchResponsibilityAsync(userId, responsibilityId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, {}, () => {
    const db = readAuthorityDb()
    const row = rows(db, 'cofounderResponsibilities').find(item => String(item.id) === String(responsibilityId))
    if (!row) return fail('cofounder_responsibility_not_found', 404)
    const access = requireRelationship(db, row.relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'ASSIGN_COFOUNDER_TASK' })
    if (access.ok === false) return access
    const { relationship } = access
    if (!canViewLayer(row, relationship, userId)) return fail('cofounder_responsibility_not_found', 404)
    if (!versionMatches(row, body)) return fail('version_conflict', 409)
    if (body.title !== undefined && !text(body.title, 160)) return fail('responsibility_title_required')
    if (body.ownerId !== undefined && ![String(relationship.founderId), String(relationship.cofounderId)].includes(String(body.ownerId))) return fail('responsibility_owner_invalid')
    const nextVisibility = body.visibilityLayer !== undefined ? normalizeVisibility(body.visibilityLayer) : normalizeVisibility(row.visibilityLayer)
    if (nextVisibility === VISIBILITY_LAYERS.PERSONAL && String(body.ownerId || row.ownerId) !== String(userId)) return fail('personal_responsibility_owner_mismatch', 403)
    for (const key of ['title', 'description', 'status', 'linkedTaskIds', 'evidenceIds', 'areas']) {
      if (body[key] !== undefined) {
        if (['linkedTaskIds', 'evidenceIds', 'areas'].includes(key)) row[key] = textList(body[key], 50, 120)
        else row[key] = text(body[key], key === 'description' ? 4000 : 500)
      }
    }
    if (body.ownerId !== undefined) row.ownerId = String(body.ownerId)
    if (body.visibilityLayer !== undefined) row.visibilityLayer = nextVisibility
    if (body.allowedUserIds !== undefined) row.allowedUserIds = nextVisibility === VISIBILITY_LAYERS.RESTRICTED ? textList(body.allowedUserIds, 2, 120) : []
    touch(row)
    appendActivity(db, relationship, userId, 'cofounder_responsibility_updated', `Updated responsibility: ${row.title}`, row.visibilityLayer, { entityType: 'responsibility', entityId: row.id })
    return { ok: true, responsibility: publicResponsibility(row, relationship, userId) }
  })
}

export async function listObjectivesAsync(userId, relationshipId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'VIEW_SHARED_OBJECTIVES' })
    if (access.ok === false) return access
    const objectives = rows(db, 'cofounderObjectives')
      .filter(row => row.relationshipId === relationshipId)
      .map(row => publicObjective(db, row, access.relationship, userId))
      .filter(Boolean)
    return { ok: true, objectives }
  })
}

export async function createObjectiveAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'CREATE_SHARED_OBJECTIVE' })
    if (access.ok === false) return access
    const { relationship } = access
    const title = text(body.title, 180)
    if (!title) return fail('objective_title_required')
    const parties = [String(relationship.founderId), String(relationship.cofounderId)]
    const ownerId = String(body.ownerId || userId)
    const coOwnerIds = textList(body.coOwnerIds, 2, 120).filter(id => parties.includes(id))
    if (!parties.includes(ownerId)) return fail('objective_owner_invalid')
    const visibilityLayer = normalizeVisibility(body.visibilityLayer)
    if (visibilityLayer === VISIBILITY_LAYERS.PERSONAL && ownerId !== String(userId)) return fail('personal_objective_owner_mismatch', 403)
    if (body.responsibilityId && !rows(db, 'cofounderResponsibilities').some(row => row.id === body.responsibilityId && row.relationshipId === relationshipId)) return fail('responsibility_not_found', 404)
    const now = nowIso()
    const objective = {
      id: createId('cofounder_objective'),
      relationshipId,
      ventureId: relationship.projectId,
      title,
      description: text(body.description, 4000),
      kind: text(body.kind, 40) || 'shared',
      ownerId,
      coOwnerIds,
      responsibilityId: body.responsibilityId || null,
      dueDate: isoDate(body.dueDate),
      progress: boundedNumber(body.progress, 0, 0, 100),
      status: text(body.status, 30) || 'active',
      visibilityLayer,
      allowedUserIds: visibilityLayer === VISIBILITY_LAYERS.RESTRICTED ? textList(body.allowedUserIds, 2, 120) : [],
      linkedTaskIds: textList(body.linkedTaskIds, 100, 120),
      milestoneIds: textList(body.milestoneIds, 50, 120),
      evidenceIds: textList(body.evidenceIds, 100, 120),
      publishedMilestoneId: null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    rows(db, 'cofounderObjectives').push(objective)
    appendActivity(db, relationship, userId, 'cofounder_objective_created', `Created shared objective: ${title}`, visibilityLayer, { entityType: 'objective', entityId: objective.id })
    analytics(userId, 'cofounder_objective_created', { relationshipId, objectiveId: objective.id })
    return { ok: true, objective: publicObjective(db, objective, relationship, userId) }
  })
}

export async function patchObjectiveAsync(userId, objectiveId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, {}, () => {
    const db = readAuthorityDb()
    const objective = rows(db, 'cofounderObjectives').find(row => String(row.id) === String(objectiveId))
    if (!objective) return fail('cofounder_objective_not_found', 404)
    const access = requireRelationship(db, objective.relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'CREATE_SHARED_OBJECTIVE' })
    if (access.ok === false) return access
    const { relationship } = access
    if (!canViewLayer(objective, relationship, userId)) return fail('cofounder_objective_not_found', 404)
    if (!versionMatches(objective, body)) return fail('version_conflict', 409)
    const parties = [String(relationship.founderId), String(relationship.cofounderId)]
    if (body.ownerId !== undefined && !parties.includes(String(body.ownerId))) return fail('objective_owner_invalid')
    if (body.title !== undefined && !text(body.title, 180)) return fail('objective_title_required')
    const nextVisibility = body.visibilityLayer !== undefined ? normalizeVisibility(body.visibilityLayer) : normalizeVisibility(objective.visibilityLayer)
    if (nextVisibility === VISIBILITY_LAYERS.PERSONAL && String(body.ownerId || objective.ownerId) !== String(userId)) return fail('personal_objective_owner_mismatch', 403)
    if (body.responsibilityId !== undefined && body.responsibilityId
      && !rows(db, 'cofounderResponsibilities').some(row => row.id === body.responsibilityId && row.relationshipId === relationship.id)) {
      return fail('responsibility_not_found', 404)
    }
    for (const key of ['title', 'description', 'kind', 'status']) {
      if (body[key] !== undefined) objective[key] = text(body[key], key === 'description' ? 4000 : 500)
    }
    for (const key of ['coOwnerIds', 'linkedTaskIds', 'milestoneIds', 'evidenceIds', 'allowedUserIds']) {
      if (body[key] !== undefined) objective[key] = textList(body[key], 100, 120).filter(id => key !== 'coOwnerIds' || parties.includes(id))
    }
    if (body.ownerId !== undefined) objective.ownerId = String(body.ownerId)
    if (body.responsibilityId !== undefined) {
      objective.responsibilityId = body.responsibilityId || null
    }
    if (body.dueDate !== undefined) objective.dueDate = isoDate(body.dueDate)
    if (body.progress !== undefined) objective.progress = boundedNumber(body.progress, objective.progress, 0, 100)
    if (body.visibilityLayer !== undefined) objective.visibilityLayer = nextVisibility
    if (body.status === 'completed') {
      objective.completedAt = nowIso()
      objective.progress = 100
      analytics(userId, 'cofounder_objective_completed', { relationshipId: relationship.id, objectiveId: objective.id })
    }
    touch(objective)
    appendActivity(db, relationship, userId, 'cofounder_objective_updated', `Updated shared objective: ${objective.title}`, objective.visibilityLayer, { entityType: 'objective', entityId: objective.id })
    return { ok: true, objective: publicObjective(db, objective, relationship, userId) }
  })
}

export async function listDecisionsAsync(userId, relationshipId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'VIEW_COFOUNDER_RELATIONSHIP' })
    if (access.ok === false) return access
    const decisions = rows(db, 'cofounderDecisions')
      .filter(row => row.relationshipId === relationshipId)
      .map(row => publicDecision(row, access.relationship, userId))
      .filter(Boolean)
    return { ok: true, decisions }
  })
}

export async function createDecisionAsync(userId, relationshipId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'CREATE_DECISION' })
    if (access.ok === false) return access
    const { relationship } = access
    const title = text(body.title, 200)
    if (!title) return fail('decision_title_required')
    const now = nowIso()
    const visibilityLayer = normalizeVisibility(body.visibilityLayer)
    const decision = {
      id: createId('cofounder_decision'),
      relationshipId,
      ventureId: relationship.projectId,
      title,
      description: text(body.description, 4000),
      proposedBy: userId,
      status: 'open',
      responses: [],
      deadline: isoDate(body.deadline),
      resolvedAt: null,
      resolutionReason: '',
      visibilityLayer,
      allowedUserIds: visibilityLayer === VISIBILITY_LAYERS.RESTRICTED ? textList(body.allowedUserIds, 2, 120) : [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
    rows(db, 'cofounderDecisions').push(decision)
    appendActivity(db, relationship, userId, 'cofounder_decision_created', `Opened decision: ${title}`, visibilityLayer, { entityType: 'decision', entityId: decision.id })
    notify(db, userId === relationship.founderId ? relationship.cofounderId : relationship.founderId, userId, `requested a co-founder decision: ${title}`, `/workspaces/cofounder/${relationship.id}`, { relationshipId, kind: 'decision_requested', entityType: 'decision', entityId: decision.id })
    analytics(userId, 'cofounder_decision_created', { relationshipId, decisionId: decision.id })
    return { ok: true, decision: publicDecision(decision, relationship, userId) }
  })
}

export async function respondToDecisionAsync(userId, decisionId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, {}, () => {
    const db = readAuthorityDb()
    const decision = rows(db, 'cofounderDecisions').find(row => String(row.id) === String(decisionId))
    if (!decision) return fail('cofounder_decision_not_found', 404)
    const access = requireRelationship(db, decision.relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'RESPOND_TO_DECISION' })
    if (access.ok === false) return access
    const { relationship } = access
    if (!canViewLayer(decision, relationship, userId)) return fail('cofounder_decision_not_found', 404)
    if (body.version != null && Number(body.version) !== Number(decision.version || 1)) return fail('version_conflict', 409)
    if (!['open', 'discussion_requested'].includes(decision.status)) return fail('decision_already_resolved', 409)
    const response = String(body.response || '').toLowerCase()
    if (!COFOUNDER_DECISION_RESPONSES.includes(response)) return fail('invalid_decision_response')
    const now = nowIso()
    const prior = (Array.isArray(decision.responses) ? decision.responses : []).filter(row => String(row.userId) !== String(userId))
    prior.push({ userId, response, reason: text(body.reason, 1000), respondedAt: now })
    decision.responses = prior
    if (response === 'reject') {
      decision.status = 'rejected'
      decision.resolvedAt = now
      decision.resolutionReason = text(body.reason, 1000) || 'rejected'
    } else if (response === 'request_discussion') {
      decision.status = 'discussion_requested'
    } else if (response === 'approve') {
      const parties = new Set([String(relationship.founderId), String(relationship.cofounderId)])
      const approvals = new Set(decision.responses.filter(row => row.response === 'approve').map(row => String(row.userId)))
      if ([...parties].every(party => approvals.has(party))) {
        decision.status = 'approved'
        decision.resolvedAt = now
        decision.resolutionReason = text(body.reason, 1000) || 'mutual_approval'
      }
    }
    touch(decision, now)
    appendActivity(db, relationship, userId, 'cofounder_decision_response', `Responded ${response.replaceAll('_', ' ')} to: ${decision.title}`, decision.visibilityLayer, { entityType: 'decision', entityId: decision.id })
    if (['approved', 'rejected'].includes(decision.status)) analytics(userId, 'cofounder_decision_resolved', { relationshipId: relationship.id, decisionId: decision.id, status: decision.status })
    return { ok: true, decision: publicDecision(decision, relationship, userId) }
  })
}

export async function listActivityAsync(userId, relationshipId, query = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return runCofounderRead(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'VIEW_PRIVATE_COFOUNDER_ACTIVITY' })
    if (access.ok === false) return access
    const limit = Math.max(1, Math.min(100, Number(query.limit || 30)))
    const activity = rows(db, 'cofounderActivity')
      .filter(row => row.relationshipId === relationshipId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(row => publicActivity(row, access.relationship, userId))
      .filter(Boolean)
      .slice(0, limit)
    return { ok: true, activity }
  })
}

function metric(value, confidence, evidence) {
  return value == null ? { value: null, confidence: 0, evidence } : { value: Math.round(value * 10) / 10, confidence: Math.max(0, Math.min(1, confidence)), evidence }
}

function average(values) {
  const available = values.filter(value => value != null && Number.isFinite(Number(value)))
  return available.length ? available.reduce((sum, value) => sum + Number(value), 0) / available.length : null
}

function healthFromDb(db, relationship) {
  const now = Date.now()
  const responsibilities = rows(db, 'cofounderResponsibilities').filter(row => row.relationshipId === relationship.id)
  const objectives = rows(db, 'cofounderObjectives').filter(row => row.relationshipId === relationship.id)
  const decisions = rows(db, 'cofounderDecisions').filter(row => row.relationshipId === relationship.id)
  const tasks = rows(db, 'workspaceTasks').filter(row => row.workspaceId === relationship.workspaceId)
  const activity = rows(db, 'cofounderActivity').filter(row => row.relationshipId === relationship.id)
  const completedResponsibilities = responsibilities.filter(row => row.status === 'completed').length
  const completedTasks = tasks.filter(row => ['completed', 'done'].includes(String(row.status || '').toLowerCase())).length
  const executionDenominator = responsibilities.length + tasks.length
  const executionValue = executionDenominator ? ((completedResponsibilities + completedTasks) / executionDenominator) * 100 : null
  const progress = objectives.map(row => objectiveProgress(db, row).progress)
  const overdue = objectives.filter(row => row.dueDate && new Date(row.dueDate).getTime() < now && row.status !== 'completed').length
  const goalValue = progress.length ? Math.max(0, average(progress) - overdue * 5) : null
  const partyCounts = [relationship.founderId, relationship.cofounderId].map(partyId => {
    const completedTaskCount = tasks.filter(row => [row.assigneeId, row.assignedTo, row.ownerId].filter(Boolean).includes(partyId) && ['completed', 'done'].includes(String(row.status || '').toLowerCase())).length
    const completedResponsibilityCount = responsibilities.filter(row => row.ownerId === partyId && row.status === 'completed').length
    return completedTaskCount + completedResponsibilityCount
  })
  const contributionValue = partyCounts[0] + partyCounts[1]
    ? 100 - (Math.abs(partyCounts[0] - partyCounts[1]) / (partyCounts[0] + partyCounts[1])) * 100
    : null
  const recentActivity = activity.filter(row => now - new Date(row.createdAt).getTime() <= 30 * DAY_MS)
  const communicationValue = activity.length ? Math.min(100, (recentActivity.length / 8) * 100) : null
  const resolved = decisions.filter(row => ['approved', 'rejected', 'withdrawn'].includes(row.status))
  const stale = decisions.filter(row => ['open', 'discussion_requested'].includes(row.status) && now - new Date(row.createdAt).getTime() > 7 * DAY_MS)
  const decisionValue = decisions.length ? Math.max(0, (resolved.length / decisions.length) * 100 - stale.length * 8) : null
  const metrics = {
    executionAlignment: metric(executionValue, Math.min(1, executionDenominator / 8), { completed: completedResponsibilities + completedTasks, total: executionDenominator }),
    goalAlignment: metric(goalValue, Math.min(1, objectives.length / 4), { objectives: objectives.length, overdue }),
    contribution: metric(contributionValue, Math.min(1, (partyCounts[0] + partyCounts[1]) / 6), { founderCompleted: partyCounts[0], cofounderCompleted: partyCounts[1] }),
    communication: metric(communicationValue, Math.min(1, recentActivity.length / 6), { activityLast30Days: recentActivity.length }),
    decisionAlignment: metric(decisionValue, Math.min(1, decisions.length / 3), { decisions: decisions.length, resolved: resolved.length, stale: stale.length }),
  }
  let weighted = 0
  let weight = 0
  let confidenceTotal = 0
  const policyWeight = Object.values(HEALTH_WEIGHTS).reduce((sum, value) => sum + value, 0)
  for (const [key, entry] of Object.entries(metrics)) {
    if (entry.value == null) continue
    weighted += entry.value * HEALTH_WEIGHTS[key]
    weight += HEALTH_WEIGHTS[key]
    confidenceTotal += entry.confidence * HEALTH_WEIGHTS[key]
  }
  const overall = weight ? weighted / weight : null
  const confidence = confidenceTotal / policyWeight
  const band = overall == null || confidence < 0.35 ? 'insufficient_evidence' : overall >= 80 ? 'healthy' : overall >= 60 ? 'watch' : 'attention'
  return {
    overall: overall == null ? null : Math.round(overall),
    confidence: Math.round(confidence * 100) / 100,
    band,
    metrics,
    policyVersion: HEALTH_POLICY_VERSION,
  }
}

function healthObservations(current, previous) {
  if (!current || current.overall == null) {
    return ['There is not enough observable execution evidence to assess relationship health yet.']
  }
  const messages = []
  if (current.band === 'attention' || current.band === 'watch') {
    messages.push('Some observable collaboration signals need review.')
  }
  if (current.metrics.decisionAlignment.value != null && current.metrics.decisionAlignment.value < 60) {
    messages.push('Decision alignment is below the healthy range. Consider reviewing unresolved decisions.')
  }
  const priorDecision = previous?.metrics?.decisionAlignment?.value
  if (priorDecision != null && current.metrics.decisionAlignment.value != null && current.metrics.decisionAlignment.value + 5 < priorDecision) {
    messages.push('Potential friction detected: decision alignment has declined since the previous snapshot.')
  }
  if (current.metrics.goalAlignment.evidence?.overdue > 0) {
    messages.push(`${current.metrics.goalAlignment.evidence.overdue} shared objective${current.metrics.goalAlignment.evidence.overdue === 1 ? ' is' : 's are'} overdue.`)
  }
  return messages
}

export async function getRelationshipHealthAsync(userId, relationshipId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'VIEW_COFOUNDER_RELATIONSHIP' })
    if (access.ok === false) return access
    const current = healthFromDb(db, access.relationship)
    const snapshots = rows(db, 'cofounderAlignmentSnapshots')
      .filter(row => row.relationshipId === relationshipId)
      .sort((a, b) => String(a.snapshotDate).localeCompare(String(b.snapshotDate)))
    const previous = snapshots[snapshots.length - 1] || null
    const today = new Date().toISOString().slice(0, 10)
    if (snapshots[snapshots.length - 1]?.snapshotDate !== today) {
      rows(db, 'cofounderAlignmentSnapshots').push({
        id: createId('cofounder_alignment'),
        relationshipId,
        snapshotDate: today,
        metrics: current.metrics,
        overall: current.overall,
        confidence: current.confidence,
        policyVersion: HEALTH_POLICY_VERSION,
        evidenceReferences: Object.fromEntries(Object.entries(current.metrics).map(([key, value]) => [key, value.evidence])),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ownerId: userId,
        version: 1,
      })
    }
    return {
      ok: true,
      health: {
        ...current,
        observations: healthObservations(current, previous),
      },
    }
  })
}

function observedFor(db, userId, relationship) {
  const tasks = rows(db, 'workspaceTasks').filter(row => String(row.workspaceId) === String(relationship.workspaceId)
    && [row.assigneeId, row.assignedTo, row.ownerId].filter(Boolean).includes(userId))
  const responsibilities = rows(db, 'cofounderResponsibilities').filter(row => row.relationshipId === relationship.id && row.ownerId === userId)
  const objectives = rows(db, 'cofounderObjectives').filter(row => row.relationshipId === relationship.id && [row.ownerId, ...(row.coOwnerIds || [])].includes(userId))
  return {
    completedTasks: tasks.filter(row => ['completed', 'done'].includes(String(row.status || '').toLowerCase())).length,
    assignedTasks: tasks.length,
    completedResponsibilities: responsibilities.filter(row => row.status === 'completed').length,
    responsibilities: responsibilities.length,
    ownedObjectives: objectives.length,
  }
}

function claimedFor(profile) {
  return {
    title: profile?.title || profile?.discipline || '',
    skills: textList([...(Array.isArray(profile?.skills) ? profile.skills : []), ...(Array.isArray(profile?.subSkills) ? profile.subSkills : [])], 30, 80),
    industries: textList(profile?.industries, 12, 80),
    experienceYears: boundedNumber(profile?.yearsExperience, null, 0, 80),
  }
}

export async function getRelationshipEvidenceAsync(userId, relationshipId) {
  const disabled = feature(userId)
  if (disabled) return disabled
  const read = await runCofounderRead(userId, { relationshipId }, () => {
    const db = readAuthorityDb()
    const access = requireRelationship(db, relationshipId, userId, { statuses: ACTIVE_STATUSES, permission: 'VIEW_EXECUTION_EVIDENCE' })
    if (access.ok === false) return access
    return {
      ok: true,
      relationship: access.relationship,
      profiles: [relationshipPartnerProfile(db, access.relationship.founderId), relationshipPartnerProfile(db, access.relationship.cofounderId)],
      observed: {
        [access.relationship.founderId]: observedFor(db, access.relationship.founderId, access.relationship),
        [access.relationship.cofounderId]: observedFor(db, access.relationship.cofounderId, access.relationship),
      },
    }
  })
  if (read.ok === false) return read
  const parties = [
    { id: read.relationship.founderId, role: 'founder', profile: read.profiles[0] },
    { id: read.relationship.cofounderId, role: 'cofounder', profile: read.profiles[1] },
  ]
  const enriched = await Promise.all(parties.map(async party => {
    let trust = null
    let execution = null
    try { trust = await getPublicTrust(party.id, read.relationship.projectId) } catch { /* evidence remains explicitly unavailable */ }
    try {
      execution = await executionIntelligenceFor({ id: party.id, role: party.role === 'cofounder' ? 'collaborator' : 'founder' }, { projectId: read.relationship.projectId })
      if (execution?.ok === false) execution = null
    } catch { execution = null }
    return {
      userId: party.id,
      role: party.role,
      claimed: claimedFor(party.profile),
      verified: {
        trustScore: trust?.trustScore ?? trust?.trust_score ?? null,
        tier: trust?.tier || null,
        verificationStatus: trust?.verificationStatus || trust?.verification_status || 'unverified',
        verifiedSkills: Array.isArray(trust?.verifiedSkills) ? trust.verifiedSkills.map(row => ({ skill: row.skill, source: row.source, confidence: row.confidence, verifiedAt: row.verifiedAt })) : [],
        signals: Array.isArray(trust?.signals) ? trust.signals.slice(0, 30) : [],
      },
      observed: {
        ...read.observed[party.id],
        execution: execution ? {
          executionScore: execution.executionScore ?? execution.score ?? null,
          deliveryReliability: execution.deliveryReliability ?? null,
          completedMilestones: execution.completedMilestones ?? null,
          evidence: execution.evidence || null,
        } : null,
      },
    }
  }))
  return {
    ok: true,
    relationshipId,
    policyVersion: 'cofounder-evidence-v1',
    parties: enriched,
    separation: { claimed: 'profile-declared data', verified: 'canonical Trust Engine proofs and skills', observed: 'TechIT execution records' },
  }
}

function relationshipPartnerProfile(db, userId) {
  const profile = profileFor(db, userId)
  if (!profile) return null
  return {
    id: profile.id,
    name: profileName(profile),
    title: profile.title || profile.discipline || '',
    skills: profile.skills,
    subSkills: profile.subSkills,
    industries: profile.industries,
    yearsExperience: profile.yearsExperience,
    avatarUrl: profile.avatarUrl || '',
  }
}

export async function publishInvestorTeamSummaryAsync(userId, ventureId, body = {}) {
  const disabled = feature(userId)
  if (disabled) return disabled
  return applyCofounderMutation(userId, { projectId: ventureId }, () => {
    const db = readAuthorityDb()
    const project = founderOwnsVenture(db, userId, ventureId)
    if (!project) return fail('venture_not_found', 404)
    const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {}
    const team = Array.isArray(payload.team) ? payload.team.slice(0, 20).map(member => ({
      name: text(member?.name, 120),
      title: text(member?.title, 120),
      role: text(member?.role, 80),
    })).filter(member => member.name && member.title) : []
    if (!team.length) return fail('investor_team_summary_team_required')
    const sanitizedPayload = {
      team,
      teamStrength: boundedNumber(payload.teamStrength, null, 0, 100),
      strengths: textList(payload.strengths, 12, 160),
      verifiedEvidence: {
        completedMilestones: boundedNumber(payload.verifiedEvidence?.completedMilestones, null, 0, 1_000_000),
        verifiedContributors: boundedNumber(payload.verifiedEvidence?.verifiedContributors, null, 0, 1_000_000),
        executionConsistency: boundedNumber(payload.verifiedEvidence?.executionConsistency, null, 0, 100),
      },
    }
    const now = nowIso()
    const activeRelationships = rows(db, 'cofounderRelationships').filter(row => String(row.projectId) === String(ventureId) && row.status === COFOUNDER_STATUSES.ACTIVE)
    const existing = rows(db, 'cofounderTeamSummaries').find(row => String(row.projectId) === String(ventureId) && row.status === 'approved')
    const summary = {
      id: existing?.id || createId('cofounder_team_summary'),
      projectId: String(ventureId),
      ventureId: String(ventureId),
      sourceRelationshipIds: activeRelationships.map(row => row.id),
      approvedBy: userId,
      approvedAt: now,
      payload: sanitizedPayload,
      status: 'approved',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      ownerId: userId,
      version: existing ? Number(existing.version || 1) + 1 : 1,
    }
    if (existing) Object.assign(existing, summary)
    else rows(db, 'cofounderTeamSummaries').push(summary)
    return { ok: true, summary: { id: summary.id, projectId: summary.projectId, approvedAt: summary.approvedAt, version: summary.version, payload: summary.payload } }
  })
}

export async function getApprovedInvestorTeamSummaryAsync(userId, projectId) {
  return runCofounderRead(userId, { projectId }, () => {
    const db = readAuthorityDb()
    const summary = rows(db, 'cofounderTeamSummaries')
      .filter(row => String(row.projectId) === String(projectId) && row.status === 'approved')
      .sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)))[0] || null
    if (!summary) return fail('investor_team_summary_not_found', 404)
    return {
      ok: true,
      summary: {
        projectId: summary.projectId,
        approvedAt: summary.approvedAt,
        version: summary.version,
        payload: summary.payload,
      },
    }
  })
}

export function resolveCofounderRelationshipFromDb(db, userId, relationshipId, options = {}) {
  return requireRelationship(db, relationshipId, userId, options)
}

export function assertCofounderWorkspaceAccess(db, workspace, userId) {
  if (!workspace?.cofounderRelationshipId) return { ok: true }
  const relationship = rows(db, 'cofounderRelationships').find(row => String(row.id) === String(workspace.cofounderRelationshipId))
  if (!relationship || relationship.status !== COFOUNDER_STATUSES.ACTIVE || !relationshipParty(relationship, userId)) {
    return fail('cofounder_relationship_not_found', 404)
  }
  return { ok: true, relationship }
}
