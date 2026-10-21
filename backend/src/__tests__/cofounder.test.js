import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const authority = vi.hoisted(() => ({ db: null }))
const evidenceMocks = vi.hoisted(() => ({
  getPublicTrust: vi.fn(),
  executionIntelligenceFor: vi.fn(),
}))
const workspaceReadMocks = vi.hoisted(() => ({
  findWorkspace: vi.fn(),
  listMembers: vi.fn(),
  listWorkspaces: vi.fn(),
}))

vi.mock('../config/database.js', () => ({
  readAuthorityDb: vi.fn(() => authority.db),
  updateAuthorityDb: vi.fn((mutate) => mutate(authority.db)),
  runBoundedDatabase: (_snapshot, callback) => callback(),
  writeAuthorityDb: vi.fn(),
}))
vi.mock('../services/trustAuthorityAsync.js', () => ({ getPublicTrust: evidenceMocks.getPublicTrust }))
vi.mock('../services/executionIntelligenceService.js', () => ({ executionIntelligenceFor: evidenceMocks.executionIntelligenceFor }))
vi.mock('../repositories/workspaceProjectRepository.js', () => ({
  listProjects: vi.fn(async () => []),
  listWorkspaces: workspaceReadMocks.listWorkspaces,
  findWorkspace: workspaceReadMocks.findWorkspace,
  listMembers: workspaceReadMocks.listMembers,
  workspaceReadEnabled: () => process.env.WORKSPACE_READ_SOURCE === 'postgres',
  workspaceReadFallbackEnabled: () => false,
}))

const relationshipService = await import('../services/cofounderRelationshipService.js')
const matchingService = await import('../services/cofounderMatchingService.js')
const domainService = await import('../services/domainService.js')
const cofounderModel = await import('../services/cofounderModel.js')
const { recommendationCacheKey } = await import('../services/discoveryInfrastructure.js')

const FEATURE_FLAG = process.env.COFOUNDER_MODE_ENABLED

function profile(id, role, overrides = {}) {
  return {
    id,
    role,
    firstName: id.toUpperCase(),
    lastName: 'Member',
    title: role === 'founder' ? 'Founder' : 'Engineer',
    skills: ['typescript', 'react'],
    subSkills: [],
    industries: ['saas'],
    yearsExperience: 6,
    weeklyHours: 40,
    timezone: 'Europe/Budapest',
    country: 'Hungary',
    stageExperience: ['mvp'],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeDb() {
  return {
    profiles: [
      profile('founder', 'founder', { skills: ['typescript'] }),
      profile('candidate-a', 'collaborator'),
      profile('candidate-b', 'collaborator'),
      profile('outsider', 'collaborator'),
      profile('investor', 'investor'),
      profile('banned', 'collaborator', { accountStatus: 'disabled' }),
    ],
    projects: [{ id: 'venture-1', ownerId: 'founder', title: 'Northstar', stage: 'mvp', industry: 'saas' }],
    cofounderRequirements: [],
    cofounderRelationships: [],
    cofounderResponsibilities: [],
    cofounderObjectives: [],
    cofounderDecisions: [],
    cofounderActivity: [],
    cofounderAlignmentSnapshots: [],
    cofounderTeamSummaries: [],
    workspaces: [],
    workspaceMembers: [],
    workspaceTasks: [],
    workspaceInvitations: [],
    notifications: [],
    milestones: [],
    trustProfiles: [],
    verifiedSkills: [],
    trustVerificationProofs: [],
    executionScores: [],
    feedPosts: [],
    recommendationEvents: [],
    recommendationProfiles: [],
    networkEdges: [],
    entityRelationships: [],
    userActivityStates: [],
  }
}

async function seedRequirement(overrides = {}) {
  const result = await relationshipService.upsertRequirementsAsync('founder', 'venture-1', {
    roleType: 'technical',
    roleTitle: 'Technical co-founder',
    responsibilities: 'Own product engineering and delivery.',
    requiredSkills: ['typescript', 'react'],
    experience: { years: 4 },
    commitment: { type: 'full_time', hoursPerWeek: 40 },
    ventureStage: 'mvp',
    compatibility: {
      visionAnswers: 'build durable developer infrastructure',
      riskTolerance: 'high',
      workingStyle: 'deep work',
      equityDiscussionPreference: 'to_be_discussed',
    },
    ...overrides,
  })
  expect(result.ok).toBe(true)
  return result.requirement
}

beforeEach(() => {
  process.env.COFOUNDER_MODE_ENABLED = 'true'
  delete process.env.COFOUNDER_MODE_ALLOWLIST
  authority.db = makeDb()
  evidenceMocks.getPublicTrust.mockResolvedValue({
    trustScore: 84,
    tier: 'Verified',
    verificationStatus: 'verified',
    verifiedSkills: [{ skill: 'typescript', source: 'github', confidence: 0.95 }],
    signals: [],
  })
  evidenceMocks.executionIntelligenceFor.mockResolvedValue({
    ok: true,
    executionScore: 76,
    deliveryReliability: 91,
    completedMilestones: 3,
    evidence: { source: 'workspace' },
  })
})

afterAll(() => {
  if (FEATURE_FLAG === undefined) delete process.env.COFOUNDER_MODE_ENABLED
  else process.env.COFOUNDER_MODE_ENABLED = FEATURE_FLAG
})

describe('deterministic co-founder matching', () => {
  it('returns stable ranking, candidate-ID tie-breaking, and explicit missing evidence', async () => {
    const requirement = await seedRequirement()
    authority.db.profiles.find((row) => row.id === 'candidate-a').cofounderPreferences = {
      commitment: 'full_time',
      visionAnswers: 'build durable developer infrastructure',
      riskTolerance: 'high',
      workingStyle: 'deep work',
    }
    authority.db.profiles.find((row) => row.id === 'candidate-b').cofounderPreferences = {
      commitment: 'full_time',
      visionAnswers: 'build durable developer infrastructure',
      riskTolerance: 'high',
      workingStyle: 'deep work',
    }

    const first = matchingService.cofounderRecommendationsInDb(authority.db, 'founder', 'venture-1', {
      candidateIds: ['candidate-a', 'candidate-b'],
      requirementId: requirement.id,
      requirementVersion: requirement.version,
      limit: 20,
    })
    const second = matchingService.cofounderRecommendationsInDb(authority.db, 'founder', 'venture-1', {
      candidateIds: ['candidate-a', 'candidate-b'],
      requirementId: requirement.id,
      requirementVersion: requirement.version,
      limit: 20,
    })

    expect(first.ok).toBe(true)
    expect(first.recommendations.map((row) => row.candidate.id)).toEqual(['candidate-a', 'candidate-b'])
    expect(second.recommendations.map((row) => [row.candidate.id, row.cofounderFit, row.confidence]))
      .toEqual(first.recommendations.map((row) => [row.candidate.id, row.cofounderFit, row.confidence]))
    expect(first.recommendations[0].breakdown.geographicTimeCompatibility.value).toBe(100)
    expect(first.recommendations[0].breakdown.executionReputation.value).toBeNull()
    expect(first.recommendations[0].missingEvidence.some((row) => row.dimension === 'executionReputation')).toBe(true)
    expect(first.policy.version).toBe('cofounder-fit-v1')
    expect(first.meta.deterministic).toBe(true)
  })

  it('excludes self, ineligible profiles, and existing active relationships', async () => {
    const requirement = await seedRequirement()
    authority.db.cofounderRelationships.push({
      id: 'existing-active',
      projectId: 'venture-1',
      founderId: 'founder',
      cofounderId: 'candidate-a',
      status: 'ACTIVE',
    })

    const result = matchingService.cofounderRecommendationsInDb(authority.db, 'founder', 'venture-1', {
      requirementId: requirement.id,
      requirementVersion: requirement.version,
    })

    const ids = result.recommendations.map((row) => row.candidate.id)
    expect(ids).toContain('candidate-b')
    expect(ids).not.toContain('candidate-a')
    expect(ids).not.toContain('founder')
    expect(ids).not.toContain('investor')
    expect(ids).not.toContain('banned')
  })

  it('keeps collaborator and co-founder cache namespaces distinct', () => {
    const base = { surface: 'discovery', limit: 20 }
    const collaborator = recommendationCacheKey('founder', base)
    const cofounder = recommendationCacheKey('founder', {
      ...base,
      relationshipType: 'co_founder',
      ventureId: 'venture-1',
      requirementId: 'requirement-1',
      requirementVersion: 3,
      policyVersion: 'cofounder-fit-v1',
    })
    expect(cofounder).not.toBe(collaborator)
    expect(cofounder).toContain('co_founder:venture-1:requirement-1:3:cofounder-fit-v1')
  })

  it('records founder-scoped candidate analytics without private payloads', async () => {
    const recorded = await relationshipService.recordCandidateEventAsync('founder', {
      eventType: 'cofounder_candidate_viewed',
      projectId: 'venture-1',
      candidateIds: ['candidate-a', 'candidate-a', 'candidate-b'],
      requirementVersion: 3,
      privateNotes: 'must not persist',
    })
    expect(recorded).toMatchObject({ ok: true, recorded: true, candidateIds: ['candidate-a', 'candidate-b'] })
    const event = authority.db.recommendationEvents.find((row) => row.eventType === 'cofounder_candidate_viewed')
    expect(event).toMatchObject({
      surface: 'cofounder',
      entityType: 'cofounder_candidate',
      entityId: 'candidate-a',
      metadata: { projectId: 'venture-1', candidateId: 'candidate-a', candidateIds: ['candidate-a', 'candidate-b'], requirementVersion: 3 },
    })
    expect(event.metadata).not.toHaveProperty('privateNotes')

    expect(await relationshipService.recordCandidateEventAsync('candidate-a', {
      eventType: 'cofounder_candidate_compared',
      projectId: 'venture-1',
      candidateIds: ['candidate-b'],
    })).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.recordCandidateEventAsync('founder', {
      eventType: 'cofounder_candidate_compared',
      projectId: 'venture-1',
      candidateIds: ['ghost'],
    })).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.recordCandidateEventAsync('founder', {
      eventType: 'cofounder_arbitrary_event',
      projectId: 'venture-1',
      candidateIds: ['candidate-a'],
    })).toMatchObject({ ok: false, status: 400 })
  })
})

describe('co-founder lifecycle and authorization', () => {
  it('does not expose mode on discussion acceptance and activates idempotently after proposal acceptance', async () => {
    const invitation = await relationshipService.createInvitationAsync('founder', {
      idempotencyKey: 'invite-candidate-a',
      projectId: 'venture-1',
      candidateId: 'candidate-a',
      roleTitle: 'Technical co-founder',
      responsibilities: 'Own engineering execution.',
      commitment: { type: 'full_time', hoursPerWeek: 40 },
      ventureStage: 'mvp',
      proposedTerms: {
        responsibilityAssignments: [
          { ownerRole: 'cofounder', title: 'Engineering ownership', description: 'Own delivery.' },
          { ownerRole: 'founder', title: 'Commercial ownership', description: 'Own customers.' },
        ],
      },
    })
    expect(invitation.ok).toBe(true)
    const relationshipId = invitation.relationship.id
    expect(authority.db.notifications.some((row) => row.userId === 'candidate-a' && row.type === 'cofounder')).toBe(true)

    const duplicateInvite = await relationshipService.createInvitationAsync('founder', {
      idempotencyKey: 'invite-candidate-a',
      projectId: 'venture-1',
      candidateId: 'candidate-a',
    })
    expect(duplicateInvite.idempotent).toBe(true)

    const discussion = await relationshipService.acceptDiscussionAsync('candidate-a', relationshipId)
    expect(discussion.relationship.status).toBe('DISCUSSION')
    const beforeActivation = await relationshipService.getRelationshipModeAsync('founder', 'venture-1')
    expect(beforeActivation.active).toBe(false)
    expect(beforeActivation.relationships).toHaveLength(0)

    expect((await relationshipService.advanceRelationshipAsync('candidate-a', relationshipId, { status: 'MUTUAL_INTEREST' })).relationship.status).toBe('MUTUAL_INTEREST')
    expect((await relationshipService.advanceRelationshipAsync('candidate-a', relationshipId, { status: 'DUE_DILIGENCE' })).relationship.status).toBe('DUE_DILIGENCE')
    expect((await relationshipService.advanceRelationshipAsync('founder', relationshipId, { status: 'COFOUNDER_PROPOSAL' })).relationship.status).toBe('COFOUNDER_PROPOSAL')

    const activated = await relationshipService.acceptProposalAsync('candidate-a', relationshipId, { idempotencyKey: 'accept-candidate-a' })
    expect(activated.relationship.status).toBe('ACTIVE')
    expect(authority.db.workspaces).toHaveLength(1)
    expect(authority.db.workspaces[0]).toMatchObject({ kind: 'cofounder', cofounderRelationshipId: relationshipId })
    expect(authority.db.workspaceMembers.filter((row) => row.cofounderRelationshipId === relationshipId).map((row) => row.userId).sort())
      .toEqual(['candidate-a', 'founder'])
    expect(authority.db.cofounderResponsibilities).toHaveLength(2)

    const retried = await relationshipService.acceptProposalAsync('candidate-a', relationshipId, { idempotencyKey: 'accept-candidate-a' })
    expect(retried.idempotent).toBe(true)
    expect(authority.db.workspaces).toHaveLength(1)
    const mode = await relationshipService.getRelationshipModeAsync('founder', 'venture-1')
    expect(mode.active).toBe(true)
    expect(mode.relationships[0].otherParty.id).toBe('candidate-a')
  })

  it('returns not-found semantics to outsiders and preserves ended history', async () => {
    const invitation = await relationshipService.createInvitationAsync('founder', {
      projectId: 'venture-1',
      candidateId: 'candidate-a',
    })
    const relationshipId = invitation.relationship.id
    expect(await relationshipService.getInvitationAsync('outsider', relationshipId)).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.acceptDiscussionAsync('outsider', relationshipId)).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.getRelationshipWorkspaceAsync('outsider', relationshipId)).toMatchObject({ ok: false })

    await relationshipService.acceptDiscussionAsync('candidate-a', relationshipId)
    await relationshipService.advanceRelationshipAsync('candidate-a', relationshipId, { status: 'MUTUAL_INTEREST' })
    await relationshipService.advanceRelationshipAsync('candidate-a', relationshipId, { status: 'DUE_DILIGENCE' })
    await relationshipService.advanceRelationshipAsync('founder', relationshipId, { status: 'COFOUNDER_PROPOSAL' })
    await relationshipService.acceptProposalAsync('candidate-a', relationshipId, { idempotencyKey: 'activate' })

    const beforePause = authority.db.cofounderRelationships.find((row) => row.id === relationshipId)
    expect(await relationshipService.pauseRelationshipAsync('founder', relationshipId, { version: beforePause.version - 1 }))
      .toMatchObject({ ok: false, status: 409 })
    await relationshipService.pauseRelationshipAsync('founder', relationshipId, { version: beforePause.version })
    const pausedWorkspace = await relationshipService.getRelationshipWorkspaceAsync('candidate-a', relationshipId)
    expect(pausedWorkspace).toMatchObject({ ok: false, status: 409 })
    const paused = authority.db.cofounderRelationships.find((row) => row.id === relationshipId)
    expect(await relationshipService.resumeRelationshipAsync('founder', relationshipId, { version: paused.version - 1 }))
      .toMatchObject({ ok: false, status: 409 })
    await relationshipService.resumeRelationshipAsync('founder', relationshipId, { version: paused.version })
    const resumed = authority.db.cofounderRelationships.find((row) => row.id === relationshipId)
    expect(await relationshipService.endRelationshipAsync('founder', relationshipId, {
      reason: 'venture_wound_down',
      version: resumed.version - 1,
    })).toMatchObject({ ok: false, status: 409 })
    const ended = await relationshipService.endRelationshipAsync('founder', relationshipId, {
      reason: 'venture_wound_down',
      version: resumed.version,
    })
    expect(ended).toMatchObject({ ok: true, evidencePreserved: true })
    expect(ended.relationship.status).toBe('ENDED')
    expect(await relationshipService.getRelationshipAsync('candidate-a', relationshipId)).toMatchObject({ ok: true, relationship: { status: 'ENDED' } })
    expect(await relationshipService.getRelationshipWorkspaceAsync('candidate-a', relationshipId)).toMatchObject({ ok: false, status: 409 })
  })

  it('preserves declined and withdrawn invitation history for both parties', async () => {
    const declinedInvite = await relationshipService.createInvitationAsync('founder', {
      projectId: 'venture-1',
      candidateId: 'candidate-a',
    })
    await relationshipService.declineInvitationAsync('candidate-a', declinedInvite.relationship.id, { reason: 'not_now' })
    expect((await relationshipService.getInvitationAsync('founder', declinedInvite.relationship.id)).invitation)
      .toMatchObject({ status: 'DECLINED', endReason: 'not_now' })
    expect((await relationshipService.getRelationshipAsync('candidate-a', declinedInvite.relationship.id)).relationship)
      .toMatchObject({ status: 'DECLINED' })

    const withdrawnInvite = await relationshipService.createInvitationAsync('founder', {
      projectId: 'venture-1',
      candidateId: 'candidate-b',
    })
    await relationshipService.withdrawInvitationAsync('founder', withdrawnInvite.relationship.id, { reason: 'role_closed' })
    expect((await relationshipService.getInvitationAsync('candidate-b', withdrawnInvite.relationship.id)).invitation)
      .toMatchObject({ status: 'WITHDRAWN', endReason: 'role_closed' })
  })

  it('activates once under concurrent proposal acceptance and then remains idempotent', async () => {
    const invitation = await relationshipService.createInvitationAsync('founder', {
      projectId: 'venture-1',
      candidateId: 'candidate-a',
    })
    const relationshipId = invitation.relationship.id
    await relationshipService.acceptDiscussionAsync('candidate-a', relationshipId)
    await relationshipService.advanceRelationshipAsync('candidate-a', relationshipId, { status: 'MUTUAL_INTEREST' })
    await relationshipService.advanceRelationshipAsync('candidate-a', relationshipId, { status: 'DUE_DILIGENCE' })
    await relationshipService.advanceRelationshipAsync('founder', relationshipId, { status: 'COFOUNDER_PROPOSAL' })

    const [first, second] = await Promise.all([
      relationshipService.acceptProposalAsync('candidate-a', relationshipId, { idempotencyKey: 'concurrent-activation' }),
      relationshipService.acceptProposalAsync('candidate-a', relationshipId, { idempotencyKey: 'concurrent-activation' }),
    ])
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(authority.db.workspaces).toHaveLength(1)
    expect(authority.db.cofounderResponsibilities).toHaveLength(1)
    expect(authority.db.cofounderRelationships.find((row) => row.id === relationshipId).status).toBe('ACTIVE')
  })
})

describe('relationship workspace privacy and deterministic evidence', () => {
  async function activeRelationship(candidateId = 'candidate-a') {
    const invitation = await relationshipService.createInvitationAsync('founder', {
      projectId: 'venture-1',
      candidateId,
    })
    const relationshipId = invitation.relationship.id
    await relationshipService.acceptDiscussionAsync(candidateId, relationshipId)
    await relationshipService.advanceRelationshipAsync(candidateId, relationshipId, { status: 'MUTUAL_INTEREST' })
    await relationshipService.advanceRelationshipAsync(candidateId, relationshipId, { status: 'DUE_DILIGENCE' })
    await relationshipService.advanceRelationshipAsync('founder', relationshipId, { status: 'COFOUNDER_PROPOSAL' })
    await relationshipService.acceptProposalAsync(candidateId, relationshipId, { idempotencyKey: `activate-${relationshipId}` })
    return authority.db.cofounderRelationships.find((row) => row.id === relationshipId)
  }

  it('filters personal tasks server-side and blocks unrelated workspace members', async () => {
    const relationship = await activeRelationship()
    const workspaceId = relationship.workspaceId
    authority.db.workspaceTasks.push(
      { id: 'shared-task', workspaceId, title: 'Shared task', status: 'queued', visibilityLayer: 'SHARED', createdBy: 'founder' },
      { id: 'candidate-personal', workspaceId, title: 'Candidate private task', status: 'queued', visibilityLayer: 'PERSONAL', ownerId: 'candidate-a', createdBy: 'candidate-a' },
      { id: 'founder-personal', workspaceId, title: 'Founder private task', status: 'queued', visibilityLayer: 'PERSONAL', ownerId: 'founder', createdBy: 'founder' },
    )

    const founderTasks = domainService.listWorkspaceCollection('founder', workspaceId, 'workspaceTasks').map((row) => row.id)
    const candidateTasks = domainService.listWorkspaceCollection('candidate-a', workspaceId, 'workspaceTasks').map((row) => row.id)
    expect(founderTasks).toContain('shared-task')
    expect(founderTasks).toContain('founder-personal')
    expect(founderTasks).not.toContain('candidate-personal')
    expect(candidateTasks).toContain('shared-task')
    expect(candidateTasks).toContain('candidate-personal')
    expect(candidateTasks).not.toContain('founder-personal')
    expect(domainService.listWorkspaceCollection('outsider', workspaceId, 'workspaceTasks')).toBeNull()
  })

  it('keeps relationship workspace membership and task metadata server-controlled', async () => {
    const relationship = await activeRelationship()
    const workspaceId = relationship.workspaceId

    const invite = domainService.createWorkspaceInvitation('founder', workspaceId, {
      collaboratorId: 'outsider',
      requestedRole: 'Engineer',
      scope: 'Join the co-founder workspace',
      equityProposal: 5,
    })
    expect(invite).toMatchObject({ ok: false, error: 'cofounder_workspace_managed_by_relationship' })
    expect(authority.db.workspaceInvitations).toHaveLength(0)

    authority.db.workspaceInvitations.push({
      id: 'legacy-invite',
      workspaceId,
      collaboratorId: 'outsider',
      invitedBy: 'founder',
      status: 'pending',
      expiresAt: '2999-01-01T00:00:00.000Z',
      requestedRole: 'Engineer',
      accessLevel: 'contributor',
    })
    expect(domainService.acceptWorkspaceInvitation('outsider', 'legacy-invite'))
      .toMatchObject({ ok: false, error: 'cofounder_workspace_managed_by_relationship' })
    expect(authority.db.workspaceMembers.some((row) => row.userId === 'outsider')).toBe(false)

    const restricted = domainService.createWorkspaceCollectionItem('founder', workspaceId, 'workspaceTasks', {
      title: 'Restricted task',
      visibilityLayer: 'RESTRICTED',
      allowedUserIds: ['founder', 'outsider'],
    }, 'task')
    expect(restricted.allowedUserIds).toEqual(['founder'])
    expect(domainService.listWorkspaceCollection('outsider', workspaceId, 'workspaceTasks')).toBeNull()

    const patched = domainService.patchWorkspaceCollectionItem('founder', workspaceId, 'workspaceTasks', restricted.id, {
      ownerId: 'candidate-a',
      cofounderRelationshipId: 'spoofed-relationship',
      workspaceId: 'spoofed-workspace',
      createdAt: '2000-01-01T00:00:00.000Z',
    })
    expect(patched).toMatchObject({
      ownerId: 'candidate-a',
      cofounderRelationshipId: relationship.id,
      workspaceId,
    })
    expect(patched.createdAt).not.toBe('2000-01-01T00:00:00.000Z')

    const personal = domainService.createWorkspaceCollectionItem('founder', workspaceId, 'workspaceTasks', {
      title: 'Founder private task',
      visibilityLayer: 'PERSONAL',
    }, 'task')
    expect(domainService.patchWorkspaceCollectionItem('founder', workspaceId, 'workspaceTasks', personal.id, {
      ownerId: 'candidate-a',
    })).toBeNull()
  })

  it('removes task access while paused and after the relationship ends', async () => {
    const relationship = await activeRelationship()
    const workspaceId = relationship.workspaceId
    const task = domainService.createWorkspaceCollectionItem('founder', workspaceId, 'workspaceTasks', {
      title: 'Shared delivery task',
    }, 'task')
    expect(task).toBeTruthy()

    const active = authority.db.cofounderRelationships.find((row) => row.id === relationship.id)
    await relationshipService.pauseRelationshipAsync('founder', relationship.id, { version: active.version })
    expect(domainService.listWorkspaceCollection('candidate-a', workspaceId, 'workspaceTasks')).toBeNull()

    const paused = authority.db.cofounderRelationships.find((row) => row.id === relationship.id)
    await relationshipService.resumeRelationshipAsync('founder', relationship.id, { version: paused.version })
    const resumed = authority.db.cofounderRelationships.find((row) => row.id === relationship.id)
    expect(domainService.listWorkspaceCollection('candidate-a', workspaceId, 'workspaceTasks')).toHaveLength(1)
    await relationshipService.endRelationshipAsync('founder', relationship.id, {
      reason: 'venture_wound_down',
      version: resumed.version,
    })
    expect(domainService.listWorkspaceCollection('candidate-a', workspaceId, 'workspaceTasks')).toBeNull()
    expect(authority.db.workspaceTasks.find((row) => row.id === task.id)).toBeTruthy()
  })

  it('denies legacy non-party members on postgres workspace reads', async () => {
    const relationship = await activeRelationship()
    const workspace = {
      id: relationship.workspaceId,
      ownerId: 'founder',
      projectId: 'venture-1',
      status: 'active',
      cofounderRelationshipId: relationship.id,
      cofounderStatus: 'ACTIVE',
      cofounderFounderId: 'founder',
      cofounderCofounderId: 'candidate-a',
    }
    workspaceReadMocks.findWorkspace.mockResolvedValue(workspace)
    workspaceReadMocks.listMembers.mockResolvedValue([
      { id: 'member-a', workspaceId: workspace.id, userId: 'candidate-a', role: 'cofounder', status: 'active', accessLevel: 'contributor' },
      { id: 'member-outsider', workspaceId: workspace.id, userId: 'outsider', role: 'collaborator', status: 'active', accessLevel: 'contributor' },
    ])
    workspaceReadMocks.listWorkspaces.mockResolvedValue([
      { workspace, membership: { workspaceId: workspace.id, userId: 'outsider', role: 'collaborator', status: 'active' } },
    ])
    process.env.WORKSPACE_READ_SOURCE = 'postgres'
    try {
      expect(await domainService.workspaceContextAsync('outsider', workspace.id)).toBeNull()
      expect(await domainService.listWorkspaceMembersAsync('outsider', workspace.id)).toBeNull()
      expect((await domainService.listWorkspacesAsync('outsider')).workspaces).toEqual([])
      expect(await domainService.workspaceContextAsync('candidate-a', workspace.id)).toMatchObject({ workspaceId: workspace.id })
      expect((await domainService.listWorkspaceMembersAsync('candidate-a', workspace.id)).members).toHaveLength(3)
    } finally {
      delete process.env.WORKSPACE_READ_SOURCE
    }
  })

  it('excludes private execution from shared health and the other party evidence', async () => {
    const relationship = await activeRelationship()
    const workspaceId = relationship.workspaceId
    await relationshipService.createObjectiveAsync('founder', relationship.id, { title: 'Shared roadmap' })
    await relationshipService.createObjectiveAsync('founder', relationship.id, {
      title: 'Founder private objective',
      ownerId: 'founder',
      visibilityLayer: 'PERSONAL',
    })
    domainService.createWorkspaceCollectionItem('founder', workspaceId, 'workspaceTasks', {
      title: 'Founder private delivery',
      ownerId: 'founder',
      status: 'done',
      visibilityLayer: 'PERSONAL',
    }, 'task')
    domainService.createWorkspaceCollectionItem('founder', workspaceId, 'workspaceTasks', {
      title: 'Shared candidate delivery',
      ownerId: 'candidate-a',
      status: 'done',
      visibilityLayer: 'SHARED',
    }, 'task')

    const health = await relationshipService.getRelationshipHealthAsync('candidate-a', relationship.id)
    expect(health.health.metrics.goalAlignment.evidence).toMatchObject({ objectives: 1 })
    expect(health.health.metrics.executionAlignment.evidence).toMatchObject({ completed: 1, total: 2 })

    const evidence = await relationshipService.getRelationshipEvidenceAsync('candidate-a', relationship.id)
    const founder = evidence.parties.find((row) => row.userId === 'founder')
    const candidate = evidence.parties.find((row) => row.userId === 'candidate-a')
    expect(founder.observed).toMatchObject({ assignedTasks: 0, ownedObjectives: 1 })
    expect(candidate.observed).toMatchObject({ assignedTasks: 1, completedTasks: 1 })
  })

  it('rejects objective links that cross workspaces or widen private task visibility', async () => {
    const relationship = await activeRelationship()
    const otherRelationship = await activeRelationship('candidate-b')
    const privateTask = domainService.createWorkspaceCollectionItem('founder', relationship.workspaceId, 'workspaceTasks', {
      title: 'Founder private delivery',
      visibilityLayer: 'PERSONAL',
      status: 'done',
    }, 'task')
    const sharedTask = domainService.createWorkspaceCollectionItem('founder', relationship.workspaceId, 'workspaceTasks', {
      title: 'Shared delivery',
      visibilityLayer: 'SHARED',
      status: 'done',
    }, 'task')
    const foreignTask = domainService.createWorkspaceCollectionItem('founder', otherRelationship.workspaceId, 'workspaceTasks', {
      title: 'Other relationship delivery',
      visibilityLayer: 'SHARED',
      status: 'done',
    }, 'task')

    expect(await relationshipService.createObjectiveAsync('founder', relationship.id, {
      title: 'Private task cannot back a shared objective',
      visibilityLayer: 'SHARED',
      linkedTaskIds: [privateTask.id],
    })).toMatchObject({ ok: false, status: 403, error: 'shared_objective_requires_shared_task' })
    expect(await relationshipService.createObjectiveAsync('founder', relationship.id, {
      title: 'Foreign task cannot be linked',
      visibilityLayer: 'SHARED',
      linkedTaskIds: [foreignTask.id],
    })).toMatchObject({ ok: false, status: 404, error: 'linked_task_not_found' })

    const shared = await relationshipService.createObjectiveAsync('founder', relationship.id, {
      title: 'Shared roadmap',
      visibilityLayer: 'SHARED',
      linkedTaskIds: [sharedTask.id],
    })
    expect(shared.objective.linkedTaskIds).toEqual([sharedTask.id])
    expect(await relationshipService.patchObjectiveAsync('founder', shared.objective.id, {
      version: shared.objective.version,
      linkedTaskIds: [privateTask.id],
    })).toMatchObject({ ok: false, status: 403, error: 'shared_objective_requires_shared_task' })
    expect(authority.db.cofounderObjectives.find((row) => row.id === shared.objective.id).linkedTaskIds)
      .toEqual([sharedTask.id])
    expect(await relationshipService.patchObjectiveAsync('founder', shared.objective.id, {
      version: shared.objective.version,
      linkedTaskIds: [foreignTask.id],
    })).toMatchObject({ ok: false, status: 404, error: 'linked_task_not_found' })

    const personal = await relationshipService.createObjectiveAsync('founder', relationship.id, {
      title: 'Founder private objective',
      ownerId: 'founder',
      visibilityLayer: 'PERSONAL',
      linkedTaskIds: [privateTask.id],
    })
    expect(personal.objective.linkedTaskIds).toEqual([privateTask.id])
    expect(await relationshipService.patchObjectiveAsync('founder', personal.objective.id, {
      version: personal.objective.version,
      visibilityLayer: 'SHARED',
    })).toMatchObject({ ok: false, status: 403, error: 'shared_objective_requires_shared_task' })
  })

  it('filters legacy private links from shared objective output and progress', async () => {
    const relationship = await activeRelationship()
    const sharedTask = domainService.createWorkspaceCollectionItem('founder', relationship.workspaceId, 'workspaceTasks', {
      title: 'Shared delivery',
      visibilityLayer: 'SHARED',
      status: 'done',
    }, 'task')
    const privateTask = domainService.createWorkspaceCollectionItem('founder', relationship.workspaceId, 'workspaceTasks', {
      title: 'Founder private delivery',
      visibilityLayer: 'PERSONAL',
      status: 'active',
    }, 'task')
    const created = await relationshipService.createObjectiveAsync('founder', relationship.id, {
      title: 'Shared roadmap',
      linkedTaskIds: [sharedTask.id],
    })
    authority.db.cofounderObjectives.find((row) => row.id === created.objective.id).linkedTaskIds.push(privateTask.id)

    for (const viewer of ['founder', 'candidate-a']) {
      const objectives = await relationshipService.listObjectivesAsync(viewer, relationship.id)
      expect(objectives.objectives.find((row) => row.id === created.objective.id)).toMatchObject({
        linkedTaskIds: [sharedTask.id],
        progress: 100,
        progressEvidenceCount: 1,
      })
    }
  })

  it('returns insufficient evidence without fabricating health and keeps trust/execution layers separate', async () => {
    const relationship = await activeRelationship()
    const health = await relationshipService.getRelationshipHealthAsync('founder', relationship.id)
    expect(health.ok).toBe(true)
    expect(health.health.band).toBe('insufficient_evidence')
    expect(health.health.confidence).toBeLessThan(0.35)
    const repeated = await relationshipService.getRelationshipHealthAsync('founder', relationship.id)
    expect(repeated.health).toEqual(health.health)

    const evidence = await relationshipService.getRelationshipEvidenceAsync('candidate-a', relationship.id)
    expect(evidence.ok).toBe(true)
    expect(evidence.parties).toHaveLength(2)
    expect(Object.keys(evidence.separation).sort()).toEqual(['claimed', 'observed', 'verified'])
    const candidateEvidence = evidence.parties.find((row) => row.userId === 'candidate-a')
    expect(candidateEvidence.claimed.skills).toContain('typescript')
    expect(candidateEvidence.verified.trustScore).toBe(84)
    expect(candidateEvidence.observed.execution.executionScore).toBe(76)
  })

  it('blocks cross-relationship resource IDs and keeps personal objectives private', async () => {
    const relationship = await activeRelationship('candidate-a')
    const secondRelationship = await activeRelationship('candidate-b')
    const shared = await relationshipService.createObjectiveAsync('founder', relationship.id, { title: 'Shared roadmap' })
    const personal = await relationshipService.createObjectiveAsync('founder', relationship.id, {
      title: 'Founder private notes',
      ownerId: 'founder',
      visibilityLayer: 'PERSONAL',
    })
    expect(shared.ok).toBe(true)
    expect(personal.ok).toBe(true)

    const candidateObjectives = await relationshipService.listObjectivesAsync('candidate-a', relationship.id)
    expect(candidateObjectives.objectives.map((row) => row.id)).toContain(shared.objective.id)
    expect(candidateObjectives.objectives.map((row) => row.id)).not.toContain(personal.objective.id)

    expect(await relationshipService.listObjectivesAsync('outsider', relationship.id)).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.patchObjectiveAsync('outsider', shared.objective.id, { title: 'Hijack' })).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.patchObjectiveAsync('candidate-b', shared.objective.id, { title: 'Hijack' })).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.getRelationshipWorkspaceAsync('candidate-b', relationship.id)).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.getRelationshipWorkspaceAsync('candidate-a', secondRelationship.id)).toMatchObject({ ok: false, status: 404 })

    const decision = await relationshipService.createDecisionAsync('founder', relationship.id, { title: 'Choose launch date' })
    expect(await relationshipService.respondToDecisionAsync('outsider', decision.decision.id, { response: 'approve' }))
      .toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.respondToDecisionAsync('candidate-b', decision.decision.id, { response: 'approve' }))
      .toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.listActivityAsync('outsider', relationship.id)).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.getRelationshipEvidenceAsync('outsider', relationship.id)).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.getRelationshipEvidenceAsync('candidate-b', relationship.id)).toMatchObject({ ok: false, status: 404 })
    expect(await relationshipService.publishInvestorTeamSummaryAsync('outsider', 'venture-1', { payload: { team: [{ name: 'X', title: 'Y' }] } }))
      .toMatchObject({ ok: false, status: 404 })

    const published = await relationshipService.publishInvestorTeamSummaryAsync('founder', 'venture-1', {
      payload: {
        team: [{ name: 'Founder Member', title: 'Founder', role: 'founder' }],
        strengths: ['execution'],
        verifiedEvidence: { completedMilestones: 2, verifiedContributors: 2, executionConsistency: 80 },
      },
    })
    expect(published).toMatchObject({ ok: true, summary: { projectId: 'venture-1' } })
    expect(authority.db.cofounderTeamSummaries).toHaveLength(1)
    expect(authority.db.feedPosts).toEqual([])
  })

  it('aggregates multiple active co-founders independently', async () => {
    const first = await activeRelationship('candidate-a')
    const second = await activeRelationship('candidate-b')
    const founderMode = await relationshipService.getRelationshipModeAsync('founder', 'venture-1')
    expect(founderMode.active).toBe(true)
    expect(founderMode.relationships.map((row) => row.id).sort()).toEqual([first.id, second.id].sort())
    expect(founderMode.team).toHaveLength(2)

    const candidateMode = await relationshipService.getRelationshipModeAsync('candidate-a', 'venture-1')
    expect(candidateMode.relationships).toHaveLength(1)
    expect(candidateMode.relationships[0]).toMatchObject({ id: first.id, role: 'cofounder' })
  })
})

describe('co-founder profile extension', () => {
  it('keeps structured preferences bounded and rejects unsupported or sensitive fields', () => {
    const preferences = cofounderModel.normalizeCofounderPreferences({
      commitment: 'full_time',
      visionAnswers: 'Build durable infrastructure.',
      workingStyle: 'deep work',
      riskTolerance: 'high',
      communicationPreference: 'weekly written sync',
      contributionExpectations: 'Own delivery.',
      inferredPersonality: 'must be ignored',
      summary: 'not a matching preference',
    })
    expect(preferences).toEqual({
      commitment: 'full_time',
      visionAnswers: 'Build durable infrastructure.',
      workingStyle: 'deep work',
      riskTolerance: 'high',
      communicationPreference: 'weekly written sync',
      contributionExpectations: 'Own delivery.',
    })
    expect(cofounderModel.normalizeCofounderPreferences({ commitment: 'unknown' })).toEqual({ commitment: null })
    expect(cofounderModel.normalizeCofounderPreferences(['full_time'])).toBeNull()
  })

  it('normalizes current and previous co-founder experience without exposing free-form data', () => {
    expect(cofounderModel.normalizeCofounderExperience({
      currentlyCofounder: true,
      currentVentureCount: 2.8,
      previousCofounderCount: 120,
      previousVentures: ['Northstar', 'Second venture'],
      summary: 'Built and shipped two products.',
      inferredTrait: 'ignored',
    })).toEqual({
      currentlyCofounder: true,
      currentVentureCount: 2,
      previousCofounderCount: 50,
      previousVentures: ['Northstar', 'Second venture'],
      summary: 'Built and shipped two products.',
    })
    expect(cofounderModel.normalizeCofounderExperience('serial')).toBeNull()
  })
})
