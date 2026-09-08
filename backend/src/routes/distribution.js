import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { activate, click, create, get, metrics, publicGet, share } from '../controllers/distributionController.js'

const router = Router()
router.get('/public/:id', publicGet)
router.post('/public/:id/click', click)
router.use(requireAuth)
router.post('/create', create)
router.get('/metrics', metrics)
router.get('/:id', get)
router.post('/:id/share', share)
router.post('/referrals/:referralId/activate', activate)
export default router
