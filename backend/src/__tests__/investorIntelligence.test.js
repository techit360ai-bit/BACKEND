import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), writeDb: vi.fn(), updateDb: vi.fn() }))
import { readDb, updateDb, writeDb } from '../config/database.js'

const SECRET = 'test_jwt_secret_do_not_use_in_production'
const token = (id = 'investor-1') => jwt.sign({ sub: id, role: 'investor' }, SECRET, { expiresIn: '1h' })
let db

beforeEach(() => {
  db = {
    users: [{ id: 'investor-1' }],
    profiles: [{ id: 'investor-1', role: 'investor', isOnboarded: true }],
    verificationProfiles: [{ userId: 'investor-1', role: 'investor', assurance: 'VERIFIED', expiresAt: new Date(Date.now() + 86400000).toISOString() }],
    walletAccounts: [{ userId: 'investor-1', creditBalance: 20 }], creditLedger: [], usageReservations: [], subscriptions: [],
    investorWatchlists: [{ id: 'watch-1', investorId: 'investor-1', projectId: 'startup-1' }],
    dealFlowSnapshots: [{ id: 'snapshot-1', investorId: 'investor-1', projectId: 'startup-1', startupName: 'Northstar', executionVelocity: 78, readinessScore: 82, updatedAt: new Date().toISOString() }],
    projects: [{ id: 'startup-1', title: 'Northstar', industry: 'SaaS', updatedAt: new Date().toISOString() }],
    mentorshipRooms: [{ id: 'room-1', projectId: 'startup-1', status: 'published' }],
    mentorshipMentees: [{ id: 'mentee-1', roomId: 'room-1', status: 'active' }],
    mentorshipTasks: [{ id: 'task-1', roomId: 'room-1', status: 'completed' }, { id: 'task-2', roomId: 'room-1', status: 'pending' }],
    milestones: [{ id: 'milestone-1', projectId: 'startup-1', status: 'completed' }, { id: 'milestone-2', projectId: 'startup-1', status: 'in_progress', dueDate: new Date(Date.now() + 86400000).toISOString() }],
    investorIntelligenceSnapshots: [], investorIntelligenceAudits: [], investorRiskSignals: [], investorRecommendations: [], authorizationAuditLogs: [], capabilityAnalytics: [],
  }
  readDb.mockReturnValue(db); writeDb.mockImplementation(() => {}); updateDb.mockImplementation(fn => fn(db))
})

describe('investor mentorship intelligence', () => {
  it('returns only relationship-scoped deterministic startup intelligence', async () => {
    const response = await request(app).get('/api/investor-intelligence/overview').set('Authorization', `Bearer ${token()}`)
    expect(response.status).toBe(200)
    expect(response.body.startups).toHaveLength(1)
    expect(response.body.startups[0].name).toBe('Northstar')
    expect(response.body.startups[0].mentorship.completedTasks).toBe(1)
    expect(response.body.deterministic).toBe(true)
    expect(db.investorIntelligenceAudits).toHaveLength(1)
  })

  it('rejects startups outside the investor relationship scope', async () => {
    const response = await request(app).get('/api/investor-intelligence/startups/not-authorized').set('Authorization', `Bearer ${token()}`)
    expect(response.status).toBe(404)
    expect(response.body.error).toBe('startup_not_authorized')
  })

  it('degrades AI advisory safely while preserving deterministic evidence', async () => {
    const response = await request(app).get('/api/investor-intelligence/advisory/portfolio').set('Authorization', `Bearer ${token()}`)
    expect(response.status).toBe(200)
    expect(response.body.deterministic).toBe(true)
    expect(response.body.advisoryOnly).toBe(true)
    expect(response.body.evidence.startups).toHaveLength(1)
  })

  it('returns a deterministic daily brief with actionable attention items', async () => {
    const response = await request(app).get('/api/investor-intelligence/brief').set('Authorization', `Bearer ${token()}`)
    expect(response.status).toBe(200)
    expect(response.body.deterministic).toBe(true)
    expect(response.body.totalStartups).toBe(1)
    expect(response.body.milestonesCompleted).toBe(1)
  })

  it('exposes scoped alerts and deterministic reports', async () => {
    const alerts = await request(app).get('/api/investor-intelligence/alerts').set('Authorization', `Bearer ${token()}`)
    const reports = await request(app).get('/api/investor-intelligence/reports').set('Authorization', `Bearer ${token()}`)
    expect(alerts.status).toBe(200); expect(alerts.body.deterministic).toBe(true); expect(Array.isArray(alerts.body.alerts)).toBe(true)
    expect(reports.status).toBe(200); expect(reports.body.deterministic).toBe(true); expect(reports.body.reports[0].type).toBe('daily_brief')
    expect(db.creditLedger).toHaveLength(0); expect(db.usageReservations).toHaveLength(0)
  })
})
