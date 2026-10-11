import { Router } from 'express'
import crypto from 'node:crypto'
import { requireAuth } from '../middlewares/auth.js'
import { requireAdminAuth } from '../middlewares/auth.js'
import { requireAdmin } from '../utils/roleGuards.js'
import { incTrustMetric, observeTrustLatency } from '../services/trustMetrics.js'
import { adapterConnect, analyticsConnect, analyticsCredentials, analyticsDisconnect, analyticsRefreshWorker, analyticsVerify, badges, continuousVerification, disconnect, domainChallenge, domainVerify, history, integrations, internalAdapterIngest, linkedinCallback, identityConnect, identityCredentials, identityDisconnect, identityList, identityRefreshWorker, identityRegistryVerify, identityScreeningList, identityScreeningRun, identityVerify, milestoneEvidenceFinalize, milestoneEvidenceUpload, milestoneList, metrics, milestoneReview, milestoneSubmit, notificationsPreview, operations, profile, trustMetricsProm, proofReview, proofSubmit, refresh, refreshPlan, revenueConnect, revenueCredentials, revenueDisconnect, revenueRefreshWorker, revenueVerify, shareProfilePreview, shippingConnect, shippingCredentials, shippingDisconnect, shippingRefreshWorker, shippingVerify, teamConnect, teamCredentials, teamDisconnect, teamHrisVerify, teamInvite, teamRefreshWorker, teamRegistryVerify, teamVerify, teamWorkEmailChallenge, teamWorkEmailVerify, verify, reverificationRun, reverificationDue, overrideApply, overrideRevoke, overrideList } from '../controllers/trustSurfaceController.js'

// Trusted verification workers only. Fails closed when no secret is configured.
function requireTrustIngestSecret(req, res, next) {
  const expected = Buffer.from(process.env.TRUST_INGEST_SECRET || '')
  const actual = Buffer.from(String(req.get('x-techit-internal-secret') || ''))
  if (!expected.length) return res.status(503).json({ error: 'trust_ingest_not_configured' })
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return res.status(401).json({ error: 'trust_ingest_unauthorized' })
  return next()
}

const router = Router()

// WS11: every trust request is timed + status-counted so p95/p99 latency and the
// error rate are observable. Best-effort; never affects the response.
function observeTrustRequest(req, res, next) {
  const startedAt = Date.now()
  res.on('finish', () => {
    try {
      observeTrustLatency('trust_http_ms', Date.now() - startedAt)
      incTrustMetric('trust_http_requests_total', { method: req.method, status: res.statusCode })
    } catch { /* telemetry must never break a request */ }
  })
  next()
}

router.use(observeTrustRequest)
router.get('/linkedin/callback', linkedinCallback)
router.post('/internal/adapters/:provider/ingest', requireTrustIngestSecret, internalAdapterIngest)
router.post('/internal/revenue/refresh', requireTrustIngestSecret, revenueRefreshWorker)
router.post('/internal/analytics/refresh', requireTrustIngestSecret, analyticsRefreshWorker)
router.post('/internal/shipping/refresh', requireTrustIngestSecret, shippingRefreshWorker)
router.post('/internal/team/refresh', requireTrustIngestSecret, teamRefreshWorker)
router.post('/internal/identity/refresh', requireTrustIngestSecret, identityRefreshWorker)
// WS9: scheduled continuous re-verification / decay tick (service-authenticated).
router.post('/internal/reverification/run', requireTrustIngestSecret, reverificationRun)
// WS11: Prometheus text exposition (same snapshot as the admin JSON endpoint).
router.get('/internal/metrics/trust', requireTrustIngestSecret, trustMetricsProm)
router.use(requireAuth)
router.get('/profile', profile)
router.get('/badges', badges)
router.get('/history', history)
router.get('/integrations', integrations)
router.post('/refresh/:source', refresh)
router.post('/verify/:source', verify)
router.post('/disconnect/:source', disconnect)
router.post('/notifications/preview', notificationsPreview)
router.post('/domain/challenge', domainChallenge)
router.post('/domain/challenge/:challengeId/verify', domainVerify)
router.post('/proofs', proofSubmit)
router.post('/adapters/:provider/verify', adapterConnect)
router.post('/refresh-plan', refreshPlan)
router.post('/continuous-verification/run', requireAdminAuth, requireAdmin, continuousVerification)
router.get('/milestone', milestoneList)
router.post('/milestone', milestoneSubmit)
router.post('/milestone/evidence', milestoneEvidenceUpload)
router.post('/milestone/evidence/:evidenceId/finalize', milestoneEvidenceFinalize)
router.post('/milestone/review', requireAdminAuth, requireAdmin, milestoneReview)
router.get('/identity', identityList)
router.post('/identity/connect', identityConnect)
router.get('/identity/credentials', identityCredentials)
router.post('/identity/verify', identityVerify)
router.post('/identity/registry/verify', identityRegistryVerify)
router.post('/identity/screening', identityScreeningRun)
router.get('/identity/screening', identityScreeningList)
router.delete('/identity/:provider', identityDisconnect)

router.post('/team/invite', teamInvite)
router.post('/team/verify', teamVerify)
// Team verification (WS6). Work-email, registry, and HRIS paths are node-local;
// only provider-observed results mint a verified team/organization proof.
router.get('/team/credentials', teamCredentials)
router.post('/team/connect', teamConnect)
router.post('/team/work-email/challenge', teamWorkEmailChallenge)
router.post('/team/work-email/verify', teamWorkEmailVerify)
router.post('/team/registry/verify', teamRegistryVerify)
router.post('/team/registry/:provider/verify', teamRegistryVerify)
router.post('/team/hris/verify', teamHrisVerify)
router.post('/team/hris/:provider/verify', teamHrisVerify)
router.delete('/team/credential/:provider', teamDisconnect)
router.post('/share-profile/preview', shareProfilePreview)
// Revenue verification (WS3). Connect stores an encrypted read-only credential;
// verify is the only route that mints a verified revenue proof.
router.get('/revenue/credentials', revenueCredentials)
router.post('/revenue/connect', revenueConnect)
router.post('/revenue/verify', revenueVerify)
router.post('/revenue/:provider/verify', revenueVerify)
router.delete('/revenue/:provider', revenueDisconnect)
// Product analytics verification (WS4).
router.get('/analytics/credentials', analyticsCredentials)
router.post('/analytics/connect', analyticsConnect)
router.post('/analytics/verify', analyticsVerify)
router.post('/analytics/:provider/verify', analyticsVerify)
router.delete('/analytics/:provider', analyticsDisconnect)
// Shipping / deployment cadence verification (WS5).
router.get('/shipping/credentials', shippingCredentials)
router.post('/shipping/connect', shippingConnect)
router.post('/shipping/verify', shippingVerify)
router.post('/shipping/:provider/verify', shippingVerify)
router.delete('/shipping/:provider', shippingDisconnect)
router.get('/admin/operations', requireAdminAuth, requireAdmin, operations)
router.get('/admin/metrics', requireAdminAuth, requireAdmin, metrics)
router.post('/admin/proofs/:proofId/review', requireAdminAuth, requireAdmin, proofReview)
router.get('/reverification/due', reverificationDue)
// WS9 manual score overrides. Admin-only; a reason code + future expiry are
// mandatory and every apply/revoke is audit-logged.
router.post('/admin/overrides', requireAdminAuth, requireAdmin, overrideApply)
router.get('/admin/users/:userId/overrides', requireAdminAuth, requireAdmin, overrideList)
router.delete('/admin/users/:userId/overrides/:overrideId', requireAdminAuth, requireAdmin, overrideRevoke)
export default router
