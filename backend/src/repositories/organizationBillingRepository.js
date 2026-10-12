// Row-level organization billing store (§5 cutover).
//
// `organizationBillingService.applyOrganizationPayment` /
// `applyOrganizationPaymentLifecycle` used to load the whole-database snapshot
// at the top of the payment webhook path: they read the payment intent, checked
// idempotency, granted the entitlement / created the budget and wrote the
// sponsorship transaction + billing event. This store resolves a payment-scoped
// bundle (the intent plus the organization's entitlement/budget/sponsorship
// rows and the ownership rows `saveOrganizationEntitlement` needs) and runs the
// existing synchronous service logic against it via `runBoundedDatabase`,
// persisting only the rows the call changed. Gated by ORGANIZATION_SOURCE /
// ORGANIZATION_WRITE_SOURCE=postgres; the snapshot path stays as the fallback.
import { runBoundedDatabase } from '../config/database.js'
import { withPlatformTransaction, getRecord, upsertRecord, listRecordsByField } from './platformCollectionRepository.js'
import { createId } from '../utils/api.js'

export function organizationBillingEnabled() {
  return process.env.ORGANIZATION_SOURCE === 'postgres' || process.env.ORGANIZATION_WRITE_SOURCE === 'postgres'
}

// Collections the payment path reads, bounded to the organization.
const PAYMENT_READ_COLLECTIONS = [
  'organizationBillingEvents',
  'organizationEntitlements',
  'organizationBudgets',
  'organizationAuditEvents',
  'organizationSponsorshipPackages',
  'sponsorshipApplications',
  'sponsorshipTransactions',
  'sponsorshipBenefits',
]

// Collections the synchronous service logic writes. `paymentIntents` /
// `organizations` / membership rows are read-only inputs to the scope.
const PAYMENT_WRITE_COLLECTIONS = [
  'organizationBillingEvents',
  'organizationEntitlements',
  'organizationAuditEvents',
  'organizationBudgets',
  'sponsorshipApplications',
  'sponsorshipTransactions',
  'sponsorshipBenefits',
]

const LIFECYCLE_COLLECTIONS = ['organizationEntitlements', 'organizationBudgets', 'sponsorshipTransactions']
const LIFECYCLE_WRITE_COLLECTIONS = ['organizationEntitlements', 'organizationBudgets', 'sponsorshipTransactions', 'sponsorshipApplications']

function captureOriginals(db, collections) {
  const originals = new Map()
  for (const name of collections) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
  return originals
}

async function persistChanges(client, db, originals, collections) {
  for (const name of collections) {
    for (const row of db[name] || []) {
      if (!row) continue
      if (!row.id) row.id = createId('org_billing_row')
      const key = `${name}:${row.id}`
      const next = JSON.stringify(row)
      if (originals.get(key) === next) continue
      await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
    }
  }
}

async function collectByField(client, collection, field, value, out) {
  for (const row of await listRecordsByField(client, collection, field, value)) {
    if (!out.some(item => item.id === row.id)) out.push(row)
  }
  return out
}

// Payment-scoped bundle for `applyOrganizationPayment`: the addressed intent
// plus the organization's billing rows and the ownership rows the entitlement
// grant uses to confirm the organization exists.
async function buildOrganizationPaymentScope(client, paymentId, userId) {
  const payment = await getRecord(client, 'paymentIntents', paymentId)
  if (!payment || (payment.userId || payment.ownerId) !== userId) return null
  const organizationId = payment.organizationId ? String(payment.organizationId) : null
  if (!organizationId) return { paymentIntents: [payment] }
  const db = { paymentIntents: [payment] }
  for (const name of PAYMENT_READ_COLLECTIONS) db[name] = await listRecordsByField(client, name, 'organizationId', organizationId)
  db.organizations = [await getRecord(client, 'organizations', organizationId)].filter(Boolean)
  db.organizationMemberships = await listRecordsByField(client, 'organizationMemberships', 'organizationId', organizationId)
  db.organizationDashboards = await listRecordsByField(client, 'organizationDashboards', 'ownerId', organizationId)
  db.projects = await listRecordsByField(client, 'projects', 'organizationId', organizationId)
  // The sponsorship package is referenced by id, which is not guaranteed to be
  // organization-scoped, so load it explicitly when the application names one.
  const application = payment.sponsorApplicationId ? db.sponsorshipApplications.find(row => row.id === payment.sponsorApplicationId) : null
  if (application?.packageId && !db.organizationSponsorshipPackages.some(row => row.id === application.packageId)) {
    const pkg = await getRecord(client, 'organizationSponsorshipPackages', application.packageId)
    if (pkg) db.organizationSponsorshipPackages.push(pkg)
  }
  return db
}

// Lifecycle bundle for `applyOrganizationPaymentLifecycle`: match the intent and
// the affected entitlement/budget/transaction rows by id, provider reference or
// organization, and the reversed sponsorship application by id.
async function buildOrganizationLifecycleScope(client, paymentId, providerReference) {
  const payments = []
  if (paymentId) { const row = await getRecord(client, 'paymentIntents', paymentId); if (row) payments.push(row) }
  if (providerReference) await collectByField(client, 'paymentIntents', 'providerReference', providerReference, payments)
  const organizationId = payments.find(row => row.organizationId)?.organizationId || null
  const db = { paymentIntents: payments, sponsorshipApplications: [] }
  for (const name of LIFECYCLE_COLLECTIONS) {
    db[name] = []
    if (paymentId) await collectByField(client, name, 'paymentIntentId', paymentId, db[name])
    if (providerReference) await collectByField(client, name, 'providerReference', providerReference, db[name])
    if (organizationId) await collectByField(client, name, 'organizationId', organizationId, db[name])
  }
  const applicationId = payments.find(row => row.sponsorApplicationId)?.sponsorApplicationId
  if (applicationId) { const application = await getRecord(client, 'sponsorshipApplications', applicationId); if (application) db.sponsorshipApplications.push(application) }
  return db
}

// Runs the synchronous `applyOrganizationPayment` against a payment-scoped
// bundle and persists only the rows it changed. Returns the service result
// verbatim, or `{ ok: true, skipped: true }` when the intent is unknown/foreign.
export async function applyOrganizationPaymentStore(paymentId, userId, run) {
  return withPlatformTransaction(async client => {
    const db = await buildOrganizationPaymentScope(client, paymentId, userId)
    if (!db) return { ok: true, skipped: true }
    if (!db.paymentIntents[0]?.organizationId) return { ok: true, skipped: true }
    const originals = captureOriginals(db, PAYMENT_WRITE_COLLECTIONS)
    const result = await runBoundedDatabase(db, async () => run())
    await persistChanges(client, db, originals, PAYMENT_WRITE_COLLECTIONS)
    return result
  }, { userId })
}

// Runs the synchronous `applyOrganizationPaymentLifecycle` against the matched
// rows and persists only the rows it changed.
export async function applyOrganizationPaymentLifecycleStore(paymentId, providerReference, run) {
  return withPlatformTransaction(async client => {
    const db = await buildOrganizationLifecycleScope(client, paymentId, providerReference)
    const originals = captureOriginals(db, LIFECYCLE_WRITE_COLLECTIONS)
    const result = await runBoundedDatabase(db, async () => run())
    await persistChanges(client, db, originals, LIFECYCLE_WRITE_COLLECTIONS)
    return result
  })
}


// Row-level (§5) entitlement write for the admin route. `saveOrganizationEntitlement`
// reads/updates the whole-DB snapshot; this runs it against an organization-scoped
// bundle (the org's entitlement/audit rows plus the ownership rows the existence
// check needs) and persists only the changed rows.
const ENTITLEMENT_WRITE_COLLECTIONS = ['organizationEntitlements', 'organizationAuditEvents']

async function buildOrganizationEntitlementScope(client, organizationId) {
  const db = { organizationEntitlements: [], organizationAuditEvents: [] }
  if (!organizationId) return db
  db.organizationEntitlements = await listRecordsByField(client, 'organizationEntitlements', 'organizationId', organizationId)
  db.organizationAuditEvents = await listRecordsByField(client, 'organizationAuditEvents', 'organizationId', organizationId)
  db.organizations = [await getRecord(client, 'organizations', organizationId)].filter(Boolean)
  db.organizationMemberships = await listRecordsByField(client, 'organizationMemberships', 'organizationId', organizationId)
  db.organizationDashboards = await listRecordsByField(client, 'organizationDashboards', 'ownerId', organizationId)
  db.projects = await listRecordsByField(client, 'projects', 'organizationId', organizationId)
  return db
}

export async function applyOrganizationEntitlementStore(adminId, input, run) {
  const organizationId = typeof input?.organizationId === 'string' ? input.organizationId.trim() : ''
  return withPlatformTransaction(async client => {
    const db = await buildOrganizationEntitlementScope(client, organizationId)
    const originals = captureOriginals(db, ENTITLEMENT_WRITE_COLLECTIONS)
    const result = await runBoundedDatabase(db, async () => run())
    await persistChanges(client, db, originals, ENTITLEMENT_WRITE_COLLECTIONS)
    return result
  }, { userId: adminId })
}
