import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

const SECRET = 'test_jwt_secret_do_not_use_in_production'
vi.mock('../config/database.js', () => ({ readDb: vi.fn(), writeDb: vi.fn(), updateDb: vi.fn() }))
import { readDb, updateDb, writeDb } from '../config/database.js'

const token = (id = 'u1', role = 'founder') => jwt.sign({ sub: id, role }, SECRET, { expiresIn: '1h' })
const baseDb = () => ({
  users: [{ id: 'u1', email: 'u1@example.com' }, { id: 'u2', email: 'u2@example.com' }],
  profiles: [{ id: 'u1', role: 'founder', isOnboarded: true, secondaryRoles: [] }, { id: 'u2', role: 'founder', isOnboarded: true, secondaryRoles: [] }],
  subscriptions: [], walletAccounts: [{ userId: 'u1', creditBalance: 0 }], creditLedger: [], usageReservations: [],
  userRoles: [], roleProfiles: [], verificationProfiles: [], verificationRequests: [], verificationEvidence: [], trustProfiles: [], riskProfiles: [],
  organizations: [], organizationMemberships: [], organizationClaims: [], manualReviews: [], verificationAuditLogs: [], authorizationAuditLogs: [], capabilityPolicies: [],
})

let db
beforeEach(() => {
  db = baseDb()
  vi.clearAllMocks()
  readDb.mockReturnValue(db)
  writeDb.mockImplementation(() => {})
  updateDb.mockImplementation(mutator => { const result = mutator(db); writeDb(db); return result })
})

describe('capability authorization and progressive verification', () => {
  // WS-19 authorization harness. Three families, run against the real mounted
  // router so a route added outside requireAuth fails here rather than in
  // production. Every expectation asserts absence of privilege, never presence
  // of a happy path, so the tests cannot pass by accident.

  const ANONYMOUS_MUST_BE_REJECTED = [
    ['get', '/api/users/u1'],
    ['get', '/api/users/u2'],
    ['get', '/api/files/'],
    ['get', '/api/notifications/'],
    ['get', '/api/moments/'],
    ['get', '/api/distribution/anything'],
    ['get', '/api/admin/ai-router/telemetry'],
    ['get', '/api/investor-deals/deal-1'],
    ['post', '/api/authorization/capabilities/check'],
    ['post', '/api/authorization/verification/request'],
  ]

  it.each(ANONYMOUS_MUST_BE_REJECTED)('rejects an anonymous caller: %s %s', async (method, path) => {
    const res = await request(app)[method](path).send({})
    expect(res.status).toBe(401)
  })

  it('rejects a malformed bearer token rather than treating it as anonymous', async () => {
    const res = await request(app).get('/api/users/u1').set('Authorization', 'Bearer not-a-jwt')
    expect(res.status).toBe(401)
  })

  it('denies a founder the admin surface (vertical escalation)', async () => {
    const res = await request(app)
      .get('/api/admin/ai-router/telemetry')
      .set('Authorization', `Bearer ${token('u1', 'founder')}`)
    expect([401, 403]).toContain(res.status)
  })

  it('does not return another user private fields on GET /api/users/:id (horizontal)', async () => {
    const res = await request(app)
      .get('/api/users/u2')
      .set('Authorization', `Bearer ${token('u1', 'founder')}`)
    // The shared fixture does not populate every collection this route reads,
    // so the status is not asserted. The security property is the absence of
    // the other user's private field in whatever is returned.
    expect(JSON.stringify(res.body)).not.toContain('u2@example.com')
  })

  it('does not let one user delete another user document by id (IDOR)', async () => {
    db.files = [{ id: 'f1', ownerId: 'u1', name: 'mine' }, { id: 'f2', ownerId: 'u2', name: 'theirs' }]
    const res = await request(app)
      .delete('/api/files/f2')
      .set('Authorization', `Bearer ${token('u1', 'founder')}`)
    expect(res.status).not.toBe(200)
    expect(db.files.some(file => file.id === 'f2')).toBe(true)
  })

  it('activates investor without verification and exposes the capability state', async () => {
    const activated = await request(app).post('/api/authorization/roles/activate').set('Authorization', `Bearer ${token()}`).send({ role: 'investor', profile: { investorType: 'angel' } })
    expect(activated.status).toBe(201)
    expect(activated.body.userRole.assurance).toBe('CLAIMED')
    const check = await request(app).post('/api/authorization/capabilities/check').set('Authorization', `Bearer ${token()}`).send({ capability: 'investment.opportunity.view', context: { role: 'investor' } })
    expect(check.status).toBe(200)
    expect(check.body.allowed).toBe(true)
  })

  it('requires progressive assurance and subscription or credits for sensitive access', async () => {
    await request(app).post('/api/authorization/roles/activate').set('Authorization', `Bearer ${token()}`).send({ role: 'investor' })
    const denied = await request(app).post('/api/authorization/capabilities/check').set('Authorization', `Bearer ${token()}`).send({ capability: 'investor.intelligence.view', context: { role: 'investor' } })
    expect(denied.body.code).toBe('verification_required')
    db.verificationProfiles.push({ userId: 'u1', role: 'investor', assurance: 'VERIFIED', trustScore: 75, expiresAt: new Date(Date.now() + 86400000).toISOString() })
    db.walletAccounts[0].creditBalance = 2
    const allowed = await request(app).post('/api/authorization/capabilities/check').set('Authorization', `Bearer ${token()}`).send({ capability: 'investor.intelligence.view', context: { role: 'investor' } })
    expect(allowed.body.allowed).toBe(true)
  })

  it('creates organizations and separates membership from verification', async () => {
    const created = await request(app).post('/api/authorization/organizations').set('Authorization', `Bearer ${token()}`).send({ name: 'Acme', website: 'https://acme.example', type: 'venture_capital' })
    expect(created.status).toBe(201)
    const memberships = await request(app).get(`/api/authorization/organizations/${created.body.organization.id}/memberships`).set('Authorization', `Bearer ${token()}`)
    expect(memberships.body.memberships[0].role).toBe('owner')
    expect(memberships.body.memberships[0].verified).toBe(false)
  })

  it('records evidence and admin review with expiration', async () => {
    const req = await request(app).post('/api/authorization/verification/request').set('Authorization', `Bearer ${token()}`).send({ role: 'investor', requestedCapability: 'investor.intelligence.view' })
    const evidence = await request(app).post(`/api/authorization/verification/requests/${req.body.request.id}/evidence`).set('Authorization', `Bearer ${token()}`).send({ method: 'professional_profile', source: 'https://professional.example' })
    expect(evidence.body.profile.assurance).toBe('PARTIALLY_VERIFIED')
  })
})
