import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import {
  requireCofounderFeature,
  requireCofounderRelationship,
  requireCofounderResource,
} from '../middlewares/cofounderAccess.js'
import {
  activity,
  candidateEvent,
  capabilities,
  decisionCreate,
  decisionRespond,
  decisions,
  invitationAcceptDiscussion,
  invitationAcceptProposal,
  invitationAdvance,
  invitationCreate,
  invitationDecline,
  invitationGet,
  invitationRequestChanges,
  invitationWithdraw,
  invitations,
  investorTeamSummaryPublish,
  objectiveCreate,
  objectivePatch,
  objectives,
  relationshipEnd,
  relationshipEvidence,
  relationshipGet,
  relationshipHealth,
  relationshipMode,
  relationshipPause,
  relationshipResume,
  relationshipWorkspace,
  relationships,
  requirementsGet,
  requirementsPut,
  responsibilityCreate,
  responsibilityPatch,
  responsibilities,
} from '../controllers/cofounderController.js'
import {
  ACTIVE_STATUSES,
  COFOUNDER_STATUSES,
} from '../services/cofounderModel.js'

const router = Router()

router.use(requireAuth)
router.get('/capabilities', capabilities)

router.use(requireCofounderFeature)

router.get('/ventures/:ventureId/requirements', requirementsGet)
router.put('/ventures/:ventureId/requirements', requirementsPut)
router.get('/ventures/:ventureId/mode', relationshipMode)
router.put('/ventures/:ventureId/investor-team-summary', investorTeamSummaryPublish)
router.post('/events', candidateEvent)

router.post('/invitations', invitationCreate)
router.get('/invitations', invitations)
router.get('/invitations/:relationshipId', invitationGet)
router.post('/invitations/:relationshipId/accept-discussion', invitationAcceptDiscussion)
router.post('/invitations/:relationshipId/request-changes', invitationRequestChanges)
router.post('/invitations/:relationshipId/decline', invitationDecline)
router.post('/invitations/:relationshipId/withdraw', invitationWithdraw)
router.post('/invitations/:relationshipId/advance', invitationAdvance)
router.post('/invitations/:relationshipId/accept-proposal', invitationAcceptProposal)

router.get('/relationships', relationships)
router.get('/relationships/:relationshipId', relationshipGet)
router.get(
  '/relationships/:relationshipId/workspace',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES }),
  relationshipWorkspace,
)
router.post(
  '/relationships/:relationshipId/pause',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES, permission: 'MANAGE_COFOUNDER_RELATIONSHIP' }),
  relationshipPause,
)
router.post(
  '/relationships/:relationshipId/resume',
  requireCofounderRelationship({ statuses: [COFOUNDER_STATUSES.PAUSED], permission: 'MANAGE_COFOUNDER_RELATIONSHIP' }),
  relationshipResume,
)
router.post(
  '/relationships/:relationshipId/end',
  requireCofounderRelationship({
    statuses: [COFOUNDER_STATUSES.ACTIVE, COFOUNDER_STATUSES.PAUSED],
    permission: 'MANAGE_COFOUNDER_RELATIONSHIP',
  }),
  relationshipEnd,
)

router.get(
  '/relationships/:relationshipId/responsibilities',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES }),
  responsibilities,
)
router.post(
  '/relationships/:relationshipId/responsibilities',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES, permission: 'ASSIGN_COFOUNDER_TASK' }),
  responsibilityCreate,
)
router.patch(
  '/responsibilities/:responsibilityId',
  requireCofounderResource({
    collection: 'cofounderResponsibilities',
    param: 'responsibilityId',
    statuses: ACTIVE_STATUSES,
    permission: 'ASSIGN_COFOUNDER_TASK',
  }),
  responsibilityPatch,
)

router.get(
  '/relationships/:relationshipId/objectives',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES, permission: 'VIEW_SHARED_OBJECTIVES' }),
  objectives,
)
router.post(
  '/relationships/:relationshipId/objectives',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES, permission: 'CREATE_SHARED_OBJECTIVE' }),
  objectiveCreate,
)
router.patch(
  '/objectives/:objectiveId',
  requireCofounderResource({
    collection: 'cofounderObjectives',
    param: 'objectiveId',
    statuses: ACTIVE_STATUSES,
    permission: 'CREATE_SHARED_OBJECTIVE',
  }),
  objectivePatch,
)

router.get(
  '/relationships/:relationshipId/decisions',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES }),
  decisions,
)
router.post(
  '/relationships/:relationshipId/decisions',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES, permission: 'CREATE_DECISION' }),
  decisionCreate,
)
router.post(
  '/decisions/:decisionId/respond',
  requireCofounderResource({
    collection: 'cofounderDecisions',
    param: 'decisionId',
    statuses: ACTIVE_STATUSES,
    permission: 'RESPOND_TO_DECISION',
  }),
  decisionRespond,
)

router.get(
  '/relationships/:relationshipId/activity',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES, permission: 'VIEW_PRIVATE_COFOUNDER_ACTIVITY' }),
  activity,
)
router.get(
  '/relationships/:relationshipId/health',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES }),
  relationshipHealth,
)
router.get(
  '/relationships/:relationshipId/evidence',
  requireCofounderRelationship({ statuses: ACTIVE_STATUSES, permission: 'VIEW_EXECUTION_EVIDENCE' }),
  relationshipEvidence,
)

export default router
