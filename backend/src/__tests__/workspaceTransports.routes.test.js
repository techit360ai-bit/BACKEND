import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), writeDb: vi.fn(), updateDb: vi.fn() }))
vi.mock('../services/aiRouterClient.js', async (importOriginal) => ({
  ...(await importOriginal()),
  requestWorkspaceConversation: vi.fn(),
}))

import { readDb, updateDb, writeDb } from '../config/database.js'
import { requestWorkspaceConversation } from '../services/aiRouterClient.js'

const token = (userId = 'owner') => jwt.sign({ sub: userId, role: 'founder' }, TEST_SECRET, { expiresIn: '1h' })

function makeDb() {
  return {
    users: [{ id: 'owner', email: 'owner@example.com', passwordHash: 'x', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    profiles: [{ id: 'owner', email: 'owner@example.com', firstName: 'Own', lastName: 'Er', role: 'founder', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    notificationPreferences: [], settingsEvents: [], notifications: [],
    workspaceMembers: [], workspaceAgents: [], workspaceReports: [], projectFiles: [], projectFileVersions: [],
    workspaces: [{ id: 'w1', projectId: 'p1', ownerId: 'owner', name: 'Build', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    workspaceTasks: [{ id: 't1', workspaceId: 'w1', ownerId: 'owner', title: 'Ship it', prompt: 'Add a billing summary', status: 'queued', events: [], createdAt: '2026-01-01T00:00:00.000Z' }],
    workspaceConnectors: [{ id: 'c1', workspaceId: 'w1', ownerId: 'owner', name: 'Slack', status: 'disconnected', createdAt: '2026-01-01T00:00:00.000Z' }],
    connectorCredentials: [],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  const db = makeDb()
  readDb.mockReturnValue(db)
  writeDb.mockImplementation(() => {})
  updateDb.mockImplementation(mutator => { const result = mutator(db); return result })
})

describe('workspace agent task transport', () => {
  it('returns a single task with its transcript', async () => {
    const res = await request(app).get('/api/domain/workspaces/w1/tasks/t1').set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(200)
    expect(res.body.task.prompt).toBe('Add a billing summary')
  })

  it('appends an event and runs the task through the AI router', async () => {
    const event = await request(app)
      .post('/api/domain/workspaces/w1/tasks/t1/events')
      .set('Authorization', `Bearer ${token()}`)
      .send({ type: 'message', text: 'starting', status: 'running' })
    expect(event.status).toBe(201)
    expect(event.body.task.status).toBe('running')

    requestWorkspaceConversation.mockResolvedValue({ message: 'Done.', model_used: 'platform-default' })
    const run = await request(app)
      .post('/api/domain/workspaces/w1/tasks/t1/run')
      .set('Authorization', `Bearer ${token()}`)
      .send({})
    expect(run.status).toBe(200)
    expect(run.body.task.status).toBe('done')
    expect(run.body.task.events.map(row => row.text)).toContain('Done.')
  })

  it('rejects an unknown task and unauthenticated callers', async () => {
    expect((await request(app).get('/api/domain/workspaces/w1/tasks/nope').set('Authorization', `Bearer ${token()}`)).status).toBe(404)
    expect((await request(app).get('/api/domain/workspaces/w1/tasks/t1')).status).toBe(401)
  })
})

describe('connector credential transport', () => {
  it('connects, masks, reports, and disconnects a provider credential', async () => {
    const secret = 'xoxb-super-secret-token'
    const connect = await request(app)
      .post('/api/domain/workspaces/w1/connectors/c1/credential')
      .set('Authorization', `Bearer ${token()}`)
      .send({ token: secret, label: 'Slack bot' })
    expect(connect.status).toBe(201)
    expect(JSON.stringify(connect.body)).not.toContain(secret)
    expect(connect.body.handshake).toBe('credential')
    expect(connect.body.connector).toMatchObject({ status: 'connected', authMode: 'credential' })

    const status = await request(app).get('/api/domain/workspaces/w1/connectors/c1/credential').set('Authorization', `Bearer ${token()}`)
    expect(status.body.credential.label).toBe('Slack bot')
    expect(status.body.oauthRedirectSupported).toBe(false)

    const removed = await request(app).delete('/api/domain/workspaces/w1/connectors/c1/credential').set('Authorization', `Bearer ${token()}`)
    expect(removed.status).toBe(200)
    expect(removed.body.connector).toMatchObject({ status: 'disconnected', authMode: null })
  })

  it('rejects a too-short credential', async () => {
    const res = await request(app)
      .post('/api/domain/workspaces/w1/connectors/c1/credential')
      .set('Authorization', `Bearer ${token()}`)
      .send({ token: 'short' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('credential_too_short')
  })
})
