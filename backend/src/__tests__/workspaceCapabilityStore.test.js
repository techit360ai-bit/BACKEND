import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(),
  enabled: vi.fn(() => true),
  workspaceAccess: vi.fn(async () => ({ workspace: { id: 'ws1', projectId: 'p1' }, owner: true, member: null })),
  findById: vi.fn(async () => null),
  findByWorkspace: vi.fn(async () => []),
  listByOwner: vi.fn(async () => []),
  findByField: vi.fn(async () => []),
  insert: vi.fn(async () => {}),
  save: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/workspaceCapabilityRepository.js', () => ({
  workspaceCapabilityEnabled: mocks.enabled,
  workspaceCapabilityFallbackEnabled: () => true,
  workspaceAccess: mocks.workspaceAccess,
  findById: mocks.findById,
  findByWorkspace: mocks.findByWorkspace,
  listByOwner: mocks.listByOwner,
  findByField: mocks.findByField,
  insert: mocks.insert,
  save: mocks.save,
  remove: mocks.remove,
}))

const { getBuildContext, chooseBuildPath, listModelConnections, createModelConnection, bindWorkspaceModel, getHackathonProjectEntry } = await import('../services/workspaceCapabilityService.js')

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'test-secret-key-with-enough-length'
  mocks.enabled.mockReturnValue(true)
  mocks.workspaceAccess.mockResolvedValue({ workspace: { id: 'ws1', projectId: 'p1' }, owner: true, member: null })
})

describe('workspace capability row-level store (§5 cutover)', () => {
  it('reads the build context row-level without the snapshot', async () => {
    const context = await getBuildContext('u1', 'ws1')
    expect(context.workspaceId).toBe('ws1')
    expect(mocks.workspaceAccess).toHaveBeenCalledWith('ws1', 'u1')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('chooses a build path row-level (profile + estimate + lifecycle)', async () => {
    const result = await chooseBuildPath('u1', 'ws1', { buildPath: 'mvp' })
    expect(result.ok).toBe(true)
    expect(result.buildProfile.buildPath).toBe('mvp')
    expect(mocks.save).toHaveBeenCalledWith('workspaceBuildProfiles', expect.objectContaining({ workspaceId: 'ws1', buildPath: 'mvp' }))
    expect(mocks.insert).toHaveBeenCalledWith('workspaceCostEstimates', expect.objectContaining({ workspaceId: 'ws1' }))
    expect(mocks.insert).toHaveBeenCalledWith('workspaceLifecycleEvents', expect.objectContaining({ workspaceId: 'ws1' }))
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('lists and creates model connections row-level', async () => {
    await listModelConnections('u1')
    expect(mocks.listByOwner).toHaveBeenCalledWith('userModelConnections', 'u1', ['userId'])
    const created = await createModelConnection('u1', { provider: 'openai', apiKey: 'sk-abcdef0123456789' })
    expect(created.ok).toBe(true)
    expect(created.connection.maskedIdentifier).toBe('sk-a...6789')
    expect(mocks.insert).toHaveBeenCalledWith('userModelConnections', expect.objectContaining({ userId: 'u1' }))
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('binds a workspace model row-level', async () => {
    mocks.findById.mockResolvedValue({ id: 'conn1', userId: 'u1', status: 'active', modelAllowList: ['gpt'] })
    const result = await bindWorkspaceModel('u1', 'ws1', { connectionId: 'conn1' })
    expect(result.ok).toBe(true)
    expect(mocks.insert).toHaveBeenCalledWith('workspaceModelBindings', expect.objectContaining({ connectionId: 'conn1' }))
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('reads a hackathon project entry row-level', async () => {
    mocks.findById.mockResolvedValue({ id: 'team1', hackathonId: 'h1', leaderId: 'u1' })
    mocks.findByField.mockResolvedValue([{ id: 'entry1', hackathonId: 'h1', teamId: 'team1' }])
    const entry = await getHackathonProjectEntry('u1', 'h1', 'team1')
    expect(entry.id).toBe('entry1')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })
})
