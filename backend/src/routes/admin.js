import { Router } from 'express'
import { adminLogin, adminMe, adminList, adminCreate, adminUpdate, adminDelete } from '../controllers/adminAuthController.js'
import { requireAuth } from '../middlewares/auth.js'
import { requireAdmin, requireSuperAdmin } from '../utils/roleGuards.js'

const router = Router()

router.post('/login', adminLogin)
router.get('/me', requireAuth, requireAdmin, adminMe)
router.get('/users', requireAuth, requireSuperAdmin, adminList)
router.post('/users', requireAuth, requireSuperAdmin, adminCreate)
router.patch('/users/:id', requireAuth, requireSuperAdmin, adminUpdate)
router.delete('/users/:id', requireAuth, requireSuperAdmin, adminDelete)

export default router
