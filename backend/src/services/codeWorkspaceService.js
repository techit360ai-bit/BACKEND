import crypto from 'node:crypto'
import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex')
const MAX_TEXT_BYTES = 1_000_000
const BLOCKED_PATHS = /(^|\/)(\.env($|\.)|\.git(?:\/|$)|node_modules(?:\/|$)|\.ssh(?:\/|$)|secrets?(?:\/|$)|credentials?(?:\/|$)|[^/]*(?:credential|secret|private[-_]?key)[^/]*\.(?:json|pem|key|txt)$)/i

function safePath(value) {
  const path = String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '')
  if (!path || path.startsWith('/') || path.includes('\0') || path.split('/').includes('..') || BLOCKED_PATHS.test(path)) return null
  return path.slice(0, 500)
}

function access(db, userId, workspaceId, write = false) {
  const workspace = rows(db, 'workspaces').find(row => row.id === workspaceId)
  if (!workspace) return null
  if (workspace.ownerId === userId) return { workspace, level: 'owner' }
  const member = rows(db, 'workspaceMembers').find(row => row.workspaceId === workspaceId && row.userId === userId && row.status === 'active')
  if (!member || (write && member.accessLevel !== 'contributor')) return null
  return { workspace, level: member.accessLevel || 'viewer' }
}

function publicFile(file) {
  return { id: file.id, workspaceId: file.workspaceId, projectId: file.projectId, path: file.path, language: file.language, sizeBytes: file.sizeBytes, version: file.version, contentHash: file.contentHash, deleted: Boolean(file.deleted), updatedAt: file.updatedAt, updatedBy: file.updatedBy }
}

function language(path) {
  const extension = path.split('.').pop()?.toLowerCase()
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python', yml: 'yaml', yaml: 'yaml', sh: 'shell' })[extension] || 'plaintext'
}

function event(db, input) {
  const previous = rows(db, 'codeChangeEvents').filter(row => row.workspaceId === input.workspaceId).at(-1)?.eventHash || 'GENESIS'
  const createdAt = nowIso(); const body = { ...input, createdAt }; const eventHash = sha(`${previous}|${JSON.stringify(body)}`)
  const row = { id: createId('code_event'), ...body, previousHash: previous, eventHash }
  rows(db, 'codeChangeEvents').push(row); return row
}

export function listProjectFiles(userId, workspaceId, includeDeleted = false) {
  const db = readDb(); const auth = access(db, userId, workspaceId); if (!auth) return { ok: false, status: 403, error: 'workspace_access_denied' }
  const files = rows(db, 'projectFiles').filter(row => row.workspaceId === workspaceId && (includeDeleted || !row.deleted)).sort((a, b) => a.path.localeCompare(b.path)).map(publicFile)
  return { ok: true, workspace: { id: auth.workspace.id, projectId: auth.workspace.projectId, name: auth.workspace.name, accessLevel: auth.level }, files }
}

export function readProjectFile(userId, workspaceId, pathValue) {
  const db = readDb(); const auth = access(db, userId, workspaceId); const path = safePath(pathValue)
  if (!auth) return { ok: false, status: 403, error: 'workspace_access_denied' }
  if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
  const file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === path && !row.deleted)
  return file ? { ok: true, file: { ...publicFile(file), content: file.content } } : { ok: false, status: 404, error: 'file_not_found' }
}

export function saveProjectFile(userId, workspaceId, body = {}) {
  const path = safePath(body.path); const content = typeof body.content === 'string' ? body.content : null
  if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
  if (content === null || Buffer.byteLength(content, 'utf8') > MAX_TEXT_BYTES) return { ok: false, status: 413, error: 'file_content_invalid' }
  return updateDb(db => {
    const auth = access(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    let file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === path)
    if (file && body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(file.version)) return { ok: false, status: 409, error: 'file_version_conflict', current: publicFile(file) }
    const before = file ? { contentHash: file.contentHash, version: file.version, deleted: file.deleted } : null
    const createdAt = nowIso(); const nextVersion = Number(file?.version || 0) + 1
    if (!file) { file = { id: createId('project_file'), workspaceId, projectId: auth.workspace.projectId, path, createdAt, createdBy: userId }; rows(db, 'projectFiles').push(file) }
    Object.assign(file, { content, language: language(path), sizeBytes: Buffer.byteLength(content, 'utf8'), contentHash: sha(content), version: nextVersion, deleted: false, updatedAt: createdAt, updatedBy: userId })
    rows(db, 'projectFileVersions').push({ id: createId('file_version'), fileId: file.id, workspaceId, projectId: file.projectId, path, version: nextVersion, content, contentHash: file.contentHash, actorId: userId, source: String(body.source || 'manual').slice(0, 40), createdAt })
    event(db, { workspaceId, projectId: file.projectId, actorId: userId, type: before ? 'file_updated' : 'file_created', fileId: file.id, path, before, after: { contentHash: file.contentHash, version: nextVersion } })
    return { ok: true, file: { ...publicFile(file), content } }
  })
}

export function moveProjectFile(userId, workspaceId, pathValue, body = {}) {
  const path = safePath(pathValue); const nextPath = safePath(body.path)
  if (!path || !nextPath) return { ok: false, status: 400, error: 'unsafe_file_path' }
  return updateDb(db => {
    const auth = access(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === path && !row.deleted)
    if (!file) return { ok: false, status: 404, error: 'file_not_found' }
    if (body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(file.version)) return { ok: false, status: 409, error: 'file_version_conflict', current: publicFile(file) }
    if (rows(db, 'projectFiles').some(row => row.workspaceId === workspaceId && row.path === nextPath && !row.deleted)) return { ok: false, status: 409, error: 'destination_exists' }
    const before = file.path; file.path = nextPath; file.language = language(nextPath); file.version += 1; file.updatedAt = nowIso(); file.updatedBy = userId
    event(db, { workspaceId, projectId: auth.workspace.projectId, actorId: userId, type: 'file_moved', fileId: file.id, path: nextPath, before: { path: before }, after: { path: nextPath, version: file.version } })
    return { ok: true, file: publicFile(file) }
  })
}

export function deleteProjectFile(userId, workspaceId, pathValue, expectedVersion) {
  const path = safePath(pathValue); if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
  return updateDb(db => {
    const auth = access(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === path && !row.deleted)
    if (!file) return { ok: false, status: 404, error: 'file_not_found' }
    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(file.version)) return { ok: false, status: 409, error: 'file_version_conflict', current: publicFile(file) }
    file.deleted = true; file.version += 1; file.updatedAt = nowIso(); file.updatedBy = userId
    event(db, { workspaceId, projectId: auth.workspace.projectId, actorId: userId, type: 'file_deleted', fileId: file.id, path, before: { contentHash: file.contentHash }, after: { deleted: true, version: file.version } })
    return { ok: true, file: publicFile(file) }
  })
}

export function projectFileHistory(userId, workspaceId, pathValue) {
  const db = readDb(); if (!access(db, userId, workspaceId)) return { ok: false, status: 403, error: 'workspace_access_denied' }
  const path = safePath(pathValue); if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
  return { ok: true, versions: rows(db, 'projectFileVersions').filter(row => row.workspaceId === workspaceId && row.path === path).map(({ content, ...row }) => ({ ...row, sizeBytes: Buffer.byteLength(content, 'utf8') })).reverse() }
}

export function codeWorkspaceSnapshot(userId, workspaceId) {
  const db = readDb(); const auth = access(db, userId, workspaceId); if (!auth) return { ok: false, status: 403, error: 'workspace_access_denied' }
  const files = rows(db, 'projectFiles').filter(row => row.workspaceId === workspaceId && !row.deleted).map(row => ({ path: row.path, content: row.content, version: row.version, contentHash: row.contentHash, language: row.language }))
  const sync = rows(db, 'codeSyncStates').find(row => row.workspaceId === workspaceId && row.status === 'active') || null
  return { ok: true, workspace: auth.workspace, files, sync, snapshotHash: sha(files.map(row => `${row.path}:${row.contentHash}`).sort().join('|')) }
}

export function detectProjectAdapter(userId, workspaceId) {
  const snapshot = codeWorkspaceSnapshot(userId, workspaceId); if (!snapshot.ok) return snapshot
  const byPath = new Map(snapshot.files.map(file => [file.path, file.content])); let adapter = 'static'; let packageManager = null; let scripts = {}
  if (byPath.has('package.json')) { try { const pkg = JSON.parse(byPath.get('package.json')); scripts = pkg.scripts || {}; packageManager = byPath.has('pnpm-lock.yaml') ? 'pnpm' : byPath.has('yarn.lock') ? 'yarn' : 'npm'; const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }; adapter = deps.next ? 'nextjs' : deps.react ? 'react' : 'node' } catch {} }
  else if (byPath.has('pyproject.toml') || byPath.has('requirements.txt')) adapter = 'python'
  return { ok: true, adapter, packageManager, commands: { install: packageManager ? `${packageManager} install` : null, dev: scripts.dev ? `${packageManager} run dev` : adapter === 'python' ? 'python -m app' : null, test: scripts.test ? `${packageManager} test` : adapter === 'python' ? 'python -m pytest' : null, build: scripts.build ? `${packageManager} run build` : null }, supportedInBrowser: ['react', 'nextjs', 'node', 'static'].includes(adapter), deterministic: true }
}

export function recordRuntimeSession(userId, workspaceId, body = {}) {
  return updateDb(db => { const auth = access(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }; const status = ['started', 'completed', 'failed', 'cancelled', 'crashed'].includes(body.status) ? body.status : 'started'; const row = { id: createId('runtime'), workspaceId, projectId: auth.workspace.projectId, actorId: userId, adapter: String(body.adapter || ''), commandType: String(body.commandType || 'dev'), command: String(body.command || '').slice(0, 300), status, exitCode: body.exitCode == null ? null : Number(body.exitCode), durationMs: body.durationMs == null ? null : Number(body.durationMs), outputSummary: String(body.outputSummary || '').slice(0, 3000), createdAt: nowIso() }; rows(db, 'codeRuntimeSessions').push(row); event(db, { workspaceId, projectId: row.projectId, actorId: userId, type: `runtime_${status}`, runtimeId: row.id, metadata: { commandType: row.commandType, exitCode: row.exitCode } }); return { ok: true, session: row } })
}

export function saveSyncState(userId, workspaceId, body = {}) {
  return updateDb(db => { const auth = access(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }; rows(db, 'codeSyncStates').forEach(row => { if (row.workspaceId === workspaceId) row.status = 'superseded' }); const row = { id: createId('sync_state'), workspaceId, projectId: auth.workspace.projectId, provider: String(body.provider || 'github'), repo: String(body.repo || '').slice(0, 300), branch: String(body.branch || 'main').slice(0, 200), baseHeadSha: String(body.baseHeadSha || '').slice(0, 100), snapshotHash: String(body.snapshotHash || '').slice(0, 100), status: 'active', updatedBy: userId, createdAt: nowIso() }; rows(db, 'codeSyncStates').push(row); return { ok: true, sync: row } })
}

export function createBridgeGrant(userId, workspaceId, body = {}) {
  return updateDb(db => { const auth = access(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }; const rawToken = crypto.randomBytes(32).toString('base64url'); const row = { id: createId('bridge_grant'), workspaceId, projectId: auth.workspace.projectId, userId, tokenHash: sha(rawToken), permissions: ['files.read', 'files.write', ...(body.allowCommands === true ? ['commands.bounded'] : [])], selectedRoot: String(body.selectedRoot || '').slice(0, 500) || null, status: 'active', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), createdAt: nowIso() }; rows(db, 'codeBridgeGrants').push(row); return { ok: true, grant: { ...row, token: rawToken, tokenHash: undefined } } })
}

export function recordDeployment(userId, workspaceId, body = {}) {
  return updateDb(db => { const auth = access(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }; if (body.confirm !== true) return { ok: false, status: 400, error: 'deployment_confirmation_required' }; const row = { id: createId('code_deployment'), workspaceId, projectId: auth.workspace.projectId, actorId: userId, environment: ['preview', 'staging', 'production'].includes(body.environment) ? body.environment : 'preview', destination: String(body.destination || '').slice(0, 200), commitSha: String(body.commitSha || '').slice(0, 100), buildStatus: String(body.buildStatus || 'unknown'), testStatus: String(body.testStatus || 'unknown'), securityStatus: String(body.securityStatus || 'unknown'), status: 'prepared', createdAt: nowIso() }; rows(db, 'codeDeploymentRecords').push(row); event(db, { workspaceId, projectId: row.projectId, actorId: userId, type: 'deployment_prepared', deploymentId: row.id, metadata: row }); return { ok: true, deployment: row } })
}
