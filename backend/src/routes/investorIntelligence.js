import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { advisory, alerts, brief, changes, evi, overview, portfolio, reports, risks, startup, stream } from '../controllers/investorIntelligenceController.js'

const router = Router()
router.use(requireAuth)
router.get('/overview', overview)
router.get('/startups/:startupId', startup)
router.post('/startups/:startupId/evi', evi)
router.get('/changes', changes)
router.get('/portfolio', portfolio)
router.get('/risks', risks)
router.get('/brief', brief)
router.get('/alerts', alerts)
router.get('/reports', reports)
router.get('/stream', stream)
router.get('/advisory/:scope', advisory)
export default router
