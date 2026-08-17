import { beforeEach, describe, expect, it, vi } from 'vitest'
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

function token(userId = 'founder-1', role = 'founder') {
  return jwt.sign({ sub: userId, role }, TEST_SECRET, { expiresIn: '1h' })
}

function profile(id, role, overrides = {}) {
  return {
    id,
    email: `${id}@example.com`,
    firstName: id,
    lastName: 'User',
    role,
    skills: [],
    industries: [],
    investmentFocus: [],
    country: 'Nigeria',
    credibilityScore: 70,
    isVerified: true,
    isOnboarded: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
    ...overrides,
  }
}

function user(id) {
  return { id, email: `${id}@example.com`, passwordHash: 'irrelevant' }
}

function makeDb(overrides = {}) {
  return {
    users: [user('founder-1'), user('collab-1'), user('investor-1')],
    profiles: [
      profile('founder-1', 'founder', { skills: ['Product'], industries: ['FinTech'], startupStage: 'mvp' }),
      profile('collab-1', 'collaborator', { skills: ['React', 'TypeScript'], industries: ['FinTech'], title: 'Frontend Engineer' }),
      profile('investor-1', 'investor', { investmentFocus: ['FinTech'], title: 'Pre-seed Investor' }),
    ],
    projects: [{ id: 'startup-1', ownerId: 'collab-1', title: 'FinPay', industry: 'FinTech', stage: 'pre-seed', gsisScore: 81, createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z' }],
    opportunities: [{ id: 'opp-1', ownerId: 'collab-1', title: 'Build FinPay MVP', industry: 'FinTech', requiredSkills: ['Product'], status: 'open', visibility: 'public', createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z' }],
    ventureIntakes: [],
    feedPosts: [],
    notifications: [],
    recommendationProfiles: [],
    recommendationPreferences: [],
    recommendationConfigs: [],
    recommendations: [],
    recommendationReasons: [],
    recommendationEvents: [],
    recommendationFeedback: [],
    recommendationExposures: [],
    userInterests: [],
    userIntents: [],
    userSkills: [],
    entityRelationships: [],
    networkEdges: [],
    userActivityStates: [],
    catchUpStates: [],
    adminUsers: [],
    ...overrides,
  }
}

let db

beforeEach(() => {
  vi.clearAllMocks()
  db = makeDb()
  readDb.mockImplementation(() => db)
  writeDb.mockImplementation(next => { db = next })
  updateDb.mockImplementation(mutator => {
    const result = mutator(db)
    writeDb(db)
    return result
  })
})

describe('universal discovery API', () => {
  it('derives an existing user profile and returns mixed role-aware recommendations', async () => {
    const res = await request(app)
      .get('/api/discovery/recommendations?surface=feed&limit=10')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.meta.role).toBe('founder')
    expect(res.body.recommendations.some(item => item.entityType === 'person')).toBe(true)
    expect(res.body.recommendations.some(item => item.entityType !== 'person')).toBe(true)
    expect(res.body.recommendations.every(item => item.reasonType && item.reasonText)).toBe(true)
    expect(db.recommendationProfiles[0].interests.fintech).toBeGreaterThan(0)
  })

  it('uses skill match explanations and removes explicitly rejected entities', async () => {
    const first = await request(app)
      .get('/api/discovery/recommendations?type=opportunity')
      .set('Authorization', `Bearer ${token()}`)
    const recommendation = first.body.recommendations[0]

    expect(recommendation.reasonType).toBe('PROJECT_SKILL_MATCH')

    const feedback = await request(app)
      .post(`/api/discovery/recommendations/${recommendation.id}/feedback`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ type: 'not_interested' })
    expect(feedback.status).toBe(201)

    const second = await request(app)
      .get('/api/discovery/recommendations?type=opportunity')
      .set('Authorization', `Bearer ${token()}`)
    expect(second.body.recommendations).toEqual([])
  })

  it('builds a bounded return summary from relevant entities created during absence', async () => {
    db.userActivityStates.push({
      id: 'activity-1',
      userId: 'founder-1',
      returnAnchorAt: '2026-08-01T00:00:00.000Z',
      returnDetectedAt: '2026-08-10T00:00:00.000Z',
      lastLoginAt: '2026-08-10T00:00:00.000Z',
    })

    const res = await request(app)
      .get('/api/discovery/return-summary')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.available).toBe(true)
    expect(res.body.state).toBe('NETWORK_CHANGED')
    expect(res.body.headline).toContain('changed')
    expect(res.body.items.length).toBeGreaterThan(0)
    expect(res.body.categories.some(category => category.count > 0)).toBe(true)
  })

  it('tracks catch-up seen state and completion without resurfacing the old session', async () => {
    db.userActivityStates.push({
      id: 'activity-1', userId: 'founder-1', returnAnchorAt: '2026-08-01T00:00:00.000Z', returnDetectedAt: '2026-08-10T00:00:00.000Z',
    })
    const summary = await request(app).get('/api/discovery/return-summary').set('Authorization', `Bearer ${token()}`)
    const item = summary.body.items[0]

    const seen = await request(app)
      .post(`/api/discovery/catch-up/${item.id}/seen`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ action: 'seen' })
    expect(seen.status).toBe(200)

    const complete = await request(app)
      .post('/api/discovery/catch-up/complete')
      .set('Authorization', `Bearer ${token()}`)
    expect(complete.body.completed).toBe(true)

    const after = await request(app).get('/api/discovery/return-summary').set('Authorization', `Bearer ${token()}`)
    expect(after.body.available).toBe(false)
  })

  it('keeps personalized search transparent and returns complete persisted matches', async () => {
    const res = await request(app)
      .get('/api/discovery/search?q=FinPay&personalized=false')
      .set('Authorization', `Bearer ${token()}`)

    expect(res.status).toBe(200)
    expect(res.body.meta.personalized).toBe(false)
    expect(res.body.meta.completeDatasetAvailable).toBe(true)
    expect(res.body.results[0].title).toBe('FinPay')
  })
})
