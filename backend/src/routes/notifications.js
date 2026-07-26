import { Router } from 'express'
import {
  createNotification,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notificationController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/', requireAuth, listNotifications)
router.post('/', requireAuth, createNotification)
router.post('/read-all', requireAuth, markAllNotificationsRead)
router.patch('/:id/read', requireAuth, markNotificationRead)
router.delete('/:id', requireAuth, deleteNotification)

export default router
