import { findIdentityById } from '../repositories/identityRepository.js'
import { readAuthorityDb } from '../config/database.js'
import { publicTrustFor } from './trustAuthority.js'
import { requireOrganizationPermissionAsync } from './organizationIntelligenceService.js'
import { investorCanReadStartup } from './investorIntelligenceService.js'

const SCOPE_KEYS = ['projectId', 'organizationId', 'programId', 'cohortId', 'hackathonId']
const ORG_SCOPE_KEYS = ['organizationId', 'programId', 'cohortId']

function normalizeRole(role) {
  const value = String(role || '').toLowerCase()
  if (value === 'admin') return 'workspace'
  if (value === 'organization') return 'organisation'
  if (value === 'organisation_admin') return 'organisation'
  return value || 'workspace'
}

const COHORT_MIN_SIZE = 5
const COMPLETED_MILESTONE = new Set(['completed', 'complete', 'done', 'shipped'])
const rowsOf = (db, name) => (Array.isArray(db[name]) ? db[name] : [])
const industryOf = project => String(project?.industry || project?.sector || project?.vertical || project?.category || '').trim().toLowerCase()
const stageOf = project => String(project?.stage || project?.status || 'idea').trim().toLowerCase()
const completedMilestones = (db, projectId) => rowsOf(db, 'milestones')
  .filter(row => String(row.projectId || row.startupId || '') === String(projectId) && COMPLETED_MILESTONE.has(String(row.status || '').toLowerCase()))
  .length

/**
 * Anonymous cohort comparison (Phase E): how the caller's project compares to
 * other projects in the SAME industry and lifecycle stage. Only aggregate
 * numbers are returned (size, percentile, median) and only when the cohort is
 * at least COHORT_MIN_SIZE, so no individual peer is ever identifiable. Derived
 * from persisted project rows — nothing is scored or invented.
 */
function cohortFor(db, project) {
  if (!project) return { available: false, reason: 'no_project' }
  const industry = industryOf(project)
  const stage = stageOf(project)
  if (!industry) return { available: false, reason: 'no_industry', industry: null, stage }
  const peers = rowsOf(db, 'projects').filter(peer => industryOf(peer) === industry && stageOf(peer) === stage)
  if (peers.length < COHORT_MIN_SIZE) {
    return { available: false, reason: 'cohort_too_small', industry, stage, size: peers.length, minimum: COHORT_MIN_SIZE }
  }
  // Same industry AND same stage; the metric is completed milestones, which
  // varies within a stage, so the percentile is meaningful.
  const values = peers.map(peer => completedMilestones(db, peer.id)).sort((a, b) => a - b)
  const value = completedMilestones(db, project.id)
  const atOrBelow = values.filter(candidate => candidate <= value).length
  return {
    available: true,
    anonymous: true,
    industry,
    stage,
    size: values.length,
    minimum: COHORT_MIN_SIZE,
    metric: 'completed_milestones',
    value,
    percentile: Math.round((atOrBelow / values.length) * 100),
    median: values[Math.floor(values.length / 2)],
  }
}

function organizationMembership(db, userId, organizationId) {
  return (Array.isArray(db.organizationMemberships) ? db.organizationMemberships : [])
    .some(row => row.organizationId === organizationId && row.userId === userId && row.status === 'active')
}

function hackathonScopeAuthorized(db, userId, hackathonId) {
  const hackathon = (Array.isArray(db.hackathons) ? db.hackathons : []).find(row => row.id === hackathonId)
  if (!hackathon) return false
  if (hackathon.ownerId === userId) return true
  return Boolean(hackathon.organizationId && organizationMembership(db, userId, hackathon.organizationId))
}

/**
 * Phase C access boundary. A scope key names a tenant or a hackathon, so a
 * caller may only use the ones they belong to. An organization/program/cohort
 * scope requires an active membership of that organization (pinning the
 * organizationId so a program/cohort id can never point at another tenant); a
 * hackathon scope requires ownership. Investors are stripped of all tenant
 * scopes — they can NEVER read an organization cohort that is not theirs — and
 * may only scope a startup they are authorized for, and only when the founder
 * granted the execution consent scope.
 */
async function authorizeExecutionScope(user, scope) {
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin'
  const wantsOrgScope = ORG_SCOPE_KEYS.some(key => typeof scope[key] === 'string' && scope[key].trim())

  if (wantsOrgScope && !isAdmin) {
    const requestedOrg = typeof scope.organizationId === 'string' && scope.organizationId.trim() ? scope.organizationId.trim() : null
    const context = await requireOrganizationPermissionAsync(user.id, 'view', requestedOrg)
    if (!context.ok) return { ok: false, status: 403, error: 'scope_forbidden', detail: 'organization_membership_required' }
    scope.organizationId = context.organizationId
  }

  if (typeof scope.hackathonId === 'string' && scope.hackathonId.trim() && !isAdmin) {
    if (!hackathonScopeAuthorized(readAuthorityDb(), user.id, scope.hackathonId)) {
      return { ok: false, status: 403, error: 'scope_forbidden', detail: 'hackathon_ownership_required' }
    }
  }

  if (normalizeRole(user.role) === 'investor') {
    delete scope.organizationId
    delete scope.programId
    delete scope.cohortId
    delete scope.hackathonId
    if (scope.projectId) {
      if (!investorCanReadStartup(readAuthorityDb(), user.id, scope.projectId)) {
        return { ok: false, status: 403, error: 'scope_forbidden', detail: 'startup_not_authorized' }
      }
    }
  }

  return { ok: true }
}

/**
 * Canonical execution-intelligence view for ANY consumer surface (WS-H).
 *
 * Founder dashboard, collaborator workspace, investor section, organization
 * dashboard and hackathon console all read THIS — the same scope/role-aware
 * projection of workspace execution. Trust is owned by the canonical Trust
 * Engine, read through `getPublicTrust` (row-level when the trust read source is
 * postgres); this service never computes a score of its own.
 *
 * The caller's workspace/project defaults come from the identity repository
 * (row-level under IDENTITY_READ_SOURCE=postgres) instead of the whole-DB
 * snapshot, so the §5 request path never loads a platform snapshot here.
 */
export async function executionIntelligenceFor(user, query = {}) {
  const identity = await findIdentityById(user.id)
  const profile = identity?.profile || {}
  const context = identity?.activeContext || null
  const workspaceId = typeof profile.workspaceId === 'string'
    ? profile.workspaceId
    : typeof context?.workspaceId === 'string' ? context.workspaceId : `user-${user.id}`
  const role = normalizeRole(user.role)
  const scope = { workspaceId, role }
  for (const key of SCOPE_KEYS) {
    const value = query[key]
    if (typeof value === 'string' && value.trim()) scope[key] = value.trim()
  }
  if (typeof query.actorId === 'string' && query.actorId.trim()) scope.actorId = query.actorId.trim()
  if (query.sinceHours !== undefined && Number.isFinite(Number(query.sinceHours))) scope.sinceHours = Number(query.sinceHours)
  // A collaborator's default view is their own execution; a founder's is their project.
  if (role === 'collaborator' && !scope.actorId) scope.actorId = user.id
  if (role === 'founder' && !scope.projectId && typeof profile.projectId === 'string') scope.projectId = profile.projectId

  // Access boundary first — never reach the projection with an unauthorized scope.
  const permission = await authorizeExecutionScope(user, scope)
  if (!permission.ok) return permission
  try {
    const { getTechitService } = await import('../../../Plugins-MCP/server/techit-service.ts')
    const svc = await getTechitService()
    const view = await svc.executionIntelligence(scope)
    // Compose the canonical Trust Engine — this route owns no trust formula.
    const subjects = (view.trustSubjects || []).filter((subject) => subject.kind === 'actor')
    const trust = await Promise.all(subjects.map(async (subject) => ({ subjectId: subject.id, kind: 'actor', ...(await publicTrustFor(subject.id, null)) })))
    // Anonymous cohort comparison for the caller's project (when one is resolved).
    const db = readAuthorityDb()
    const projectId = scope.projectId || (Array.isArray(view.signals?.projects) ? view.signals.projects[0] : null)
    const project = projectId ? rowsOf(db, 'projects').find(row => String(row.id) === String(projectId)) : null
    const cohort = cohortFor(db, project)
    return { ok: true, ...view, cohort, trust }
  } catch (error) {
    return { ok: false, error: 'execution_intelligence_unavailable', detail: String(error?.message || error) }
  }
}
