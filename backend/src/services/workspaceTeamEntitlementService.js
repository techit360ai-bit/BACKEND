import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const active = row => row && row.status === 'active' && (!row.expiresAt || Date.parse(row.expiresAt) > Date.now())

export function createWorkspaceTeamGrant(founderId, input = {}) {
  return updateDb(db => {
    const workspaceId = String(input.workspaceId || '').trim()
    const workspace = rows(db, 'workspaces').find(row => row.id === workspaceId && (row.ownerId === founderId || row.userId === founderId))
    if (!workspace) return { ok: false, error: 'founder_workspace_required' }
    const members = rows(db, 'workspaceMembers').filter(row => row.workspaceId === workspaceId && row.status !== 'revoked')
    const eligible = members.filter(row => row.role === 'collaborator' || row.userId === input.collaboratorId).map(row => row.userId)
    const collaboratorId = String(input.collaboratorId || '').trim()
    if (!collaboratorId || !eligible.includes(collaboratorId)) return { ok: false, error: 'active_collaborator_required' }
    const grant = { id: createId('workspace_team_entitlement'), founderId, workspaceId, collaboratorId, subscriptionId: input.subscriptionId || null, capabilities: Array.isArray(input.capabilities) ? input.capabilities.map(String).slice(0, 100) : ['ADVANCED_WORKSPACE_AI'], pooledCredits: Math.max(0, Number(input.pooledCredits || 0)), status: 'active', expiresAt: input.expiresAt || null, createdAt: nowIso(), updatedAt: nowIso() }
    rows(db, 'workspaceTeamEntitlements').push(grant)
    return { ok: true, grant }
  })
}

export function workspaceTeamGrantFor(userId, workspaceId, capability, source = null) {
  const db = source || readDb()
  const grant = rows(db, 'workspaceTeamEntitlements').find(row => row.workspaceId === workspaceId && row.collaboratorId === userId && active(row) && (!row.capabilities?.length || row.capabilities.includes(capability)))
  return grant || null
}
