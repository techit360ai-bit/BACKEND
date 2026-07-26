import { Router } from 'express'
import { githubAuthorize, githubCallback, githubStatus, githubRepos, githubCreateRepo } from '../controllers/githubController.js'
import { requireAuth } from '../middlewares/auth.js'

const router = Router()

router.get('/authorize', requireAuth, githubAuthorize)
router.get('/callback', githubCallback)
router.get('/status', requireAuth, githubStatus)
router.get('/repos', requireAuth, githubRepos)
router.post('/repos', requireAuth, githubCreateRepo)

export default router
