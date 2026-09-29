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

function validToken(userId = 'user-uuid-1', role = 'founder') {
  return jwt.sign({ sub: userId, role }, TEST_SECRET, { expiresIn: '1h' })
}

function makeUser(id = 'user-uuid-1', email = 'alice@example.com') {
  return { id, email, passwordHash: 'irrelevant', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
}

function makeProfile(id = 'user-uuid-1', email = 'alice@example.com', role = 'founder') {
  return { id, email, firstName: 'Alice', lastName: 'Smith', role, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
}

function makeDb(overrides = {}) {
  return {
    users: [makeUser(), makeUser('user-uuid-2', 'bob@example.com'), makeUser('user-uuid-3', 'carol@example.com')],
    profiles: [makeProfile(), makeProfile('user-uuid-2', 'bob@example.com'), makeProfile('user-uuid-3', 'carol@example.com', 'collaborator')],
    notifications: [],
    files: [],
    endorsements: [],
    projects: [],
    workspaces: [],
    workspaceInvitations: [],
    workspaceMembers: [],
    projectAnalyses: [],
    equityGrants: [],
    dilutionEvents: [],
    collaboratorEarnings: [],
    payouts: [],
    contributions: [],
    organizationDashboards: [],
    investorWatchlists: [],
    dealFlowSnapshots: [],
    capitalPools: [],
    dealRooms: [],
    dataRooms: [],
    investorReputation: [],
    ventureIntakes: [],
    ventureAnalyses: [],
    hackathons: [],
    hackathonTeams: [],
    hackathonMembers: [],
    hackathonInvitations: [],
    hackathonBriefs: [],
    hackathonCheckIns: [],
    hackathonScores: [],
    hackathonTeamWorkspaces: [],
    hackathonTeamReports: [],
    hackathonFinalSubmissions: [],
    opportunities: [],
    workspaceTasks: [],
    workspaceAgents: [],
    workspaceConnectors: [],
    workspaceReports: [],
    walletAccounts: [],
    creditLedger: [],
    usageEvents: [],
    billingPlans: [],
    creditPackages: [],
    paymentIntents: [],
    subscriptions: [],
    invoices: [],
    notificationPreferences: [],
    settingsEvents: [],
    contracts: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  writeDb.mockImplementation(() => {})
  updateDb.mockImplementation(mutator => {
    const db = readDb()
    const result = mutator(db)
    writeDb(db)
    return result
  })
})

describe('domain live-data endpoints', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/domain/founder/projects')
    expect(res.status).toBe(401)
  })

  it('returns empty live states instead of fake projects, equity, and wallet usage', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const token = validToken()
    const projects = await request(app).get('/api/domain/founder/projects').set('Authorization', `Bearer ${token}`)
    const equity = await request(app).get('/api/domain/collaborator/equity').set('Authorization', `Bearer ${token}`)
    const wallet = await request(app).get('/api/domain/wallet/summary').set('Authorization', `Bearer ${token}`)

    expect(projects.status).toBe(200)
    expect(projects.body.projects).toEqual([])
    expect(equity.status).toBe(200)
    expect(equity.body.holdings).toEqual([])
    expect(equity.body.totals.totalValueUSD).toBe(0)
    expect(wallet.status).toBe(200)
    expect(wallet.body.creditBalance).toBe(0)
    expect(wallet.body.pendingPayments).toBe(0)
  })

  it('persists founder projects and scopes them to the authenticated owner', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const create = await request(app)
      .post('/api/domain/founder/projects')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ title: 'Real Venture', stage: 'mvp', industry: 'saas' })

    expect(create.status).toBe(201)
    expect(create.body.project.title).toBe('Real Venture')
    expect(db.projects).toHaveLength(1)
    expect(db.projects[0].ownerId).toBe('user-uuid-1')

    const own = await request(app).get('/api/domain/founder/projects').set('Authorization', `Bearer ${validToken()}`)
    const other = await request(app).get('/api/domain/founder/projects').set('Authorization', `Bearer ${validToken('user-uuid-2')}`)

    expect(own.body.projects).toHaveLength(1)
    expect(other.body.projects).toEqual([])
  })

  it('persists organization projects in an organization-owned scope', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const create = await request(app)
      .post('/api/domain/organization/projects')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organization')}`)
      .send({
        title: 'Portfolio Platform',
        industry: 'SaaS',
        stage: 'validation',
        status: 'on-track',
        progress: 42,
      })

    expect(create.status).toBe(201)
    expect(create.body.project).toMatchObject({
      title: 'Portfolio Platform',
      organizationId: 'user-uuid-1',
      stage: 'validation',
      progress: 42,
    })
    expect(db.projects[0].ownerId).toBeUndefined()

    const update = await request(app)
      .patch(`/api/domain/organization/projects/${create.body.project.id}`)
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organisation')}`)
      .send({ stage: 'development', progress: 68 })
    const own = await request(app)
      .get('/api/domain/organization/projects')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organization')}`)
    const other = await request(app)
      .get('/api/domain/organization/projects')
      .set('Authorization', `Bearer ${validToken('user-uuid-2', 'organization')}`)
    const founder = await request(app)
      .get('/api/domain/organization/projects')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'founder')}`)

    expect(update.status).toBe(200)
    expect(update.body.project).toMatchObject({ stage: 'development', progress: 68 })
    expect(own.body.projects).toHaveLength(1)
    expect(other.body.projects).toEqual([])
    expect(founder.status).toBe(403)
  })

  it('aggregates cohort health from real org projects with derived bands and alerts', async () => {
    const now = Date.now()
    const daysAgo = (d) => new Date(now - d * 86400000).toISOString()
    const db = makeDb({
      projects: [
        {
          id: 'proj_healthy', organizationId: 'user-uuid-1', title: 'Healthy Co',
          industry: 'SaaS', stage: 'growth', gsisScore: 82, progress: 70,
          marketReadyScore: 75, mrr: 5000, memberCount: 6, updatedAt: daysAgo(1),
        },
        {
          id: 'proj_stale', organizationId: 'user-uuid-1', title: 'Stale Co',
          industry: 'Fintech', stage: 'validation', gsisScore: 55, progress: 40,
          marketReadyScore: 50, mrr: 0, memberCount: 3, updatedAt: daysAgo(20),
        },
        {
          id: 'proj_red', organizationId: 'user-uuid-1', title: 'Struggling Co',
          industry: 'Health', stage: 'idea', gsisScore: 30, progress: 15,
          marketReadyScore: 20, mrr: 0, memberCount: 1, updatedAt: daysAgo(40),
        },
        // Different org — must NOT appear.
        {
          id: 'proj_other', organizationId: 'user-uuid-2', title: 'Other Org Co',
          industry: 'SaaS', stage: 'growth', gsisScore: 90, updatedAt: daysAgo(1),
        },
      ],
    })
    readDb.mockReturnValue(db)

    const res = await request(app)
      .get('/api/domain/organization/cohort-health')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organization')}`)

    expect(res.status).toBe(200)
    expect(res.body.cohort).toHaveLength(3)
    // Ranked by GSIS desc.
    expect(res.body.cohort.map((r) => r.id)).toEqual(['proj_healthy', 'proj_stale', 'proj_red'])
    // Derived bands.
    const byId = Object.fromEntries(res.body.cohort.map((r) => [r.id, r]))
    expect(byId.proj_healthy.band).toBe('green')
    expect(byId.proj_stale.band).toBe('amber')
    expect(byId.proj_red.band).toBe('red')
    // Derived inactivity.
    expect(byId.proj_red.daysInactive).toBeGreaterThanOrEqual(39)
    // Summary + alerts derived from real fields.
    expect(res.body.summary).toMatchObject({ total: 3, green: 1, amber: 1, red: 1 })
    expect(res.body.alerts.length).toBeGreaterThan(0)
    expect(res.body.alerts.some((a) => a.type === 'low_gsis')).toBe(true)
    expect(res.body.alerts.some((a) => a.type === 'inactivity')).toBe(true)
  })

  it('returns an empty cohort for an org with no projects', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)
    const res = await request(app)
      .get('/api/domain/organization/cohort-health')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organisation')}`)
    expect(res.status).toBe(200)
    expect(res.body.cohort).toEqual([])
    expect(res.body.summary).toMatchObject({ total: 0, avgGsis: 0 })
  })

  it('returns rule-based interventions with aiAvailable:false when ai-router is unreachable', async () => {
    const db = makeDb({
      projects: [{
        id: 'proj_red', organizationId: 'user-uuid-1', title: 'Struggling Co',
        industry: 'Health', stage: 'idea', gsisScore: 30, progress: 15,
        marketReadyScore: 20, updatedAt: new Date(Date.now() - 40 * 86400000).toISOString(),
      }],
    })
    readDb.mockReturnValue(db)
    // ai-router is not running in tests -> computeGsisNarrative returns null.
    const res = await request(app)
      .get('/api/domain/organization/interventions')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organization')}`)
    expect(res.status).toBe(200)
    expect(res.body.aiAvailable).toBe(false)
    expect(res.body.recommendations).toHaveLength(1)
    expect(res.body.recommendations[0]).toMatchObject({ projectId: 'proj_red', source: 'rule' })
    expect(res.body.recommendations[0].recommendation).toBeTruthy()
  })

  it('aggregates impact metrics from real org projects', async () => {
    const db = makeDb({
      projects: [
        { id: 'p1', organizationId: 'user-uuid-1', title: 'A', stage: 'growth', mrr: 3000, memberCount: 5, progress: 60, marketReadyScore: 70 },
        { id: 'p2', organizationId: 'user-uuid-1', title: 'B', stage: 'idea', mrr: 0, memberCount: 2, progress: 20, marketReadyScore: 30 },
        { id: 'pX', organizationId: 'user-uuid-2', title: 'Other', stage: 'growth', mrr: 9000, memberCount: 9 },
      ],
    })
    readDb.mockReturnValue(db)
    const res = await request(app)
      .get('/api/domain/organization/impact')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organization')}`)
    expect(res.status).toBe(200)
    expect(res.body.metrics).toMatchObject({ startups: 2, productsLaunched: 1, totalMrr: 3000, jobs: 7 })
    expect(res.body.charts.revenueByStartup).toHaveLength(1)
  })

  it('publishes an org-owned project to deal flow (org-scoped) and is idempotent', async () => {
    const db = makeDb({
      projects: [{ id: 'p1', organizationId: 'user-uuid-1', title: 'A', industry: 'SaaS', gsisScore: 80, mrr: 1000, marketReadyScore: 65 }],
    })
    readDb.mockReturnValue(db)
    const first = await request(app)
      .post('/api/domain/organization/demo-day/publish')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organization')}`)
      .send({ projectId: 'p1' })
    expect(first.status).toBe(200)
    expect(first.body.ok).toBe(true)
    expect(db.dealFlowSnapshots.find(s => s.projectId === 'p1' && s.organizationId === 'user-uuid-1')).toBeTruthy()
    const second = await request(app)
      .post('/api/domain/organization/demo-day/publish')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organization')}`)
      .send({ projectId: 'p1' })
    expect(second.body.alreadyPublished).toBe(true)
  })

  it('computes demo-day readiness checklist from real fields', async () => {
    const db = makeDb({
      projects: [{ id: 'p1', organizationId: 'user-uuid-1', title: 'A', gsisScore: 75, marketReadyScore: 60, mrr: 500, progress: 55, hasWorkspace: true }],
    })
    readDb.mockReturnValue(db)
    const res = await request(app)
      .get('/api/domain/organization/demo-day/pipeline?threshold=70')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organisation')}`)
    expect(res.status).toBe(200)
    expect(res.body.pipeline[0]).toMatchObject({ id: 'p1', investorReady: true, readyPct: 100 })
  })

  it('persists endorsements for real users and only lists those received by the authenticated user', async () => {
    const db = makeDb({
      projects: [{
        id: 'project_live',
        ownerId: 'user-uuid-2',
        title: 'Live Collaboration',
        visibility: 'public',
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
    })
    readDb.mockReturnValue(db)

    const create = await request(app)
      .post('/api/domain/endorsements')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        subjectUserId: 'user-uuid-2',
        quote: 'Delivered the persisted release on time.',
        projectId: 'project_live',
      })

    expect(create.status).toBe(201)
    expect(create.body.endorsement.authorId).toBe('user-uuid-1')
    expect(create.body.endorsement.subjectId).toBe('user-uuid-2')
    expect(create.body.endorsement.authorName).toBe('Alice Smith')
    expect(create.body.endorsement.projectName).toBe('Live Collaboration')

    const authorView = await request(app)
      .get('/api/domain/endorsements')
      .set('Authorization', `Bearer ${validToken()}`)
    const subjectView = await request(app)
      .get('/api/domain/endorsements')
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)

    expect(authorView.body.endorsements).toEqual([])
    expect(subjectView.body.endorsements).toHaveLength(1)
    expect(subjectView.body.endorsements[0].quote).toBe('Delivered the persisted release on time.')
  })

  it('rejects self-endorsements and unknown endorsement targets', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)
    const token = validToken()

    const self = await request(app)
      .post('/api/domain/endorsements')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectUserId: 'user-uuid-1', quote: 'Self review' })
    const missing = await request(app)
      .post('/api/domain/endorsements')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectUserId: 'missing-user', quote: 'Unknown review' })
    const missingProject = await request(app)
      .post('/api/domain/endorsements')
      .set('Authorization', `Bearer ${token}`)
      .send({ subjectUserId: 'user-uuid-2', quote: 'Project review', projectId: 'missing-project' })

    expect(self.status).toBe(400)
    expect(self.body.error).toBe('self_endorsement_not_allowed')
    expect(missing.status).toBe(404)
    expect(missingProject.status).toBe(404)
    expect(missingProject.body.error).toBe('project_not_found')
    expect(db.endorsements).toEqual([])
  })

  it('persists incubation intake and promotes it into a real project', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const intake = await request(app)
      .post('/api/domain/incubation/intakes')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ submission: { startup_name: 'IntakeOS' }, structuredProfile: { industry: 'AI' } })

    expect(intake.status).toBe(201)
    const intakeId = intake.body.intake.id

    const promote = await request(app)
      .post(`/api/domain/incubation/intakes/${intakeId}/promote`)
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ title: 'IntakeOS' })

    expect(promote.status).toBe(201)
    expect(promote.body.project.title).toBe('IntakeOS')
    expect(promote.body.project.origin).toEqual({ kind: 'venture_intake', intakeId })
    expect(db.ventureIntakes[0].promotedProjectId).toBe(promote.body.project.id)
  })

  it('provisions workspace from persisted project analysis context', async () => {
    const db = makeDb({
      projects: [{ id: 'project_live', ownerId: 'user-uuid-1', title: 'Live Project', createdAt: '2026-01-01T00:00:00.000Z' }],
      projectAnalyses: [{
        id: 'analysis_live',
        ownerId: 'user-uuid-1',
        projectId: 'project_live',
        blueprint: { venture_name: 'Live Project', investment_score: 80 },
        createdAt: '2026-01-02T00:00:00.000Z',
      }],
    })
    readDb.mockReturnValue(db)

    const provision = await request(app)
      .post('/api/domain/workspaces/provision')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ projectId: 'project_live', name: 'Live Workspace' })

    expect(provision.status).toBe(201)
    expect(provision.body.workspace.seededFromAnalysis).toBe(true)

    const context = await request(app)
      .get(`/api/domain/workspaces/${provision.body.workspace.id}/context`)
      .set('Authorization', `Bearer ${validToken()}`)

    expect(context.status).toBe(200)
    expect(context.body.projectId).toBe('project_live')
    expect(context.body.blueprintAvailable).toBe(true)
    expect(context.body.venture.investment_score).toBe(80)
  })

  it('invites a collaborator and grants least-privilege workspace membership on acceptance', async () => {
    const db = makeDb({
      workspaces: [{ id: 'workspace_1', ownerId: 'user-uuid-1', projectId: 'project_live', name: 'LedgerCare Workspace' }],
      workspaceConnectors: [{ id: 'connector_1', ownerId: 'user-uuid-1', workspaceId: 'workspace_1', provider: 'github' }],
    })
    readDb.mockReturnValue(db)

    const invite = await request(app)
      .post('/api/domain/workspaces/workspace_1/invitations')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        collaboratorId: 'user-uuid-3',
        requestedRole: 'Backend Engineer',
        scope: 'Own and test the reconciliation API.',
        requiredSkills: ['Node.js', 'Postgres'],
        compensationMode: 'equity-heavy',
        equityProposal: 4,
        accessLevel: 'contributor',
      })

    expect(invite.status).toBe(201)
    expect(invite.body.invitation).toMatchObject({
      workspaceId: 'workspace_1',
      collaboratorId: 'user-uuid-3',
      accessLevel: 'contributor',
      status: 'pending',
    })
    expect(db.notifications[0].linkTo).toBe(`/workspace-invitations/${invite.body.invitation.id}`)

    const hidden = await request(app)
      .get(`/api/domain/workspace-invitations/${invite.body.invitation.id}`)
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
    expect(hidden.status).toBe(404)

    const accepted = await request(app)
      .post(`/api/domain/workspace-invitations/${invite.body.invitation.id}/accept`)
      .set('Authorization', `Bearer ${validToken('user-uuid-3', 'collaborator')}`)
    expect(accepted.status).toBe(200)
    expect(accepted.body.membership).toMatchObject({
      workspaceId: 'workspace_1',
      userId: 'user-uuid-3',
      accessLevel: 'contributor',
      status: 'active',
    })

    const collaboratorWorkspaces = await request(app)
      .get('/api/domain/workspaces')
      .set('Authorization', `Bearer ${validToken('user-uuid-3', 'collaborator')}`)
    expect(collaboratorWorkspaces.body.workspaces[0]).toMatchObject({
      id: 'workspace_1',
      isOwner: false,
      accessLevel: 'contributor',
    })

    const task = await request(app)
      .post('/api/domain/workspaces/workspace_1/tasks')
      .set('Authorization', `Bearer ${validToken('user-uuid-3', 'collaborator')}`)
      .send({ title: 'Implement reconciliation endpoint' })
    expect(task.status).toBe(201)

    const connectors = await request(app)
      .get('/api/domain/workspaces/workspace_1/connectors')
      .set('Authorization', `Bearer ${validToken('user-uuid-3', 'collaborator')}`)
    expect(connectors.status).toBe(200)
    expect(connectors.body.connectors).toEqual([])

    const removed = await request(app)
      .delete(`/api/domain/workspaces/workspace_1/members/${accepted.body.membership.id}`)
      .set('Authorization', `Bearer ${validToken()}`)
    expect(removed.status).toBe(200)

    const contextAfterRemoval = await request(app)
      .get('/api/domain/workspaces/workspace_1/context')
      .set('Authorization', `Bearer ${validToken('user-uuid-3', 'collaborator')}`)
    expect(contextAfterRemoval.status).toBe(404)
  })

  it('patches owned workspace collection items and generic opportunity records', async () => {
    const db = makeDb({
      workspaces: [{ id: 'workspace_1', ownerId: 'user-uuid-1', projectId: 'project_live', name: 'Live Workspace' }],
      workspaceTasks: [{
        id: 'task_1',
        ownerId: 'user-uuid-1',
        workspaceId: 'workspace_1',
        title: 'Ship live task',
        status: 'pending',
        deadline: '2026-07-15',
      }],
      opportunities: [{
        id: 'opp_1',
        ownerId: 'user-uuid-1',
        title: 'Live Opportunity',
        status: 'open',
      }],
    })
    readDb.mockReturnValue(db)

    const taskPatch = await request(app)
      .patch('/api/domain/workspaces/workspace_1/tasks/task_1')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ status: 'completed', deadline: '2026-07-16' })

    expect(taskPatch.status).toBe(200)
    expect(taskPatch.body.task.status).toBe('completed')
    expect(taskPatch.body.task.workspaceId).toBe('workspace_1')
    expect(db.workspaceTasks[0].deadline).toBe('2026-07-16')

    const otherUserPatch = await request(app)
      .patch('/api/domain/workspaces/workspace_1/tasks/task_1')
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({ status: 'completed' })

    expect(otherUserPatch.status).toBe(404)

    const oppPatch = await request(app)
      .patch('/api/domain/opportunities/opp_1')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ status: 'applied' })

    expect(oppPatch.status).toBe(200)
    expect(oppPatch.body.opportunity.status).toBe('applied')
    expect(db.opportunities[0].ownerId).toBe('user-uuid-1')
  })

  it('publishes an ownership-first collaboration call to selected role hubs', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const res = await request(app)
      .post('/api/domain/opportunities/collaboration-calls')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        projectId: 'project_live',
        company: 'LedgerCare',
        summary: 'LedgerCare helps clinics reconcile patient payments.',
        scope: 'Own and test the reconciliation API.',
        role: 'Backend Engineer',
        skills: ['Node.js', 'Postgres'],
        compensationMode: 'equity-heavy',
        equityPercent: 4,
        cashCompMonthly: 5000,
        audienceRoles: ['collaborator', 'founder', 'explorer', 'admin'],
        timeCommitment: '20 hrs/week',
      })

    expect(res.status).toBe(201)
    expect(res.body.opportunity).toMatchObject({
      type: 'collaboration',
      visibility: 'public',
      ownerId: 'user-uuid-1',
      compensationMode: 'equity-heavy',
      equityPercent: 4,
      cashCompMonthly: 0,
      audienceRoles: ['collaborator', 'founder', 'explorer'],
    })

    const duplicate = await request(app)
      .post('/api/domain/opportunities/collaboration-calls')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        projectId: 'project_live',
        company: 'LedgerCare',
        summary: 'LedgerCare helps clinics reconcile patient payments.',
        scope: 'Own and test the reconciliation API.',
        role: 'Backend Engineer',
        compensationMode: 'equity-heavy',
        equityPercent: 4,
        audienceRoles: ['collaborator'],
      })
    expect(duplicate.status).toBe(200)
    expect(db.opportunities).toHaveLength(1)
  })

  it('rejects an ownership-first call with no ownership proposal', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const res = await request(app)
      .post('/api/domain/opportunities/collaboration-calls')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        projectId: 'project_live',
        company: 'LedgerCare',
        summary: 'LedgerCare helps clinics reconcile patient payments.',
        scope: 'Own and test the reconciliation API.',
        role: 'Backend Engineer',
        compensationMode: 'equity-heavy',
        equityPercent: 0,
        audienceRoles: ['collaborator'],
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('ownership_proposal_required')
    expect(db.opportunities).toHaveLength(0)
  })

  it('aggregates hackathon command-center metrics from persisted team activity', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)
    const token = validToken('user-uuid-1', 'organisation')

    const hack = await request(app)
      .post('/api/domain/hackathons')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Live Build Sprint', visibility: 'public', status: 'live' })

    const hackathonId = hack.body.hackathon.id
    const register = await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/register`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Team Live', members: [{ name: 'Alice', role: 'Founder' }, { name: 'Bob', role: 'Builder' }] })

    const teamId = register.body.team.id
    await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/brief`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId, problem: 'A painful workflow problem', solution: 'A useful product', teamMomentum: 70, demoReadinessHours: 8 })
    await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/checkin`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId, note: 'Built the prototype', progressDelta: 12 })

    const overview = await request(app).get(`/api/domain/hackathons/${hackathonId}/overview`).set('Authorization', `Bearer ${token}`)
    const velocity = await request(app).get(`/api/domain/hackathons/${hackathonId}/velocity`).set('Authorization', `Bearer ${token}`)
    const leaderboard = await request(app).get(`/api/domain/hackathons/${hackathonId}/leaderboard`).set('Authorization', `Bearer ${token}`)

    expect(overview.status).toBe(200)
    expect(overview.body.registrants).toBe(3)
    expect(overview.body.teamsFormed).toBe(1)
    expect(overview.body.totalTeams).toBe(1)
    expect(overview.body.ideaSubmissions).toBe(1)
    expect(overview.body.avgBuildVelocity).toBeGreaterThan(0)
    expect(velocity.body.teams[0].teamId).toBe(teamId)
    expect(leaderboard.body.leaderboard[0].teamId).toBe(teamId)
  })

  it('persists the full hackathon registration, invitation, workspace, submission, and promotion flow', async () => {
    const db = makeDb({
      users: [
        makeUser('user-uuid-1', 'org@example.com'),
        makeUser('user-uuid-2', 'founder@example.com'),
        makeUser('user-uuid-3', 'builder@example.com'),
      ],
      profiles: [
        makeProfile('user-uuid-1', 'org@example.com', 'organisation'),
        { ...makeProfile('user-uuid-2', 'founder@example.com', 'founder'), firstName: 'Founding', lastName: 'Lead' },
        { ...makeProfile('user-uuid-3', 'builder@example.com', 'collaborator'), firstName: 'Live', lastName: 'Builder' },
      ],
    })
    readDb.mockReturnValue(db)

    const created = await request(app)
      .post('/api/domain/hackathons')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organisation')}`)
      .send({
        title: 'Persisted Build Sprint',
        theme: 'Ship a live product',
        summary: 'A database-backed hackathon.',
        visibility: 'public',
        status: 'upcoming',
        applyDeadline: '2026-08-01',
        startDate: '2026-08-02',
        endDate: '2026-08-04',
        durationHours: 48,
        prizePool: '$10,000',
        eligibility: 'Open to verified builders',
        prizes: [{ rank: '1st place', amount: '$10,000' }],
        judgingDimensions: ['problem_clarity', 'technical_execution', 'commercial_viability'],
        mentorPool: 6,
        partners: ['Live Partner'],
        tags: ['Build'],
      })

    const hackathonId = created.body.hackathon.id
    const organizerCatalog = await request(app)
      .get('/api/domain/hackathons?scope=owned')
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organisation')}`)
    expect(organizerCatalog.body.hackathons[0].ownerId).toBe('user-uuid-1')

    const catalog = await request(app)
      .get('/api/domain/hackathons')
      .set('Authorization', `Bearer ${validToken('user-uuid-3', 'collaborator')}`)
    expect(catalog.body.hackathons[0]).toMatchObject({
      id: hackathonId,
      title: 'Persisted Build Sprint',
      summary: 'A database-backed hackathon.',
      durationHours: 48,
      eligibility: 'Open to verified builders',
      prizes: [{ rank: '1st place', amount: '$10,000' }],
      judgingDimensions: ['problem_clarity', 'technical_execution', 'commercial_viability'],
      mentorPool: 6,
      partners: ['Live Partner'],
      registrants: 0,
      teamsFormed: 0,
      stillSolo: 0,
    })

    const registered = await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/register`)
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({
        teamName: 'Persistent Team',
        teamSize: 2,
        inviteToken: 'invite-live',
        openRoles: ['Backend Engineer'],
      })

    expect(registered.status).toBe(201)
    expect(registered.body.registration).toMatchObject({
      hackathonId,
      teamName: 'Persistent Team',
      teamSize: 2,
      role: 'leader',
      openRoles: ['Backend Engineer'],
      stage: 'registered',
    })
    const teamId = registered.body.registration.teamId
    const detail = await request(app)
      .get(`/api/domain/hackathons/${hackathonId}`)
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organisation')}`)
    expect(detail.body.hackathon).toMatchObject({
      id: hackathonId,
      registrants: 1,
      teamsFormed: 1,
      stillSolo: 1,
    })

    const targetedInvite = await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/teams/${teamId}/invitations`)
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({ collaboratorId: 'user-uuid-3', role: 'Backend Engineer' })
    expect(targetedInvite.status).toBe(201)
    expect(targetedInvite.body.invitation).toMatchObject({
      hackathonId,
      teamId,
      collaboratorId: 'user-uuid-3',
      role: 'Backend Engineer',
      status: 'pending',
    })
    expect(targetedInvite.body.invitation).not.toHaveProperty('token')
    expect(db.hackathonMembers).toHaveLength(0)
    expect(db.notifications[0]).toMatchObject({
      userId: 'user-uuid-3',
      actorId: 'user-uuid-2',
      type: 'collab',
      read: false,
    })
    const targetedToken = db.hackathonInvitations[0].token
    expect(db.notifications[0].linkTo).toContain(encodeURIComponent(targetedToken))

    const wrongRecipient = await request(app)
      .get(`/api/domain/hackathons/${hackathonId}/teams/${teamId}/invite?token=${encodeURIComponent(targetedToken)}`)
      .set('Authorization', `Bearer ${validToken('user-uuid-1', 'organisation')}`)
    expect(wrongRecipient.status).toBe(403)
    expect(wrongRecipient.body.error).toBe('invite_token_invalid')

    const invite = await request(app)
      .get(`/api/domain/hackathons/${hackathonId}/teams/${teamId}/invite?token=${encodeURIComponent(targetedToken)}`)
      .set('Authorization', `Bearer ${validToken('user-uuid-3', 'collaborator')}`)
    expect(invite.status).toBe(200)
    expect(invite.body.invite).toMatchObject({
      teamName: 'Persistent Team',
      leaderName: 'Founding Lead',
      openRoles: ['Backend Engineer'],
      isLeader: false,
      invitedRole: 'Backend Engineer',
    })

    const accepted = await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/teams/${teamId}/invite`)
      .set('Authorization', `Bearer ${validToken('user-uuid-3', 'collaborator')}`)
      .send({ token: targetedToken, role: 'Backend Engineer' })
    expect(accepted.status).toBe(201)
    expect(accepted.body.registration.role).toBe('member')
    expect(accepted.body.registration.openRoles).toEqual([])
    expect(db.hackathonInvitations[0].status).toBe('accepted')

    const roster = await request(app)
      .patch(`/api/domain/hackathons/${hackathonId}/teams/${teamId}`)
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({ rosterClosed: true })
    expect(roster.body.registration.rosterClosed).toBe(true)

    const briefScore = {
      overall: 82,
      problemClarity: 84,
      innovationGap: 80,
      initialImpact: 81,
      critiques: { problemClarity: [], innovationGap: [], initialImpact: [] },
    }
    await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/brief`)
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({
        teamId,
        problem: 'A sufficiently clear persisted problem statement.',
        solution: 'A persisted solution.',
        fields: { problem: 'A sufficiently clear persisted problem statement.', targetUser: 'Builders' },
        briefScore,
      })
    await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/checkin`)
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({ teamId, note: 'Shipped the API.', status: 'on-track', progressDelta: 15 })

    const submission = {
      demoUrl: 'https://example.com/demo',
      deckUrl: 'https://example.com/deck',
      videoUrl: 'https://example.com/video',
      summary: 'A persisted final submission that survives application reloads.',
      submittedAt: '2026-08-04T10:00:00.000Z',
    }
    const judgeFeedback = {
      placement: 1,
      cohortSize: 1,
      comments: ['Persisted result'],
      judgedAt: '2026-08-04T10:01:00.000Z',
    }
    const final = await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/teams/${teamId}/final`)
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({ submission, judgeFeedback })
    expect(final.status).toBe(201)
    expect(final.body.registration.stage).toBe('submitted-final')

    const leaderRegistrations = await request(app)
      .get('/api/domain/hackathons/registrations')
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
    const memberRegistrations = await request(app)
      .get('/api/domain/hackathons/registrations')
      .set('Authorization', `Bearer ${validToken('user-uuid-3', 'collaborator')}`)

    expect(leaderRegistrations.body.registrations[0]).toMatchObject({
      teamId,
      role: 'leader',
      rosterClosed: true,
      briefScore,
      finalSubmission: submission,
      judgeFeedback,
    })
    expect(leaderRegistrations.body.registrations[0].checkIns[0].update).toBe('Shipped the API.')
    expect(memberRegistrations.body.registrations[0]).toMatchObject({
      teamId,
      role: 'member',
    })

    const provisioned = await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/teams/${teamId}/workspace`)
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({})
    const provisionedAgain = await request(app)
      .post(`/api/domain/hackathons/${hackathonId}/teams/${teamId}/workspace`)
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({})
    expect(provisioned.status).toBe(201)
    expect(provisionedAgain.body.workspace.id).toBe(provisioned.body.workspace.id)
    expect(db.workspaces).toHaveLength(1)
    expect(db.hackathonTeamWorkspaces).toHaveLength(1)

    const promoted = await request(app)
      .post('/api/domain/founder/projects')
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
      .send({
        title: 'Persistent Team Startup',
        stage: 'mvp',
        origin: { kind: 'hackathon_promote', hackathonId, teamId },
      })
    expect(promoted.status).toBe(201)
    expect(db.hackathonTeams[0].promotedProjectId).toBe(promoted.body.project.id)
    expect(db.hackathonTeamWorkspaces[0].projectId).toBe(promoted.body.project.id)
    expect(db.workspaces[0].projectId).toBe(promoted.body.project.id)
  })

  it('persists wallet payment intents and derives pending payment counts from storage', async () => {
    const db = makeDb({ walletAccounts: [{ id: 'wallet_1', userId: 'user-uuid-1', creditBalance: 25 }] })
    readDb.mockReturnValue(db)

    const intent = await request(app)
      .post('/api/domain/wallet/payment-intents')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({ amount: 5000, currency: 'NGN', credits: 550 })

    expect(intent.status).toBe(201)
    expect(db.paymentIntents).toHaveLength(1)

    const summary = await request(app).get('/api/domain/wallet/summary').set('Authorization', `Bearer ${validToken()}`)
    expect(summary.body.creditBalance).toBe(25)
    expect(summary.body.pendingPayments).toBe(1)
  })

  it('counts a settled usage debit once in the wallet balance', async () => {
    const db = makeDb({
      walletAccounts: [{ id: 'wallet_1', userId: 'user-uuid-1', creditBalance: 25 }],
      creditLedger: [{ id: 'debit_1', userId: 'user-uuid-1', deltaCredits: -5, type: 'usage_settlement' }],
      usageEvents: [{ id: 'usage_1', userId: 'user-uuid-1', credits: 5, status: 'completed' }],
    })
    readDb.mockReturnValue(db)
    const summary = await request(app).get('/api/domain/wallet/summary').set('Authorization', `Bearer ${validToken()}`)
    expect(summary.body.creditBalance).toBe(20)
    expect(summary.body.lifetimeCreditsUsed).toBe(5)
  })

  it('reports wallet source totals, observed deduction order, and subscription usage', async () => {
    const now = new Date().toISOString()
    const db = makeDb({
      walletAccounts: [{ id: 'wallet_1', userId: 'user-uuid-1', creditBalance: 25, label: 'Monthly credits', expiresAt: '2030-01-01T00:00:00.000Z' }],
      usageEvents: [
        { id: 'usage_1', userId: 'user-uuid-1', credits: 4, status: 'completed', fundingSource: 'subscription', createdAt: now },
        { id: 'usage_2', userId: 'user-uuid-1', credits: 9, status: 'completed', fundingSource: 'platform_subsidy', createdAt: now },
        { id: 'usage_3', userId: 'user-uuid-1', credits: 3, status: 'reserved', fundingSource: 'payg', createdAt: now },
      ],
      subscriptions: [{ id: 'sub_1', userId: 'user-uuid-1', planId: 'plan_pro', status: 'active', currentPeriodEnd: '2030-01-01T00:00:00.000Z' }],
      billingPlans: [{ id: 'plan_pro', credits: 100 }],
    })
    readDb.mockReturnValue(db)
    const summary = await request(app).get('/api/domain/wallet/summary').set('Authorization', `Bearer ${validToken()}`)
    expect(summary.body.sourceTotals).toEqual({ subscription: 4, platform_subsidy: 9 })
    expect(summary.body.deductionOrder).toEqual(['platform_subsidy', 'subscription'])
    expect(summary.body.subscriptionUsage).toMatchObject({ included: 100, consumed: 4, remaining: 96 })
    expect(summary.body.expirationAlerts).toEqual([{ walletId: 'wallet_1', message: 'Monthly credits expires soon.', expiresAt: '2030-01-01T00:00:00.000Z' }])
  })

  it('returns wallet consumption analytics bucketed by funding source', async () => {
    const now = new Date().toISOString()
    const db = makeDb({
      usageEvents: [
        { id: 'usage_1', userId: 'user-uuid-1', credits: 5, status: 'completed', fundingSource: 'payg', createdAt: now },
        { id: 'usage_2', userId: 'user-uuid-1', credits: 7, status: 'completed', fundingSource: 'subscription', createdAt: now },
      ],
    })
    readDb.mockReturnValue(db)
    const res = await request(app).get('/api/domain/wallet/analytics?period=daily').set('Authorization', `Bearer ${validToken()}`)
    expect(res.status).toBe(200)
    expect(res.body.period).toBe('daily')
    expect(res.body.sourceTotals).toEqual({ payg: 5, subscription: 7 })
    expect(res.body.totalConsumed).toBe(12)
    expect(res.body.points).toHaveLength(2)
    expect(res.body.points.every(point => point.displayPercent > 0)).toBe(true)
  })

  it('persists role-scoped notification preferences without overwriting another role', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)
    const token = validToken()

    await request(app)
      .patch('/api/domain/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'founder', preferences: { quietHours: 'weekends' } })
    const collaborator = await request(app)
      .patch('/api/domain/notifications/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ scope: 'collaborator', preferences: { quietHours: 'off' } })

    expect(collaborator.status).toBe(200)
    expect(collaborator.body.preferences).toEqual({
      founder: { quietHours: 'weekends' },
      collaborator: { quietHours: 'off' },
    })
  })

  it('creates a contract draft with correct shape and ownership', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const create = await request(app)
      .post('/api/domain/contracts')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        collaboratorId: 'user-uuid-2',
        collaboratorName: 'Bob',
        projectName: 'Test Project',
        role: 'Backend Engineer',
        equityPercent: 5,
        weeklyHours: 20,
        skills: ['Node.js', 'PostgreSQL'],
        vestingMonths: 48,
        cliffMonths: 12,
      })

    expect(create.status).toBe(201)
    expect(create.body.contract).toMatchObject({
      founderId: 'user-uuid-1',
      collaboratorId: 'user-uuid-2',
      collaboratorName: 'Bob',
      projectName: 'Test Project',
      role: 'Backend Engineer',
      equityPercent: 5,
      weeklyHours: 20,
      skills: ['Node.js', 'PostgreSQL'],
      vestingMonths: 48,
      cliffMonths: 12,
      status: 'draft',
      founderSignedAt: null,
      founderSignature: null,
      collaboratorSignedAt: null,
      collaboratorSignature: null,
    })
    expect(create.body.contract.id).toMatch(/^contract_/)
    expect(db.contracts).toHaveLength(1)
  })

  it('lists contracts for both founder and collaborator', async () => {
    const db = makeDb({
      contracts: [
        {
          id: 'contract_1',
          founderId: 'user-uuid-1',
          collaboratorId: 'user-uuid-2',
          collaboratorName: 'Bob',
          projectName: 'Project A',
          role: 'Developer',
          equityPercent: 3,
          weeklyHours: 15,
          skills: [],
          vestingMonths: 48,
          cliffMonths: 12,
          status: 'draft',
          founderSignedAt: null,
          founderSignature: null,
          collaboratorSignedAt: null,
          collaboratorSignature: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    readDb.mockReturnValue(db)

    const founderView = await request(app)
      .get('/api/domain/contracts')
      .set('Authorization', `Bearer ${validToken('user-uuid-1')}`)
    const collaboratorView = await request(app)
      .get('/api/domain/contracts')
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
    const otherUserView = await request(app)
      .get('/api/domain/contracts')
      .set('Authorization', `Bearer ${validToken('user-uuid-3')}`)

    expect(founderView.status).toBe(200)
    expect(founderView.body.contracts).toHaveLength(1)
    expect(founderView.body.contracts[0].id).toBe('contract_1')

    expect(collaboratorView.status).toBe(200)
    expect(collaboratorView.body.contracts).toHaveLength(1)
    expect(collaboratorView.body.contracts[0].id).toBe('contract_1')

    expect(otherUserView.status).toBe(200)
    expect(otherUserView.body.contracts).toEqual([])
  })

  it('allows collaborator to sign contract and updates status', async () => {
    const db = makeDb({
      contracts: [
        {
          id: 'contract_1',
          founderId: 'user-uuid-1',
          collaboratorId: 'user-uuid-2',
          collaboratorName: 'Bob',
          projectName: 'Project A',
          role: 'Developer',
          equityPercent: 3,
          weeklyHours: 15,
          skills: [],
          vestingMonths: 48,
          cliffMonths: 12,
          status: 'draft',
          founderSignedAt: null,
          founderSignature: null,
          collaboratorSignedAt: null,
          collaboratorSignature: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    readDb.mockReturnValue(db)

    const sign = await request(app)
      .patch('/api/domain/contracts/contract_1/sign')
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)

    expect(sign.status).toBe(200)
    expect(sign.body.contract.collaboratorSignedAt).toBeTruthy()
    expect(sign.body.contract.collaboratorSignature).toBe('user-uuid-2')
    expect(sign.body.contract.status).toBe('pending-countersign')
    expect(db.contracts[0].status).toBe('pending-countersign')
  })

  it('allows founder to countersign contract and updates status', async () => {
    const db = makeDb({
      contracts: [
        {
          id: 'contract_1',
          founderId: 'user-uuid-1',
          collaboratorId: 'user-uuid-2',
          collaboratorName: 'Bob',
          projectName: 'Project A',
          role: 'Developer',
          equityPercent: 3,
          weeklyHours: 15,
          skills: [],
          vestingMonths: 48,
          cliffMonths: 12,
          status: 'draft',
          founderSignedAt: null,
          founderSignature: null,
          collaboratorSignedAt: null,
          collaboratorSignature: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    readDb.mockReturnValue(db)

    const countersign = await request(app)
      .patch('/api/domain/contracts/contract_1/countersign')
      .set('Authorization', `Bearer ${validToken('user-uuid-1')}`)

    expect(countersign.status).toBe(200)
    expect(countersign.body.contract.founderSignedAt).toBeTruthy()
    expect(countersign.body.contract.founderSignature).toBe('user-uuid-1')
    expect(countersign.body.contract.status).toBe('pending-signature')
    expect(db.contracts[0].status).toBe('pending-signature')
  })

  it('makes contract active when both parties have signed', async () => {
    const db = makeDb({
      contracts: [
        {
          id: 'contract_1',
          founderId: 'user-uuid-1',
          collaboratorId: 'user-uuid-2',
          collaboratorName: 'Bob',
          projectName: 'Project A',
          role: 'Developer',
          equityPercent: 3,
          weeklyHours: 15,
          skills: [],
          vestingMonths: 48,
          cliffMonths: 12,
          status: 'draft',
          founderSignedAt: null,
          founderSignature: null,
          collaboratorSignedAt: null,
          collaboratorSignature: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    readDb.mockReturnValue(db)

    await request(app)
      .patch('/api/domain/contracts/contract_1/countersign')
      .set('Authorization', `Bearer ${validToken('user-uuid-1')}`)

    const sign = await request(app)
      .patch('/api/domain/contracts/contract_1/sign')
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)

    expect(sign.status).toBe(200)
    expect(sign.body.contract.status).toBe('active')
    expect(db.contracts[0].status).toBe('active')
    expect(db.contracts[0].founderSignedAt).toBeTruthy()
    expect(db.contracts[0].collaboratorSignedAt).toBeTruthy()
  })

  it('prevents unauthorized user from signing another user contract', async () => {
    const db = makeDb({
      contracts: [
        {
          id: 'contract_1',
          founderId: 'user-uuid-1',
          collaboratorId: 'user-uuid-2',
          collaboratorName: 'Bob',
          projectName: 'Project A',
          role: 'Developer',
          equityPercent: 3,
          weeklyHours: 15,
          skills: [],
          vestingMonths: 48,
          cliffMonths: 12,
          status: 'draft',
          founderSignedAt: null,
          founderSignature: null,
          collaboratorSignedAt: null,
          collaboratorSignature: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    readDb.mockReturnValue(db)

    const unauthorizedSign = await request(app)
      .patch('/api/domain/contracts/contract_1/sign')
      .set('Authorization', `Bearer ${validToken('user-uuid-3')}`)

    expect(unauthorizedSign.status).toBe(404)
    expect(db.contracts[0].collaboratorSignedAt).toBeNull()
  })

  it('rejects self-contract creation', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const selfContract = await request(app)
      .post('/api/domain/contracts')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        collaboratorId: 'user-uuid-1',
        collaboratorName: 'Alice',
        projectName: 'Self Project',
        role: 'Developer',
        equityPercent: 5,
        weeklyHours: 20,
        skills: [],
      })

    expect(selfContract.status).toBe(400)
    expect(selfContract.body.error).toBe('self_contract_not_allowed')
    expect(db.contracts).toEqual([])
  })

  it('rejects contract creation with unknown collaborator', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const unknownCollaborator = await request(app)
      .post('/api/domain/contracts')
      .set('Authorization', `Bearer ${validToken()}`)
      .send({
        collaboratorId: 'unknown-user',
        collaboratorName: 'Unknown',
        projectName: 'Test Project',
        role: 'Developer',
        equityPercent: 5,
        weeklyHours: 20,
        skills: [],
      })

    expect(unknownCollaborator.status).toBe(404)
    expect(unknownCollaborator.body.error).toBe('collaborator_not_found')
    expect(db.contracts).toEqual([])
  })

  it('gets single contract only if user is party to it', async () => {
    const db = makeDb({
      contracts: [
        {
          id: 'contract_1',
          founderId: 'user-uuid-1',
          collaboratorId: 'user-uuid-2',
          collaboratorName: 'Bob',
          projectName: 'Project A',
          role: 'Developer',
          equityPercent: 3,
          weeklyHours: 15,
          skills: [],
          vestingMonths: 48,
          cliffMonths: 12,
          status: 'draft',
          founderSignedAt: null,
          founderSignature: null,
          collaboratorSignedAt: null,
          collaboratorSignature: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    readDb.mockReturnValue(db)

    const founderGet = await request(app)
      .get('/api/domain/contracts/contract_1')
      .set('Authorization', `Bearer ${validToken('user-uuid-1')}`)
    const collaboratorGet = await request(app)
      .get('/api/domain/contracts/contract_1')
      .set('Authorization', `Bearer ${validToken('user-uuid-2')}`)
    const unauthorizedGet = await request(app)
      .get('/api/domain/contracts/contract_1')
      .set('Authorization', `Bearer ${validToken('user-uuid-3')}`)

    expect(founderGet.status).toBe(200)
    expect(founderGet.body.contract.id).toBe('contract_1')

    expect(collaboratorGet.status).toBe(200)
    expect(collaboratorGet.body.contract.id).toBe('contract_1')

    expect(unauthorizedGet.status).toBe(404)
  })

  it('returns empty contributions and zero scores for new collaborators', async () => {
    const db = makeDb()
    readDb.mockReturnValue(db)

    const token = validToken()
    const contributions = await request(app)
      .get('/api/domain/collaborator/contributions')
      .set('Authorization', `Bearer ${token}`)
    const scores = await request(app)
      .get('/api/domain/collaborator/scores')
      .set('Authorization', `Bearer ${token}`)

    expect(contributions.status).toBe(200)
    expect(contributions.body.contributions).toEqual([])
    expect(scores.status).toBe(200)
    expect(scores.body.scores.cbs).toBe(0)
    expect(scores.body.scores.tss).toEqual({})
    expect(scores.body.scores.crs).toBe(0)
  })

  it('calculates CBS, TSS, and CRS based on verified contributions', async () => {
    const db = makeDb({
      contributions: [
        {
          id: 'contrib_1',
          collaboratorId: 'user-uuid-1',
          projectId: 'proj_1',
          projectName: 'Project Alpha',
          role: 'Backend Developer',
          startDate: '2026-01-01',
          endDate: '2026-06-01',
          milestonesShipped: 5,
          gsisChange: 10,
          technologies: ['Node.js', 'PostgreSQL'],
          verified: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'contrib_2',
          collaboratorId: 'user-uuid-1',
          projectId: 'proj_2',
          projectName: 'Project Beta',
          role: 'Full Stack Developer',
          startDate: '2026-02-01',
          endDate: null,
          milestonesShipped: 3,
          gsisChange: 5,
          technologies: ['Node.js', 'React'],
          verified: true,
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
        {
          id: 'contrib_3',
          collaboratorId: 'user-uuid-1',
          projectId: 'proj_3',
          projectName: 'Project Gamma',
          role: 'Contributor',
          startDate: '2026-03-01',
          endDate: null,
          milestonesShipped: 0,
          gsisChange: 0,
          technologies: [],
          verified: false,
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
    })
    readDb.mockReturnValue(db)

    const contributions = await request(app)
      .get('/api/domain/collaborator/contributions')
      .set('Authorization', `Bearer ${validToken('user-uuid-1')}`)
    const scores = await request(app)
      .get('/api/domain/collaborator/scores')
      .set('Authorization', `Bearer ${validToken('user-uuid-1')}`)

    expect(contributions.status).toBe(200)
    expect(contributions.body.contributions).toHaveLength(3)

    expect(scores.status).toBe(200)
    // CBS: 2 verified projects * 15 + 8 total milestones * 5 = 30 + 40 = 70
    expect(scores.body.scores.cbs).toBe(70)
    // TSS: Node.js appears twice (20), PostgreSQL once (10), React once (10)
    expect(scores.body.scores.tss['Node.js']).toBe(20)
    expect(scores.body.scores.tss['PostgreSQL']).toBe(10)
    expect(scores.body.scores.tss['React']).toBe(10)
    // CRS: 2 verified out of 3 total = 67%
    expect(scores.body.scores.crs).toBe(67)
  })
})
