import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { requireCapability } from '../services/capabilityAuthorization.js'
import { checklistPatch, dealCreate, dealGet, deals, icCreate, ndaSign, noteCreate, questionCreate, questionMessage, statusChange, termSheetCreate } from '../controllers/investorDealRoomController.js'

const router = Router(); router.use(requireAuth)
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
export default router
