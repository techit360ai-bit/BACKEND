import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { createOrganizationBudget } from './organizationBudgetService.js'
import { saveOrganizationEntitlement } from './organizationEntitlementService.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const text = value => typeof value === 'string' ? value.trim() : ''
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0

export function applyOrganizationPayment({ userId, paymentId, provider, providerReference = null, planId = null } = {}) {
  const db = readAuthorityDb()
  const payment = rows(db, 'paymentIntents').find(row => row.id === paymentId && row.userId === userId)
  if (!payment || !payment.organizationId) return { ok: true, skipped: true }
  const organizationId = text(payment.organizationId)
  const purchaseType = text(payment.purchaseType || (planId ? 'program_pass' : 'sponsor_grant'))
  const reference = text(providerReference || payment.providerReference || payment.id)
  const existing = rows(db, 'organizationBillingEvents').find(row => row.paymentIntentId === payment.id || row.providerReference === reference)
  if (existing) return { ok: true, idempotent: true, event: existing }
  if (!['program_pass', 'organization_subscription', 'sponsor_grant', 'hackathon_upgrade'].includes(purchaseType)) return { ok: false, error: 'unsupported_organization_purchase_type' }
  if (purchaseType === 'program_pass' || purchaseType === 'organization_subscription' || purchaseType === 'hackathon_upgrade') {
    const granted = saveOrganizationEntitlement(userId, {
      id: `payment:${payment.id}`,
      organizationId,
      plan: text(planId || payment.planId) || (purchaseType === 'program_pass' ? 'program_pass' : 'organization_subscription'),
      source: provider || 'payment',
      status: 'active',
      paymentIntentId: payment.id,
      providerReference: reference,
      capabilities: payment.organizationCapabilities || {},
      limits: payment.organizationLimits || {},
      expiresAt: payment.organizationExpiresAt || null,
    })
    if (!granted.ok) return granted
  }
  if (purchaseType === 'sponsor_grant' || purchaseType === 'hackathon_upgrade') {
    const budget = createOrganizationBudget(userId, {
      id: `payment-budget:${payment.id}`,
      organizationId,
      programId: payment.programId || null,
      hackathonId: payment.hackathonId || null,
      balance: num(payment.credits),
      source: purchaseType === 'sponsor_grant' ? 'sponsor_payment' : 'hackathon_upgrade',
      paymentIntentId: payment.id,
      providerReference: reference,
    })
    if (!budget.ok && budget.error !== 'organization_budget_fields_required') return budget
  }
  return updateAuthorityDb(state => {
    if (payment.sponsorApplicationId) {
      const application = rows(state, 'sponsorshipApplications').find(row => row.id === payment.sponsorApplicationId && row.organizationId === organizationId)
      const pkg = application && rows(state, 'organizationSponsorshipPackages').find(row => row.id === application.packageId)
      if (application) { application.status = 'funded'; application.updatedAt = nowIso() }
      let transaction = rows(state, 'sponsorshipTransactions').find(row => row.paymentIntentId === payment.id)
      if (!transaction) {
        transaction = { id: createId('sponsor_tx'), applicationId: payment.sponsorApplicationId, organizationId, paymentIntentId: payment.id, provider, providerReference: reference, amount: payment.amount || 0, currency: payment.currency || null, credits: payment.credits || 0, status: 'successful', createdAt: nowIso(), updatedAt: nowIso() }
        rows(state, 'sponsorshipTransactions').push(transaction)
        for (const benefit of pkg?.benefits || []) rows(state, 'sponsorshipBenefits').push({ id: createId('sponsor_benefit'), transactionId: transaction.id, organizationId, benefitType: typeof benefit === 'string' ? benefit : benefit.type || 'custom', description: typeof benefit === 'string' ? benefit : benefit.description || '', status: 'pending', consentRequired: typeof benefit === 'object' && benefit.consentRequired === true, metadata: typeof benefit === 'object' ? benefit : {}, createdAt: nowIso(), updatedAt: nowIso() })
      }
    }
    const event = { id: createId('org_billing'), paymentIntentId: payment.id, organizationId, purchaseType, provider: provider || null, providerReference: reference, amount: payment.amount || 0, currency: payment.currency || null, credits: payment.credits || 0, planId: planId || payment.planId || null, createdAt: nowIso() }
    rows(state, 'organizationBillingEvents').push(event)
    return { ok: true, event }
  })
}

export function applyOrganizationPaymentLifecycle({ paymentId = null, providerReference = null, status } = {}) {
  const normalizedStatus = text(status).toLowerCase()
  if (!['active', 'trialing', 'past_due', 'cancelled', 'refunded', 'disputed'].includes(normalizedStatus)) return { ok: true, skipped: true }
  return updateAuthorityDb(db => {
    const payment = rows(db, 'paymentIntents').find(row => row.id === paymentId || (providerReference && row.providerReference === providerReference))
    const organizationId = payment?.organizationId || rows(db, 'organizationEntitlements').find(row => row.paymentIntentId === paymentId || (providerReference && row.providerReference === providerReference))?.organizationId
    if (!organizationId) return { ok: true, skipped: true }
    const commercialStatus = normalizedStatus === 'past_due' ? 'grace_period' : ['cancelled', 'refunded', 'disputed'].includes(normalizedStatus) ? 'inactive' : normalizedStatus
    const matches = row => row.organizationId === organizationId && (row.paymentIntentId === paymentId || (providerReference && row.providerReference === providerReference))
    for (const entitlement of rows(db, 'organizationEntitlements').filter(matches)) {
      entitlement.status = commercialStatus
      entitlement.updatedAt = nowIso()
    }
    for (const budget of rows(db, 'organizationBudgets').filter(matches)) {
      budget.status = commercialStatus === 'inactive' ? 'frozen' : commercialStatus
      budget.updatedAt = nowIso()
    }
    for (const transaction of rows(db, 'sponsorshipTransactions').filter(matches)) {
      transaction.status = normalizedStatus
      transaction.updatedAt = nowIso()
    }
    const applicationId = payment?.sponsorApplicationId
    if (applicationId && ['refunded', 'disputed', 'cancelled'].includes(normalizedStatus)) {
      const application = rows(db, 'sponsorshipApplications').find(row => row.id === applicationId)
      if (application) { application.status = 'payment_reversed'; application.updatedAt = nowIso() }
    }
    return { ok: true, organizationId, status: commercialStatus }
  })
}
