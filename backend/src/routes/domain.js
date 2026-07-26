import { Router } from 'express'
import {
  analyses,
  analysisCreate,
  analysisGet,
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
  genericCreatePost,
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
  organizationProjectCreate,
  organizationProjectPatch,
  organizationProjects,
  walletListGet,
  walletPaymentIntent,
  walletSummaryGet,
  applicationsList,
  opportunityApply,
  watchlist,
  watchlistAdd,
  workspaceContextGet,
  workspaceItemCreate,
  workspaceItemPatch,
  workspaceItems,
  workspaceProvision,
  workspaces,
} from '../controllers/domainController.js'
import { requireAuth } from '../middlewares/auth.js'
import { requireRole } from '../utils/roleGuards.js'

const router = Router()

router.use(requireAuth)

function bindCollection(collectionName, responseKey, itemKey, itemPrefix) {
  return (req, _res, next) => {
    req.collectionName = collectionName
    req.responseKey = responseKey
    req.itemKey = itemKey
    req.itemPrefix = itemPrefix
    next()
  }
}

router.get('/founder/projects', founderProjects)
router.post('/founder/projects', founderProjectCreate)
router.patch('/founder/projects/:projectId', founderProjectPatch)

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

router.get('/investor/deal-flow', dealFlow)
router.get('/investor/watchlist', watchlist)
router.post('/investor/watchlist', watchlistAdd)
router.get('/investor/capital-pools', bindCollection('capitalPools', 'capitalPools', 'capitalPool', 'pool'), investorList)
router.post('/investor/capital-pools', bindCollection('capitalPools', 'capitalPools', 'capitalPool', 'pool'), investorCreate)
router.get('/investor/deal-rooms', bindCollection('dealRooms', 'dealRooms', 'dealRoom', 'dealroom'), investorList)
router.post('/investor/deal-rooms', bindCollection('dealRooms', 'dealRooms', 'dealRoom', 'dealroom'), investorCreate)
router.get('/investor/data-rooms', bindCollection('dataRooms', 'dataRooms', 'dataRoom', 'dataroom'), investorList)
router.post('/investor/data-rooms', bindCollection('dataRooms', 'dataRooms', 'dataRoom', 'dataroom'), investorCreate)
router.get('/investor/reputation', bindCollection('investorReputation', 'reputation', 'reputation', 'reputation'), investorList)
router.post('/investor/reputation', bindCollection('investorReputation', 'reputation', 'reputation', 'reputation'), investorCreate)
router.get('/investor/heatmap', bindCollection('dealFlowSnapshots', 'heatmap', 'heatmapPoint', 'heatmap'), investorList)

router.get('/incubation/intakes', intakes)
router.post('/incubation/intakes', intakeCreate)
router.get('/incubation/intakes/:intakeId', intakeGet)
router.post('/incubation/intakes/:intakeId/promote', intakePromote)
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
router.post('/hackathons/:hackathonId/teams/:teamId/report', hackathonReport)
router.get('/hackathons/:hackathonId', hackathonGet)

router.get('/workspaces', workspaces)
router.post('/workspaces/provision', workspaceProvision)
router.get('/workspaces/:workspaceId/context', workspaceContextGet)
router.get('/workspaces/:workspaceId/tasks', bindCollection('workspaceTasks', 'tasks', 'task', 'task'), workspaceItems)
router.post('/workspaces/:workspaceId/tasks', bindCollection('workspaceTasks', 'tasks', 'task', 'task'), workspaceItemCreate)
router.patch('/workspaces/:workspaceId/tasks/:itemId', bindCollection('workspaceTasks', 'tasks', 'task', 'task'), workspaceItemPatch)
router.get('/workspaces/:workspaceId/agents', bindCollection('workspaceAgents', 'agents', 'agent', 'agent'), workspaceItems)
router.post('/workspaces/:workspaceId/agents', bindCollection('workspaceAgents', 'agents', 'agent', 'agent'), workspaceItemCreate)
router.patch('/workspaces/:workspaceId/agents/:itemId', bindCollection('workspaceAgents', 'agents', 'agent', 'agent'), workspaceItemPatch)
router.get('/workspaces/:workspaceId/connectors', bindCollection('workspaceConnectors', 'connectors', 'connector', 'connector'), workspaceItems)
router.post('/workspaces/:workspaceId/connectors', bindCollection('workspaceConnectors', 'connectors', 'connector', 'connector'), workspaceItemCreate)
router.patch('/workspaces/:workspaceId/connectors/:itemId', bindCollection('workspaceConnectors', 'connectors', 'connector', 'connector'), workspaceItemPatch)
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
router.post('/wallet/payment-intents', walletPaymentIntent)

router.get('/opportunities', bindCollection('opportunities', 'opportunities', 'opportunity', 'opp'), genericListGet)
router.post('/opportunities', bindCollection('opportunities', 'opportunities', 'opportunity', 'opp'), genericCreatePost)
router.patch('/opportunities/:itemId', bindCollection('opportunities', 'opportunities', 'opportunity', 'opp'), genericPatchItem)
router.post('/opportunities/:id/apply', opportunityApply)
router.get('/applications', applicationsList)
router.get('/files', bindCollection('files', 'files', 'file', 'file'), genericListGet)
router.get('/notifications/preferences', notificationPrefsGet)
router.patch('/notifications/preferences', notificationPrefsPatch)
router.get('/settings', bindCollection('settingsEvents', 'settingsEvents', 'settingsEvent', 'settings'), genericListGet)
router.post('/settings', bindCollection('settingsEvents', 'settingsEvents', 'settingsEvent', 'settings'), genericCreatePost)

export default router
