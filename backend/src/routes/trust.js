import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { badges, disconnect, history, integrations, notificationsPreview, profile, refresh, verify } from '../controllers/trustSurfaceController.js'

const router = Router()
router.use(requireAuth)
router.get('/profile', profile)
router.get('/badges', badges)
router.get('/history', history)
router.get('/integrations', integrations)
router.post('/refresh/:source', refresh)
router.post('/verify/:source', verify)
router.post('/disconnect/:source', disconnect)
router.post('/notifications/preview', notificationsPreview)
export default router
