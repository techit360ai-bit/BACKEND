import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'
import { findIdentityById } from '../repositories/identityRepository.js'

export const SPECIALIZED_ROLES = Object.freeze(['founder', 'collaborator', 'investor', 'organization'])
export const ROLE_STATUSES = Object.freeze(['pending', 'pending_verification', 'active', 'suspended', 'revoked'])

export function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase()
  return role === 'user' || role === 'explorer' ? 'explorer' : role === 'organisation' ? 'organization' : role
}

const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const profileFor = (db, userId) => collection(db, 'profiles').find(row => row.id === userId) || null

function roleRows(db, userId) {
  return collection(db, 'userRoles').filter(row => row.userId === userId && row.active !== false)
}

function appendRoleEvent(db, userId, role, previousStatus, nextStatus, metadata = {}) {
  collection(db, 'roleHistory').push({ id: createId('role_event'), userId, role, previousStatus: previousStatus || null, nextStatus, actorId: metadata.actorId || userId, createdAt: nowIso(), metadata })
}

export function ensureBaseExplorer(db, userId) {
  const rows = collection(db, 'userRoles')
  let explorer = rows.find(row => row.userId === userId && normalizeRole(row.role) === 'explorer')
  if (!explorer) {
    explorer = { id: createId('user_role'), userId, role: 'explorer', status: 'active', active: true, assurance: 'CLAIMED', isPrimary: false, createdAt: nowIso(), updatedAt: nowIso() }
    rows.push(explorer)
    appendRoleEvent(db, userId, 'explorer', null, 'active', { reason: 'base_access' })
  } else {
    explorer.role = 'explorer'; explorer.status = 'active'; explorer.active = true; explorer.updatedAt = nowIso()
  }
  return explorer
}

export function synchronizeLegacyRoles(db, userId) {
  const profile = profileFor(db, userId)
  if (!profile) return { roles: [], profile: null }
  ensureBaseExplorer(db, userId)
  const rows = collection(db, 'userRoles')
  const legacy = [profile.role, ...(profile.secondaryRoles || []), ...(profile.roles || [])].map(normalizeRole).filter(Boolean)
  for (const role of new Set(legacy)) {
    if (role === 'explorer') continue
    const existing = rows.find(row => row.userId === userId && normalizeRole(row.role) === role)
    if (!existing) {
      rows.push({ id: createId('user_role'), userId, role, status: 'active', active: true, assurance: 'CLAIMED', isPrimary: role === normalizeRole(profile.role), createdAt: nowIso(), updatedAt: nowIso() })
      appendRoleEvent(db, userId, role, null, 'active', { reason: 'legacy_migration' })
    } else {
      existing.role = role; existing.active = existing.active !== false; existing.status = existing.status || 'active'; existing.updatedAt = nowIso()
    }
  }
  profile.secondaryRoles = [...new Set(rows.filter(row => row.userId === userId && normalizeRole(row.role) !== normalizeRole(profile.role) && row.status === 'active').map(row => normalizeRole(row.role)))]
  profile.updatedAt = nowIso()
  if (!contextFor(db, userId)) {
    const preferred = normalizeRole(profile.activeRole || profile.role || 'explorer')
    const assignment = rows.find(row => normalizeRole(row.role) === preferred && row.status === 'active') || rows.find(row => normalizeRole(row.role) === 'explorer')
    const now = nowIso()
    collection(db, 'activeContexts').push({ id: createId('context'), userId, role: normalizeRole(assignment?.role || 'explorer'), roleAssignmentId: assignment?.id || null, organizationId: null, workspaceId: null, resourceType: null, resourceId: null, status: 'active', startedAt: now, lastActiveAt: now, updatedAt: now })
  }
  return { roles: rows.filter(row => row.userId === userId), profile }
}

function validWorkspace(db, userId, workspaceId) {
  if (!workspaceId) return true
  const workspace = collection(db, 'workspaces').find(row => row.id === workspaceId)
  if (!workspace) return false
  if (workspace.ownerId === userId || workspace.userId === userId || workspace.createdBy === userId) return true
  return collection(db, 'workspaceMembers').some(row => row.workspaceId === workspaceId && row.userId === userId && row.status !== 'revoked')
}

function validOrganization(db, userId, organizationId) {
  if (!organizationId) return true
  return collection(db, 'organizationMemberships').some(row => row.organizationId === organizationId && row.userId === userId && row.status === 'active')
}

function contextFor(db, userId) {
  return collection(db, 'activeContexts').find(row => row.userId === userId && row.status === 'active') || null
}

// Explorer is the platform's base access assignment, not an additional
// switchable operating context once a user has a registered specialized role.
// Keep it persisted for backwards compatibility, but omit it from the
// available-context surface so single-role users do not get a misleading
// context switcher.
function presentableContexts(rows) {
  const activeSpecialized = rows.some(row => SPECIALIZED_ROLES.includes(normalizeRole(row.role)) && row.status === 'active')
  return rows
    .filter(row => ['active', 'pending', 'pending_verification'].includes(row.status))
    .filter(row => !(activeSpecialized && normalizeRole(row.role) === 'explorer'))
    .map(row => ({ role: normalizeRole(row.role), roleAssignmentId: row.id, status: row.status, assurance: row.assurance || 'CLAIMED', isPrimary: Boolean(row.isPrimary) }))
}

export function availableContexts(userId) {
  return updateDb(db => {
    const { roles } = synchronizeLegacyRoles(db, userId)
    const contexts = presentableContexts(roles)
    const profile = profileFor(db, userId)
    let activeContext = contextFor(db, userId)
    const primaryRole = normalizeRole(profile?.activeRole || profile?.role || roles.find(row => row.isPrimary)?.role || 'explorer')
    const primaryAssignment = roles.find(row => normalizeRole(row.role) === primaryRole && row.status === 'active') || roles.find(row => Boolean(row.isPrimary) && row.status === 'active')
    // Repair legacy sessions that were created without a context or were
    // incorrectly initialized as Explorer. An explicit context switch is
    // preserved; this branch only repairs the default/initial state.
    if (!activeContext || (activeContext.role === 'explorer' && primaryRole !== 'explorer' && !profile?.activeRole)) {
      const now = nowIso()
      const next = { id: activeContext?.id || createId('context'), userId, role: primaryRole, roleAssignmentId: primaryAssignment?.id || null, organizationId: null, workspaceId: null, resourceType: null, resourceId: null, status: 'active', startedAt: activeContext?.startedAt || now, lastActiveAt: now, updatedAt: now }
      if (activeContext) Object.assign(activeContext, next)
      else collection(db, 'activeContexts').push(next)
      activeContext = next
      if (profile && !profile.activeRole) { profile.activeRole = primaryRole; profile.updatedAt = now }
    }
    return { contexts, activeContext, profile: profile ? { activeRole: normalizeRole(profile.activeRole || activeContext?.role || profile.role || 'explorer') } : null }
  })
}

export function getActiveContext(userId) {
  let db = readDb()
  let context = contextFor(db, userId)
  if (!context && profileFor(db, userId)) {
    availableContexts(userId)
    db = readDb()
    context = contextFor(db, userId)
  }
  const profile = profileFor(db, userId)
  if (context) return context
  return { id: null, userId, role: normalizeRole(profile?.activeRole || profile?.role || 'explorer'), roleAssignmentId: null, organizationId: null, workspaceId: null, resourceType: null, resourceId: null, status: 'active', startedAt: null, lastActiveAt: null, updatedAt: null }
}

export function switchContext(userId, input = {}) {
  const requestedRole = normalizeRole(input.role)
  if (!['explorer', ...SPECIALIZED_ROLES].includes(requestedRole)) return { ok: false, error: 'role_unavailable' }
  return updateDb(db => {
    const { roles, profile } = synchronizeLegacyRoles(db, userId)
    const assignment = roles.find(row => normalizeRole(row.role) === requestedRole && row.status === 'active')
    if (!assignment) return { ok: false, error: 'role_not_activated' }
    if (!validWorkspace(db, userId, input.workspaceId)) return { ok: false, error: 'workspace_access_denied' }
    if (!validOrganization(db, userId, input.organizationId)) return { ok: false, error: 'organization_access_denied' }
    const previous = contextFor(db, userId)
    const now = nowIso()
    const next = { id: previous?.id || createId('context'), userId, role: requestedRole, roleAssignmentId: assignment.id, organizationId: input.organizationId || null, workspaceId: input.workspaceId || null, resourceType: input.resourceType || null, resourceId: input.resourceId || null, status: 'active', startedAt: previous?.role === requestedRole ? (previous.startedAt || now) : now, lastActiveAt: now, updatedAt: now }
    const contexts = collection(db, 'activeContexts')
    if (previous) Object.assign(previous, next); else contexts.push(next)
    if (profile) { profile.activeRole = requestedRole; profile.updatedAt = now }
    collection(db, 'contextHistory').push({ id: createId('context_event'), ...next, eventType: previous?.role === requestedRole ? 'context_touched' : 'context_switched', createdAt: now, metadata: {} })
    return { ok: true, activeContext: next, availableContexts: availableContextsFromDb(db, userId) }
  })
}

function availableContextsFromDb(db, userId) {
  const { roles } = synchronizeLegacyRoles(db, userId)
  return presentableContexts(roles)
}

export function touchContext(userId, input = {}) {
  const current = getActiveContext(userId)
  if (!current.id) return switchContext(userId, { role: input.role || current.role || 'explorer', ...input })
  return updateDb(db => {
    const context = contextFor(db, userId)
    if (!context) return { ok: false, error: 'active_context_not_found' }
    context.lastActiveAt = nowIso(); context.updatedAt = context.lastActiveAt
    return { ok: true, activeContext: context }
  })
}

export function activateRoleAssignment(userId, role, profilePatch = {}) {
  const normalized = normalizeRole(role)
  if (!['explorer', ...SPECIALIZED_ROLES].includes(normalized)) return { ok: false, error: 'role_unavailable' }
  return updateDb(db => {
    const profile = profileFor(db, userId)
    if (!profile) return { ok: false, error: 'profile_not_found' }
    ensureBaseExplorer(db, userId)
    const rows = collection(db, 'userRoles')
    let record = rows.find(row => row.userId === userId && normalizeRole(row.role) === normalized)
    const previousStatus = record?.status || null
    const now = nowIso()
    if (!record) { record = { id: createId('user_role'), userId, role: normalized, createdAt: now }; rows.push(record) }
    Object.assign(record, { role: normalized, status: 'active', active: true, assurance: record.assurance || 'CLAIMED', isPrimary: normalizeRole(profile.role) === normalized || Boolean(record.isPrimary), activatedAt: record.activatedAt || now, updatedAt: now, profile: { ...(record.profile || {}), ...profilePatch } })
    profile.secondaryRoles = [...new Set([...(profile.secondaryRoles || []), normalized])].filter(item => item !== normalizeRole(profile.role))
    profile.roleProfiles = { ...(profile.roleProfiles || {}), [normalized]: { ...(profile.roleProfiles?.[normalized] || {}), ...profilePatch, activatedAt: profile.roleProfiles?.[normalized]?.activatedAt || now, updatedAt: now } }
    appendRoleEvent(db, userId, normalized, previousStatus, 'active', { reason: 'explicit_activation' })
    return { ok: true, role: normalized, userRole: record, activeContext: contextFor(db, userId) }
  })
}

export function deactivateRoleAssignment(userId, role) {
  const normalized = normalizeRole(role)
  if (normalized === 'explorer') return { ok: false, error: 'base_explorer_cannot_be_deactivated' }
  return updateDb(db => {
    const record = roleRows(db, userId).find(row => normalizeRole(row.role) === normalized)
    if (!record) return { ok: false, error: 'role_not_activated' }
    const previousStatus = record.status || 'active'
    record.status = 'revoked'; record.active = false; record.deactivatedAt = nowIso(); record.updatedAt = record.deactivatedAt
    const profile = profileFor(db, userId)
    if (profile) {
      profile.secondaryRoles = (profile.secondaryRoles || []).filter(item => normalizeRole(item) !== normalized)
      if (normalizeRole(profile.activeRole) === normalized) profile.activeRole = 'explorer'
      profile.updatedAt = nowIso()
    }
    const context = contextFor(db, userId)
    if (context?.role === normalized) {
      const explorer = ensureBaseExplorer(db, userId)
      Object.assign(context, { role: 'explorer', roleAssignmentId: explorer.id, organizationId: null, workspaceId: null, resourceType: null, resourceId: null, startedAt: nowIso(), lastActiveAt: nowIso(), updatedAt: nowIso() })
    }
    appendRoleEvent(db, userId, normalized, previousStatus, 'revoked', { reason: 'user_deactivated' })
    return { ok: true, role: normalized, activeContext: contextFor(db, userId) }
  })
}

export function roleAssignments(userId) {
  return availableContexts(userId)
}

export async function roleAssignmentsAsync(userId) {
  if (process.env.IDENTITY_READ_SOURCE !== 'postgres') return roleAssignments(userId)
  const identity = await findIdentityById(userId)
  if (!identity) return { contexts: [], activeContext: null, profile: null }
  const roles = identity.roles || []
  const activeSpecialized = roles.some(row => SPECIALIZED_ROLES.includes(normalizeRole(row.role)) && row.status === 'active')
  const contexts = roles.filter(row => ['active', 'pending', 'pending_verification'].includes(row.status)).filter(row => !(activeSpecialized && normalizeRole(row.role) === 'explorer')).map(row => ({ role: normalizeRole(row.role), roleAssignmentId: row.id, status: row.status, assurance: row.assurance || 'CLAIMED', isPrimary: Boolean(row.isPrimary) }))
  return { contexts, activeContext: identity.activeContext, profile: identity.profile ? { activeRole: normalizeRole(identity.profile.activeRole || identity.activeContext?.role || identity.profile.role || 'explorer') } : null }
}
