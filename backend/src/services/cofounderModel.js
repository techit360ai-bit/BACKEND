import { readAuthorityDb } from '../config/database.js'

export const COFOUNDER_STATUSES = Object.freeze({
  INVITED: 'INVITED',
  DISCUSSION: 'DISCUSSION',
  MUTUAL_INTEREST: 'MUTUAL_INTEREST',
  DUE_DILIGENCE: 'DUE_DILIGENCE',
  COFOUNDER_PROPOSAL: 'COFOUNDER_PROPOSAL',
  ACCEPTED: 'ACCEPTED',
  ACTIVE: 'ACTIVE',
  DECLINED: 'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
})

export const PRE_ACTIVE_STATUSES = Object.freeze([
  COFOUNDER_STATUSES.INVITED,
  COFOUNDER_STATUSES.DISCUSSION,
  COFOUNDER_STATUSES.MUTUAL_INTEREST,
  COFOUNDER_STATUSES.DUE_DILIGENCE,
  COFOUNDER_STATUSES.COFOUNDER_PROPOSAL,
  COFOUNDER_STATUSES.ACCEPTED,
])

export const ACTIVE_STATUSES = Object.freeze([COFOUNDER_STATUSES.ACTIVE])
export const TERMINAL_STATUSES = Object.freeze([COFOUNDER_STATUSES.DECLINED, COFOUNDER_STATUSES.WITHDRAWN, COFOUNDER_STATUSES.ENDED])

export const VISIBILITY_LAYERS = Object.freeze({
  SHARED: 'SHARED',
  PERSONAL: 'PERSONAL',
  RESTRICTED: 'RESTRICTED',
})

export const COFOUNDER_ROLE_TYPES = Object.freeze([
  'technical',
  'product',
  'growth',
  'marketing',
  'operations',
  'finance',
  'ai_data',
  'industry_domain',
  'other',
])

export const COFOUNDER_COMMITMENT_TYPES = Object.freeze([
  'full_time',
  'part_time',
  'transitioning_to_full_time',
  'flexible',
])

export const COFOUNDER_VENTURE_STAGES = Object.freeze(['idea', 'validation', 'mvp', 'early_revenue', 'growth'])

export const COFOUNDER_DECISION_RESPONSES = Object.freeze([
  'approve',
  'reject',
  'request_discussion',
  'abstain',
])

export const COFOUNDER_PERMISSIONS = Object.freeze([
  'VIEW_COFOUNDER_RELATIONSHIP',
  'VIEW_SHARED_OBJECTIVES',
  'CREATE_SHARED_OBJECTIVE',
  'ASSIGN_COFOUNDER_TASK',
  'VIEW_PRIVATE_COFOUNDER_ACTIVITY',
  'CREATE_DECISION',
  'RESPOND_TO_DECISION',
  'VIEW_EXECUTION_EVIDENCE',
  'MANAGE_COFOUNDER_RELATIONSHIP',
])

export function rows(db, name) {
  if (!Array.isArray(db[name])) db[name] = []
  return db[name]
}

export function text(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function textList(value, limit = 20, max = 80) {
  return (Array.isArray(value) ? value : [])
    .map(item => text(item, max))
    .filter(Boolean)
    .slice(0, limit)
}

export function normalizeVisibility(value, fallback = VISIBILITY_LAYERS.SHARED) {
  const normalized = String(value || '').toUpperCase()
  return Object.values(VISIBILITY_LAYERS).includes(normalized) ? normalized : fallback
}

export function normalizeStatus(value) {
  const normalized = String(value || '').toUpperCase()
  return Object.values(COFOUNDER_STATUSES).includes(normalized) ? normalized : null
}

export function relationshipParty(relationship, userId) {
  if (!relationship || !userId) return null
  if (String(relationship.founderId) === String(userId)) return 'founder'
  if (String(relationship.cofounderId) === String(userId)) return 'cofounder'
  return null
}

export function relationshipForUser(db, relationshipId, userId) {
  return rows(db, 'cofounderRelationships').find(row =>
    String(row.id) === String(relationshipId) && Boolean(relationshipParty(row, userId))
  ) || null
}

export function activeRelationshipForUser(db, relationshipId, userId) {
  const relationship = relationshipForUser(db, relationshipId, userId)
  return relationship && relationship.status === COFOUNDER_STATUSES.ACTIVE ? relationship : null
}

export function canViewLayer(row, relationship, userId) {
  if (!relationship || !relationshipParty(relationship, userId)) return false
  const layer = normalizeVisibility(row?.visibilityLayer)
  if (layer === VISIBILITY_LAYERS.SHARED) return relationship.status === COFOUNDER_STATUSES.ACTIVE
  if (layer === VISIBILITY_LAYERS.PERSONAL) {
    return [row.ownerId, row.createdBy, row.assigneeId, row.assignedTo]
      .filter(Boolean)
      .some(value => String(value) === String(userId))
  }
  if (layer === VISIBILITY_LAYERS.RESTRICTED) {
    const allowed = Array.isArray(row.allowedUserIds) ? row.allowedUserIds.map(String) : []
    return allowed.includes(String(userId))
  }
  return false
}

export function relationshipPermissions(relationship, userId) {
  if (!relationship || !relationshipParty(relationship, userId)) return []
  if (relationship.status === COFOUNDER_STATUSES.PAUSED) {
    return ['VIEW_COFOUNDER_RELATIONSHIP', 'MANAGE_COFOUNDER_RELATIONSHIP']
  }
  if (relationship.status !== COFOUNDER_STATUSES.ACTIVE) return ['VIEW_COFOUNDER_RELATIONSHIP']
  return [...COFOUNDER_PERMISSIONS]
}

export function profileName(profile, fallback = 'TechIT member') {
  if (!profile) return fallback
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()
    || profile.username
    || profile.email
    || fallback
}

export function otherParty(relationship, userId, db = readAuthorityDb()) {
  const otherId = String(relationship.founderId) === String(userId) ? relationship.cofounderId : relationship.founderId
  const profile = rows(db, 'profiles').find(row => String(row.id) === String(otherId)) || null
  return {
    id: otherId,
    name: profileName(profile),
    title: profile?.title || profile?.discipline || '',
    avatarUrl: profile?.avatarUrl || '',
    role: relationshipParty(relationship, userId) === 'founder' ? 'cofounder' : 'founder',
  }
}

export function projectForRelationship(db, relationship) {
  return rows(db, 'projects').find(row => String(row.id) === String(relationship.projectId)) || null
}

export function publicRelationship(relationship, userId, db = readAuthorityDb()) {
  const role = relationshipParty(relationship, userId)
  const layerAllowed = role && (
    relationship.status === COFOUNDER_STATUSES.ACTIVE
    || relationship.status === COFOUNDER_STATUSES.PAUSED
    || relationship.status === COFOUNDER_STATUSES.ENDED
    || PRE_ACTIVE_STATUSES.includes(relationship.status)
  )
  if (!layerAllowed) return null
  const base = {
    id: relationship.id,
    status: relationship.status,
    role,
    ventureId: relationship.projectId,
    roleTitle: relationship.roleTitle || '',
    responsibilities: relationship.responsibilities || '',
    commitment: relationship.commitment || {},
    initialPeriodMonths: relationship.initialPeriodMonths || null,
    equityDiscussionStatus: relationship.equityDiscussionStatus || 'to_be_discussed',
    workspaceId: relationship.workspaceId || null,
    otherParty: otherParty(relationship, userId, db),
    invitedAt: relationship.invitedAt || relationship.createdAt || null,
    discussionAcceptedAt: relationship.discussionAcceptedAt || null,
    acceptedAt: relationship.acceptedAt || null,
    activatedAt: relationship.activatedAt || null,
    pausedAt: relationship.pausedAt || null,
    endedAt: relationship.endedAt || null,
    endReason: relationship.endReason || null,
    version: Number(relationship.version || 1),
    permissions: relationshipPermissions(relationship, userId),
  }
  if (PRE_ACTIVE_STATUSES.includes(relationship.status)) {
    return {
      ...base,
      proposedTerms: relationship.proposedTerms || null,
      revisions: Number(relationship.revisions || 0),
      requestedChanges: Array.isArray(relationship.requestedChanges) ? relationship.requestedChanges : [],
      mutualInterest: relationship.mutualInterest || {},
    }
  }
  return base
}
