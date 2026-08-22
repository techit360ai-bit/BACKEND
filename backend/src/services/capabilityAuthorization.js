import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'

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
const KNOWN_ROLES = new Set(['founder', 'collaborator', 'investor', 'organization', 'explorer'])
const KNOWN_FUNDING = new Set(['subscription', 'credits', 'subscription_or_credits', undefined])

export const CAPABILITY_POLICIES = Object.freeze({
  'startup.discovery': { roles: [], assurance: 'CLAIMED' },
  'startup.basic_profile.view': { roles: [], assurance: 'CLAIMED' },
  'startup.sensitive_profile.view': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'founder.contact': { roles: ['investor', 'organization'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'founder.direct_message': { roles: ['investor', 'organization'], assurance: 'PARTIALLY_VERIFIED', funding: 'credits', credits: 1 },
  'investment.opportunity.view': { roles: ['investor'], assurance: 'PROFILED' },
  'investment.indication.submit': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 2 },
  'dealroom.access': { roles: ['investor'], assurance: 'TRUSTED', funding: 'subscription_or_credits', credits: 3 },
  'investor.intelligence.view': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'investor.mentorship.intelligence': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'investor.portfolio.analytics': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'investor.risk.monitor': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'investor.ai.recommendations': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'investor.dealroom.create': { roles: ['investor'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'investor.dealroom.view': { roles: ['investor', 'founder'], assurance: 'PROFILED' },
  'investor.dealroom.manage': { roles: ['investor', 'founder'], assurance: 'PROFILED' },
  'investor.dealroom.internal': { roles: ['investor'], assurance: 'PROFILED' },
  'institutional.analytics': { roles: ['investor', 'organization'], assurance: 'INSTITUTIONAL', funding: 'subscription', credits: 0 },
  'organization.profile.manage': { roles: ['organization'], assurance: 'PROFILED' },
  'organization.recruit': { roles: ['organization'], assurance: 'PARTIALLY_VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'organization.analytics': { roles: ['organization'], assurance: 'VERIFIED', funding: 'subscription_or_credits', credits: 1 },
  'organization.opportunity.create': { roles: ['organization'], assurance: 'PARTIALLY_VERIFIED' },
})

const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const profileFor = (db, userId) => collection(db, 'profiles').find(row => row.id === userId) || null
const rolesFor = (profile, userRoles = []) => [...new Set([profile?.role, ...(profile?.secondaryRoles || []), ...(profile?.roles || []), ...userRoles.map(row => row.role)].map(normalizeRole).filter(Boolean))]

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

export function availableCredits(db, userId) {
  const account = collection(db, 'walletAccounts').find(row => row.userId === userId)
  const ledger = collection(db, 'creditLedger').filter(row => row.userId === userId).reduce((sum, row) => sum + Number(row.deltaCredits ?? row.credits ?? 0), 0)
  const reserved = collection(db, 'usageReservations').filter(row => row.userId === userId && row.fundingSource === 'payg' && row.status === 'reserved').reduce((sum, row) => sum + Number(row.reservedCredits || 0), 0)
  return Math.max(0, Number(account?.creditBalance || 0) + ledger - reserved)
}

export function subscriptionEntitlement(db, userId) {
  const subscription = activeSubscription(db, userId)
  return { active: Boolean(subscription), plan: subscription?.plan || subscription?.planId || null, status: subscription?.status || 'none', expiresAt: subscription?.expiresAt || subscription?.currentPeriodEnd || null }
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
  if (context.organizationId) {
    const membership = collection(db, 'organizationMemberships').find(row => row.organizationId === context.organizationId && row.userId === userId && row.status === 'active')
    if (!membership) reasons.push('organization_membership_required')
    if (context.membershipRoles?.length && !context.membershipRoles.includes(membership?.role)) reasons.push('organization_permission_required')
  }
  return { allowed: reasons.length === 0, code: reasons[0] || 'allowed', reasons, capability, activeRole, assurance: currentAssurance, riskState: risk, subscription, availableCredits: credits, requiredCredits: Number(policy.credits || 0), policy }
}

export function requireCapability(capability, contextFactory = () => ({})) {
  return (req, res, next) => {
    const decision = authorizeCapability(req.user.id, capability, contextFactory(req))
    void auditCapabilityDecision(decision, req.user.id)
    if (decision.allowed) { req.capabilityDecision = decision; return next() }
    return res.status(['active_subscription_required', 'credits_required', 'subscription_or_credits_required'].includes(decision.code) ? 402 : 403).json({ error: decision.code, capability, decision, verification: decision.code === 'verification_required' ? { required: decision.policy?.assurance } : undefined })
  }
}

export function switchActiveRole(userId, role) {
  const normalized = normalizeRole(role)
  return updateDb(db => {
    const profile = profileFor(db, userId)
    if (!profile) return { ok: false, error: 'profile_not_found' }
    const roles = rolesFor(profile, collection(db, 'userRoles').filter(row => row.userId === userId && row.active !== false))
    if (!roles.includes(normalized)) return { ok: false, error: 'role_not_activated' }
    profile.activeRole = normalized; profile.updatedAt = nowIso()
    const trust = ensureTrustProfile(db, userId, normalized); trust.activeRole = normalized
    collection(db, 'verificationAuditLogs').push({ id: createId('verification_audit'), userId, action: 'active_role_switched', role: normalized, policyVersion: 'capability-v1', createdAt: nowIso() })
    return { ok: true, activeRole: normalized, roles }
  })
}

export function roleActivation(userId, role, profilePatch = {}) {
  const normalized = normalizeRole(role)
  if (!['founder', 'collaborator', 'investor', 'organization', 'explorer'].includes(normalized)) return { ok: false, error: 'role_unavailable' }
  return updateDb(db => {
    const profile = profileFor(db, userId)
    if (!profile) return { ok: false, error: 'profile_not_found' }
    profile.secondaryRoles = [...new Set([...(profile.secondaryRoles || []), normalized])].filter(value => value !== profile.role)
    profile.roleProfiles = { ...(profile.roleProfiles || {}), [normalized]: { ...(profile.roleProfiles?.[normalized] || {}), ...profilePatch, activatedAt: profile.roleProfiles?.[normalized]?.activatedAt || nowIso(), updatedAt: nowIso() } }
    const roleProfiles = collection(db, 'roleProfiles')
    const roleProfile = roleProfiles.find(row => row.userId === userId && row.role === normalized)
    if (roleProfile) Object.assign(roleProfile, profile.roleProfiles[normalized])
    else roleProfiles.push({ id: createId('role_profile'), userId, role: normalized, ...profile.roleProfiles[normalized] })
    const roles = collection(db, 'userRoles')
    let record = roles.find(row => row.userId === userId && row.role === normalized)
    if (!record) { record = { id: createId('user_role'), userId, role: normalized, status: 'active', assurance: 'CLAIMED', createdAt: nowIso() }; roles.push(record) }
    record.status = 'active'; record.updatedAt = nowIso()
    ensureTrustProfile(db, userId, normalized)
    collection(db, 'verificationAuditLogs').push({ id: createId('verification_audit'), userId, action: 'role_activated', role: normalized, previousState: null, newState: 'CLAIMED', policyVersion: 'capability-v1', createdAt: nowIso() })
    return { ok: true, role: normalized, profile, userRole: record }
  })
}
