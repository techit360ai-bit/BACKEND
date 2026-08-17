import crypto from 'crypto'

function requireSignedService({ serviceIdEnv, secretEnv, defaultServiceId }) {
  return function signedService(req, res, next) {
    const serviceId = process.env[serviceIdEnv] || defaultServiceId
    const secret = process.env[secretEnv] || ''
    const maxSkew = Number(process.env.AI_ROUTER_SETTLEMENT_MAX_SKEW_SECONDS || 300)
    if (!secret) return res.status(503).json({ error: 'settlement_service_not_configured' })
    const timestamp = req.get('x-techit-timestamp')
    const signature = req.get('x-techit-signature')
    if (req.get('x-techit-service-id') !== serviceId || !timestamp || !signature) return res.status(401).json({ error: 'service_auth_required' })
    const ts = Number(timestamp)
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > maxSkew) return res.status(401).json({ error: 'service_auth_timestamp_invalid' })
    const serializedBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {})
    const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${serializedBody}`).digest('hex')
    const actualBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return res.status(401).json({ error: 'service_auth_signature_invalid' })
    req.service = { id: serviceId }
    return next()
  }
}

export const requireAiRouterService = requireSignedService({
  serviceIdEnv: 'AI_ROUTER_SERVICE_ID',
  secretEnv: 'AI_ROUTER_SETTLEMENT_SECRET',
  defaultServiceId: 'ai-router',
})

// Reservation/grant authority belongs to a trusted backend orchestrator, not
// the Router. A compromised Router settlement key therefore cannot mint its
// own platform-subsidized grants or choose customer funding sources.
export const requireUsageGrantIssuer = requireSignedService({
  serviceIdEnv: 'AI_USAGE_GRANT_SERVICE_ID',
  secretEnv: 'AI_USAGE_GRANT_SERVICE_SECRET',
  defaultServiceId: 'platform-backend',
})
