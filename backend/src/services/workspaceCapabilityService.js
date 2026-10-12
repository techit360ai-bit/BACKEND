import crypto from 'node:crypto'
import { createId, nowIso } from '../utils/api.js'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import {
  workspaceCapabilityEnabled,
  workspaceAccess,
  findById,
  findByWorkspace,
  listByOwner,
  findByField,
  insert,
  save,
  remove,
} from '../repositories/workspaceCapabilityRepository.js'

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
const newestByCreated = rows => [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null

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

function previewUsable(preview) { return preview && new Date(preview.expiresAt).getTime() > Date.now() ? preview : null }

export async function getBuildContext(userId, workspaceId) {
  if (workspaceCapabilityEnabled()) {
    const access = await workspaceAccess(workspaceId, userId)
    if (!access) return null
    const profile = (await findByWorkspace('workspaceBuildProfiles', workspaceId))[0] || null
    const estimate = newestByCreated(await findByWorkspace('workspaceCostEstimates', workspaceId))
    const preview = newestByCreated(await findByWorkspace('workspacePreviewContexts', workspaceId))
    return { workspaceId, projectId: access.workspace.projectId || null, buildProfile: profile, costEstimate: estimate, preview: previewUsable(preview) }
  }
  const db = readAuthorityDb(); const access = workspaceFor(db, workspaceId, userId)
  if (!access) return null
  const profile = collection(db, 'workspaceBuildProfiles').find(row => row.workspaceId === workspaceId) || null
  const estimate = collection(db, 'workspaceCostEstimates').filter(row => row.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  const preview = collection(db, 'workspacePreviewContexts').filter(row => row.workspaceId === workspaceId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  return { workspaceId, projectId: access.workspace.projectId || null, buildProfile: profile, costEstimate: estimate, preview: previewUsable(preview) }
}

function buildPathProfile(current, buildPath, workspaceId, access, userId, body) {
  return { ...(current || { id: createId('build_profile'), workspaceId, projectId: access.workspace.projectId || null, createdAt: nowIso() }), buildPath, lifecycleView: buildPath, scope: clean(body.scope), sourceAnalysisId: body.sourceAnalysisId || null, validationSnapshotId: body.validationSnapshotId || null, status: 'active', selectedBy: userId, selectedAt: nowIso(), updatedAt: nowIso() }
}
function newEstimate(workspaceId, buildPath, body, userId) {
  return { id: createId('estimate'), workspaceId, ...estimateFor(buildPath, body), createdBy: userId, createdAt: nowIso(), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
}

export async function chooseBuildPath(userId, workspaceId, body = {}) {
  if (workspaceCapabilityEnabled()) {
    const access = await workspaceAccess(workspaceId, userId); if (!access) return { ok: false, status: 404, error: 'workspace_not_found' }
    const buildPath = body.buildPath === 'mvp' ? 'mvp' : body.buildPath === 'prototype' ? 'prototype' : null
    if (!buildPath) return { ok: false, status: 400, error: 'build_path_invalid' }
    const current = (await findByWorkspace('workspaceBuildProfiles', workspaceId))[0] || null
    const previous = current ? { buildPath: current.buildPath, lifecycleView: current.lifecycleView } : null
    const next = buildPathProfile(current, buildPath, workspaceId, access, userId, body)
    await save('workspaceBuildProfiles', next)
    const estimate = newEstimate(workspaceId, buildPath, body, userId)
    await insert('workspaceCostEstimates', estimate)
    await insert('workspaceLifecycleEvents', { id: createId('workspace_event'), workspaceId, actorId: userId, previous, next: { buildPath, lifecycleView: buildPath }, metadata: { event: 'workspace.build_path.choose' }, createdAt: nowIso() })
    return { ok: true, buildProfile: next, costEstimate: estimate }
  }
  return updateAuthorityDb(db => {
    const access = workspaceFor(db, workspaceId, userId); if (!access) return { ok: false, status: 404, error: 'workspace_not_found' }
    const buildPath = body.buildPath === 'mvp' ? 'mvp' : body.buildPath === 'prototype' ? 'prototype' : null
    if (!buildPath) return { ok: false, status: 400, error: 'build_path_invalid' }
    const profiles = collection(db, 'workspaceBuildProfiles'); const current = profiles.find(row => row.workspaceId === workspaceId)
    const previous = current ? { buildPath: current.buildPath, lifecycleView: current.lifecycleView } : null
    const next = buildPathProfile(current, buildPath, workspaceId, access, userId, body)
    if (current) Object.assign(current, next); else profiles.push(next)
    const estimate = newEstimate(workspaceId, buildPath, body, userId)
    collection(db, 'workspaceCostEstimates').push(estimate); appendLifecycle(db, workspaceId, userId, previous, { buildPath, lifecycleView: buildPath }, { event: 'workspace.build_path.choose' })
    return { ok: true, buildProfile: next, costEstimate: estimate }
  })
}

export async function createCostEstimate(userId, workspaceId, body = {}) {
  if (workspaceCapabilityEnabled()) {
    if (!await workspaceAccess(workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }
    const path = body.buildPath === 'mvp' ? 'mvp' : 'prototype'
    const estimate = { id: createId('estimate'), workspaceId, ...estimateFor(path, body), createdBy: userId, createdAt: nowIso(), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
    await insert('workspaceCostEstimates', estimate)
    return { ok: true, costEstimate: estimate }
  }
  return updateAuthorityDb(db => {
    if (!workspaceFor(db, workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }
    const path = body.buildPath === 'mvp' ? 'mvp' : 'prototype'; const estimate = { id: createId('estimate'), workspaceId, ...estimateFor(path, body), createdBy: userId, createdAt: nowIso(), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
    collection(db, 'workspaceCostEstimates').push(estimate); return { ok: true, costEstimate: estimate }
  })
}

export async function setLifecycleView(userId, workspaceId, view) {
  const allowed = new Set(['standard', 'prototype', 'mvp', 'hackathon', 'venture'])
  if (workspaceCapabilityEnabled()) {
    const access = await workspaceAccess(workspaceId, userId); if (!access) return { ok: false, status: 404, error: 'workspace_not_found' }
    if (!allowed.has(view)) return { ok: false, status: 400, error: 'lifecycle_view_invalid' }
    const current = (await findByWorkspace('workspaceBuildProfiles', workspaceId))[0] || null
    const profile = current || { id: createId('build_profile'), workspaceId, projectId: access.workspace.projectId || null, createdAt: nowIso() }
    const previous = profile.lifecycleView || 'standard'; profile.lifecycleView = view; profile.updatedAt = nowIso()
    await save('workspaceBuildProfiles', profile)
    await insert('workspaceLifecycleEvents', { id: createId('workspace_event'), workspaceId, actorId: userId, previous: { lifecycleView: previous }, next: { lifecycleView: view }, metadata: { event: 'workspace.lifecycle.view' }, createdAt: nowIso() })
    return { ok: true, buildProfile: profile }
  }
  return updateAuthorityDb(db => {
    const access = workspaceFor(db, workspaceId, userId); if (!access) return { ok: false, status: 404, error: 'workspace_not_found' }
    if (!allowed.has(view)) return { ok: false, status: 400, error: 'lifecycle_view_invalid' }
    const profile = collection(db, 'workspaceBuildProfiles').find(row => row.workspaceId === workspaceId) || { id: createId('build_profile'), workspaceId, projectId: access.workspace.projectId || null, createdAt: nowIso() }
    const previous = profile.lifecycleView || 'standard'; profile.lifecycleView = view; profile.updatedAt = nowIso(); if (!collection(db, 'workspaceBuildProfiles').some(row => row.workspaceId === workspaceId)) collection(db, 'workspaceBuildProfiles').push(profile)
    appendLifecycle(db, workspaceId, userId, { lifecycleView: previous }, { lifecycleView: view }, { event: 'workspace.lifecycle.view' }); return { ok: true, buildProfile: profile }
  })
}

export async function createPreviewContext(userId, workspaceId, body = {}) {
  if (workspaceCapabilityEnabled()) {
    if (!await workspaceAccess(workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }
    const createdAt = nowIso(); const preview = { id: createId('preview'), workspaceId, runId: body.runId || null, url: typeof body.url === 'string' ? body.url.slice(0, 2000) : null, status: 'active', createdAt, renewedAt: createdAt, expiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString() }
    await insert('workspacePreviewContexts', preview)
    return { ok: true, preview }
  }
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

/** Shared at-rest sealing for provider credentials (same key material as BYOK connections). */
export function sealSecret(value) { return encryptSecret(value) }
export function openSecret(payload) {
  const secret = keyMaterial(); if (secret.length < 16) throw new Error('byok_encryption_key_not_configured')
  const [iv, tag, body] = String(payload || '').split('.')
  if (!iv || !tag || !body) throw new Error('sealed_secret_malformed')
  const key = crypto.createHash('sha256').update(secret).digest(); const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url')); decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
}
const publicConnection = row => ({ id: row.id, provider: row.provider, displayName: row.displayName, modelAllowList: row.modelAllowList || [], status: row.status, maskedIdentifier: row.maskedIdentifier, lastHealthCheck: row.lastHealthCheck || null, createdAt: row.createdAt, updatedAt: row.updatedAt })

export async function listModelConnections(userId) {
  const rows = workspaceCapabilityEnabled()
    ? await listByOwner('userModelConnections', userId, ['userId'])
    : collection(readAuthorityDb(), 'userModelConnections').filter(row => row.userId === userId)
  return rows.map(publicConnection)
}

export async function createModelConnection(userId, body = {}) {
  const key = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''; if (!key) return { ok: false, status: 400, error: 'api_key_required' }
  const provider = String(body.provider || 'custom').slice(0, 80); const row = { id: createId('model_connection'), userId, provider, displayName: String(body.displayName || provider).slice(0, 120), endpoint: String(body.endpoint || '').slice(0, 500) || null, modelAllowList: Array.isArray(body.modelAllowList) ? body.modelAllowList.slice(0, 50).map(String) : [], maskedIdentifier: `${key.slice(0, 4)}...${key.slice(-4)}`, encryptedSecret: encryptSecret(key), status: 'active', createdAt: nowIso(), updatedAt: nowIso(), lastHealthCheck: null }
  if (workspaceCapabilityEnabled()) { await insert('userModelConnections', row); return { ok: true, connection: publicConnection(row) } }
  return updateAuthorityDb(db => { collection(db, 'userModelConnections').push(row); return { ok: true, connection: publicConnection(row) } })
}

export async function revokeModelConnection(userId, id) {
  if (workspaceCapabilityEnabled()) {
    const conn = await findById('userModelConnections', id)
    if (!conn || conn.userId !== userId) return { ok: false, status: 404, error: 'connection_not_found' }
    const row = { ...conn, status: 'revoked', encryptedSecret: null, updatedAt: nowIso() }
    await save('userModelConnections', row)
    return { ok: true, connection: publicConnection(row) }
  }
  return updateAuthorityDb(db => { const row = collection(db, 'userModelConnections').find(item => item.id === id && item.userId === userId); if (!row) return { ok: false, status: 404, error: 'connection_not_found' }; row.status = 'revoked'; row.encryptedSecret = null; row.updatedAt = nowIso(); return { ok: true, connection: publicConnection(row) } })
}

export async function listWorkspaceModels(userId, workspaceId) {
  if (workspaceCapabilityEnabled()) {
    if (!await workspaceAccess(workspaceId, userId)) return null
    const bindings = (await findByWorkspace('workspaceModelBindings', workspaceId)).filter(row => row.userId === userId)
    const connections = await listByOwner('userModelConnections', userId, ['userId'])
    return bindings.map(row => ({ ...row, connection: publicConnection(connections.find(c => c.id === row.connectionId) || {}) }))
  }
  const db = readAuthorityDb(); if (!workspaceFor(db, workspaceId, userId)) return null; return collection(db, 'workspaceModelBindings').filter(row => row.workspaceId === workspaceId && row.userId === userId).map(row => ({ ...row, connection: publicConnection(collection(db, 'userModelConnections').find(c => c.id === row.connectionId) || {}) }))
}

export async function bindWorkspaceModel(userId, workspaceId, body = {}) {
  if (workspaceCapabilityEnabled()) {
    if (!await workspaceAccess(workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }
    const connection = await findById('userModelConnections', body.connectionId)
    if (!connection || connection.userId !== userId || connection.status !== 'active') return { ok: false, status: 404, error: 'connection_not_found' }
    const row = { id: createId('model_binding'), workspaceId, userId, connectionId: connection.id, modelId: String(body.modelId || connection.modelAllowList?.[0] || '').slice(0, 120), operations: Array.isArray(body.operations) ? body.operations : ['plan', 'chat', 'propose', 'review', 'scaffold'], fallback: body.fallback === true, status: 'active', createdAt: nowIso(), updatedAt: nowIso() }
    await insert('workspaceModelBindings', row)
    return { ok: true, binding: row }
  }
  return updateAuthorityDb(db => { if (!workspaceFor(db, workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }; const connection = collection(db, 'userModelConnections').find(row => row.id === body.connectionId && row.userId === userId && row.status === 'active'); if (!connection) return { ok: false, status: 404, error: 'connection_not_found' }; const row = { id: createId('model_binding'), workspaceId, userId, connectionId: connection.id, modelId: String(body.modelId || connection.modelAllowList?.[0] || '').slice(0, 120), operations: Array.isArray(body.operations) ? body.operations : ['plan', 'chat', 'propose', 'review', 'scaffold'], fallback: body.fallback === true, status: 'active', createdAt: nowIso(), updatedAt: nowIso() }; collection(db, 'workspaceModelBindings').push(row); return { ok: true, binding: row } })
}

export async function unbindWorkspaceModel(userId, workspaceId, bindingId) {
  if (workspaceCapabilityEnabled()) {
    if (!await workspaceAccess(workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }
    const binding = await findById('workspaceModelBindings', bindingId)
    if (!binding || binding.workspaceId !== workspaceId || binding.userId !== userId) return { ok: false, status: 404, error: 'binding_not_found' }
    await remove('workspaceModelBindings', bindingId)
    return { ok: true, binding }
  }
  return updateAuthorityDb(db => {
    if (!workspaceFor(db, workspaceId, userId)) return { ok: false, status: 404, error: 'workspace_not_found' }
    const list = collection(db, 'workspaceModelBindings')
    const index = list.findIndex(row => row.id === bindingId && row.workspaceId === workspaceId && row.userId === userId)
    if (index === -1) return { ok: false, status: 404, error: 'binding_not_found' }
    const [removed] = list.splice(index, 1)
    return { ok: true, binding: removed }
  })
}

export async function attachHackathonProject(userId, hackathonId, teamId, body = {}) {
  const teamOf = team => team && team.hackathonId === hackathonId && (team.leaderId === userId || team.ownerId === userId) ? team : null
  if (workspaceCapabilityEnabled()) {
    const team = teamOf(await findById('hackathonTeams', teamId)); if (!team) return { ok: false, status: 404, error: 'team_not_found' }
    const project = await findById('projects', body.projectId); if (!project || (project.ownerId !== userId && project.userId !== userId)) return { ok: false, status: 404, error: 'project_not_found' }
    const workspace = await findById('workspaces', body.workspaceId || team.workspaceId); if (!workspace || workspace.projectId !== project.id) return { ok: false, status: 404, error: 'workspace_not_found' }
    const entries = await findByField('hackathonProjectEntries', 'hackathonId', hackathonId)
    const existing = entries.find(row => row.teamId === teamId); if (existing) return { ok: true, entry: existing }
    const entry = { id: createId('hackathon_entry'), hackathonId, teamId, projectId: project.id, workspaceId: workspace.id, entryMode: 'attached', visibility: 'private', judgeAccess: clean(body.judgeAccess), consent: body.consent === true, status: 'pending_review', createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
    await insert('hackathonProjectEntries', entry)
    await insert('hackathonTeamWorkspaces', { id: createId('teamws'), hackathonId, teamId, projectId: project.id, workspaceId: workspace.id, entryMode: 'attached', ownerId: userId, createdAt: nowIso(), updatedAt: nowIso() })
    await save('hackathonTeams', { ...team, projectId: project.id, workspaceId: workspace.id, hasWorkspace: true, updatedAt: nowIso() })
    return { ok: true, entry }
  }
  return updateAuthorityDb(db => {
    const team = collection(db, 'hackathonTeams').find(row => row.id === teamId && row.hackathonId === hackathonId && (row.leaderId === userId || row.ownerId === userId)); if (!team) return { ok: false, status: 404, error: 'team_not_found' }
    const project = collection(db, 'projects').find(row => row.id === body.projectId && (row.ownerId === userId || row.userId === userId)); if (!project) return { ok: false, status: 404, error: 'project_not_found' }
    const workspace = collection(db, 'workspaces').find(row => row.id === (body.workspaceId || team.workspaceId) && row.projectId === project.id); if (!workspace) return { ok: false, status: 404, error: 'workspace_not_found' }
    const existing = collection(db, 'hackathonProjectEntries').find(row => row.hackathonId === hackathonId && row.teamId === teamId); if (existing) return { ok: true, entry: existing }
    const entry = { id: createId('hackathon_entry'), hackathonId, teamId, projectId: project.id, workspaceId: workspace.id, entryMode: 'attached', visibility: 'private', judgeAccess: clean(body.judgeAccess), consent: body.consent === true, status: 'pending_review', createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }; collection(db, 'hackathonProjectEntries').push(entry); collection(db, 'hackathonTeamWorkspaces').push({ id: createId('teamws'), hackathonId, teamId, projectId: project.id, workspaceId: workspace.id, entryMode: 'attached', ownerId: userId, createdAt: nowIso(), updatedAt: nowIso() }); team.projectId = project.id; team.workspaceId = workspace.id; team.hasWorkspace = true; return { ok: true, entry }
  })
}

export async function getHackathonProjectEntry(userId, hackathonId, teamId) {
  const teamOf = team => team && team.hackathonId === hackathonId && (team.leaderId === userId || team.ownerId === userId) ? team : null
  if (workspaceCapabilityEnabled()) {
    if (!teamOf(await findById('hackathonTeams', teamId))) return null
    return (await findByField('hackathonProjectEntries', 'hackathonId', hackathonId)).find(row => row.teamId === teamId) || null
  }
  const db = readAuthorityDb(); const team = collection(db, 'hackathonTeams').find(row => row.id === teamId && row.hackathonId === hackathonId && (row.leaderId === userId || row.ownerId === userId)); if (!team) return null; return collection(db, 'hackathonProjectEntries').find(row => row.hackathonId === hackathonId && row.teamId === teamId) || null
}

export { EDIT_WINDOW_MS }
