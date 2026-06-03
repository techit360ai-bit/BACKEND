import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(),
  writeDb: vi.fn(),
}))

import { readDb, writeDb } from '../config/database.js'

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

  it('silently ignores disallowed fields (id, email, createdAt)', async () => {
    const profile = { ...BASE_PROFILE }
    readDb.mockReturnValue({ users: [BASE_USER], profiles: [profile] })

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        id: 'hacked-id',
        email: 'hacker@evil.com',
        createdAt: '1970-01-01',
        bio: 'Legit update',
      })

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('user-uuid-1')
    expect(res.body.email).toBe('alice@example.com')
    expect(res.body.createdAt).toBe('2026-01-01T00:00:00.000Z')
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
})

// ── 404 fallback ──────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
  it('returns 404 for unregistered paths', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Not found')
  })
})
