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
