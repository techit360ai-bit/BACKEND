import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { exchangeGrant, hash, normalizeProjectPath, pullSnapshot, pushLocal, readLocalFiles, saveState, statePath } from '../src/bridge.mjs'

const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } })

test('blocks traversal, metadata, dependencies, and secret-like project paths', () => {
  for (const value of ['../x', '/etc/passwd', '.git/config', 'node_modules/a.js', '.env.local', 'keys/private-key.pem']) assert.equal(normalizeProjectPath(value), null)
  assert.equal(normalizeProjectPath('src/app.ts'), 'src/app.ts')
})

test('exchanges, pulls, persists owner-only state, and pushes versioned changes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'techit-bridge-root-'))
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'techit-bridge-home-'))
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init })
    if (url.endsWith('/exchange')) return json({ ok: true, session: { workspaceId: 'w1', projectId: 'p1', token: 'session', expiresAt: '2099-01-01T00:00:00.000Z' } })
    if (url.endsWith('/snapshot')) return json({ ok: true, snapshotHash: 'snap', files: [{ path: 'src/app.js', content: 'export const x = 1\n', contentHash: 'server-hash', version: 2 }] })
    if (url.endsWith('/sync')) return json({ ok: true, applied: [{ path: 'src/app.js', version: 3, contentHash: 'next-hash' }] })
    return json({ error: 'not found' }, 404)
  }
  const state = await exchangeGrant({ api: 'https://api.example', grant: 'grant', root, fetchImpl })
  await pullSnapshot(state, { fetchImpl })
  assert.equal((await fs.readFile(path.join(root, 'src/app.js'), 'utf8')), 'export const x = 1\n')
  const target = await saveState(state, home)
  assert.equal(target, statePath('w1', home))
  assert.equal((await fs.stat(target)).mode & 0o777, 0o600)
  await fs.writeFile(path.join(root, 'src/app.js'), 'export const x = 2\n')
  const pushed = await pushLocal(state, { fetchImpl })
  assert.equal(pushed.applied[0].version, 3)
  const syncBody = JSON.parse(calls.find(call => call.url.endsWith('/sync')).init.body)
  assert.equal(syncBody.changes[0].expectedVersion, 2)
})

test('never follows symlinks outside the selected project root', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'techit-bridge-root-'))
  const external = await fs.mkdtemp(path.join(os.tmpdir(), 'techit-bridge-external-'))
  await fs.writeFile(path.join(external, 'private.txt'), 'private')
  await fs.symlink(external, path.join(root, 'linked'))
  assert.deepEqual(await readLocalFiles(root), [])
})

test('pull applies remote deletions only when the local file is unchanged', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'techit-bridge-delete-'))
  await fs.writeFile(path.join(root, 'old.txt'), 'known')
  const state = { api: 'https://api.example', workspaceId: 'w1', projectId: 'p1', token: 'session', root, versions: { 'old.txt': 2 }, hashes: { 'old.txt': hash('known') } }
  const fetchImpl = async () => json({ ok: true, snapshotHash: 'next', files: [] })
  await pullSnapshot(state, { fetchImpl })
  await assert.rejects(fs.stat(path.join(root, 'old.txt')))
  await fs.writeFile(path.join(root, 'old.txt'), 'locally changed')
  state.versions['old.txt'] = 3; state.hashes['old.txt'] = 'different-known-hash'
  await assert.rejects(pullSnapshot(state, { fetchImpl }), /locally modified/)
})
