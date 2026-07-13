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
    users: [makeUser(), makeUser('user-uuid-2', 'bob@example.com')],
    profiles: [makeProfile(), makeProfile('user-uuid-2', 'bob@example.com')],
    notifications: [],
    files: [],
    projects: [],
    workspaces: [],
    projectAnalyses: [],
    equityGrants: [],
    dilutionEvents: [],
    collaboratorEarnings: [],
    payouts: [],
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
    hackathonBriefs: [],
    hackathonCheckIns: [],
    hackathonScores: [],
    hackathonTeamWorkspaces: [],
    hackathonTeamReports: [],
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
    expect(overview.body.totalTeams).toBe(1)
    expect(overview.body.ideaSubmissions).toBe(1)
    expect(overview.body.avgBuildVelocity).toBeGreaterThan(0)
    expect(velocity.body.teams[0].teamId).toBe(teamId)
    expect(leaderboard.body.leaderboard[0].teamId).toBe(teamId)
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
})
