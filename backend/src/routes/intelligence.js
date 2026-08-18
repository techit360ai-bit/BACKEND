import { Router } from 'express'
import { activity, anomaly, evidence, gsis, investorSignals, match, profileQuality, snapshot, training, trust } from '../controllers/intelligenceController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()
router.use(requireAuth)
router.get('/snapshot', snapshot)
router.post('/gsis', gsis)
router.post('/investor-signals', investorSignals)
router.post('/match', match)
router.post('/profile-quality', profileQuality)
router.post('/evidence', evidence)
router.post('/training-plan', training)
router.post('/trust', trust)
router.post('/activity-momentum', activity)
router.post('/admin-anomaly', anomaly)

export default router
