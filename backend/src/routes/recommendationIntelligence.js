import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { collaborators, founderCollaborators, organizationTalent, mentors, investorThesis } from '../controllers/recommendationIntelligenceController.js'

const router = Router()
router.use(requireAuth)
router.get('/collaborators', collaborators)
router.get('/founders/:projectId/collaborators', founderCollaborators)
router.get('/organization/talent', organizationTalent)
router.get('/mentors', mentors)
router.get('/investors/thesis', investorThesis)
export default router
