import { Router } from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { requireAuth } from '../middlewares/auth.js'
import { requireCapability } from '../services/capabilityAuthorization.js'
import { checklistPatch, dealCreate, dealGet, deals, icCreate, ndaSign, noteCreate, questionCreate, questionMessage, statusChange, termSheetCreate } from '../controllers/investorDealRoomController.js'
import { auditVerify, closingGet, closingItemSave, comparableList, documentCreate, documentDownload, documentFinalize, documentRevoke, documents, folderCreate, folders, icUpdate, packCreate, participantCreate, participantRevoke, participants, questionnaireGet, questionnaireSave, questionnaireTemplateSave, referenceCreate, references, requestCreate, revenueGet, revenueRecord, revenueRefresh, technicalDdGet, termAction, termSheets } from '../controllers/investorDealRoomCompletionController.js'

const router = Router(); router.use(requireAuth)
// WS-14: the Deal Room is the most sensitive read surface on the platform -
// investor documents, NDA state and diligence evidence - and had no ceiling of
// its own. Keyed per authenticated user, bounded per minute.
router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: Math.max(10, Number(process.env.DEAL_ROOM_REQUESTS_PER_MINUTE || 120)),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  validate: { trustProxy: true, xForwardedForHeader: true },
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'rate_limit_exceeded' },
}))
router.get('/', requireCapability('investor.dealroom.view'), deals)
router.post('/', requireCapability('investor.dealroom.create'), dealCreate)
router.get('/:dealId', requireCapability('investor.dealroom.view'), dealGet)
router.post('/:dealId/nda/sign', ndaSign)
router.post('/:dealId/status', requireCapability('investor.dealroom.manage'), statusChange)
router.patch('/:dealId/checklist/:itemId', requireCapability('investor.dealroom.manage'), checklistPatch)
router.post('/:dealId/questions', requireCapability('investor.dealroom.view'), questionCreate)
router.post('/:dealId/questions/:questionId/messages', requireCapability('investor.dealroom.view'), questionMessage)
router.post('/:dealId/internal-notes', requireCapability('investor.dealroom.internal'), noteCreate)
router.post('/:dealId/ic', requireCapability('investor.dealroom.internal'), icCreate)
router.post('/:dealId/term-sheet', requireCapability('investor.dealroom.internal'), termSheetCreate)
router.get('/comparables/list', requireCapability('investor.dealroom.view'), comparableList)
router.get('/:dealId/folders', requireCapability('investor.dealroom.view'), folders)
router.post('/:dealId/folders', requireCapability('investor.dealroom.manage'), folderCreate)
router.post('/:dealId/document-requests', requireCapability('investor.dealroom.manage'), requestCreate)
router.get('/:dealId/documents', requireCapability('investor.dealroom.view'), documents)
router.post('/:dealId/documents', requireCapability('investor.dealroom.manage'), documentCreate)
router.post('/:dealId/documents/:documentId/finalize', requireCapability('investor.dealroom.manage'), documentFinalize)
router.get('/:dealId/documents/:documentId/download', requireCapability('investor.dealroom.view'), documentDownload)
router.post('/:dealId/documents/:documentId/revoke', requireCapability('investor.dealroom.internal'), documentRevoke)
router.get('/:dealId/questionnaire', requireCapability('investor.dealroom.view'), questionnaireGet)
router.put('/:dealId/questionnaire', requireCapability('investor.dealroom.manage'), questionnaireSave)
router.post('/:dealId/questionnaire/template', requireCapability('investor.dealroom.internal'), questionnaireTemplateSave)
router.get('/:dealId/technical-dd', requireCapability('investor.dealroom.view'), technicalDdGet)
router.get('/:dealId/revenue', requireCapability('investor.dealroom.view'), revenueGet)
router.post('/:dealId/revenue', requireCapability('investor.dealroom.manage'), revenueRecord)
router.post('/:dealId/revenue/refresh', requireCapability('investor.dealroom.manage'), revenueRefresh)
router.get('/:dealId/references', requireCapability('investor.dealroom.internal'), references)
router.post('/:dealId/references', requireCapability('investor.dealroom.internal'), referenceCreate)
router.get('/:dealId/team', requireCapability('investor.dealroom.view'), participants)
router.post('/:dealId/team', requireCapability('investor.dealroom.internal'), participantCreate)
router.post('/:dealId/team/:participantId/revoke', requireCapability('investor.dealroom.internal'), participantRevoke)
router.put('/:dealId/ic', requireCapability('investor.dealroom.internal'), icUpdate)
router.post('/:dealId/term-sheet/:action', requireCapability('investor.dealroom.view'), termAction)
router.get('/:dealId/term-sheets', requireCapability('investor.dealroom.view'), termSheets)
router.get('/:dealId/closing', requireCapability('investor.dealroom.view'), closingGet)
router.post('/:dealId/closing/items', requireCapability('investor.dealroom.internal'), closingItemSave)
router.post('/:dealId/pack', requireCapability('investor.dealroom.internal'), packCreate)
router.get('/:dealId/audit/integrity', requireCapability('investor.dealroom.view'), auditVerify)
export default router
