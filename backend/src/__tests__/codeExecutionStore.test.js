import { beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'

const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex')

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(),
  enabled: vi.fn(() => true),
  loadById: vi.fn(async () => null),
  listByWorkspace: vi.fn(async () => []),
  listByField: vi.fn(async () => []),
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
  listByField: mocks.listByField,
  findByWorkspacePath: mocks.findByWorkspacePath,
  insertRow: mocks.insertRow,
  saveRow: mocks.saveRow,
  loadWorkspace: mocks.loadWorkspace,
  loadWorkspaceMember: mocks.loadWorkspaceMember,
  collaboratorIsPaid: mocks.collaboratorIsPaid,
  firstCollaboratorWorkspace: mocks.firstCollaboratorWorkspace,
}))

const {
  createCodeExecutionRunAsync,
  getCodeExecutionRunAsync,
  recordCodeExecutionStageAsync,
  recordCodeReviewDecisionAsync,
  finalizeCodeExecutionRunAsync,
  applyCodeExecutionRunAsync,
} = await import('../services/codeExecutionRunService.js')
const { exchangeCodeBridgeGrantAsync, codeBridgeSnapshotAsync, syncCodeBridgeFilesAsync, revokeCodeBridgeSessionsAsync } = await import('../services/codeBridgeService.js')
const { reconcileGithubPushAsync } = await import('../services/codeExecutionProjectionService.js')

const workspace = { id: 'w1', projectId: 'p1', ownerId: 'u1', name: 'Build' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabled.mockReturnValue(true)
  mocks.loadById.mockResolvedValue(null)
  mocks.listByWorkspace.mockResolvedValue([])
  mocks.listByField.mockResolvedValue([])
  mocks.loadWorkspace.mockResolvedValue(workspace)
  mocks.loadWorkspaceMember.mockResolvedValue(null)
  mocks.collaboratorIsPaid.mockResolvedValue(true)
  mocks.firstCollaboratorWorkspace.mockResolvedValue('w1')
})

describe('code workspace row-level store — execution / bridge / projection (§5)', () => {
  it('creates an execution run row-level without the snapshot', async () => {
    mocks.listByWorkspace.mockImplementation(async collection => collection === 'projectFiles'
      ? [{ id: 'f1', workspaceId: 'w1', path: 'a.ts', version: 1, contentHash: 'h', deleted: false }] : [])
    const result = await createCodeExecutionRunAsync('u1', 'w1', { requirement: 'add tests' })
    expect(result.ok).toBe(true)
    expect(result.run.status).toBe('planned')
    expect(result.run.baseline).toEqual([{ path: 'a.ts', version: 1, contentHash: 'h' }])
    expect(mocks.insertRow).toHaveBeenCalledWith('codeExecutionRuns', expect.objectContaining({ workspaceId: 'w1', projectId: 'p1' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('reads a run with its scoped steps and reviews', async () => {
    mocks.loadById.mockResolvedValue({ id: 'r1', workspaceId: 'w1', projectId: 'p1', proposedChanges: [], budget: { maxSteps: 12 } })
    mocks.listByWorkspace.mockImplementation(async collection => collection === 'codeExecutionStepEvents'
      ? [{ id: 's1', runId: 'r1', stage: 'code', status: 'completed' }]
      : collection === 'codeReviewDecisions' ? [{ id: 'v1', runId: 'r1', path: 'a.ts', decision: 'accepted' }] : [])
    const result = await getCodeExecutionRunAsync('u1', 'w1', 'r1')
    expect(result.ok).toBe(true)
    expect(result.run.steps.find(row => row.stage === 'code').status).toBe('completed')
    expect(result.run.reviews).toHaveLength(1)
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('records a code stage proposal row-level', async () => {
    const baseline = 'line1'
    mocks.loadById.mockResolvedValue({ id: 'r1', workspaceId: 'w1', projectId: 'p1', allowedPaths: ['a.ts'], proposedChanges: [], budget: { maxSteps: 12, maxFiles: 40 } })
    mocks.listByWorkspace.mockImplementation(async collection => collection === 'projectFiles'
      ? [{ id: 'f1', workspaceId: 'w1', path: 'a.ts', content: baseline, version: 1, contentHash: sha(baseline), deleted: false }] : [])
    const result = await recordCodeExecutionStageAsync('u1', 'w1', 'r1', {
      stage: 'code', status: 'completed',
      changes: [{ path: 'a.ts', contentHash: sha('line1x'), hunks: [{ id: 'h1', oldStart: 0, oldEnd: 1, replacement: 'line1x' }] }],
    })
    expect(result.ok).toBe(true)
    expect(result.run.proposedChanges).toHaveLength(1)
    expect(mocks.insertRow).toHaveBeenCalledWith('codeExecutionStepEvents', expect.objectContaining({ runId: 'r1', stage: 'code', status: 'completed' }))
    expect(mocks.saveRow).toHaveBeenCalledWith('codeExecutionRuns', expect.objectContaining({ id: 'r1', status: 'running' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('records a review decision against a proposed change row-level', async () => {
    mocks.loadById.mockResolvedValue({ id: 'r1', workspaceId: 'w1', projectId: 'p1', proposedChanges: [{ path: 'a.ts', contentHash: 'c'.repeat(64) }] })
    const result = await recordCodeReviewDecisionAsync('u1', 'w1', 'r1', { path: 'a.ts', contentHash: 'c'.repeat(64), decision: 'accepted' })
    expect(result.ok).toBe(true)
    expect(mocks.insertRow).toHaveBeenCalledWith('codeReviewDecisions', expect.objectContaining({ runId: 'r1', path: 'a.ts', decision: 'accepted' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('finalizes a run once the required stages are complete row-level', async () => {
    mocks.loadById.mockResolvedValue({ id: 'r1', workspaceId: 'w1', projectId: 'p1', proposedChanges: [{}] })
    mocks.listByWorkspace.mockImplementation(async collection => collection === 'codeExecutionStepEvents'
      ? ['execution_intelligence', 'product_architect', 'code', 'test', 'security', 'review'].map((stage, index) => ({ id: `s${index}`, runId: 'r1', stage, status: 'completed' })) : [])
    const result = await finalizeCodeExecutionRunAsync('u1', 'w1', 'r1')
    expect(result.ok).toBe(true)
    expect(result.run.status).toBe('ready_to_apply')
    expect(mocks.saveRow).toHaveBeenCalledWith('codeExecutionRuns', expect.objectContaining({ id: 'r1', status: 'ready_to_apply' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('applies an approved run by writing files and versions row-level', async () => {
    mocks.loadById.mockResolvedValue({ id: 'r1', workspaceId: 'w1', projectId: 'p1', status: 'ready_to_apply', proposedChanges: [{ path: 'a.ts', contentHash: sha('line1x'), hunks: [{ id: 'h1', oldStart: 0, oldEnd: 1, replacement: 'line1x' }] }] })
    mocks.listByWorkspace.mockImplementation(async collection => {
      if (collection === 'projectFiles') return [{ id: 'f1', workspaceId: 'w1', path: 'a.ts', content: 'line1', version: 1, contentHash: sha('line1'), deleted: false }]
      if (collection === 'codeReviewDecisions') return [{ id: 'v1', runId: 'r1', path: 'a.ts', contentHash: sha('line1x'), decision: 'accepted', hunks: [{ id: 'h1', decision: 'accepted' }] }]
      return []
    })
    const result = await applyCodeExecutionRunAsync('u1', 'w1', 'r1', { changes: [{ path: 'a.ts', content: 'line1x', expectedVersion: 1 }] })
    expect(result.ok).toBe(true)
    expect(result.applied).toEqual([{ path: 'a.ts', version: 2, contentHash: sha('line1x') }])
    expect(mocks.saveRow).toHaveBeenCalledWith('projectFiles', expect.objectContaining({ id: 'f1', version: 2, content: 'line1x' }))
    expect(mocks.insertRow).toHaveBeenCalledWith('projectFileVersions', expect.objectContaining({ path: 'a.ts', version: 2 }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('exchanges a bridge grant into a session row-level', async () => {
    mocks.listByField.mockImplementation(async collection => collection === 'codeBridgeGrants'
      ? [{ id: 'g1', tokenHash: sha('the-grant'), workspaceId: 'w1', projectId: 'p1', userId: 'u1', permissions: ['files.read'], status: 'active', expiresAt: new Date(Date.now() + 60_000).toISOString() }] : [])
    const result = await exchangeCodeBridgeGrantAsync({ grant: 'the-grant', deviceName: 'VS Code' })
    expect(result.ok).toBe(true)
    expect(typeof result.session.token).toBe('string')
    expect(mocks.saveRow).toHaveBeenCalledWith('codeBridgeGrants', expect.objectContaining({ id: 'g1', status: 'consumed' }))
    expect(mocks.insertRow).toHaveBeenCalledWith('codeBridgeSessions', expect.objectContaining({ grantId: 'g1', status: 'active' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('snapshots bridge files and syncs changes row-level', async () => {
    const session = { id: 'bs1', workspaceId: 'w1', projectId: 'p1', userId: 'u1', tokenHash: sha('tok'), permissions: ['files.read', 'files.write'], status: 'active', expiresAt: new Date(Date.now() + 60_000).toISOString() }
    mocks.listByWorkspace.mockImplementation(async collection => collection === 'codeBridgeSessions'
      ? [session]
      : collection === 'projectFiles' ? [{ id: 'f1', workspaceId: 'w1', path: 'a.ts', content: 'x', version: 1, contentHash: sha('x'), deleted: false }] : [])
    const snapshot = await codeBridgeSnapshotAsync('tok', 'w1')
    expect(snapshot.ok).toBe(true)
    expect(snapshot.files.map(row => row.path)).toEqual(['a.ts'])
    const sync = await syncCodeBridgeFilesAsync('tok', 'w1', { changes: [{ path: 'a.ts', content: 'y', expectedVersion: 1 }] })
    expect(sync.ok).toBe(true)
    expect(sync.applied).toEqual([{ path: 'a.ts', version: 2, contentHash: sha('y') }])
    expect(mocks.insertRow).toHaveBeenCalledWith('projectFileVersions', expect.objectContaining({ bridgeSessionId: 'bs1', version: 2 }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('revokes a user’s bridge sessions row-level', async () => {
    mocks.listByWorkspace.mockImplementation(async collection => collection === 'codeBridgeSessions'
      ? [{ id: 'bs1', workspaceId: 'w1', userId: 'u1', status: 'active' }, { id: 'bs2', workspaceId: 'w1', userId: 'u2', status: 'active' }] : [])
    const result = await revokeCodeBridgeSessionsAsync('u1', 'w1')
    expect(result).toEqual({ ok: true, revoked: 1 })
    expect(mocks.saveRow).toHaveBeenCalledWith('codeBridgeSessions', expect.objectContaining({ id: 'bs1', status: 'revoked' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('reconciles a signed GitHub push row-level', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'webhook-secret'
    mocks.listByField.mockImplementation(async collection => collection === 'workspaceConnectors'
      ? [{ id: 'c1', provider: 'github', status: 'connected', workspaceId: 'w1', resources: ['acme/editor'] }] : [])
    mocks.loadById.mockResolvedValue({ id: 'w1', projectId: 'p1' })
    const payload = { ref: 'refs/heads/main', repository: { full_name: 'acme/editor' }, pusher: { name: 'octocat' }, commits: [{ id: 'ext1', message: 'fix', url: 'u', timestamp: '2026-08-28T12:00:00.000Z', author: { username: 'octocat' }, added: ['a.ts'], modified: [], removed: [] }] }
    const raw = JSON.stringify(payload)
    const signature = `sha256=${crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET).update(raw).digest('hex')}`
    try {
      const result = await reconcileGithubPushAsync({ 'x-hub-signature-256': signature }, payload, raw)
      expect(result).toEqual({ ok: true, recorded: 1 })
      expect(mocks.insertRow).toHaveBeenCalledWith('contributions', expect.objectContaining({ commitSha: 'ext1', source: 'github_webhook' }))
      expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    } finally { delete process.env.GITHUB_WEBHOOK_SECRET }
  })
})
