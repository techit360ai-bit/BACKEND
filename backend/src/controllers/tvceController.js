import { accountEntitlement, adminCommercialConfig, adminTvceAnalytics, capabilityCatalog, conversionFunnel, estimateCredits, evaluateEntitlement, evaluatePaywall, freeTierUsage, fulfillPayment, nextBestAction, progressMeter, recordPaywallEvent, resumeWorkflow, saveWorkflow, updateAdminCommercialConfig, walletForecast } from '../services/tvceService.js'
import { createTvceCheckout } from '../services/tvceCheckoutService.js'

const body = req => req.body && typeof req.body === 'object' ? req.body : {}
const send = (res, result, success = 200) => result?.ok === false ? res.status(result.status || (result.error === 'workflow_not_found' || result.error === 'payment_not_found' ? 404 : 400)).json(result) : res.status(success).json(result)

export function capabilities(_req, res) { return res.json({ capabilities: capabilityCatalog() }) }
export function entitlements(req, res) { return res.json({ account: accountEntitlement(req.user.id), entitlements: capabilityCatalog().map(capability => evaluateEntitlement(req.user.id, { capability: capability.id })) }) }
export function evaluate(req, res) { return res.json(evaluateEntitlement(req.user.id, body(req))) }
export function paywall(req, res) { const result = evaluatePaywall(req.user.id, body(req)); void recordPaywallEvent(req.user.id, { capability: body(req).capability, role: body(req).role, eventType: result.paywall ? 'PAYWALL_VIEWED' : 'CAPABILITY_ALLOWED', metadata: { code: result.code } }); return res.status(result.allowed ? 200 : 402).json(result) }
export function paywallEvent(req, res) { return send(res, recordPaywallEvent(req.user.id, body(req)), 201) }
export function creditsEstimate(req, res) { return res.json(estimateCredits(req.user.id, body(req))) }
export function forecast(req, res) { return res.json(walletForecast(req.user.id)) }
export function nextAction(req, res) { return res.json(nextBestAction(req.user.id, body(req))) }
export function progress(req, res) { return res.json(progressMeter(req.user.id)) }
export function freeUsage(req, res) { return res.json({ usage: freeTierUsage(req.user.id) }) }
export function funnel(req, res) { return res.json(conversionFunnel(req.user.id, req.query.period)) }
export function adminAnalytics(req, res) { return res.json(adminTvceAnalytics(req.query.period || 'all', { days: req.query.days, from: req.query.from, to: req.query.to })) }
export function adminConfig(_req, res) { return res.json(adminCommercialConfig()) }
export function adminConfigUpdate(req, res) { return send(res, updateAdminCommercialConfig(req.user.id, body(req))) }
export function workflowSave(req, res) { return send(res, saveWorkflow(req.user.id, body(req)), 201) }
export function workflowResume(req, res) { return send(res, resumeWorkflow(req.user.id, req.params.workflowId, body(req))) }
export function paymentFulfill(req, res) { return send(res, fulfillPayment(req.user.id, req.params.paymentId, body(req))) }
export async function checkout(req, res) { const result = await createTvceCheckout(req.user.id, body(req)); return send(res, result, 201) }
