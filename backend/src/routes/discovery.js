import { Router } from 'express'
import {
  catchUp,
  createExposure,
  createFeedback,
  createRecommendationEvent,
  finishCatchUp,
  listRecommendations,
  markCatchUpSeen,
  putRecommendationProfile,
  recordActivity,
  returnSummary,
  search,
} from '../controllers/discoveryController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.use(requireAuth)
router.get('/recommendations', listRecommendations)
router.get('/search', search)
router.put('/profile', putRecommendationProfile)
router.post('/events', createRecommendationEvent)
router.post('/activity', recordActivity)
router.post('/recommendations/:id/exposure', createExposure)
router.post('/recommendations/:id/feedback', createFeedback)
router.get('/return-summary', returnSummary)
router.get('/catch-up', catchUp)
router.post('/catch-up/complete', finishCatchUp)
router.post('/catch-up/:id/seen', markCatchUpSeen)

export default router
