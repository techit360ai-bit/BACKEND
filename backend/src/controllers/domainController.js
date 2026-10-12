import {
  livekitEnabled,
  livekitRoomName,
  livekitUrl,
  mintLivekitToken,
} from '../services/livekitService.js'
import { invalidateDiscoveryType } from '../services/discoveryInfrastructure.js'
import {
  addWatchlistAsync,
  removeWatchlistAsync,
  listWatchlistPreferencesAsync,
  updateWatchlistPreferencesAsync,
  collaboratorEarnings,
  collaboratorEquity,
  countersignContractAsync,
  createCollaborationCallAsync,
  createAnalysisAsync,
  createContractAsync,
  createHackathonAsync,
  createHackathonInvitationAsync,
  createEndorsementAsync,
  createIntakeAsync,
  createInvestorCollectionAsync,
  createOrganizationProjectAsync,
  createPaymentIntent,
  createPaymentIntentAsync,
  createProject,
  createWorkspaceCollectionItemAsync,
  createWorkspaceInvitation,
  founderCapTable,
  genericCreateAsync,
  genericDelete,
  genericListAsync,
  genericPatchAsync,
  getAnalysisAsync,
  getCollaboratorScoresAsync,
  getContractAsync,
  getHackathonAsync,
  getHackathonInviteAsync,
  getIntakeAsync,
  getNotificationPreferencesAsync,
  hackathonAggregatesAsync,
  hackathonStatusAsync,
  investorCollectionAsync,
  investorDealFlowAsync,
  listAnalysesAsync,
  listContractsAsync,
  listContributionsAsync,
  listEndorsementsAsync,
  listHackathonsAsync,
  listHackathonRegistrationsAsync,
  listIntakesAsync,
  listOrganizationProjectsAsync,
  organizationCohortHealthAsync,
  organizationInterventionsAsync,
  organizationImpactAsync,
  organizationKpiTargetsAsync,
  saveOrganizationKpiTargetAsync,
  demoDayPipelineAsync,
  publishOrganizationProjectAsync,
  investorMatchesAsync,
  organizationDemoDayEventsAsync,
  createOrganizationDemoDayEventAsync,
  organizationDemoDayAnalyticsAsync,
  listProjects,
  listProjectsAsync,
  listWatchlistAsync,
  listWorkspaceCollectionAsync,
  listWorkspaceMembers,
  listWorkspaceMembersAsync,
  patchWorkspaceCollectionItemAsync,
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
  getWorkspaceInvitation,
  removeWorkspaceMember,
  listWorkspaces,
  listWorkspacesAsync,
  logHackathonCheckInAsync,
  organizationDashboardAsync,
  promoteIntakeAsync,
  provisionHackathonWorkspaceAsync,
  provisionWorkspace,
  patchHackathonTeamAsync,
  recordDilution,
  registerHackathonAsync,
  acceptHackathonInviteAsync,
  reportHackathonTeamAsync,
  requestWithdrawal,
  signContractAsync,
  submitHackathonBriefAsync,
  submitHackathonFinalAsync,
  updateNotificationPreferencesAsync,
  applyToOpportunityAsync,
  listApplicationsAsync,
  publishProject,
  updateOrganizationProjectAsync,
  updateProject,
  walletList,
  walletAnalyticsAsync,
  walletListAsync,
  walletSummary,
  walletSummaryAsync,
  workspaceContext,
  workspaceContextAsync,
} from '../services/domainService.js'
import { attachHackathonProject, getHackathonProjectEntry } from '../services/workspaceCapabilityService.js'
import { recordGsisRecommendationOutcome } from '../services/aiRouterClient.js'
import { appendWorkspaceTaskEvent, getWorkspaceTask, runWorkspaceTask } from '../services/workspaceTaskService.js'
import { connectorCredentialStatus, removeConnectorCredential, setConnectorCredential } from '../services/connectorCredentialService.js'
import { syncWorkspaceProjectAggregate } from '../repositories/workspaceProjectRepository.js'
import { executionIntelligenceFor } from '../services/executionIntelligenceService.js'

function created(res, body) {
  return res.status(201).json(body)
}

function notFound(res, label = 'Record not found') {
  return res.status(404).json({ error: label })
}

function requireTitle(req, res) {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
  if (!title) {
    res.status(400).json({ error: 'Title is required' })
    return null
  }
  return title
}
async function persistedWorkspace(req, value, projectId = null) { if (!process.env.WORKSPACE_WRITE_SOURCE || process.env.WORKSPACE_WRITE_SOURCE !== 'postgres' || value?.ok === false) return value; try { await syncWorkspaceProjectAggregate(req.user.id, value.workspace?.id || req.params.workspaceId || null, projectId || value.project?.id || null); return value } catch (error) { console.error(JSON.stringify({ event: 'workspace_project_postgres_write_failed', error: error.message })); if (process.env.WORKSPACE_WRITE_FALLBACK_SQLITE !== 'false') return value; return { ok: false, error: 'workspace_project_write_temporarily_unavailable' } } }

export async function founderProjects(req, res) {
  return res.json(await listProjectsAsync(req.user.id))
}

export async function founderProjectCreate(req, res) {
  const title = requireTitle(req, res)
  if (!title) return
  const result = await persistedWorkspace(req, createProject(req.user.id, { ...req.body, title }))
  if (!result.ok) return res.status(404).json(result)
  return created(res, result)
}

export async function founderProjectPatch(req, res) {
  const project = await persistedWorkspace(req, updateProject(req.user.id, req.params.projectId, req.body), req.params.projectId)
  if (!project) return notFound(res, 'Project not found')
  return res.json({ project })
}

export async function endorsements(req, res) {
  return res.json(await listEndorsementsAsync(req.user.id))
}

export async function endorsementCreate(req, res) {
  const result = await createEndorsementAsync(req.user.id, req.body)
  if (!result.ok) {
    const status = ['subject_user_not_found', 'project_not_found'].includes(result.error) ? 404 : 400
    return res.status(status).json(result)
  }
  return created(res, result)
}

export async function workspaces(req, res) {
  return res.json(await listWorkspacesAsync(req.user.id))
}

export async function workspaceProvision(req, res) {
  const result = await persistedWorkspace(req, provisionWorkspace(req.user.id, req.body), null)
  if (!result.ok) return res.status(400).json(result)
  return created(res, result)
}

export async function workspaceContextGet(req, res) {
  const result = await workspaceContextAsync(req.user.id, req.params.workspaceId)
  if (!result) return notFound(res, 'Workspace not found')
  return res.json(result)
}

export async function hackathonProjectEntryCreate(req, res) {
  const result = await attachHackathonProject(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result.ok) return res.status(result.status || 400).json(result)
  return created(res, result)
}

export async function hackathonProjectEntryGet(req, res) {
  const entry = await getHackathonProjectEntry(req.user.id, req.params.hackathonId, req.params.teamId)
  if (!entry) return notFound(res, 'Hackathon project entry not found')
  return res.json({ entry })
}

export async function workspaceInvitationCreate(req, res) {
  const result = await persistedWorkspace(req, createWorkspaceInvitation(req.user.id, req.params.workspaceId, req.body))
  if (!result.ok) {
    const status = ['workspace_not_found', 'collaborator_not_found'].includes(result.error) ? 404 : 400
    return res.status(status).json({ error: result.error })
  }
  return created(res, result)
}

export function workspaceInvitationGet(req, res) {
  const invitation = getWorkspaceInvitation(req.user.id, req.params.invitationId)
  if (!invitation) return notFound(res, 'Invitation not found')
  return res.json({ invitation })
}

export async function workspaceInvitationAccept(req, res) {
  const result = await persistedWorkspace(req, acceptWorkspaceInvitation(req.user.id, req.params.invitationId))
  if (!result.ok) {
    const status = ['invitation_not_found', 'workspace_not_found'].includes(result.error) ? 404 : 400
    return res.status(status).json({ error: result.error })
  }
  return res.json(result)
}

export async function workspaceInvitationDecline(req, res) {
  const result = await persistedWorkspace(req, declineWorkspaceInvitation(req.user.id, req.params.invitationId))
  if (!result.ok) return res.status(404).json({ error: result.error })
  return res.json(result)
}

export async function workspaceMembersGet(req, res) {
  const result = await listWorkspaceMembersAsync(req.user.id, req.params.workspaceId)
  if (!result) return notFound(res, 'Workspace not found')
  return res.json(result)
}

export async function workspaceMemberDelete(req, res) {
  const result = await persistedWorkspace(req, removeWorkspaceMember(req.user.id, req.params.workspaceId, req.params.memberId))
  if (!result.ok) return res.status(404).json({ error: result.error })
  return res.json(result)
}

// Mint a real LiveKit participant token for a workspace audio/video call.
// Membership is authorized against the platform authority (workspaceMembers);
// when LiveKit is not configured we return an explicit unavailable state so the
// client can render an honest message instead of a fake call surface.
export async function workspaceCallToken(req, res) {
  const { workspaceId } = req.params
  const members = await listWorkspaceMembersAsync(req.user.id, workspaceId)
  if (!members) return res.status(403).json({ error: 'workspace_forbidden' })
  if (!livekitEnabled()) return res.json({ available: false, reason: 'live_calls_not_configured', workspaceId })
  try {
    const room = livekitRoomName(workspaceId)
    const token = mintLivekitToken({ room, identity: req.user.id, canPublish: true })
    return res.json({ available: true, token, url: livekitUrl(), room, identity: req.user.id, canPublish: true })
  } catch (error) {
    console.error(JSON.stringify({ event: 'livekit_token_mint_failed', workspaceId, error: error.message }))
    return res.status(503).json({ error: 'live_call_token_unavailable' })
  }
}

export async function workspaceItems(req, res) {
  const rows = await listWorkspaceCollectionAsync(req.user.id, req.params.workspaceId, req.collectionName)
  if (!rows) return notFound(res, 'Workspace not found')
  return res.json({ [req.responseKey]: rows })
}

export async function workspaceItemCreate(req, res) {
  const row = await persistedWorkspace(req, await createWorkspaceCollectionItemAsync(
    req.user.id,
    req.params.workspaceId,
    req.collectionName,
    req.body,
    req.itemPrefix,
  ))
  if (!row) return notFound(res, 'Workspace not found')
  return created(res, { [req.itemKey]: row })
}

// --- Workspace agent tasks: single-task read, event append, and one real run ----
export async function workspaceTaskOne(req, res) {
  const result = await getWorkspaceTask(req.user.id, req.params.workspaceId, req.params.itemId)
  if (!result.ok) return res.status(result.status || 404).json({ error: result.error })
  return res.json({ task: result.task })
}

export async function workspaceTaskEvent(req, res) {
  const result = await appendWorkspaceTaskEvent(req.user.id, req.params.workspaceId, req.params.itemId, req.body)
  if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
  return created(res, { task: result.task, event: result.event })
}

export async function workspaceTaskRun(req, res) {
  const result = await runWorkspaceTask(req.user.id, req.params.workspaceId, req.params.itemId, req.user.token)
  if (!result.ok) return res.status(result.status || 400).json({ error: result.error, task: result.task })
  return res.json({ task: result.task })
}

// --- Connector credential handshake (sealed at rest, masked in responses) ----
export async function connectorCredentialGet(req, res) {
  const result = await connectorCredentialStatus(req.user.id, req.params.workspaceId, req.params.itemId)
  if (!result.ok) return res.status(result.status || 404).json({ error: result.error })
  return res.json(result)
}

export async function connectorCredentialSet(req, res) {
  const result = await setConnectorCredential(req.user.id, req.params.workspaceId, req.params.itemId, req.body)
  if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
  return created(res, result)
}

export async function connectorCredentialRemove(req, res) {
  const result = await removeConnectorCredential(req.user.id, req.params.workspaceId, req.params.itemId)
  if (!result.ok) return res.status(result.status || 404).json({ error: result.error })
  return res.json(result)
}

export async function workspaceItemPatch(req, res) {
  const row = await persistedWorkspace(req, await patchWorkspaceCollectionItemAsync(
    req.user.id,
    req.params.workspaceId,
    req.collectionName,
    req.params.itemId,
    req.body,
  ))
  if (!row) return notFound(res, 'Workspace item not found')
  if (
    req.collectionName === 'workspaceTasks' &&
    row.status === 'completed' &&
    row.gsisRecommendationId
  ) {
    await recordGsisRecommendationOutcome(req.user.token, row.gsisRecommendationId, {
      metric: row.successMetric || row.title || 'task_completion',
      baseline_value: row.baselineValue,
      observed_value: row.observedValue,
      expected_value: row.expectedValue,
      observed_positive: true,
      outcome: 'task_completed',
      source: 'verified_platform_event',
      evidence: { task_id: row.id, workspace_id: req.params.workspaceId },
    })
  }
  return res.json({ [req.itemKey]: row })
}

export function equity(req, res) {
  return res.json(collaboratorEquity(req.user.id))
}

export function equityDilution(req, res) {
  return created(res, recordDilution(req.user.id, req.body))
}

export function earnings(req, res) {
  return res.json(collaboratorEarnings(req.user.id))
}

export function earningsWithdraw(req, res) {
  const result = requestWithdrawal(req.user.id, req.body)
  if (!result.ok) return res.status(400).json(result)
  return created(res, result)
}

export async function contributions(req, res) {
  return res.json(await listContributionsAsync(req.user.id))
}

export async function collaboratorScores(req, res) {
  return res.json(await getCollaboratorScoresAsync(req.user.id))
}

export async function orgDashboard(req, res) {
  return res.json(await organizationDashboardAsync(req.user.id))
}

export async function organizationProjects(req, res) {
  return res.json(await listOrganizationProjectsAsync(req.user.id))
}

export async function organizationProjectCreate(req, res) {
  const title = requireTitle(req, res)
  if (!title) return
  return created(res, await createOrganizationProjectAsync(req.user.id, { ...req.body, title }))
}

export async function organizationProjectPatch(req, res) {
  const project = await updateOrganizationProjectAsync(req.user.id, req.params.projectId, req.body)
  if (!project) return notFound(res, 'Project not found')
  return res.json({ project })
}

export async function orgCohortHealth(req, res) {
  const { stage, riskLevel } = req.query
  return res.json(await organizationCohortHealthAsync(req.user.id, { stage, riskLevel }))
}

export async function orgInterventions(req, res) {
  return res.json(await organizationInterventionsAsync(req.user.id, req.user.token))
}

export async function orgImpact(req, res) {
  return res.json(await organizationImpactAsync(req.user.id, { template: req.query.template }))
}

export async function orgKpiTargets(req, res) {
  return res.json(await organizationKpiTargetsAsync(req.user.id))
}

export async function orgKpiTargetSave(req, res) {
  const result = await saveOrganizationKpiTargetAsync(req.user.id, req.body)
  if (!result.ok) return res.status(400).json(result)
  return res.json(result)
}

export async function orgDemoDayPipeline(req, res) {
  return res.json(await demoDayPipelineAsync(req.user.id, { threshold: req.query.threshold }))
}

export async function orgDemoDayPublish(req, res) {
  const result = await publishOrganizationProjectAsync(req.user.id, req.body)
  if (!result.ok) return res.status(result.error === 'project_not_found' ? 404 : 400).json(result)
  return res.json(result)
}

export async function orgInvestorMatches(req, res) {
  return res.json(await investorMatchesAsync(req.user.id, req.params.projectId))
}

export async function orgDemoDayEvents(req, res) {
  return res.json(await organizationDemoDayEventsAsync(req.user.id))
}

export async function orgDemoDayEventCreate(req, res) {
  const result = await createOrganizationDemoDayEventAsync(req.user.id, req.body)
  if (!result.ok) return res.status(400).json(result)
  return created(res, result)
}

export async function orgDemoDayAnalytics(req, res) {
  return res.json(await organizationDemoDayAnalyticsAsync(req.user.id))
}

export async function dealFlow(req, res) {
  return res.json(await investorDealFlowAsync(req.user.id))
}

export async function watchlist(req, res) {
  return res.json(await listWatchlistAsync(req.user.id))
}

export async function watchlistAdd(req, res) {
  const result = await addWatchlistAsync(req.user.id, req.body)
  if (!result.ok) return res.status(400).json(result)
  return created(res, result)
}

export async function watchlistRemove(req, res) {
  return res.json(await removeWatchlistAsync(req.user.id, String(req.params.projectId || '').trim()))
}

export async function watchlistPreferences(req, res) { return res.json(await listWatchlistPreferencesAsync(req.user.id)) }
export async function watchlistPreferencesPatch(req, res) { return res.json(await updateWatchlistPreferencesAsync(req.user.id, req.body || {})) }

export async function investorList(req, res) {
  return res.json({ [req.responseKey]: await investorCollectionAsync(req.user.id, req.collectionName) })
}

export async function investorCreate(req, res) {
  return created(res, { [req.itemKey]: await createInvestorCollectionAsync(req.user.id, req.collectionName, req.body, req.itemPrefix) })
}

export async function intakes(req, res) {
  return res.json(await listIntakesAsync(req.user.id))
}

export async function intakeCreate(req, res) {
  return created(res, await createIntakeAsync(req.user.id, req.body))
}

export async function intakeGet(req, res) {
  const intake = await getIntakeAsync(req.user.id, req.params.intakeId)
  if (!intake) return notFound(res, 'Intake not found')
  return res.json({ intake })
}

export async function intakePromote(req, res) {
  const result = await promoteIntakeAsync(req.user.id, req.params.intakeId, req.body)
  if (!result) return notFound(res, 'Intake not found')
  return created(res, result)
}

export async function analyses(req, res) {
  return res.json(await listAnalysesAsync(req.user.id))
}

export async function analysisCreate(req, res) {
  return created(res, await createAnalysisAsync(req.user.id, req.body))
}

export async function analysisGet(req, res) {
  const analysis = await getAnalysisAsync(req.user.id, req.params.analysisId)
  if (!analysis) return notFound(res, 'Analysis not found')
  return res.json({ analysis })
}

export async function hackathons(req, res) {
  return res.json(await listHackathonsAsync(req.user.id, { ownedOnly: req.query.scope === 'owned' }))
}

export async function hackathonRegistrations(req, res) {
  return res.json(await listHackathonRegistrationsAsync(req.user.id))
}

export async function hackathonCreate(req, res) {
  const result = await createHackathonAsync(req.user.id, req.body)
  if (result?.ok === false) {
    const status = result.error?.includes('permission') || result.error?.includes('denied') ? 403 : result.error?.includes('required') ? 400 : result.error?.includes('limit') ? 409 : 402
    return res.status(status).json(result)
  }
  return created(res, result)
}

export async function hackathonGet(req, res) {
  const hackathon = await getHackathonAsync(req.user.id, req.params.hackathonId)
  if (!hackathon) return notFound(res, 'Hackathon not found')
  return res.json({ hackathon })
}

export async function hackathonRegister(req, res) {
  const result = await registerHackathonAsync(req.user.id, req.params.hackathonId, req.body)
  if (!result) return notFound(res, 'Hackathon not found')
  return created(res, result)
}

export async function hackathonInviteGet(req, res) {
  const result = await getHackathonInviteAsync(
    req.user.id,
    req.params.hackathonId,
    req.params.teamId,
    String(req.query.token || ''),
  )
  if (!result.ok) {
    const status = result.error === 'invite_token_invalid' ? 403 : 404
    return res.status(status).json(result)
  }
  return res.json(result)
}

export async function hackathonInvitationCreate(req, res) {
  const result = await createHackathonInvitationAsync(
    req.user.id,
    req.params.hackathonId,
    req.params.teamId,
    req.body,
  )
  if (!result.ok) {
    const status = ['team_not_found', 'collaborator_not_found'].includes(result.error) ? 404 : 400
    return res.status(status).json(result)
  }
  return created(res, result)
}

export async function hackathonInviteAccept(req, res) {
  const result = await acceptHackathonInviteAsync(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result.ok) {
    const status = ['invite_not_found'].includes(result.error) ? 404 : 400
    return res.status(status).json(result)
  }
  return created(res, result)
}

export async function hackathonTeamPatch(req, res) {
  const result = await patchHackathonTeamAsync(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return res.json(result)
}

export async function hackathonBrief(req, res) {
  const result = await submitHackathonBriefAsync(req.user.id, req.params.hackathonId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export async function hackathonCheckIn(req, res) {
  const result = await logHackathonCheckInAsync(req.user.id, req.params.hackathonId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export async function hackathonFinal(req, res) {
  const result = await submitHackathonFinalAsync(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export async function hackathonTeamStatus(req, res) {
  const result = await hackathonStatusAsync(req.user.id, req.params.hackathonId, req.params.teamId)
  if (!result) return notFound(res, 'Team not found')
  return res.json(result)
}

export async function hackathonWorkspace(req, res) {
  const result = await provisionHackathonWorkspaceAsync(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export async function hackathonReport(req, res) {
  const result = await reportHackathonTeamAsync(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export async function hackathonOverview(req, res) {
  const result = await hackathonAggregatesAsync(req.user.id, req.params.hackathonId)
  if (!result) return notFound(res, 'Hackathon not found')
  return res.json(result.overview)
}

export async function hackathonVelocity(req, res) {
  const result = await hackathonAggregatesAsync(req.user.id, req.params.hackathonId)
  if (!result) return notFound(res, 'Hackathon not found')
  return res.json({ hackathonId: req.params.hackathonId, teams: result.velocity })
}

export async function hackathonLeaderboard(req, res) {
  const result = await hackathonAggregatesAsync(req.user.id, req.params.hackathonId)
  if (!result) return notFound(res, 'Hackathon not found')
  return res.json({ hackathonId: req.params.hackathonId, leaderboard: result.leaderboard })
}

export async function hackathonPipeline(req, res) {
  const result = await hackathonAggregatesAsync(req.user.id, req.params.hackathonId)
  if (!result) return notFound(res, 'Hackathon not found')
  return res.json({ hackathonId: req.params.hackathonId, buckets: result.pipeline })
}

export async function walletSummaryGet(req, res) {
  return res.json(await walletSummaryAsync(req.user.id))
}

export async function walletAnalyticsGet(req, res) {
  return res.json(await walletAnalyticsAsync(req.user.id, { period: req.query?.period }))
}

export async function walletListGet(req, res) {
  return res.json({ [req.responseKey]: await walletListAsync(req.user.id, req.collectionName) })
}

export async function walletPaymentIntent(req, res) {
  const result = await createPaymentIntentAsync(req.user.id, req.body)
  if (result?.ok === false) return res.status(400).json(result)
  return created(res, result)
}

export async function genericListGet(req, res) {
  return res.json({ [req.responseKey]: await genericListAsync(req.user.id, req.collectionName, req.collectionField || null) })
}

export async function collaborationCallCreate(req, res) {
  const result = await createCollaborationCallAsync(req.user.id, req.body)
  if (!result.ok) return res.status(400).json({ error: result.error })
  return res.status(result.created === false ? 200 : 201).json({ opportunity: result.opportunity })
}

export async function genericCreatePost(req, res) {
  const entity = await genericCreateAsync(req.user.id, req.collectionName, req.body, req.itemPrefix, req.collectionField || null)
  // A new opportunity changes the opportunities surface for matching users.
  // Targeted surface invalidation keeps people/general caches intact.
  if (req.collectionName === 'opportunities') void invalidateDiscoveryType('opportunities')
  return created(res, { [req.itemKey]: entity })
}

export async function genericPatchItem(req, res) {
  const row = await genericPatchAsync(req.user.id, req.collectionName, req.params.itemId || req.params.id, req.body, req.collectionField || null)
  if (!row) return notFound(res, 'Record not found')
  return res.json({ [req.itemKey]: row })
}

export function genericDeleteItem(req, res) {
  const row = genericDelete(req.user.id, req.collectionName, req.params.itemId || req.params.id)
  if (!row) return notFound(res, 'Record not found')
  return res.json({ ok: true, [req.itemKey]: row })
}

// Founder-facing cap table derived from committed workspace equity (see founderCapTable).
export function founderEquity(req, res) {
  return res.json(founderCapTable(req.user.id))
}

export async function notificationPrefsGet(req, res) {
  return res.json(await getNotificationPreferencesAsync(req.user.id))
}

export async function notificationPrefsPatch(req, res) {
  return res.json(await updateNotificationPreferencesAsync(req.user.id, req.body))
}

export async function contracts(req, res) {
  return res.json(await listContractsAsync(req.user.id))
}

export async function contractCreate(req, res) {
  const result = await createContractAsync(req.user.id, req.body)
  if (!result.ok) {
    const status = ['collaborator_not_found'].includes(result.error) ? 404 : 400
    return res.status(status).json(result)
  }
  return created(res, result)
}

export async function contractGet(req, res) {
  const contract = await getContractAsync(req.user.id, req.params.id)
  if (!contract) return notFound(res, 'Contract not found')
  return res.json({ contract })
}

export async function contractSign(req, res) {
  const result = await signContractAsync(req.user.id, req.params.id)
  if (!result) return notFound(res, 'Contract not found')
  if (!result.ok) return res.status(400).json(result)
  return res.json(result)
}

export async function contractCountersign(req, res) {
  const result = await countersignContractAsync(req.user.id, req.params.id)
  if (!result) return notFound(res, 'Contract not found')
  if (!result.ok) return res.status(400).json(result)
  return res.json(result)
}

export async function opportunityApply(req, res) {
  const result = await applyToOpportunityAsync(req.user.id, req.params.id, req.body)
  if (!result.ok) {
    const status = result.error === 'opportunity_not_found' ? 404 : 400
    return res.status(status).json(result)
  }
  return created(res, result)
}

export async function applicationsList(req, res) {
  return res.json(await listApplicationsAsync(req.user.id))
}

export function incubationPublish(req, res) {
  const result = publishProject(req.user.id, req.body)
  if (!result.ok) return res.status(400).json(result)
  return created(res, result)
}

// WS-H: canonical, scope/role-aware execution-intelligence view. Founder
// dashboard, collaborator workspace, investor section, organization dashboard
// and hackathon console read this same projection.
export async function executionIntelligence(req, res) {
  const result = await executionIntelligenceFor(req.user, req.query || {})
  return res.status(result.ok ? 200 : 503).json(result)
}
