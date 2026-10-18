import { createId, nowIso } from '../utils/api.js'
import { economicsForUsage } from '../services/unitEconomicsService.js'
import { mergeWorkflowBudget, workflowBudgetSnapshot, resolveWorkflowCeiling } from '../services/workflowBudgetService.js'
import { evaluatePurchasePolicy, intentExpiry, purchasePolicyConfig, purchaseUsage, resolvePurchaseIdentity } from '../services/purchasePolicyService.js'
import { withPlatformTransaction, upsertRecord, deleteRecord, listRecords, listRecordsForOwner, getPlatformPool, closePlatformPool } from './platformCollectionRepository.js'

const enabled = () => process.env.FINANCE_WRITE_SOURCE === 'postgres'
const readEnabled = () => process.env.FINANCE_READ_SOURCE === 'postgres'
const readFallback = () => process.env.FINANCE_READ_FALLBACK_SQLITE !== 'false'
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const text = value => typeof value === 'string' ? value.trim() : ''

function getFinancePool() {
  const connectionString = process.env.FINANCE_DATABASE_URL || process.env.DATABASE_URL
  if (!connectionString) throw new Error('FINANCE_DATABASE_URL or DATABASE_URL is required')
  return getPlatformPool()
}

const mapNormalized = row => ({ ...(row.payload || {}), id: row.id, userId: row.user_id, creditBalance: row.balance == null ? undefined : Number(row.balance), balance: row.balance == null ? undefined : Number(row.balance), currency: row.currency, deltaCredits: row.delta_credits == null ? undefined : Number(row.delta_credits), reservedCredits: row.reserved_credits == null ? undefined : Number(row.reserved_credits), status: row.status, amount: row.amount == null ? undefined : Number(row.amount), credits: row.credits == null ? undefined : Number(row.credits), createdAt: row.created_at, updatedAt: row.updated_at })

export async function walletAccount(userId) { const result = await getFinancePool().query('SELECT * FROM core_wallet_accounts WHERE user_id=$1', [userId]); return result.rows[0] ? mapNormalized(result.rows[0]) : null }
export async function walletCollection(userId, name) { const tables = { creditLedger: 'core_credit_ledger', usageReservations: 'core_usage_reservations', paymentIntents: 'core_payment_intents', subscriptions: 'core_subscriptions' }; const table = tables[name]; if (!table) throw new Error('unsupported finance collection'); const result = await getFinancePool().query(`SELECT * FROM ${table} WHERE user_id=$1 ORDER BY created_at DESC`, [userId]); return result.rows.map(mapNormalized) }
export async function walletSummary(userId) { const [account, ledger, reservations, payments] = await Promise.all([walletAccount(userId), walletCollection(userId, 'creditLedger'), walletCollection(userId, 'usageReservations'), walletCollection(userId, 'paymentIntents')]); const creditBalance = Number(account?.creditBalance || 0) + ledger.reduce((sum, row) => sum + Number(row.deltaCredits || row.credits || 0), 0); return { account: account || { userId, creditBalance, currency: 'USD' }, creditBalance, lifetimeCreditsUsed: Math.abs(ledger.filter(row => row.type === 'usage_settlement').reduce((sum, row) => sum + Number(row.deltaCredits || 0), 0)), pendingPayments: payments.filter(row => row.status === 'pending').length, pendingReservations: reservations.filter(row => row.status === 'reserved').length } }
export function financeReadEnabled() { return readEnabled() }
export function financeReadFallbackEnabled() { return readFallback() }
export async function closeFinanceRepository() { await closePlatformPool() }

async function findByPayload(client, collection, key, value, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE' : ''
  const result = await client.query(
    `SELECT * FROM platform_collection_records
     WHERE collection_name=$1 AND deleted_at IS NULL AND payload->>$2=$3
     ORDER BY updated_at DESC LIMIT 1${lock}`,
    [collection, key, String(value)],
  )
  const row = result.rows[0]
  return row ? { ...(row.payload || {}), id: row.record_id, version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at } : null
}

async function listByUser(client, collection, userId, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE' : ''
  const result = await client.query(
    `SELECT * FROM platform_collection_records
     WHERE collection_name=$1 AND deleted_at IS NULL AND (owner_id=$2 OR payload->>'userId'=$2)
     ORDER BY updated_at DESC${lock}`,
    [collection, userId],
  )
  return result.rows.map(row => ({ ...(row.payload || {}), id: row.record_id, version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at }))
}

export async function loadFinanceSnapshotPostgres(userId) {
  return withPlatformTransaction(async client => {
    const names = ['profiles', 'userRoles', 'verificationProfiles', 'trustProfiles', 'riskProfiles', 'organizationMemberships', 'walletAccounts', 'creditLedger', 'usageReservations', 'usageEvents', 'subscriptions', 'billingPlans', 'creditPackages', 'rateCards', 'geoPricingProfiles', 'profitabilityEvents', 'marginAlerts', 'workspaceTeamEntitlements', 'accountEntitlements', 'capabilityConsumptions', 'capabilityAnalytics', 'paywallEvents', 'workflowSnapshots', 'workflowBudgets', 'paymentIntents', 'billingWebhookEvents']
    const snapshot = {}
    for (const name of names) snapshot[name] = ['billingPlans', 'creditPackages', 'rateCards', 'geoPricingProfiles', 'workspaceTeamEntitlements'].includes(name) ? (await client.query("SELECT * FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL ORDER BY updated_at DESC", [name])).rows.map(row => ({ ...(row.payload || {}), id: row.record_id, version: Number(row.version) })) : await listByUser(client, name, userId)
    const config = (await client.query("SELECT payload FROM platform_collection_records WHERE collection_name='tvceConfig' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1")).rows[0]?.payload
    snapshot.tvceConfig = config || { freeQuotas: {}, capabilities: {} }
    return snapshot
  }, { userId })
}

// Global (all-subject) finance view for the admin TVCE analytics dashboard. The
// per-user loader above intentionally scopes every collection to one account;
// the admin aggregation needs the full population, so read each collection with
// a single bounded query instead of the whole-database snapshot.
const FINANCE_ADMIN_COLLECTIONS = ['paymentIntents', 'creditLedger', 'subscriptions', 'accountEntitlements', 'paywallEvents', 'billingWebhookEvents', 'workflowSnapshots', 'usageEvents', 'walletAccounts']

export async function loadFinanceAdminSnapshotPostgres() {
  return withPlatformTransaction(async client => {
    const snapshot = {}
    for (const name of FINANCE_ADMIN_COLLECTIONS) snapshot[name] = await listRecords(client, name)
    return snapshot
  })
}

// Progress-meter collections span several domains (workspace, investor,
// validation) that are not part of the finance loader. Read the subject's owned
// rows per collection rather than loading the whole database.
const PROGRESS_COLLECTIONS = ['ventureIntakes', 'projects', 'validationSessions', 'customerValidationSessions', 'customerResponses', 'workspaces', 'workspaceTasks', 'investorIntelligenceSnapshots', 'dealRooms']

export async function loadProgressMeterPostgres(userId) {
  return withPlatformTransaction(async client => {
    const snapshot = {}
    for (const name of PROGRESS_COLLECTIONS) snapshot[name] = await listRecordsForOwner(client, name, userId, { ownerFields: ['userId', 'ownerId', 'createdBy'] })
    return snapshot
  }, { userId })
}

// Admin commercial config is a small set of global catalog collections plus the
// singleton tvceConfig payload. Persist only the rows that actually changed and
// append the admin audit record.
const ADMIN_CONFIG_COLLECTIONS = ['billingPlans', 'creditPackages', 'rateCards', 'geoPricingProfiles']

export async function saveAdminCommercialConfigPostgres(before, after, audit, { userId = null } = {}) {
  return withPlatformTransaction(async client => {
    for (const name of ADMIN_CONFIG_COLLECTIONS) {
      const previous = new Map((before?.[name] || []).filter(row => row?.id).map(row => [String(row.id), row]))
      const next = new Map((after?.[name] || []).filter(row => row?.id).map(row => [String(row.id), row]))
      for (const [recordId, row] of next) {
        if (!previous.has(recordId) || JSON.stringify(previous.get(recordId)) !== JSON.stringify(row)) {
          await upsertRecord(client, name, row, { idempotencyKey: `tvce-config:${name}:${recordId}:${row.updatedAt || Date.now()}`, operation: previous.has(recordId) ? 'update' : 'insert' })
        }
      }
      for (const recordId of previous.keys()) if (!next.has(recordId)) await deleteRecord(client, name, recordId, { idempotencyKey: `tvce-config:${name}:${recordId}:delete:${Date.now()}` })
    }
    const config = after?.tvceConfig
    if (config && JSON.stringify(before?.tvceConfig || {}) !== JSON.stringify(config)) {
      await upsertRecord(client, 'tvceConfig', { id: 'tvceConfig', ...config, updatedAt: nowIso() }, { idempotencyKey: `tvce-config:${Date.now()}`, operation: 'update' })
    }
    if (audit) await upsertRecord(client, 'verificationAuditLogs', audit, { idempotencyKey: `tvce-config-audit:${audit.id}`, operation: 'insert' })
    return { ok: true }
  }, { userId })
}

async function findById(client, collection, recordId, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE' : ''
  const result = await client.query('SELECT * FROM platform_collection_records WHERE collection_name=$1 AND record_id=$2 AND deleted_at IS NULL' + lock, [collection, recordId])
  const row = result.rows[0]
  return row ? { ...(row.payload || {}), id: row.record_id, version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at } : null
}

async function purchaseIdentitySignals(client, userId, now, config) {
  const projectedRiskProfiles = await listByUser(client, 'riskProfiles', userId)
  const projectedVerificationProfiles = await listByUser(client, 'verificationProfiles', userId)
  const authorityRisk = await client.query(
    'SELECT state FROM trust_risk_profiles WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1',
    [userId],
  )
  const authorityVerification = await client.query(
    'SELECT status, assurance, expires_at, payload, updated_at FROM trust_verification_profiles WHERE user_id=$1 ORDER BY updated_at DESC',
    [userId],
  )
  const authorityIdentity = await client.query(
    "SELECT kind,status,checked_at,created_at FROM trust_identity_verifications WHERE user_id=$1 AND kind='kyc' ORDER BY created_at DESC LIMIT 1",
    [userId],
  )
  const authorityScreening = await client.query(
    'SELECT status,match_count,screened_at FROM trust_screening_results WHERE user_id=$1 ORDER BY screened_at DESC LIMIT 1',
    [userId],
  )
  const authorityRiskProfiles = authorityRisk.rows.map(row => ({ state: row.state }))
  const authorityVerificationProfiles = authorityVerification.rows.map(row => ({
    ...(row.payload || {}),
    status: row.status || row.payload?.status,
    assurance: row.assurance || row.payload?.assurance,
    expiresAt: row.expires_at || row.payload?.expiresAt,
    updatedAt: row.updated_at,
  }))
  const identityVerifications = authorityIdentity.rows.map(row => ({
    kind: row.kind,
    status: row.status,
    checkedAt: row.checked_at,
    createdAt: row.created_at,
  }))
  const screeningResults = authorityScreening.rows.map(row => ({
    status: row.status,
    matchCount: Number(row.match_count || 0),
    screenedAt: row.screened_at,
  }))
  return resolvePurchaseIdentity({
    riskProfiles: [...projectedRiskProfiles, ...authorityRiskProfiles],
    verificationProfiles: [...projectedVerificationProfiles, ...authorityVerificationProfiles],
    identityVerifications,
    screeningResults,
    now,
    config,
  })
}

async function expireStalePaymentIntents(client, userId, now, ttlMinutes) {
  const intents = await listByUser(client, 'paymentIntents', userId, { forUpdate: true })
  const expired = []
  for (const intent of intents) {
    if (String(intent.status || '').toLowerCase() !== 'pending') continue
    const expiresAt = intent.expiresAt || intentExpiry(intent.createdAt, ttlMinutes)
    if (new Date(expiresAt).getTime() > now.getTime()) continue
    const next = {
      ...intent,
      status: 'expired',
      checkoutStatus: intent.checkoutUrl ? 'expired' : intent.checkoutStatus || 'expired',
      expiresAt,
      expiredAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    await upsertRecord(client, 'paymentIntents', next, {
      idempotencyKey: `payment:${intent.id}:expired`,
      operation: 'update',
      expectedVersion: intent.version,
    })
    expired.push(next)
  }
  return { intents: intents.map(intent => expired.find(row => row.id === intent.id) || intent), expired }
}

async function resolveCatalogPlan(client, planId) {
  if (!planId) return null
  return await findById(client, 'billingPlans', planId) || await findByPayload(client, 'billingPlans', 'slug', planId)
}

async function recordPaymentRiskEvent(client, userId, operation, detail, now) {
  const event = {
    id: createId('payment_risk'),
    userId,
    operation,
    decision: detail.ok === false ? 'rejected' : 'allowed',
    error: detail.error || null,
    riskState: detail.riskState || null,
    requestedCredits: detail.requestedCredits ?? null,
    requestedAmountUsd: detail.requestedAmountUsd ?? null,
    usage: detail.usage || null,
    limits: detail.limits || null,
    kycRequired: Boolean(detail.kycRequired),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  await upsertRecord(client, 'paymentRiskEvents', event, {
    idempotencyKey: `payment-risk:${event.id}`,
    operation: 'insert',
  })
  return event
}

export async function createPaymentIntentPostgres(userId, body = {}) {
  if (!userId) return { ok: false, status: 400, error: 'platform_user_id_required' }
  return withPlatformTransaction(async client => {
    const config = purchasePolicyConfig()
    const now = new Date()
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`purchase:${userId}`])
    const { intents } = await expireStalePaymentIntents(client, userId, now, config.intentTtlMinutes)
    const idemKey = text(body.idemKey || body.idempotencyKey || body.idempotency_key)
    const existing = idemKey
      ? intents.find(intent => intent.idemKey === idemKey || intent.idempotencyKey === idemKey)
      : null
    if (existing) return { paymentIntent: existing, idempotent: true }

    const packageId = text(body.packageId || body.package_id)
    const pack = packageId ? await findById(client, 'creditPackages', packageId) : null
    if (packageId && (!pack || pack.active === false)) return { ok: false, status: 404, error: 'credit_package_not_found' }
    const planId = text(body.planId || body.plan_id)
    const plan = await resolveCatalogPlan(client, planId)
    if (planId && (!plan || plan.active === false)) return { ok: false, status: 404, error: 'billing_plan_not_found' }
    if (!packageId && !planId && process.env.NODE_ENV === 'production') {
      return { ok: false, status: 400, error: 'package_id_or_plan_id_required' }
    }
    const sponsorApplicationId = text(body.sponsorApplicationId || body.sponsor_application_id)
    const sponsorApplication = sponsorApplicationId
      ? await findById(client, 'sponsorshipApplications', sponsorApplicationId)
      : null
    const sponsorPackage = sponsorApplication?.packageId
      ? await findById(client, 'organizationSponsorshipPackages', sponsorApplication.packageId)
      : null
    if (sponsorApplicationId && (
      sponsorApplication?.status !== 'approved'
      || !sponsorPackage
      || sponsorPackage.status !== 'active'
      || sponsorPackage.organizationId !== sponsorApplication.organizationId
    )) {
      return { ok: false, status: 409, error: 'approved_sponsorship_application_required' }
    }

    const amount = sponsorPackage
      ? number(sponsorPackage.amount)
      : pack ? number(pack.amount ?? pack.price) : plan ? number(plan.amount ?? plan.price) : number(body.amount)
    const currency = String(sponsorPackage?.currency || pack?.currency || plan?.currency || body.currency || 'USD').toUpperCase()
    const credits = sponsorPackage
      ? number(sponsorPackage.creditGrant ?? sponsorPackage.credits)
      : pack ? number(pack.credits) + number(pack.bonusCredits)
        : plan ? number(plan.includedCredits ?? plan.credits) : number(body.credits)
    if (amount <= 0) return { ok: false, status: 400, error: 'payment_amount_required' }

    const identity = await purchaseIdentitySignals(client, userId, now, config)
    const policy = evaluatePurchasePolicy({
      credits,
      amount,
      currency,
      intents,
      riskState: identity.riskState,
      kycVerified: identity.kycVerified,
      now,
      config,
    })
    if (!policy.ok) {
      await recordPaymentRiskEvent(client, userId, 'payment_intent_create', policy, now)
      return policy
    }

    const createdAt = now.toISOString()
    const paymentIntent = {
      id: createId('pay'),
      userId,
      packageId: pack?.id || packageId || null,
      planId: plan?.id || planId || null,
      organizationId: sponsorApplication?.organizationId || text(body.organizationId || body.organization_id) || null,
      purchaseType: sponsorApplication ? 'sponsor_grant' : text(body.purchaseType || body.purchase_type) || null,
      programId: text(body.programId || body.program_id) || null,
      hackathonId: text(body.hackathonId || body.hackathon_id) || null,
      budgetId: text(body.budgetId || body.budget_id) || null,
      sponsorApplicationId: sponsorApplicationId || null,
      organizationCapabilities: plan?.organizationCapabilities || plan?.capabilities || null,
      organizationLimits: plan?.organizationLimits || plan?.limits || null,
      organizationExpiresAt: plan?.durationDays
        ? new Date(now.getTime() + Number(plan.durationDays) * 86400000).toISOString()
        : null,
      amount,
      currency,
      credits,
      status: 'pending',
      checkoutStatus: 'not_started',
      provider: text(body.provider) || null,
      idemKey: idemKey || `auto:${createId('idem')}`,
      idempotencyKey: idemKey || null,
      expiresAt: intentExpiry(createdAt, config.intentTtlMinutes),
      policy: {
        evaluatedAt: createdAt,
        riskState: policy.riskState,
        kycRequired: policy.kycRequired,
        limits: policy.limits,
        usageAtCreation: policy.usage,
      },
      createdAt,
      updatedAt: createdAt,
    }
    await upsertRecord(client, 'paymentIntents', paymentIntent, {
      idempotencyKey: `payment-intent:${userId}:${paymentIntent.idemKey}`,
      operation: 'insert',
    })
    await recordPaymentRiskEvent(client, userId, 'payment_intent_create', {
      ...policy,
      ok: true,
      requestedCredits: credits,
      requestedAmountUsd: policy.requestedAmountUsd,
    }, now)
    return { paymentIntent }
  }, { userId })
}

export async function markPaymentIntentCheckoutPostgres(userId, paymentId, checkout = {}) {
  return withPlatformTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`purchase:${userId}`])
    const payment = await findById(client, 'paymentIntents', paymentId, { forUpdate: true })
    if (!payment || payment.userId !== userId) return { ok: false, status: 404, error: 'payment_not_found' }
    if (payment.checkoutUrl) return { ok: true, idempotent: true, paymentIntent: payment }
    if (payment.status === 'successful') return { ok: false, status: 409, error: 'payment_intent_already_completed', paymentIntent: payment }
    if (payment.status === 'expired' || (payment.expiresAt && new Date(payment.expiresAt).getTime() <= Date.now())) {
      const now = nowIso()
      const expired = { ...payment, status: 'expired', checkoutStatus: 'expired', expiredAt: now, updatedAt: now }
      await upsertRecord(client, 'paymentIntents', expired, { idempotencyKey: `payment:${paymentId}:expired`, operation: 'update', expectedVersion: payment.version })
      return { ok: false, status: 409, error: 'payment_intent_expired', paymentIntent: expired }
    }
    const now = nowIso()
    const updated = {
      ...payment,
      provider: checkout.provider || payment.provider,
      checkoutUrl: checkout.checkoutUrl,
      providerSessionId: checkout.providerSessionId || null,
      providerReference: checkout.providerReference || null,
      checkoutStatus: 'created',
      checkoutCreatedAt: now,
      lastCheckoutError: null,
      updatedAt: now,
    }
    await upsertRecord(client, 'paymentIntents', updated, {
      idempotencyKey: `payment:${paymentId}:checkout-created:${checkout.providerSessionId || checkout.providerReference || paymentId}`,
      operation: 'update',
      expectedVersion: payment.version,
    })
    return { ok: true, paymentIntent: updated }
  }, { userId })
}

export async function beginPaymentIntentCheckoutPostgres(userId, paymentId) {
  return withPlatformTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`purchase:${userId}`])
    const payment = await findById(client, 'paymentIntents', paymentId, { forUpdate: true })
    if (!payment || payment.userId !== userId) return { ok: false, status: 404, error: 'payment_not_found' }
    if (payment.checkoutUrl) return { ok: true, idempotent: true, paymentIntent: payment }
    if (payment.status === 'successful') return { ok: false, status: 409, error: 'payment_intent_already_completed', paymentIntent: payment }
    if (payment.status === 'expired' || (payment.expiresAt && new Date(payment.expiresAt).getTime() <= Date.now())) {
      const now = nowIso()
      const expired = { ...payment, status: 'expired', checkoutStatus: 'expired', expiredAt: now, updatedAt: now }
      await upsertRecord(client, 'paymentIntents', expired, { idempotencyKey: `payment:${paymentId}:expired`, operation: 'update', expectedVersion: payment.version })
      return { ok: false, status: 409, error: 'payment_intent_expired', paymentIntent: expired }
    }
    const lockMs = Math.max(30, Number(process.env.PAYMENT_CHECKOUT_LOCK_SECONDS || 120)) * 1000
    const lockedAt = payment.checkoutLockedAt ? new Date(payment.checkoutLockedAt).getTime() : 0
    if (payment.checkoutStatus === 'creating' && lockedAt && Date.now() - lockedAt < lockMs) {
      return { ok: false, status: 409, error: 'checkout_in_progress', paymentIntent: payment, retryAfterSeconds: Math.ceil((lockMs - (Date.now() - lockedAt)) / 1000) }
    }
    const now = nowIso()
    const updated = {
      ...payment,
      checkoutStatus: 'creating',
      checkoutLockedAt: now,
      checkoutAttempts: number(payment.checkoutAttempts) + 1,
      updatedAt: now,
    }
    await upsertRecord(client, 'paymentIntents', updated, {
      idempotencyKey: `payment:${paymentId}:checkout-begin:${updated.checkoutAttempts}`,
      operation: 'update',
      expectedVersion: payment.version,
    })
    return { ok: true, paymentIntent: updated }
  }, { userId })
}

export async function markPaymentIntentCheckoutFailurePostgres(userId, paymentId, failure = {}) {
  return withPlatformTransaction(async client => {
    const payment = await findById(client, 'paymentIntents', paymentId, { forUpdate: true })
    if (!payment || payment.userId !== userId) return { ok: false, status: 404, error: 'payment_not_found' }
    if (payment.checkoutUrl || payment.status === 'successful') return { ok: true, paymentIntent: payment }
    const now = nowIso()
    const updated = {
      ...payment,
      checkoutStatus: 'failed',
      lastCheckoutError: String(failure.error || 'provider_checkout_failed').slice(0, 200),
      lastCheckoutFailedAt: now,
      updatedAt: now,
    }
    await upsertRecord(client, 'paymentIntents', updated, {
      idempotencyKey: `payment:${paymentId}:checkout-failed:${number(payment.checkoutAttempts)}`,
      operation: 'update',
      expectedVersion: payment.version,
    })
    return { ok: true, paymentIntent: updated }
  }, { userId })
}

export async function expirePaymentIntentsPostgres(userId) {
  const config = purchasePolicyConfig()
  return withPlatformTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`purchase:${userId}`])
    return expireStalePaymentIntents(client, userId, new Date(), config.intentTtlMinutes)
  }, { userId })
}

export function paymentPolicyUsage(intents = []) {
  return purchaseUsage(intents)
}

export async function fulfillPaymentPostgres(userId, paymentId, input = {}) {
  return withPlatformTransaction(async client => {
    const payment = await findById(client, 'paymentIntents', paymentId, { forUpdate: true })
    if (!payment || payment.userId !== userId) return { ok: false, error: 'payment_not_found' }
    if (payment.status === 'successful') return { ok: true, idempotent: true, payment }
    if (input.verified !== true) return { ok: false, error: 'payment_verification_required' }
    const now = nowIso()
    const lateFulfillment = payment.status === 'expired'
      || Boolean(payment.expiresAt && new Date(payment.expiresAt).getTime() <= new Date(now).getTime())
    const updatedPayment = {
      ...payment,
      status: 'successful',
      verifiedAt: now,
      providerReference: input.providerReference || payment.providerReference || null,
      lateFulfillment: lateFulfillment || payment.lateFulfillment === true,
      reconciliationRequired: lateFulfillment || payment.reconciliationRequired === true,
      reconciliationReason: lateFulfillment ? 'provider_capture_after_intent_expiry' : payment.reconciliationReason || null,
      updatedAt: now,
    }
    await upsertRecord(client, 'paymentIntents', updatedPayment, { idempotencyKey: `payment:${paymentId}:success`, operation: 'update', expectedVersion: payment.version })
    if (lateFulfillment) {
      await recordPaymentRiskEvent(client, userId, 'payment_intent_late_capture', {
        ok: true,
        error: 'provider_capture_after_intent_expiry',
        riskState: 'REVIEW',
        requestedCredits: number(payment.credits),
        requestedAmountUsd: String(payment.currency || 'USD').toUpperCase() === 'USD' ? number(payment.amount) / 100 : 0,
      }, new Date(now))
    }
    const credits = Math.max(0, number(payment.credits))
    if (credits > 0) await upsertRecord(client, 'creditLedger', { id: createId('credit_purchase'), userId, deltaCredits: credits, credits, type: 'credit_purchase', paymentIntentId: payment.id, idempotencyKey: payment.id, createdAt: now, updatedAt: now }, { idempotencyKey: `credit-purchase:${payment.id}`, operation: 'insert' })
    const planId = input.planId || payment.planId || null
    let subscription = null
    if (planId) {
      subscription = (await listByUser(client, 'subscriptions', userId, { forUpdate: true })).find(row => row.planId === planId) || { id: createId('subscription'), userId, planId, createdAt: now }
      subscription = { ...subscription, planId, status: 'active', currentPeriodStart: now, currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(), updatedAt: now }
      await upsertRecord(client, 'subscriptions', subscription, { idempotencyKey: `subscription:${subscription.id}:active`, operation: subscription.version ? 'update' : 'insert', expectedVersion: subscription.version ?? null })
    }
    const existingAccounts = await listByUser(client, 'accountEntitlements', userId, { forUpdate: true })
    const account = existingAccounts[0] || { id: createId('account_entitlement'), userId, createdAt: now }
    const accountEntitlement = { ...account, status: 'active', source: credits > 0 ? 'credits' : 'subscription', paymentIntentId: payment.id, updatedAt: now }
    await upsertRecord(client, 'accountEntitlements', accountEntitlement, { idempotencyKey: `account-entitlement:${userId}`, operation: account.version ? 'update' : 'insert', expectedVersion: account.version ?? null })
    let workflow = null
    if (input.workflowId) {
      const current = await findById(client, 'workflowSnapshots', input.workflowId, { forUpdate: true })
      if (current && current.userId === userId) {
        workflow = { ...current, status: 'resumed', resumedAt: now, updatedAt: now }
        await upsertRecord(client, 'workflowSnapshots', workflow, { idempotencyKey: `workflow:${workflow.id}:resume:${payment.id}`, operation: 'update', expectedVersion: current.version })
      }
    }
    return { ok: true, payment: updatedPayment, accountEntitlement, subscription, workflow }
  }, { userId })
}

export async function billingEventExistsPostgres(provider, eventId) {
  return withPlatformTransaction(async client => Boolean(await findByPayload(client, 'billingWebhookEvents', 'eventId', String(eventId))))
}

export async function paymentUserPostgres(paymentId) {
  return withPlatformTransaction(async client => (await findById(client, 'paymentIntents', paymentId))?.userId || null)
}

export async function recordBillingEventPostgres(event) {
  return withPlatformTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`billing:${event.provider}:${event.eventId}`])
    const existing = await findByPayload(client, 'billingWebhookEvents', 'eventId', String(event.eventId))
    if (existing) return existing
    const row = { id: event.id || createId('billing_event'), ...event, eventId: String(event.eventId), createdAt: event.createdAt || nowIso() }
    await upsertRecord(client, 'billingWebhookEvents', row, { idempotencyKey: `billing-event:${event.provider}:${event.eventId}`, operation: 'insert' })
    return row
  })
}

export async function updateSubscriptionPostgres({ userId, provider, providerId, planId, status, amount, currency, failureReason }) {
  return withPlatformTransaction(async client => {
    const current = (await listByUser(client, 'subscriptions', userId, { forUpdate: true })).find(row => row.providerId === providerId || row.planId === planId) || { id: createId('subscription'), userId, createdAt: nowIso() }
    const next = { ...current, provider, providerId, planId: planId || current.planId || null, status, amount: amount ?? current.amount ?? null, currency: currency || current.currency || null, lastFailureReason: failureReason || current.lastFailureReason || null, updatedAt: nowIso() }
    await upsertRecord(client, 'subscriptions', next, { idempotencyKey: `subscription:${next.id}:${status}:${next.updatedAt}`, operation: current.version ? 'update' : 'insert', expectedVersion: current.version ?? null })
    const account = (await listByUser(client, 'accountEntitlements', userId, { forUpdate: true })).find(row => row.source === 'subscription')
    if (account) await upsertRecord(client, 'accountEntitlements', { ...account, status: status === 'past_due' ? 'grace_period' : ['cancelled', 'refunded', 'disputed'].includes(status) ? 'inactive' : status, updatedAt: nowIso() }, { idempotencyKey: `account-entitlement:${userId}:${status}`, operation: 'update', expectedVersion: account.version })
    return next
  }, { userId })
}

export async function reversePaymentCreditsPostgres(userId, paymentId, reason = 'refund') {
  return withPlatformTransaction(async client => {
    const payment = await findById(client, 'paymentIntents', paymentId, { forUpdate: true })
    if (!payment || payment.userId !== userId) return { ok: false, error: 'payment_not_found' }
    const ledger = await listByUser(client, 'creditLedger', userId)
    const purchased = ledger.filter(row => row.paymentIntentId === paymentId && number(row.deltaCredits ?? row.credits) > 0).reduce((sum, row) => sum + number(row.deltaCredits ?? row.credits), 0)
    const reversed = ledger.filter(row => row.paymentIntentId === paymentId && row.type === 'credit_purchase_reversal').reduce((sum, row) => sum + Math.abs(number(row.deltaCredits ?? row.credits)), 0)
    const remaining = Math.max(0, purchased - reversed); const now = nowIso()
    if (remaining > 0) await upsertRecord(client, 'creditLedger', { id: createId('credit_reversal'), userId, paymentIntentId: paymentId, deltaCredits: -remaining, credits: -remaining, type: 'credit_purchase_reversal', reason, createdAt: now, updatedAt: now }, { idempotencyKey: `credit-reversal:${paymentId}:${reason}`, operation: 'insert' })
    const updated = { ...payment, status: reason === 'dispute' ? 'disputed' : 'refunded', updatedAt: now }
    await upsertRecord(client, 'paymentIntents', updated, { idempotencyKey: `payment:${paymentId}:${updated.status}`, operation: 'update', expectedVersion: payment.version })
    return { ok: true, idempotent: remaining === 0, payment: updated, reversedCredits: remaining }
  }, { userId })
}

export async function reserveUsagePostgres({ userId, workspaceId = null, requestId, taskType, estimatedCredits, grantId = null, fundingSource = 'payg', metadata = {} }) {
  const credits = Math.max(0, number(estimatedCredits))
  if (!userId || !requestId || !taskType || credits <= 0) return { ok: false, error: 'reservation_fields_required' }
  if (!['subscription', 'payg', 'platform_subsidy'].includes(fundingSource)) return { ok: false, error: 'invalid_funding_source' }
  return withPlatformTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`usage:${requestId}`])
    const existing = await findByPayload(client, 'usageReservations', 'requestId', requestId, { forUpdate: true })
    if (existing) {
      const same = existing.userId === userId && existing.workspaceId === workspaceId && existing.taskType === taskType && number(existing.reservedCredits) === credits && existing.fundingSource === fundingSource
      return same ? { ok: true, idempotent: true, reservation: existing } : { ok: false, error: 'request_id_reservation_conflict' }
    }
    const accounts = await listByUser(client, 'walletAccounts', userId, { forUpdate: true })
    const ledger = await listByUser(client, 'creditLedger', userId)
    const reservations = await listByUser(client, 'usageReservations', userId, { forUpdate: true })
    const subscriptions = await listByUser(client, 'subscriptions', userId)
    const accountBalance = number(accounts[0]?.creditBalance)
    const ledgerBalance = ledger.reduce((sum, row) => sum + number(row.deltaCredits ?? row.credits), 0)
    const reservedPayg = reservations.filter(row => row.fundingSource === 'payg' && row.status === 'reserved').reduce((sum, row) => sum + number(row.reservedCredits), 0)
    const subscription = subscriptions.find(row => ['active', 'trialing'].includes(row.status))
    const included = number(subscription?.includedCredits ?? subscription?.monthlyCredits ?? subscription?.creditAllowance)
    const used = (await listByUser(client, 'usageEvents', userId)).filter(row => row.fundingSource === 'subscription' && row.status === 'completed').reduce((sum, row) => sum + number(row.credits), 0)
    const reservedSub = reservations.filter(row => row.fundingSource === 'subscription' && row.status === 'reserved').reduce((sum, row) => sum + number(row.reservedCredits), 0)
    const available = fundingSource === 'subscription' ? Math.max(0, included - used - reservedSub) : fundingSource === 'payg' ? accountBalance + ledgerBalance - reservedPayg : Number.POSITIVE_INFINITY
    if (fundingSource !== 'platform_subsidy' && available < credits) return { ok: false, error: fundingSource === 'subscription' ? 'subscription_allowance_exhausted' : 'insufficient_credits', availableCredits: available, requiredCredits: credits }
    const now = nowIso()
    const reservation = { id: createId('usage_reservation'), reservationId: requestId, requestId, userId, workspaceId, taskType, estimatedCredits: credits, reservedCredits: credits, settledCredits: 0, releasedCredits: 0, fundingSource, grantId, status: 'reserved', metadata, createdAt: now, updatedAt: now }
    await upsertRecord(client, 'usageReservations', reservation, { idempotencyKey: `usage-reservation:${requestId}`, operation: 'insert' })
    return { ok: true, idempotent: false, reservation }
  }, { userId })
}

export async function settleUsagePostgres(facts) {
  const requestId = String(facts.request_id || facts.requestId || '')
  const userId = String(facts.user_id || facts.userId || '')
  const taskType = String(facts.task_type || facts.taskType || '')
  const status = String(facts.status || 'completed')
  if (!requestId || !userId || !taskType) return { ok: false, error: 'request_id_user_id_task_type_required' }
  if (!['completed', 'failed', 'cancelled'].includes(status)) return { ok: false, error: 'invalid_execution_status' }
  return withPlatformTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`usage:${requestId}`])
    const existing = await findByPayload(client, 'usageEvents', 'requestId', requestId, { forUpdate: true })
    if (existing) return { ok: true, idempotent: true, usageEvent: existing, reservation: await findByPayload(client, 'usageReservations', 'requestId', requestId, { forUpdate: true }), workflowBudget: workflowBudgetSnapshot(existing.workflowId ? await findByPayload(client, 'workflowBudgets', 'workflowId', existing.workflowId) : null) }
    const reservation = await findByPayload(client, 'usageReservations', 'requestId', facts.reservation_id || facts.reservationId || requestId, { forUpdate: true })
    if (status === 'completed' && !reservation) return { ok: false, error: 'reservation_not_found', requestId }
    if (reservation && (reservation.userId !== userId || reservation.taskType !== taskType)) return { ok: false, error: 'reservation_execution_mismatch', requestId }
    const now = nowIso(); const economics = economicsForUsage({ ...facts, taskType, status }, reservation, null); const credits = economics.settledCredits
    const usageEvent = { id: createId('usage'), requestId, payloadHash: facts.payloadHash || null, userId, workspaceId: facts.workspace_id || facts.workspaceId || null, taskType, provider: facts.provider || 'unknown', model: facts.model || 'unknown', status, promptTokens: economics.inputTokens, completionTokens: economics.outputTokens, totalTokens: number(facts.total_tokens ?? facts.totalTokens), providerCostUsd: economics.providerCostUsd, infrastructureCostUsd: economics.infrastructureCostUsd, externalCostUsd: economics.externalCostUsd, paymentCostUsd: economics.paymentCostUsd, directServiceCogsUsd: economics.directServiceCogsUsd, totalVariableCostUsd: economics.totalVariableCostUsd, latencyMs: number(facts.latency_ms ?? facts.latencyMs), attemptCount: number(facts.attempt_count ?? facts.attemptCount, 1), cacheHit: Boolean(facts.cache_hit ?? facts.cacheHit), grantId: facts.grant_id || facts.grantId || null, reservationId: reservation?.reservationId || facts.reservation_id || facts.reservationId || null, credits, rateCardVersion: economics.rateCardVersion, totalCogs: economics.directServiceCogsUsd, customerPrice: economics.allocatedRevenueUsd, allocatedRevenueUsd: economics.allocatedRevenueUsd, grossProfitUsd: economics.grossProfitUsd, grossMargin: economics.grossMargin, marginStatus: economics.marginStatus, fundingSource: reservation?.fundingSource || 'unknown', workflowId: facts.workflow_id || facts.workflowId || null, costStatus: String(facts.cost_status || facts.costStatus || 'estimated'), pricingVersion: facts.pricing_version || facts.pricingVersion || null, metadata: facts.metadata || {}, createdAt: now, updatedAt: now }
    await upsertRecord(client, 'usageEvents', usageEvent, { idempotencyKey: `usage-event:${requestId}`, operation: 'insert' })
    if (reservation) {
      const next = { ...reservation, settledCredits: credits, releasedCredits: Math.max(0, number(reservation.reservedCredits) - credits), status: status === 'completed' ? 'settled' : 'refunded', updatedAt: now }
      await upsertRecord(client, 'usageReservations', next, { idempotencyKey: `usage-reservation-settle:${requestId}`, operation: 'update', expectedVersion: reservation.version })
    }
    if (credits > 0) await upsertRecord(client, 'creditLedger', { id: createId('usage_debit'), userId, workspaceId: usageEvent.workspaceId, requestId, deltaCredits: -credits, credits: -credits, type: 'usage_settlement', createdAt: now, updatedAt: now }, { idempotencyKey: `usage-debit:${requestId}`, operation: 'insert' })
    let workflowRow = null
    if (usageEvent.workflowId) {
      const existingBudget = await findByPayload(client, 'workflowBudgets', 'workflowId', usageEvent.workflowId, { forUpdate: true })
      workflowRow = mergeWorkflowBudget(existingBudget, {
        workflowId: usageEvent.workflowId, requestId, userId, workspaceId: usageEvent.workspaceId,
        providerCostUsd: economics.providerCostUsd, credits, costStatus: usageEvent.costStatus,
        pricingVersion: usageEvent.pricingVersion, maxCostUsd: resolveWorkflowCeiling(reservation, facts), status,
      })
      await upsertRecord(client, 'workflowBudgets', workflowRow, { idempotencyKey: `workflow-budget:${usageEvent.workflowId}`, operation: existingBudget ? 'update' : 'insert', expectedVersion: existingBudget?.version })
    }
    return { ok: true, idempotent: false, usageEvent, reservation, workflowBudget: workflowBudgetSnapshot(workflowRow) }
  }, { userId })
}

export function financePostgresEnabled() { return enabled() }

export async function findCapabilityConsumptionPostgres(idempotencyKey, consumptionId = null) {
  return withPlatformTransaction(async client => consumptionId ? findById(client, 'capabilityConsumptions', consumptionId) : findByPayload(client, 'capabilityConsumptions', 'idempotencyKey', idempotencyKey))
}

export async function createCapabilityConsumptionPostgres(consumption) {
  return withPlatformTransaction(async client => {
    const existing = await findByPayload(client, 'capabilityConsumptions', 'idempotencyKey', consumption.idempotencyKey, { forUpdate: true })
    if (existing) return existing.userId === consumption.userId && existing.capability === consumption.capability ? { ok: true, idempotent: true, consumption: existing } : { ok: false, error: 'idempotency_key_conflict' }
    await upsertRecord(client, 'capabilityConsumptions', consumption, { idempotencyKey: `capability-consumption:${consumption.idempotencyKey}`, operation: 'insert' })
    return { ok: true, idempotent: false, consumption }
  }, { userId: consumption.userId })
}

export async function settleCapabilityConsumptionPostgres(consumptionId, responseStatus, analytics) {
  return withPlatformTransaction(async client => {
    const current = await findById(client, 'capabilityConsumptions', consumptionId, { forUpdate: true })
    if (!current) return { ok: false, error: 'consumption_not_found' }
    if (current.status !== 'reserved') return { ok: true, idempotent: true, consumption: current }
    const now = nowIso(); const next = { ...current, status: analytics.success ? 'settled' : 'released', responseStatus: Number(responseStatus), updatedAt: now }
    await upsertRecord(client, 'capabilityConsumptions', next, { idempotencyKey: `capability-consumption:${consumptionId}:${next.status}`, operation: 'update', expectedVersion: current.version })
    await upsertRecord(client, 'capabilityAnalytics', { id: createId('capability_event'), userId: current.userId, capability: current.capability, eventType: analytics.success ? 'capability_completed' : 'capability_released', metadata: { fundingSource: current.fundingSource, credits: current.credits, responseStatus }, createdAt: now, updatedAt: now }, { idempotencyKey: `capability-analytics:${consumptionId}:${next.status}`, operation: 'insert' })
    return { ok: true, consumption: next }
  }, { userId: analytics.userId || null })
}

export async function saveWorkflowPostgres(userId, input = {}) {
  return withPlatformTransaction(async client => {
    const existing = await findByPayload(client, 'workflowSnapshots', 'clientRequestId', input.clientRequestId || '')
    if (existing && existing.userId === userId) return { ok: true, idempotent: true, workflow: existing }
    const now = nowIso(); const workflow = { id: createId('workflow'), userId, clientRequestId: input.clientRequestId || createId('request'), name: String(input.name || input.capability || 'TechIT workflow').trim(), capability: String(input.capability || '').trim(), payload: input.payload || {}, estimatedCredits: number(input.estimatedCredits), status: 'pending', createdAt: now, updatedAt: now }
    await upsertRecord(client, 'workflowSnapshots', workflow, { idempotencyKey: `workflow-create:${userId}:${workflow.clientRequestId}`, operation: 'insert' })
    return { ok: true, workflow }
  }, { userId })
}

export async function resumeWorkflowPostgres(userId, workflowId, input = {}) {
  return withPlatformTransaction(async client => {
    const current = await findById(client, 'workflowSnapshots', workflowId, { forUpdate: true })
    if (!current || current.userId !== userId) return { ok: false, error: 'workflow_not_found' }
    const now = nowIso(); const workflow = { ...current, status: input.status || 'resumed', resumedAt: now, updatedAt: now }
    await upsertRecord(client, 'workflowSnapshots', workflow, { idempotencyKey: `workflow-resume:${workflowId}:${now}`, operation: 'update', expectedVersion: current.version })
    return { ok: true, workflow }
  }, { userId })
}

export async function recordPaywallEventPostgres(event) {
  return withPlatformTransaction(async client => {
    const row = { id: createId('paywall'), ...event, createdAt: event.createdAt || nowIso() }
    await upsertRecord(client, 'paywallEvents', row, { idempotencyKey: `paywall:${row.id}`, operation: 'insert' })
    return { ok: true, event: row }
  }, { userId: event.userId })
}
