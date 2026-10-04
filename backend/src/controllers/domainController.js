import {
  livekitEnabled,
  livekitRoomName,
  livekitUrl,
  mintLivekitToken,
} from '../services/livekitService.js'
import { invalidateDiscoveryType } from '../services/discoveryInfrastructure.js'
import {
  addWatchlist,
  removeWatchlist,
  listWatchlistPreferences,
  updateWatchlistPreferences,
  collaboratorEarnings,
  collaboratorEquity,
  countersignContract,
  createCollaborationCall,
  createAnalysis,
  createContract,
  createHackathon,
  createHackathonInvitation,
  createEndorsement,
  createIntake,
  createInvestorCollection,
  createOrganizationProject,
  createPaymentIntent,
  createPaymentIntentAsync,
  createProject,
  createWorkspaceCollectionItem,
  createWorkspaceInvitation,
  founderCapTable,
  genericCreate,
  genericList,
  genericDelete,
  genericPatch,
  getAnalysis,
  getCollaboratorScores,
  getContract,
  getHackathon,
  getHackathonInvite,
  getIntake,
  getNotificationPreferences,
  hackathonAggregates,
  hackathonStatus,
  investorCollection,
  investorDealFlow,
  listAnalyses,
  listContracts,
  listContributions,
  listEndorsements,
  listHackathons,
  listHackathonRegistrations,
  listIntakes,
  listOrganizationProjects,
  organizationCohortHealth,
  organizationInterventions,
  organizationImpact,
  organizationKpiTargets,
  saveOrganizationKpiTarget,
  demoDayPipeline,
  publishOrganizationProject,
  investorMatches,
  organizationDemoDayEvents,
  createOrganizationDemoDayEvent,
  organizationDemoDayAnalytics,
  listProjects,
  listProjectsAsync,
  listWatchlist,
  listWorkspaceCollection,
  listWorkspaceMembers,
  listWorkspaceMembersAsync,
  patchWorkspaceCollectionItem,
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
  getWorkspaceInvitation,
  removeWorkspaceMember,
  listWorkspaces,
  listWorkspacesAsync,
  logHackathonCheckIn,
  organizationDashboard,
  promoteIntake,
  provisionHackathonWorkspace,
  provisionWorkspace,
  patchHackathonTeam,
  recordDilution,
  registerHackathon,
  acceptHackathonInvite,
  reportHackathonTeam,
  requestWithdrawal,
  signContract,
  submitHackathonBrief,
  submitHackathonFinal,
  updateNotificationPreferences,
  applyToOpportunity,
  listApplications,
  publishProject,
  updateOrganizationProject,
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

export function endorsements(req, res) {
  return res.json(listEndorsements(req.user.id))
}

export function endorsementCreate(req, res) {
  const result = createEndorsement(req.user.id, req.body)
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

export function hackathonProjectEntryCreate(req, res) {
  const result = attachHackathonProject(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result.ok) return res.status(result.status || 400).json(result)
  return created(res, result)
}

export function hackathonProjectEntryGet(req, res) {
  const entry = getHackathonProjectEntry(req.user.id, req.params.hackathonId, req.params.teamId)
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

export function workspaceItems(req, res) {
  const rows = listWorkspaceCollection(req.user.id, req.params.workspaceId, req.collectionName)
  if (!rows) return notFound(res, 'Workspace not found')
  return res.json({ [req.responseKey]: rows })
}

export async function workspaceItemCreate(req, res) {
  const row = await persistedWorkspace(req, createWorkspaceCollectionItem(
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
export function workspaceTaskOne(req, res) {
  const result = getWorkspaceTask(req.user.id, req.params.workspaceId, req.params.itemId)
  if (!result.ok) return res.status(result.status || 404).json({ error: result.error })
  return res.json({ task: result.task })
}

export function workspaceTaskEvent(req, res) {
  const result = appendWorkspaceTaskEvent(req.user.id, req.params.workspaceId, req.params.itemId, req.body)
  if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
  return created(res, { task: result.task, event: result.event })
}

export async function workspaceTaskRun(req, res) {
  const result = await runWorkspaceTask(req.user.id, req.params.workspaceId, req.params.itemId, req.user.token)
  if (!result.ok) return res.status(result.status || 400).json({ error: result.error, task: result.task })
  return res.json({ task: result.task })
}

// --- Connector credential handshake (sealed at rest, masked in responses) ----
export function connectorCredentialGet(req, res) {
  const result = connectorCredentialStatus(req.user.id, req.params.workspaceId, req.params.itemId)
  if (!result.ok) return res.status(result.status || 404).json({ error: result.error })
  return res.json(result)
}

export function connectorCredentialSet(req, res) {
  const result = setConnectorCredential(req.user.id, req.params.workspaceId, req.params.itemId, req.body)
  if (!result.ok) return res.status(result.status || 400).json({ error: result.error })
  return created(res, result)
}

export function connectorCredentialRemove(req, res) {
  const result = removeConnectorCredential(req.user.id, req.params.workspaceId, req.params.itemId)
  if (!result.ok) return res.status(result.status || 404).json({ error: result.error })
  return res.json(result)
}

export async function workspaceItemPatch(req, res) {
  const row = await persistedWorkspace(req, patchWorkspaceCollectionItem(
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

export function contributions(req, res) {
  return res.json(listContributions(req.user.id))
}

export function collaboratorScores(req, res) {
  return res.json(getCollaboratorScores(req.user.id))
}

export function orgDashboard(req, res) {
  return res.json(organizationDashboard(req.user.id))
}

export function organizationProjects(req, res) {
  return res.json(listOrganizationProjects(req.user.id))
}

export function organizationProjectCreate(req, res) {
  const title = requireTitle(req, res)
  if (!title) return
  return created(res, createOrganizationProject(req.user.id, { ...req.body, title }))
}

export function organizationProjectPatch(req, res) {
  const project = updateOrganizationProject(req.user.id, req.params.projectId, req.body)
  if (!project) return notFound(res, 'Project not found')
  return res.json({ project })
}

export function orgCohortHealth(req, res) {
  const { stage, riskLevel } = req.query
  return res.json(organizationCohortHealth(req.user.id, { stage, riskLevel }))
}

export async function orgInterventions(req, res) {
  return res.json(await organizationInterventions(req.user.id, req.user.token))
}

export function orgImpact(req, res) {
  return res.json(organizationImpact(req.user.id, { template: req.query.template }))
}

export function orgKpiTargets(req, res) {
  return res.json(organizationKpiTargets(req.user.id))
}

export function orgKpiTargetSave(req, res) {
  const result = saveOrganizationKpiTarget(req.user.id, req.body)
  if (!result.ok) return res.status(400).json(result)
  return res.json(result)
}

export function orgDemoDayPipeline(req, res) {
  return res.json(demoDayPipeline(req.user.id, { threshold: req.query.threshold }))
}

export function orgDemoDayPublish(req, res) {
  const result = publishOrganizationProject(req.user.id, req.body)
  if (!result.ok) return res.status(result.error === 'project_not_found' ? 404 : 400).json(result)
  return res.json(result)
}

export function orgInvestorMatches(req, res) {
  return res.json(investorMatches(req.user.id, req.params.projectId))
}

export function orgDemoDayEvents(req, res) {
  return res.json(organizationDemoDayEvents(req.user.id))
}

export function orgDemoDayEventCreate(req, res) {
  const result = createOrganizationDemoDayEvent(req.user.id, req.body)
  if (!result.ok) return res.status(400).json(result)
  return created(res, result)
}

export function orgDemoDayAnalytics(req, res) {
  return res.json(organizationDemoDayAnalytics(req.user.id))
}

export function dealFlow(req, res) {
  return res.json(investorDealFlow(req.user.id))
}

export function watchlist(req, res) {
  return res.json(listWatchlist(req.user.id))
}

export function watchlistAdd(req, res) {
  const result = addWatchlist(req.user.id, req.body)
  if (!result.ok) return res.status(400).json(result)
  return created(res, result)
}

export function watchlistRemove(req, res) {
  return res.json(removeWatchlist(req.user.id, String(req.params.projectId || '').trim()))
}

export function watchlistPreferences(req, res) { return res.json(listWatchlistPreferences(req.user.id)) }
export function watchlistPreferencesPatch(req, res) { return res.json(updateWatchlistPreferences(req.user.id, req.body || {})) }

export function investorList(req, res) {
  return res.json({ [req.responseKey]: investorCollection(req.user.id, req.collectionName) })
}

export function investorCreate(req, res) {
  return created(res, { [req.itemKey]: createInvestorCollection(req.user.id, req.collectionName, req.body, req.itemPrefix) })
}

export function intakes(req, res) {
  return res.json(listIntakes(req.user.id))
}

export function intakeCreate(req, res) {
  return created(res, createIntake(req.user.id, req.body))
}

export function intakeGet(req, res) {
  const intake = getIntake(req.user.id, req.params.intakeId)
  if (!intake) return notFound(res, 'Intake not found')
  return res.json({ intake })
}

export function intakePromote(req, res) {
  const result = promoteIntake(req.user.id, req.params.intakeId, req.body)
  if (!result) return notFound(res, 'Intake not found')
  return created(res, result)
}

export function analyses(req, res) {
  return res.json(listAnalyses(req.user.id))
}

export function analysisCreate(req, res) {
  return created(res, createAnalysis(req.user.id, req.body))
}

export function analysisGet(req, res) {
  const analysis = getAnalysis(req.user.id, req.params.analysisId)
  if (!analysis) return notFound(res, 'Analysis not found')
  return res.json({ analysis })
}

export function hackathons(req, res) {
  return res.json(listHackathons(req.user.id, { ownedOnly: req.query.scope === 'owned' }))
}

export function hackathonRegistrations(req, res) {
  return res.json(listHackathonRegistrations(req.user.id))
}

export function hackathonCreate(req, res) {
  const result = createHackathon(req.user.id, req.body)
  if (result?.ok === false) {
    const status = result.error?.includes('permission') || result.error?.includes('denied') ? 403 : result.error?.includes('required') ? 400 : result.error?.includes('limit') ? 409 : 402
    return res.status(status).json(result)
  }
  return created(res, result)
}

export function hackathonGet(req, res) {
  const hackathon = getHackathon(req.user.id, req.params.hackathonId)
  if (!hackathon) return notFound(res, 'Hackathon not found')
  return res.json({ hackathon })
}

export function hackathonRegister(req, res) {
  const result = registerHackathon(req.user.id, req.params.hackathonId, req.body)
  if (!result) return notFound(res, 'Hackathon not found')
  return created(res, result)
}

export function hackathonInviteGet(req, res) {
  const result = getHackathonInvite(
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

export function hackathonInvitationCreate(req, res) {
  const result = createHackathonInvitation(
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

export function hackathonInviteAccept(req, res) {
  const result = acceptHackathonInvite(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result.ok) {
    const status = ['invite_not_found'].includes(result.error) ? 404 : 400
    return res.status(status).json(result)
  }
  return created(res, result)
}

export function hackathonTeamPatch(req, res) {
  const result = patchHackathonTeam(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return res.json(result)
}

export function hackathonBrief(req, res) {
  const result = submitHackathonBrief(req.user.id, req.params.hackathonId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export function hackathonCheckIn(req, res) {
  const result = logHackathonCheckIn(req.user.id, req.params.hackathonId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export function hackathonFinal(req, res) {
  const result = submitHackathonFinal(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export function hackathonTeamStatus(req, res) {
  const result = hackathonStatus(req.user.id, req.params.hackathonId, req.params.teamId)
  if (!result) return notFound(res, 'Team not found')
  return res.json(result)
}

export function hackathonWorkspace(req, res) {
  const result = provisionHackathonWorkspace(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export function hackathonReport(req, res) {
  const result = reportHackathonTeam(req.user.id, req.params.hackathonId, req.params.teamId, req.body)
  if (!result) return notFound(res, 'Team not found')
  return created(res, result)
}

export function hackathonOverview(req, res) {
  const result = hackathonAggregates(req.user.id, req.params.hackathonId)
  if (!result) return notFound(res, 'Hackathon not found')
  return res.json(result.overview)
}

export function hackathonVelocity(req, res) {
  const result = hackathonAggregates(req.user.id, req.params.hackathonId)
  if (!result) return notFound(res, 'Hackathon not found')
  return res.json({ hackathonId: req.params.hackathonId, teams: result.velocity })
}

export function hackathonLeaderboard(req, res) {
  const result = hackathonAggregates(req.user.id, req.params.hackathonId)
  if (!result) return notFound(res, 'Hackathon not found')
  return res.json({ hackathonId: req.params.hackathonId, leaderboard: result.leaderboard })
}

export function hackathonPipeline(req, res) {
  const result = hackathonAggregates(req.user.id, req.params.hackathonId)
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

export function genericListGet(req, res) {
  return res.json({ [req.responseKey]: genericList(req.user.id, req.collectionName) })
}

export function collaborationCallCreate(req, res) {
  const result = createCollaborationCall(req.user.id, req.body)
  if (!result.ok) return res.status(400).json({ error: result.error })
  return res.status(result.created === false ? 200 : 201).json({ opportunity: result.opportunity })
}

export function genericCreatePost(req, res) {
  const entity = genericCreate(req.user.id, req.collectionName, req.body, req.itemPrefix)
  // A new opportunity changes the opportunities surface for matching users.
  // Targeted surface invalidation keeps people/general caches intact.
  if (req.collectionName === 'opportunities') void invalidateDiscoveryType('opportunities')
  return created(res, { [req.itemKey]: entity })
}

export function genericPatchItem(req, res) {
  const row = genericPatch(req.user.id, req.collectionName, req.params.itemId || req.params.id, req.body)
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

export function notificationPrefsGet(req, res) {
  return res.json(getNotificationPreferences(req.user.id))
}

export function notificationPrefsPatch(req, res) {
  return res.json(updateNotificationPreferences(req.user.id, req.body))
}

export function contracts(req, res) {
  return res.json(listContracts(req.user.id))
}

export function contractCreate(req, res) {
  const result = createContract(req.user.id, req.body)
  if (!result.ok) {
    const status = ['collaborator_not_found'].includes(result.error) ? 404 : 400
    return res.status(status).json(result)
  }
  return created(res, result)
}

export function contractGet(req, res) {
  const contract = getContract(req.user.id, req.params.id)
  if (!contract) return notFound(res, 'Contract not found')
  return res.json({ contract })
}

export function contractSign(req, res) {
  const result = signContract(req.user.id, req.params.id)
  if (!result) return notFound(res, 'Contract not found')
  if (!result.ok) return res.status(400).json(result)
  return res.json(result)
}

export function contractCountersign(req, res) {
  const result = countersignContract(req.user.id, req.params.id)
  if (!result) return notFound(res, 'Contract not found')
  if (!result.ok) return res.status(400).json(result)
  return res.json(result)
}

export function opportunityApply(req, res) {
  const result = applyToOpportunity(req.user.id, req.params.id, req.body)
  if (!result.ok) {
    const status = result.error === 'opportunity_not_found' ? 404 : 400
    return res.status(status).json(result)
  }
  return created(res, result)
}

export function applicationsList(req, res) {
  return res.json(listApplications(req.user.id))
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
