import { rateLimit } from 'express-rate-limit'
import { evaluateEntitlement } from '../services/tvceService.js'
import { reserveCapabilityConsumptionAsync, settleCapabilityConsumptionAsync } from '../services/capabilityConsumptionService.js'
import { resolveOrganizationContext } from '../services/organizationIntelligenceService.js'

function organizationIdFor(req) {
  return req.body?.organizationId || req.query?.organizationId || req.user?.activeContext?.organizationId || null
}

export function requireOrganizationCapability(capability, { consume = false } = {}) {
  return async (req, res, next) => {
    const context = resolveOrganizationContext(req.user.id, organizationIdFor(req))
    if (!context.ok) return res.status(403).json(context)
    const decision = evaluateEntitlement(req.user.id, {
      capability,
      role: 'organization',
      organizationId: context.organizationId,
      programId: req.body?.programId || req.query?.programId || null,
      hackathonId: req.body?.hackathonId || req.query?.hackathonId || req.params?.hackathonId || null,
      budgetId: req.body?.budgetId || req.query?.budgetId || null,
      estimatedCredits: req.body?.estimatedCredits ?? req.body?.estimated_credits,
      consume,
    })
    if (!decision.allowed) return res.status(decision.code.includes('required') || decision.code.includes('exhausted') || decision.code.includes('limit') ? 402 : 403).json({ error: decision.code, capability, decision })
    req.organizationContext = context
    req.organizationCapability = decision
    if (!consume) return next()
    const idempotencyKey = req.get('idempotency-key') || `${req.user.id}:${context.organizationId}:${capability}:${req.id}`
    const reservation = await reserveCapabilityConsumptionAsync(req.user.id, decision, idempotencyKey, { estimatedCredits: Number(req.body?.estimatedCredits ?? req.body?.estimated_credits ?? 0) })
    if (!reservation.ok) return res.status(['organization_budget_required', 'organization_budget_exhausted', 'insufficient_credits', 'subscription_allowance_exhausted'].includes(reservation.error) ? 402 : 409).json(reservation)
    req.capabilityConsumption = reservation.consumption
    res.on('finish', () => { void settleCapabilityConsumptionAsync(reservation.consumption.id, res.statusCode) })
    return next()
  }
}

export const organizationCommercialRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: Math.max(10, Number(process.env.ORGANIZATION_COMMERCIAL_REQUESTS_PER_MINUTE || 120)),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: req => `${req.user?.id || req.ip}:${organizationIdFor(req) || 'none'}:${req.params?.hackathonId || 'none'}`,
  message: { error: 'organization_commercial_rate_limit_exceeded' },
})
