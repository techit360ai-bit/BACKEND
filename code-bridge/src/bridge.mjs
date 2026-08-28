import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const BLOCKED = /(^|\/)(\.git(?:\/|$)|\.techit(?:\/|$)|node_modules(?:\/|$)|\.ssh(?:\/|$)|\.env(?:$|\.)|secrets?(?:\/|$)|credentials?(?:\/|$)|[^/]*(?:credential|secret|private[-_]?key)[^/]*\.(?:json|pem|key|txt)$)/i
const MAX_FILE_BYTES = 1_000_000
const MAX_FILES = 5_000

export function normalizeProjectPath(value) {
  const normalized = String(value || '').trim().replaceAll('\\', '/').replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || normalized.includes('\0') || normalized.split('/').includes('..') || BLOCKED.test(normalized)) return null
  return normalized
}

export function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

export async function selectedRoot(root) {
  const resolved = await fs.realpath(path.resolve(root))
  const stat = await fs.stat(resolved)
  if (!stat.isDirectory()) throw new Error('Selected project root must be a directory.')
  return resolved
}

export function statePath(workspaceId, home = os.homedir()) {
  return path.join(home, '.techit', 'code-bridge', `${workspaceId}.json`)
}

export async function saveState(state, home) {
  const target = statePath(state.workspaceId, home)
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 })
  const temporary = `${target}.${process.pid}.tmp`
  await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  await fs.chmod(temporary, 0o600)
  await fs.rename(temporary, target)
  return target
}

export async function loadState(workspaceId, home) {
  const raw = await fs.readFile(statePath(workspaceId, home), 'utf8')
  const state = JSON.parse(raw)
  if (!state?.api || !state?.token || state.workspaceId !== workspaceId || !state.root) throw new Error('Bridge state is invalid. Reconnect this Workspace.')
  state.root = await selectedRoot(state.root)
  return state
}

async function requestJson(url, init = {}, fetchImpl = fetch) {
  const response = await fetchImpl(url, { ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.error || `TechIT bridge request failed (${response.status}).`)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

export async function exchangeGrant({ api, grant, root, deviceName = os.hostname(), fetchImpl = fetch }) {
  const selected = await selectedRoot(root)
  const payload = await requestJson(`${api.replace(/\/$/, '')}/api/code/bridge/exchange`, {
    method: 'POST', body: JSON.stringify({ grant, deviceName, rootFingerprint: hash(selected) }),
  }, fetchImpl)
  const state = { api: api.replace(/\/$/, ''), workspaceId: payload.session.workspaceId, projectId: payload.session.projectId, token: payload.session.token, expiresAt: payload.session.expiresAt, root: selected, versions: {}, hashes: {} }
  return state
}

export async function fetchSnapshot(state, fetchImpl = fetch) {
  return requestJson(`${state.api}/api/code/bridge/${encodeURIComponent(state.workspaceId)}/snapshot`, { headers: { authorization: `Bridge ${state.token}` } }, fetchImpl)
}

async function walk(root, directory = root, output = []) {
  if (output.length >= MAX_FILES) throw new Error(`Project exceeds the ${MAX_FILES} file bridge limit.`)
  const entries = await fs.readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    const relative = path.relative(root, absolute).split(path.sep).join('/')
    if (!normalizeProjectPath(relative)) continue
    if (entry.isSymbolicLink()) continue
    if (entry.isDirectory()) await walk(root, absolute, output)
    else if (entry.isFile()) {
      const stat = await fs.stat(absolute)
      if (stat.size <= MAX_FILE_BYTES) output.push(relative)
    }
  }
  return output
}

export async function readLocalFiles(root) {
  const selected = await selectedRoot(root)
  const files = []
  for (const relative of await walk(selected)) {
    const content = await fs.readFile(path.join(selected, relative), 'utf8').catch(() => null)
    if (content !== null) files.push({ path: relative, content, contentHash: hash(content) })
  }
  return files
}

async function targetPath(root, relative) {
  const safe = normalizeProjectPath(relative)
  if (!safe) throw new Error(`Unsafe project path: ${relative}`)
  const target = path.resolve(root, safe)
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error(`Project path escapes selected root: ${relative}`)
  return target
}

export async function pullSnapshot(state, { force = false, fetchImpl = fetch } = {}) {
  const snapshot = await fetchSnapshot(state, fetchImpl)
  const local = new Map((await readLocalFiles(state.root)).map(file => [file.path, file]))
  const remotePaths = new Set(snapshot.files.map(file => file.path))
  const conflicts = snapshot.files.filter(file => local.has(file.path) && local.get(file.path).contentHash !== file.contentHash && state.hashes?.[file.path] !== local.get(file.path).contentHash)
  for (const filePath of Object.keys(state.versions || {})) {
    const localFile = local.get(filePath)
    if (!remotePaths.has(filePath) && localFile && localFile.contentHash !== state.hashes?.[filePath]) conflicts.push({ path: filePath, deleted: true })
  }
  if (conflicts.length && !force) throw new Error(`Pull would overwrite ${conflicts.length} locally modified file(s): ${conflicts.map(row => row.path).slice(0, 5).join(', ')}`)
  for (const filePath of Object.keys(state.versions || {})) {
    if (remotePaths.has(filePath)) continue
    const target = await targetPath(state.root, filePath)
    await fs.unlink(target).catch(error => { if (error?.code !== 'ENOENT') throw error })
  }
  for (const file of snapshot.files) {
    const target = await targetPath(state.root, file.path)
    await fs.mkdir(path.dirname(target), { recursive: true })
    const temporary = `${target}.${process.pid}.techit-tmp`
    await fs.writeFile(temporary, file.content, { mode: 0o600 })
    await fs.rename(temporary, target)
  }
  state.versions = Object.fromEntries(snapshot.files.map(file => [file.path, file.version]))
  state.hashes = Object.fromEntries(snapshot.files.map(file => [file.path, file.contentHash]))
  state.lastSnapshotHash = snapshot.snapshotHash
  state.lastPulledAt = new Date().toISOString()
  return { state, files: snapshot.files.length, conflicts: conflicts.map(row => row.path) }
}

export async function pushLocal(state, { fetchImpl = fetch } = {}) {
  const files = await readLocalFiles(state.root)
  const local = new Map(files.map(file => [file.path, file]))
  const known = new Set([...Object.keys(state.versions || {}), ...local.keys()])
  const changes = []
  for (const filePath of known) {
    const file = local.get(filePath)
    if (file && file.contentHash !== state.hashes?.[filePath]) changes.push({ path: filePath, content: file.content, expectedVersion: Number(state.versions?.[filePath] || 0) })
    if (!file && state.versions?.[filePath]) changes.push({ path: filePath, delete: true, expectedVersion: Number(state.versions[filePath]) })
  }
  if (!changes.length) return { state, applied: [] }
  const applied = []
  for (let index = 0; index < changes.length; index += 100) {
    const payload = await requestJson(`${state.api}/api/code/bridge/${encodeURIComponent(state.workspaceId)}/sync`, { method: 'POST', headers: { authorization: `Bridge ${state.token}` }, body: JSON.stringify({ changes: changes.slice(index, index + 100) }) }, fetchImpl)
    applied.push(...payload.applied)
  }
  for (const row of applied) {
    if (row.deleted) { delete state.versions[row.path]; delete state.hashes[row.path] }
    else { state.versions[row.path] = row.version; state.hashes[row.path] = row.contentHash }
  }
  state.lastPushedAt = new Date().toISOString()
  return { state, applied }
}

export function openInVSCode(root, spawnImpl = spawn) {
  const child = spawnImpl('code', [root], { detached: true, stdio: 'ignore', shell: false })
  child.unref()
  return child
}

export async function startLoopbackBridge({ state, key = crypto.randomBytes(24).toString('base64url'), host = '127.0.0.1', port = 0, fetchImpl = fetch, home }) {
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)) }
    if (req.headers['x-techit-bridge-key'] !== key) return send(401, { ok: false, error: 'bridge_key_invalid' })
    try {
      if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, workspaceId: state.workspaceId, expiresAt: state.expiresAt })
      if (req.method === 'POST' && req.url === '/pull') { const result = await pullSnapshot(state, { fetchImpl }); await saveState(state, home); return send(200, { ok: true, ...result, state: undefined }) }
      if (req.method === 'POST' && req.url === '/push') { const result = await pushLocal(state, { fetchImpl }); await saveState(state, home); return send(200, { ok: true, applied: result.applied }) }
      return send(404, { ok: false, error: 'bridge_route_not_found' })
    } catch (error) { return send(error?.status || 500, { ok: false, error: error instanceof Error ? error.message : 'bridge_operation_failed' }) }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve) })
  const address = server.address()
  return { server, key, url: `http://${host}:${address.port}` }
}
