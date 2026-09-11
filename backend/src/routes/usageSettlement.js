import { Router } from 'express'
import { requireAiRouterService, requireUsageGrantIssuer } from '../middlewares/serviceAuth.js'
import { billingAuthorize } from '../controllers/billingAuthorityController.js'
import { usageHealth, usageReserve, usageSettle } from '../controllers/usageSettlementController.js'
import { usageGrantIssue } from '../controllers/usageGrantController.js'

const router = Router()
router.post('/authorize', requireUsageGrantIssuer, billingAuthorize)
router.post('/reserve', requireUsageGrantIssuer, usageReserve)
router.post('/grant', requireUsageGrantIssuer, usageGrantIssue)
router.post('/settle', requireAiRouterService, usageSettle)
router.get('/health', requireAiRouterService, usageHealth)

export default router
