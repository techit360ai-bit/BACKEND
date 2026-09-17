import { authorizeCapability, auditCapabilityDecision } from '../services/capabilityAuthorization.js'
import { investorAdvisoryEvidence, investorAlerts, investorDailyBrief, investorIntelligenceOverview, investorReports, investorRiskSignals, investorStartupIntelligence } from '../services/investorIntelligenceService.js'
import { requestInvestorAdvisory, requestInvestorEvi } from '../services/aiRouterClient.js'

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

export function alerts(req, res) {
  const decision = guard(req, 'investor.risk.monitor')
  if (!decision.allowed) return deny(res, decision)
  return res.json(investorAlerts(req.user.id))
}

export function reports(req, res) {
  const decision = guard(req, 'investor.mentorship.intelligence')
  if (!decision.allowed) return deny(res, decision)
  return res.json(investorReports(req.user.id))
}

export function stream(req, res) {
  const decision = guard(req, 'investor.mentorship.intelligence')
  if (!decision.allowed) return deny(res, decision)
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  let closed = false
  const send = () => {
    if (closed) return
    const overview = investorIntelligenceOverview(req.user.id)
    res.write(`data: ${JSON.stringify({ ...overview, type: 'investor_intelligence_snapshot' })}\n\n`)
  }
  send()
  const timer = setInterval(send, 30_000)
  req.on('close', () => { closed = true; clearInterval(timer) })
}

export async function advisory(req, res) {
  const decision = guard(req, 'investor.ai.recommendations')
  if (!decision.allowed) return deny(res, decision)
  const scope = req.params.scope === 'portfolio' ? null : req.params.scope
  const evidence = investorAdvisoryEvidence(req.user.id, scope)
  const result = await requestInvestorAdvisory(req.user.token, evidence)
  return res.json({ advisory: result || null, evidence, deterministic: true, aiAvailable: Boolean(result), advisoryOnly: true })
}

export async function evi(req, res) {
  const decision = guard(req, 'investor.intelligence.view')
  if (!decision.allowed) return deny(res, decision)
  const evidence = investorAdvisoryEvidence(req.user.id, req.params.startupId)
  if (!evidence.startups.length) return res.status(404).json({ error: 'startup_not_authorized' })
  const result = await requestInvestorEvi(req.user.token, req.params.startupId, evidence.startups[0])
  return result ? res.json({ evi: result, deterministicEvidence: evidence.startups[0] }) : res.status(503).json({ error: 'evi_unavailable', deterministicEvidence: evidence.startups[0] })
}
