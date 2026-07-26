import { Router } from 'express'
import { listVideoLessons, getVideoLesson, createVideoLesson, markVideoProgress } from '../controllers/videoController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/lessons', requireAuth, listVideoLessons)
router.get('/lessons/:id', requireAuth, getVideoLesson)
router.post('/lessons', requireAuth, createVideoLesson)
router.post('/lessons/:id/progress', requireAuth, markVideoProgress)

export default router
