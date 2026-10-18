import { accountEntitlementAsync, adminCommercialConfigAsync, adminTvceAnalyticsAsync, capabilityCatalogAsync, conversionFunnelAsync, estimateCreditsAsync, evaluateEntitlementAsync, evaluatePaywallAsync, freeTierUsageAsync, nextBestActionAsync, progressMeterAsync, recordPaywallEventAsync, resumeWorkflowAsync, saveWorkflowAsync, updateAdminCommercialConfigAsync, walletForecastAsync } from '../services/tvceService.js'
import { createTvceCheckout } from '../services/tvceCheckoutService.js'
import { createOrganizationBudgetAsync } from '../services/organizationBudgetService.js'
import { listOrganizationEntitlements, saveOrganizationEntitlementAsync } from '../services/organizationEntitlementService.js'
import { approveOrganizationHackathonAsync } from '../services/domainService.js'
import { listOrganizationAbuseReviewsAsync, reviewOrganizationAbuseAsync } from '../services/organizationProgramService.js'
import { createWorkspaceTeamGrant } from '../services/workspaceTeamEntitlementService.js'
import { billingJobStatus, runBillingJobs } from '../services/billingJobsService.js'
import { providerAvailability } from '../services/billingProviderConfig.js'

const body = req => req.body && typeof req.body === 'object' ? req.body : {}
const send = (res, result, success = 200) => result?.ok === false ? res.status(result.status || (result.error === 'workflow_not_found' || result.error === 'payment_not_found' ? 404 : 400)).json(result) : res.status(success).json(result)

export async function capabilities(_req, res) { return res.json({ capabilities: await capabilityCatalogAsync() }) }
export async function entitlements(req, res) { const capabilities = await capabilityCatalogAsync(); const organizationId = req.query.organizationId || null; return res.json({ account: await accountEntitlementAsync(req.user.id), organizationId, entitlements: await Promise.all(capabilities.map(capability => evaluateEntitlementAsync(req.user.id, { capability: capability.id, organizationId }))) }) }
export async function evaluate(req, res) { return res.json(await evaluateEntitlementAsync(req.user.id, body(req))) }
export async function paywall(req, res) { const result = await evaluatePaywallAsync(req.user.id, body(req)); void recordPaywallEventAsync(req.user.id, { capability: body(req).capability, role: body(req).role, eventType: result.paywall ? 'PAYWALL_VIEWED' : 'CAPABILITY_ALLOWED', metadata: { code: result.code } }); return res.status(result.allowed ? 200 : 402).json(result) }
export async function paywallEvent(req, res) { return send(res, await recordPaywallEventAsync(req.user.id, body(req)), 201) }
export async function creditsEstimate(req, res) { return res.json(await estimateCreditsAsync(req.user.id, body(req))) }
export async function forecast(req, res) { return res.json(await walletForecastAsync(req.user.id)) }
export async function nextAction(req, res) { return res.json(await nextBestActionAsync(req.user.id, body(req))) }
export async function progress(req, res) { return res.json(await progressMeterAsync(req.user.id)) }
export async function freeUsage(req, res) { return res.json({ usage: await freeTierUsageAsync(req.user.id) }) }
export async function funnel(req, res) { return res.json(await conversionFunnelAsync(req.user.id, req.query.period)) }
export async function adminAnalytics(req, res) { return res.json(await adminTvceAnalyticsAsync(req.query.period || 'all', { days: req.query.days, from: req.query.from, to: req.query.to })) }
export async function adminConfig(_req, res) { return res.json(await adminCommercialConfigAsync()) }
export async function adminConfigUpdate(req, res) { return send(res, await updateAdminCommercialConfigAsync(req.user.id, body(req))) }
export async function adminOrganizationEntitlement(req, res) { return send(res, await saveOrganizationEntitlementAsync(req.user.id, body(req)), 201) }
export function adminOrganizationEntitlements(req, res) {
  const result = listOrganizationEntitlements({ organizationId: req.query.organizationId || null })
  return send(res, result)
}
export async function adminOrganizationBudget(req, res) { return send(res, await createOrganizationBudgetAsync(req.user.id, body(req)), 201) }
export async function adminOrganizationHackathonReview(req, res) { return send(res, await approveOrganizationHackathonAsync(req.user.id, req.params.hackathonId, body(req).decision, body(req).reason)) }
export async function adminOrganizationAbuseReviews(req, res) { return res.json(await listOrganizationAbuseReviewsAsync(req.user.id, req.query)) }
export async function adminOrganizationAbuseReview(req, res) { return send(res, await reviewOrganizationAbuseAsync(req.user.id, req.params.reviewId, body(req))) }
export async function workflowSave(req, res) { return send(res, await saveWorkflowAsync(req.user.id, body(req)), 201) }
export async function workflowResume(req, res) { return send(res, await resumeWorkflowAsync(req.user.id, req.params.workflowId, body(req))) }
export async function checkout(req, res) { const result = await createTvceCheckout(req.user.id, body(req)); return send(res, result, 201) }
export function checkoutProviders(_req, res) { return res.json({ providers: providerAvailability() }) }
export async function teamGrantCreate(req, res) { return send(res, await createWorkspaceTeamGrant(req.user.id, body(req)), 201) }
export async function billingJobsRun(req, res) { return send(res, await runBillingJobs(req.user.id), 201) }
export async function billingJobsStatus(_req, res) { return res.json(await billingJobStatus()) }
