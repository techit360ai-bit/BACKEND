import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({ workspaces: [], workspaceMembers: [], workspaceTeamEntitlements: [] })),
  updateAuthorityDb: vi.fn(mutator => mutator({ workspaces: [], workspaceMembers: [], workspaceTeamEntitlements: [] })),
  writeEnabled: vi.fn(() => false),
  createRow: vi.fn(async grant => ({ ok: true, grant })),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/workspaceTeamEntitlementRepository.js', () => ({
  workspaceTeamGrantWriteEnabled: mocks.writeEnabled,
  createWorkspaceTeamGrantRow: mocks.createRow,
}))

import { createWorkspaceTeamGrant } from '../services/workspaceTeamEntitlementService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.writeEnabled.mockReturnValue(false)
})

describe('workspace team grant store (§5 cutover)', () => {
  it('uses the snapshot path when the row-level store is off', async () => {
    mocks.updateAuthorityDb.mockImplementationOnce(mutator => mutator({ workspaces: [{ id: 'ws-1', ownerId: 'founder-1' }], workspaceMembers: [{ workspaceId: 'ws-1', userId: 'collab-1', role: 'collaborator', status: 'active' }], workspaceTeamEntitlements: [] }))
    const result = await createWorkspaceTeamGrant('founder-1', { workspaceId: 'ws-1', collaboratorId: 'collab-1' })
    expect(result.ok).toBe(true)
    expect(mocks.updateAuthorityDb).toHaveBeenCalledTimes(1)
    expect(mocks.createRow).not.toHaveBeenCalled()
  })

  it('writes row-level and never touches the snapshot when the store is on', async () => {
    mocks.writeEnabled.mockReturnValue(true)
    const result = await createWorkspaceTeamGrant('founder-1', { workspaceId: 'ws-1', collaboratorId: 'collab-1', pooledCredits: 50 })
    expect(result.ok).toBe(true)
    expect(mocks.createRow).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1', collaboratorId: 'collab-1', pooledCredits: 50 }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })
})
