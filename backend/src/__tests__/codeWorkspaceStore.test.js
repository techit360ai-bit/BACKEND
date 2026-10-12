import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(),
  enabled: vi.fn(() => true),
  loadById: vi.fn(async () => null),
  listByWorkspace: vi.fn(async () => []),
  findByWorkspacePath: vi.fn(async () => null),
  insertRow: vi.fn(async () => {}),
  saveRow: vi.fn(async () => {}),
  loadWorkspace: vi.fn(async () => ({ id: 'w1', projectId: 'p1', ownerId: 'u1', name: 'Build' })),
  loadWorkspaceMember: vi.fn(async () => null),
  collaboratorIsPaid: vi.fn(async () => true),
  firstCollaboratorWorkspace: vi.fn(async () => 'w1'),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/workspaceCodeRepository.js', () => ({
  workspaceCodeEnabled: mocks.enabled,
  workspaceCodeFallbackEnabled: () => true,
  loadById: mocks.loadById,
  listByWorkspace: mocks.listByWorkspace,
  findByWorkspacePath: mocks.findByWorkspacePath,
  insertRow: mocks.insertRow,
  saveRow: mocks.saveRow,
  loadWorkspace: mocks.loadWorkspace,
  loadWorkspaceMember: mocks.loadWorkspaceMember,
  collaboratorIsPaid: mocks.collaboratorIsPaid,
  firstCollaboratorWorkspace: mocks.firstCollaboratorWorkspace,
}))

const { listProjectFiles, readProjectFile, saveProjectFile, codeWorkspaceSnapshot, detectProjectAdapter, listCodeDestinations, verifyCodeDeployment } = await import('../services/codeWorkspaceService.js')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabled.mockReturnValue(true)
  mocks.loadById.mockResolvedValue(null)
  mocks.listByWorkspace.mockResolvedValue([])
  mocks.findByWorkspacePath.mockResolvedValue(null)
  mocks.loadWorkspace.mockResolvedValue({ id: 'w1', projectId: 'p1', ownerId: 'u1', name: 'Build' })
  mocks.loadWorkspaceMember.mockResolvedValue(null)
  mocks.collaboratorIsPaid.mockResolvedValue(true)
  mocks.firstCollaboratorWorkspace.mockResolvedValue('w1')
})

describe('code workspace row-level store (§5 cutover)', () => {
  it('lists project files row-level without the snapshot', async () => {
    mocks.listByWorkspace.mockResolvedValue([{ id: 'f1', workspaceId: 'w1', path: 'a.ts', content: 'x', deleted: false }])
    const result = await listProjectFiles('u1', 'w1')
    expect(result.ok).toBe(true)
    expect(result.files.map(row => row.path)).toEqual(['a.ts'])
    expect(mocks.loadWorkspace).toHaveBeenCalledWith('w1')
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('denies a user with no workspace access row-level', async () => {
    mocks.loadWorkspace.mockResolvedValue({ id: 'w1', projectId: 'p1', ownerId: 'someone-else', name: 'Build' })
    mocks.loadWorkspaceMember.mockResolvedValue(null)
    expect((await listProjectFiles('u2', 'w1')).status).toBe(403)
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('inserts a brand-new file with its version and event chain row-level', async () => {
    mocks.findByWorkspacePath.mockResolvedValue(null)
    const result = await saveProjectFile('u1', 'w1', { path: 'src/app.ts', content: 'export const x = 1', expectedVersion: 0 })
    expect(result.ok).toBe(true)
    expect(result.file.version).toBe(1)
    expect(mocks.insertRow).toHaveBeenCalledWith('projectFiles', expect.objectContaining({ workspaceId: 'w1', path: 'src/app.ts', version: 1 }))
    expect(mocks.insertRow).toHaveBeenCalledWith('projectFileVersions', expect.objectContaining({ path: 'src/app.ts', version: 1 }))
    expect(mocks.insertRow).toHaveBeenCalledWith('codeChangeEvents', expect.objectContaining({ type: 'file_created', previousHash: 'GENESIS' }))
    expect(mocks.saveRow).not.toHaveBeenCalled()
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('updates an existing file row-level instead of re-inserting it', async () => {
    mocks.findByWorkspacePath.mockResolvedValue({ id: 'f1', workspaceId: 'w1', projectId: 'p1', path: 'src/app.ts', version: 1, contentHash: 'old', createdAt: '2020-01-01T00:00:00.000Z', deleted: false })
    const result = await saveProjectFile('u1', 'w1', { path: 'src/app.ts', content: 'next', expectedVersion: 1 })
    expect(result.ok).toBe(true)
    expect(result.file.version).toBe(2)
    expect(mocks.saveRow).toHaveBeenCalledWith('projectFiles', expect.objectContaining({ id: 'f1', version: 2 }))
    expect(mocks.insertRow).not.toHaveBeenCalledWith('projectFiles', expect.anything())
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('rejects a stale expected version row-level', async () => {
    mocks.findByWorkspacePath.mockResolvedValue({ id: 'f1', workspaceId: 'w1', projectId: 'p1', path: 'src/app.ts', version: 3, contentHash: 'old', deleted: false })
    expect((await saveProjectFile('u1', 'w1', { path: 'src/app.ts', content: 'next', expectedVersion: 1 })).status).toBe(409)
    expect(mocks.saveRow).not.toHaveBeenCalled()
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('builds a snapshot and detects the adapter row-level', async () => {
    mocks.listByWorkspace.mockImplementation(async (collection) => collection === 'projectFiles'
      ? [{ id: 'f1', workspaceId: 'w1', path: 'package.json', content: JSON.stringify({ scripts: { dev: 'vite' }, dependencies: { react: '^19' } }), version: 1, contentHash: 'h', language: 'json', deleted: false }]
      : [])
    const snapshot = await codeWorkspaceSnapshot('u1', 'w1')
    expect(snapshot.ok).toBe(true)
    expect(snapshot.files).toHaveLength(1)
    const adapter = await detectProjectAdapter('u1', 'w1')
    expect(adapter).toMatchObject({ adapter: 'react', packageManager: 'npm' })
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('reads code destinations row-level and enforces access', async () => {
    mocks.listByWorkspace.mockResolvedValue([{ id: 'c1', workspaceId: 'w1', provider: 'github', status: 'connected', resources: ['team/app'] }])
    const result = await listCodeDestinations('u1', 'w1')
    expect(result.ok).toBe(true)
    expect(result.destinations.map(row => row.provider)).toEqual(['github', 'local'])
    mocks.loadWorkspace.mockResolvedValue({ id: 'w1', projectId: 'p1', ownerId: 'other', name: 'Build' })
    mocks.loadWorkspaceMember.mockResolvedValue(null)
    expect((await listCodeDestinations('u2', 'w1')).status).toBe(403)
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('verifies a deployment row-level', async () => {
    mocks.loadById.mockResolvedValue({ id: 'd1', workspaceId: 'w1', projectId: 'p1', status: 'prepared' })
    const result = await verifyCodeDeployment('u1', 'w1', 'd1', { providerStatus: 'success', checks: [{ name: 'build', conclusion: 'success' }] })
    expect(result.ok).toBe(true)
    expect(result.deployment.status).toBe('verified')
    expect(mocks.insertRow).toHaveBeenCalledWith('codeDeploymentVerifications', expect.objectContaining({ deploymentId: 'd1', status: 'verified' }))
    expect(mocks.saveRow).toHaveBeenCalledWith('codeDeploymentRecords', expect.objectContaining({ id: 'd1', status: 'verified' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })
})
