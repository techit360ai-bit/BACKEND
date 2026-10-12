import crypto from 'node:crypto'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { appendCodeEvent, appendEventRow, codeWorkspaceAccess, codeWorkspaceAccessRow, safeCodePath } from './codeWorkspaceService.js'
import { workspaceCodeEnabled, listByField, listByWorkspace, insertRow, saveRow } from '../repositories/workspaceCodeRepository.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex')

function sessionFor(db, rawToken, workspaceId) {
  const tokenHash = hash(rawToken || '')
  return rows(db, 'codeBridgeSessions').find(row => row.tokenHash === tokenHash && row.workspaceId === workspaceId && row.status === 'active' && Date.parse(row.expiresAt) > Date.now()) || null
}

export function exchangeCodeBridgeGrant(body = {}) {
  const rawGrant = String(body.grant || '')
  if (!rawGrant) return { ok: false, status: 400, error: 'bridge_grant_required' }
  return updateAuthorityDb(db => {
    const grant = rows(db, 'codeBridgeGrants').find(row => row.tokenHash === hash(rawGrant) && row.status === 'active')
    if (!grant || Date.parse(grant.expiresAt) <= Date.now()) return { ok: false, status: 401, error: 'bridge_grant_invalid' }
    grant.status = 'consumed'; grant.consumedAt = nowIso()
    const rawToken = crypto.randomBytes(32).toString('base64url')
    const row = { id: createId('bridge_session'), grantId: grant.id, workspaceId: grant.workspaceId, projectId: grant.projectId, userId: grant.userId, tokenHash: hash(rawToken), permissions: grant.permissions, deviceName: String(body.deviceName || 'VS Code').slice(0, 200), rootFingerprint: String(body.rootFingerprint || '').slice(0, 200), status: 'active', expiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString(), createdAt: nowIso() }
    rows(db, 'codeBridgeSessions').push(row)
    appendCodeEvent(db, { workspaceId: row.workspaceId, projectId: row.projectId, actorId: row.userId, type: 'bridge_session_started', bridgeSessionId: row.id, metadata: { deviceName: row.deviceName, expiresAt: row.expiresAt } })
    return { ok: true, session: { id: row.id, workspaceId: row.workspaceId, projectId: row.projectId, permissions: row.permissions, expiresAt: row.expiresAt, token: rawToken } }
  })
}

export function codeBridgeSnapshot(rawToken, workspaceId) {
  const db = readAuthorityDb(); const session = sessionFor(db, rawToken, workspaceId)
  if (!session || !session.permissions.includes('files.read')) return { ok: false, status: 401, error: 'bridge_session_invalid' }
  const files = rows(db, 'projectFiles').filter(row => row.workspaceId === workspaceId && !row.deleted).map(row => ({ path: row.path, content: row.content, version: row.version, contentHash: row.contentHash }))
  return { ok: true, workspaceId, projectId: session.projectId, files, snapshotHash: hash(files.map(row => `${row.path}:${row.contentHash}`).sort().join('|')) }
}

export function syncCodeBridgeFiles(rawToken, workspaceId, body = {}) {
  const changes = Array.isArray(body.changes) ? body.changes.slice(0, 100) : []
  return updateAuthorityDb(db => {
    const session = sessionFor(db, rawToken, workspaceId)
    if (!session || !session.permissions.includes('files.write')) return { ok: false, status: 401, error: 'bridge_session_invalid' }
    const normalized = changes.map(item => ({ path: safeCodePath(item?.path), content: typeof item?.content === 'string' ? item.content : null, expectedVersion: Number(item?.expectedVersion || 0), delete: item?.delete === true }))
    if (normalized.some(item => !item.path || (!item.delete && (item.content === null || Buffer.byteLength(item.content, 'utf8') > 1_000_000)))) return { ok: false, status: 400, error: 'bridge_change_invalid' }
    for (const change of normalized) {
      const current = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === change.path && !row.deleted)
      if (Number(current?.version || 0) !== change.expectedVersion) return { ok: false, status: 409, error: 'file_version_conflict', path: change.path, currentVersion: Number(current?.version || 0) }
    }
    const applied = []
    for (const change of normalized) {
      let file = rows(db, 'projectFiles').find(row => row.workspaceId === workspaceId && row.path === change.path)
      const createdAt = nowIso(); const nextVersion = Number(file?.version || 0) + 1
      if (change.delete) {
        if (file) { file.deleted = true; file.version = nextVersion; file.updatedAt = createdAt; file.updatedBy = session.userId }
        appendCodeEvent(db, { workspaceId, projectId: session.projectId, actorId: session.userId, type: 'bridge_file_deleted', bridgeSessionId: session.id, path: change.path, after: { deleted: true, version: nextVersion } })
        applied.push({ path: change.path, version: nextVersion, deleted: true }); continue
      }
      const contentHash = hash(change.content)
      if (!file) { file = { id: createId('project_file'), workspaceId, projectId: session.projectId, path: change.path, createdAt, createdBy: session.userId }; rows(db, 'projectFiles').push(file) }
      Object.assign(file, { content: change.content, language: languageForPath(change.path), sizeBytes: Buffer.byteLength(change.content, 'utf8'), contentHash, version: nextVersion, deleted: false, updatedAt: createdAt, updatedBy: session.userId })
      rows(db, 'projectFileVersions').push({ id: createId('file_version'), fileId: file.id, workspaceId, projectId: session.projectId, path: change.path, version: nextVersion, content: change.content, contentHash, actorId: session.userId, source: 'vscode_bridge', bridgeSessionId: session.id, createdAt })
      appendCodeEvent(db, { workspaceId, projectId: session.projectId, actorId: session.userId, type: 'bridge_file_synced', bridgeSessionId: session.id, fileId: file.id, path: change.path, after: { contentHash, version: nextVersion } })
      applied.push({ path: change.path, version: nextVersion, contentHash })
    }
    session.lastSeenAt = nowIso()
    return { ok: true, applied }
  })
}

export function revokeCodeBridgeSessions(userId, workspaceId) {
  return updateAuthorityDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    let revoked = 0
    for (const row of rows(db, 'codeBridgeSessions')) if (row.workspaceId === workspaceId && row.userId === userId && row.status === 'active') { row.status = 'revoked'; row.revokedAt = nowIso(); revoked += 1 }
    appendCodeEvent(db, { workspaceId, projectId: auth.workspace.projectId, actorId: userId, type: 'bridge_sessions_revoked', metadata: { revoked } })
    return { ok: true, revoked }
  })
}

// Row-level (§5) wrappers — VS Code bridge. The grant/session/files exchange is
// resolved from scoped rows (the grant or session row plus the workspace's
// files/versions/events) instead of the whole-DB snapshot. Gated by
// WORKSPACE_CODE_*_SOURCE=postgres; otherwise the synchronous functions above
// remain the fallback.
const findBridgeSession = (sessions, rawToken, workspaceId) => {
  const tokenHash = hash(rawToken || '')
  return sessions.find(row => row.tokenHash === tokenHash && row.workspaceId === workspaceId && row.status === 'active' && Date.parse(row.expiresAt) > Date.now()) || null
}

export async function exchangeCodeBridgeGrantAsync(body = {}) {
  const rawGrant = String(body.grant || '')
  if (!rawGrant) return { ok: false, status: 400, error: 'bridge_grant_required' }
  if (!workspaceCodeEnabled()) return exchangeCodeBridgeGrant(body)
  const grant = (await listByField('codeBridgeGrants', 'tokenHash', hash(rawGrant))).find(row => row.status === 'active')
  if (!grant || Date.parse(grant.expiresAt) <= Date.now()) return { ok: false, status: 401, error: 'bridge_grant_invalid' }
  await saveRow('codeBridgeGrants', { ...grant, status: 'consumed', consumedAt: nowIso() })
  const rawToken = crypto.randomBytes(32).toString('base64url')
  const row = { id: createId('bridge_session'), grantId: grant.id, workspaceId: grant.workspaceId, projectId: grant.projectId, userId: grant.userId, tokenHash: hash(rawToken), permissions: grant.permissions, deviceName: String(body.deviceName || 'VS Code').slice(0, 200), rootFingerprint: String(body.rootFingerprint || '').slice(0, 200), status: 'active', expiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString(), createdAt: nowIso() }
  await insertRow('codeBridgeSessions', row)
  await appendEventRow({ workspaceId: row.workspaceId, projectId: row.projectId, actorId: row.userId, type: 'bridge_session_started', bridgeSessionId: row.id, metadata: { deviceName: row.deviceName, expiresAt: row.expiresAt } })
  return { ok: true, session: { id: row.id, workspaceId: row.workspaceId, projectId: row.projectId, permissions: row.permissions, expiresAt: row.expiresAt, token: rawToken } }
}

export async function codeBridgeSnapshotAsync(rawToken, workspaceId) {
  if (!workspaceCodeEnabled()) return codeBridgeSnapshot(rawToken, workspaceId)
  const session = findBridgeSession(await listByWorkspace('codeBridgeSessions', workspaceId), rawToken, workspaceId)
  if (!session || !session.permissions.includes('files.read')) return { ok: false, status: 401, error: 'bridge_session_invalid' }
  const files = (await listByWorkspace('projectFiles', workspaceId)).filter(row => !row.deleted).map(row => ({ path: row.path, content: row.content, version: row.version, contentHash: row.contentHash }))
  return { ok: true, workspaceId, projectId: session.projectId, files, snapshotHash: hash(files.map(row => `${row.path}:${row.contentHash}`).sort().join('|')) }
}

export async function syncCodeBridgeFilesAsync(rawToken, workspaceId, body = {}) {
  const changes = Array.isArray(body.changes) ? body.changes.slice(0, 100) : []
  if (!workspaceCodeEnabled()) return syncCodeBridgeFiles(rawToken, workspaceId, body)
  const session = findBridgeSession(await listByWorkspace('codeBridgeSessions', workspaceId), rawToken, workspaceId)
  if (!session || !session.permissions.includes('files.write')) return { ok: false, status: 401, error: 'bridge_session_invalid' }
  const normalized = changes.map(item => ({ path: safeCodePath(item?.path), content: typeof item?.content === 'string' ? item.content : null, expectedVersion: Number(item?.expectedVersion || 0), delete: item?.delete === true }))
  if (normalized.some(item => !item.path || (!item.delete && (item.content === null || Buffer.byteLength(item.content, 'utf8') > 1_000_000)))) return { ok: false, status: 400, error: 'bridge_change_invalid' }
  const files = await listByWorkspace('projectFiles', workspaceId)
  for (const change of normalized) {
    const current = files.find(row => row.path === change.path && !row.deleted)
    if (Number(current?.version || 0) !== change.expectedVersion) return { ok: false, status: 409, error: 'file_version_conflict', path: change.path, currentVersion: Number(current?.version || 0) }
  }
  const applied = []
  for (const change of normalized) {
    let file = files.find(row => row.path === change.path)
    const createdAt = nowIso(); const nextVersion = Number(file?.version || 0) + 1
    if (change.delete) {
      if (file) { const removed = { ...file, deleted: true, version: nextVersion, updatedAt: createdAt, updatedBy: session.userId }; Object.assign(file, removed); await saveRow('projectFiles', file) }
      await appendEventRow({ workspaceId, projectId: session.projectId, actorId: session.userId, type: 'bridge_file_deleted', bridgeSessionId: session.id, path: change.path, after: { deleted: true, version: nextVersion } })
      applied.push({ path: change.path, version: nextVersion, deleted: true }); continue
    }
    const contentHash = hash(change.content)
    const isNew = !file
    if (isNew) { file = { id: createId('project_file'), workspaceId, projectId: session.projectId, path: change.path, createdAt, createdBy: session.userId }; files.push(file) }
    Object.assign(file, { content: change.content, language: languageForPath(change.path), sizeBytes: Buffer.byteLength(change.content, 'utf8'), contentHash, version: nextVersion, deleted: false, updatedAt: createdAt, updatedBy: session.userId })
    if (isNew) await insertRow('projectFiles', file); else await saveRow('projectFiles', file)
    await insertRow('projectFileVersions', { id: createId('file_version'), fileId: file.id, workspaceId, projectId: session.projectId, path: change.path, version: nextVersion, content: change.content, contentHash, actorId: session.userId, source: 'vscode_bridge', bridgeSessionId: session.id, createdAt })
    await appendEventRow({ workspaceId, projectId: session.projectId, actorId: session.userId, type: 'bridge_file_synced', bridgeSessionId: session.id, fileId: file.id, path: change.path, after: { contentHash, version: nextVersion } })
    applied.push({ path: change.path, version: nextVersion, contentHash })
  }
  await saveRow('codeBridgeSessions', { ...session, lastSeenAt: nowIso() })
  return { ok: true, applied }
}

export async function revokeCodeBridgeSessionsAsync(userId, workspaceId) {
  if (!workspaceCodeEnabled()) return revokeCodeBridgeSessions(userId, workspaceId)
  const auth = await codeWorkspaceAccessRow(userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
  let revoked = 0
  for (const row of await listByWorkspace('codeBridgeSessions', workspaceId)) {
    if (row.userId === userId && row.status === 'active') { await saveRow('codeBridgeSessions', { ...row, status: 'revoked', revokedAt: nowIso() }); revoked += 1 }
  }
  await appendEventRow({ workspaceId, projectId: auth.workspace.projectId, actorId: userId, type: 'bridge_sessions_revoked', metadata: { revoked } })
  return { ok: true, revoked }
}

export function bridgeTokenFromRequest(req) {
  const value = String(req.headers.authorization || '')
  return value.startsWith('Bridge ') ? value.slice(7) : ''
}

function languageForPath(path) {
  const extension = path.split('.').pop()?.toLowerCase()
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python' })[extension] || 'plaintext'
}
