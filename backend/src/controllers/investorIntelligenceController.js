import { authorizeCapability, auditCapabilityDecision } from '../services/capabilityAuthorization.js'
import { investorAdvisoryEvidence, investorDailyBrief, investorIntelligenceOverview, investorRiskSignals, investorStartupIntelligence } from '../services/investorIntelligenceService.js'
import { requestInvestorAdvisory } from '../services/aiRouterClient.js'

function guard(req, capability) {
  const decision = authorizeCapability(req.user.id, capability, { ...(req.user.activeContext || {}), role: 'investor', mfaAssertion: req.get('x-mfa-assertion') })
  auditCapabilityDecision(decision, req.user.id)
  return decision
}

function deny(res, decision) {
  const payment = ['active_subscription_required', 'credits_required', 'subscription_or_credits_required', 'plan_capability_not_included'].includes(decision.code)
  return res.status(payment ? 402 : 403).json({ error: decision.code, decision })
}

export function overview(req, res) {
  const decision = guard(req, 'investor.mentorship.intelligence')
  if (!decision.allowed) return deny(res, decision)
  return res.json(investorIntelligenceOverview(req.user.id))
}

export function startup(req, res) {
  const decision = guard(req, 'investor.mentorship.intelligence')
  if (!decision.allowed) return deny(res, decision)
  const result = investorStartupIntelligence(req.user.id, req.params.startupId)
  return result ? res.json(result) : res.status(404).json({ error: 'startup_not_authorized' })
}

export function changes(req, res) {
  const decision = guard(req, 'investor.mentorship.intelligence')
  if (!decision.allowed) return deny(res, decision)
  const result = investorIntelligenceOverview(req.user.id)
  return res.json({ changes: result.changes, generatedAt: result.generatedAt, deterministic: true })
}

export function portfolio(req, res) {
  const decision = guard(req, 'investor.portfolio.analytics')
  if (!decision.allowed) return deny(res, decision)
  const result = investorIntelligenceOverview(req.user.id)
  return res.json({ portfolio: result.portfolio, startups: result.startups, deterministic: true })
}

export function risks(req, res) {
  const decision = guard(req, 'investor.risk.monitor')
  if (!decision.allowed) return deny(res, decision)
  return res.json(investorRiskSignals(req.user.id))
}

export function brief(req, res) {
  const decision = guard(req, 'investor.mentorship.intelligence')
  if (!decision.allowed) return deny(res, decision)
  return res.json(investorDailyBrief(req.user.id))
}

export async function advisory(req, res) {
  const decision = guard(req, 'investor.ai.recommendations')
  if (!decision.allowed) return deny(res, decision)
  const scope = req.params.scope === 'portfolio' ? null : req.params.scope
  const evidence = investorAdvisoryEvidence(req.user.id, scope)
  const result = await requestInvestorAdvisory(req.user.token, evidence)
  return res.json({ advisory: result || null, evidence, deterministic: true, aiAvailable: Boolean(result), advisoryOnly: true })
}
