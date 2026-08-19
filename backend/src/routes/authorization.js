import { Router } from 'express'
import { requireAuth } from '../middlewares/auth.js'
import { requireAdmin } from '../utils/roleGuards.js'
import { activateRole, adminCapabilityPolicies, adminCapabilityPolicyUpdate, adminReverificationNotifications, adminRiskUpdate, adminVerificationAnalytics, adminVerificationQueue, adminVerificationReview, capabilities, capabilityCheck, evidenceUploadFinalize, evidenceUploadUrl, mfaEnroll, mfaStatusGet, mfaVerify, organizationClaim, organizationCreate, organizationMemberAdd, organizationMembership, switchRole, trustProfile, verificationEvidence, verificationEvidenceAnalyze, verificationRequest, verificationStatus } from '../controllers/authorizationController.js'
import { requireAdminAuth } from '../middlewares/auth.js'
import { rateLimit } from 'express-rate-limit'

const router = Router()
const verificationLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false })
const evidenceLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false })
const claimLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false })
router.get('/capabilities', requireAuth, capabilities)
router.post('/capabilities/check', requireAuth, capabilityCheck)
router.post('/roles/activate', requireAuth, activateRole)
router.post('/roles/switch', requireAuth, switchRole)
router.get('/verification/status', requireAuth, verificationStatus)
router.post('/verification/request', requireAuth, verificationLimit, verificationRequest)
router.post('/verification/requests/:requestId/evidence', requireAuth, evidenceLimit, verificationEvidence)
router.post('/verification/requests/:requestId/evidence/analyze', requireAuth, evidenceLimit, verificationEvidenceAnalyze)
router.get('/trust/profile', requireAuth, trustProfile)
router.get('/mfa/status', requireAuth, mfaStatusGet)
router.post('/mfa/enroll', requireAuth, mfaEnroll)
router.post('/mfa/verify', requireAuth, mfaVerify)
router.post('/verification/requests/:requestId/evidence/upload-url', requireAuth, evidenceUploadUrl)
router.post('/verification/evidence/:objectId/finalize', requireAuth, evidenceUploadFinalize)
router.post('/organizations', requireAuth, organizationCreate)
router.post('/organizations/:organizationId/claim', requireAuth, claimLimit, organizationClaim)
router.get('/organizations/:organizationId/memberships', requireAuth, organizationMembership)
router.post('/organizations/:organizationId/members', requireAuth, organizationMemberAdd)
router.get('/admin/verifications', requireAdminAuth, requireAdmin, adminVerificationQueue)
router.post('/admin/verifications/:requestId/review', requireAdminAuth, requireAdmin, adminVerificationReview)
router.get('/admin/capabilities', requireAdminAuth, requireAdmin, adminCapabilityPolicies)
router.patch('/admin/capabilities/:capability', requireAdminAuth, requireAdmin, adminCapabilityPolicyUpdate)
router.patch('/admin/risk/:userId', requireAdminAuth, requireAdmin, adminRiskUpdate)
router.get('/admin/analytics', requireAdminAuth, requireAdmin, adminVerificationAnalytics)
router.post('/admin/reverification-notifications/run', requireAdminAuth, requireAdmin, adminReverificationNotifications)
export default router
