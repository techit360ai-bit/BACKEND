import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { requireCapability } from '../services/capabilityAuthorization.js'
import { files, file, save, move, remove, history, snapshot, adapter, runtime, sync, bridge, deployment, githubWebhook, destinations, deploymentVerification, executionCreate, executionGet, executionStage, executionReview, executionFinalize, executionApply, bridgeExchange, bridgeSnapshot, bridgeSync, bridgeRevoke } from '../controllers/codeWorkspaceController.js'
const router = Router()
router.post('/github/webhook', githubWebhook)
router.post('/bridge/exchange', bridgeExchange)
router.get('/bridge/:workspaceId/snapshot', bridgeSnapshot)
router.post('/bridge/:workspaceId/sync', bridgeSync)
router.use(requireAuth)
router.get('/:workspaceId/files', files); router.get('/:workspaceId/file', file); router.post('/:workspaceId/file', save); router.patch('/:workspaceId/file/move', move); router.delete('/:workspaceId/file', remove); router.get('/:workspaceId/file/history', history)
router.get('/:workspaceId/snapshot', snapshot); router.get('/:workspaceId/adapter', adapter); router.get('/:workspaceId/destinations', destinations); router.post('/:workspaceId/runtime-sessions', requireCapability('workspace.advanced_ai', req => ({ workspaceId: req.params.workspaceId }), { consume: true }), runtime); router.post('/:workspaceId/sync-state', sync); router.post('/:workspaceId/vscode-grants', requireCapability('workspace.copilot', req => ({ workspaceId: req.params.workspaceId })), bridge); router.delete('/:workspaceId/vscode-sessions', bridgeRevoke)
router.post('/:workspaceId/execution-runs', requireCapability('workspace.advanced_ai', req => ({ workspaceId: req.params.workspaceId }), { consume: true }), executionCreate); router.get('/:workspaceId/execution-runs/:runId', executionGet); router.post('/:workspaceId/execution-runs/:runId/stages', requireCapability('workspace.advanced_ai', req => ({ workspaceId: req.params.workspaceId }), { consume: true }), executionStage); router.post('/:workspaceId/execution-runs/:runId/reviews', requireCapability('workspace.copilot', req => ({ workspaceId: req.params.workspaceId })), executionReview); router.post('/:workspaceId/execution-runs/:runId/finalize', executionFinalize); router.post('/:workspaceId/execution-runs/:runId/apply', requireCapability('workspace.advanced_ai', req => ({ workspaceId: req.params.workspaceId }), { consume: true }), executionApply)
router.post('/:workspaceId/deployments', requireCapability('workspace.advanced_ai', req => ({ workspaceId: req.params.workspaceId }), { consume: true }), deployment); router.post('/:workspaceId/deployments/:deploymentId/verify', deploymentVerification)
export default router
