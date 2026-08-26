import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { projects, curriculum, adapt, start, heartbeat, reflection, quiz, exercise, complete, badges } from '../controllers/academyController.js'

const router = Router(); router.use(requireAuth)
router.get('/projects', projects)
router.get('/curriculum', curriculum)
router.get('/badges', badges)
router.post('/adapt', adapt)
router.post('/curricula/:curriculumId/modules/:moduleId/start', start)
router.post('/curricula/:curriculumId/modules/:moduleId/heartbeat', heartbeat)
router.post('/curricula/:curriculumId/modules/:moduleId/reflection', reflection)
router.post('/curricula/:curriculumId/modules/:moduleId/quiz', quiz)
router.post('/curricula/:curriculumId/modules/:moduleId/exercise', exercise)
router.post('/curricula/:curriculumId/modules/:moduleId/complete', complete)
export default router
