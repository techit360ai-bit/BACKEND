import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import crypto from 'node:crypto'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const normalizeRepo = value => String(value || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/^\/+|\/+$/g, '')
const isGithubConnector = row => [row?.id, row?.sourceConnectorId, row?.connectorId, row?.provider, row?.type].some(value => String(value || '').toLowerCase() === 'github')

function project(db, projectId) {
  return rows(db, 'projects').find(row => row.id === projectId) || null
}

function isProjectOwner(row, userId) {
  return [row?.ownerId, row?.userId, row?.founderId].includes(userId)
}

function destinationAccess(db, userId, projectId, repo, write = false) {
  const project = rows(db, 'projects').find(row => row.id === projectId)
  if (!project) return null
  const target = normalizeRepo(repo)
  const workspaces = rows(db, 'workspaces').filter(row => row.projectId === projectId)
  const connectedWorkspaceIds = new Set(rows(db, 'workspaceConnectors')
    .filter(row => isGithubConnector(row) && row.status === 'connected' && (row.resources || []).some(resource => normalizeRepo(resource) === target))
    .map(row => row.workspaceId))
  for (const workspace of workspaces) {
    if (!connectedWorkspaceIds.has(workspace.id)) continue
    if (isProjectOwner(project, userId) || workspace.ownerId === userId) return { project, workspace }
    const member = rows(db, 'workspaceMembers').find(row => row.workspaceId === workspace.id && row.userId === userId && row.status === 'active')
    if (member && (!write || member.accessLevel === 'contributor')) return { project, workspace }
  }
  return null
}

export function authorizeCodeDestination(userId, params = {}, options = {}) {
  const db = readDb(); const projectId = String(params.projectId || ''); const repo = normalizeRepo(params.repo)
  if (!projectId || !repo) return { allowed: false, status: 400, error: 'projectId and configured repository are required' }
  if (!project(db, projectId)) return { allowed: false, status: 404, error: 'project not found' }
  if (!destinationAccess(db, userId, projectId, repo, options.write === true)) return { allowed: false, status: 403, error: options.write === true ? 'repository write access denied for this project workspace' : 'repository is not an authorized destination for this project workspace' }
  return { allowed: true }
}

export function projectCodeCommit(userId, params = {}, data = {}) {
  const projectId = String(params.projectId || ''); const commitSha = String(data.commitSha || '')
  if (!projectId || !commitSha) return { ok: false, error: 'commit_projection_invalid' }
  return updateDb(db => {
    const authorized = destinationAccess(db, userId, projectId, data.repo || params.repo, true); if (!authorized) return { ok: false, error: 'project_destination_access_denied' }
    const workspace = authorized.workspace
    const existing = rows(db, 'contributions').find(row => row.source === 'github' && row.commitSha === commitSha && row.projectId === projectId)
    if (existing) return { ok: true, contribution: existing, idempotent: true }
    const createdAt = nowIso(); const repo = normalizeRepo(data.repo || params.repo); const branch = String(data.branch || params.branch || '')
    const contribution = { id: createId('contribution'), collaboratorId: userId, userId, projectId, workspaceId: workspace?.id || null, kind: 'code_commit', source: 'github', repo, branch, commitSha, commitUrl: String(data.commitUrl || ''), message: String(data.message || params.message || '').slice(0, 500), filesChanged: Number(data.filesChanged || 0), verified: true, status: 'verified', createdAt, updatedAt: createdAt }
    rows(db, 'contributions').push(contribution)
    rows(db, 'projectActivities').push({ id: createId('project_activity'), projectId, workspaceId: workspace?.id || null, actorId: userId, type: 'code_commit_pushed', source: 'github', sourceId: commitSha, metadata: { repo, branch, commitSha, commitUrl: contribution.commitUrl, filesChanged: contribution.filesChanged }, createdAt })
    if (workspace) rows(db, 'workspaceReports').push({ id: createId('workspace_report'), workspaceId: workspace.id, projectId, connectorId: 'github', kind: 'sync', summary: `${userId} pushed ${commitSha.slice(0, 7)} to ${repo}:${branch}`, commitSha, repo, branch, createdAt })
    return { ok: true, contribution }
  })
}

export function reconcileGithubPush(headers = {}, body = {}, rawBody = '') {
  const secret = process.env.GITHUB_WEBHOOK_SECRET || ''
  if (!secret) return { ok: false, status: 503, error: 'github_webhook_not_configured' }
  const raw = rawBody || (typeof body === 'string' ? body : JSON.stringify(body))
  const received = String(headers['x-hub-signature-256'] || headers['X-Hub-Signature-256'] || '')
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`
  if (!received || received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return { ok: false, status: 401, error: 'github_signature_invalid' }
  const payload = typeof body === 'string' ? JSON.parse(body) : body
  const repo = normalizeRepo(payload?.repository?.full_name); const branch = String(payload?.ref || '').replace('refs/heads/', '')
  const commits = Array.isArray(payload?.commits) ? payload.commits.slice(0, 100) : []
  return updateDb(db => {
    const connectors = rows(db, 'workspaceConnectors').filter(row => isGithubConnector(row) && row.status === 'connected' && (row.resources || []).some(resource => normalizeRepo(resource) === repo))
    let recorded = 0
    for (const connector of connectors) {
      const workspace = rows(db, 'workspaces').find(row => row.id === connector.workspaceId); if (!workspace?.projectId) continue
      for (const commit of commits) {
        const commitSha = String(commit.id || ''); if (!commitSha || rows(db, 'contributions').some(row => row.projectId === workspace.projectId && row.commitSha === commitSha)) continue
        const createdAt = commit.timestamp || nowIso(); const actorId = String(commit.author?.username || commit.author?.email || payload.pusher?.name || 'github-external')
        rows(db, 'contributions').push({ id: createId('contribution'), collaboratorId: null, userId: null, externalActor: actorId, projectId: workspace.projectId, workspaceId: workspace.id, kind: 'code_commit', source: 'github_webhook', repo, branch, commitSha, commitUrl: String(commit.url || ''), message: String(commit.message || '').slice(0, 500), filesChanged: [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])].length, verified: true, status: 'verified', createdAt, updatedAt: createdAt })
        rows(db, 'projectActivities').push({ id: createId('project_activity'), projectId: workspace.projectId, workspaceId: workspace.id, actorId, type: 'code_commit_pushed', source: 'github_webhook', sourceId: commitSha, metadata: { repo, branch, commitSha, external: true }, createdAt })
        rows(db, 'workspaceReports').push({ id: createId('workspace_report'), workspaceId: workspace.id, projectId: workspace.projectId, connectorId: 'github', kind: 'sync', summary: `${actorId} pushed ${commitSha.slice(0, 7)} to ${repo}:${branch}`, commitSha, repo, branch, createdAt })
        recorded += 1
      }
    }
    return { ok: true, recorded }
  })
}
