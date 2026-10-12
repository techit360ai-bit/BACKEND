import crypto from 'node:crypto'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import {
  workspaceCodeEnabled,
  loadById,
  listByWorkspace,
  findByWorkspacePath,
  insertRow,
  saveRow,
  loadWorkspace,
  loadWorkspaceMember,
  collaboratorIsPaid,
  firstCollaboratorWorkspace,
} from '../repositories/workspaceCodeRepository.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex')
const MAX_TEXT_BYTES = 1_000_000
const BLOCKED_PATHS = /(^|\/)(\.env($|\.)|\.git(?:\/|$)|node_modules(?:\/|$)|\.ssh(?:\/|$)|secrets?(?:\/|$)|credentials?(?:\/|$)|[^/]*(?:credential|secret|private[-_]?key)[^/]*\.(?:json|pem|key|txt)$)/i

export function safeCodePath(value) {
  const path = String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//, '')
  if (!path || path.startsWith('/') || path.includes('\0') || path.split('/').includes('..') || BLOCKED_PATHS.test(path)) return null
  return path.slice(0, 500)
}

export function codeWorkspaceAccess(db, userId, workspaceId, write = false) {
  const workspace = rows(db, 'workspaces').find(row => row.id === workspaceId)
  if (!workspace) return null
  if (workspace.ownerId === userId) return { workspace, level: 'owner' }
  const member = rows(db, 'workspaceMembers').find(row => row.workspaceId === workspaceId && row.userId === userId && row.status === 'active')
  if (member && String(member.role || '').toLowerCase() === 'collaborator') {
    const paid = rows(db, 'accountEntitlements').some(row => row.userId === userId && ['active', 'trialing', 'grace_period'].includes(row.status))
      || rows(db, 'subscriptions').some(row => row.userId === userId && ['active', 'trialing', 'grace_period'].includes(row.status))
      || rows(db, 'creditLedger').some(row => row.userId === userId && ['credit_purchase', 'credits_purchased', 'subscription_purchase'].includes(row.type) && Number(row.deltaCredits ?? row.credits ?? 0) > 0)
    const collaboratorMemberships = rows(db, 'workspaceMembers').filter(row => row.userId === userId && row.status === 'active' && String(row.role || '').toLowerCase() === 'collaborator').sort((a, b) => new Date(a.joinedAt || a.createdAt || 0) - new Date(b.joinedAt || b.createdAt || 0))
    if (!paid && collaboratorMemberships.length > 0 && collaboratorMemberships[0].workspaceId !== workspaceId) return null
  }
  if (!member || (write && member.accessLevel !== 'contributor')) return null
  return { workspace, level: member.accessLevel || 'viewer' }
}

// Row-level access resolution (§5). Mirrors codeWorkspaceAccess against scoped
// queries instead of the whole-database snapshot.
export async function codeWorkspaceAccessRow(userId, workspaceId, write = false) {
  const workspace = await loadWorkspace(workspaceId)
  if (!workspace) return null
  if (workspace.ownerId === userId) return { workspace, level: 'owner' }
  const member = await loadWorkspaceMember(workspaceId, userId)
  if (member && String(member.role || '').toLowerCase() === 'collaborator') {
    const paid = await collaboratorIsPaid(userId)
    const firstWorkspace = await firstCollaboratorWorkspace(userId)
    if (!paid && firstWorkspace && firstWorkspace !== workspaceId) return null
  }
  if (!member || (write && member.accessLevel !== 'contributor')) return null
  return { workspace, level: member.accessLevel || 'viewer' }
}
async function resolveAccess(userId, workspaceId, write = false) {
  return workspaceCodeEnabled() ? codeWorkspaceAccessRow(userId, workspaceId, write) : codeWorkspaceAccess(readAuthorityDb(), userId, workspaceId, write)
}

function publicFile(file) {
  return { id: file.id, workspaceId: file.workspaceId, projectId: file.projectId, path: file.path, language: file.language, sizeBytes: file.sizeBytes, version: file.version, contentHash: file.contentHash, deleted: Boolean(file.deleted), updatedAt: file.updatedAt, updatedBy: file.updatedBy }
}

function language(path) {
  const extension = path.split('.').pop()?.toLowerCase()
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python', yml: 'yaml', yaml: 'yaml', sh: 'shell' })[extension] || 'plaintext'
}

export function appendCodeEvent(db, input) {
  const previous = rows(db, 'codeChangeEvents').filter(row => row.workspaceId === input.workspaceId).at(-1)?.eventHash || 'GENESIS'
  const createdAt = nowIso(); const body = { ...input, createdAt }; const eventHash = sha(`${previous}|${JSON.stringify(body)}`)
  const row = { id: createId('code_event'), ...body, previousHash: previous, eventHash }
  rows(db, 'codeChangeEvents').push(row); return row
}

// Row-level event append: reads only this workspace's event chain.
export async function appendEventRow(input) {
  const events = await listByWorkspace('codeChangeEvents', input.workspaceId)
  const previous = [...events].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)).at(-1)?.eventHash || 'GENESIS'
  const createdAt = nowIso(); const body = { ...input, createdAt }; const eventHash = sha(`${previous}|${JSON.stringify(body)}`)
  const row = { id: createId('code_event'), ...body, previousHash: previous, eventHash }
  await insertRow('codeChangeEvents', row)
  return row
}

export async function listProjectFiles(userId, workspaceId, includeDeleted = false) {
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId); if (!auth) return { ok: false, status: 403, error: 'workspace_access_denied' }
    const files = (await listByWorkspace('projectFiles', workspaceId)).filter(row => includeDeleted || !row.deleted).sort((a, b) => a.path.localeCompare(b.path)).map(publicFile)
    return { ok: true, workspace: { id: auth.workspace.id, projectId: auth.workspace.projectId, name: auth.workspace.name, accessLevel: auth.level }, files }
  }
  const db = readAuthorityDb(); const auth = codeWorkspaceAccess(db, userId, workspaceId); if (!auth) return { ok: false, status: 403, error: 'workspace_access_denied' }
  const files = rows(db, 'projectFiles').filter(row => row.workspaceId === workspaceId && (includeDeleted || !row.deleted)).sort((a, b) => a.path.localeCompare(b.path)).map(publicFile)
  return { ok: true, workspace: { id: auth.workspace.id, projectId: auth.workspace.projectId, name: auth.workspace.name, accessLevel: auth.level }, files }
}

export async function readProjectFile(userId, workspaceId, pathValue) {
  const path = safeCodePath(pathValue)
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId)
    if (!auth) return { ok: false, status: 403, error: 'workspace_access_denied' }
    if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
    const file = (await listByWorkspace('projectFiles', workspaceId)).find(row => row.path === path && !row.deleted)
    return file ? { ok: true, file: { ...publicFile(file), content: file.content } } : { ok: false, status: 404, error: 'file_not_found' }
  }
  const db = readAuthorityDb(); const auth = codeWorkspaceAccess(db, userId, workspaceId)
  if (!auth) return { ok: false, status: 403, error: 'workspace_access_denied' }
  if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
  const file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === path && !row.deleted)
  return file ? { ok: true, file: { ...publicFile(file), content: file.content } } : { ok: false, status: 404, error: 'file_not_found' }
}

export async function saveProjectFile(userId, workspaceId, body = {}) {
  const path = safeCodePath(body.path); const content = typeof body.content === 'string' ? body.content : null
  if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
  if (content === null || Buffer.byteLength(content, 'utf8') > MAX_TEXT_BYTES) return { ok: false, status: 413, error: 'file_content_invalid' }
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    let file = await findByWorkspacePath('projectFiles', workspaceId, path)
    if (file && body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(file.version)) return { ok: false, status: 409, error: 'file_version_conflict', current: publicFile(file) }
    const before = file ? { contentHash: file.contentHash, version: file.version, deleted: file.deleted } : null
    const createdAt = nowIso(); const nextVersion = Number(file?.version || 0) + 1
    const base = file || { id: createId('project_file'), workspaceId, projectId: auth.workspace.projectId, path, createdAt, createdBy: userId }
    file = { ...base, content, language: language(path), sizeBytes: Buffer.byteLength(content, 'utf8'), contentHash: sha(content), version: nextVersion, deleted: false, updatedAt: createdAt, updatedBy: userId }
    if (base.createdAt === createdAt && !base.version) await insertRow('projectFiles', file); else await saveRow('projectFiles', file)
    await insertRow('projectFileVersions', { id: createId('file_version'), fileId: file.id, workspaceId, projectId: file.projectId, path, version: nextVersion, content, contentHash: file.contentHash, actorId: userId, source: String(body.source || 'manual').slice(0, 40), createdAt })
    await appendEventRow({ workspaceId, projectId: file.projectId, actorId: userId, type: before ? 'file_updated' : 'file_created', fileId: file.id, path, before, after: { contentHash: file.contentHash, version: nextVersion } })
    return { ok: true, file: { ...publicFile(file), content } }
  }
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    let file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === path)
    if (file && body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(file.version)) return { ok: false, status: 409, error: 'file_version_conflict', current: publicFile(file) }
    const before = file ? { contentHash: file.contentHash, version: file.version, deleted: file.deleted } : null
    const createdAt = nowIso(); const nextVersion = Number(file?.version || 0) + 1
    if (!file) { file = { id: createId('project_file'), workspaceId, projectId: auth.workspace.projectId, path, createdAt, createdBy: userId }; rows(db, 'projectFiles').push(file) }
    Object.assign(file, { content, language: language(path), sizeBytes: Buffer.byteLength(content, 'utf8'), contentHash: sha(content), version: nextVersion, deleted: false, updatedAt: createdAt, updatedBy: userId })
    rows(db, 'projectFileVersions').push({ id: createId('file_version'), fileId: file.id, workspaceId, projectId: file.projectId, path, version: nextVersion, content, contentHash: file.contentHash, actorId: userId, source: String(body.source || 'manual').slice(0, 40), createdAt })
    appendCodeEvent(db, { workspaceId, projectId: file.projectId, actorId: userId, type: before ? 'file_updated' : 'file_created', fileId: file.id, path, before, after: { contentHash: file.contentHash, version: nextVersion } })
    return { ok: true, file: { ...publicFile(file), content } }
  })
}

export async function moveProjectFile(userId, workspaceId, pathValue, body = {}) {
  const path = safeCodePath(pathValue); const nextPath = safeCodePath(body.path)
  if (!path || !nextPath) return { ok: false, status: 400, error: 'unsafe_file_path' }
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const files = await listByWorkspace('projectFiles', workspaceId)
    const file = files.find(row => row.path === path && !row.deleted)
    if (!file) return { ok: false, status: 404, error: 'file_not_found' }
    if (body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(file.version)) return { ok: false, status: 409, error: 'file_version_conflict', current: publicFile(file) }
    if (files.some(row => row.path === nextPath && !row.deleted)) return { ok: false, status: 409, error: 'destination_exists' }
    const before = file.path; const moved = { ...file, path: nextPath, language: language(nextPath), version: file.version + 1, updatedAt: nowIso(), updatedBy: userId }
    await saveRow('projectFiles', moved)
    await appendEventRow({ workspaceId, projectId: auth.workspace.projectId, actorId: userId, type: 'file_moved', fileId: file.id, path: nextPath, before: { path: before }, after: { path: nextPath, version: moved.version } })
    return { ok: true, file: publicFile(moved) }
  }
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === path && !row.deleted)
    if (!file) return { ok: false, status: 404, error: 'file_not_found' }
    if (body.expectedVersion !== undefined && Number(body.expectedVersion) !== Number(file.version)) return { ok: false, status: 409, error: 'file_version_conflict', current: publicFile(file) }
    if (rows(db, 'projectFiles').some(row => row.workspaceId === workspaceId && row.path === nextPath && !row.deleted)) return { ok: false, status: 409, error: 'destination_exists' }
    const before = file.path; file.path = nextPath; file.language = language(nextPath); file.version += 1; file.updatedAt = nowIso(); file.updatedBy = userId
    appendCodeEvent(db, { workspaceId, projectId: auth.workspace.projectId, actorId: userId, type: 'file_moved', fileId: file.id, path: nextPath, before: { path: before }, after: { path: nextPath, version: file.version } })
    return { ok: true, file: publicFile(file) }
  })
}

export async function deleteProjectFile(userId, workspaceId, pathValue, expectedVersion) {
  const path = safeCodePath(pathValue); if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const file = (await listByWorkspace('projectFiles', workspaceId)).find(row => row.path === path && !row.deleted)
    if (!file) return { ok: false, status: 404, error: 'file_not_found' }
    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(file.version)) return { ok: false, status: 409, error: 'file_version_conflict', current: publicFile(file) }
    const deleted = { ...file, deleted: true, version: file.version + 1, updatedAt: nowIso(), updatedBy: userId }
    await saveRow('projectFiles', deleted)
    await appendEventRow({ workspaceId, projectId: auth.workspace.projectId, actorId: userId, type: 'file_deleted', fileId: file.id, path, before: { contentHash: file.contentHash }, after: { deleted: true, version: deleted.version } })
    return { ok: true, file: publicFile(deleted) }
  }
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === path && !row.deleted)
    if (!file) return { ok: false, status: 404, error: 'file_not_found' }
    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(file.version)) return { ok: false, status: 409, error: 'file_version_conflict', current: publicFile(file) }
    file.deleted = true; file.version += 1; file.updatedAt = nowIso(); file.updatedBy = userId
    appendCodeEvent(db, { workspaceId, projectId: auth.workspace.projectId, actorId: userId, type: 'file_deleted', fileId: file.id, path, before: { contentHash: file.contentHash }, after: { deleted: true, version: file.version } })
    return { ok: true, file: publicFile(file) }
  })
}

export async function projectFileHistory(userId, workspaceId, pathValue) {
  const path = safeCodePath(pathValue)
  if (workspaceCodeEnabled()) {
    if (!await codeWorkspaceAccessRow(userId, workspaceId)) return { ok: false, status: 403, error: 'workspace_access_denied' }
    if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
    const versions = (await listByWorkspace('projectFileVersions', workspaceId)).filter(row => row.path === path).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return { ok: true, versions: versions.map(({ content, ...row }) => ({ ...row, sizeBytes: Buffer.byteLength(content, 'utf8') })) }
  }
  const db = readAuthorityDb(); if (!codeWorkspaceAccess(db, userId, workspaceId)) return { ok: false, status: 403, error: 'workspace_access_denied' }
  if (!path) return { ok: false, status: 400, error: 'unsafe_file_path' }
  return { ok: true, versions: rows(db, 'projectFileVersions').filter(row => row.workspaceId === workspaceId && row.path === path).map(({ content, ...row }) => ({ ...row, sizeBytes: Buffer.byteLength(content, 'utf8') })).reverse() }
}

export async function codeWorkspaceSnapshot(userId, workspaceId) {
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId); if (!auth) return { ok: false, status: 403, error: 'workspace_access_denied' }
    const files = (await listByWorkspace('projectFiles', workspaceId)).filter(row => !row.deleted).map(row => ({ path: row.path, content: row.content, version: row.version, contentHash: row.contentHash, language: row.language }))
    const sync = (await listByWorkspace('codeSyncStates', workspaceId)).find(row => row.status === 'active') || null
    return { ok: true, workspace: auth.workspace, files, sync, snapshotHash: sha(files.map(row => `${row.path}:${row.contentHash}`).sort().join('|')) }
  }
  const db = readAuthorityDb(); const auth = codeWorkspaceAccess(db, userId, workspaceId); if (!auth) return { ok: false, status: 403, error: 'workspace_access_denied' }
  const files = rows(db, 'projectFiles').filter(row => row.workspaceId === workspaceId && !row.deleted).map(row => ({ path: row.path, content: row.content, version: row.version, contentHash: row.contentHash, language: row.language }))
  const sync = rows(db, 'codeSyncStates').find(row => row.workspaceId === workspaceId && row.status === 'active') || null
  return { ok: true, workspace: auth.workspace, files, sync, snapshotHash: sha(files.map(row => `${row.path}:${row.contentHash}`).sort().join('|')) }
}

export async function detectProjectAdapter(userId, workspaceId) {
  const snapshot = await codeWorkspaceSnapshot(userId, workspaceId); if (!snapshot.ok) return snapshot
  const byPath = new Map(snapshot.files.map(file => [file.path, file.content])); let adapter = 'static'; let packageManager = null; let scripts = {}
  if (byPath.has('package.json')) { try { const pkg = JSON.parse(byPath.get('package.json')); scripts = pkg.scripts || {}; packageManager = byPath.has('pnpm-lock.yaml') ? 'pnpm' : byPath.has('yarn.lock') ? 'yarn' : 'npm'; const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }; adapter = deps.next ? 'nextjs' : deps.react ? 'react' : 'node' } catch {} }
  else if (byPath.has('pyproject.toml') || byPath.has('requirements.txt')) adapter = 'python'
  return { ok: true, adapter, packageManager, commands: { install: packageManager ? `${packageManager} install` : null, dev: scripts.dev ? `${packageManager} run dev` : adapter === 'python' ? 'python -m app' : null, test: scripts.test ? `${packageManager} test` : adapter === 'python' ? 'python -m pytest' : null, build: scripts.build ? `${packageManager} run build` : null }, supportedInBrowser: ['react', 'nextjs', 'node', 'static'].includes(adapter), deterministic: true }
}

export async function recordRuntimeSession(userId, workspaceId, body = {}) {
  const status = ['started', 'completed', 'failed', 'cancelled', 'crashed'].includes(body.status) ? body.status : 'started'
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const row = { id: createId('runtime'), workspaceId, projectId: auth.workspace.projectId, actorId: userId, executionRunId: body.executionRunId ? String(body.executionRunId) : null, adapter: String(body.adapter || ''), commandType: String(body.commandType || 'dev'), command: String(body.command || '').slice(0, 300), status, exitCode: body.exitCode == null ? null : Number(body.exitCode), durationMs: body.durationMs == null ? null : Number(body.durationMs), outputSummary: String(body.outputSummary || '').slice(0, 3000), createdAt: nowIso() }
    await insertRow('codeRuntimeSessions', row)
    await appendEventRow({ workspaceId, projectId: row.projectId, actorId: userId, type: `runtime_${status}`, runtimeId: row.id, metadata: { commandType: row.commandType, exitCode: row.exitCode, executionRunId: row.executionRunId } })
    return { ok: true, session: row }
  }
  return updateAuthorityDb(db => { const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }; const row = { id: createId('runtime'), workspaceId, projectId: auth.workspace.projectId, actorId: userId, executionRunId: body.executionRunId ? String(body.executionRunId) : null, adapter: String(body.adapter || ''), commandType: String(body.commandType || 'dev'), command: String(body.command || '').slice(0, 300), status, exitCode: body.exitCode == null ? null : Number(body.exitCode), durationMs: body.durationMs == null ? null : Number(body.durationMs), outputSummary: String(body.outputSummary || '').slice(0, 3000), createdAt: nowIso() }; rows(db, 'codeRuntimeSessions').push(row); appendCodeEvent(db, { workspaceId, projectId: row.projectId, actorId: userId, type: `runtime_${status}`, runtimeId: row.id, metadata: { commandType: row.commandType, exitCode: row.exitCode, executionRunId: row.executionRunId } }); return { ok: true, session: row } })
}

function buildSyncRow(userId, workspaceId, projectId, body) {
  return { id: createId('sync_state'), workspaceId, projectId, provider: String(body.provider || 'github').slice(0, 40), repo: String(body.repo || '').slice(0, 300), branch: String(body.branch || 'main').slice(0, 200), baseHeadSha: String(body.baseHeadSha || '').slice(0, 100), snapshotHash: String(body.snapshotHash || '').slice(0, 100), baseFiles: Array.isArray(body.baseFiles) ? body.baseFiles.slice(0, 500).map(item => ({ path: safeCodePath(item?.path), contentHash: String(item?.contentHash || '').slice(0, 100), content: typeof item?.content === 'string' && Buffer.byteLength(item.content, 'utf8') <= MAX_TEXT_BYTES ? item.content : undefined })).filter(item => item.path) : [], status: 'active', updatedBy: userId, createdAt: nowIso() }
}

export async function saveSyncState(userId, workspaceId, body = {}) {
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const provider = String(body.provider || 'github')
    for (const existing of (await listByWorkspace('codeSyncStates', workspaceId)).filter(row => row.provider === provider && row.status === 'active')) await saveRow('codeSyncStates', { ...existing, status: 'superseded' })
    const row = buildSyncRow(userId, workspaceId, auth.workspace.projectId, body)
    await insertRow('codeSyncStates', row)
    return { ok: true, sync: row }
  }
  return updateAuthorityDb(db => { const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }; rows(db, 'codeSyncStates').forEach(row => { if (row.workspaceId === workspaceId && row.provider === String(body.provider || 'github')) row.status = 'superseded' }); const row = buildSyncRow(userId, workspaceId, auth.workspace.projectId, body); rows(db, 'codeSyncStates').push(row); return { ok: true, sync: row } })
}

export async function createBridgeGrant(userId, workspaceId, body = {}) {
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const rawToken = crypto.randomBytes(32).toString('base64url'); const row = { id: createId('bridge_grant'), workspaceId, projectId: auth.workspace.projectId, userId, tokenHash: sha(rawToken), permissions: ['files.read', 'files.write', ...(body.allowCommands === true ? ['commands.bounded'] : [])], selectedRoot: String(body.selectedRoot || '').slice(0, 500) || null, status: 'active', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), createdAt: nowIso() }
    await insertRow('codeBridgeGrants', row)
    await appendEventRow({ workspaceId, projectId: row.projectId, actorId: userId, type: 'bridge_grant_created', bridgeGrantId: row.id, metadata: { permissions: row.permissions, expiresAt: row.expiresAt } })
    return { ok: true, grant: { ...row, token: rawToken, tokenHash: undefined } }
  }
  return updateAuthorityDb(db => { const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }; const rawToken = crypto.randomBytes(32).toString('base64url'); const row = { id: createId('bridge_grant'), workspaceId, projectId: auth.workspace.projectId, userId, tokenHash: sha(rawToken), permissions: ['files.read', 'files.write', ...(body.allowCommands === true ? ['commands.bounded'] : [])], selectedRoot: String(body.selectedRoot || '').slice(0, 500) || null, status: 'active', expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), createdAt: nowIso() }; rows(db, 'codeBridgeGrants').push(row); appendCodeEvent(db, { workspaceId, projectId: row.projectId, actorId: userId, type: 'bridge_grant_created', bridgeGrantId: row.id, metadata: { permissions: row.permissions, expiresAt: row.expiresAt } }); return { ok: true, grant: { ...row, token: rawToken, tokenHash: undefined } } })
}

export async function recordDeployment(userId, workspaceId, body = {}) {
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    if (body.confirm !== true) return { ok: false, status: 400, error: 'deployment_confirmation_required' }
    const environment = ['preview', 'staging', 'production'].includes(body.environment) ? body.environment : 'preview'
    const commitSha = String(body.commitSha || '').slice(0, 100); const buildStatus = String(body.buildStatus || 'unknown'); const testStatus = String(body.testStatus || 'unknown'); const securityStatus = String(body.securityStatus || 'unknown')
    if (environment === 'production' && (!commitSha || [buildStatus, testStatus, securityStatus].some(value => value !== 'passed'))) return { ok: false, status: 409, error: 'production_evidence_incomplete' }
    const row = { id: createId('code_deployment'), workspaceId, projectId: auth.workspace.projectId, actorId: userId, executionRunId: body.executionRunId ? String(body.executionRunId) : null, environment, destination: String(body.destination || '').slice(0, 200), commitSha, buildStatus, testStatus, securityStatus, status: 'prepared', createdAt: nowIso() }
    await insertRow('codeDeploymentRecords', row)
    await appendEventRow({ workspaceId, projectId: row.projectId, actorId: userId, type: 'deployment_prepared', deploymentId: row.id, metadata: row })
    return { ok: true, deployment: row }
  }
  return updateAuthorityDb(db => { const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }; if (body.confirm !== true) return { ok: false, status: 400, error: 'deployment_confirmation_required' }; const environment = ['preview', 'staging', 'production'].includes(body.environment) ? body.environment : 'preview'; const commitSha = String(body.commitSha || '').slice(0, 100); const buildStatus = String(body.buildStatus || 'unknown'); const testStatus = String(body.testStatus || 'unknown'); const securityStatus = String(body.securityStatus || 'unknown'); if (environment === 'production' && (!commitSha || [buildStatus, testStatus, securityStatus].some(value => value !== 'passed'))) return { ok: false, status: 409, error: 'production_evidence_incomplete' }; const row = { id: createId('code_deployment'), workspaceId, projectId: auth.workspace.projectId, actorId: userId, executionRunId: body.executionRunId ? String(body.executionRunId) : null, environment, destination: String(body.destination || '').slice(0, 200), commitSha, buildStatus, testStatus, securityStatus, status: 'prepared', createdAt: nowIso() }; rows(db, 'codeDeploymentRecords').push(row); appendCodeEvent(db, { workspaceId, projectId: row.projectId, actorId: userId, type: 'deployment_prepared', deploymentId: row.id, metadata: row }); return { ok: true, deployment: row } })
}

export async function listCodeDestinations(userId, workspaceId) {
  const connectors = await (async () => {
    if (workspaceCodeEnabled()) {
      if (!await codeWorkspaceAccessRow(userId, workspaceId)) return null
      return (await listByWorkspace('workspaceConnectors', workspaceId)).filter(row => row.status === 'connected')
    }
    const db = readAuthorityDb(); if (!codeWorkspaceAccess(db, userId, workspaceId)) return null
    return rows(db, 'workspaceConnectors').filter(row => row.workspaceId === workspaceId && row.status === 'connected')
  })()
  if (connectors === null) return { ok: false, status: 403, error: 'workspace_access_denied' }
  const destinations = connectors.flatMap(row => {
    const provider = String(row.provider || row.sourceConnectorId || row.connectorId || row.id || '').toLowerCase()
    if (!['github', 'gitlab', 'bitbucket'].includes(provider)) return []
    return (row.resources || []).map(resource => ({ id: `${provider}:${resource}`, provider, repository: String(resource), capabilities: { pull: true, push: true, deploy: provider === 'github' }, connectorId: row.id }))
  })
  destinations.push({ id: 'local:vscode', provider: 'local', repository: null, capabilities: { pull: true, push: true, deploy: false }, connectorId: null })
  return { ok: true, destinations }
}

export async function verifyCodeDeployment(userId, workspaceId, deploymentId, body = {}) {
  const checks = Array.isArray(body.checks) ? body.checks.slice(0, 100).map(item => ({ name: String(item?.name || '').slice(0, 200), conclusion: ['success', 'failure', 'pending'].includes(item?.conclusion) ? item.conclusion : 'pending' })) : []
  const status = checks.length > 0 && checks.every(item => item.conclusion === 'success') && body.providerStatus === 'success' ? 'verified' : body.providerStatus === 'failure' || checks.some(item => item.conclusion === 'failure') ? 'failed' : 'pending'
  if (workspaceCodeEnabled()) {
    const auth = await codeWorkspaceAccessRow(userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const deployment = await loadById('codeDeploymentRecords', deploymentId)
    if (!deployment || deployment.workspaceId !== workspaceId) return { ok: false, status: 404, error: 'deployment_not_found' }
    const row = { id: createId('deployment_verification'), deploymentId, workspaceId, projectId: deployment.projectId, actorId: userId, providerStatus: String(body.providerStatus || 'pending'), checks, url: String(body.url || '').slice(0, 1000), status, createdAt: nowIso() }
    await insertRow('codeDeploymentVerifications', row)
    const updated = { ...deployment, status, verifiedAt: status === 'verified' ? row.createdAt : null }
    await saveRow('codeDeploymentRecords', updated)
    await appendEventRow({ workspaceId, projectId: deployment.projectId, actorId: userId, type: `deployment_${status}`, deploymentId, metadata: { verificationId: row.id, url: row.url } })
    return { ok: true, deployment: updated, verification: row }
  }
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    const deployment = rows(db, 'codeDeploymentRecords').find(row => row.id === deploymentId && row.workspaceId === workspaceId); if (!deployment) return { ok: false, status: 404, error: 'deployment_not_found' }
    const row = { id: createId('deployment_verification'), deploymentId, workspaceId, projectId: deployment.projectId, actorId: userId, providerStatus: String(body.providerStatus || 'pending'), checks, url: String(body.url || '').slice(0, 1000), status, createdAt: nowIso() }
    rows(db, 'codeDeploymentVerifications').push(row); deployment.status = status; deployment.verifiedAt = status === 'verified' ? row.createdAt : null
    appendCodeEvent(db, { workspaceId, projectId: deployment.projectId, actorId: userId, type: `deployment_${status}`, deploymentId, metadata: { verificationId: row.id, url: row.url } })
    return { ok: true, deployment, verification: row }
  })
}
