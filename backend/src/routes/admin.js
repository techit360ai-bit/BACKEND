import { Router } from 'express'
import {
  adminCreate,
  adminDelete,
  adminDiscoveryAnalytics,
  adminDiscoveryConfig,
  adminList,
  adminLogin,
  adminMe,
  adminUpdate,
  adminUpdateDiscoveryConfig,
} from '../controllers/adminAuthController.js'
import { requireAdminAuth } from '../middlewares/auth.js'
import { requireAdmin, requireSuperAdmin } from '../utils/roleGuards.js'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'

const router = Router()

const adminLoginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(req.ip),
  validate: { trustProxy: true, xForwardedForHeader: true },
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many admin sign-in attempts. Please try again later.' },
})

router.post('/login', adminLoginLimit, adminLogin)
router.get('/me', requireAdminAuth, requireAdmin, adminMe)
router.get('/users', requireAdminAuth, requireSuperAdmin, adminList)
router.post('/users', requireAdminAuth, requireSuperAdmin, adminCreate)
router.patch('/users/:id', requireAdminAuth, requireSuperAdmin, adminUpdate)
router.delete('/users/:id', requireAdminAuth, requireSuperAdmin, adminDelete)
router.get('/discovery/config', requireAdminAuth, requireAdmin, adminDiscoveryConfig)
router.patch('/discovery/config', requireAdminAuth, requireSuperAdmin, adminUpdateDiscoveryConfig)
router.get('/discovery/analytics', requireAdminAuth, requireAdmin, adminDiscoveryAnalytics)

export default router
