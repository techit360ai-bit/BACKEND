import { Router } from 'express'
import { connectUser, getMe, getUserProfile, updateMe } from '../controllers/userController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/me', requireAuth, getMe)
router.patch('/me', requireAuth, updateMe)
router.get('/:id', requireAuth, getUserProfile)
router.post('/:id/connect', requireAuth, connectUser)

export default router
