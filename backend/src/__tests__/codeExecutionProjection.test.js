import { beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'

const db = { projects: [], workspaces: [], workspaceMembers: [], workspaceConnectors: [], workspaceTasks: [], workspaceReports: [], contributions: [], projectActivities: [], startupActivities: [] }
vi.mock('../config/database.js', () => ({ readDb: vi.fn(() => db), updateDb: vi.fn(mutator => mutator(db)) }))
const { authorizeCodeDestination, projectCodeCommit, reconcileGithubPush } = await import('../services/codeExecutionProjectionService.js')
const { investorIntelligenceOverview } = await import('../services/investorIntelligenceService.js')

beforeEach(() => { for (const value of Object.values(db)) value.length = 0 })

describe('code execution projection', () => {
  function seed() {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1', title: 'Editor project' })
    db.workspaces.push({ id: 'workspace-1', projectId: 'project-1', ownerId: 'founder-1' })
    db.workspaceConnectors.push({ id: 'connector-1', provider: 'github', workspaceId: 'workspace-1', status: 'connected', resources: ['https://github.com/acme/editor.git'] })
  }

  it('permits only linked destinations for authorized project users', () => {
    seed()
    expect(authorizeCodeDestination('founder-1', { projectId: 'project-1', repo: 'acme/editor' })).toEqual({ allowed: true })
    expect(authorizeCodeDestination('other-user', { projectId: 'project-1', repo: 'acme/editor' }).allowed).toBe(false)
    expect(authorizeCodeDestination('founder-1', { projectId: 'project-1', repo: 'acme/other' }).error).toContain('authorized destination')
    db.workspaceMembers.push({ workspaceId: 'workspace-1', userId: 'viewer-1', status: 'active', accessLevel: 'viewer' })
    db.workspaceMembers.push({ workspaceId: 'workspace-1', userId: 'contributor-1', status: 'active', accessLevel: 'contributor' })
    expect(authorizeCodeDestination('viewer-1', { projectId: 'project-1', repo: 'acme/editor' })).toEqual({ allowed: true })
    expect(authorizeCodeDestination('viewer-1', { projectId: 'project-1', repo: 'acme/editor' }, { write: true }).allowed).toBe(false)
    expect(authorizeCodeDestination('contributor-1', { projectId: 'project-1', repo: 'acme/editor' }, { write: true })).toEqual({ allowed: true })
  })

  it('projects each successful commit once into team and investor execution evidence', () => {
    seed()
    const data = { repo: 'acme/editor', branch: 'main', commitSha: 'abc123456', commitUrl: 'https://github.com/acme/editor/commit/abc123456', message: 'feat: onboarding', filesChanged: 3 }
    expect(projectCodeCommit('founder-1', { projectId: 'project-1' }, data).ok).toBe(true)
    expect(projectCodeCommit('founder-1', { projectId: 'project-1' }, data).idempotent).toBe(true)
    expect(db.contributions).toHaveLength(1)
    expect(db.contributions[0]).toMatchObject({ kind: 'code_commit', verified: true, commitSha: 'abc123456' })
    expect(db.projectActivities).toHaveLength(1)
    expect(db.workspaceReports).toHaveLength(1)
    db.investorWatchlists = [{ investorId: 'investor-1', projectId: 'project-1' }]
    const startup = investorIntelligenceOverview('investor-1').startups[0]
    expect(startup.executionEvidence).toEqual({ verifiedCodeCommits: 1, latestCommitAt: db.projectActivities[0].createdAt })
    expect(startup.evidence).toContain('1 verified code commit(s) recorded')
  })

  it('verifies GitHub webhook bytes and reconciles external commits idempotently', () => {
    seed()
    const previousSecret = process.env.GITHUB_WEBHOOK_SECRET
    process.env.GITHUB_WEBHOOK_SECRET = 'webhook-test-secret'
    try {
      const payload = {
        ref: 'refs/heads/main',
        repository: { full_name: 'acme/editor' },
        pusher: { name: 'external-author' },
        commits: [{
          id: 'external123',
          message: 'fix: external change',
          url: 'https://github.com/acme/editor/commit/external123',
          timestamp: '2026-08-28T12:00:00.000Z',
          author: { username: 'octocat' },
          added: ['src/new.ts'],
          modified: ['src/app.ts'],
          removed: [],
        }],
      }
      const raw = JSON.stringify(payload)
      const signature = `sha256=${crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET).update(raw).digest('hex')}`

      expect(reconcileGithubPush({ 'x-hub-signature-256': 'sha256=invalid' }, payload, raw)).toMatchObject({ ok: false, status: 401 })
      expect(reconcileGithubPush({ 'x-hub-signature-256': signature }, payload, raw)).toEqual({ ok: true, recorded: 1 })
      expect(reconcileGithubPush({ 'x-hub-signature-256': signature }, payload, raw)).toEqual({ ok: true, recorded: 0 })
      expect(db.contributions[0]).toMatchObject({ source: 'github_webhook', commitSha: 'external123', filesChanged: 2, verified: true })
      expect(db.projectActivities).toHaveLength(1)
      expect(db.workspaceReports).toHaveLength(1)
    } finally {
      if (previousSecret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET
      else process.env.GITHUB_WEBHOOK_SECRET = previousSecret
    }
  })
})
