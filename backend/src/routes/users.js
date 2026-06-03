import { Router } from 'express'
import { getMe, updateMe } from '../controllers/userController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/me', requireAuth, getMe)
router.patch('/me', requireAuth, updateMe)

export default router
