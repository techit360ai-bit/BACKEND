import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'
const ROUTER_SECRET = 'admin-telemetry-test-secret-at-least-32-characters'

vi.mock('../config/database.js', () => ({
  readAuthorityDb: vi.fn(),
  writeAuthorityDb: vi.fn(),
  updateAuthorityDb: vi.fn(),
}))

import app from '../app.js'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'

function token(adminId) {
  return jwt.sign({ sub: adminId, role: 'super_admin' }, TEST_SECRET, { expiresIn: '1h' })
}

function makeDb() {
  return {
    users: [],
    profiles: [],
    adminUsers: [
      { id: 'admin-1', email: 'admin@example.com', role: 'admin', active: true, permissions: [] },
      { id: 'super-1', email: 'super@example.com', role: 'super_admin', active: true, permissions: ['all'] },
    ],
    adminAiControlAuditEvents: [],
    organizations: [{ id: 'org-1', name: 'Evidence Org' }],
    organizationMemberships: [],
    organizationDashboards: [],
    organizationEntitlements: [],
    organizationAuditEvents: [],
  }
}

function signature(method, path, body, suppliedTimestamp = null) {
  const timestamp = suppliedTimestamp || String(Math.floor(Date.now() / 1000))
  const canonical = `${timestamp}.${method}.${path}.${body}`
  return {
    timestamp,
    signature: crypto.createHmac('sha256', ROUTER_SECRET).update(canonical).digest('hex'),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  const db = makeDb()
  readAuthorityDb.mockReturnValue(db)
  updateAuthorityDb.mockImplementation(mutator => mutator(db))
  process.env.ADMIN_AI_ROUTER_TELEMETRY_SECRET = ROUTER_SECRET
  process.env.ADMIN_AI_ROUTER_TELEMETRY_SERVICE_ID = 'platform-backend'
})

describe('admin AI provider controls', () => {
  it('reads provider status through the HMAC proxy and signs the path without its query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ providers: [{ id: 'openai', status: 'ready', missing_env: [] }], leases: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await request(app)
      .get('/api/admin/ai-providers/status?refreshCredentials=true')
      .set('Authorization', `Bearer ${token('admin-1')}`)

    expect(res.status).toBe(200)
    expect(res.body.status.providers[0].id).toBe('openai')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/internal\/admin\/provider-status\?refresh_credentials=true$/)
    expect(options.headers.Authorization).toBeUndefined()
    const signed = signature('GET', '/internal/admin/provider-status', '', options.headers['X-TechIT-Timestamp'])
    expect(options.headers['X-TechIT-Signature']).toBe(signed.signature)
    expect(options.headers['X-TechIT-Timestamp']).toBe(signed.timestamp)
  })

  it('prevents a regular admin from mutating a model lease', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await request(app)
      .patch('/api/admin/ai-models/openai/gpt-4.1/lease')
      .set('Authorization', `Bearer ${token('admin-1')}`)
      .send({ action: 'disable', reason: 'operator pause' })

    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/super admin/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires a reason and rejects secret-shaped fields before calling the Router', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const missingReason = await request(app)
      .post('/api/admin/ai-providers/refresh')
      .set('Authorization', `Bearer ${token('super-1')}`)
      .send({ providerIds: ['openai'] })
    expect(missingReason.status).toBe(400)
    expect(missingReason.body.error).toBe('reason_required')

    const secret = await request(app)
      .patch('/api/admin/ai-models/openai/gpt-4.1/lease')
      .set('Authorization', `Bearer ${token('super-1')}`)
      .send({ action: 'reprice', reason: 'correct feed', inputCostPerMillion: 1, outputCostPerMillion: 2, apiKey: 'leak' })
    expect(secret.status).toBe(400)
    expect(secret.body.error).toBe('secrets_are_not_accepted_by_admin_routes')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('records an immutable audit row for an authorized policy mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, policy: { version: 2, auto_provision_enabled: false, before: { version: 1 } } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const db = readAuthorityDb()

    const res = await request(app)
      .patch('/api/admin/ai-providers/policy')
      .set('Authorization', `Bearer ${token('super-1')}`)
      .send({ enabled: false, reason: 'cost containment', expectedVersion: 1 })

    expect(res.status).toBe(200)
    expect(res.body.policy.auto_provision_enabled).toBe(false)
    const [, options] = fetchMock.mock.calls[0]
    const signed = signature('PATCH', '/internal/admin/provider-policy', options.body, options.headers['X-TechIT-Timestamp'])
    expect(options.headers['X-TechIT-Signature']).toBe(signed.signature)
    expect(db.adminAiControlAuditEvents).toHaveLength(1)
    expect(db.adminAiControlAuditEvents[0]).toMatchObject({
      actorId: 'super-1',
      action: 'policy_update',
      reason: 'cost containment',
      before: { version: 1 },
    })
  })
})

describe('organization entitlement controls', () => {
  it('allows an admin to read but not mutate entitlements', async () => {
    const read = await request(app)
      .get('/api/admin/tvce/organization-entitlements?organizationId=org-1')
      .set('Authorization', `Bearer ${token('admin-1')}`)
    expect(read.status).toBe(200)
    expect(read.body.entitlements[0].organizationId).toBe('org-1')

    const write = await request(app)
      .post('/api/admin/tvce/organization-entitlements')
      .set('Authorization', `Bearer ${token('admin-1')}`)
      .send({ organizationId: 'org-1', limits: { participants: 5000 } })
    expect(write.status).toBe(403)
  })

  it('allows a super-admin to persist limits above 1,000 with before/after audit', async () => {
    const res = await request(app)
      .post('/api/admin/tvce/organization-entitlements')
      .set('Authorization', `Bearer ${token('super-1')}`)
      .send({
        organizationId: 'org-1',
        plan: 'enterprise',
        reason: 'contract addendum',
        limits: { participants: 5000, storageBytes: 5 * 1024 * 1024 * 1024 },
        capabilities: { ORGANIZATION_MONITORING: true },
        sponsorAccess: true,
      })

    expect(res.status).toBe(201)
    expect(res.body.entitlement.limits.participants).toBe(5000)
    expect(res.body.entitlement.version).toBe(2)
    const db = readAuthorityDb()
    expect(db.organizationAuditEvents).toHaveLength(1)
    expect(db.organizationAuditEvents[0].newState.limits.participants).toBe(5000)
  })
})
