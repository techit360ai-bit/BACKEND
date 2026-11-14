// Route-level regression suite on the production storage wiring.
//
// Production runs DB_DRIVER=postgres with every domain read/write source set to
// postgres (ops/ec2/platform.env). Under that wiring the routes below either
// answered HTTP 500 (synchronous store access outside a bounded scope, invalid
// SQL, unsupported wallet collections) or reported success while the write had
// failed. The default vitest run uses the JSON driver and cannot see any of it.
//
// Requires PostgreSQL with pgvector (migration 001), e.g. pgvector/pgvector:pg16:
//   PLATFORM_TEST_DATABASE_URL=postgres://... npx vitest run platformRoutesPostgres
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import crypto from 'node:crypto'

const url = vi.hoisted(() => {
  const value = process.env.PLATFORM_TEST_DATABASE_URL
  if (!value) return value
  const postgres = 'postgres'
  const env = { DB_DRIVER: postgres, PLATFORM_DATABASE_URL: value, DATABASE_URL: value, PLATFORM_REQUEST_AUTHORITY: postgres, AI_ROUTER_URL: 'http://127.0.0.1:9', MCP_ENABLED: 'false' }
  for (const domain of ['IDENTITY', 'WORKSPACE', 'CONTENT', 'INVESTOR', 'ORGANIZATION', 'FINANCE', 'TRUST']) {
    Object.assign(env, { [`${domain}_READ_SOURCE`]: postgres, [`${domain}_WRITE_SOURCE`]: postgres, [`${domain}_READ_FALLBACK_SQLITE`]: 'false', [`${domain}_WRITE_FALLBACK_SQLITE`]: 'false' })
  }
  for (const domain of ['INTELLIGENCE', 'OPERATIONAL', 'SUPPORT', 'MOMENTS', 'CONTEXT', 'DOMAIN', 'COMPLIANCE', 'DISCOVERY', 'DISTRIBUTION', 'REGISTRY', 'VERIFICATION', 'WORKSPACE_CAPABILITY', 'VIDEO', 'GITHUB', 'OTP', 'WORKSPACE_CODE']) {
    Object.assign(env, { [`${domain}_SOURCE`]: postgres, [`${domain}_READ_SOURCE`]: postgres, [`${domain}_WRITE_SOURCE`]: postgres, [`${domain}_FALLBACK_SQLITE`]: 'false' })
  }
  for (const domain of ['ACADEMY', 'MENTORSHIP', 'AUTHORIZATION']) Object.assign(env, { [`${domain}_SOURCE`]: postgres, [`${domain}_FALLBACK_SQLITE`]: 'false' })
  Object.assign(env, { WORKSPACE_TEAM_WRITE_SOURCE: postgres, IDENTITY_SECURITY_SOURCE: postgres, SECURITY_EVENT_SOURCE: postgres, SECURITY_EVENTS_SOURCE: postgres, POSTURE_SOURCE: postgres, SECURITY_POSTURE_SOURCE: postgres, BILLING_JOBS_SOURCE: postgres, USER_DIRECTORY_FALLBACK_SQLITE: 'false' })
  Object.assign(process.env, env)
  return value
})

describe.skipIf(!url)('platform routes on the production PostgreSQL wiring', () => {
  let app
  let request
  let platform
  let token
  const email = `routes.${Date.now()}@example.com`

  beforeAll(async () => {
    platform = await import('../repositories/platformCollectionRepository.js')
    const pool = platform.getPlatformPool()
    const dir = new URL('../../migrations/postgres/', import.meta.url)
    for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.sql') && !name.endsWith('.down.sql')).sort()) {
      await pool.query(fs.readFileSync(new URL(file, dir), 'utf8'))
    }
    const verification = `verify-${crypto.randomUUID()}`
    const now = new Date()
    await platform.withPlatformTransaction(client => platform.upsertRecord(client, 'emailVerifications', {
      id: `ev-${crypto.randomUUID()}`, email, tokenHash: crypto.createHash('sha256').update(verification).digest('hex'),
      expiresAt: new Date(now.getTime() + 3600_000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString(),
    }, { operation: 'insert' }))
    await platform.withPlatformTransaction(async client => {
      for (const row of [
        { collection: 'creditPackages', id: 'routes_pack_active', payload: { name: 'Starter', credits: 320, amount: 800, currency: 'USD', active: true } },
        { collection: 'creditPackages', id: 'routes_pack_archived', payload: { name: 'Old', credits: 10, amount: 100, currency: 'USD', status: 'archived' } },
      ]) await platform.upsertRecord(client, row.collection, { id: row.id, ...row.payload, createdAt: now.toISOString(), updatedAt: now.toISOString() }, { operation: 'insert' }).catch(() => null)
    })
    ;({ default: app } = await import('../app.js'))
    ;({ default: request } = await import('supertest'))
    const signup = await request(app).post('/api/auth/signup').send({ email, password: 'Routes-Password-123', firstName: 'Route', lastName: 'Tester', role: 'founder', emailVerificationToken: verification })
    expect(signup.status).toBeLessThan(300)
    token = signup.body.token
  })

  afterAll(async () => { await platform?.closePlatformPool?.() })

  const get = path => request(app).get(path).set('Authorization', `Bearer ${token}`)
  const send = (method, path, body = {}) => request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

  it('serves every wallet view (summary, usage, invoices, catalog) instead of 500', async () => {
    for (const path of ['/api/domain/wallet/summary', '/api/domain/wallet/usage', '/api/domain/wallet/invoices', '/api/domain/wallet/plans', '/api/domain/wallet/transactions']) {
      expect((await get(path)).status, path).toBe(200)
    }
    const packages = await get('/api/domain/wallet/credit-packages')
    expect(packages.status).toBe(200)
    const ids = packages.body.creditPackages.map(row => row.id)
    expect(ids).toContain('routes_pack_active')
    expect(ids).not.toContain('routes_pack_archived')
  })

  it('runs the founder workspace journey (invalid cr.id join used to 500 every workspace read)', async () => {
    const project = await send('post', '/api/domain/founder/projects', { title: 'Routes Venture', industry: 'fintech', stage: 'idea' })
    expect(project.status).toBeLessThan(300)
    const provision = await send('post', '/api/domain/workspaces/provision', { projectId: project.body.project.id, name: 'Routes Workspace' })
    expect(provision.status).toBe(201)
    const workspaceId = provision.body.workspace.id
    const list = await get('/api/domain/workspaces')
    expect(list.status).toBe(200)
    // Write-through projection: readable immediately, not after the 30s sync.
    expect(list.body.workspaces.map(row => row.id)).toContain(workspaceId)
    expect((await get(`/api/domain/workspaces/${workspaceId}/context`)).status).toBe(200)
    expect((await get(`/api/domain/workspaces/${workspaceId}/members`)).status).toBe(200)
    const task = await send('post', `/api/domain/workspaces/${workspaceId}/tasks`, { title: 'Interview five customers' })
    expect(task.status).toBe(201)
    expect(task.body.task.ok).not.toBe(false)
    expect((await send('post', `/api/code/${workspaceId}/plan`, { requirement: 'add a pricing page' })).status).toBe(200)
    expect((await send('post', '/api/domain/workspaces/missing-workspace/tasks', { title: 'x' })).status).toBe(404)
  })

  it('serves moments, metrics and execution intelligence', async () => {
    expect((await get('/api/moments')).status).toBe(200)
    expect((await get('/api/moments/prompt')).status).toBe(200)
    expect((await get('/api/domain/platform/metrics')).status).toBe(200)
    expect((await get('/api/domain/execution-intelligence')).status).toBe(200)
  })

  it('answers organization intelligence with an authorization decision, not 500', async () => {
    for (const path of ['actions', 'kpis', 'cohorts', 'partners', 'resources', 'report-schedules']) {
      expect((await get(`/api/organization-intelligence/${path}`)).status, path).toBe(403)
    }
  })

  it('returns 404 for an unknown profile and removes an avatar', async () => {
    expect((await get('/api/users/no-such-user')).status).toBe(404)
    expect((await send('delete', '/api/users/me/avatar')).status).toBe(200)
  })

  it('reports compliance and discovery writes truthfully', async () => {
    const consent = await send('post', '/api/compliance/consents', { purpose: 'product_updates', granted: true })
    expect(consent.status).toBeLessThan(500)
    expect(consent.body.consent?.error).not.toBe('operational_write_temporarily_unavailable')
    const profile = await send('put', '/api/discovery/profile', { interests: ['fintech'] })
    expect(profile.status).toBeLessThan(500)
    expect(profile.body.profile?.error).not.toBe('intelligence_write_temporarily_unavailable')
  })
})
