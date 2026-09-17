import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readDb, updateDb } from '../config/database.js'
import { evaluateOrganizationEntitlement, organizationCapacity } from '../services/organizationEntitlementService.js'
import { evaluateEntitlement } from '../services/tvceService.js'
import { createHackathon, getHackathon, listHackathons } from '../services/domainService.js'
import { createOrganizationBudget } from '../services/organizationBudgetService.js'
import { reserveUsage, settleUsage } from '../services/usageSettlementService.js'
import { convertHackathonTeam, hackathonOutcome } from '../services/organizationProgramService.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn() }))

describe('organization program licensing extension', () => {
  let db

  beforeEach(() => {
    db = {
      users: [{ id: 'org-user' }, { id: 'member' }],
      profiles: [{ id: 'org-user', role: 'organization', activeRole: 'organization', isOnboarded: true }, { id: 'member', role: 'founder', isOnboarded: true }],
      userRoles: [{ userId: 'org-user', role: 'organization', status: 'active' }],
      activeContexts: [{ userId: 'org-user', role: 'organization', organizationId: 'org-1', status: 'active' }],
      organizations: [{ id: 'org-1' }],
      organizationMemberships: [{ id: 'membership-1', organizationId: 'org-1', userId: 'org-user', role: 'program_manager', status: 'active' }, { id: 'membership-2', organizationId: 'org-1', userId: 'member', role: 'mentor', status: 'active' }],
      organizationEntitlements: [],
      organizationBudgets: [], organizationUsage: [], usageEvents: [], usageReservations: [],
      organizationPrograms: [], organizationCohorts: [], organizationReports: [], organizationDashboards: [],
      hackathons: [], hackathonTeams: [], hackathonMembers: [], hackathonInvitations: [], hackathonBriefs: [], hackathonCheckIns: [], hackathonScores: [], hackathonTeamWorkspaces: [], hackathonTeamReports: [], hackathonFinalSubmissions: [],
      projects: [], workspaces: [], mentorshipRooms: [], organizationAuditEvents: [],
      subscriptions: [], walletAccounts: [], creditLedger: [], capabilityConsumptions: [], capabilityAnalytics: [], accountEntitlements: [], capabilityPolicies: [], verificationProfiles: [], trustProfiles: [], riskProfiles: [],
    }
    readDb.mockReturnValue(db)
    updateDb.mockImplementation(fn => fn(db))
  })

  it('gives existing organizations a free Community Host entitlement without changing user billing', () => {
    const decision = evaluateOrganizationEntitlement('org-1', 'ORGANIZATION_HACKATHON_BASIC')
    expect(decision).toMatchObject({ allowed: true, entitlement: { plan: 'community_host', isDefault: true } })
    expect(evaluateEntitlement('org-user', { capability: 'ORGANIZATION_HACKATHON_BASIC', role: 'organization', organizationId: 'org-1' })).toMatchObject({ allowed: true, funding: 'none' })
  })

  it('returns an explicit capacity denial without mutating records', () => {
    db.hackathons.push({ id: 'h1', organizationId: 'org-1', status: 'draft' })
    expect(organizationCapacity('org-1', 'hackathons')).toMatchObject({ ok: false, error: 'organization_hackathons_limit_reached', used: 1, limit: 1 })
    expect(db.hackathons).toHaveLength(1)
  })

  it('creates organization-owned hackathons while preserving personal ownership', () => {
    const organizationHackathon = createHackathon('org-user', { name: 'Org Sprint', organizationId: 'org-1', visibility: 'private' })
    const personalHackathon = createHackathon('org-user', { name: 'Personal Sprint', visibility: 'private' })
    expect(organizationHackathon.hackathon).toMatchObject({ organizationId: 'org-1', ownerId: 'org-user', entitlementScope: 'organization' })
    expect(personalHackathon.hackathon).toMatchObject({ ownerId: 'org-user' })
    expect(personalHackathon.hackathon.organizationId).toBeUndefined()
  })

  it('allows organization members to view private organization hackathons', () => {
    const created = createHackathon('org-user', { name: 'Private Org Sprint', organizationId: 'org-1', visibility: 'private' })
    expect(getHackathon('member', created.hackathon.id)).toMatchObject({ organizationId: 'org-1' })
    expect(listHackathons('member').hackathons).toHaveLength(1)
  })

  it('rejects organization-owned hackathons without program permission', () => {
    db.organizationMemberships[1].role = 'read_only'
    const result = createHackathon('member', { name: 'Denied Sprint', organizationId: 'org-1' })
    expect(result).toMatchObject({ ok: false, error: 'organization_permission_denied' })
  })

  it('reserves and settles organization budget without debiting a personal wallet', () => {
    createOrganizationBudget('admin', { organizationId: 'org-1', hackathonId: 'hack-1', balance: 25 })
    const reserved = reserveUsage({ userId: 'org-user', requestId: 'org-request-1', taskType: 'capability:ORGANIZATION_HACKATHON_ADVANCED', estimatedCredits: 10, fundingSource: 'organization', organizationId: 'org-1', hackathonId: 'hack-1' })
    expect(reserved).toMatchObject({ ok: true, reservation: { fundingSource: 'organization' } })
    const settled = settleUsage({ userId: 'org-user', requestId: 'org-request-1', reservationId: reserved.reservation.reservationId, taskType: 'capability:ORGANIZATION_HACKATHON_ADVANCED', status: 'completed', fundingSource: 'organization', metadata: { organizationId: 'org-1' } })
    expect(settled.ok).toBe(true)
    expect(db.creditLedger).toHaveLength(0)
    expect(db.organizationBudgets[0]).toMatchObject({ balance: 15, reservedBalance: 0 })
  })

  it('generates an evidence-based outcome and requires founder consent for conversion', () => {
    const created = createHackathon('org-user', { name: 'Outcome Sprint', organizationId: 'org-1', visibility: 'private' })
    db.hackathonTeams.push({ id: 'team-1', hackathonId: created.hackathon.id, leaderId: 'member', name: 'Team One' })
    db.hackathonMembers.push({ id: 'member-1', hackathonId: created.hackathon.id, teamId: 'team-1', userId: 'member' })
    db.hackathonFinalSubmissions.push({ id: 'final-1', hackathonId: created.hackathon.id, teamId: 'team-1' })
    expect(hackathonOutcome('org-user', created.hackathon.id).report).toMatchObject({ participants: 1, teams: 1, completedProjects: 1 })
    expect(convertHackathonTeam('member', created.hackathon.id, 'team-1', { consent: false })).toMatchObject({ ok: false, error: 'founder_consent_required' })
    expect(convertHackathonTeam('member', created.hackathon.id, 'team-1', { consent: true })).toMatchObject({ ok: true, candidate: { organizationId: 'org-1' } })
  })
})
