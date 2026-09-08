import { accountEntitlementAsync, adminCommercialConfig, adminTvceAnalytics, capabilityCatalogAsync, conversionFunnel, estimateCredits, evaluateEntitlementAsync, evaluatePaywallAsync, freeTierUsage, fulfillPaymentAsync, nextBestAction, progressMeter, recordPaywallEventAsync, resumeWorkflowAsync, saveWorkflowAsync, updateAdminCommercialConfig, walletForecast } from '../services/tvceService.js'
import { createTvceCheckout } from '../services/tvceCheckoutService.js'

const body = req => req.body && typeof req.body === 'object' ? req.body : {}
const send = (res, result, success = 200) => result?.ok === false ? res.status(result.status || (result.error === 'workflow_not_found' || result.error === 'payment_not_found' ? 404 : 400)).json(result) : res.status(success).json(result)

export async function capabilities(_req, res) { return res.json({ capabilities: await capabilityCatalogAsync() }) }
export async function entitlements(req, res) { const capabilities = await capabilityCatalogAsync(); return res.json({ account: await accountEntitlementAsync(req.user.id), entitlements: await Promise.all(capabilities.map(capability => evaluateEntitlementAsync(req.user.id, { capability: capability.id }))) }) }
export async function evaluate(req, res) { return res.json(await evaluateEntitlementAsync(req.user.id, body(req))) }
export async function paywall(req, res) { const result = await evaluatePaywallAsync(req.user.id, body(req)); void recordPaywallEventAsync(req.user.id, { capability: body(req).capability, role: body(req).role, eventType: result.paywall ? 'PAYWALL_VIEWED' : 'CAPABILITY_ALLOWED', metadata: { code: result.code } }); return res.status(result.allowed ? 200 : 402).json(result) }
export async function paywallEvent(req, res) { return send(res, await recordPaywallEventAsync(req.user.id, body(req)), 201) }
export function creditsEstimate(req, res) { return res.json(estimateCredits(req.user.id, body(req))) }
export function forecast(req, res) { return res.json(walletForecast(req.user.id)) }
export function nextAction(req, res) { return res.json(nextBestAction(req.user.id, body(req))) }
export function progress(req, res) { return res.json(progressMeter(req.user.id)) }
export function freeUsage(req, res) { return res.json({ usage: freeTierUsage(req.user.id) }) }
export function funnel(req, res) { return res.json(conversionFunnel(req.user.id, req.query.period)) }
export function adminAnalytics(req, res) { return res.json(adminTvceAnalytics(req.query.period || 'all', { days: req.query.days, from: req.query.from, to: req.query.to })) }
export function adminConfig(_req, res) { return res.json(adminCommercialConfig()) }
export function adminConfigUpdate(req, res) { return send(res, updateAdminCommercialConfig(req.user.id, body(req))) }
export async function workflowSave(req, res) { return send(res, await saveWorkflowAsync(req.user.id, body(req)), 201) }
export async function workflowResume(req, res) { return send(res, await resumeWorkflowAsync(req.user.id, req.params.workflowId, body(req))) }
export async function paymentFulfill(req, res) { return send(res, await fulfillPaymentAsync(req.user.id, req.params.paymentId, body(req))) }
export async function checkout(req, res) { const result = await createTvceCheckout(req.user.id, body(req)); return send(res, result, 201) }
