import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

vi.mock('../config/database.js', () => ({
  readAuthorityDb: vi.fn(),
  writeAuthorityDb: vi.fn(),
  updateAuthorityDb: vi.fn(),
}))

import app from '../app.js'
import { readAuthorityDb } from '../config/database.js'

const token = adminId => jwt.sign({ sub: adminId, role: 'super_admin' }, TEST_SECRET, { expiresIn: '1h' })

function makeDb() {
  return {
    users: [{ id: 'user-1', email: 'founder@example.com', createdAt: '2026-09-01T09:00:00.000Z' }],
    profiles: [{ id: 'user-1', email: 'founder@example.com', firstName: 'Ada', lastName: 'Founder', role: 'founder', country: 'United States', isVerified: true, isOnboarded: true, createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-10-17T09:00:00.000Z' }],
    projects: [{ id: 'project-1', ownerId: 'user-1', name: 'Signal Engine', type: 'startup', stage: 'launched', createdAt: '2026-10-01T09:00:00.000Z' }],
    workspaceMembers: [{ id: 'member-1', userId: 'user-1', projectId: 'project-1', createdAt: '2026-10-02T09:00:00.000Z' }],
    contributions: [{ id: 'contribution-1', collaboratorId: 'user-1', projectId: 'project-1', status: 'verified', createdAt: '2026-10-03T09:00:00.000Z' }],
    subscriptions: [{ id: 'subscription-1', userId: 'user-1', status: 'active', planName: 'Founder Pro', amountMonthlyUsd: 99, createdAt: '2026-10-04T09:00:00.000Z' }],
    creditLedger: [],
    paymentIntents: [],
    invoices: [],
    usageEvents: [{ id: 'usage-1', userId: 'user-1', taskType: 'recommendation_chat', status: 'completed', latencyMs: 120, totalTokens: 500, createdAt: '2026-10-17T10:00:00.000Z' }],
    userSessionLogs: [{ id: 'session-1', userId: 'user-1', createdAt: '2026-10-17T10:00:00.000Z' }],
    recommendationEvents: [
      { id: 'ai-1', userId: 'user-1', eventType: 'recommendation_generated', createdAt: '2026-10-17T10:10:00.000Z' },
      { id: 'ai-2', userId: 'user-1', eventType: 'recommendation_clicked', createdAt: '2026-10-17T10:11:00.000Z' },
      { id: 'ai-3', userId: 'user-1', eventType: 'recommendation_success', createdAt: '2026-10-17T10:12:00.000Z' },
    ],
    techitMoments: [{ id: 'moment-1', userId: 'user-1', createdAt: '2026-10-09T09:00:00.000Z' }],
    techitMomentShares: [{ id: 'share-1', userId: 'user-1', createdAt: '2026-10-10T09:00:00.000Z' }],
    techitMomentReferrals: [{ id: 'referral-1', momentId: 'moment-1', signupUserId: 'user-2', activatedAt: '2026-10-11T09:00:00.000Z' }],
    trustVerificationProofs: [{ id: 'proof-1', userId: 'user-1', projectId: 'project-1', source: 'milestone', status: 'pending', method: 'milestone_revenue', metadata: { milestoneType: 'revenue' }, createdAt: '2026-10-17T08:00:00.000Z' }],
    adminUsers: [
      { id: 'admin-1', email: 'admin@example.com', role: 'admin', active: true, permissions: [] },
      { id: 'super-1', email: 'super@example.com', role: 'super_admin', active: true, permissions: ['all'] },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DB_DRIVER
  delete process.env.ADMIN_AUTH_SOURCE
  readAuthorityDb.mockReturnValue(makeDb())
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
})

describe('backend admin analytics routes', () => {
  it('requires an admin token instead of returning 404', async () => {
    const res = await request(app).get('/api/admin/analytics/mission-control')
    expect(res.status).toBe(401)
  })

  it('serves the seven dashboard contracts from persisted collections', async () => {
    const mission = await request(app)
      .get('/api/admin/analytics/mission-control')
      .set('Authorization', `Bearer ${token('admin-1')}`)
    expect(mission.status).toBe(200)
    expect(mission.body.executive.growth.totalUsers).toBe(1)
    expect(mission.body.collaboration.projectsCreated).toBe(1)
    expect(mission.body.revenue.mrr).toBe(99)

    const users = await request(app)
      .get('/api/admin/analytics/users')
      .set('Authorization', `Bearer ${token('admin-1')}`)
    expect(users.status).toBe(200)
    expect(users.body.metrics.totalUsers).toBe(1)
    expect(users.body.recentUsers[0]).toMatchObject({ id: 'user-1', name: 'Ada Founder', email: 'founder@example.com' })

    const referrals = await request(app)
      .get('/api/admin/analytics/referral-collaboration')
      .set('Authorization', `Bearer ${token('admin-1')}`)
    expect(referrals.status).toBe(200)
    expect(referrals.body.referral.metrics.invitationsSent).toBe(1)
    expect(referrals.body.referral.metrics.accepted).toBe(1)

    const trust = await request(app)
      .get('/api/admin/analytics/trust/milestone-reviews')
      .set('Authorization', `Bearer ${token('admin-1')}`)
    expect(trust.status).toBe(200)
    expect(trust.body.pendingCount).toBe(1)
    expect(trust.body.queue[0]).toMatchObject({ founderName: 'Ada Founder', startupName: 'Signal Engine', source: 'live' })

    const revenue = await request(app)
      .get('/api/admin/analytics/revenue-retention')
      .set('Authorization', `Bearer ${token('super-1')}`)
    expect(revenue.status).toBe(200)
    expect(revenue.body.metrics).toMatchObject({ mrr: 99, paidUsers: 1 })

    const ai = await request(app)
      .get('/api/admin/analytics/ai-system-health')
      .set('Authorization', `Bearer ${token('super-1')}`)
    expect(ai.status).toBe(200)
    expect(ai.body.ai.metrics.recommendationsGenerated).toBe(1)
    expect(ai.body.system.metrics.uptime).toBe(100)

    const geography = await request(app)
      .get('/api/admin/analytics/geography-alerts')
      .set('Authorization', `Bearer ${token('super-1')}`)
    expect(geography.status).toBe(200)
    expect(geography.body.geography.countries[0]).toMatchObject({ name: 'United States', value: 1 })
  })

  it('keeps the admin account collection separate from user analytics', async () => {
    const regular = await request(app)
      .get('/api/admin/analytics/revenue-retention')
      .set('Authorization', `Bearer ${token('admin-1')}`)
    expect(regular.status).toBe(403)

    const admins = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token('super-1')}`)
    expect(admins.status).toBe(200)
    expect(admins.body.admins).toHaveLength(2)
  })
})
