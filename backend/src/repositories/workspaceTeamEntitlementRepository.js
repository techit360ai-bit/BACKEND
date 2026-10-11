// Row-level workspace-team grant store (§5 cutover).
//
// The grant read path already travels on the scoped finance snapshot
// (`loadFinanceSnapshotPostgres` includes workspaceTeamEntitlements); this
// repository removes the write-side whole-DB `updateDb` by validating workspace
// ownership/membership through the workspace repository and upserting the grant
// row-level. Enabled with FINANCE_WRITE_SOURCE=postgres (or the explicit
// WORKSPACE_TEAM_WRITE_SOURCE).
import { withPlatformTransaction, upsertRecord } from './platformCollectionRepository.js'
import { findWorkspace, listMembers } from './workspaceProjectRepository.js'

const enabled = () => process.env.FINANCE_WRITE_SOURCE === 'postgres' || process.env.WORKSPACE_TEAM_WRITE_SOURCE === 'postgres'

export function workspaceTeamGrantWriteEnabled() { return enabled() }

export async function createWorkspaceTeamGrantRow(grant) {
  const workspace = await findWorkspace(grant.workspaceId)
  if (!workspace || (workspace.ownerId !== grant.founderId && workspace.userId !== grant.founderId)) return { ok: false, error: 'founder_workspace_required' }
  const members = await listMembers(grant.workspaceId)
  const eligible = members.filter(row => row.role === 'collaborator' || row.userId === grant.collaboratorId).map(row => row.userId)
  if (!grant.collaboratorId || !eligible.includes(grant.collaboratorId)) return { ok: false, error: 'active_collaborator_required' }
  await withPlatformTransaction(
    client => upsertRecord(client, 'workspaceTeamEntitlements', { ...grant, ownerId: grant.collaboratorId }, { operation: 'insert', idempotencyKey: `workspace-team-grant:${grant.id}` }),
    { userId: grant.founderId },
  )
  return { ok: true, grant }
}
