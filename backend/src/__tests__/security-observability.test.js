import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(),
  writeDb: vi.fn(),
}))

import { readDb } from '../config/database.js'

function token(claims = {}) {
  return jwt.sign({ sub: 'user-1', ...claims }, TEST_SECRET, { expiresIn: '1h' })
}

beforeEach(() => {
  vi.clearAllMocks()
  readDb.mockReturnValue({
    users: [{ id: 'user-1', email: 'alice@example.com' }],
    profiles: [{ id: 'user-1', email: 'alice@example.com', role: 'founder' }],
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.LOG_REQUESTS
})

describe('security and observability gates', () => {
  it('propagates a caller-provided request id on successful responses', async () => {
    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${token()}`)
      .set('X-Request-Id', 'req-wave9-1')

    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toBe('req-wave9-1')
    expect(res.body.user.id).toBe('user-1')
  })

  it('generates a request id when the caller does not provide one', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('emits structured request logs with request id, path, status, and duration', async () => {
    process.env.LOG_REQUESTS = '1'
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    const res = await request(app)
      .get('/')
      .set('X-Request-Id', 'req-log-1')

    expect(res.status).toBe(200)
    expect(info).toHaveBeenCalledOnce()
    const event = JSON.parse(info.mock.calls[0][0])
    expect(event).toMatchObject({
      event: 'http_request',
      requestId: 'req-log-1',
      method: 'GET',
      path: '/',
      statusCode: 200,
    })
    expect(event.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('keeps CORS limited to configured frontend origins', async () => {
    const allowed = await request(app)
      .options('/api/auth/session')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')

    expect(allowed.status).toBe(204)
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')

    const denied = await request(app)
      .options('/api/auth/session')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET')

    expect(denied.status).toBe(204)
    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('rejects forged JWTs signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: 'user-1', role: 'admin' }, 'attacker-secret', { expiresIn: '1h' })

    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${forged}`)

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/invalid or expired/i)
  })

  it('returns and logs the same request id for unhandled errors', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    readDb.mockImplementation(() => {
      throw new Error('database unavailable')
    })

    const res = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${token()}`)
      .set('X-Request-Id', 'req-error-1')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Internal server error', requestId: 'req-error-1' })
    expect(res.headers['x-request-id']).toBe('req-error-1')
    expect(error).toHaveBeenCalledOnce()

    const event = JSON.parse(error.mock.calls[0][0])
    expect(event).toMatchObject({
      event: 'http_error',
      requestId: 'req-error-1',
      method: 'GET',
      path: '/api/auth/session',
      error: 'database unavailable',
    })
  })
})
