import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'
import { verifyMfaAssertion } from './mfaService.js'
import { reserveCapabilityConsumption, settleCapabilityConsumption } from './capabilityConsumptionService.js'
import { activateRoleAssignment, switchContext } from './multiRoleContextService.js'

export const ASSURANCE_LEVELS = Object.freeze({
  CLAIMED: 0,
  PROFILED: 1,
  PARTIALLY_VERIFIED: 2,
  VERIFIED: 3,
  TRUSTED: 4,
  INSTITUTIONAL: 5,
})

const ROLE_ALIASES = { organisation: 'organization', user: 'explorer', explorer: 'explorer' }
const normalizeRole = value => ROLE_ALIASES[String(value || '').toLowerCase()] || String(value || '').toLowerCase()
const rank = value => ASSURANCE_LEVELS[String(value || 'CLAIMED').toUpperCase()] ?? ASSURANCE_LEVELS.CLAIMED
const activeSubscription = (db, userId) => (db.subscriptions || []).find(row => row.userId === userId && ['active', 'trialing'].includes(row.status)) || null
const KNOWN_ROLES = new Set(['founder', 'collaborator', 'investor', 'mentor', 'organization', 'explorer'])
const KNOWN_FUNDING = new Set(['subscription', 'credits', 'subscription_or_credits', undefined])

export const CAPABILITY_POLICIES = Object.freeze({
  'startup.discovery': { roles: [], assurance: 'CLAIMED' },
  'startup.basic_profile.view': { roles: [], assurance: 'CLAIMED' },
  'startup.sensitive_profile.view': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'founder.contact': { roles: ['investor', 'organization'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'founder.direct_message': { roles: ['investor', 'organization'], assurance: 'PARTIALLY_VERIFIED', funding: 'credits', credits: 1 },
  'investment.opportunity.view': { roles: ['investor'], assurance: 'PROFILED' },
  'investment.indication.submit': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 2 },
  'dealroom.access': { roles: ['investor'], assurance: 'TRUSTED', funding: 'subscription_or_credits', credits: 3, mfaRequired: true },
  'investor.intelligence.view': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'institutional.analytics': { roles: ['investor', 'organization'], assurance: 'INSTITUTIONAL', funding: 'subscription', credits: 0, mfaRequired: true },
  'organization.profile.manage': { roles: ['organization'], assurance: 'PROFILED' },
  'organization.recruit': { roles: ['organization'], assurance: 'PARTIALLY_VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'organization.analytics': { roles: ['organization'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'organization.opportunity.create': { roles: ['organization'], assurance: 'PARTIALLY_VERIFIED' },
  'mentorship.room.create': { roles: ['investor', 'mentor'], assurance: 'PROFILED' },
  'mentorship.room.manage': { roles: ['investor', 'mentor'], assurance: 'PROFILED' },
  'mentorship.application.review': { roles: ['investor', 'mentor'], assurance: 'PROFILED' },
  'mentorship.invite.share': { roles: ['investor', 'mentor'], assurance: 'PROFILED' },
  'mentorship.apply': { roles: [], assurance: 'CLAIMED' },
})

const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const profileFor = (db, userId) => collection(db, 'profiles').find(row => row.id === userId) || null
const rolesFor = (profile, userRoles = []) => {
  const assignments = userRoles.filter(row => row.active !== false && row.status === 'active')
  const assignedNames = new Set(userRoles.map(row => normalizeRole(row.role)).filter(Boolean))
  const legacy = [profile?.role, ...(profile?.secondaryRoles || []), ...(profile?.roles || [])]
    .map(normalizeRole)
    .filter(role => role && !assignedNames.has(role))
  return [...new Set(['explorer', ...assignments.map(row => normalizeRole(row.role)), ...legacy])]
}

function legacyAssurance(profile, role) {
  if (!profile) return 'CLAIMED'
  return profile.isOnboarded || profile.isVerified ? 'PROFILED' : 'CLAIMED'
}

function derivedTrustProfile(db, userId, role = null) {
  const profile = profileFor(db, userId)
  const userRoles = (db.userRoles || []).filter(row => row.userId === userId && row.active !== false)
  const targetRole = normalizeRole(role || profile?.activeRole || profile?.role || 'explorer')
  const verification = (db.verificationProfiles || []).find(row => row.userId === userId && normalizeRole(row.role) === targetRole)
  const risk = (db.riskProfiles || []).find(row => row.userId === userId) || { state: 'NORMAL' }
  const expired = verification?.expiresAt && new Date(verification.expiresAt).getTime() <= Date.now()
  const assurance = expired ? 'PROFILED' : (verification?.assurance || legacyAssurance(profile, targetRole))
  return { userId, activeRole: targetRole, roles: rolesFor(profile, userRoles), assuranceByRole: { [targetRole]: assurance }, assurance, riskState: risk.state || 'NORMAL', trustScore: Number(verification?.trustScore ?? profile?.credibilityScore ?? 0), persisted: false }
}

export function trustProfileFor(userId, role = null) {
  return derivedTrustProfile(readDb(), userId, role)
}

export function availableCredits(db, userId) {
  const account = collection(db, 'walletAccounts').find(row => row.userId === userId)
  const ledger = collection(db, 'creditLedger').filter(row => row.userId === userId).reduce((sum, row) => sum + Number(row.deltaCredits ?? row.credits ?? 0), 0)
  const reserved = collection(db, 'usageReservations').filter(row => row.userId === userId && row.fundingSource === 'payg' && row.status === 'reserved').reduce((sum, row) => sum + Number(row.reservedCredits || 0), 0)
  return Math.max(0, Number(account?.creditBalance || 0) + ledger - reserved)
}

export function subscriptionEntitlement(db, userId) {
  const subscription = activeSubscription(db, userId)
  const plan = subscription?.plan || subscription?.planId || null
  const planRecord = collection(db, 'billingPlans').find(row => row.id === plan || row.slug === plan || row.name === plan)
  return { active: Boolean(subscription), plan, status: subscription?.status || 'none', expiresAt: subscription?.expiresAt || subscription?.currentPeriodEnd || null, entitlements: subscription?.entitlements || planRecord?.entitlements || planRecord?.capabilities || {} }
}

export function ensureTrustProfile(db, userId, role = null) {
  const profile = profileFor(db, userId)
  const userRoles = collection(db, 'userRoles').filter(row => row.userId === userId && row.active !== false)
  const roles = rolesFor(profile, userRoles)
  const targetRole = normalizeRole(role || roles[0] || 'explorer')
  const existing = collection(db, 'trustProfiles').find(row => row.userId === userId)
  const verification = collection(db, 'verificationProfiles').find(row => row.userId === userId && normalizeRole(row.role) === targetRole)
  const risk = collection(db, 'riskProfiles').find(row => row.userId === userId) || { state: 'NORMAL', score: 0 }
  const expired = verification?.expiresAt && new Date(verification.expiresAt).getTime() <= Date.now()
  const assurance = expired ? 'PROFILED' : (verification?.assurance || legacyAssurance(profile, targetRole))
  const next = { id: existing?.id || createId('trust'), userId, activeRole: targetRole, roles, assuranceByRole: { ...(existing?.assuranceByRole || {}), [targetRole]: assurance }, assurance, riskState: risk.state || 'NORMAL', trustScore: Number(verification?.trustScore ?? existing?.trustScore ?? (profile?.credibilityScore || 0)), updatedAt: nowIso(), createdAt: existing?.createdAt || nowIso() }
  if (existing) Object.assign(existing, next)
  else collection(db, 'trustProfiles').push(next)
  return next
}

export function capabilityPolicy(capability, db = readDb()) {
  const stored = collection(db, 'capabilityPolicies').find(row => row.capability === capability && row.active !== false)
  return stored ? { ...CAPABILITY_POLICIES[capability], ...stored.policy } : CAPABILITY_POLICIES[capability] || null
}

export function updateCapabilityPolicy(adminId, capability, patch = {}) {
  if (!CAPABILITY_POLICIES[capability]) return { ok: false, error: 'unknown_capability' }
  if (patch.roles && (!Array.isArray(patch.roles) || patch.roles.some(role => !KNOWN_ROLES.has(normalizeRole(role))))) return { ok: false, error: 'invalid_roles' }
  if (patch.assurance && !(String(patch.assurance).toUpperCase() in ASSURANCE_LEVELS)) return { ok: false, error: 'invalid_assurance' }
  if (!KNOWN_FUNDING.has(patch.funding)) return { ok: false, error: 'invalid_funding' }
  if (patch.credits !== undefined && (!Number.isFinite(Number(patch.credits)) || Number(patch.credits) < 0 || Number(patch.credits) > 100000)) return { ok: false, error: 'invalid_credits' }
  return updateDb(db => {
    const policies = collection(db, 'capabilityPolicies')
    let row = policies.find(item => item.capability === capability)
    if (!row) { row = { id: createId('cap_policy'), capability, policy: {}, active: true, createdAt: nowIso() }; policies.push(row) }
    row.policy = { ...(row.policy || {}), ...patch }
    row.updatedAt = nowIso()
    collection(db, 'verificationAuditLogs').push({ id: createId('verification_audit'), action: 'capability_policy_updated', capability, actorId: adminId, policyVersion: 'capability-v1', metadata: row.policy, createdAt: nowIso() })
    return { ok: true, capability, policy: capabilityPolicy(capability, db) }
  })
}

export function auditCapabilityDecision(decision, userId) {
  return updateDb(db => {
    collection(db, 'authorizationAuditLogs').push({ id: createId('authorization_audit'), userId, capability: decision.capability, allowed: decision.allowed, code: decision.code, activeRole: decision.activeRole || null, assurance: decision.assurance || null, riskState: decision.riskState || null, policyVersion: 'capability-v1', createdAt: nowIso() })
    collection(db, 'capabilityAnalytics').push({ id: createId('capability_event'), userId, capability: decision.capability, eventType: decision.allowed ? 'capability_allowed' : 'capability_denied', role: decision.activeRole || null, assurance: decision.assurance || null, code: decision.code, createdAt: nowIso() })
    return decision
  })
}

export function authorizeCapability(userId, capability, context = {}) {
  const db = readDb()
  const policy = capabilityPolicy(capability, db)
  const profile = profileFor(db, userId)
  if (!policy) return { allowed: false, code: 'unknown_capability', capability }
  if (!profile) return { allowed: false, code: 'profile_required', capability, policy }
  const trust = (db.trustProfiles || []).find(row => row.userId === userId) || derivedTrustProfile(db, userId, context.role)
  const activeRole = normalizeRole(context.role || profile.activeRole || trust.activeRole || profile.role)
  const verification = (db.verificationProfiles || []).find(row => row.userId === userId && normalizeRole(row.role) === activeRole)
  const verificationExpired = verification?.expiresAt && new Date(verification.expiresAt).getTime() <= Date.now()
  const currentAssurance = verificationExpired ? 'PROFILED' : (verification?.assurance || trust.assuranceByRole?.[activeRole] || legacyAssurance(profile, activeRole))
  const roles = rolesFor(profile, (db.userRoles || []).filter(row => row.userId === userId && row.active !== false))
  const risk = (db.riskProfiles || []).find(row => row.userId === userId)?.state || trust.riskState || 'NORMAL'
  const subscription = subscriptionEntitlement(db, userId)
  const credits = availableCredits(db, userId)
  const reasons = []
  if (policy.roles.length && (!roles.includes(activeRole) || !policy.roles.includes(activeRole))) reasons.push('role_required')
  if (rank(currentAssurance) < rank(policy.assurance)) reasons.push('verification_required')
  if (['HIGH', 'RESTRICTED', 'SUSPENDED'].includes(String(risk).toUpperCase())) reasons.push('risk_restricted')
  if (policy.funding === 'subscription' && !subscription.active) reasons.push('active_subscription_required')
  if (policy.funding === 'credits' && credits < Number(policy.credits || 0)) reasons.push('credits_required')
  if (policy.funding === 'subscription_or_credits' && !subscription.active && credits < Number(policy.credits || 0)) reasons.push('subscription_or_credits_required')
  const entitlement = subscription.entitlements?.[capability]
  if (subscription.active && entitlement === false) reasons.push('plan_capability_not_included')
  if (policy.mfaRequired && !verifyMfaAssertion(userId, context.mfaAssertion)) reasons.push('mfa_required')
  if (context.organizationId) {
    const membership = collection(db, 'organizationMemberships').find(row => row.organizationId === context.organizationId && row.userId === userId && row.status === 'active')
    if (!membership) reasons.push('organization_membership_required')
    if (context.membershipRoles?.length && !context.membershipRoles.includes(membership?.role)) reasons.push('organization_permission_required')
  }
  return { allowed: reasons.length === 0, code: reasons[0] || 'allowed', reasons, capability, activeRole, assurance: currentAssurance, riskState: risk, subscription, availableCredits: credits, requiredCredits: Number(policy.credits || 0), policy }
}

export function requireCapability(capability, contextFactory = () => ({}), options = {}) {
  return (req, res, next) => {
    const decision = authorizeCapability(req.user.id, capability, { ...(req.user.activeContext || {}), ...contextFactory(req), mfaAssertion: req.get('x-mfa-assertion') })
    void auditCapabilityDecision(decision, req.user.id)
    if (decision.allowed) {
      req.capabilityDecision = decision
      if (options.consume) {
        const key = req.get('idempotency-key') || `${req.id}:${capability}`
        const reservation = reserveCapabilityConsumption(req.user.id, decision, key)
        if (!reservation.ok) return res.status(reservation.error === 'insufficient_credits' ? 402 : 409).json(reservation)
        req.capabilityConsumption = reservation.consumption
        res.on('finish', () => { void settleCapabilityConsumption(reservation.consumption.id, res.statusCode) })
      }
      return next()
    }
    return res.status(['active_subscription_required', 'credits_required', 'subscription_or_credits_required', 'plan_capability_not_included'].includes(decision.code) ? 402 : 403).json({ error: decision.code, capability, decision, verification: decision.code === 'verification_required' ? { required: decision.policy?.assurance } : undefined })
  }
}

export function switchActiveRole(userId, role) {
  const result = switchContext(userId, { role })
  if (!result.ok) return result
  return updateDb(db => {
    const normalized = normalizeRole(role)
    const trust = ensureTrustProfile(db, userId, normalized); trust.activeRole = normalized
    collection(db, 'verificationAuditLogs').push({ id: createId('verification_audit'), userId, action: 'active_role_switched', role: normalized, policyVersion: 'capability-v1', createdAt: nowIso() })
    return { ...result, activeRole: normalized, roles: result.availableContexts.map(item => item.role) }
  })
}

export function roleActivation(userId, role, profilePatch = {}) {
  const activated = activateRoleAssignment(userId, role, profilePatch)
  if (!activated.ok) return activated
  return updateDb(db => {
    const normalized = normalizeRole(role)
    const profile = profileFor(db, userId)
    const roleProfiles = collection(db, 'roleProfiles')
    const roleProfile = roleProfiles.find(row => row.userId === userId && normalizeRole(row.role) === normalized)
    if (roleProfile) Object.assign(roleProfile, profile?.roleProfiles?.[normalized] || {})
    else roleProfiles.push({ id: createId('role_profile'), userId, role: normalized, ...(profile?.roleProfiles?.[normalized] || {}) })
    ensureTrustProfile(db, userId, normalized)
    collection(db, 'verificationAuditLogs').push({ id: createId('verification_audit'), userId, action: 'role_activated', role: normalized, previousState: null, newState: 'CLAIMED', policyVersion: 'capability-v1', createdAt: nowIso() })
    return { ...activated, profile }
  })
}
