import { Router } from 'express'
import { sessionContext, postCheckpoint, deleteCheckpoint, activeContext, availableContext, switchContext, touchActiveContext } from '../controllers/contextController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/session', requireAuth, sessionContext)
router.get('/active', requireAuth, activeContext)
router.get('/available', requireAuth, availableContext)
router.post('/switch', requireAuth, switchContext)
router.post('/touch', requireAuth, touchActiveContext)
router.post('/checkpoint', requireAuth, postCheckpoint)
router.delete('/checkpoint/:type/:referenceId', requireAuth, deleteCheckpoint)

export default router
