import { Router } from 'express'
import { requireAiRouterService, requirePaymentGatewayService, requireUsageGrantIssuer } from '../middlewares/serviceAuth.js'
import { billingAuthorize, billingCheckout } from '../controllers/billingAuthorityController.js'
import { usageHealth, usageReserve, usageSettle } from '../controllers/usageSettlementController.js'
import { usageGrantIssue } from '../controllers/usageGrantController.js'

const router = Router()
router.post('/authorize', requirePaymentGatewayService, billingAuthorize)
router.post('/checkout', requirePaymentGatewayService, billingCheckout)
router.post('/reserve', requireUsageGrantIssuer, usageReserve)
router.post('/grant', requireUsageGrantIssuer, usageGrantIssue)
router.post('/settle', requireAiRouterService, usageSettle)
router.get('/health', requireAiRouterService, usageHealth)

export default router
