import { listProjectFiles, readProjectFile, saveProjectFile, moveProjectFile, deleteProjectFile, projectFileHistory, codeWorkspaceSnapshot, detectProjectAdapter, recordRuntimeSession, saveSyncState, createBridgeGrant, recordDeployment, listCodeDestinations, verifyCodeDeployment } from '../services/codeWorkspaceService.js'
import { reconcileGithubPush } from '../services/codeExecutionProjectionService.js'
import { applyCodeExecutionRun, createCodeExecutionRun, finalizeCodeExecutionRun, getCodeExecutionRun, recordCodeExecutionStage, recordCodeReviewDecision } from '../services/codeExecutionRunService.js'
import { bridgeTokenFromRequest, codeBridgeSnapshot, exchangeCodeBridgeGrant, revokeCodeBridgeSessions, syncCodeBridgeFiles } from '../services/codeBridgeService.js'
import { syncWorkspaceCode, workspaceCodeEnabled, workspaceCodeFallbackEnabled } from '../repositories/workspaceCodeRepository.js'
import { chooseBuildPath, createCostEstimate, setLifecycleView, createPreviewContext, getBuildContext, listModelConnections, createModelConnection, revokeModelConnection, listWorkspaceModels, bindWorkspaceModel, unbindWorkspaceModel } from '../services/workspaceCapabilityService.js'
import { orchestrateCodeTask, planCodeTask, proposeCodeChanges } from '../services/codeIntelligenceService.js'
const send = (res, value, created = false) => res.status(value?.status || (value?.ok === false ? 400 : created ? 201 : 200)).json(value)
async function persisted(req, value) { if (!workspaceCodeEnabled() || value?.ok === false) return value; try { await syncWorkspaceCode(req.params.workspaceId, req.user?.id); return value } catch (error) { console.error(JSON.stringify({ event: 'workspace_code_postgres_write_failed', workspaceId: req.params.workspaceId, error: error.message })); if (workspaceCodeFallbackEnabled()) return value; return { ok: false, status: 503, error: 'workspace_code_write_temporarily_unavailable' } } }
export const files = async (req, res) => send(res, await listProjectFiles(req.user.id, req.params.workspaceId, req.query.includeDeleted === 'true'))
export const file = async (req, res) => send(res, await readProjectFile(req.user.id, req.params.workspaceId, req.query.path))
export const save = async (req, res) => send(res, await persisted(req, await saveProjectFile(req.user.id, req.params.workspaceId, req.body)), true)
export const move = async (req, res) => send(res, await persisted(req, await moveProjectFile(req.user.id, req.params.workspaceId, req.query.path, req.body)))
export const remove = async (req, res) => send(res, await persisted(req, await deleteProjectFile(req.user.id, req.params.workspaceId, req.query.path, req.body?.expectedVersion)))
export const history = async (req, res) => send(res, await projectFileHistory(req.user.id, req.params.workspaceId, req.query.path))
export const snapshot = async (req, res) => send(res, await codeWorkspaceSnapshot(req.user.id, req.params.workspaceId))
export const adapter = async (req, res) => send(res, await detectProjectAdapter(req.user.id, req.params.workspaceId))
export const runtime = async (req, res) => send(res, await persisted(req, await recordRuntimeSession(req.user.id, req.params.workspaceId, req.body)), true)
export const sync = async (req, res) => send(res, await persisted(req, await saveSyncState(req.user.id, req.params.workspaceId, req.body)), true)
export const bridge = async (req, res) => send(res, await persisted(req, await createBridgeGrant(req.user.id, req.params.workspaceId, req.body)), true)
export const deployment = async (req, res) => send(res, await persisted(req, await recordDeployment(req.user.id, req.params.workspaceId, req.body)), true)
export const destinations = async (req, res) => send(res, await listCodeDestinations(req.user.id, req.params.workspaceId))
export const deploymentVerification = async (req, res) => send(res, await persisted(req, await verifyCodeDeployment(req.user.id, req.params.workspaceId, req.params.deploymentId, req.body)), true)
export const executionCreate = async (req, res) => send(res, await persisted(req, createCodeExecutionRun(req.user.id, req.params.workspaceId, req.body)), true)
export const executionGet = (req, res) => send(res, getCodeExecutionRun(req.user.id, req.params.workspaceId, req.params.runId))
export const executionStage = async (req, res) => send(res, await persisted(req, recordCodeExecutionStage(req.user.id, req.params.workspaceId, req.params.runId, req.body)), true)
export const executionReview = async (req, res) => send(res, await persisted(req, recordCodeReviewDecision(req.user.id, req.params.workspaceId, req.params.runId, req.body)), true)
export const executionFinalize = async (req, res) => send(res, await persisted(req, finalizeCodeExecutionRun(req.user.id, req.params.workspaceId, req.params.runId)))
export const executionApply = async (req, res) => send(res, await persisted(req, applyCodeExecutionRun(req.user.id, req.params.workspaceId, req.params.runId, req.body)))
export const bridgeExchange = (req, res) => send(res, exchangeCodeBridgeGrant(req.body), true)
export const bridgeSnapshot = (req, res) => send(res, codeBridgeSnapshot(bridgeTokenFromRequest(req), req.params.workspaceId))
export const bridgeSync = (req, res) => send(res, syncCodeBridgeFiles(bridgeTokenFromRequest(req), req.params.workspaceId, req.body))
export const bridgeRevoke = (req, res) => send(res, revokeCodeBridgeSessions(req.user.id, req.params.workspaceId))
export const githubWebhook = (req, res) => send(res, reconcileGithubPush(req.headers, req.body, req.rawBody))
export const buildContext = async (req, res) => send(res, await getBuildContext(req.user.id, req.params.workspaceId) || { ok: false, status: 404, error: 'workspace_not_found' })
export const buildPath = async (req, res) => send(res, await persisted(req, await chooseBuildPath(req.user.id, req.params.workspaceId, req.body)), true)
export const costEstimate = async (req, res) => send(res, await createCostEstimate(req.user.id, req.params.workspaceId, req.body))
export const lifecycleView = async (req, res) => send(res, await persisted(req, await setLifecycleView(req.user.id, req.params.workspaceId, req.body?.view)))
export const previewContext = async (req, res) => send(res, await persisted(req, await createPreviewContext(req.user.id, req.params.workspaceId, req.body)), true)
export const modelConnections = async (req, res) => send(res, { connections: await listModelConnections(req.user.id) })
export const modelConnectionCreate = async (req, res) => send(res, await createModelConnection(req.user.id, req.body), true)
export const modelConnectionRevoke = async (req, res) => send(res, await revokeModelConnection(req.user.id, req.params.connectionId))
export const workspaceModels = async (req, res) => { const models = await listWorkspaceModels(req.user.id, req.params.workspaceId); return send(res, models === null ? { ok: false, status: 404, error: 'workspace_not_found' } : { bindings: models }) }
export const workspaceModelBind = async (req, res) => send(res, await bindWorkspaceModel(req.user.id, req.params.workspaceId, req.body), true)
export const workspaceModelUnbind = async (req, res) => send(res, await unbindWorkspaceModel(req.user.id, req.params.workspaceId, req.params.bindingId))

// Coding-area intelligence. `plan`/`orchestrate` are deterministic and derived from stored
// project state; `propose` requires the AI router and fails explicitly without it.
export const codePlan = async (req, res) => send(res, await planCodeTask(req.user.id, req.params.workspaceId, req.body, req.user.token))
export const codePropose = async (req, res) => send(res, await proposeCodeChanges(req.user.id, req.params.workspaceId, req.body, req.user.token))
export const codeOrchestrate = async (req, res) => send(res, await orchestrateCodeTask(req.user.id, req.params.workspaceId, req.body))
