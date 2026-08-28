import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { files, file, save, move, remove, history, snapshot, adapter, runtime, sync, bridge, deployment, githubWebhook, destinations, deploymentVerification, executionCreate, executionGet, executionStage, executionReview, executionFinalize, executionApply, bridgeExchange, bridgeSnapshot, bridgeSync, bridgeRevoke } from '../controllers/codeWorkspaceController.js'
const router = Router()
router.post('/github/webhook', githubWebhook)
router.post('/bridge/exchange', bridgeExchange)
router.get('/bridge/:workspaceId/snapshot', bridgeSnapshot)
router.post('/bridge/:workspaceId/sync', bridgeSync)
router.use(requireAuth)
router.get('/:workspaceId/files', files); router.get('/:workspaceId/file', file); router.post('/:workspaceId/file', save); router.patch('/:workspaceId/file/move', move); router.delete('/:workspaceId/file', remove); router.get('/:workspaceId/file/history', history)
router.get('/:workspaceId/snapshot', snapshot); router.get('/:workspaceId/adapter', adapter); router.get('/:workspaceId/destinations', destinations); router.post('/:workspaceId/runtime-sessions', runtime); router.post('/:workspaceId/sync-state', sync); router.post('/:workspaceId/vscode-grants', bridge); router.delete('/:workspaceId/vscode-sessions', bridgeRevoke)
router.post('/:workspaceId/execution-runs', executionCreate); router.get('/:workspaceId/execution-runs/:runId', executionGet); router.post('/:workspaceId/execution-runs/:runId/stages', executionStage); router.post('/:workspaceId/execution-runs/:runId/reviews', executionReview); router.post('/:workspaceId/execution-runs/:runId/finalize', executionFinalize); router.post('/:workspaceId/execution-runs/:runId/apply', executionApply)
router.post('/:workspaceId/deployments', deployment); router.post('/:workspaceId/deployments/:deploymentId/verify', deploymentVerification)
export default router
