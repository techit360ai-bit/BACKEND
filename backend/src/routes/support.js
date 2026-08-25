import { Router } from 'express'
import { requireAdminAuth, requireAuth } from '../middlewares/auth.js'
import { requireAdmin } from '../utils/roleGuards.js'
import {
  adminCaseGet,
  adminCaseList,
  adminCaseMessage,
  adminCaseUpdate,
  adminOverview,
  userCaseCreate,
  userCaseFeedback,
  userCaseGet,
  userCaseList,
  userCaseMessage,
} from '../controllers/supportController.js'

const router = Router()

router.get('/cases', requireAuth, userCaseList)
router.post('/cases', requireAuth, userCaseCreate)
router.get('/cases/:caseId', requireAuth, userCaseGet)
router.post('/cases/:caseId/messages', requireAuth, userCaseMessage)
router.post('/cases/:caseId/feedback', requireAuth, userCaseFeedback)

router.get('/admin/overview', requireAdminAuth, requireAdmin, adminOverview)
router.get('/admin/cases', requireAdminAuth, requireAdmin, adminCaseList)
router.get('/admin/cases/:caseId', requireAdminAuth, requireAdmin, adminCaseGet)
router.patch('/admin/cases/:caseId', requireAdminAuth, requireAdmin, adminCaseUpdate)
router.post('/admin/cases/:caseId/messages', requireAdminAuth, requireAdmin, adminCaseMessage)

export default router
