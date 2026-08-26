import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { momentsList, momentsGenerate, momentPrompt, momentDismiss, momentGet, momentShare, publicMomentGet, publicMomentVisit, momentsAnalytics } from '../controllers/techitMomentsController.js'

const router = Router()
router.get('/public/:slug', publicMomentGet)
router.post('/public/:slug/visit', publicMomentVisit)
router.use(requireAuth)
router.get('/', momentsList)
router.post('/generate', momentsGenerate)
router.get('/prompt', momentPrompt)
router.get('/analytics', momentsAnalytics)
router.get('/:momentId', momentGet)
router.post('/:momentId/dismiss', momentDismiss)
router.post('/:momentId/share', momentShare)
export default router
