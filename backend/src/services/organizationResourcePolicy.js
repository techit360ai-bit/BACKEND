const RESOURCE_KINDS = new Set(['training', 'software', 'dataset', 'workspace'])
const ACCESS_POLICIES = new Set(['organization', 'program', 'cohort', 'public_free', 'invite'])
const VISIBILITIES = new Set(['private', 'organization', 'public'])
const COMPLETION_MODES = new Set(['native', 'connector', 'webhook'])
const SECRET_LIKE_FIELD = /(credential|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)/i

const text = value => typeof value === 'string' ? value.trim() : ''
const isoOrNull = value => {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

const rows = (db, name) => {
  if (!Array.isArray(db[name])) db[name] = []
  return db[name]
}

function organizationMembership(db, userId, organizationId) {
  return rows(db, 'organizationMemberships').some(row =>
    row.userId === userId && row.organizationId === organizationId && row.status === 'active')
}

function acceptedProgramEnrollment(db, userId, resource) {
  return rows(db, 'programEnrollments').some(row =>
    row.founderId === userId
    && row.status === 'accepted'
    && (!resource.organizationId || row.organizationId === resource.organizationId)
    && (!resource.programId || row.programId === resource.programId)
    && (!resource.cohortId || row.cohortId === resource.cohortId))
}

/**
 * Resolve organization-resource access exactly once, server-side. Every
 * consumer (Academy, MCP, organization intelligence) uses this result rather
 * than inferring access from visibility flags.
 */
export function organizationResourceAccess(db, userId, resource) {
  const policy = String(resource.accessPolicy || (resource.visibility === 'public' ? 'public_free' : 'organization')).toLowerCase()
  const decision = {
    allowed: false,
    source: 'access_policy',
    reason: 'access_policy_not_met',
    organizationId: resource.organizationId || null,
    programId: resource.programId || null,
    cohortId: resource.cohortId || null,
    expiresAt: resource.expiresAt || null,
  }
  const status = String(resource.integrationStatus || resource.status || 'active').toLowerCase()
  if (['archived', 'revoked', 'disabled'].includes(status)) {
    return { ...decision, source: 'resource_status', reason: `resource_${status}` }
  }
  if (resource.expiresAt && Number.isFinite(new Date(resource.expiresAt).getTime()) && new Date(resource.expiresAt).getTime() <= Date.now()) {
    return { ...decision, source: 'resource_expiry', reason: 'resource_expired' }
  }
  if (policy === 'public_free') {
    return { ...decision, allowed: true, source: 'public_free', reason: 'public_free_access' }
  }
  if (policy === 'organization') {
    if (resource.ownerId === userId) {
      return { ...decision, allowed: true, source: 'resource_owner', reason: 'resource_owner' }
    }
    if (organizationMembership(db, userId, resource.organizationId)) {
      return { ...decision, allowed: true, source: 'organization_membership', reason: 'active_organization_membership' }
    }
    return { ...decision, source: 'organization_membership', reason: 'organization_membership_required' }
  }
  if (['program', 'cohort', 'invite'].includes(policy)) {
    if (acceptedProgramEnrollment(db, userId, resource)) {
      return { ...decision, allowed: true, source: 'program_enrollment', reason: `accepted_${policy}_enrollment` }
    }
    return { ...decision, source: 'program_enrollment', reason: `${policy}_enrollment_required` }
  }
  return decision
}

export function stripSecretLikeFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !SECRET_LIKE_FIELD.test(key)))
}

export function normalizeOrganizationResourcePayload(name, body = {}) {
  if (!['organizationIntegrations', 'organizationResources'].includes(name)) return body
  const input = stripSecretLikeFields({ ...body })
  const resourceKind = String(input.resourceKind || input.kind || (name === 'organizationIntegrations' ? 'software' : 'training')).toLowerCase()
  const accessPolicy = String(input.accessPolicy || input.audiencePolicy || (input.visibility === 'public' ? 'public_free' : 'organization')).toLowerCase()
  const visibility = String(input.visibility || (accessPolicy === 'public_free' ? 'public' : 'organization')).toLowerCase()
  const completionMode = String(input.completionMode || (name === 'organizationIntegrations' ? 'connector' : 'native')).toLowerCase()
  const normalizedPolicy = ACCESS_POLICIES.has(accessPolicy) ? accessPolicy : 'organization'
  return {
    ...input,
    organizationId: text(input.organizationId || input.ownerOrganizationId) || null,
    resourceKind: RESOURCE_KINDS.has(resourceKind) ? resourceKind : (name === 'organizationIntegrations' ? 'software' : 'dataset'),
    accessPolicy: normalizedPolicy,
    audiencePolicy: text(input.audiencePolicy) || normalizedPolicy,
    visibility: VISIBILITIES.has(visibility) ? visibility : 'organization',
    completionMode: COMPLETION_MODES.has(completionMode) ? completionMode : 'native',
    completionEvent: text(input.completionEvent) || null,
    externalId: text(input.externalId) || null,
    resourceId: text(input.resourceId) || null,
    integrationId: text(input.integrationId) || null,
    pluginName: text(input.pluginName) || null,
    pluginVersion: text(input.pluginVersion) || null,
    expiresAt: isoOrNull(input.expiresAt),
    integrationStatus: text(input.integrationStatus || input.status) || 'active',
    lastVerifiedAt: isoOrNull(input.lastVerifiedAt),
    publishedAt: isoOrNull(input.publishedAt) || (['published', 'active'].includes(String(input.status || input.integrationStatus || '').toLowerCase()) ? new Date().toISOString() : null),
  }
}

export function sanitizeOrganizationResource(row) {
  return stripSecretLikeFields(row)
}
