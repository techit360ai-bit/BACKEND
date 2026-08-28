import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = { projects: [], workspaces: [], workspaceMembers: [], projectFiles: [], projectFileVersions: [], codeChangeEvents: [], codeSyncStates: [], codeRuntimeSessions: [], codeDeploymentRecords: [], codeBridgeGrants: [] }
vi.mock('../config/database.js', () => ({ readDb: vi.fn(() => db), updateDb: vi.fn(mutator => mutator(db)) }))
const service = await import('../services/codeWorkspaceService.js')
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
})
