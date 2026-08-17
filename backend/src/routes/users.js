import { Router } from 'express'
import { connectUser, getMe, getUserProfile, listUsers, updateMe } from '../controllers/userController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/me', requireAuth, getMe)
router.patch('/me', requireAuth, updateMe)
router.get('/', requireAuth, listUsers)
router.get('/:id', requireAuth, getUserProfile)
router.post('/:id/connect', requireAuth, connectUser)

export default router
