import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const authority = vi.hoisted(() => ({ db: null }))
const evidenceMocks = vi.hoisted(() => ({
  getPublicTrust: vi.fn(),
  executionIntelligenceFor: vi.fn(),
}))

vi.mock('../config/database.js', () => ({
  readAuthorityDb: vi.fn(() => authority.db),
  updateAuthorityDb: vi.fn((mutate) => mutate(authority.db)),
  writeAuthorityDb: vi.fn(),
}))
vi.mock('../services/trustAuthorityAsync.js', () => ({ getPublicTrust: evidenceMocks.getPublicTrust }))
vi.mock('../services/executionIntelligenceService.js', () => ({ executionIntelligenceFor: evidenceMocks.executionIntelligenceFor }))

const relationshipService = await import('../services/cofounderRelationshipService.js')
const matchingService = await import('../services/cofounderMatchingService.js')
const domainService = await import('../services/domainService.js')
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
    notifications: [],
    milestones: [],
    trustProfiles: [],
    verifiedSkills: [],
    trustVerificationProofs: [],
    executionScores: [],
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

    await relationshipService.pauseRelationshipAsync('founder', relationshipId)
    const pausedWorkspace = await relationshipService.getRelationshipWorkspaceAsync('candidate-a', relationshipId)
    expect(pausedWorkspace).toMatchObject({ ok: false, status: 409 })
    await relationshipService.resumeRelationshipAsync('founder', relationshipId)
    const ended = await relationshipService.endRelationshipAsync('founder', relationshipId, { reason: 'venture_wound_down' })
    expect(ended).toMatchObject({ ok: true, evidencePreserved: true })
    expect(ended.relationship.status).toBe('ENDED')
    expect(await relationshipService.getRelationshipAsync('candidate-a', relationshipId)).toMatchObject({ ok: true, relationship: { status: 'ENDED' } })
    expect(await relationshipService.getRelationshipWorkspaceAsync('candidate-a', relationshipId)).toMatchObject({ ok: false, status: 409 })
  })
})

describe('relationship workspace privacy and deterministic evidence', () => {
  async function activeRelationship() {
    const invitation = await relationshipService.createInvitationAsync('founder', {
      projectId: 'venture-1',
      candidateId: 'candidate-a',
    })
    const relationshipId = invitation.relationship.id
    await relationshipService.acceptDiscussionAsync('candidate-a', relationshipId)
    await relationshipService.advanceRelationshipAsync('candidate-a', relationshipId, { status: 'MUTUAL_INTEREST' })
    await relationshipService.advanceRelationshipAsync('candidate-a', relationshipId, { status: 'DUE_DILIGENCE' })
    await relationshipService.advanceRelationshipAsync('founder', relationshipId, { status: 'COFOUNDER_PROPOSAL' })
    await relationshipService.acceptProposalAsync('candidate-a', relationshipId, { idempotencyKey: `activate-${relationshipId}` })
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
})
