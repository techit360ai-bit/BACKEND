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
    endorsements: [],
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
})
