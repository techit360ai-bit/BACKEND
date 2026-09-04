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
const ws = req => ({ workspaceId: req.params.workspaceId })
router.get('/:workspaceId/files', requireCapability('workspace.file.read', ws), files); router.get('/:workspaceId/file', requireCapability('workspace.file.read', ws), file); router.post('/:workspaceId/file', requireCapability('workspace.file.write', ws), save); router.patch('/:workspaceId/file/move', requireCapability('workspace.file.move', ws), move); router.delete('/:workspaceId/file', requireCapability('workspace.file.delete', ws), remove); router.get('/:workspaceId/file/history', requireCapability('workspace.file.history', ws), history)
router.get('/:workspaceId/snapshot', requireCapability('workspace.snapshot.view', ws), snapshot); router.get('/:workspaceId/adapter', requireCapability('workspace.adapter.view', ws), adapter); router.get('/:workspaceId/destinations', requireCapability('workspace.destinations.view', ws), destinations); router.post('/:workspaceId/runtime-sessions', requireCapability('workspace.advanced_ai', ws, { consume: true }), runtime); router.post('/:workspaceId/sync-state', requireCapability('workspace.sync', ws), sync); router.post('/:workspaceId/vscode-grants', requireCapability('workspace.copilot', ws), bridge); router.delete('/:workspaceId/vscode-sessions', requireCapability('workspace.vscode.revoke', ws), bridgeRevoke)
router.post('/:workspaceId/execution-runs', requireCapability('workspace.advanced_ai', ws, { consume: true }), executionCreate); router.get('/:workspaceId/execution-runs/:runId', requireCapability('workspace.file.read', ws), executionGet); router.post('/:workspaceId/execution-runs/:runId/stages', requireCapability('workspace.advanced_ai', ws, { consume: true }), executionStage); router.post('/:workspaceId/execution-runs/:runId/reviews', requireCapability('workspace.copilot', ws), executionReview); router.post('/:workspaceId/execution-runs/:runId/finalize', requireCapability('workspace.execution.finalize', ws), executionFinalize); router.post('/:workspaceId/execution-runs/:runId/apply', requireCapability('workspace.advanced_ai', ws, { consume: true }), executionApply)
router.post('/:workspaceId/deployments', requireCapability('workspace.advanced_ai', ws, { consume: true }), deployment); router.post('/:workspaceId/deployments/:deploymentId/verify', requireCapability('workspace.deployment.verify', ws), deploymentVerification)
export default router
