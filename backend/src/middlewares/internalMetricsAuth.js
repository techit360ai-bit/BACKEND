import crypto from 'node:crypto'

// Service-to-service auth for internal metrics surfaces (the §5 whole-DB-read
// evidence endpoint, etc). Fails closed when no secret is configured. Operators
// may scope scrape access with INTERNAL_METRICS_SECRET; otherwise the existing
// trust ingest secret is reused so no new credential is strictly required.
export function requireInternalMetricsAuth(req, res, next) {
  const secret = process.env.INTERNAL_METRICS_SECRET || process.env.TRUST_INGEST_SECRET || ''
  const expected = Buffer.from(secret)
  const actual = Buffer.from(String(req.get('x-techit-internal-secret') || ''))
  if (!expected.length) return res.status(503).json({ error: 'internal_metrics_not_configured' })
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return res.status(401).json({ error: 'internal_metrics_unauthorized' })
  }
  return next()
}
