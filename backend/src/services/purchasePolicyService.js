const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

const RISK_RANK = Object.freeze({
  LOW: 0,
  NORMAL: 1,
  ELEVATED: 2,
  REVIEW: 3,
  HIGH: 4,
  RESTRICTED: 5,
  SUSPENDED: 6,
})

function positiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function nonNegativeNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function purchasePolicyConfig(env = process.env) {
  return {
    monthlyMaxCredits: positiveInteger(env.PURCHASE_MONTHLY_MAX_CREDITS, 100_000),
    monthlyMaxAmountUsd: nonNegativeNumber(env.PURCHASE_MONTHLY_MAX_AMOUNT_USD, 10_000),
    velocityMaxPerHour: positiveInteger(env.PURCHASE_VELOCITY_MAX_PER_HOUR, 10),
    maxPendingIntents: positiveInteger(env.PURCHASE_MAX_PENDING_INTENTS, 3),
    intentTtlMinutes: positiveInteger(env.PAYMENT_INTENT_TTL_MINUTES, 30),
    kycThresholdCredits: nonNegativeNumber(env.PURCHASE_KYC_THRESHOLD_CREDITS, 25_000),
    kycThresholdAmountUsd: nonNegativeNumber(env.PURCHASE_KYC_THRESHOLD_AMOUNT_USD, 2_500),
    kycValidityDays: positiveInteger(env.PURCHASE_KYC_VALIDITY_DAYS, 365),
  }
}

function timeValue(value) {
  const parsed = new Date(value || 0).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function newestFirst(rows = []) {
  return [...rows].sort((left, right) => timeValue(right.updatedAt || right.screenedAt || right.checkedAt || right.createdAt)
    - timeValue(left.updatedAt || left.screenedAt || left.checkedAt || left.createdAt))
}

export function highestRiskState(...states) {
  return states
    .map(state => String(state || '').toUpperCase())
    .filter(state => Object.hasOwn(RISK_RANK, state))
    .sort((left, right) => RISK_RANK[right] - RISK_RANK[left])[0] || 'NORMAL'
}

function strongVerification(row, now) {
  const status = String(row?.status || '').toLowerCase()
  const assurance = String(row?.assurance || '').toUpperCase()
  const expiresAt = row?.expiresAt || row?.expires_at
  return ['verified', 'trusted'].includes(status)
    && ['VERIFIED', 'TRUSTED', 'INSTITUTIONAL'].includes(assurance)
    && (!expiresAt || timeValue(expiresAt) > now.getTime())
}

function currentIdentityVerification(row, now, validityDays) {
  if (String(row?.kind || '').toLowerCase() !== 'kyc') return false
  if (String(row?.status || '').toLowerCase() !== 'verified') return false
  const checkedAt = row?.checkedAt || row?.checked_at || row?.createdAt || row?.created_at
  if (!checkedAt) return false
  if (row?.expiresAt || row?.expires_at) return timeValue(row.expiresAt || row.expires_at) > now.getTime()
  return timeValue(checkedAt) >= now.getTime() - Math.max(1, validityDays) * DAY_MS
}

export function resolvePurchaseIdentity({
  riskProfiles = [],
  verificationProfiles = [],
  identityVerifications = [],
  screeningResults = [],
  now = new Date(),
  config = purchasePolicyConfig(),
} = {}) {
  const current = now instanceof Date ? now : new Date(now)
  const riskStates = (riskProfiles || []).map(row => row?.state || row?.riskState)
  const latestScreening = newestFirst(screeningResults)[0]
  const screeningStatus = String(latestScreening?.status || '').toLowerCase()
  if (screeningStatus === 'match' || Number(latestScreening?.matchCount || 0) > 0) riskStates.push('HIGH')
  else if (screeningStatus === 'potential_match') riskStates.push('REVIEW')
  const kycVerified = (riskProfiles || []).some(row => row?.kycVerified === true)
    || (verificationProfiles || []).some(row => strongVerification(row, current))
    || (identityVerifications || []).some(row => currentIdentityVerification(row, current, config.kycValidityDays))
  return { riskState: highestRiskState(...riskStates), kycVerified }
}

function atOrAfter(value, threshold) {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) && time >= threshold
}

function monthlyIntent(intent) {
  return !['expired', 'cancelled', 'failed'].includes(String(intent?.status || '').toLowerCase())
}

function attemptedIntent(intent) {
  return !['expired', 'cancelled'].includes(String(intent?.status || '').toLowerCase())
}

export function purchaseUsage(intents = [], now = new Date()) {
  const current = now instanceof Date ? now : new Date(now)
  const monthStart = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)
  const hourStart = current.getTime() - HOUR_MS
  const monthly = intents.filter(intent => monthlyIntent(intent) && atOrAfter(intent.createdAt, monthStart))
  const hourly = intents.filter(intent => attemptedIntent(intent) && atOrAfter(intent.createdAt, hourStart))
  const pending = intents.filter(intent => {
    if (String(intent.status || '').toLowerCase() !== 'pending') return false
    const expiresAt = new Date(intent.expiresAt || 0).getTime()
    return !Number.isFinite(expiresAt) || expiresAt > current.getTime()
  })
  return {
    monthlyCredits: monthly.reduce((sum, intent) => sum + Math.max(0, Number(intent.credits) || 0), 0),
    monthlyAmountUsd: monthly
      .filter(intent => String(intent.currency || 'USD').toUpperCase() === 'USD')
      .reduce((sum, intent) => sum + Math.max(0, Number(intent.amount) || 0) / 100, 0),
    hourlyPurchases: hourly.length,
    pendingIntents: pending.length,
  }
}

function policyFailure(error, status, detail = {}) {
  return { ok: false, error, status, ...detail }
}

export function evaluatePurchasePolicy({
  credits,
  amount,
  currency = 'USD',
  intents = [],
  riskState = 'NORMAL',
  kycVerified = false,
  now = new Date(),
  config = purchasePolicyConfig(),
}) {
  const requestedCredits = Math.max(0, Number(credits) || 0)
  const requestedAmount = Math.max(0, Number(amount) || 0)
  const requestedAmountUsd = String(currency || 'USD').toUpperCase() === 'USD' ? requestedAmount / 100 : 0
  const usage = purchaseUsage(intents, now)
  const risk = String(riskState || 'NORMAL').toUpperCase()
  const limits = {
    monthlyMaxCredits: config.monthlyMaxCredits,
    monthlyMaxAmountUsd: config.monthlyMaxAmountUsd,
    velocityMaxPerHour: config.velocityMaxPerHour,
    maxPendingIntents: config.maxPendingIntents,
    intentTtlMinutes: config.intentTtlMinutes,
    kycThresholdCredits: config.kycThresholdCredits,
    kycThresholdAmountUsd: config.kycThresholdAmountUsd,
    kycValidityDays: config.kycValidityDays,
  }
  if (['REVIEW', 'HIGH', 'RESTRICTED', 'SUSPENDED'].includes(risk)) {
    return policyFailure('purchase_risk_review_required', 403, { riskState: risk, limits, usage })
  }
  if (usage.hourlyPurchases >= config.velocityMaxPerHour) {
    return policyFailure('purchase_velocity_exceeded', 429, {
      riskState: risk,
      limits,
      usage,
      retryAfterSeconds: 3600,
    })
  }
  if (usage.pendingIntents >= config.maxPendingIntents) {
    return policyFailure('too_many_pending_payment_intents', 409, {
      riskState: risk,
      limits,
      usage,
    })
  }
  if (usage.monthlyCredits + requestedCredits > config.monthlyMaxCredits) {
    return policyFailure('monthly_credit_purchase_limit_exceeded', 409, {
      riskState: risk,
      limits,
      usage,
      requestedCredits,
    })
  }
  if (requestedAmountUsd > 0 && usage.monthlyAmountUsd + requestedAmountUsd > config.monthlyMaxAmountUsd) {
    return policyFailure('monthly_purchase_amount_limit_exceeded', 409, {
      riskState: risk,
      limits,
      usage,
      requestedAmountUsd,
    })
  }
  const kycEscalation = (
    requestedCredits >= config.kycThresholdCredits
    || (requestedAmountUsd > 0 && requestedAmountUsd >= config.kycThresholdAmountUsd)
  )
  const elevatedRiskKyc = risk === 'ELEVATED'
  if ((kycEscalation || elevatedRiskKyc) && !kycVerified) {
    return policyFailure(kycEscalation ? 'kyc_required_for_high_value_purchase' : 'kyc_required_for_elevated_risk', 403, {
      riskState: risk,
      limits,
      usage,
      kycRequired: true,
      kycReason: kycEscalation ? 'high_value_purchase' : 'elevated_risk',
      requestedCredits,
      requestedAmountUsd,
    })
  }
  return {
    ok: true,
    riskState: risk,
    kycRequired: kycEscalation,
    limits,
    usage,
    requestedCredits,
    requestedAmountUsd,
  }
}

export function intentExpiry(createdAt, ttlMinutes) {
  const created = new Date(createdAt || Date.now()).getTime()
  return new Date(created + Math.max(1, Number(ttlMinutes) || 30) * 60 * 1000).toISOString()
}
