import { findIdentityById } from '../repositories/identityRepository.js'
import { getPublicTrust } from './trustAuthority.js'

const SCOPE_KEYS = ['projectId', 'organizationId', 'programId', 'cohortId', 'hackathonId']

function normalizeRole(role) {
  const value = String(role || '').toLowerCase()
  if (value === 'admin') return 'workspace'
  if (value === 'organization') return 'organisation'
  if (value === 'organisation_admin') return 'organisation'
  return value || 'workspace'
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
  if (process.env.MCP_ENABLED !== 'true') {
    return { ok: false, error: 'execution_intelligence_unavailable', detail: 'MCP is not enabled' }
  }
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

  try {
    const { getTechitService } = await import('../../../Plugins-MCP/server/techit-service.ts')
    const svc = await getTechitService()
    const view = await svc.executionIntelligence(scope)
    // Compose the canonical Trust Engine — this route owns no trust formula.
    const subjects = (view.trustSubjects || []).filter((subject) => subject.kind === 'actor')
    const trust = await Promise.all(subjects.map(async (subject) => ({ subjectId: subject.id, kind: 'actor', ...(await getPublicTrust(subject.id, null)) })))
    return { ok: true, ...view, trust }
  } catch (error) {
    return { ok: false, error: 'execution_intelligence_unavailable', detail: String(error?.message || error) }
  }
}
