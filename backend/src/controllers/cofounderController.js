import {
  acceptDiscussionAsync,
  acceptProposalAsync,
  advanceRelationshipAsync,
  cofounderCapabilitiesAsync,
  createDecisionAsync,
  createInvitationAsync,
  createObjectiveAsync,
  createResponsibilityAsync,
  declineInvitationAsync,
  endRelationshipAsync,
  getInvitationAsync,
  getRelationshipAsync,
  getRelationshipEvidenceAsync,
  getRelationshipHealthAsync,
  getRelationshipModeAsync,
  getRelationshipWorkspaceAsync,
  getRequirementsAsync,
  listActivityAsync,
  listDecisionsAsync,
  listInvitationsAsync,
  listObjectivesAsync,
  listRelationshipsAsync,
  listResponsibilitiesAsync,
  patchObjectiveAsync,
  patchResponsibilityAsync,
  pauseRelationshipAsync,
  publishInvestorTeamSummaryAsync,
  requestChangesAsync,
  respondToDecisionAsync,
  resumeRelationshipAsync,
  upsertRequirementsAsync,
  withdrawInvitationAsync,
} from '../services/cofounderRelationshipService.js'

const requestBody = req => req.body && typeof req.body === 'object' ? req.body : {}
const withIdempotency = req => ({
  ...requestBody(req),
  idempotencyKey: req.get('idempotency-key') || requestBody(req).idempotencyKey || null,
})
const send = (res, result, success = 200) => {
  if (result?.ok === false) return res.status(result.status || 400).json(result)
  return res.status(success).json(result)
}

export async function capabilities(req, res) {
  return send(res, await cofounderCapabilitiesAsync(req.user.id))
}

export async function requirementsGet(req, res) {
  return send(res, await getRequirementsAsync(req.user.id, req.params.ventureId))
}

export async function requirementsPut(req, res) {
  return send(res, await upsertRequirementsAsync(req.user.id, req.params.ventureId, requestBody(req)))
}

export async function invitationCreate(req, res) {
  return send(res, await createInvitationAsync(req.user.id, withIdempotency(req)), 201)
}

export async function invitations(req, res) {
  return send(res, await listInvitationsAsync(req.user.id, req.query))
}

export async function invitationGet(req, res) {
  return send(res, await getInvitationAsync(req.user.id, req.params.relationshipId))
}

export async function invitationAcceptDiscussion(req, res) {
  return send(res, await acceptDiscussionAsync(req.user.id, req.params.relationshipId, requestBody(req)))
}

export async function invitationRequestChanges(req, res) {
  return send(res, await requestChangesAsync(req.user.id, req.params.relationshipId, requestBody(req)))
}

export async function invitationDecline(req, res) {
  return send(res, await declineInvitationAsync(req.user.id, req.params.relationshipId, requestBody(req)))
}

export async function invitationWithdraw(req, res) {
  return send(res, await withdrawInvitationAsync(req.user.id, req.params.relationshipId, requestBody(req)))
}

export async function invitationAdvance(req, res) {
  return send(res, await advanceRelationshipAsync(req.user.id, req.params.relationshipId, requestBody(req)))
}

export async function invitationAcceptProposal(req, res) {
  return send(res, await acceptProposalAsync(req.user.id, req.params.relationshipId, withIdempotency(req)))
}

export async function relationshipMode(req, res) {
  return send(res, await getRelationshipModeAsync(req.user.id, req.params.ventureId))
}

export async function relationships(req, res) {
  return send(res, await listRelationshipsAsync(req.user.id, req.query))
}

export async function relationshipGet(req, res) {
  return send(res, await getRelationshipAsync(req.user.id, req.params.relationshipId))
}

export async function relationshipWorkspace(req, res) {
  return send(res, await getRelationshipWorkspaceAsync(req.user.id, req.params.relationshipId))
}

export async function relationshipPause(req, res) {
  return send(res, await pauseRelationshipAsync(req.user.id, req.params.relationshipId, requestBody(req)))
}

export async function relationshipResume(req, res) {
  return send(res, await resumeRelationshipAsync(req.user.id, req.params.relationshipId, requestBody(req)))
}

export async function relationshipEnd(req, res) {
  return send(res, await endRelationshipAsync(req.user.id, req.params.relationshipId, requestBody(req)))
}

export async function responsibilities(req, res) {
  return send(res, await listResponsibilitiesAsync(req.user.id, req.params.relationshipId))
}

export async function responsibilityCreate(req, res) {
  return send(res, await createResponsibilityAsync(req.user.id, req.params.relationshipId, requestBody(req)), 201)
}

export async function responsibilityPatch(req, res) {
  return send(res, await patchResponsibilityAsync(req.user.id, req.params.responsibilityId, requestBody(req)))
}

export async function objectives(req, res) {
  return send(res, await listObjectivesAsync(req.user.id, req.params.relationshipId))
}

export async function objectiveCreate(req, res) {
  return send(res, await createObjectiveAsync(req.user.id, req.params.relationshipId, requestBody(req)), 201)
}

export async function objectivePatch(req, res) {
  return send(res, await patchObjectiveAsync(req.user.id, req.params.objectiveId, requestBody(req)))
}

export async function decisions(req, res) {
  return send(res, await listDecisionsAsync(req.user.id, req.params.relationshipId))
}

export async function decisionCreate(req, res) {
  return send(res, await createDecisionAsync(req.user.id, req.params.relationshipId, requestBody(req)), 201)
}

export async function decisionRespond(req, res) {
  return send(res, await respondToDecisionAsync(req.user.id, req.params.decisionId, requestBody(req)))
}

export async function activity(req, res) {
  return send(res, await listActivityAsync(req.user.id, req.params.relationshipId, req.query))
}

export async function relationshipHealth(req, res) {
  return send(res, await getRelationshipHealthAsync(req.user.id, req.params.relationshipId))
}

export async function relationshipEvidence(req, res) {
  return send(res, await getRelationshipEvidenceAsync(req.user.id, req.params.relationshipId))
}

export async function investorTeamSummaryPublish(req, res) {
  return send(res, await publishInvestorTeamSummaryAsync(req.user.id, req.params.ventureId, requestBody(req)), 201)
}
