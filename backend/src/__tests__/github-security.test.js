import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(),
  writeDb: vi.fn(),
}))

import { readDb, writeDb } from '../config/database.js'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

function authToken() {
  return jwt.sign({ sub: 'user-1' }, TEST_SECRET, { expiresIn: '1h' })
}

function db(overrides = {}) {
  return {
    users: [{ id: 'user-1', email: 'alice@example.com' }],
    profiles: [{ id: 'user-1', role: 'founder' }],
    githubOauthStates: [],
    githubConnections: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GITHUB_TOKEN_ENCRYPTION_KEY = 'github-token-encryption-test-secret-at-least-32-chars'
})

describe('GitHub OAuth security boundaries', () => {
  it('rejects expired OAuth state before calling GitHub', async () => {
    readDb.mockReturnValue(db({
      githubOauthStates: [{
        state: 'expired-state',
        userId: 'user-1',
        createdAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      }],
    }))
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const res = await request(app).get('/api/github/callback?code=abc&state=expired-state')

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid state')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('persists one-time state consumption before exchange and encrypts the token at rest', async () => {
    const store = db({
      githubOauthStates: [{ state: 'valid-state', userId: 'user-1', createdAt: new Date().toISOString() }],
    })
    readDb.mockReturnValue(store)
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => {
        expect(writeDb).toHaveBeenCalledOnce()
        expect(store.githubOauthStates).toEqual([])
        return { json: async () => ({ access_token: 'github-plaintext-token' }) }
      })
      .mockResolvedValueOnce({
        json: async () => ({ login: 'alice', avatar_url: '', html_url: '', public_repos: 2 }),
      })

    const res = await request(app).get('/api/github/callback?code=abc&state=valid-state')

    expect(res.status).toBe(302)
    expect(writeDb).toHaveBeenCalledTimes(2)
    expect(store.githubConnections).toHaveLength(1)
    expect(store.githubConnections[0].accessToken).toBeUndefined()
    expect(store.githubConnections[0].accessTokenEncrypted).toMatch(/^[^.]+\.[^.]+\.[^.]+$/)
    expect(JSON.stringify(store.githubConnections[0])).not.toContain('github-plaintext-token')
  })

  it('creates high-entropy state tied to the authenticated user', async () => {
    const store = db()
    readDb.mockReturnValue(store)

    const res = await request(app)
      .get('/api/github/authorize')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(store.githubOauthStates).toHaveLength(1)
    expect(store.githubOauthStates[0].userId).toBe('user-1')
    expect(store.githubOauthStates[0].state).toMatch(/^ghstate_[0-9a-f-]{36}$/i)
  })
})
