import { Router } from 'express'
import {
  analyses,
  analysisCreate,
  analysisGet,
  collaborationCallCreate,
  collaboratorScores,
  contractCountersign,
  contractCreate,
  contractGet,
  contracts,
  contractSign,
  contributions,
  dealFlow,
  earnings,
  earningsWithdraw,
  endorsementCreate,
  endorsements,
  equity,
  equityDilution,
  founderProjectCreate,
  founderProjectPatch,
  founderProjects,
  founderEquity,
  genericCreatePost,
  genericDeleteItem,
  genericListGet,
  genericPatchItem,
  hackathonBrief,
  hackathonCheckIn,
  hackathonCreate,
  hackathonGet,
  hackathonInviteAccept,
  hackathonInviteGet,
  hackathonInvitationCreate,
  hackathonLeaderboard,
  hackathonOverview,
  hackathonPipeline,
  hackathonRegister,
  hackathonRegistrations,
  hackathons,
  hackathonTeamStatus,
  hackathonTeamPatch,
  hackathonVelocity,
  hackathonWorkspace,
  hackathonProjectEntryCreate,
  hackathonProjectEntryGet,
  hackathonReport,
  hackathonFinal,
  intakeCreate,
  intakeGet,
  intakePromote,
  intakes,
  investorCreate,
  investorList,
  notificationPrefsGet,
  notificationPrefsPatch,
  orgDashboard,
  programInvitationCreate,
  programEnrollments,
  myProgramEnrollments,
  programInvitationAccept,
  orgCohortHealth,
  orgInterventions,
  orgImpact,
  orgKpiTargets,
  orgKpiTargetSave,
  orgDemoDayPipeline,
  orgDemoDayPublish,
  orgInvestorMatches,
  orgDemoDayEvents,
  orgDemoDayEventCreate,
  orgDemoDayAnalytics,
  organizationProjectCreate,
  organizationProjectPatch,
  organizationProjects,
  walletAnalyticsGet,
  walletListGet,
  walletPaymentIntent,
  walletSummaryGet,
  applicationsList,
  incubationPublish,
  executionIntelligence,
  platformMetrics,
  opportunityApply,
  watchlist,
  watchlistAdd,
  watchlistRemove,
  watchlistPreferences,
  watchlistPreferencesPatch,
  workspaceContextGet,
  workspaceCallToken,
  workspaceInvitationAccept,
  workspaceInvitationCreate,
  workspaceInvitationDecline,
  workspaceInvitationGet,
  workspaceItemCreate,
  workspaceItemPatch,
  workspaceItems,
  workspaceTaskEvent,
  workspaceTaskOne,
  workspaceTaskRun,
  connectorCredentialGet,
  connectorCredentialRemove,
  connectorCredentialSet,
  workspaceMemberDelete,
  workspaceMembersGet,
  workspaceProvision,
  workspaces,
} from '../controllers/domainController.js'
import { requireAuth } from '../middlewares/auth.js'
import { requireRole } from '../utils/roleGuards.js'
import { requireCapability } from '../services/capabilityAuthorization.js'

const router = Router()

router.use(requireAuth)

function bindCollection(collectionName, responseKey, itemKey, itemPrefix, collectionScope = null) {
  return (req, _res, next) => {
    req.collectionName = collectionName
    req.responseKey = responseKey
    req.itemKey = itemKey
    req.itemPrefix = itemPrefix
    req.collectionScope = collectionScope
    next()
  }
}

// Owner-scoped collections (`generic*` cut over to the row-level store in §5).
// The caller owns every row, so the store loads only their rows by `ownerId`.
function bindOwnedCollection(collectionName, responseKey, itemKey, itemPrefix) {
  return bindCollection(collectionName, responseKey, itemKey, itemPrefix, { field: 'ownerId' })
}

// Organization-scoped collections accept caller-owned legacy rows plus rows
// belonging to an organization in which the caller has an active membership.
function bindOrganizationCollection(collectionName, responseKey, itemKey, itemPrefix) {
  return bindCollection(collectionName, responseKey, itemKey, itemPrefix, { field: 'ownerId', organizationScoped: true })
}

// Public surfaces: the store loads the caller's own rows plus a bounded recent
// window of other owners' public rows (see `domainRepository.buildDomainDb`).
function bindPublicCollection(collectionName, responseKey, itemKey, itemPrefix, ownerFields) {
  return bindCollection(collectionName, responseKey, itemKey, itemPrefix, { public: true, ownerFields })
}

/**
 * The workspace `connectors` collection predates the canonical MCP registry
 * (BACKEND Plugins-MCP, `/api/mcp/*`). It is retained for existing deployments
 * but is NOT the production credential surface: connector credentials are
 * workspace-scoped in the MCP vault (ADR-1) and the UI now reads
 * `/api/mcp/tools` + `/api/mcp/connections`. Deprecated — removal is tied to the
 * legacy bootstrap-credential milestone (2026-12-31).
 */
function deprecatedConnectorCollection(_req, res, next) {
  res.set('Deprecation', 'true')
  res.set('Link', '</api/mcp/connections>; rel="successor-version"')
  next()
}

router.get('/founder/projects', founderProjects)
router.post('/founder/projects', founderProjectCreate)
router.patch('/founder/projects/:projectId', founderProjectPatch)
router.get('/founder/equity', founderEquity)

router.get('/endorsements', endorsements)
router.post('/endorsements', endorsementCreate)

router.get('/contracts', contracts)
router.post('/contracts', contractCreate)
router.get('/contracts/:id', contractGet)
router.patch('/contracts/:id/sign', contractSign)
router.patch('/contracts/:id/countersign', contractCountersign)

router.get('/collaborator/equity', equity)
router.post('/collaborator/equity/dilution', equityDilution)
router.get('/collaborator/earnings', earnings)
router.post('/collaborator/earnings/withdraw', earningsWithdraw)
router.get('/collaborator/contributions', contributions)
router.get('/collaborator/scores', collaboratorScores)

router.get('/organization/dashboard', orgDashboard)
router.get('/organization/projects', requireRole('organization', 'organisation'), organizationProjects)
router.post('/organization/projects', requireRole('organization', 'organisation'), organizationProjectCreate)
router.patch('/organization/projects/:projectId', requireRole('organization', 'organisation'), organizationProjectPatch)
router.get('/organization/cohort-health', requireRole('organization', 'organisation'), orgCohortHealth)
router.get('/organization/interventions', requireRole('organization', 'organisation'), orgInterventions)
router.get('/organization/impact', requireRole('organization', 'organisation'), orgImpact)
router.get('/organization/kpi-targets', requireRole('organization', 'organisation'), orgKpiTargets)
router.post('/organization/kpi-targets', requireRole('organization', 'organisation'), orgKpiTargetSave)
router.get('/organization/demo-day/pipeline', requireRole('organization', 'organisation'), orgDemoDayPipeline)
router.post('/organization/demo-day/publish', requireRole('organization', 'organisation'), orgDemoDayPublish)
router.get('/organization/demo-day/matches/:projectId', requireRole('organization', 'organisation'), orgInvestorMatches)
router.get('/organization/demo-day/events', requireRole('organization', 'organisation'), orgDemoDayEvents)
router.post('/organization/demo-day/events', requireRole('organization', 'organisation'), orgDemoDayEventCreate)
router.get('/organization/demo-day/analytics', requireRole('organization', 'organisation'), requireCapability('organization.analytics', undefined, { consume: true }), orgDemoDayAnalytics)
router.get('/organization/marketplace', requireRole('organization', 'organisation'), bindOwnedCollection('organizationMarketplace', 'items', 'item', 'market'), genericListGet)
router.post('/organization/marketplace', requireCapability('organization.opportunity.create'), bindOwnedCollection('organizationMarketplace', 'items', 'item', 'market'), genericCreatePost)
router.patch('/organization/marketplace/:id', requireCapability('organization.opportunity.create'), bindOwnedCollection('organizationMarketplace', 'items', 'item', 'market'), genericPatchItem)
router.get('/organization/talent', requireRole('organization', 'organisation'), bindOwnedCollection('organizationTalent', 'talent', 'talent', 'talent'), genericListGet)
router.post('/organization/talent', requireCapability('organization.recruit', undefined, { consume: true }), bindOwnedCollection('organizationTalent', 'talent', 'talent', 'talent'), genericCreatePost)
router.patch('/organization/talent/:id', requireCapability('organization.recruit', undefined, { consume: true }), bindOwnedCollection('organizationTalent', 'talent', 'talent', 'talent'), genericPatchItem)
router.get('/organization/settings', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationSettings', 'settings', 'setting', 'orgsetting'), genericListGet)
router.post('/organization/settings', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationSettings', 'settings', 'setting', 'orgsetting'), genericCreatePost)
router.patch('/organization/settings/:id', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationSettings', 'settings', 'setting', 'orgsetting'), genericPatchItem)
router.get('/organization/integrations', requireCapability('organization.profile.manage'), bindOrganizationCollection('organizationIntegrations', 'integrations', 'integration', 'integration'), genericListGet)
router.post('/organization/integrations', requireCapability('organization.profile.manage'), bindOrganizationCollection('organizationIntegrations', 'integrations', 'integration', 'integration'), genericCreatePost)
router.patch('/organization/integrations/:id', requireCapability('organization.profile.manage'), bindOrganizationCollection('organizationIntegrations', 'integrations', 'integration', 'integration'), genericPatchItem)
router.get('/organization/programs', requireRole('organization', 'organisation'), bindOwnedCollection('organizationPrograms', 'programs', 'program', 'program'), genericListGet)
router.post('/organization/programs', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationPrograms', 'programs', 'program', 'program'), genericCreatePost)
// Phase O: invite a founder to a program and read the enrolled roster.
router.post('/organization/programs/:programId/invitations', requireRole('organization', 'organisation'), programInvitationCreate)
router.get('/organization/programs/:programId/enrollments', requireRole('organization', 'organisation'), programEnrollments)
// Founder-facing: my program enrollments + accept an invite token.
router.get('/organization/enrollments', myProgramEnrollments)
router.post('/organization/enrollments/accept', programInvitationAccept)
router.patch('/organization/programs/:id', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationPrograms', 'programs', 'program', 'program'), genericPatchItem)
router.get('/organization/ai-operations', requireRole('organization', 'organisation'), bindOwnedCollection('organizationAiOperations', 'operations', 'operation', 'aiop'), genericListGet)
router.post('/organization/ai-operations', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationAiOperations', 'operations', 'operation', 'aiop'), genericCreatePost)
router.patch('/organization/ai-operations/:id', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationAiOperations', 'operations', 'operation', 'aiop'), genericPatchItem)
router.get('/organization/market-readiness', requireRole('organization', 'organisation'), bindOwnedCollection('organizationMarketReadiness', 'records', 'record', 'readiness'), genericListGet)
router.post('/organization/market-readiness', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationMarketReadiness', 'records', 'record', 'readiness'), genericCreatePost)
router.patch('/organization/market-readiness/:id', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationMarketReadiness', 'records', 'record', 'readiness'), genericPatchItem)
router.get('/organization/community', requireRole('organization', 'organisation'), bindOwnedCollection('organizationCommunity', 'posts', 'post', 'orgpost'), genericListGet)
router.post('/organization/community', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationCommunity', 'posts', 'post', 'orgpost'), genericCreatePost)
router.patch('/organization/community/:id', requireCapability('organization.profile.manage'), bindOwnedCollection('organizationCommunity', 'posts', 'post', 'orgpost'), genericPatchItem)

router.get('/investor/deal-flow', dealFlow)
router.get('/investor/watchlist', watchlist)
router.post('/investor/watchlist', watchlistAdd)
router.delete('/investor/watchlist/:projectId', watchlistRemove)
router.get('/investor/watchlist/preferences', watchlistPreferences)
router.patch('/investor/watchlist/preferences', watchlistPreferencesPatch)
router.get('/investor/capital-pools', bindCollection('capitalPools', 'capitalPools', 'capitalPool', 'pool'), investorList)
router.post('/investor/capital-pools', bindCollection('capitalPools', 'capitalPools', 'capitalPool', 'pool'), investorCreate)
router.get('/investor/deal-rooms', requireCapability('dealroom.access', undefined, { consume: true }), bindCollection('dealRooms', 'dealRooms', 'dealRoom', 'dealroom'), investorList)
router.post('/investor/deal-rooms', requireCapability('dealroom.access', undefined, { consume: true }), bindCollection('dealRooms', 'dealRooms', 'dealRoom', 'dealroom'), investorCreate)
router.get('/investor/data-rooms', requireCapability('dealroom.access', undefined, { consume: true }), bindCollection('dataRooms', 'dataRooms', 'dataRoom', 'dataroom'), investorList)
router.post('/investor/data-rooms', requireCapability('dealroom.access', undefined, { consume: true }), bindCollection('dataRooms', 'dataRooms', 'dataRoom', 'dataroom'), investorCreate)
router.get('/investor/reputation', bindCollection('investorReputation', 'reputation', 'reputation', 'reputation'), investorList)
router.post('/investor/reputation', bindCollection('investorReputation', 'reputation', 'reputation', 'reputation'), investorCreate)
router.get('/investor/heatmap', requireCapability('investor.intelligence.view', undefined, { consume: true }), bindCollection('dealFlowSnapshots', 'heatmap', 'heatmapPoint', 'heatmap'), investorList)

router.get('/incubation/intakes', intakes)
router.post('/incubation/intakes', intakeCreate)
router.get('/incubation/intakes/:intakeId', intakeGet)
router.post('/incubation/intakes/:intakeId/promote', intakePromote)
router.post('/incubation/publish', incubationPublish)
// WS-H: one canonical execution-intelligence view for every consumer surface.
router.get('/execution-intelligence', executionIntelligence)
// Phase M: platform-wide execution metrics (startups/prototypes/MVPs/launches/milestones).
router.get('/platform/metrics', platformMetrics)
router.get('/incubation/analyses', analyses)
router.post('/incubation/analyses', analysisCreate)
router.get('/incubation/analyses/:analysisId', analysisGet)

router.get('/hackathons', hackathons)
router.post('/hackathons', hackathonCreate)
router.get('/hackathons/registrations', hackathonRegistrations)
router.get('/hackathons/:hackathonId/overview', hackathonOverview)
router.get('/hackathons/:hackathonId/velocity', hackathonVelocity)
router.get('/hackathons/:hackathonId/leaderboard', hackathonLeaderboard)
router.get('/hackathons/:hackathonId/pipeline', hackathonPipeline)
router.post('/hackathons/:hackathonId/register', hackathonRegister)
router.post('/hackathons/:hackathonId/brief', hackathonBrief)
router.post('/hackathons/:hackathonId/checkin', hackathonCheckIn)
router.post('/hackathons/:hackathonId/teams/:teamId/invitations', hackathonInvitationCreate)
router.get('/hackathons/:hackathonId/teams/:teamId/invite', hackathonInviteGet)
router.post('/hackathons/:hackathonId/teams/:teamId/invite', hackathonInviteAccept)
router.patch('/hackathons/:hackathonId/teams/:teamId', hackathonTeamPatch)
router.post('/hackathons/:hackathonId/teams/:teamId/final', hackathonFinal)
router.get('/hackathons/:hackathonId/teams/:teamId/status', hackathonTeamStatus)
router.post('/hackathons/:hackathonId/teams/:teamId/workspace', hackathonWorkspace)
router.post('/hackathons/:hackathonId/teams/:teamId/project-entry', requireCapability('workspace.hackathon.attach'), hackathonProjectEntryCreate)
router.get('/hackathons/:hackathonId/teams/:teamId/project-entry', hackathonProjectEntryGet)
router.post('/hackathons/:hackathonId/teams/:teamId/report', hackathonReport)
router.get('/hackathons/:hackathonId', hackathonGet)

router.get('/workspaces', workspaces)
router.post('/workspaces/provision', workspaceProvision)
router.get('/workspace-invitations/:invitationId', workspaceInvitationGet)
router.post('/workspace-invitations/:invitationId/accept', workspaceInvitationAccept)
router.post('/workspace-invitations/:invitationId/decline', workspaceInvitationDecline)
router.get('/workspaces/:workspaceId/context', workspaceContextGet)
router.post('/workspaces/:workspaceId/call-token', workspaceCallToken)
router.post('/workspaces/:workspaceId/invitations', workspaceInvitationCreate)
router.get('/workspaces/:workspaceId/members', workspaceMembersGet)
router.delete('/workspaces/:workspaceId/members/:memberId', workspaceMemberDelete)
router.get('/workspaces/:workspaceId/tasks', bindCollection('workspaceTasks', 'tasks', 'task', 'task'), workspaceItems)
router.post('/workspaces/:workspaceId/tasks', bindCollection('workspaceTasks', 'tasks', 'task', 'task'), workspaceItemCreate)
router.get('/workspaces/:workspaceId/tasks/:itemId', bindCollection('workspaceTasks', 'tasks', 'task', 'task'), workspaceTaskOne)
router.post('/workspaces/:workspaceId/tasks/:itemId/events', bindCollection('workspaceTasks', 'tasks', 'task', 'task'), workspaceTaskEvent)
router.post('/workspaces/:workspaceId/tasks/:itemId/run', bindCollection('workspaceTasks', 'tasks', 'task', 'task'), workspaceTaskRun)
router.patch('/workspaces/:workspaceId/tasks/:itemId', bindCollection('workspaceTasks', 'tasks', 'task', 'task'), workspaceItemPatch)
router.get('/workspaces/:workspaceId/agents', bindCollection('workspaceAgents', 'agents', 'agent', 'agent'), workspaceItems)
router.post('/workspaces/:workspaceId/agents', bindCollection('workspaceAgents', 'agents', 'agent', 'agent'), workspaceItemCreate)
router.patch('/workspaces/:workspaceId/agents/:itemId', bindCollection('workspaceAgents', 'agents', 'agent', 'agent'), workspaceItemPatch)
// Legacy workspace connector surface — retained for compatibility, deprecated in
// favour of /api/mcp/connections (ADR-1). The sealed-credential routes below were
// added on main; they are kept working but marked deprecated so nothing new
// builds on the non-MCP credential store.
router.get('/workspaces/:workspaceId/connectors', deprecatedConnectorCollection, bindCollection('workspaceConnectors', 'connectors', 'connector', 'connector'), workspaceItems)
router.post('/workspaces/:workspaceId/connectors', deprecatedConnectorCollection, bindCollection('workspaceConnectors', 'connectors', 'connector', 'connector'), workspaceItemCreate)
router.get('/workspaces/:workspaceId/connectors/:itemId/credential', deprecatedConnectorCollection, bindCollection('workspaceConnectors', 'connectors', 'connector', 'connector'), connectorCredentialGet)
router.post('/workspaces/:workspaceId/connectors/:itemId/credential', deprecatedConnectorCollection, bindCollection('workspaceConnectors', 'connectors', 'connector', 'connector'), connectorCredentialSet)
router.delete('/workspaces/:workspaceId/connectors/:itemId/credential', deprecatedConnectorCollection, bindCollection('workspaceConnectors', 'connectors', 'connector', 'connector'), connectorCredentialRemove)
router.patch('/workspaces/:workspaceId/connectors/:itemId', deprecatedConnectorCollection, bindCollection('workspaceConnectors', 'connectors', 'connector', 'connector'), workspaceItemPatch)
router.get('/workspaces/:workspaceId/reports', bindCollection('workspaceReports', 'reports', 'report', 'report'), workspaceItems)
router.post('/workspaces/:workspaceId/reports', bindCollection('workspaceReports', 'reports', 'report', 'report'), workspaceItemCreate)
router.patch('/workspaces/:workspaceId/reports/:itemId', bindCollection('workspaceReports', 'reports', 'report', 'report'), workspaceItemPatch)

router.get('/wallet/summary', walletSummaryGet)
router.get('/wallet/usage', bindCollection('usageEvents', 'usage', 'usageEvent', 'usage'), walletListGet)
router.get('/wallet/transactions', bindCollection('creditLedger', 'transactions', 'transaction', 'ledger'), walletListGet)
router.get('/wallet/plans', bindCollection('billingPlans', 'plans', 'plan', 'plan'), walletListGet)
router.get('/wallet/credit-packages', bindCollection('creditPackages', 'creditPackages', 'creditPackage', 'package'), walletListGet)
router.get('/wallet/subscriptions', bindCollection('subscriptions', 'subscriptions', 'subscription', 'subscription'), walletListGet)
router.get('/wallet/invoices', bindCollection('invoices', 'invoices', 'invoice', 'invoice'), walletListGet)
router.get('/wallet/analytics', walletAnalyticsGet)
router.post('/wallet/payment-intents', walletPaymentIntent)

router.get('/opportunities', bindPublicCollection('opportunities', 'opportunities', 'opportunity', 'opp', ['ownerId', 'userId', 'createdBy']), genericListGet)
router.post('/opportunities/collaboration-calls', requireRole('founder', 'collaborator'), collaborationCallCreate)
router.post('/opportunities', bindPublicCollection('opportunities', 'opportunities', 'opportunity', 'opp', ['ownerId', 'userId', 'createdBy']), genericCreatePost)
router.patch('/opportunities/:itemId', bindPublicCollection('opportunities', 'opportunities', 'opportunity', 'opp', ['ownerId', 'userId', 'createdBy']), genericPatchItem)
router.post('/opportunities/:id/apply', opportunityApply)
router.get('/applications', applicationsList)
router.get('/files', bindPublicCollection('files', 'files', 'file', 'file', ['ownerId', 'userId', 'createdBy']), genericListGet)
router.post('/files', bindPublicCollection('files', 'files', 'file', 'file', ['ownerId', 'userId', 'createdBy']), genericCreatePost)
router.delete('/files/:itemId', bindPublicCollection('files', 'files', 'file', 'file', ['ownerId', 'userId', 'createdBy']), genericDeleteItem)
router.get('/notifications/preferences', notificationPrefsGet)
router.patch('/notifications/preferences', notificationPrefsPatch)
router.get('/settings', bindPublicCollection('settingsEvents', 'settingsEvents', 'settingsEvent', 'settings', ['userId', 'ownerId']), genericListGet)
router.post('/settings', bindPublicCollection('settingsEvents', 'settingsEvents', 'settingsEvent', 'settings', ['userId', 'ownerId']), genericCreatePost)

export default router
