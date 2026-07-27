import { Router } from 'express'
import { sessionContext, postCheckpoint, deleteCheckpoint } from '../controllers/contextController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/session', requireAuth, sessionContext)
router.post('/checkpoint', requireAuth, postCheckpoint)
router.delete('/checkpoint/:type/:referenceId', requireAuth, deleteCheckpoint)

export default router
