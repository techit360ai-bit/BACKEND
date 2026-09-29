import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { CAPABILITY_POLICIES, authorizeCapability, availableCredits, subscriptionEntitlement } from './capabilityAuthorization.js'
import commercialDefaults from '../../../config/tvce-commercial.json' with { type: 'json' }
import { fulfillPaymentPostgres, loadFinanceSnapshotPostgres, recordPaywallEventPostgres, resumeWorkflowPostgres, saveWorkflowPostgres, financePostgresEnabled } from '../repositories/financeRepository.js'
import { evaluateOrganizationEntitlement } from './organizationEntitlementService.js'
import { workspaceTeamGrantFor } from './workspaceTeamEntitlementService.js'
import { listDefaultRateCards } from './unitEconomicsService.js'
import { providerAvailability } from './billingProviderConfig.js'

const configuredDefaults = () => {
  try { return process.env.TVCE_COMMERCIAL_CONFIG_JSON ? JSON.parse(process.env.TVCE_COMMERCIAL_CONFIG_JSON) : commercialDefaults } catch { return commercialDefaults }
}
export const TVCE_FREE_QUOTAS = Object.freeze({ ...(configuredDefaults().freeQuotas || {}) })
const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const text = (value, fallback = '') => typeof value === 'string' ? value.trim() : fallback

export const TVCE_CAPABILITIES = Object.freeze([
  { id: 'BASIC_AI_ACTION', category: 'platform', description: 'Basic AI action', requiredRole: null, freeAccess: true, subscriptionAccess: true, creditAccess: true, metering: 'runtime', workflowStage: 'execute' },
  { id: 'IDEA_DIAGNOSTICS_BASIC', category: 'incubation', description: 'Basic idea diagnosis', requiredRole: null, freeAccess: true, subscriptionAccess: true, creditAccess: true, metering: 'runtime', workflowStage: 'discover' },
  { id: 'CUSTOMER_VALIDATION_BASIC', category: 'validation', description: 'Basic customer validation', requiredRole: 'founder', freeAccess: true, subscriptionAccess: true, creditAccess: true, metering: 'runtime', workflowStage: 'validate' },
  { id: 'MVP_PLANNING_BASIC', category: 'execution', description: 'Basic MVP planning', requiredRole: 'founder', freeAccess: true, subscriptionAccess: true, creditAccess: true, metering: 'runtime', workflowStage: 'build' },
  { id: 'GSIS_BASIC', category: 'intelligence', description: 'Basic startup intelligence score', requiredRole: 'founder', freeAccess: true, subscriptionAccess: true, creditAccess: true, metering: 'runtime', workflowStage: 'understand' },
  { id: 'STARTUP_HEALTH_BASIC', category: 'intelligence', description: 'Basic startup health', requiredRole: 'founder', freeAccess: true, subscriptionAccess: true, creditAccess: true, metering: 'runtime', workflowStage: 'monitor' },
  { id: 'IDEA_DIAGNOSTICS_ADVANCED', category: 'incubation', description: 'Advanced idea diagnosis', requiredRole: 'founder', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'understand' },
  { id: 'CUSTOMER_VALIDATION_ADVANCED', category: 'validation', description: 'Advanced customer validation analysis', requiredRole: 'founder', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'validate' },
  { id: 'WORKSPACE_COPILOT', category: 'workspace', description: 'Workspace Copilot', requiredRole: 'founder', freeAccess: true, subscriptionAccess: true, creditAccess: true, metering: 'runtime', workflowStage: 'build' },
  { id: 'ADVANCED_WORKSPACE_AI', category: 'workspace', description: 'Advanced workspace AI', requiredRole: 'founder', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'build' },
  { id: 'INVESTOR_PUBLIC_DISCOVERY', category: 'investor', description: 'Public startup discovery and basic profiles', requiredRole: 'investor', authorizationCapability: 'investment.opportunity.view', freeAccess: true, subscriptionAccess: true, creditAccess: false, metering: 'none', workflowStage: 'discover' },
  { id: 'INVESTOR_WATCHLIST', category: 'investor', description: 'Limited startup watchlists', requiredRole: 'investor', authorizationCapability: 'investment.opportunity.view', freeAccess: true, subscriptionAccess: true, creditAccess: false, metering: 'none', workflowStage: 'discover' },
  { id: 'INVESTOR_INTELLIGENCE', category: 'investor', description: 'Investor intelligence', requiredRole: 'investor', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'decide' },
  { id: 'DUE_DILIGENCE_INTELLIGENCE', category: 'investor', description: 'Due diligence intelligence', requiredRole: 'investor', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'due_diligence' },
  { id: 'PORTFOLIO_INTELLIGENCE', category: 'investor', description: 'Portfolio intelligence', requiredRole: 'investor', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'monitor' },
  { id: 'ORGANIZATION_PROFILE', category: 'organization', description: 'Organization profile and verification', requiredRole: 'organization', authorizationCapability: 'organization.profile.manage', freeAccess: true, subscriptionAccess: true, creditAccess: false, metering: 'none', workflowStage: 'setup' },
  { id: 'ORGANIZATION_BASIC_DASHBOARD', category: 'organization', description: 'Basic organization dashboard and visibility', requiredRole: 'organization', authorizationCapability: 'organization.profile.manage', freeAccess: true, subscriptionAccess: true, creditAccess: false, metering: 'none', workflowStage: 'understand' },
  { id: 'ORGANIZATION_PROGRAM_SETUP', category: 'organization', description: 'One basic program or cohort setup', requiredRole: 'organization', authorizationCapability: 'organization.profile.manage', freeAccess: true, subscriptionAccess: true, creditAccess: false, metering: 'none', workflowStage: 'setup' },
  { id: 'ORGANIZATION_BASIC_COHORT', category: 'organization', description: 'Basic cohort and startup visibility', requiredRole: 'organization', authorizationCapability: 'organization.profile.manage', freeAccess: true, subscriptionAccess: true, creditAccess: false, metering: 'none', workflowStage: 'monitor' },
  { id: 'ORGANIZATION_BASIC_REPORTING', category: 'organization', description: 'Basic organization reporting', requiredRole: 'organization', authorizationCapability: 'organization.profile.manage', freeAccess: true, subscriptionAccess: true, creditAccess: false, metering: 'none', workflowStage: 'monitor' },
  { id: 'ORGANIZATION_HACKATHON_BASIC', category: 'organization', description: 'Basic organization-owned hackathon hosting', requiredRole: 'organization', authorizationCapability: 'organization.profile.manage', freeAccess: true, subscriptionAccess: true, creditAccess: false, metering: 'none', workflowStage: 'setup' },
  { id: 'ORGANIZATION_MONITORING', category: 'organization', description: 'Advanced organization monitoring', requiredRole: 'organization', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'monitor' },
  { id: 'COHORT_INTELLIGENCE', category: 'organization', description: 'Cohort intelligence', requiredRole: 'organization', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'monitor' },
  { id: 'MENTOR_INTELLIGENCE', category: 'organization', description: 'Mentor intelligence', requiredRole: 'organization', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'monitor' },
  { id: 'ORGANIZATION_HACKATHON_ADVANCED', category: 'organization', description: 'Advanced judging and AI evaluation for hackathons', requiredRole: 'organization', authorizationCapability: 'organization.analytics', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'monitor' },
  { id: 'ORGANIZATION_MANAGED_HACKATHON', category: 'organization', description: 'TechIT managed hackathon operations and support', requiredRole: 'organization', authorizationCapability: 'institutional.analytics', freeAccess: false, subscriptionAccess: true, creditAccess: false, funding: 'subscription', metering: 'none', workflowStage: 'execute' },
  { id: 'ORGANIZATION_PROGRAM_ANALYTICS', category: 'organization', description: 'Program-level analytics and outcomes', requiredRole: 'organization', authorizationCapability: 'organization.analytics', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'monitor' },
  { id: 'ORGANIZATION_INTERVENTIONS', category: 'organization', description: 'Evidence-based intervention recommendations', requiredRole: 'organization', authorizationCapability: 'organization.analytics', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'monitor' },
  { id: 'ORGANIZATION_REPORT_EXPORT', category: 'organization', description: 'Exportable program and impact reports', requiredRole: 'organization', authorizationCapability: 'organization.analytics', freeAccess: false, subscriptionAccess: true, creditAccess: true, funding: 'subscription_or_credits', metering: 'runtime', workflowStage: 'monitor' },
  { id: 'ORGANIZATION_SPONSOR_MANAGEMENT', category: 'organization', description: 'Sponsor packages, benefits, and event reporting', requiredRole: 'organization', authorizationCapability: 'institutional.analytics', freeAccess: false, subscriptionAccess: true, creditAccess: false, funding: 'subscription', metering: 'none', workflowStage: 'setup' },
  { id: 'ORGANIZATION_INTEGRATIONS', category: 'organization', description: 'Organization API and integrations', requiredRole: 'organization', authorizationCapability: 'institutional.analytics', freeAccess: false, subscriptionAccess: true, creditAccess: false, funding: 'subscription', metering: 'none', workflowStage: 'execute' },
  { id: 'ORGANIZATION_WHITE_LABEL', category: 'organization', description: 'Institutional branding and white-label delivery', requiredRole: 'organization', authorizationCapability: 'institutional.analytics', freeAccess: false, subscriptionAccess: true, creditAccess: false, funding: 'subscription', metering: 'none', workflowStage: 'setup' },
  { id: 'ORGANIZATION_SUPPORT_WORKFLOW', category: 'organization', description: 'Institutional support workflow and SLA management', requiredRole: 'organization', authorizationCapability: 'institutional.analytics', freeAccess: false, subscriptionAccess: true, creditAccess: false, funding: 'subscription', metering: 'none', workflowStage: 'execute' },
])

const catalogById = id => TVCE_CAPABILITIES.find(item => item.id === id) || null
const catalogFor = capability => catalogById(capability) || TVCE_CAPABILITIES.find(item => item.id === capability.replace(/\./g, '_').toUpperCase()) || null

function accountEntitlementFor(db, userId) {
  const direct = collection(db, 'accountEntitlements').find(row => row.userId === userId && ['active', 'trialing', 'grace_period'].includes(row.status))
  const subscription = collection(db, 'subscriptions').find(row => row.userId === userId && ['active', 'trialing', 'grace_period'].includes(row.status))
  const purchase = collection(db, 'creditLedger').find(row => row.userId === userId && ['credit_purchase', 'credits_purchased', 'subscription_purchase'].includes(row.type) && Number(row.deltaCredits ?? row.credits ?? 0) > 0)
  return { active: Boolean(direct || subscription || purchase), source: direct?.source || (subscription ? 'subscription' : purchase ? 'credits' : null), status: direct?.status || subscription?.status || (purchase ? 'active' : 'none'), purchasedAt: direct?.createdAt || subscription?.createdAt || purchase?.createdAt || null }
}

function roleFor(db, userId, inputRole) {
  const profile = collection(db, 'profiles').find(row => row.id === userId)
  const context = collection(db, 'activeContexts').find(row => row.userId === userId && row.status === 'active')
  return text(inputRole || context?.role || profile?.activeRole || profile?.role || 'explorer').toLowerCase().replace('organisation', 'organization')
}

function valueFor(capability, decision, input) {
  const catalog = decision?.policy || catalogFor(capability)
  const outcomes = catalog?.valueStatement ? [catalog.valueStatement] : ['Continue the current workflow with the required capability.']
  return { title: input.goal || catalog?.description || capability, outcomes, workflowStage: input.workflowStage || catalog?.workflowStage || 'execute' }
}

function freeUsageFor(db, userId, capability, now = Date.now()) {
  const monthStart = new Date(now)
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
  const from = monthStart.getTime()
  const consumptions = collection(db, 'capabilityConsumptions').filter(row => row.userId === userId && row.capability === capability && row.fundingSource === 'platform_subsidy' && new Date(row.createdAt || 0).getTime() >= from && ['reserved', 'settled'].includes(row.status))
  const analytics = collection(db, 'capabilityAnalytics').filter(row => row.userId === userId && row.capability === capability && row.eventType === 'capability_completed' && new Date(row.createdAt || 0).getTime() >= from)
  return Math.max(consumptions.length, analytics.length)
}

function quotaFor(db, capability) {
  return Number(db.tvceConfig?.freeQuotas?.[capability] ?? configuredDefaults().freeQuotas?.[capability] ?? 0) || 0
}

function commercialFor(db, capability) {
  const merged = { ...(configuredDefaults().capabilities?.[capability] || {}), ...(db.tvceConfig?.capabilities?.[capability] || {}) }
  // Older deployments may retain pricing fields. TVCE never returns or uses
  // those fields; pricing belongs to billing packages and runtime metering.
  delete merged.creditCost
  delete merged.credits
  delete merged.requiredCredits
  return merged
}

export function freeTierUsage(userId) {
  const db = readAuthorityDb()
  return Object.keys(TVCE_FREE_QUOTAS).map(capability => { const quota = quotaFor(db, capability); const used = freeUsageFor(db, userId, capability); return { capability, used, quota, remaining: Math.max(0, quota - used), period: 'calendar_month' } })
}

export function adminCommercialConfig() {
  const db = readAuthorityDb()
  return {
    freeQuotas: Object.fromEntries(Object.keys(TVCE_FREE_QUOTAS).map(capability => [capability, quotaFor(db, capability)])),
    capabilities: capabilityCatalog(),
    plans: collection(db, 'billingPlans').map(row => ({ ...row })),
    creditPackages: collection(db, 'creditPackages').map(row => ({ ...row })),
    rateCards: collection(db, 'rateCards').length ? collection(db, 'rateCards').map(row => ({ ...row })) : listDefaultRateCards(),
    geoPricingProfiles: collection(db, 'geoPricingProfiles').map(row => ({ ...row })),
    providers: {
      ...providerAvailability(),
      checkoutRedirects: Boolean(process.env.BILLING_SUCCESS_URL && process.env.BILLING_CANCEL_URL),
    },
  }
}

export function updateAdminCommercialConfig(adminId, input = {}) {
  return updateAuthorityDb(db => {
    if (input.freeQuotas && typeof input.freeQuotas === 'object') {
      for (const [capability, value] of Object.entries(input.freeQuotas)) {
        if (!(capability in TVCE_FREE_QUOTAS)) continue
        const quota = Number(value)
        if (Number.isFinite(quota) && quota >= 0 && quota <= 100000) { db.tvceConfig = db.tvceConfig || {}; db.tvceConfig.freeQuotas = db.tvceConfig.freeQuotas || {}; db.tvceConfig.freeQuotas[capability] = Math.floor(quota) }
      }
    }
    if (Array.isArray(input.plans)) db.billingPlans = input.plans.slice(0, 100).map(row => ({ ...row, updatedAt: nowIso() }))
    if (Array.isArray(input.creditPackages)) db.creditPackages = input.creditPackages.slice(0, 100).map(row => ({ ...row, updatedAt: nowIso() }))
    if (Array.isArray(input.rateCards)) db.rateCards = input.rateCards.slice(0, 500).map(row => ({ ...row, updatedAt: nowIso(), status: row.status || 'active' }))
    if (Array.isArray(input.geoPricingProfiles)) db.geoPricingProfiles = input.geoPricingProfiles.slice(0, 300).map(row => ({ ...row, updatedAt: nowIso(), status: row.status || 'active' }))
    if (input.capabilities && typeof input.capabilities === 'object') {
      db.tvceConfig = db.tvceConfig || {}; db.tvceConfig.capabilities = db.tvceConfig.capabilities || {}
      for (const [capability, patch] of Object.entries(input.capabilities)) {
        if (!TVCE_CAPABILITIES.some(item => item.id === capability) || !patch || typeof patch !== 'object') continue
        const next = { ...(db.tvceConfig.capabilities[capability] || {}) }
        for (const field of ['valueStatement', 'blockedMessage']) if (typeof patch[field] === 'string' && patch[field].trim()) next[field] = patch[field].trim().slice(0, 500)
        db.tvceConfig.capabilities[capability] = next
      }
    }
    collection(db, 'verificationAuditLogs').push({ id: createId('tvce_admin_config'), actorId: adminId, action: 'tvce_commercial_config_updated', metadata: { freeQuotas: input.freeQuotas ? Object.keys(input.freeQuotas) : [], plans: Array.isArray(input.plans) ? input.plans.length : undefined, creditPackages: Array.isArray(input.creditPackages) ? input.creditPackages.length : undefined, rateCards: Array.isArray(input.rateCards) ? input.rateCards.length : undefined, geoPricingProfiles: Array.isArray(input.geoPricingProfiles) ? input.geoPricingProfiles.length : undefined }, createdAt: nowIso() })
    return { ok: true, config: adminCommercialConfig() }
  })
}

export function capabilityCatalog() {
  const db = readAuthorityDb()
  return TVCE_CAPABILITIES.map(item => ({ ...item, ...commercialFor(db, item.id), freeQuota: commercialFor(db, item.id).freeQuota ?? (quotaFor(db, item.id) || undefined), policy: CAPABILITY_POLICIES[item.authorizationCapability || item.id] || null }))
}

export async function capabilityCatalogAsync() {
  if (process.env.FINANCE_READ_SOURCE !== 'postgres') return capabilityCatalog()
  try {
    const db = await loadFinanceSnapshotPostgres(null)
    return TVCE_CAPABILITIES.map(item => ({ ...item, ...commercialFor(db, item.id), freeQuota: commercialFor(db, item.id).freeQuota ?? (quotaFor(db, item.id) || undefined), policy: CAPABILITY_POLICIES[item.authorizationCapability || item.id] || null }))
  } catch (error) {
    if (process.env.FINANCE_READ_FALLBACK_SQLITE === 'false') throw error
    return capabilityCatalog()
  }
}

export function accountEntitlement(userId) { return accountEntitlementFor(readAuthorityDb(), userId) }

function evaluateEntitlementFromDb(userId, input = {}, db) {
  const capability = text(input.capability || input.operation || '')
  const catalog = catalogFor(capability)
  const commercial = commercialFor(db, capability)
  const effectiveCatalog = catalog ? { ...catalog, ...commercial, freeQuota: commercial.freeQuota ?? (quotaFor(db, catalog.id) || undefined) } : null
  const role = roleFor(db, userId, input.role)
  const baseCapability = effectiveCatalog?.authorizationCapability || (effectiveCatalog?.requiredRole === 'investor' ? 'investor.intelligence.view' : effectiveCatalog?.requiredRole === 'organization' ? 'organization.analytics' : null)
  const decision = baseCapability
    ? authorizeCapability(userId, baseCapability, { role, organizationId: input.organizationId, workspaceId: input.workspaceId }, db)
    : effectiveCatalog?.requiredRole === 'founder' && role !== 'founder'
      ? { allowed: false, code: 'role_required', capability }
      : effectiveCatalog ? { allowed: true, code: 'allowed', capability, funding: effectiveCatalog.metering === 'runtime' ? 'runtime' : 'none', metering: effectiveCatalog.metering || 'none', policy: effectiveCatalog } : { allowed: false, code: 'unknown_capability', capability }
  const organizationDecision = effectiveCatalog?.category === 'organization' && input.organizationId
    ? evaluateOrganizationEntitlement(input.organizationId, catalog?.id || capability, { db, consume: Boolean(input.consume) })
    : null
  const account = accountEntitlementFor(db, userId)
  const subscription = subscriptionEntitlement(db, userId)
  const teamGrant = role === 'collaborator' && input.workspaceId ? workspaceTeamGrantFor(userId, input.workspaceId, capability, db) : null
  const credits = availableCredits(db, userId)
  const usageEstimate = Math.max(0, number(input.estimatedCredits ?? input.estimated_credits))
  const freeQuota = effectiveCatalog?.freeQuota || null
  const freeUsage = freeQuota && catalog ? freeUsageFor(db, userId, catalog.id) : 0
  const freeQuotaAvailable = Boolean(effectiveCatalog?.freeAccess && (!freeQuota || freeUsage < freeQuota))
  const funding = effectiveCatalog?.funding || decision.funding || null
  const metered = effectiveCatalog?.metering === 'runtime' || Boolean(funding)
  const fundingDenied = new Set(['active_subscription_required', 'credits_required', 'subscription_or_credits_required', 'plan_capability_not_included'])
  const organizationFundingOverride = Boolean(organizationDecision?.allowed && !decision.allowed && fundingDenied.has(decision.code))
  let code = organizationDecision && !organizationDecision.allowed && fundingDenied.has(decision.code)
    ? organizationDecision.code
    : organizationFundingOverride ? 'allowed' : decision.allowed ? 'allowed' : decision.code
  if (!organizationFundingOverride && !(organizationDecision && !organizationDecision.allowed && fundingDenied.has(decision.code))) {
    if (freeQuotaAvailable) code = 'allowed'
    else if (effectiveCatalog?.freeAccess && freeQuota && !freeQuotaAvailable && !subscription.active && credits <= 0 && usageEstimate === 0) code = 'free_allowance_exhausted'
    else if (funding === 'subscription' && !subscription.active) code = 'active_subscription_required'
    else if (['credits', 'subscription_or_credits'].includes(funding) && !subscription.active && credits <= 0) code = 'credits_required'
    else if (usageEstimate > 0 && !subscription.active && credits < usageEstimate) code = 'insufficient_credits'
  }
  if (teamGrant && ['credits_required', 'active_subscription_required', 'subscription_or_credits_required', 'plan_capability_not_included'].includes(code)) code = 'allowed'
  const allowed = code === 'allowed'
  return { allowed, code, capability, role, accountEntitlement: account, subscription, teamGrant, availableCredits: credits, usageEstimate: usageEstimate || null, funding: teamGrant ? 'subscription' : organizationFundingOverride ? 'organization' : funding || 'none', metering: effectiveCatalog?.metering || decision.metering || 'none', freeQuota, freeUsage, freeRemaining: freeQuota ? Math.max(0, freeQuota - freeUsage) : null, organizationEntitlement: organizationDecision?.entitlement || null, organizationDecision, recommendedAction: subscription.active || teamGrant ? 'SUBSCRIPTION' : organizationDecision?.code === 'organization_funding_required' ? 'ORGANIZATION_PROGRAM_PASS' : metered ? 'CREDITS_OR_SUBSCRIPTION' : 'CONTINUE', alternativeAction: metered ? 'CREDITS_OR_SUBSCRIPTION' : null, value: valueFor(capability, { ...decision, policy: effectiveCatalog }, input), decision, policy: effectiveCatalog || decision.policy || null }
}

export function evaluateEntitlement(userId, input = {}) { return evaluateEntitlementFromDb(userId, input, readAuthorityDb()) }

export async function accountEntitlementAsync(userId) {
  if (process.env.FINANCE_READ_SOURCE !== 'postgres') return accountEntitlement(userId)
  try { const db = await loadFinanceSnapshotPostgres(userId); return accountEntitlementFor(db, userId) } catch (error) {
    console.error(JSON.stringify({ event: 'finance_postgres_read_failed', operation: 'account_entitlement', error: error.message }))
    if (process.env.FINANCE_READ_FALLBACK_SQLITE === 'false') throw error
    return accountEntitlement(userId)
  }
}

export async function evaluateEntitlementAsync(userId, input = {}) {
  if (process.env.FINANCE_READ_SOURCE !== 'postgres') return evaluateEntitlement(userId, input)
  try { return evaluateEntitlementFromDb(userId, input, await loadFinanceSnapshotPostgres(userId)) } catch (error) {
    console.error(JSON.stringify({ event: 'finance_postgres_read_failed', operation: 'evaluate_entitlement', error: error.message }))
    if (process.env.FINANCE_READ_FALLBACK_SQLITE === 'false') throw error
    return evaluateEntitlement(userId, input)
  }
}

export function evaluatePaywall(userId, input = {}) {
  const result = evaluateEntitlement(userId, input)
  if (result.allowed) return { ...result, paywall: false }
  const db = readAuthorityDb()
  const hits = collection(db, 'paywallEvents').filter(row => row.userId === userId && row.capability === result.capability)
  const repeated = hits.length >= 2
  const recommendation = repeated || result.role === 'investor' || result.role === 'organization' ? 'SUBSCRIPTION' : result.recommendedAction
  return { ...result, paywall: true, recommendation, usageEstimateRequired: result.metering === 'runtime', reason: result.code, nextAction: result.value?.workflowStage ? `Continue ${result.value.workflowStage}` : 'Continue workflow' }
}

export async function evaluatePaywallAsync(userId, input = {}) {
  if (process.env.FINANCE_READ_SOURCE !== 'postgres') return evaluatePaywall(userId, input)
  const result = await evaluateEntitlementAsync(userId, input)
  if (result.allowed) return { ...result, paywall: false }
  try {
    const db = await loadFinanceSnapshotPostgres(userId)
    const hits = collection(db, 'paywallEvents').filter(row => row.userId === userId && row.capability === result.capability)
    const repeated = hits.length >= 2
    const recommendation = repeated || result.role === 'investor' || result.role === 'organization' ? 'SUBSCRIPTION' : result.recommendedAction
    return { ...result, paywall: true, recommendation, usageEstimateRequired: result.metering === 'runtime', reason: result.code, nextAction: result.value?.workflowStage ? `Continue ${result.value.workflowStage}` : 'Continue workflow' }
  } catch (error) {
    if (process.env.FINANCE_READ_FALLBACK_SQLITE === 'false') throw error
    return evaluatePaywall(userId, input)
  }
}

export function recordPaywallEvent(userId, input = {}) {
  return updateAuthorityDb(db => {
    const event = { id: createId('paywall'), userId, capability: text(input.capability), eventType: text(input.eventType || 'PAYWALL_VIEWED'), role: roleFor(db, userId, input.role), metadata: input.metadata || {}, createdAt: nowIso() }
    collection(db, 'paywallEvents').push(event)
    return { ok: true, event }
  })
}

export async function recordPaywallEventAsync(userId, input = {}) {
  if (process.env.FINANCE_WRITE_SOURCE !== 'postgres') return recordPaywallEvent(userId, input)
  try { return await recordPaywallEventPostgres({ userId, capability: text(input.capability), eventType: text(input.eventType || 'PAYWALL_VIEWED'), role: text(input.role), metadata: input.metadata || {} }) } catch (error) {
    if (process.env.FINANCE_WRITE_FALLBACK_SQLITE === 'false') return { ok: false, error: 'finance_write_temporarily_unavailable' }
    return recordPaywallEvent(userId, input)
  }
}

export function estimateCredits(userId, input = {}) {
  const items = Array.isArray(input.actions) ? input.actions : [input]
  const estimate = items.reduce((sum, item) => sum + Math.max(0, number(item.estimatedCredits ?? item.estimated_credits)), 0)
  const available = availableCredits(readAuthorityDb(), userId)
  return { userId, estimatedCredits: estimate, actionCount: items.length, isEstimate: true, source: 'runtime_usage_meter', availableCredits: available, covered: estimate > 0 ? available >= estimate : null, estimateProvided: estimate > 0 }
}

export function walletForecast(userId) {
  const db = readAuthorityDb(); const available = availableCredits(db, userId)
  const workflows = collection(db, 'workflowSnapshots').filter(row => row.userId === userId && ['pending', 'active'].includes(row.status))
  const projected = workflows.reduce((sum, row) => sum + number(row.estimatedCredits), 0)
  return { availableCredits: available, workflows: workflows.map(row => ({ id: row.id, name: row.name, estimatedCredits: number(row.estimatedCredits), status: row.status })), projectedRequirement: projected, shortfall: Math.max(0, projected - available), covered: available >= projected, isEstimate: true }
}

export function progressMeter(userId) {
  const db = readAuthorityDb()
  const owned = name => collection(db, name).filter(row => row.userId === userId || row.ownerId === userId || row.createdBy === userId)
  const ideas = owned('ventureIntakes').length + owned('projects').length
  const validation = owned('validationSessions').length + owned('customerValidationSessions').length + owned('customerResponses').length
  const execution = owned('workspaces').length + owned('workspaceTasks').filter(row => ['completed', 'done'].includes(row.status)).length
  const investor = owned('investorIntelligenceSnapshots').length + owned('dealRooms').length
  const score = (value, denominator) => Math.max(0, Math.min(100, Math.round((value / denominator) * 100)))
  const meter = { ideaClarity: score(ideas, 2), validation: score(validation, 5), executionReadiness: score(execution, 5), investorReadiness: score(investor, 3) }
  const weakest = Object.entries(meter).sort((a, b) => a[1] - b[1])[0]
  return { meter, strongestOpportunity: weakest ? weakest[0] : 'ideaClarity', generatedAt: nowIso() }
}

export function conversionFunnel(userId, period = 'all') {
  const db = readAuthorityDb(); const since = period === '30d' ? Date.now() - 30 * 86400000 : 0
  const events = collection(db, 'paywallEvents').filter(row => row.userId === userId && new Date(row.createdAt || 0).getTime() >= since)
  const count = type => events.filter(row => row.eventType === type).length
  const stages = ['PAYWALL_VIEWED', 'VALUE_EXPLANATION_VIEWED', 'CREDIT_OPTION_SELECTED', 'SUBSCRIPTION_OPTION_SELECTED', 'CHECKOUT_STARTED', 'PAYMENT_SUCCESS', 'WORKFLOW_RESUMED', 'OUTCOME_DELIVERED']
  return { period, stages: stages.map(stage => ({ stage, count: count(stage) })), totalEvents: events.length, capabilities: [...new Set(events.map(row => row.capability).filter(Boolean))] }
}

// Admin-only aggregate view over persisted TVCE and billing records. Monetary
// values are returned in the provider's stored minor-unit convention and are
// never inferred from mocked UI data.
export function adminTvceAnalytics(period = 'all', options = {}) {
  const db = readAuthorityDb()
  const days = Number(options.days || (period.endsWith('d') ? period.slice(0, -1) : 0))
  const since = days > 0 ? Date.now() - days * 86400000 : options.from ? new Date(options.from).getTime() : 0
  const until = options.to ? new Date(options.to).getTime() : Date.now()
  const inPeriod = row => { const timestamp = new Date(row.createdAt || row.updatedAt || 0).getTime(); return timestamp >= since && timestamp <= until }
  const payments = collection(db, 'paymentIntents').filter(row => row.status === 'successful' && inPeriod(row))
  const ledger = collection(db, 'creditLedger').filter(inPeriod)
  const subscriptions = collection(db, 'subscriptions').filter(row => ['active', 'trialing', 'grace_period'].includes(String(row.status || '').toLowerCase()))
  const entitlements = collection(db, 'accountEntitlements').filter(row => ['active', 'trialing', 'grace_period'].includes(String(row.status || '').toLowerCase()))
  const paywalls = collection(db, 'paywallEvents').filter(inPeriod)
  const webhookEvents = collection(db, 'billingWebhookEvents').filter(inPeriod)
  const workflows = collection(db, 'workflowSnapshots').filter(inPeriod)
  const usageEvents = collection(db, 'usageEvents').filter(inPeriod)
  const paidUsers = new Set([...payments, ...entitlements].map(row => row.userId).filter(Boolean))
  const creditBuyers = new Set(ledger.filter(row => ['credit_purchase', 'credits_purchased'].includes(row.type) && number(row.deltaCredits ?? row.credits) > 0).map(row => row.userId).filter(Boolean))
  const subscriptionUsers = new Set(subscriptions.map(row => row.userId).filter(Boolean))
  const funnelStages = ['PAYWALL_VIEWED', 'VALUE_EXPLANATION_VIEWED', 'CREDIT_OPTION_SELECTED', 'SUBSCRIPTION_OPTION_SELECTED', 'CHECKOUT_STARTED', 'PAYMENT_SUCCESS', 'WORKFLOW_RESUMED', 'OUTCOME_DELIVERED']
  const eventCount = type => paywalls.filter(row => row.eventType === type).length
  const capabilityMap = new Map()
  for (const row of paywalls) {
    const key = row.capability || 'unknown'
    const item = capabilityMap.get(key) || { capability: key, paywallViews: 0, paymentSuccesses: 0, workflowResumes: 0, conversionRate: 0 }
    if (row.eventType === 'PAYWALL_VIEWED') item.paywallViews += 1
    if (row.eventType === 'PAYMENT_SUCCESS') item.paymentSuccesses += 1
    if (row.eventType === 'WORKFLOW_RESUMED') item.workflowResumes += 1
    capabilityMap.set(key, item)
  }
  const byRole = new Map()
  for (const row of paywalls) {
    const role = row.role || 'unknown'
    const item = byRole.get(role) || { role, paywallViews: 0, paymentSuccesses: 0, workflowResumes: 0 }
    if (row.eventType === 'PAYWALL_VIEWED') item.paywallViews += 1
    if (row.eventType === 'PAYMENT_SUCCESS') item.paymentSuccesses += 1
    if (row.eventType === 'WORKFLOW_RESUMED') item.workflowResumes += 1
    byRole.set(role, item)
  }
  const cohortMap = new Map()
  for (const row of [...payments, ...ledger.filter(item => ['credit_purchase', 'credits_purchased'].includes(item.type))]) {
    const date = new Date(row.createdAt || 0)
    const cohort = Number.isNaN(date.getTime()) ? 'unknown' : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    const item = cohortMap.get(cohort) || { cohort, paidUsers: new Set(), revenue: 0 }
    if (row.userId) item.paidUsers.add(row.userId)
    item.revenue += number(row.amount ?? row.amountMinor ?? row.totalAmount)
    cohortMap.set(cohort, item)
  }
  const revenue = payments.reduce((sum, row) => sum + number(row.amount ?? row.amountMinor ?? row.totalAmount), 0)
  const usageCogs = usageEvents.reduce((sum, row) => sum + number(row.totalVariableCostUsd ?? row.totalCogs), 0)
  const usageRevenue = usageEvents.reduce((sum, row) => sum + number(row.allocatedRevenueUsd ?? row.customerPrice), 0)
  const usageGrossProfit = usageEvents.reduce((sum, row) => sum + number(row.grossProfitUsd), 0)
  const usageMargin = usageRevenue > 0 ? usageGrossProfit / usageRevenue : null
  const tokenTotals = usageEvents.reduce((summary, row) => {
    summary.inputTokens += number(row.inputTokens ?? row.promptTokens)
    summary.outputTokens += number(row.outputTokens ?? row.completionTokens)
    summary.cachedInputTokens += number(row.cachedInputTokens ?? row.cachedTokens)
    summary.totalTokens += number(row.totalTokens ?? (number(row.inputTokens ?? row.promptTokens) + number(row.outputTokens ?? row.completionTokens)))
    summary.creditsSettled += number(row.credits)
    return summary
  }, { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0, creditsSettled: 0 })
  const providerModel = new Map()
  for (const row of usageEvents) {
    const key = `${row.provider || 'unknown'}:${row.model || 'unknown'}`
    const item = providerModel.get(key) || { provider: row.provider || 'unknown', model: row.model || 'unknown', calls: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalTokens: 0, providerCostUsd: 0, totalVariableCostUsd: 0, credits: 0, revenueUsd: 0 }
    item.calls += 1; item.inputTokens += number(row.inputTokens ?? row.promptTokens); item.outputTokens += number(row.outputTokens ?? row.completionTokens); item.cachedInputTokens += number(row.cachedInputTokens ?? row.cachedTokens); item.totalTokens += number(row.totalTokens); item.providerCostUsd += number(row.providerCostUsd); item.totalVariableCostUsd += number(row.totalVariableCostUsd ?? row.totalCogs); item.credits += number(row.credits); item.revenueUsd += number(row.allocatedRevenueUsd ?? row.customerPrice); providerModel.set(key, item)
  }
  const walletCredits = collection(db, 'walletAccounts').reduce((sum, row) => sum + number(row.creditBalance), 0) + ledger.filter(row => number(row.deltaCredits ?? row.credits) > 0).reduce((sum, row) => sum + number(row.deltaCredits ?? row.credits), 0)
  const reservedCredits = collection(db, 'usageReservations').filter(row => row.status === 'reserved').reduce((sum, row) => sum + number(row.reservedCredits), 0)
  const freeUsage = collection(db, 'capabilityAnalytics').filter(row => row.eventType === 'capability_completed' && row.fundingSource === 'platform_subsidy' && inPeriod(row)).length
  const creditRevenue = payments.filter(row => number(row.credits) > 0).reduce((sum, row) => sum + number(row.amount ?? row.amountMinor ?? row.totalAmount), 0)
  const subscriptionRevenue = revenue - creditRevenue
  const completedWorkflows = workflows.filter(row => ['resumed', 'completed', 'outcome_delivered'].includes(row.status)).length
  const attributed = new Map()
  for (const row of payments) { const source = row.utmSource || row.source || row.metadata?.source || 'unknown'; const item = attributed.get(source) || { source, payments: 0, revenue: 0, paidUsers: new Set() }; item.payments += 1; item.revenue += number(row.amount ?? row.amountMinor ?? row.totalAmount); if (row.userId) item.paidUsers.add(row.userId); attributed.set(source, item) }
  const roleRetention = [...byRole.values()].map(row => ({ role: row.role, paywallViews: row.paywallViews, paymentSuccesses: row.paymentSuccesses, conversionRate: row.conversionRate, workflowResumes: row.workflowResumes }))
  const dashboard = {
    generatedAt: nowIso(), period,
    source: 'persisted_tvce_events',
    metrics: {
      successfulPayments: payments.length, totalRevenue: revenue, creditRevenue, subscriptionRevenue,
      paidAccounts: paidUsers.size, creditBuyers: creditBuyers.size, activeSubscriptions: subscriptionUsers.size,
      webhookProcessed: webhookEvents.filter(row => ['processed', 'idempotent'].includes(row.status)).length,
      webhookFailures: webhookEvents.filter(row => row.status === 'failed').length,
      usageEvents: usageEvents.length, usageCogsUsd: usageCogs, usageRevenueUsd: usageRevenue,
      usageGrossProfitUsd: usageGrossProfit, usageGrossMargin: usageMargin,
      marginWarnings: usageEvents.filter(row => row.marginStatus === 'warning').length,
      marginCritical: usageEvents.filter(row => row.marginStatus === 'critical').length,
      aiTokenSpend: { ...tokenTotals, providerCostUsd: usageEvents.reduce((sum, row) => sum + number(row.providerCostUsd), 0), infrastructureCostUsd: usageEvents.reduce((sum, row) => sum + number(row.infrastructureCostUsd), 0), totalVariableCostUsd: usageCogs, freeCapabilityUses: freeUsage },
      wallet: { grossCredits: walletCredits, reservedCredits, availableCredits: Math.max(0, walletCredits - reservedCredits), activeSubscriptionAccounts: subscriptionUsers.size },
      workflowResumeRate: workflows.length ? Math.round((completedWorkflows / workflows.length) * 1000) / 10 : 0,
    },
    funnel: funnelStages.map(stage => ({ stage, count: eventCount(stage) })),
    cohorts: [...cohortMap.values()].sort((a, b) => a.cohort.localeCompare(b.cohort)).map(row => ({ cohort: row.cohort, paidUsers: row.paidUsers.size, revenue: row.revenue, averageRevenuePerAccount: row.paidUsers.size ? row.revenue / row.paidUsers.size : 0 })),
    roleCohorts: roleRetention,
    capabilityConversion: [...capabilityMap.values()].map(row => ({ ...row, conversionRate: row.paywallViews ? Math.round((row.paymentSuccesses / row.paywallViews) * 1000) / 10 : 0 })),
    attribution: [...attributed.values()].map(row => ({ source: row.source, payments: row.payments, revenue: row.revenue, paidUsers: row.paidUsers.size })),
    providerModelBreakdown: [...providerModel.values()],
    drilldown: { payments: payments.slice(-100), paywalls: paywalls.slice(-100), webhooks: webhookEvents.slice(-100), workflows: workflows.slice(-100), usage: usageEvents.slice(-100) },
  }
  return dashboard
}

export function nextBestAction(userId, input = {}) {
  const db = readAuthorityDb(); const role = roleFor(db, userId, input.role); const active = collection(db, 'workflowSnapshots').filter(row => row.userId === userId && ['pending', 'active'].includes(row.status))
  const action = input.action || (role === 'investor' ? 'INVESTOR_INTELLIGENCE' : role === 'organization' ? 'ORGANIZATION_MONITORING' : active.length ? 'CUSTOMER_VALIDATION_ADVANCED' : 'IDEA_DIAGNOSTICS_ADVANCED')
  const catalog = catalogFor(action) || TVCE_CAPABILITIES[0]
  const access = evaluateEntitlement(userId, { capability: catalog.id, role })
  const usage = collection(db, 'capabilityConsumptions').filter(row => row.userId === userId)
  const completed = usage.filter(row => ['settled', 'completed'].includes(String(row.status).toLowerCase()))
  const successful = completed.filter(row => row.outcome === 'success' || row.success === true || row.resultStatus === 'success').length
  const capabilityUses = completed.filter(row => row.capability === catalog.id).length
  const priorPaywalls = collection(db, 'paywallEvents').filter(row => row.userId === userId && row.capability === catalog.id).length
  const purchaseGuidance = {
    relevant: !access.allowed && (catalog.metering === 'runtime' || Boolean(catalog.funding)),
    whyNow: active.length ? 'An active workflow is waiting for this capability.' : `This is the next capability in your ${catalog.workflowStage || 'current'} stage.`,
    expectedOutcome: catalog.valueStatement || catalog.description || 'Continue the current workflow with better evidence.',
    observedPriorUses: capabilityUses,
    observedSuccessRate: capabilityUses ? Math.round((successful / Math.max(1, capabilityUses)) * 100) : null,
    priorPaywallViews: priorPaywalls,
    recommendedFunding: access.allowed ? 'none' : (access.recommendation || access.recommendedAction || (catalog.funding === 'subscription' ? 'SUBSCRIPTION' : 'CREDITS_OR_SUBSCRIPTION')),
    evidence: ['capability_catalog', 'current_entitlement', 'workflow_state', 'usage_history'],
  }
  return {
    action: catalog.id,
    reason: input.reason || `Your next valuable step is ${catalog.description}.`,
    expectedValue: catalog.valueStatement || catalog.description || 'Continue the current workflow with the required capability.',
    access: access.allowed ? 'available' : access.recommendation || access.recommendedAction,
    accessStatus: access.code,
    metering: catalog.metering || 'none',
    usageEstimateRequired: catalog.metering === 'runtime',
    subscriptionRecommendation: access.recommendation === 'SUBSCRIPTION' || access.recommendedAction === 'SUBSCRIPTION' || String(access.funding || '').includes('subscription'),
    availableCredits: access.availableCredits,
    usageEstimate: access.usageEstimate,
    funding: access.funding,
    freeRemaining: access.freeRemaining,
    plan: access.subscription?.plan || access.organizationEntitlement?.plan || null,
    purchaseGuidance,
    capability: catalog,
  }
}

export function saveWorkflow(userId, input = {}) {
  return updateAuthorityDb(db => {
    const existing = collection(db, 'workflowSnapshots').find(row => row.userId === userId && row.clientRequestId === input.clientRequestId)
    if (existing) return { ok: true, idempotent: true, workflow: existing }
    const workflow = { id: createId('workflow'), userId, clientRequestId: text(input.clientRequestId || createId('request')), name: text(input.name || input.capability || 'TechIT workflow'), capability: text(input.capability), payload: input.payload || {}, estimatedCredits: number(input.estimatedCredits), status: 'pending', createdAt: nowIso(), updatedAt: nowIso() }
    collection(db, 'workflowSnapshots').push(workflow); return { ok: true, workflow }
  })
}

export async function saveWorkflowAsync(userId, input = {}) {
  if (process.env.FINANCE_WRITE_SOURCE !== 'postgres') return saveWorkflow(userId, input)
  try { return await saveWorkflowPostgres(userId, input) } catch (error) {
    if (process.env.FINANCE_WRITE_FALLBACK_SQLITE === 'false') return { ok: false, error: 'finance_write_temporarily_unavailable' }
    return saveWorkflow(userId, input)
  }
}

export function resumeWorkflow(userId, workflowId, input = {}) {
  return updateAuthorityDb(db => {
    const workflow = collection(db, 'workflowSnapshots').find(row => row.id === workflowId && row.userId === userId)
    if (!workflow) return { ok: false, error: 'workflow_not_found' }
    workflow.status = input.status || 'resumed'; workflow.resumedAt = nowIso(); workflow.updatedAt = workflow.resumedAt; return { ok: true, workflow }
  })
}

export async function resumeWorkflowAsync(userId, workflowId, input = {}) {
  if (process.env.FINANCE_WRITE_SOURCE !== 'postgres') return resumeWorkflow(userId, workflowId, input)
  try { return await resumeWorkflowPostgres(userId, workflowId, input) } catch (error) {
    if (process.env.FINANCE_WRITE_FALLBACK_SQLITE === 'false') return { ok: false, error: 'finance_write_temporarily_unavailable' }
    return resumeWorkflow(userId, workflowId, input)
  }
}

export function fulfillPayment(userId, paymentId, input = {}) {
  return updateAuthorityDb(db => {
    const payment = collection(db, 'paymentIntents').find(row => row.id === paymentId && row.userId === userId)
    if (!payment) return { ok: false, error: 'payment_not_found' }
    if (payment.status === 'successful') return { ok: true, idempotent: true, payment }
    if (input.verified !== true) return { ok: false, error: 'payment_verification_required' }
    const now = nowIso(); payment.status = 'successful'; payment.verifiedAt = now; payment.providerReference = text(input.providerReference) || null
    const credits = Math.max(0, number(payment.credits))
    if (credits > 0) collection(db, 'creditLedger').push({ id: createId('credit_purchase'), userId, deltaCredits: credits, credits, type: 'credit_purchase', paymentIntentId: payment.id, idempotencyKey: payment.id, createdAt: now })
    const planId = text(input.planId || payment.planId)
    if (planId) {
      const subscription = collection(db, 'subscriptions').find(row => row.userId === userId && row.planId === planId) || { id: createId('subscription'), userId, planId, createdAt: now }
      Object.assign(subscription, { planId, status: 'active', currentPeriodStart: now, currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(), updatedAt: now })
      if (!db.subscriptions.includes(subscription)) db.subscriptions.push(subscription)
    }
    const account = collection(db, 'accountEntitlements').find(row => row.userId === userId) || { id: createId('account_entitlement'), userId, createdAt: now }
    Object.assign(account, { status: 'active', source: credits > 0 ? 'credits' : 'subscription', paymentIntentId: payment.id, updatedAt: now }); if (!db.accountEntitlements.includes(account)) db.accountEntitlements.push(account)
    const workflowId = text(input.workflowId); const workflow = workflowId ? collection(db, 'workflowSnapshots').find(row => row.id === workflowId && row.userId === userId) : null
    if (workflow) { workflow.status = 'resumed'; workflow.resumedAt = now; workflow.updatedAt = now }
    return { ok: true, payment, accountEntitlement: account, workflow: workflow || null }
  })
}

export function reversePaymentCredits(userId, paymentId, reason = 'refund') {
  return updateAuthorityDb(db => {
    const payment = collection(db, 'paymentIntents').find(row => row.id === paymentId && row.userId === userId)
    if (!payment) return { ok: false, error: 'payment_not_found' }
    const purchased = collection(db, 'creditLedger').filter(row => row.paymentIntentId === paymentId && Number(row.deltaCredits ?? row.credits) > 0).reduce((sum, row) => sum + Number(row.deltaCredits ?? row.credits), 0)
    const reversed = collection(db, 'creditLedger').filter(row => row.paymentIntentId === paymentId && row.type === 'credit_purchase_reversal').reduce((sum, row) => sum + Math.abs(Number(row.deltaCredits ?? row.credits)), 0)
    const remaining = Math.max(0, purchased - reversed)
    if (remaining > 0) collection(db, 'creditLedger').push({ id: createId('credit_reversal'), userId, paymentIntentId: paymentId, deltaCredits: -remaining, credits: -remaining, type: 'credit_purchase_reversal', reason, createdAt: nowIso() })
    payment.status = reason === 'dispute' ? 'disputed' : 'refunded'; payment.updatedAt = nowIso()
    return { ok: true, idempotent: remaining === 0, payment, reversedCredits: remaining }
  })
}

export async function fulfillPaymentAsync(userId, paymentId, input = {}) {
  if (financePostgresEnabled()) {
    try { return await fulfillPaymentPostgres(userId, paymentId, input) } catch (error) {
      console.error(JSON.stringify({ event: 'finance_postgres_payment_fulfillment_failed', error: error.message }))
      if (process.env.FINANCE_WRITE_FALLBACK_SQLITE === 'false') return { ok: false, error: 'finance_write_temporarily_unavailable' }
    }
  }
  return fulfillPayment(userId, paymentId, input)
}
