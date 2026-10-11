import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'
import { createWorkspaceTeamGrantRow, workspaceTeamGrantWriteEnabled } from '../repositories/workspaceTeamEntitlementRepository.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const active = row => row && row.status === 'active' && (!row.expiresAt || Date.parse(row.expiresAt) > Date.now())

function buildGrant(founderId, input = {}) {
  return {
    id: createId('workspace_team_entitlement'),
    founderId,
    workspaceId: String(input.workspaceId || '').trim(),
    collaboratorId: String(input.collaboratorId || '').trim(),
    subscriptionId: input.subscriptionId || null,
    capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(String).slice(0, 100) : ['ADVANCED_WORKSPACE_AI'],
    pooledCredits: Math.max(0, Number(input.pooledCredits || 0)),
    status: 'active',
    expiresAt: input.expiresAt || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
}

export async function createWorkspaceTeamGrant(founderId, input = {}) {
  const grant = buildGrant(founderId, input)
  if (workspaceTeamGrantWriteEnabled()) return createWorkspaceTeamGrantRow(grant)
  return updateDb(db => {
    const workspace = rows(db, 'workspaces').find(row => row.id === grant.workspaceId && (row.ownerId === founderId || row.userId === founderId))
    if (!workspace) return { ok: false, error: 'founder_workspace_required' }
    const members = rows(db, 'workspaceMembers').filter(row => row.workspaceId === grant.workspaceId && row.status !== 'revoked')
    const eligible = members.filter(row => row.role === 'collaborator' || row.userId === grant.collaboratorId).map(row => row.userId)
    if (!grant.collaboratorId || !eligible.includes(grant.collaboratorId)) return { ok: false, error: 'active_collaborator_required' }
    rows(db, 'workspaceTeamEntitlements').push(grant)
    return { ok: true, grant }
  })
}

export function workspaceTeamGrantFor(userId, workspaceId, capability, source = null) {
  const db = source || readDb()
  const grant = rows(db, 'workspaceTeamEntitlements').find(row => row.workspaceId === workspaceId && row.collaboratorId === userId && active(row) && (!row.capabilities?.length || row.capabilities.includes(capability)))
  return grant || null
}
