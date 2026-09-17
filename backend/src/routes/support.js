import { Router } from 'express'
import crypto from 'node:crypto'
import { requireAdminAuth, requireAuth } from '../middlewares/auth.js'
import { requireAdmin, requireSupportPermission } from '../utils/roleGuards.js'
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
  adminAnalytics,
  adminConfig,
  adminConfigUpdate,
  adminDiagnostics,
  adminLock,
  adminMaintenance,
  adminAttachment,
  adminCorrectiveAction,
  adminKnowledgeSave,
  adminTemplateSave,
  adminIntelligence,
  userCaseReopen,
  userKnowledge,
  userCaseAttachment,
  adminAi,
  caseStream,
  supportHealth,
  userAttachmentInit,
  userAttachmentFinalize,
  adminAttachmentInit,
  adminAttachmentFinalize,
  adminDirectory,
  adminKnowledgeList,
  adminTemplateList,
} from '../controllers/supportController.js'

const router = Router()

router.get('/health', supportHealth)
router.post('/internal/maintenance', (req, res, next) => { const expected = Buffer.from(process.env.BACKEND_SUPPORT_MAINTENANCE_SECRET || ''); const actual = Buffer.from(String(req.get('X-TechIT-Internal-Secret') || '')); if (!expected.length || expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return res.status(401).json({ error: 'invalid_internal_secret' }); next() }, adminMaintenance)

router.get('/cases', requireAuth, userCaseList)
router.post('/cases', requireAuth, userCaseCreate)
router.get('/cases/:caseId', requireAuth, userCaseGet)
router.get('/cases/:caseId/stream', requireAuth, caseStream)
router.post('/cases/:caseId/messages', requireAuth, userCaseMessage)
router.post('/cases/:caseId/feedback', requireAuth, userCaseFeedback)
router.post('/cases/:caseId/reopen', requireAuth, userCaseReopen)
router.get('/knowledge-base', requireAuth, userKnowledge)
router.post('/cases/:caseId/attachments', requireAuth, userCaseAttachment)
router.post('/cases/:caseId/attachments/init', requireAuth, userAttachmentInit)
router.post('/cases/:caseId/attachments/:attachmentId/finalize', requireAuth, userAttachmentFinalize)

router.get('/admin/overview', requireAdminAuth, requireAdmin, requireSupportPermission('support.view'), adminOverview)
router.get('/admin/cases', requireAdminAuth, requireAdmin, requireSupportPermission('support.view'), adminCaseList)
router.get('/admin/directory', requireAdminAuth, requireAdmin, requireSupportPermission('support.view'), adminDirectory)
router.get('/admin/cases/:caseId', requireAdminAuth, requireAdmin, requireSupportPermission('support.view'), adminCaseGet)
router.get('/admin/cases/:caseId/diagnostics', requireAdminAuth, requireAdmin, requireSupportPermission('support.view_sensitive'), adminDiagnostics)
router.post('/admin/cases/:caseId/lock', requireAdminAuth, requireAdmin, requireSupportPermission('support.view'), adminLock)
router.patch('/admin/cases/:caseId', requireAdminAuth, requireAdmin, adminCaseUpdate)
router.post('/admin/cases/:caseId/messages', requireAdminAuth, requireAdmin, requireSupportPermission('support.reply'), adminCaseMessage)
router.get('/admin/config', requireAdminAuth, requireAdmin, requireSupportPermission('support.view'), adminConfig)
router.patch('/admin/config', requireAdminAuth, requireAdmin, requireSupportPermission('support.view'), adminConfigUpdate)
router.get('/admin/analytics', requireAdminAuth, requireAdmin, requireSupportPermission('support.view'), adminAnalytics)
router.get('/admin/intelligence', requireAdminAuth, requireAdmin, requireSupportPermission('support.view_intelligence'), adminIntelligence)
router.post('/admin/maintenance/run', requireAdminAuth, requireAdmin, requireSupportPermission('support.run_maintenance'), adminMaintenance)
router.post('/admin/cases/:caseId/attachments', requireAdminAuth, requireAdmin, requireSupportPermission('support.reply'), adminAttachment)
router.post('/admin/cases/:caseId/attachments/init', requireAdminAuth, requireAdmin, requireSupportPermission('support.reply'), adminAttachmentInit)
router.post('/admin/cases/:caseId/attachments/:attachmentId/finalize', requireAdminAuth, requireAdmin, requireSupportPermission('support.reply'), adminAttachmentFinalize)
router.post('/admin/cases/:caseId/actions', requireAdminAuth, requireAdmin, adminCorrectiveAction)
router.post('/admin/knowledge-base', requireAdminAuth, requireAdmin, requireSupportPermission('support.manage_knowledge_base'), adminKnowledgeSave)
router.get('/admin/knowledge-base', requireAdminAuth, requireAdmin, requireSupportPermission('support.manage_knowledge_base'), adminKnowledgeList)
router.post('/admin/templates', requireAdminAuth, requireAdmin, requireSupportPermission('support.manage_templates'), adminTemplateSave)
router.get('/admin/templates', requireAdminAuth, requireAdmin, requireSupportPermission('support.manage_templates'), adminTemplateList)
router.post('/admin/cases/:caseId/ai', requireAdminAuth, requireAdmin, requireSupportPermission('support.reply'), adminAi)

export default router
