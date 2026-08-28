import { beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'
const db = { projects: [], workspaces: [], workspaceMembers: [], workspaceConnectors: [], projectFiles: [], projectFileVersions: [], codeChangeEvents: [], codeSyncStates: [], codeRuntimeSessions: [], codeDeploymentRecords: [], codeDeploymentVerifications: [], codeBridgeGrants: [], codeBridgeSessions: [], codeExecutionRuns: [], codeExecutionStepEvents: [], codeReviewDecisions: [] }
vi.mock('../config/database.js', () => ({ readDb: vi.fn(() => db), updateDb: vi.fn(mutator => mutator(db)) }))
const service = await import('../services/codeWorkspaceService.js')
const execution = await import('../services/codeExecutionRunService.js')
const bridge = await import('../services/codeBridgeService.js')
beforeEach(() => { for (const value of Object.values(db)) value.length = 0; db.projects.push({ id: 'p1', ownerId: 'owner' }); db.workspaces.push({ id: 'w1', projectId: 'p1', ownerId: 'owner', name: 'Build' }); db.workspaceMembers.push({ workspaceId: 'w1', userId: 'collab', status: 'active', accessLevel: 'contributor' }) })

describe('authoritative code workspace', () => {
  it('persists versioned files and rejects stale or unsafe writes', () => {
    const first = service.saveProjectFile('owner', 'w1', { path: 'src/app.ts', content: 'export const x = 1', expectedVersion: 0 })
    expect(first.file.version).toBe(1)
    expect(service.saveProjectFile('owner', 'w1', { path: 'src/app.ts', content: 'x', expectedVersion: 0 }).status).toBe(409)
    expect(service.saveProjectFile('owner', 'w1', { path: '../secret', content: 'x' }).error).toBe('unsafe_file_path')
    expect(service.saveProjectFile('owner', 'w1', { path: '.env', content: 'SECRET=x' }).error).toBe('unsafe_file_path')
    expect(service.saveProjectFile('owner', 'w1', { path: '.git', content: 'x' }).error).toBe('unsafe_file_path')
    expect(service.saveProjectFile('owner', 'w1', { path: 'config/service-credentials.json', content: '{}' }).error).toBe('unsafe_file_path')
    expect(db.projectFileVersions).toHaveLength(1)
    expect(db.codeChangeEvents[0].previousHash).toBe('GENESIS')
  })

  it('allows contributors to edit but denies viewers and cross-workspace users', () => {
    expect(service.saveProjectFile('collab', 'w1', { path: 'README.md', content: 'real work' }).ok).toBe(true)
    db.workspaceMembers.push({ workspaceId: 'w1', userId: 'viewer', status: 'active', accessLevel: 'viewer' })
    expect(service.saveProjectFile('viewer', 'w1', { path: 'a.ts', content: 'x' }).status).toBe(403)
    expect(service.listProjectFiles('other', 'w1').status).toBe(403)
  })

  it('detects adapters and preserves runtime, sync, deployment, and bridge evidence', () => {
    service.saveProjectFile('owner', 'w1', { path: 'package.json', content: JSON.stringify({ scripts: { dev: 'vite', test: 'vitest', build: 'vite build' }, dependencies: { react: '^19' } }) })
    const adapter = service.detectProjectAdapter('owner', 'w1')
    expect(adapter).toMatchObject({ adapter: 'react', packageManager: 'npm', supportedInBrowser: true })
    expect(service.recordRuntimeSession('owner', 'w1', { commandType: 'test', command: 'npm test', status: 'completed', exitCode: 0 }).ok).toBe(true)
    expect(service.saveSyncState('owner', 'w1', { repo: 'acme/app', branch: 'main', baseHeadSha: 'abc' }).ok).toBe(true)
    expect(service.createBridgeGrant('owner', 'w1', {}).grant.token).toBeTruthy()
    expect(service.recordDeployment('owner', 'w1', { confirm: false }).error).toBe('deployment_confirmation_required')
    expect(service.recordDeployment('owner', 'w1', { confirm: true, environment: 'preview', destination: 'render' }).ok).toBe(true)
  })

  it('soft deletes and moves files without rewriting history', () => {
    const saved = service.saveProjectFile('owner', 'w1', { path: 'a.ts', content: 'a' }).file
    expect(service.moveProjectFile('owner', 'w1', 'a.ts', { path: 'src/a.ts', expectedVersion: 0 }).status).toBe(409)
    expect(service.moveProjectFile('owner', 'w1', 'a.ts', { path: 'src/a.ts', expectedVersion: saved.version }).file.path).toBe('src/a.ts')
    expect(service.deleteProjectFile('owner', 'w1', 'src/a.ts', saved.version).status).toBe(409)
    expect(service.deleteProjectFile('owner', 'w1', 'src/a.ts', 2).ok).toBe(true)
    expect(service.listProjectFiles('owner', 'w1').files).toHaveLength(0)
    expect(db.codeChangeEvents.map(row => row.type)).toEqual(['file_created', 'file_moved', 'file_deleted'])
  })

  it('requires deterministic test, security, and review evidence before applying an autonomous run', () => {
    const file = service.saveProjectFile('owner', 'w1', { path: 'src/app.ts', content: 'export const ready = false' }).file
    const content = 'export const ready = true'
    const contentHash = crypto.createHash('sha256').update(content).digest('hex')
    const run = execution.createCodeExecutionRun('owner', 'w1', { requirement: 'Finish readiness', mode: 'autonomous', allowedPaths: ['src/app.ts'], allowedCommands: ['npm test'] }).run
    for (const stage of ['execution_intelligence', 'product_architect']) expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage, status: 'completed', agent: stage }).ok).toBe(true)
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'code', status: 'completed', changes: [{ path: 'src/app.ts', contentHash, reason: 'Implement requirement' }] }).ok).toBe(true)
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'test', status: 'completed', runtimeSessionId: 'missing' }).error).toBe('passing_test_evidence_required')
    const runtime = service.recordRuntimeSession('owner', 'w1', { executionRunId: run.id, commandType: 'test', command: 'npm test', status: 'completed', exitCode: 0 }).session
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'test', status: 'completed', runtimeSessionId: runtime.id }).ok).toBe(true)
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'security', status: 'completed', changes: [{ path: 'src/app.ts', content }] }).ok).toBe(true)
    expect(execution.recordCodeReviewDecision('owner', 'w1', run.id, { path: 'src/app.ts', contentHash, decision: 'accepted', hunks: [{ id: 'h1', decision: 'accepted' }] }).ok).toBe(true)
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'review', status: 'completed' }).ok).toBe(true)
    expect(execution.finalizeCodeExecutionRun('owner', 'w1', run.id).run.status).toBe('ready_to_apply')
    expect(execution.applyCodeExecutionRun('owner', 'w1', run.id, { changes: [{ path: 'src/app.ts', content, expectedVersion: file.version }] }).applied[0].version).toBe(2)
    expect(service.readProjectFile('owner', 'w1', 'src/app.ts').file.content).toBe(content)
  })

  it('blocks critical secrets and out-of-scope autonomous changes', () => {
    const run = execution.createCodeExecutionRun('owner', 'w1', { requirement: 'Safe update', allowedPaths: ['src/app.ts'] }).run
    const secret = 'const apiKey = "super-secret-token"'
    const contentHash = crypto.createHash('sha256').update(secret).digest('hex')
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'code', status: 'completed', changes: [{ path: 'other.ts', contentHash }] }).error).toBe('execution_proposal_out_of_scope')
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'security', status: 'completed', changes: [{ path: 'src/app.ts', content: secret }] }).error).toBe('critical_security_findings')
  })

  it('reconstructs only explicitly accepted hunks on the backend', () => {
    const file = service.saveProjectFile('owner', 'w1', { path: 'src/app.ts', content: 'one\ntwo\nkeep\nthree' }).file
    const proposed = 'ONE\ntwo\nkeep\nTHREE'
    const contentHash = crypto.createHash('sha256').update(proposed).digest('hex')
    const baseContentHash = crypto.createHash('sha256').update(file.content).digest('hex')
    const run = execution.createCodeExecutionRun('owner', 'w1', { requirement: 'Review hunks', allowedPaths: ['src/app.ts'] }).run
    for (const stage of ['execution_intelligence', 'product_architect']) execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage, status: 'completed' })
    const hunks = [{ id: 'top', oldStart: 0, oldEnd: 1, replacement: 'ONE' }, { id: 'bottom', oldStart: 3, oldEnd: 4, replacement: 'THREE' }]
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'code', status: 'completed', changes: [{ path: 'src/app.ts', contentHash, baseContentHash, hunks }] }).ok).toBe(true)
    const runtime = service.recordRuntimeSession('owner', 'w1', { status: 'completed', exitCode: 0 }).session
    execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'test', status: 'completed', runtimeSessionId: runtime.id })
    execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'security', status: 'completed', changes: [{ path: 'src/app.ts', content: proposed }] })
    execution.recordCodeReviewDecision('owner', 'w1', run.id, { path: 'src/app.ts', contentHash, decision: 'accepted', hunks: [{ id: 'top', decision: 'accepted' }, { id: 'bottom', decision: 'rejected' }] })
    execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'review', status: 'completed' })
    execution.finalizeCodeExecutionRun('owner', 'w1', run.id)
    const result = execution.applyCodeExecutionRun('owner', 'w1', run.id, { changes: [{ path: 'src/app.ts', content: 'ONE\ntwo\nkeep\nthree', expectedVersion: file.version }] })
    expect(result.ok).toBe(true)
    expect(service.readProjectFile('owner', 'w1', 'src/app.ts').file.content).toBe('ONE\ntwo\nkeep\nthree')
  })

  it('allows a bounded debugger-code-test retry while preserving stage events', () => {
    const file = service.saveProjectFile('owner', 'w1', { path: 'app.js', content: 'bad' }).file
    const run = execution.createCodeExecutionRun('owner', 'w1', { requirement: 'Repair test', allowedPaths: ['app.js'], maxSteps: 12 }).run
    execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'execution_intelligence', status: 'completed' })
    execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'product_architect', status: 'completed' })
    const firstHash = crypto.createHash('sha256').update('still bad').digest('hex')
    execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'code', status: 'completed', changes: [{ path: 'app.js', contentHash: firstHash }] })
    execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'test', status: 'failed' })
    execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'debugger', status: 'completed', summary: 'Found the defect' })
    const repaired = 'good'; const repairedHash = crypto.createHash('sha256').update(repaired).digest('hex')
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'code', status: 'completed', changes: [{ path: 'app.js', contentHash: repairedHash }] }).ok).toBe(true)
    const runtime = service.recordRuntimeSession('owner', 'w1', { status: 'completed', exitCode: 0 }).session
    expect(execution.recordCodeExecutionStage('owner', 'w1', run.id, { stage: 'test', status: 'completed', runtimeSessionId: runtime.id }).ok).toBe(true)
    expect(file.version).toBe(1)
    expect(db.codeExecutionStepEvents.filter(row => row.runId === run.id && row.stage === 'code')).toHaveLength(2)
  })

  it('exchanges a one-time VS Code grant and synchronizes only version-matched project files', () => {
    const existing = service.saveProjectFile('owner', 'w1', { path: 'README.md', content: 'before' }).file
    const grant = service.createBridgeGrant('owner', 'w1', {}).grant
    const exchanged = bridge.exchangeCodeBridgeGrant({ grant: grant.token, deviceName: 'Developer laptop', rootFingerprint: 'root-1' })
    expect(exchanged.ok).toBe(true)
    expect(bridge.exchangeCodeBridgeGrant({ grant: grant.token }).error).toBe('bridge_grant_invalid')
    const token = exchanged.session.token
    expect(bridge.codeBridgeSnapshot(token, 'w1').files[0].content).toBe('before')
    expect(bridge.syncCodeBridgeFiles(token, 'w1', { changes: [{ path: 'README.md', content: 'after', expectedVersion: 0 }] }).error).toBe('file_version_conflict')
    expect(bridge.syncCodeBridgeFiles(token, 'w1', { changes: [{ path: 'README.md', content: 'after', expectedVersion: existing.version }] }).ok).toBe(true)
    expect(service.readProjectFile('owner', 'w1', 'README.md').file.content).toBe('after')
    expect(bridge.revokeCodeBridgeSessions('owner', 'w1').revoked).toBe(1)
    expect(bridge.codeBridgeSnapshot(token, 'w1').status).toBe(401)
  })

  it('exposes configured destinations and verifies production deployments from passing evidence', () => {
    db.workspaceConnectors.push({ id: 'gitlab-1', provider: 'gitlab', workspaceId: 'w1', status: 'connected', resources: ['team/app'] })
    expect(service.listCodeDestinations('owner', 'w1').destinations.map(row => row.provider)).toEqual(['gitlab', 'local'])
    expect(service.recordDeployment('owner', 'w1', { confirm: true, environment: 'production', destination: 'gitlab:team/app', commitSha: 'abc', buildStatus: 'passed', testStatus: 'passed', securityStatus: 'pending' }).error).toBe('production_evidence_incomplete')
    const deployment = service.recordDeployment('owner', 'w1', { confirm: true, environment: 'production', destination: 'gitlab:team/app', commitSha: 'abc', buildStatus: 'passed', testStatus: 'passed', securityStatus: 'passed' }).deployment
    expect(service.verifyCodeDeployment('owner', 'w1', deployment.id, { providerStatus: 'success', checks: [{ name: 'build', conclusion: 'success' }], url: 'https://deploy.example' }).deployment.status).toBe('verified')
  })
})
