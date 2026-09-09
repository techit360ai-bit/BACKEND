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
  adminIntelligenceTelemetry,
  adminComparableUpsert,
  adminAiRouterTelemetry,
  adminSecurityPosture,
  adminSecurityEvents,
} from '../controllers/adminAuthController.js'
import { requireAdminAuth } from '../middlewares/auth.js'
import { requireAdmin, requireSuperAdmin } from '../utils/roleGuards.js'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { adminAnalytics as tvceAdminAnalytics, adminConfig as tvceAdminConfig, adminConfigUpdate as tvceAdminConfigUpdate, adminOrganizationEntitlement as tvceAdminOrganizationEntitlement, adminOrganizationBudget as tvceAdminOrganizationBudget, adminOrganizationHackathonReview as tvceAdminOrganizationHackathonReview, adminOrganizationAbuseReviews as tvceAdminOrganizationAbuseReviews, adminOrganizationAbuseReview as tvceAdminOrganizationAbuseReview } from '../controllers/tvceController.js'

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
router.get('/intelligence/telemetry', requireAdminAuth, requireAdmin, adminIntelligenceTelemetry)
router.get('/ai-router/telemetry', requireAdminAuth, requireAdmin, adminAiRouterTelemetry)
router.get('/security/posture', requireAdminAuth, requireAdmin, adminSecurityPosture)
router.get('/security/events', requireAdminAuth, requireAdmin, adminSecurityEvents)
router.post('/investor/comparables', requireAdminAuth, requireAdmin, adminComparableUpsert)
router.get('/tvce/analytics', requireAdminAuth, requireAdmin, tvceAdminAnalytics)
router.get('/tvce/config', requireAdminAuth, requireAdmin, tvceAdminConfig)
router.patch('/tvce/config', requireAdminAuth, requireSuperAdmin, tvceAdminConfigUpdate)
router.post('/tvce/organization-entitlements', requireAdminAuth, requireSuperAdmin, tvceAdminOrganizationEntitlement)
router.post('/tvce/organization-budgets', requireAdminAuth, requireSuperAdmin, tvceAdminOrganizationBudget)
router.patch('/tvce/organization-hackathons/:hackathonId/review', requireAdminAuth, requireAdmin, tvceAdminOrganizationHackathonReview)
router.get('/tvce/organization-abuse-reviews', requireAdminAuth, requireAdmin, tvceAdminOrganizationAbuseReviews)
router.patch('/tvce/organization-abuse-reviews/:reviewId', requireAdminAuth, requireAdmin, tvceAdminOrganizationAbuseReview)

export default router
