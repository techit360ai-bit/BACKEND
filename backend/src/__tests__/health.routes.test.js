import { afterEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../app.js'

const ENV_KEYS = ['ENVIRONMENT', 'NODE_ENV', 'CORS_ORIGINS', 'DB_DRIVER', 'DATABASE_URL', 'PLATFORM_DATABASE_URL', 'JWT_ALGORITHM', 'JWT_PUBLIC_KEY', 'JWT_SECRET']
const saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('service probes', () => {
  it('GET /health reports build identity', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.service).toBe('techit-backend')
    expect(res.body).toHaveProperty('sha')
    expect(res.body).toHaveProperty('environment')
    expect(typeof res.body.uptimeSeconds).toBe('number')
  })

  it('GET /ready exposes named checks plus the expected-origin warning', async () => {
    const res = await request(app).get('/ready')
    expect([200, 503]).toContain(res.status)
    expect(res.body.status).toBe(res.status === 200 ? 'ready' : 'not_ready')
    const names = res.body.checks.map(check => check.name)
    expect(names).toEqual(expect.arrayContaining(['database.config', 'jwt.keys', 'cors.origins']))
    expect(res.body.warnings[0].name).toBe('cors.expected_origin')
    expect(res.body.warnings[0].detail).toContain('beta.techitnetwork.com')
  })

  it('accepts the deployed origin in production', async () => {
    process.env.ENVIRONMENT = 'production'
    process.env.NODE_ENV = 'production'
    process.env.DB_DRIVER = 'postgres'
    process.env.PLATFORM_DATABASE_URL = 'postgres://user:pass@db.example.com:5432/techit'
    process.env.JWT_ALGORITHM = 'HS256'
    process.env.JWT_SECRET = 'a-production-secret-that-is-long-enough'
    process.env.CORS_ORIGINS = 'https://beta.techitnetwork.com'

    const res = await request(app).get('/ready')
    const corsCheck = res.body.checks.find(check => check.name === 'cors.origins')
    expect(corsCheck.ok).toBe(true)
    expect(res.body.warnings[0].ok).toBe(true)
  })

  it('fails closed when production has no explicit origin allow-list', async () => {
    process.env.ENVIRONMENT = 'production'
    process.env.NODE_ENV = 'production'
    process.env.DB_DRIVER = 'sqlite'
    process.env.SQLITE_DB_PATH = '/tmp/health-probe.sqlite'
    delete process.env.CORS_ORIGINS

    const res = await request(app).get('/ready')
    expect(res.status).toBe(503)
    const corsCheck = res.body.checks.find(check => check.name === 'cors.origins')
    expect(corsCheck.ok).toBe(false)
  })
})
