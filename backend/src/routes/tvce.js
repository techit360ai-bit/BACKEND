import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { capabilities, checkout, creditsEstimate, entitlements, evaluate, forecast, freeUsage, funnel, nextAction, paywall, paywallEvent, paymentFulfill, progress, teamGrantCreate, workflowResume, workflowSave } from '../controllers/tvceController.js'

const router = Router()
router.use(requireAuth)
router.get('/capabilities', capabilities)
router.get('/entitlements', entitlements)
router.post('/entitlements/check', evaluate)
router.post('/paywall/evaluate', paywall)
router.post('/paywall/events', paywallEvent)
router.post('/credits/estimate', creditsEstimate)
router.get('/wallet/forecast', forecast)
router.get('/next-best-action', nextAction)
router.get('/progress', progress)
router.get('/free-usage', freeUsage)
router.get('/analytics/funnel', funnel)
router.post('/workflow', workflowSave)
router.post('/workflow/:workflowId/resume', workflowResume)
router.post('/payments/:paymentId/fulfill', paymentFulfill)
router.post('/checkout/session', checkout)
router.post('/workspace/team-grants', teamGrantCreate)
export default router
