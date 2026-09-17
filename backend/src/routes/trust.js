import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { requireAdminAuth } from '../middlewares/auth.js'
import { requireAdmin } from '../utils/roleGuards.js'
import { badges, disconnect, domainChallenge, domainVerify, history, integrations, linkedinCallback, notificationsPreview, operations, profile, proofReview, proofSubmit, refresh, verify } from '../controllers/trustSurfaceController.js'

const router = Router()
router.get('/linkedin/callback', linkedinCallback)
router.use(requireAuth)
router.get('/profile', profile)
router.get('/badges', badges)
router.get('/history', history)
router.get('/integrations', integrations)
router.post('/refresh/:source', refresh)
router.post('/verify/:source', verify)
router.post('/disconnect/:source', disconnect)
router.post('/notifications/preview', notificationsPreview)
router.post('/domain/challenge', domainChallenge)
router.post('/domain/challenge/:challengeId/verify', domainVerify)
router.post('/proofs', proofSubmit)
router.get('/admin/operations', requireAdminAuth, requireAdmin, operations)
router.post('/admin/proofs/:proofId/review', requireAdminAuth, requireAdmin, proofReview)
export default router
