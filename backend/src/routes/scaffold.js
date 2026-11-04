import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { generate, getByProject, deploy, status, liveUrl, stacks } from '../controllers/scaffoldController.js'

const router = Router()
router.use(requireAuth)
router.post('/generate', generate)
router.get('/stacks', stacks)
router.get('/:projectId', getByProject)
router.post('/:scaffoldId/deploy', deploy)
router.get('/:scaffoldId/status', status)
router.get('/:scaffoldId/live-url', liveUrl)

export default router
