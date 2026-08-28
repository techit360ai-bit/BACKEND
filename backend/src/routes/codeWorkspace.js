import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { files, file, save, move, remove, history, snapshot, adapter, runtime, sync, bridge, deployment, githubWebhook } from '../controllers/codeWorkspaceController.js'
const router = Router(); router.post('/github/webhook', githubWebhook); router.use(requireAuth)
router.get('/:workspaceId/files', files); router.get('/:workspaceId/file', file); router.post('/:workspaceId/file', save); router.patch('/:workspaceId/file/move', move); router.delete('/:workspaceId/file', remove); router.get('/:workspaceId/file/history', history)
router.get('/:workspaceId/snapshot', snapshot); router.get('/:workspaceId/adapter', adapter); router.post('/:workspaceId/runtime-sessions', runtime); router.post('/:workspaceId/sync-state', sync); router.post('/:workspaceId/vscode-grants', bridge); router.post('/:workspaceId/deployments', deployment)
export default router
