import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { requireRole } from '../utils/roleGuards.js'
import {
  breachCreate, breaches, consentCreate, consents, dataErase, dataExport,
  requestCreate, requests, residency, residencySave, subprocessorCreate, subprocessors,
} from '../controllers/complianceController.js'

const router = Router()
router.use(requireAuth)
router.get('/export', dataExport)
router.delete('/erase', dataErase)
router.get('/consents', consents)
router.post('/consents', consentCreate)
router.get('/requests', requests)
router.post('/requests', requestCreate)
router.get('/residency', residency)
router.put('/residency', residencySave)
router.get('/subprocessors', subprocessors)
router.post('/subprocessors', requireRole('organization', 'organisation', 'admin'), subprocessorCreate)
router.get('/breaches', requireRole('organization', 'organisation', 'admin'), breaches)
router.post('/breaches', requireRole('organization', 'organisation', 'admin'), breachCreate)
export default router
