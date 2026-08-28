import crypto from 'node:crypto'
import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { appendCodeEvent, codeWorkspaceAccess, safeCodePath } from './codeWorkspaceService.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex')

function sessionFor(db, rawToken, workspaceId) {
  const tokenHash = hash(rawToken || '')
  return rows(db, 'codeBridgeSessions').find(row => row.tokenHash === tokenHash && row.workspaceId === workspaceId && row.status === 'active' && Date.parse(row.expiresAt) > Date.now()) || null
}

export function exchangeCodeBridgeGrant(body = {}) {
  const rawGrant = String(body.grant || '')
  if (!rawGrant) return { ok: false, status: 400, error: 'bridge_grant_required' }
  return updateDb(db => {
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
  const db = readDb(); const session = sessionFor(db, rawToken, workspaceId)
  if (!session || !session.permissions.includes('files.read')) return { ok: false, status: 401, error: 'bridge_session_invalid' }
  const files = rows(db, 'projectFiles').filter(row => row.workspaceId === workspaceId && !row.deleted).map(row => ({ path: row.path, content: row.content, version: row.version, contentHash: row.contentHash }))
  return { ok: true, workspaceId, projectId: session.projectId, files, snapshotHash: hash(files.map(row => `${row.path}:${row.contentHash}`).sort().join('|')) }
}

export function syncCodeBridgeFiles(rawToken, workspaceId, body = {}) {
  const changes = Array.isArray(body.changes) ? body.changes.slice(0, 100) : []
  return updateDb(db => {
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
  return updateDb(db => {
    const auth = codeWorkspaceAccess(db, userId, workspaceId, true); if (!auth) return { ok: false, status: 403, error: 'workspace_write_denied' }
    let revoked = 0
    for (const row of rows(db, 'codeBridgeSessions')) if (row.workspaceId === workspaceId && row.userId === userId && row.status === 'active') { row.status = 'revoked'; row.revokedAt = nowIso(); revoked += 1 }
    appendCodeEvent(db, { workspaceId, projectId: auth.workspace.projectId, actorId: userId, type: 'bridge_sessions_revoked', metadata: { revoked } })
    return { ok: true, revoked }
  })
}

export function bridgeTokenFromRequest(req) {
  const value = String(req.headers.authorization || '')
  return value.startsWith('Bridge ') ? value.slice(7) : ''
}

function languageForPath(path) {
  const extension = path.split('.').pop()?.toLowerCase()
  return ({ ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python' })[extension] || 'plaintext'
}
