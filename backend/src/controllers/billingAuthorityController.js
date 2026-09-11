import { evaluateEntitlementAsync } from '../services/tvceService.js'

export async function billingAuthorize(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const userId = String(body.user_id || body.userId || '').trim()
  const capability = String(body.capability || 'payg_purchase').trim()
  if (!userId) return res.status(400).json({ approved: false, error: 'platform_user_id_required' })
  // Payment authorization is an entitlement preflight. It never creates a
  // wallet, subscription, or role and never accepts a client-declared balance.
  if (capability === 'payg_purchase') {
    return res.json({ approved: true, user_id: userId, capability, funding_source: 'payg', allow_payg: body.allow_payg !== false, wallet_account_id: body.wallet_account_id || null, active_role: body.active_role || null, active_context: body.active_context || null })
  }
  const decision = await evaluateEntitlementAsync(userId, {
    capability,
    role: body.active_role,
    workspaceId: body.workspace_id,
    organizationId: body.organization_id,
    estimatedCredits: body.estimated_credits || body.estimatedCredits,
  })
  return res.status(decision.allowed ? 200 : 402).json({ approved: decision.allowed, user_id: userId, capability, funding_source: decision.funding, allow_payg: decision.funding !== 'subscription', wallet_account_id: body.wallet_account_id || null, active_role: decision.role, active_context: body.active_context || null, paywall: decision.allowed ? null : { code: decision.code, recommendation: decision.recommendedAction, availableCredits: decision.availableCredits, usageEstimate: decision.usageEstimate } })
}
