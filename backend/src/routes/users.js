import { Router } from 'express'
import { avatarFinalize, avatarRemove, avatarUploadUrl, connectUser, getMe, getUserProfile, listConnections, listConnectionRequests, listUsers, respondConnectionRequest, updateMe } from '../controllers/userController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/me', requireAuth, getMe)
router.patch('/me', requireAuth, updateMe)
router.post('/me/avatar/upload-url', requireAuth, avatarUploadUrl)
router.post('/me/avatar/finalize', requireAuth, avatarFinalize)
router.delete('/me/avatar', requireAuth, avatarRemove)
router.get('/', requireAuth, listUsers)
// Registered before '/:id' so 'connections' is not captured as a user id.
router.get('/connections', requireAuth, listConnections)
router.get('/connections/requests', requireAuth, listConnectionRequests)
router.post('/connections/requests/:requestId/accept', requireAuth, respondConnectionRequest)
router.post('/connections/requests/:requestId/decline', requireAuth, respondConnectionRequest)
router.get('/:id', requireAuth, getUserProfile)
router.post('/:id/connect', requireAuth, connectUser)

export default router
