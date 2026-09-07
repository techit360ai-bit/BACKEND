import { listProjectFiles, readProjectFile, saveProjectFile, moveProjectFile, deleteProjectFile, projectFileHistory, codeWorkspaceSnapshot, detectProjectAdapter, recordRuntimeSession, saveSyncState, createBridgeGrant, recordDeployment, listCodeDestinations, verifyCodeDeployment } from '../services/codeWorkspaceService.js'
import { reconcileGithubPush } from '../services/codeExecutionProjectionService.js'
import { applyCodeExecutionRun, createCodeExecutionRun, finalizeCodeExecutionRun, getCodeExecutionRun, recordCodeExecutionStage, recordCodeReviewDecision } from '../services/codeExecutionRunService.js'
import { bridgeTokenFromRequest, codeBridgeSnapshot, exchangeCodeBridgeGrant, revokeCodeBridgeSessions, syncCodeBridgeFiles } from '../services/codeBridgeService.js'
import { syncWorkspaceCode, workspaceCodeEnabled, workspaceCodeFallbackEnabled } from '../repositories/workspaceCodeRepository.js'
const send = (res, value, created = false) => res.status(value?.status || (value?.ok === false ? 400 : created ? 201 : 200)).json(value)
async function persisted(req, value) { if (!workspaceCodeEnabled() || value?.ok === false) return value; try { await syncWorkspaceCode(req.params.workspaceId, req.user?.id); return value } catch (error) { console.error(JSON.stringify({ event: 'workspace_code_postgres_write_failed', workspaceId: req.params.workspaceId, error: error.message })); if (workspaceCodeFallbackEnabled()) return value; return { ok: false, status: 503, error: 'workspace_code_write_temporarily_unavailable' } } }
export const files = (req, res) => send(res, listProjectFiles(req.user.id, req.params.workspaceId, req.query.includeDeleted === 'true'))
export const file = (req, res) => send(res, readProjectFile(req.user.id, req.params.workspaceId, req.query.path))
export const save = async (req, res) => send(res, await persisted(req, saveProjectFile(req.user.id, req.params.workspaceId, req.body)), true)
export const move = async (req, res) => send(res, await persisted(req, moveProjectFile(req.user.id, req.params.workspaceId, req.query.path, req.body)))
export const remove = async (req, res) => send(res, await persisted(req, deleteProjectFile(req.user.id, req.params.workspaceId, req.query.path, req.body?.expectedVersion)))
export const history = (req, res) => send(res, projectFileHistory(req.user.id, req.params.workspaceId, req.query.path))
export const snapshot = (req, res) => send(res, codeWorkspaceSnapshot(req.user.id, req.params.workspaceId))
export const adapter = (req, res) => send(res, detectProjectAdapter(req.user.id, req.params.workspaceId))
export const runtime = async (req, res) => send(res, await persisted(req, recordRuntimeSession(req.user.id, req.params.workspaceId, req.body)), true)
export const sync = async (req, res) => send(res, await persisted(req, saveSyncState(req.user.id, req.params.workspaceId, req.body)), true)
export const bridge = async (req, res) => send(res, await persisted(req, createBridgeGrant(req.user.id, req.params.workspaceId, req.body)), true)
export const deployment = async (req, res) => send(res, await persisted(req, recordDeployment(req.user.id, req.params.workspaceId, req.body)), true)
export const destinations = (req, res) => send(res, listCodeDestinations(req.user.id, req.params.workspaceId))
export const deploymentVerification = async (req, res) => send(res, await persisted(req, verifyCodeDeployment(req.user.id, req.params.workspaceId, req.params.deploymentId, req.body)), true)
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
