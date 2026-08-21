import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { advisory, brief, changes, overview, portfolio, risks, startup } from '../controllers/investorIntelligenceController.js'

const router = Router()
router.use(requireAuth)
router.get('/overview', overview)
router.get('/startups/:startupId', startup)
router.get('/changes', changes)
router.get('/portfolio', portfolio)
router.get('/risks', risks)
router.get('/brief', brief)
router.get('/advisory/:scope', advisory)
export default router
