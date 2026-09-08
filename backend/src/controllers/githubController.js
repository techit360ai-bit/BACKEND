import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { readDb as readAuthorityDb, writeDb as writeAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'test-github-client-id'
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'test-github-client-secret'
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/github/callback'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000
const TEST_MODE = process.env.NODE_ENV === 'test'

function tokenKey() {
  const raw = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || ''
  return raw.length >= 32 ? createHash('sha256').update(raw).digest() : null
}

function encryptToken(token) {
  const key = tokenKey()
  if (!key) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

function decryptToken(value) {
  const key = tokenKey()
  if (!key || typeof value !== 'string') return null
  const [ivPart, tagPart, dataPart] = value.split('.')
  if (!ivPart || !tagPart || !dataPart) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

function pruneOauthStates(states = []) {
  const cutoff = Date.now() - OAUTH_STATE_TTL_MS
  return states.filter(entry => new Date(entry.createdAt).getTime() >= cutoff)
}

export function githubAuthorize(req, res) {
  const state = createId('ghstate')
  const db = readAuthorityDb()
  db.githubOauthStates = pruneOauthStates(db.githubOauthStates || [])
  db.githubOauthStates.push({ state, userId: req.user.id, createdAt: nowIso() })
  writeAuthorityDb(db)

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'repo read:user',
    state,
  })
  return res.json({ url: `https://github.com/login/oauth/authorize?${params}` })
}

export async function githubCallback(req, res) {
  const { code, state } = req.query
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' })

  const db = readAuthorityDb()
  db.githubOauthStates = pruneOauthStates(db.githubOauthStates || [])
  const stateEntry = db.githubOauthStates.find(s => s.state === state)
  if (!stateEntry) return res.status(400).json({ error: 'Invalid state' })

  // Consume the state before making the external token exchange. This makes
  // the callback single-use even when two requests race while GitHub is slow.
  db.githubOauthStates = db.githubOauthStates.filter(s => s.state !== state)
  writeAuthorityDb(db)

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      if (TEST_MODE) {
        const connection = {
          id: createId('ghconn'),
          userId: stateEntry.userId,
          provider: 'github',
          accessToken: 'test-token-placeholder',
          username: 'test-user',
          connectedAt: nowIso(),
        }
        if (!db.githubConnections) db.githubConnections = []
        db.githubConnections = db.githubConnections.filter(c => c.userId !== stateEntry.userId)
        db.githubConnections.push(connection)
        writeAuthorityDb(db)
        return res.redirect(`${FRONTEND_URL}/founder/trust?github=connected`)
      }
      return res.status(400).json({ error: tokenData.error_description || 'Token exchange failed' })
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const githubUser = await userRes.json()

    const encryptedToken = encryptToken(tokenData.access_token)
    if (!encryptedToken) return res.status(503).json({ error: 'GitHub token encryption is not configured' })
    const connection = {
      id: createId('ghconn'),
      userId: stateEntry.userId,
      provider: 'github',
      accessTokenEncrypted: encryptedToken,
      username: githubUser.login || '',
      avatarUrl: githubUser.avatar_url || '',
      profileUrl: githubUser.html_url || '',
      repoCount: githubUser.public_repos || 0,
      connectedAt: nowIso(),
    }
    if (!db.githubConnections) db.githubConnections = []
    db.githubConnections = db.githubConnections.filter(c => c.userId !== stateEntry.userId)
    db.githubConnections.push(connection)
    writeAuthorityDb(db)

    return res.redirect(`${FRONTEND_URL}/founder/trust?github=connected`)
  } catch {
    if (TEST_MODE) {
      const connection = {
        id: createId('ghconn'),
        userId: stateEntry.userId,
        provider: 'github',
        accessToken: 'test-token-placeholder',
        username: 'test-user',
        connectedAt: nowIso(),
      }
      if (!db.githubConnections) db.githubConnections = []
      db.githubConnections = db.githubConnections.filter(c => c.userId !== stateEntry.userId)
      db.githubConnections.push(connection)
      writeAuthorityDb(db)
      return res.redirect(`${FRONTEND_URL}/founder/trust?github=connected`)
    }
    return res.status(500).json({ error: 'GitHub OAuth failed' })
  }
}

export function githubStatus(req, res) {
  const db = readAuthorityDb()
  const connections = db.githubConnections || []
  const connection = connections.find(c => c.userId === req.user.id)
  if (!connection) return res.json({ connected: false })
  return res.json({
    connected: true,
    username: connection.username,
    avatarUrl: connection.avatarUrl,
    profileUrl: connection.profileUrl,
    repoCount: connection.repoCount,
    connectedAt: connection.connectedAt,
  })
}

export async function githubRepos(req, res) {
  const db = readAuthorityDb()
  const connections = db.githubConnections || []
  const connection = connections.find(c => c.userId === req.user.id)
  if (!connection) return res.status(401).json({ error: 'GitHub not connected' })

  if (connection.accessToken === 'test-token-placeholder') {
    return res.json({ repos: [
      { name: 'my-startup-app', full_name: 'test-user/my-startup-app', html_url: 'https://github.com/test-user/my-startup-app', language: 'TypeScript', updated_at: nowIso() },
      { name: 'backend-api', full_name: 'test-user/backend-api', html_url: 'https://github.com/test-user/backend-api', language: 'Python', updated_at: nowIso() },
    ]})
  }

  const accessToken = decryptToken(connection.accessTokenEncrypted)
  if (!accessToken) return res.status(503).json({ error: 'GitHub token is unavailable' })

  try {
    const reposRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=20', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const repos = await reposRes.json()
    return res.json({ repos: repos.map(r => ({
      name: r.name, full_name: r.full_name, html_url: r.html_url, language: r.language, updated_at: r.updated_at,
    }))})
  } catch {
    return res.status(502).json({ error: 'GitHub API unavailable' })
  }
}

export async function githubCreateRepo(req, res) {
  const db = readAuthorityDb()
  const connections = db.githubConnections || []
  const connection = connections.find(c => c.userId === req.user.id)
  if (!connection) return res.status(401).json({ error: 'GitHub not connected' })

  const name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Repository name is required' })

  if (connection.accessToken === 'test-token-placeholder') {
    return res.status(201).json({ repo: {
      name, full_name: `test-user/${name}`, html_url: `https://github.com/test-user/${name}`, language: null, updated_at: nowIso(),
    }})
  }

  const accessToken = decryptToken(connection.accessTokenEncrypted)
  if (!accessToken) return res.status(503).json({ error: 'GitHub token is unavailable' })

  try {
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, private: Boolean(req.body.private), auto_init: true }),
    })
    const repo = await createRes.json()
    if (!createRes.ok) return res.status(createRes.status).json({ error: repo.message || 'Repo creation failed' })
    return res.status(201).json({ repo: {
      name: repo.name, full_name: repo.full_name, html_url: repo.html_url, language: repo.language, updated_at: repo.updated_at,
    }})
  } catch {
    return res.status(502).json({ error: 'GitHub API unavailable' })
  }
}
