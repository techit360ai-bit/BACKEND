import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), writeDb: vi.fn(), updateDb: vi.fn() }))
import { readDb, updateDb, writeDb } from '../config/database.js'

const token = (id, role = 'organization') => jwt.sign({ sub: id, role }, 'test_jwt_secret_do_not_use_in_production', { expiresIn: '1h' })
let db
beforeEach(() => {
  db = {
    users: [{ id: 'org-owner' }, { id: 'member' }, { id: 'other-org' }],
    profiles: [{ id: 'org-owner', role: 'organization', isOnboarded: true }, { id: 'member', role: 'explorer', isOnboarded: true }, { id: 'other-org', role: 'organization', isOnboarded: true }],
    organizations: [{ id: 'org-owner', name: 'Northstar Foundation' }, { id: 'other-org', name: 'Other Foundation' }],
    organizationMemberships: [{ id: 'membership-1', organizationId: 'org-owner', userId: 'member', role: 'analyst', status: 'active' }],
    activeContexts: [{ id: 'context-1', userId: 'member', organizationId: 'org-owner', role: 'explorer', status: 'active' }],
    projects: [{ id: 'startup-1', organizationId: 'org-owner', title: 'Northstar', gsisScore: 82, progress: 70, updatedAt: new Date().toISOString() }, { id: 'startup-other', organizationId: 'other-org', title: 'Other', gsisScore: 99, progress: 99, updatedAt: new Date().toISOString() }],
    organizationPrograms: [{ id: 'program-1', organizationId: 'org-owner', name: 'Accelerator', status: 'active', updatedAt: new Date().toISOString() }],
    organizationPartners: [], mentorshipRooms: [], workspaceTasks: [], organizationRiskSignals: [{ id: 'risk-1', organizationId: 'org-owner', severity: 'high', status: 'open', updatedAt: new Date().toISOString() }], organizationActions: [], organizationActivityEvents: [], organizationKpiDefinitions: [], organizationKpiValues: [], organizationAuditEvents: [], organizationDashboards: [], notifications: [], userRoles: [], verificationProfiles: [], trustProfiles: [], riskProfiles: [], capabilityPolicies: [], authorizationAuditLogs: [], capabilityAnalytics: [], subscriptions: [], walletAccounts: [], creditLedger: [], usageReservations: [],
  }
  readDb.mockReturnValue(db); writeDb.mockImplementation(() => {}); updateDb.mockImplementation(fn => fn(db))
})

describe('Organization intelligence context and deterministic operations', () => {
  it('resolves active organization membership and isolates other tenants', async () => {
    const memberOverview = await request(app).get('/api/organization-intelligence/overview').set('Authorization', `Bearer ${token('member', 'explorer')}`)
    expect(memberOverview.status).toBe(200); expect(memberOverview.body.organizationId).toBe('org-owner'); expect(memberOverview.body.metrics.startups).toBe(1); expect(memberOverview.body.health.score).toBeGreaterThan(0)
    const denied = await request(app).get('/api/organization-intelligence/overview?organizationId=other-org').set('Authorization', `Bearer ${token('member', 'explorer')}`)
    expect(denied.status).toBe(403)
  })

  it('computes pulse/risk and persists audited actions without billing mutation', async () => {
    const pulse = await request(app).get('/api/organization-intelligence/pulse?window=7d').set('Authorization', `Bearer ${token('member', 'explorer')}`)
    expect(pulse.status).toBe(200); expect(pulse.body.changes.risksDetected).toBe(1)
    const action = await request(app).post('/api/organization-intelligence/actions').set('Authorization', `Bearer ${token('org-owner', 'organization')}`).send({ title: 'Review startup', priority: 'high', reason: 'Risk requires review' })
    expect(action.status).toBe(201); expect(db.organizationActions).toHaveLength(1); expect(db.organizationAuditEvents).toHaveLength(1); expect(db.creditLedger).toHaveLength(0); expect(db.usageReservations).toHaveLength(0)
    const integrity = await request(app).get('/api/organization-intelligence/audit/integrity').set('Authorization', `Bearer ${token('member', 'explorer')}`)
    expect(integrity.status).toBe(200); expect(integrity.body.valid).toBe(true)
  })

  it('allows analyst KPI writes but keeps read-only members from mutation', async () => {
    const analyst = await request(app).post('/api/organization-intelligence/kpis').set('Authorization', `Bearer ${token('member', 'explorer')}`).send({ name: 'Validation Rate', unit: 'percent', target: 70, value: 63 })
    expect(analyst.status).toBe(201); expect(db.organizationKpiDefinitions).toHaveLength(1); expect(db.organizationKpiValues).toHaveLength(1)
    db.organizationMemberships[0].role = 'read_only'
    const denied = await request(app).post('/api/organization-intelligence/kpis').set('Authorization', `Bearer ${token('member', 'explorer')}`).send({ name: 'Nope' })
    expect(denied.status).toBe(403)
  })

  it('refreshes deterministic risks and recommendations from persisted startup evidence', async () => {
    db.projects[0].updatedAt = new Date(Date.now() - 20 * 86400000).toISOString()
    const refreshed = await request(app).post('/api/organization-intelligence/refresh').set('Authorization', `Bearer ${token('org-owner', 'organization')}`).send({})
    expect(refreshed.status).toBe(200); expect(refreshed.body.detected).toBeGreaterThan(0); expect(refreshed.body.recommendations[0].evidence).toBeTruthy(); expect(refreshed.body.recommendations[0].deterministic).toBe(true)
  })

  it('keeps startup portfolio pagination and report output organization-scoped', async () => {
    const portfolio = await request(app).get('/api/organization-intelligence/startups?limit=1').set('Authorization', `Bearer ${token('member', 'explorer')}`)
    expect(portfolio.status).toBe(200); expect(portfolio.body.items).toHaveLength(1); expect(portfolio.body.pagination.total).toBe(1); expect(portfolio.body.items[0].title).toBe('Northstar')
    const report = await request(app).post('/api/organization-intelligence/reports/generate').set('Authorization', `Bearer ${token('org-owner', 'organization')}`).send({ type: 'executive', window: '30d' })
    expect(report.status).toBe(201); expect(report.body.report.sourceLabels.overview).toBe('platform_calculated'); expect(db.organizationReports).toHaveLength(1)
  })
})
