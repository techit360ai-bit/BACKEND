import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'
import { CAPABILITY_POLICIES, authorizeCapability, availableCredits, subscriptionEntitlement } from './capabilityAuthorization.js'

const ROLE_MINIMUM_CREDITS = Object.freeze({ investor: 5, organization: 10 })
const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const text = (value, fallback = '') => typeof value === 'string' ? value.trim() : fallback

export const TVCE_CAPABILITIES = Object.freeze([
  { id: 'IDEA_DIAGNOSTICS_BASIC', category: 'incubation', description: 'Basic idea diagnosis', requiredRole: null, freeAccess: true, subscriptionAccess: true, creditAccess: true, creditCost: 0, workflowStage: 'discover', valueStatement: 'Understand the shape of your idea.', blockedMessage: 'Basic diagnosis is available on the free account.' },
  { id: 'IDEA_DIAGNOSTICS_ADVANCED', category: 'incubation', description: 'Advanced idea diagnosis', requiredRole: 'founder', freeAccess: false, subscriptionAccess: true, creditAccess: true, creditCost: 5, workflowStage: 'understand', valueStatement: 'Identify your highest-risk assumptions and the next validation experiment.', blockedMessage: 'Advanced diagnosis needs a Founder context and paid execution access.' },
  { id: 'CUSTOMER_VALIDATION_ADVANCED', category: 'validation', description: 'Advanced customer validation analysis', requiredRole: 'founder', freeAccess: false, subscriptionAccess: true, creditAccess: true, creditCost: 5, workflowStage: 'validate', valueStatement: 'Turn customer responses into evidence-backed decisions.', blockedMessage: 'Advanced validation is a paid Founder capability.' },
  { id: 'WORKSPACE_COPILOT', category: 'workspace', description: 'Workspace Copilot', requiredRole: 'founder', freeAccess: true, subscriptionAccess: true, creditAccess: true, creditCost: 1, workflowStage: 'build', valueStatement: 'Move from plan to implementation with project-aware assistance.', blockedMessage: 'Workspace Copilot requires a Founder context.' },
  { id: 'ADVANCED_WORKSPACE_AI', category: 'workspace', description: 'Advanced workspace AI', requiredRole: 'founder', freeAccess: false, subscriptionAccess: true, creditAccess: true, creditCost: 5, workflowStage: 'build', valueStatement: 'Handle deeper architecture, code, and execution analysis.', blockedMessage: 'Advanced workspace AI needs paid execution access.' },
  { id: 'INVESTOR_INTELLIGENCE', category: 'investor', description: 'Investor intelligence', requiredRole: 'investor', freeAccess: false, subscriptionAccess: true, creditAccess: true, creditCost: 10, workflowStage: 'decide', valueStatement: 'Screen opportunities with structured intelligence and permitted evidence.', blockedMessage: 'Investor intelligence requires an active Investor role and investor funding.' },
  { id: 'DUE_DILIGENCE_INTELLIGENCE', category: 'investor', description: 'Due diligence intelligence', requiredRole: 'investor', freeAccess: false, subscriptionAccess: true, creditAccess: true, creditCost: 15, workflowStage: 'due_diligence', valueStatement: 'Organize diligence evidence and surface decision-relevant risk.', blockedMessage: 'Due diligence requires an active Investor role and higher funding.' },
  { id: 'PORTFOLIO_INTELLIGENCE', category: 'investor', description: 'Portfolio intelligence', requiredRole: 'investor', freeAccess: false, subscriptionAccess: true, creditAccess: true, creditCost: 15, workflowStage: 'monitor', valueStatement: 'Monitor portfolio health and execution trends.', blockedMessage: 'Portfolio intelligence is reserved for Investor subscriptions or higher credit access.' },
  { id: 'ORGANIZATION_MONITORING', category: 'organization', description: 'Organization monitoring', requiredRole: 'organization', freeAccess: false, subscriptionAccess: true, creditAccess: true, creditCost: 10, workflowStage: 'monitor', valueStatement: 'See cohort progress and intervene where evidence shows risk.', blockedMessage: 'Organization monitoring requires an active Organization role and organization funding.' },
  { id: 'COHORT_INTELLIGENCE', category: 'organization', description: 'Cohort intelligence', requiredRole: 'organization', freeAccess: false, subscriptionAccess: true, creditAccess: true, creditCost: 20, workflowStage: 'monitor', valueStatement: 'Compare cohorts, identify stagnation, and prioritize interventions.', blockedMessage: 'Cohort intelligence requires an Organization subscription or higher credit access.' },
  { id: 'MENTOR_INTELLIGENCE', category: 'organization', description: 'Mentor intelligence', requiredRole: 'organization', freeAccess: false, subscriptionAccess: true, creditAccess: true, creditCost: 10, workflowStage: 'monitor', valueStatement: 'Understand mentor activity and program outcomes.', blockedMessage: 'Mentor intelligence requires an active Organization context.' },
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
  const catalog = catalogFor(capability)
  return { title: input.goal || catalog?.description || capability, outcomes: catalog ? [catalog.valueStatement] : ['Continue the current workflow with the required capability.'], workflowStage: input.workflowStage || catalog?.workflowStage || 'execute' }
}

export function capabilityCatalog() {
  return TVCE_CAPABILITIES.map(item => ({ ...item, policy: CAPABILITY_POLICIES[item.id] || CAPABILITY_POLICIES[item.id.toLowerCase()] || null }))
}

export function accountEntitlement(userId) { return accountEntitlementFor(readDb(), userId) }

export function evaluateEntitlement(userId, input = {}) {
  const db = readDb()
  const capability = text(input.capability || input.operation || '')
  const catalog = catalogFor(capability)
  const role = roleFor(db, userId, input.role)
  const baseCapability = catalog?.requiredRole === 'investor' ? 'investor.intelligence.view' : catalog?.requiredRole === 'organization' ? 'organization.analytics' : null
  const decision = baseCapability
    ? authorizeCapability(userId, baseCapability, { role, organizationId: input.organizationId, workspaceId: input.workspaceId })
    : catalog?.requiredRole === 'founder' && role !== 'founder'
      ? { allowed: false, code: 'role_required', capability }
      : catalog ? { allowed: true, code: 'allowed', capability, requiredCredits: catalog.creditCost, policy: catalog } : { allowed: false, code: 'unknown_capability', capability }
  const account = accountEntitlementFor(db, userId)
  const subscription = subscriptionEntitlement(db, userId)
  const credits = availableCredits(db, userId)
  const requiredCredits = number(input.creditCost, catalog?.creditCost ?? decision.requiredCredits ?? 0)
  const roleMinimum = ROLE_MINIMUM_CREDITS[role] || 0
  const rolePaid = role === 'investor' || role === 'organization' ? account.active : true
  const roleFunding = role === 'investor' || role === 'organization' ? (subscription.active || credits >= roleMinimum) : (subscription.active || credits >= requiredCredits)
  let code = decision.allowed && rolePaid && roleFunding && (requiredCredits === 0 || credits >= requiredCredits) ? 'allowed' : decision.code
  if (!account.active && (role === 'investor' || role === 'organization')) code = 'account_purchase_required'
  else if (!rolePaid) code = 'account_purchase_required'
  else if (!decision.allowed) code = decision.code
  else if (!roleFunding) code = 'role_funding_required'
  else if (requiredCredits > credits && !subscription.active) code = 'insufficient_credits'
  const allowed = code === 'allowed'
  return { allowed, code, capability, role, accountEntitlement: account, subscription, availableCredits: credits, requiredCredits, minimumRoleCredits: roleMinimum, recommendedAction: subscription.active ? 'USE_CREDITS' : (role === 'investor' || role === 'organization' ? 'UPGRADE' : requiredCredits > 0 ? 'USE_CREDITS' : 'UPGRADE'), alternativeAction: subscription.active ? 'UPGRADE' : 'USE_CREDITS', value: valueFor(capability, decision, input), decision, policy: catalog || decision.policy || null }
}

export function evaluatePaywall(userId, input = {}) {
  const result = evaluateEntitlement(userId, input)
  if (result.allowed) return { ...result, paywall: false }
  const db = readDb()
  const hits = collection(db, 'paywallEvents').filter(row => row.userId === userId && row.capability === result.capability)
  const repeated = hits.length >= 2
  const recommendation = repeated || result.role === 'investor' || result.role === 'organization' ? 'SUBSCRIPTION' : result.recommendedAction
  return { ...result, paywall: true, recommendation, estimatedAdditionalCredits: Math.max(result.requiredCredits, result.minimumRoleCredits) - result.availableCredits, reason: result.code, nextAction: result.value?.workflowStage ? `Continue ${result.value.workflowStage}` : 'Continue workflow' }
}

export function recordPaywallEvent(userId, input = {}) {
  return updateDb(db => {
    const event = { id: createId('paywall'), userId, capability: text(input.capability), eventType: text(input.eventType || 'PAYWALL_VIEWED'), role: roleFor(db, userId, input.role), metadata: input.metadata || {}, createdAt: nowIso() }
    collection(db, 'paywallEvents').push(event)
    return { ok: true, event }
  })
}

export function estimateCredits(userId, input = {}) {
  const items = Array.isArray(input.actions) ? input.actions : [input]
  const estimate = items.reduce((sum, item) => sum + number(item.creditCost, catalogFor(item.capability || item.operation)?.creditCost || 0), 0)
  return { userId, estimatedCredits: estimate, actionCount: items.length, isEstimate: true, availableCredits: availableCredits(readDb(), userId), covered: availableCredits(readDb(), userId) >= estimate }
}

export function walletForecast(userId) {
  const db = readDb(); const available = availableCredits(db, userId)
  const workflows = collection(db, 'workflowSnapshots').filter(row => row.userId === userId && ['pending', 'active'].includes(row.status))
  const projected = workflows.reduce((sum, row) => sum + number(row.estimatedCredits), 0)
  return { availableCredits: available, workflows: workflows.map(row => ({ id: row.id, name: row.name, estimatedCredits: number(row.estimatedCredits), status: row.status })), projectedRequirement: projected, shortfall: Math.max(0, projected - available), covered: available >= projected, isEstimate: true }
}

export function progressMeter(userId) {
  const db = readDb()
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
  const db = readDb(); const since = period === '30d' ? Date.now() - 30 * 86400000 : 0
  const events = collection(db, 'paywallEvents').filter(row => row.userId === userId && new Date(row.createdAt || 0).getTime() >= since)
  const count = type => events.filter(row => row.eventType === type).length
  const stages = ['PAYWALL_VIEWED', 'VALUE_EXPLANATION_VIEWED', 'CREDIT_OPTION_SELECTED', 'SUBSCRIPTION_OPTION_SELECTED', 'CHECKOUT_STARTED', 'PAYMENT_SUCCESS', 'WORKFLOW_RESUMED', 'OUTCOME_DELIVERED']
  return { period, stages: stages.map(stage => ({ stage, count: count(stage) })), totalEvents: events.length, capabilities: [...new Set(events.map(row => row.capability).filter(Boolean))] }
}

export function nextBestAction(userId, input = {}) {
  const db = readDb(); const role = roleFor(db, userId, input.role); const active = collection(db, 'workflowSnapshots').filter(row => row.userId === userId && ['pending', 'active'].includes(row.status))
  const action = input.action || (role === 'investor' ? 'INVESTOR_INTELLIGENCE' : role === 'organization' ? 'ORGANIZATION_MONITORING' : active.length ? 'CUSTOMER_VALIDATION_ADVANCED' : 'IDEA_DIAGNOSTICS_ADVANCED')
  const catalog = catalogFor(action) || TVCE_CAPABILITIES[0]
  const access = evaluateEntitlement(userId, { capability: catalog.id, role })
  return { action: catalog.id, reason: input.reason || `Your next valuable step is ${catalog.description}.`, expectedValue: catalog.valueStatement, access: access.allowed ? 'available' : access.recommendation || access.recommendedAction, creditCost: catalog.creditCost, subscriptionRecommendation: access.recommendation === 'SUBSCRIPTION', capability: catalog }
}

export function saveWorkflow(userId, input = {}) {
  return updateDb(db => {
    const existing = collection(db, 'workflowSnapshots').find(row => row.userId === userId && row.clientRequestId === input.clientRequestId)
    if (existing) return { ok: true, idempotent: true, workflow: existing }
    const workflow = { id: createId('workflow'), userId, clientRequestId: text(input.clientRequestId || createId('request')), name: text(input.name || input.capability || 'TechIT workflow'), capability: text(input.capability), payload: input.payload || {}, estimatedCredits: number(input.estimatedCredits), status: 'pending', createdAt: nowIso(), updatedAt: nowIso() }
    collection(db, 'workflowSnapshots').push(workflow); return { ok: true, workflow }
  })
}

export function resumeWorkflow(userId, workflowId, input = {}) {
  return updateDb(db => {
    const workflow = collection(db, 'workflowSnapshots').find(row => row.id === workflowId && row.userId === userId)
    if (!workflow) return { ok: false, error: 'workflow_not_found' }
    workflow.status = input.status || 'resumed'; workflow.resumedAt = nowIso(); workflow.updatedAt = workflow.resumedAt; return { ok: true, workflow }
  })
}

export function fulfillPayment(userId, paymentId, input = {}) {
  return updateDb(db => {
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
