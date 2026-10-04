import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), writeDb: vi.fn(), updateDb: vi.fn() }))

import app from '../app.js'
import { readDb, updateDb, writeDb } from '../config/database.js'

const token = (userId = 'owner', role = 'founder') => jwt.sign({ sub: userId, role }, TEST_SECRET, { expiresIn: '1h' })

function makeDb() {
  return {
    users: [
      { id: 'owner', email: 'owner@example.com', passwordHash: 'x', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'outsider', email: 'outsider@example.com', passwordHash: 'x', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    profiles: [
      { id: 'owner', email: 'owner@example.com', role: 'founder', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'outsider', email: 'outsider@example.com', role: 'founder', createdAt: '2026-01-01T00:00:00.000Z' },
    ],
    notificationPreferences: [], settingsEvents: [], notifications: [],
    workspaces: [{ id: 'w1', projectId: 'p1', ownerId: 'owner', name: 'Build', createdAt: '2026-01-01T00:00:00.000Z' }],
    workspaceMembers: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  const db = makeDb()
  readDb.mockReturnValue(db)
  writeDb.mockImplementation(() => {})
  updateDb.mockImplementation(mutator => mutator(db))
})

afterEach(() => {
  delete process.env.LIVEKIT_API_KEY
  delete process.env.LIVEKIT_API_SECRET
  delete process.env.LIVEKIT_URL
})

describe('workspace call token', () => {
  it('reports an explicit not-configured state when LiveKit is absent', async () => {
    const res = await request(app)
      .post('/api/domain/workspaces/w1/call-token')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ available: false, reason: 'live_calls_not_configured', workspaceId: 'w1' })
  })

  it('mints a real LiveKit room token for a workspace member', async () => {
    process.env.LIVEKIT_API_KEY = 'lk-test-key'
    process.env.LIVEKIT_API_SECRET = 'lk-test-secret'
    process.env.LIVEKIT_URL = 'wss://livekit.example'

    const res = await request(app)
      .post('/api/domain/workspaces/w1/call-token')
      .set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ available: true, room: 'workspace-w1', identity: 'owner', url: 'wss://livekit.example', canPublish: true })

    const decoded = jwt.verify(res.body.token, 'lk-test-secret', { algorithms: ['HS256'] })
    expect(decoded.iss).toBe('lk-test-key')
    expect(decoded.sub).toBe('owner')
    expect(decoded.video).toMatchObject({ room: 'workspace-w1', roomJoin: true, canPublish: true })
  })

  it('refuses non-members', async () => {
    process.env.LIVEKIT_API_KEY = 'lk-test-key'
    process.env.LIVEKIT_API_SECRET = 'lk-test-secret'
    process.env.LIVEKIT_URL = 'wss://livekit.example'
    const outsider = jwt.sign({ sub: 'outsider', role: 'founder' }, TEST_SECRET, { expiresIn: '1h' })
    const res = await request(app)
      .post('/api/domain/workspaces/w1/call-token')
      .set('Authorization', `Bearer ${outsider}`)
    expect(res.status).toBe(403)
  })
})
