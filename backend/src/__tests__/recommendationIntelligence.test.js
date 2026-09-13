import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn() }))
vi.mock('../services/organizationIntelligenceService.js', () => ({ requireOrganizationPermission: vi.fn((userId, _permission, organizationId) => ({ ok: true, organizationId: organizationId || 'org-1', role: 'owner' })), organizationOverview: vi.fn(() => ({ ok: true, health: { score: 70 } })), organizationPulse: vi.fn(() => ({ activity: [] })), organizationRisks: vi.fn(() => ({ risks: [] })) }))
vi.mock('../services/investorIntelligenceService.js', () => ({ investorIntelligenceOverview: vi.fn(() => ({ startups: [] })) }))
import { readDb, updateDb } from '../config/database.js'
import { collaboratorRecommendations, founderCollaboratorRecommendations, organizationTalentRecommendations, mentorRecommendations, investorThesisRecommendations, continuousIntelligence } from '../services/recommendationIntelligenceService.js'

let db
beforeEach(() => {
  db = {
    profiles: [
      { id: 'founder-1', role: 'founder', country: 'NG', industries: ['fintech'] },
      { id: 'collab-1', role: 'collaborator', title: 'React Engineer', skills: ['react', 'typescript'], executionScore: 91, deliveryReliability: 88, responseVelocity: 80 },
      { id: 'mentor-1', role: 'investor', skills: ['fintech', 'growth'], industries: ['fintech'] },
      { id: 'founder-2', role: 'founder', country: 'NG', industries: ['fintech'] },
      { id: 'investor-1', role: 'investor', investmentFocus: ['fintech'], country: 'NG', stagePreference: ['pre-seed'] },
    ],
    projects: [
      { id: 'project-1', ownerId: 'founder-1', title: 'Pay', industry: 'fintech', stage: 'mvp', requiredSkills: ['react'], openRoles: ['engineer'], updatedAt: new Date(Date.now() - 20 * 86400000).toISOString() },
      { id: 'project-2', ownerId: 'founder-2', title: 'Growth', industry: 'fintech', stage: 'pre-seed', missingSkills: ['growth'], updatedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
    ],
    executionScores: [], collaboratorScores: [], workspaceTasks: [], recommendationEvents: [], workspaceMembers: [], milestones: [], projectActivities: [], startupActivities: [], mentorshipRooms: [{ id: 'room-1', mentorId: 'mentor-1', capacity: 2 }], mentorshipMentees: [], mentorshipApplications: [], dealFlowSnapshots: [{ projectId: 'project-2', visibility: 'public', stage: 'pre-seed', executionVelocity: 75, region: 'NG' }], investments: [], investorWatchlists: [], organizationMemberships: [{ organizationId: 'org-1', userId: 'org-1', status: 'active' }], organizationRiskSignals: [], organizationActions: [], continuousIntelligenceSnapshots: [],
  }
  readDb.mockReturnValue(db); updateDb.mockImplementation(fn => fn(db))
})

describe('recommendation intelligence', () => {
  it('ranks collaborators using persisted execution signals', () => {
    const result = collaboratorRecommendations('founder-1', { requiredSkills: ['react'] })
    expect(result.recommendations[0].collaborator.id).toBe('collab-1')
    expect(result.recommendations[0].evidence.executionScore).toBe(91)
  })
  it('adds founder stage, stagnation, role, and execution-gap context', () => {
    const result = founderCollaboratorRecommendations('founder-1', 'project-1', {})
    expect(result.context.stage).toBe('mvp'); expect(result.context.stagnationDays).toBeGreaterThanOrEqual(14); expect(result.recommendations[0].reasons.length).toBeGreaterThan(0)
  })
  it('returns organization talent recommendations from needs and gaps', () => {
    const result = organizationTalentRecommendations('org-1', { organizationId: 'org-1', requiredSkills: ['react'] })
    expect(result.recommendations[0].person.id).toBe('collab-1')
  })
  it('ranks mentor targets by stagnation and expertise', () => {
    const result = mentorRecommendations('mentor-1', {})
    expect(result.recommendations[0].startup.id).toBe('project-2'); expect(result.recommendations[0].evidence.stagnationDays).toBeGreaterThan(0)
  })
  it('ranks investor thesis matches across public snapshots', () => {
    const result = investorThesisRecommendations('investor-1', {})
    expect(result.recommendations[0].startup.id).toBe('project-2'); expect(result.thesis.industries).toContain('fintech')
  })
  it('returns and persists a normalized daily intelligence contract', () => {
    const result = continuousIntelligence('founder-1', { role: 'founder' })
    expect(result.intelligence.cadence).toBe('daily'); expect(result.intelligence.role).toBe('founder'); expect(db.continuousIntelligenceSnapshots).toHaveLength(1)
  })
})
