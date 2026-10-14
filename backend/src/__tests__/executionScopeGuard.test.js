import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

vi.mock('../config/database.js', () => ({ readAuthorityDb: vi.fn(), writeAuthorityDb: vi.fn(), updateAuthorityDb: vi.fn() }))
import { readAuthorityDb, updateAuthorityDb, writeAuthorityDb } from '../config/database.js'

const SECRET = 'test_jwt_secret_do_not_use_in_production'
const token = (id, role) => jwt.sign({ sub: id, role }, SECRET, { expiresIn: '1h' })
const url = '/api/domain/execution-intelligence'

let db
beforeEach(() => {
  db = {
    users: [{ id: 'investor-1' }, { id: 'founder-1' }, { id: 'org-1' }],
    profiles: [
      { id: 'investor-1', role: 'investor', isOnboarded: true },
      { id: 'founder-1', role: 'founder', isOnboarded: true },
      { id: 'org-1', role: 'organization', isOnboarded: true },
    ],
    userRoles: [], activeContexts: [],
    investorTrustAccessRequests: [], investorTrustAccessHistory: [], notifications: [],
    investorWatchlists: [], dealFlowSnapshots: [], mentorshipRooms: [], mentorshipMentees: [],
    projects: [], milestones: [], organizations: [], organizationMemberships: [], hackathons: [],
  }
  readAuthorityDb.mockReturnValue(db)
  updateAuthorityDb.mockImplementation(fn => fn(db))
  writeAuthorityDb.mockImplementation(() => {})
})

// Phase C access boundary: a tenant scope (organization/program/cohort) or a
// hackathon scope may only be used by someone who belongs to it, and an
// investor can NEVER read an organization cohort that is not theirs.
describe('execution-intelligence scope boundary', () => {
  it('denies an investor an organization scope (no cross-tenant cohort read)', async () => {
    const response = await request(app).get(`${url}?organizationId=org-victim`).set('Authorization', `Bearer ${token('investor-1', 'investor')}`)
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('scope_forbidden')
  })

  it('denies an investor a cohort scope', async () => {
    const response = await request(app).get(`${url}?cohortId=cohort-victim`).set('Authorization', `Bearer ${token('investor-1', 'investor')}`)
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('scope_forbidden')
  })

  it('denies an investor a program scope', async () => {
    const response = await request(app).get(`${url}?programId=program-victim`).set('Authorization', `Bearer ${token('investor-1', 'investor')}`)
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('scope_forbidden')
  })

  it('denies a non-member organization scope for a founder', async () => {
    const response = await request(app).get(`${url}?organizationId=org-victim`).set('Authorization', `Bearer ${token('founder-1', 'founder')}`)
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('scope_forbidden')
  })

  it('denies an investor a startup with no execution consent (fail-closed)', async () => {
    db.investorWatchlists.push({ id: 'w1', investorId: 'investor-1', projectId: 'startup-1' })
    const response = await request(app).get(`${url}?projectId=startup-1`).set('Authorization', `Bearer ${token('investor-1', 'investor')}`)
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('consent_required')
  })

  it('denies an investor a startup outside their authorized scope', async () => {
    const response = await request(app).get(`${url}?projectId=not-mine`).set('Authorization', `Bearer ${token('investor-1', 'investor')}`)
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('scope_forbidden')
  })

  it('lets an organization member scope their OWN organization (engine availability aside)', async () => {
    db.organizations.push({ id: 'org-1' })
    db.activeContexts.push({ id: 'ctx-1', userId: 'org-1', status: 'active', organizationId: 'org-1' })
    db.organizationMemberships.push({ id: 'm1', organizationId: 'org-1', userId: 'org-1', status: 'active', role: 'owner' })
    const response = await request(app).get(`${url}?organizationId=org-1`).set('Authorization', `Bearer ${token('org-1', 'organization')}`)
    // Passes the access boundary and reads the org's own (empty) execution view.
    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
  })

  it('lets an investor read their own mentorship startup once execution consent is granted', async () => {
    db.mentorshipRooms.push({ id: 'room-1', mentorId: 'investor-1', projectId: 'startup-1', status: 'published' })
    db.investorTrustAccessRequests.push({ id: 'req-1', investorId: 'investor-1', projectId: 'startup-1', founderId: 'founder-1', status: 'approved', requestedScopes: ['approved_evidence_metadata', 'execution_metrics'], grantedScopes: ['approved_evidence_metadata', 'execution_metrics'], decidedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() })
    const response = await request(app).get(`${url}?projectId=startup-1`).set('Authorization', `Bearer ${token('investor-1', 'investor')}`)
    // Authorized startup + granted execution consent → the scoped view is served.
    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
  })
})

// Phase X: the canonical execution-intelligence view reads local contribution
// stores, so it must NOT be gated behind the MCP connector flag.
describe('execution-intelligence availability (Phase X)', () => {
  it('serves the org execution view even when MCP_ENABLED is false', async () => {
    const previous = process.env.MCP_ENABLED
    process.env.MCP_ENABLED = 'false'
    try {
      db.organizations.push({ id: 'org-1' })
      db.activeContexts.push({ id: 'ctx-1', userId: 'org-1', status: 'active', organizationId: 'org-1' })
      db.organizationMemberships.push({ id: 'm1', organizationId: 'org-1', userId: 'org-1', status: 'active', role: 'owner' })
      const response = await request(app).get(`${url}?organizationId=org-1`).set('Authorization', `Bearer ${token('org-1', 'organization')}`)
      expect(response.status).toBe(200)
      expect(response.body.ok).toBe(true)
    } finally {
      if (previous === undefined) delete process.env.MCP_ENABLED
      else process.env.MCP_ENABLED = previous
    }
  })
})

// Phase E: anonymous cohort comparison (same industry + stage), min-size guarded.
describe('execution-intelligence cohort comparison (Phase E)', () => {
  const project = (id, stage) => ({ id, ownerId: 'founder-2', industry: 'SaaS', stage })
  beforeEach(() => {
    db.users.push({ id: 'founder-2' })
    db.profiles.push({ id: 'founder-2', role: 'founder', projectId: 'p1', isOnboarded: true })
  })

  it('withholds the cohort until it reaches the minimum size', async () => {
    db.projects.push(project('p1', 'mvp'), project('p2', 'mvp'), project('p3', 'mvp'))
    const response = await request(app).get(url).set('Authorization', `Bearer ${token('founder-2', 'founder')}`)
    expect(response.status).toBe(200)
    expect(response.body.cohort.available).toBe(false)
    expect(response.body.cohort.reason).toBe('cohort_too_small')
  })

  it('returns an anonymous milestone percentile once the cohort is big enough', async () => {
    db.projects.push(project('p1', 'mvp'), project('p2', 'mvp'), project('p3', 'mvp'), project('p4', 'mvp'), project('p5', 'mvp'))
    const done = (id, n) => Array.from({ length: n }, (_, i) => ({ id: `${id}-m${i}`, projectId: id, status: 'completed' }))
    // p1 has 2 completed milestones; p2 has 5; p3..p5 have 0 -> 4 of 5 at or below -> 80th percentile.
    db.milestones.push(...done('p1', 2), ...done('p2', 5))
    const response = await request(app).get(url).set('Authorization', `Bearer ${token('founder-2', 'founder')}`)
    expect(response.status).toBe(200)
    expect(response.body.cohort.available).toBe(true)
    expect(response.body.cohort.anonymous).toBe(true)
    expect(response.body.cohort.size).toBe(5)
    expect(response.body.cohort.metric).toBe('completed_milestones')
    expect(response.body.cohort.value).toBe(2)
    expect(response.body.cohort.percentile).toBe(80)
    // Anonymous: no peer ids leak into the cohort block.
    expect(JSON.stringify(response.body.cohort)).not.toMatch(/p[2-5]\b/)
  })
})
