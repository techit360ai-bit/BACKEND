import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { readDb as readAuthorityDb, writeDb as writeAuthorityDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { addVerifiedSkill, appendTrustProof } from '../services/trustVerificationAuthority.js'
import { GITHUB_OAUTH_SCOPES, hasScopes, parseGrantedScopes } from '../config/github.js'

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
  // `purpose` records which surface started the flow. Both surfaces share this
  // one array and this one callback, so without it the callback cannot tell a
  // connect attempt from a trust attempt and must guess at what to enrich.
  db.githubOauthStates.push({ state, userId: req.user.id, createdAt: nowIso(), purpose: 'connect' })
  writeAuthorityDb(db)

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    // Shared with the trust surface (services/trustVerificationAuthority.js).
    // They previously requested different scopes against this same callback,
    // so entering via trust granted no `repo` and the language enrichment
    // silently recorded nothing.
    scope: GITHUB_OAUTH_SCOPES,
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

    // Record what GitHub ACTUALLY granted, not what we asked for. GitHub
    // returns the intersection of the request and the OAuth app's configured
    // scopes, so a partial grant is always possible. Previously neither this
    // callback nor githubStatus stored it, which is why a `repo`-less token
    // degraded into `languages = []` and zero verified skills with no
    // indication that anything had gone wrong.
    const scopes = parseGrantedScopes(tokenData.scope)
    const canReadRepos = hasScopes(scopes, ['repo'])
    let repos = []
    if (canReadRepos) {
      const reposRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' } })
      repos = reposRes.ok ? await reposRes.json().catch(() => []) : []
    }
    const languages = [...new Set((Array.isArray(repos) ? repos : []).map(repo => repo.language).filter(Boolean))].slice(0, 20)

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
      scopes,
      // True when we could not read repos because `repo` was not granted. The
      // proof is still valid — it is built from /user — but it carries no
      // language evidence, and that distinction is now visible.
      repoEnrichmentSkipped: !canReadRepos,
      connectedVia: stateEntry.purpose || 'connect',
      connectedAt: nowIso(),
    }
    if (!db.githubConnections) db.githubConnections = []
    db.githubConnections = db.githubConnections.filter(c => c.userId !== stateEntry.userId)
    db.githubConnections.push(connection)
    writeAuthorityDb(db)
    const proof = appendTrustProof(stateEntry.userId, { source: 'github', method: 'github_oauth', status: 'verified', providerSubjectId: String(githubUser.id || githubUser.node_id || githubUser.login || ''), confidence: 0.98, metadata: { providerSubjectId: String(githubUser.id || githubUser.node_id || ''), username: githubUser.login || '', profileUrl: githubUser.html_url || '', repoCount: Number(githubUser.public_repos || 0), languages, sourceProjectId: null, scopes, repoEnrichmentSkipped: !canReadRepos } })
    for (const language of languages) addVerifiedSkill(stateEntry.userId, { skill: language, source: 'github', proofId: proof.proof?.id, confidence: 0.82 })

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
        const proof = appendTrustProof(stateEntry.userId, { source: 'github', method: 'github_oauth_test', status: 'verified', providerSubjectId: 'test-user', confidence: 0.5, metadata: { providerSubjectId: 'test-user', username: 'test-user', repoCount: 2, languages: ['TypeScript', 'Python'] } })
        for (const language of ['TypeScript', 'Python']) addVerifiedSkill(stateEntry.userId, { skill: language, source: 'github', proofId: proof.proof?.id, confidence: 0.6 })
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
  const grantedScopes = connection.scopes || []
  return res.json({
    connected: true,
    username: connection.username,
    avatarUrl: connection.avatarUrl,
    profileUrl: connection.profileUrl,
    repoCount: connection.repoCount,
    connectedAt: connection.connectedAt,
    // Enough for a caller to tell a healthy connection from a scope-starved
    // one, which previously looked identical from the outside.
    scopes: grantedScopes,
    repoAccess: grantedScopes.length === 0 ? 'unknown' : (grantedScopes.includes('repo') ? 'granted' : 'missing'),
    repoEnrichmentSkipped: Boolean(connection.repoEnrichmentSkipped),
    connectedVia: connection.connectedVia || null,
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
