import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { analytics, applicationReview, applications, feedPublish, inviteCreate, inviteResolve, inviteRevoke, messageCreate, opportunityBroadcast, roomApply, roomCreate, roomGet, roomPatch, rooms, sharePayload, taskCreate, taskPatch } from '../controllers/mentorshipController.js'

const router = Router()
router.use(requireAuth)
router.get('/rooms', rooms)
router.post('/rooms', roomCreate)
router.get('/rooms/:roomId', roomGet)
router.patch('/rooms/:roomId', roomPatch)
router.post('/rooms/:roomId/apply', roomApply)
router.post('/rooms/:roomId/tasks', taskCreate)
router.post('/rooms/:roomId/messages', messageCreate)
router.get('/rooms/:roomId/share', sharePayload)
router.post('/rooms/:roomId/share/feed', feedPublish)
router.post('/rooms/:roomId/share/opportunity', opportunityBroadcast)
router.post('/rooms/:roomId/invites', inviteCreate)
router.get('/invites/:token', inviteResolve)
router.delete('/invites/:inviteId', inviteRevoke)
router.patch('/tasks/:taskId', taskPatch)
router.get('/applications', applications)
router.patch('/applications/:applicationId', applicationReview)
router.get('/analytics', analytics)
export default router
