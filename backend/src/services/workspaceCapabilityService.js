import crypto from 'node:crypto'
import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'

const EDIT_WINDOW_MS = 15 * 60 * 1000
const PREVIEW_TTL_MS = 30 * 60 * 1000
const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const clean = value => (value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) : {})
const workspaceFor = (db, workspaceId, userId) => {
  const workspace = collection(db, 'workspaces').find(row => row.id === workspaceId)
  if (!workspace) return null
  const owner = workspace.ownerId === userId
  const member = collection(db, 'workspaceMembers').find(row => row.workspaceId === workspaceId && row.userId === userId && row.status === 'active')
  return owner || member ? { workspace, owner, member } : null
}
const appendLifecycle = (db, workspaceId, actorId, previous, next, metadata = {}) => {
  collection(db, 'workspaceLifecycleEvents').push({ id: createId('workspace_event'), workspaceId, actorId, previous, next, metadata: clean(metadata), createdAt: nowIso() })
}

function estimateFor(path, profile = {}) {
  const buildPath = path === 'mvp' ? 'mvp' : 'prototype'
  const operations = buildPath === 'mvp' ? 24 : 8
  const runtimeMinutes = buildPath === 'mvp' ? 45 : 15
  const estimatedCredits = buildPath === 'mvp' ? 120 : 35
  const subscriptionAllowance = Number(profile.subscriptionAllowance || profile.allowance || 0)
  const creditBalance = Number(profile.creditBalance || profile.credits || 0)
  return {
    buildPath, operations, estimatedCredits, runtimeMinutes,
    subscriptionAllowance, creditBalance,
    subscriptionCreditsUsed: Math.min(subscriptionAllowance, estimatedCredits),
    creditsToConsume: Math.max(0, estimatedCredits - subscriptionAllowance),
    projectedCreditBalance: Math.max(0, creditBalance - Math.max(0, estimatedCredits - subscriptionAllowance)),
    confidence: buildPath === 'mvp' ? 'medium' : 'low',
    assumptions: buildPath === 'mvp'
      ? ['bounded MVP scope', 'reviewable code changes', 'tests and security scan', 'one deployment verification']
      : ['one narrow hypothesis', 'reviewable scaffold', 'local preview', 'one feedback iteration'],
    estimatorVersion: 'workspace-estimator-v1',
  }
}

export function getBuildContext(userId, workspaceId) {
  const db = readAuthorityDb(); const access = workspaceFor(db, workspaceId, userId)
  if (!access) return null
  const profile = collection(db, 'workspaceBuildProfiles').find(row => row.workspaceId === workspaceId) || null
  const estimate = collection(db, 'workspaceCostEstimates').filter(row => row.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  const preview = collection(db, 'workspacePreviewContexts').filter(row => row.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  return { workspaceId, projectId: access.workspace.projectId || null, buildProfile: profile, costEstimate: estimate, preview: preview && new Date(preview.expiresAt).getTime() > Date.now() ? preview : null }
}

export function chooseBuildPath(userId, workspaceId, body = {}) {
  return updateAuthorityDb(db => {
    const access = workspaceFor(db, workspaceId, userId); if (!access) return { ok: false, status: 404, error: 'workspace_not_found' }
    const buildPath = body.buildPath === 'mvp' ? 'mvp' : body.buildPath === 'prototype' ? 'prototype' : null
    if (!buildPath) return { ok: false, status: 400, error: 'build_path_invalid' }
    const profiles = collection(db, 'workspaceBuildProfiles'); const current = profiles.find(row => row.workspaceId === workspaceId)
    const previous = current ? { buildPath: current.buildPath, lifecycleView: current.lifecycleView } : null
    const next = { ...(current || { id: createId('build_profile'), workspaceId, projectId: access.workspace.projectId || null, createdAt: nowIso() }), buildPath, lifecycleView: buildPath, scope: clean(body.scope), sourceAnalysisId: body.sourceAnalysisId || null, validationSnapshotId: body.validationSnapshotId || null, status: 'active', selectedBy: userId, selectedAt: nowIso(), updatedAt: nowIso() }
    if (current) Object.assign(current, next); else profiles.push(next)
    const estimate = { id: createId('estimate'), workspaceId, ...estimateFor(buildPath, body), createdBy: userId, createdAt: nowIso(), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
    collection(db, 'workspaceCostEstimates').push(estimate); appendLifecycle(db, workspaceId, userId, previous, { buildPath, lifecycleView: buildPath }, { event: 'workspace.build_path.choose' })
    return { ok: true, buildProfile: next, costEstimate: estimate }
  })
}

export function createCostEstimate(userId, workspaceId, body = {}) {
  return updateAuthorityDb(db => {
    if (!workspaceFor(db, workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }
    const path = body.buildPath === 'mvp' ? 'mvp' : 'prototype'; const estimate = { id: createId('estimate'), workspaceId, ...estimateFor(path, body), createdBy: userId, createdAt: nowIso(), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
    collection(db, 'workspaceCostEstimates').push(estimate); return { ok: true, costEstimate: estimate }
  })
}

export function setLifecycleView(userId, workspaceId, view) {
  return updateAuthorityDb(db => {
    const access = workspaceFor(db, workspaceId, userId); if (!access) return { ok: false, status: 404, error: 'workspace_not_found' }
    const allowed = new Set(['standard', 'prototype', 'mvp', 'hackathon', 'venture']); if (!allowed.has(view)) return { ok: false, status: 400, error: 'lifecycle_view_invalid' }
    const profile = collection(db, 'workspaceBuildProfiles').find(row => row.workspaceId === workspaceId) || { id: createId('build_profile'), workspaceId, projectId: access.workspace.projectId || null, createdAt: nowIso() }
    const previous = profile.lifecycleView || 'standard'; profile.lifecycleView = view; profile.updatedAt = nowIso(); if (!collection(db, 'workspaceBuildProfiles').some(row => row.workspaceId === workspaceId)) collection(db, 'workspaceBuildProfiles').push(profile)
    appendLifecycle(db, workspaceId, userId, { lifecycleView: previous }, { lifecycleView: view }, { event: 'workspace.lifecycle.view' }); return { ok: true, buildProfile: profile }
  })
}

export function createPreviewContext(userId, workspaceId, body = {}) {
  return updateAuthorityDb(db => {
    if (!workspaceFor(db, workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }
    const createdAt = nowIso(); const preview = { id: createId('preview'), workspaceId, runId: body.runId || null, url: typeof body.url === 'string' ? body.url.slice(0, 2000) : null, status: 'active', createdAt, renewedAt: createdAt, expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString() }
    collection(db, 'workspacePreviewContexts').push(preview); return { ok: true, preview }
  })
}

function keyMaterial() { return process.env.BYOK_ENCRYPTION_KEY || process.env.JWT_SECRET || '' }
function encryptSecret(value) {
  const secret = keyMaterial(); if (secret.length < 16) throw new Error('byok_encryption_key_not_configured')
  const key = crypto.createHash('sha256').update(secret).digest(); const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`
}
const publicConnection = row => ({ id: row.id, provider: row.provider, displayName: row.displayName, modelAllowList: row.modelAllowList || [], status: row.status, maskedIdentifier: row.maskedIdentifier, lastHealthCheck: row.lastHealthCheck || null, createdAt: row.createdAt, updatedAt: row.updatedAt })

export function listModelConnections(userId) { return collection(readAuthorityDb(), 'userModelConnections').filter(row => row.userId === userId).map(publicConnection) }
export function createModelConnection(userId, body = {}) {
  return updateAuthorityDb(db => {
    const key = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''; if (!key) return { ok: false, status: 400, error: 'api_key_required' }
    const provider = String(body.provider || 'custom').slice(0, 80); const row = { id: createId('model_connection'), userId, provider, displayName: String(body.displayName || provider).slice(0, 120), endpoint: String(body.endpoint || '').slice(0, 500) || null, modelAllowList: Array.isArray(body.modelAllowList) ? body.modelAllowList.slice(0, 50).map(String) : [], maskedIdentifier: `${key.slice(0, 4)}...${key.slice(-4)}`, encryptedSecret: encryptSecret(key), status: 'active', createdAt: nowIso(), updatedAt: nowIso(), lastHealthCheck: null }
    collection(db, 'userModelConnections').push(row); return { ok: true, connection: publicConnection(row) }
  })
}
export function revokeModelConnection(userId, id) { return updateAuthorityDb(db => { const row = collection(db, 'userModelConnections').find(item => item.id === id && item.userId === userId); if (!row) return { ok: false, status: 404, error: 'connection_not_found' }; row.status = 'revoked'; row.encryptedSecret = null; row.updatedAt = nowIso(); return { ok: true, connection: publicConnection(row) } }) }
export function listWorkspaceModels(userId, workspaceId) { const db = readAuthorityDb(); if (!workspaceFor(db, workspaceId, userId)) return null; return collection(db, 'workspaceModelBindings').filter(row => row.workspaceId === workspaceId && row.userId === userId).map(row => ({ ...row, connection: publicConnection(collection(db, 'userModelConnections').find(c => c.id === row.connectionId) || {}) })) }
export function bindWorkspaceModel(userId, workspaceId, body = {}) { return updateAuthorityDb(db => { if (!workspaceFor(db, workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }; const connection = collection(db, 'userModelConnections').find(row => row.id === body.connectionId && row.userId === userId && row.status === 'active'); if (!connection) return { ok: false, status: 404, error: 'connection_not_found' }; const row = { id: createId('model_binding'), workspaceId, userId, connectionId: connection.id, modelId: String(body.modelId || connection.modelAllowList?.[0] || '').slice(0, 120), operations: Array.isArray(body.operations) ? body.operations : ['plan', 'chat', 'propose', 'review', 'scaffold'], fallback: body.fallback === true, status: 'active', createdAt: nowIso(), updatedAt: nowIso() }; collection(db, 'workspaceModelBindings').push(row); return { ok: true, binding: row } }) }

export function attachHackathonProject(userId, hackathonId, teamId, body = {}) {
  return updateAuthorityDb(db => {
    const team = collection(db, 'hackathonTeams').find(row => row.id === teamId && row.hackathonId === hackathonId && (row.leaderId === userId || row.ownerId === userId)); if (!team) return { ok: false, status: 404, error: 'team_not_found' }
    const project = collection(db, 'projects').find(row => row.id === body.projectId && (row.ownerId === userId || row.userId === userId)); if (!project) return { ok: false, status: 404, error: 'project_not_found' }
    const workspace = collection(db, 'workspaces').find(row => row.id === (body.workspaceId || team.workspaceId) && row.projectId === project.id); if (!workspace) return { ok: false, status: 404, error: 'workspace_not_found' }
    const existing = collection(db, 'hackathonProjectEntries').find(row => row.hackathonId === hackathonId && row.teamId === teamId); if (existing) return { ok: true, entry: existing }
    const entry = { id: createId('hackathon_entry'), hackathonId, teamId, projectId: project.id, workspaceId: workspace.id, entryMode: 'attached', visibility: 'private', judgeAccess: clean(body.judgeAccess), consent: body.consent === true, status: 'pending_review', createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }; collection(db, 'hackathonProjectEntries').push(entry); collection(db, 'hackathonTeamWorkspaces').push({ id: createId('teamws'), hackathonId, teamId, projectId: project.id, workspaceId: workspace.id, entryMode: 'attached', ownerId: userId, createdAt: nowIso(), updatedAt: nowIso() }); team.projectId = project.id; team.workspaceId = workspace.id; team.hasWorkspace = true; return { ok: true, entry }
  })
}
export function getHackathonProjectEntry(userId, hackathonId, teamId) { const db = readAuthorityDb(); const team = collection(db, 'hackathonTeams').find(row => row.id === teamId && row.hackathonId === hackathonId && (row.leaderId === userId || row.ownerId === userId)); if (!team) return null; return collection(db, 'hackathonProjectEntries').find(row => row.hackathonId === hackathonId && row.teamId === teamId) || null }

export { EDIT_WINDOW_MS }
