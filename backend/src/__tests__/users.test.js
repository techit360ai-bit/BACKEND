import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(),
  writeDb: vi.fn(),
  updateDb: vi.fn(),
}))

import { readDb, updateDb, writeDb } from '../config/database.js'

function validToken(userId = 'user-uuid-1') {
  return jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn: '1h' })
}

const BASE_USER = {
  id: 'user-uuid-1',
  email: 'alice@example.com',
  passwordHash: 'irrelevant',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const BASE_PROFILE = {
  id: 'user-uuid-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  username: null,
  phone: '',
  country: 'Nigeria',
  countryCode: 'NG',
  avatarUrl: null,
  bio: null,
  role: 'founder',
  secondaryRoles: [],
  creditBalance: 0,
  credibilityScore: 0,
  isVerified: false,
  isOnboarded: false,
  startupStage: null,
  industries: [],
  experience: null,
  skills: [],
  weeklyHours: null,
  riskTolerance: null,
  investmentFocus: [],
  ticketSize: null,
  orgName: null,
  orgType: null,
  website: null,
  linkedinUrl: null,
  githubUrl: null,
  portfolioUrl: null,
  timezone: null,
  certifications: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  writeDb.mockImplementation(() => {})
  updateDb.mockImplementation(mutator => {
    const db = readDb()
    const before = JSON.stringify(db)
    const result = mutator(db)
    if (JSON.stringify(db) !== before) writeDb(db)
    return result
  })
})

// ── GET /api/users/me ─────────────────────────────────────────────────────────

describe('GET /api/users/me', () => {
  it('returns the full profile for an authenticated user', async () => {
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [BASE_PROFILE] })

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('user-uuid-1')
    expect(res.body.email).toBe('alice@example.com')
    expect(res.body.firstName).toBe('Alice')
    expect(res.body.role).toBe('founder')
  })

  it('returns all expected profile fields', async () => {
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [BASE_PROFILE] })

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)

    const required = [
      'id', 'email', 'firstName', 'lastName', 'username', 'phone',
      'country', 'countryCode', 'avatarUrl', 'bio', 'role',
      'secondaryRoles', 'creditBalance', 'credibilityScore', 'isVerified',
      'isOnboarded', 'industries', 'skills', 'certifications',
      'createdAt', 'updatedAt',
    ]
    for (const field of required) {
      expect(res.body).toHaveProperty(field)
    }
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users/me')
    expect(res.status).toBe(401)
  })

  it('returns 401 with an invalid token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer garbage.token.here')
    expect(res.status).toBe(401)
  })

  it('returns 404 when profile is missing for a valid user', async () => {
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [] })

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)

    expect(res.status).toBe(404)
  })
})

describe('GET /api/users', () => {
  it('returns safe live collaborator directory fields and excludes the authenticated user', async () => {
    const collaborator = {
      ...BASE_PROFILE,
      id: 'user-uuid-2',
      email: 'builder@example.com',
      firstName: 'Live',
      lastName: 'Builder',
      role: 'collaborator',
      bio: 'Backend systems',
      skills: ['Node.js', 'Postgres'],
      discipline: 'Engineering',
      subSkills: ['API design'],
      techStack: ['Node.js', 'Postgres'],
      weeklyHours: 24,
      timezone: 'UTC+1',
      earliestStart: 'this-week',
      commitmentStyle: 'deep',
      equityPreference: 70,
      minCashFloor: 1000,
      industries: ['HealthTech'],
      credibilityScore: 81,
      isVerified: true,
    }
    readDb.mockReturnValue({
      users: [BASE_USER, { ...BASE_USER, id: collaborator.id, email: collaborator.email }],
      profiles: [BASE_PROFILE, collaborator],
      feedPosts: [],
      feedComments: [],
      notifications: [],
    })

    const res = await request(app)
      .get('/api/users?role=collaborator')
      .set('Authorization', `Bearer ${validToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.users).toEqual([{
      id: 'user-uuid-2',
      name: 'Live Builder',
      role: 'collaborator',
      title: 'Engineering',
      headline: 'Backend systems',
      skills: ['Node.js', 'Postgres'],
      discipline: 'Engineering',
      subSkills: ['API design'],
      techStack: ['Node.js', 'Postgres'],
      weeklyHours: 24,
      timezone: 'UTC+1',
      location: 'Nigeria',
      earliestStart: 'this-week',
      commitmentStyle: 'deep',
      equityPreference: 70,
      minCashFloor: 1000,
      industries: ['HealthTech'],
      avatarUrl: '',
      credibilityScore: 81,
      isVerified: true,
    }])
    expect(res.body.users[0]).not.toHaveProperty('email')
  })

  it('requires authentication', async () => {
    const res = await request(app).get('/api/users?role=collaborator')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/users/:id/connect', () => {
  it('persists a factual structured collaboration invitation', async () => {
    const target = { ...BASE_PROFILE, id: 'user-uuid-2', role: 'collaborator', firstName: 'Live', lastName: 'Builder' }
    const db = { users: [BASE_USER], profiles: [BASE_PROFILE, target], notifications: [], feedPosts: [], feedComments: [] }
    readDb.mockReturnValue(db)

    const res = await request(app)
      .post('/api/users/user-uuid-2/connect')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        invitation: {
          projectId: 'project-1',
          projectName: 'LedgerCare',
          summary: 'LedgerCare helps clinics reconcile patient payments.',
          scope: 'Build and test the first reconciliation API.',
          requestedRole: 'Backend Engineer',
          requiredSkills: ['Node.js', 'Postgres'],
          compensationMode: 'equity-heavy',
          equityProposal: 4,
          cashReward: 0,
        },
      })

    expect(res.status).toBe(200)
    expect(db.notifications[0]).toMatchObject({
      userId: 'user-uuid-2',
      type: 'collab',
      metadata: {
        invitation: {
          projectId: 'project-1',
          projectName: 'LedgerCare',
          requestedRole: 'Backend Engineer',
          requiredSkills: ['Node.js', 'Postgres'],
          compensationMode: 'equity-heavy',
          equityProposal: 4,
          cashReward: 0,
        },
      },
    })
    expect(db.notifications[0].content).toContain('Scope: Build and test the first reconciliation API.')
    expect(db.notifications[0].content).toContain('Non-binding ownership proposal')
  })

  it('sanitizes and bounds untrusted invitation fields', async () => {
    const target = { ...BASE_PROFILE, id: 'user-uuid-2', role: 'collaborator' }
    const db = { users: [BASE_USER], profiles: [BASE_PROFILE, target], notifications: [], feedPosts: [], feedComments: [] }
    readDb.mockReturnValue(db)

    const res = await request(app)
      .post('/api/users/user-uuid-2/connect')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        invitation: {
          projectId: 'project-1',
          projectName: '<b>LedgerCare</b>',
          summary: `Useful ${'x'.repeat(700)}`,
          scope: '<script>alert(1)</script> Build API',
          requestedRole: 'Backend Engineer',
          requiredSkills: Array.from({ length: 20 }, (_, index) => `Skill ${index}`),
          compensationMode: 'equity-cash',
          equityProposal: 999,
          cashReward: 250,
        },
      })

    expect(res.status).toBe(200)
    const invitation = db.notifications[0].metadata.invitation
    expect(invitation.projectName).not.toContain('<')
    expect(invitation.summary.length).toBeLessThanOrEqual(500)
    expect(invitation.scope).not.toContain('<')
    expect(invitation.requiredSkills).toHaveLength(12)
    expect(invitation.equityProposal).toBe(30)
    expect(invitation.cashReward).toBe(250)
  })
})

// ── PATCH /api/users/me ───────────────────────────────────────────────────────

describe('PATCH /api/users/me', () => {
  it('updates allowed fields and returns the updated profile', async () => {
    const profile = { ...BASE_PROFILE }
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [profile] })

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ bio: 'Building the future', skills: ['React', 'Node'] })

    expect(res.status).toBe(200)
    expect(res.body.bio).toBe('Building the future')
    expect(res.body.skills).toEqual(['React', 'Node'])
    expect(writeDb).toHaveBeenCalledOnce()
  })

  it('updates isOnboarded flag', async () => {
    const profile = { ...BASE_PROFILE, isOnboarded: false }
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [profile] })

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ isOnboarded: true })

    expect(res.status).toBe(200)
    expect(res.body.isOnboarded).toBe(true)
  })

  it('silently ignores disallowed identity and authorization fields', async () => {
    const profile = { ...BASE_PROFILE }
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [profile] })

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        id: 'hacked-id',
        email: 'hacker@evil.com',
        createdAt: '1970-01-01',
        role: 'organisation',
        isVerified: true,
        creditBalance: 999999,
        credibilityScore: 100,
        bio: 'Legit update',
      })

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('user-uuid-1')
    expect(res.body.email).toBe('alice@example.com')
    expect(res.body.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(res.body.role).toBe('founder')
    expect(res.body.isVerified).toBe(false)
    expect(res.body.creditBalance).toBe(0)
    expect(res.body.credibilityScore).toBe(0)
    expect(res.body.bio).toBe('Legit update')
  })

  it('updates the updatedAt timestamp', async () => {
    const profile = { ...BASE_PROFILE }
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [profile] })

    const before = new Date().toISOString()
    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ bio: 'Updated' })

    expect(res.body.updatedAt >= before).toBe(true)
  })

  it('returns 401 without a token', async () => {
    const res = await request(app).patch('/api/users/me').send({ bio: 'x' })
    expect(res.status).toBe(401)
  })

  it('can update array fields like industries and skills', async () => {
    const profile = { ...BASE_PROFILE }
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [profile] })

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ industries: ['FinTech', 'AI'], investmentFocus: ['Seed'] })

    expect(res.status).toBe(200)
    expect(res.body.industries).toEqual(['FinTech', 'AI'])
    expect(res.body.investmentFocus).toEqual(['Seed'])
  })

  it('persists role-specific settings fields without allowing authorization changes', async () => {
    const profile = { ...BASE_PROFILE }
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [profile] })

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        title: 'Founder and engineer',
        yearsBuilding: 4,
        openRoles: ['Backend Engineer'],
        discipline: 'Engineering',
        techStack: ['TypeScript'],
        equityPreference: 60,
        role: 'investor',
      })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      title: 'Founder and engineer',
      yearsBuilding: 4,
      openRoles: ['Backend Engineer'],
      discipline: 'Engineering',
      techStack: ['TypeScript'],
      equityPreference: 60,
      role: 'founder',
    })
  })
})

// ── 404 fallback ──────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('returns 404 for unregistered paths', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Not found')
  })
})
