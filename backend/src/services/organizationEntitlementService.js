import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'grace_period'])

export const ORGANIZATION_CAPABILITIES = Object.freeze({
  ORGANIZATION_PROFILE: { access: 'free' },
  ORGANIZATION_BASIC_DASHBOARD: { access: 'free' },
  ORGANIZATION_PROGRAM_SETUP: { access: 'free', limit: 'programs' },
  ORGANIZATION_BASIC_COHORT: { access: 'free', limit: 'cohorts' },
  ORGANIZATION_BASIC_REPORTING: { access: 'free', limit: 'reports' },
  ORGANIZATION_HACKATHON_BASIC: { access: 'free', limit: 'hackathons' },
  ORGANIZATION_MONITORING: { access: 'funded' },
  COHORT_INTELLIGENCE: { access: 'funded' },
  MENTOR_INTELLIGENCE: { access: 'funded' },
  ORGANIZATION_HACKATHON_ADVANCED: { access: 'funded' },
  ORGANIZATION_MANAGED_HACKATHON: { access: 'subscription' },
  ORGANIZATION_PROGRAM_ANALYTICS: { access: 'funded' },
  ORGANIZATION_INTERVENTIONS: { access: 'funded' },
  ORGANIZATION_REPORT_EXPORT: { access: 'funded' },
  ORGANIZATION_SPONSOR_MANAGEMENT: { access: 'subscription' },
  ORGANIZATION_INTEGRATIONS: { access: 'subscription' },
  ORGANIZATION_WHITE_LABEL: { access: 'subscription' },
  ORGANIZATION_SUPPORT_WORKFLOW: { access: 'subscription' },
})

export const COMMUNITY_HOST_LIMITS = Object.freeze({
  programs: 1,
  cohorts: 1,
  hackathons: 1,
  participants: 100,
  projects: 50,
  organizers: 10,
  judges: 10,
  mentors: 10,
  reports: 3,
  storageBytes: 250 * 1024 * 1024,
})

const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const text = value => typeof value === 'string' ? value.trim() : ''
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0
const active = row => ACTIVE_STATUSES.has(String(row?.status || '').toLowerCase()) && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now())

function organizationExists(db, organizationId) {
  return collection(db, 'organizations').some(row => row.id === organizationId) ||
    collection(db, 'organizationMemberships').some(row => row.organizationId === organizationId && row.status === 'active') ||
    collection(db, 'organizationDashboards').some(row => row.ownerId === organizationId) ||
    collection(db, 'projects').some(row => row.organizationId === organizationId)
}

function defaultEntitlement(organizationId) {
  return {
    id: `community:${organizationId}`,
    organizationId,
    plan: 'community_host',
    source: 'platform_default',
    status: 'active',
    capabilities: Object.fromEntries(Object.entries(ORGANIZATION_CAPABILITIES).map(([capability, policy]) => [capability, policy.access === 'free'])),
    limits: { ...COMMUNITY_HOST_LIMITS },
    startsAt: null,
    expiresAt: null,
    isDefault: true,
  }
}

export function organizationEntitlement(organizationId, db = readAuthorityDb()) {
  if (!organizationId || !organizationExists(db, organizationId)) return null
  const row = collection(db, 'organizationEntitlements').filter(item => item.organizationId === organizationId && active(item)).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
  if (!row) return defaultEntitlement(organizationId)
  return {
    ...defaultEntitlement(organizationId),
    ...row,
    capabilities: { ...defaultEntitlement(organizationId).capabilities, ...(row.capabilities || {}) },
    limits: { ...COMMUNITY_HOST_LIMITS, ...(row.limits || {}) },
    isDefault: false,
  }
}

function countOrganization(db, organizationId, kind) {
  const counts = {
    programs: collection(db, 'organizationPrograms').filter(row => row.organizationId === organizationId && !['archived', 'completed', 'closed'].includes(String(row.status || '').toLowerCase())).length,
    cohorts: collection(db, 'organizationCohorts').filter(row => row.organizationId === organizationId && !['archived', 'completed', 'closed'].includes(String(row.status || '').toLowerCase())).length,
    hackathons: collection(db, 'hackathons').filter(row => row.organizationId === organizationId && !['archived', 'completed', 'closed'].includes(String(row.status || '').toLowerCase())).length,
    participants: collection(db, 'hackathonMembers').filter(row => row.organizationId === organizationId || row.ownerOrganizationId === organizationId).length,
    projects: collection(db, 'projects').filter(row => row.organizationId === organizationId).length,
    organizers: collection(db, 'organizationMemberships').filter(row => row.organizationId === organizationId && row.status === 'active').length,
    judges: collection(db, 'hackathonMembers').filter(row => (row.organizationId === organizationId || row.ownerOrganizationId === organizationId) && ['judge', 'reviewer'].includes(String(row.role || '').toLowerCase())).length,
    mentors: collection(db, 'mentorshipRooms').filter(row => row.organizationId === organizationId).length,
    reports: collection(db, 'organizationReports').filter(row => row.organizationId === organizationId).length,
  }
  return counts[kind] ?? 0
}

export function organizationCapacity(organizationId, kind, db = readAuthorityDb()) {
  const entitlement = organizationEntitlement(organizationId, db)
  if (!entitlement) return { ok: false, error: 'organization_entitlement_not_found', organizationId, kind }
  const limit = entitlement.limits?.[kind]
  if (limit == null) return { ok: true, organizationId, kind, used: countOrganization(db, organizationId, kind), limit: null, remaining: null }
  const used = countOrganization(db, organizationId, kind)
  return { ok: used < numeric(limit), error: used < numeric(limit) ? null : `organization_${kind}_limit_reached`, organizationId, kind, used, limit: numeric(limit), remaining: Math.max(0, numeric(limit) - used) }
}

export function evaluateOrganizationEntitlement(organizationId, capability, { db = readAuthorityDb(), consume = false } = {}) {
  const entitlement = organizationEntitlement(organizationId, db)
  if (!entitlement) return { allowed: false, code: 'organization_entitlement_not_found', capability, organizationId }
  const policy = ORGANIZATION_CAPABILITIES[capability]
  if (!policy) return { allowed: false, code: 'organization_capability_unknown', capability, organizationId, entitlement }
  if (entitlement.capabilities?.[capability] === false) return { allowed: false, code: 'organization_plan_capability_not_included', capability, organizationId, entitlement }
  if (policy.access !== 'free' && entitlement.capabilities?.[capability] !== true) return { allowed: false, code: policy.access === 'subscription' ? 'organization_subscription_required' : 'organization_funding_required', capability, organizationId, entitlement }
  const capacity = policy.limit ? organizationCapacity(organizationId, policy.limit, db) : { ok: true }
  if (!capacity.ok && consume) return { allowed: false, code: capacity.error, capability, organizationId, entitlement, capacity }
  return { allowed: true, code: 'allowed', capability, organizationId, entitlement, capacity }
}

export function saveOrganizationEntitlement(adminId, input = {}) {
  const organizationId = text(input.organizationId)
  if (!organizationId) return { ok: false, error: 'organization_id_required' }
  if (!organizationExists(readAuthorityDb(), organizationId)) return { ok: false, error: 'organization_not_found' }
  return updateAuthorityDb(db => {
    const entitlements = collection(db, 'organizationEntitlements')
    const row = entitlements.find(item => item.id === input.id && item.organizationId === organizationId) || { id: input.id || createId('org_entitlement'), organizationId, createdAt: nowIso() }
    Object.assign(row, {
      plan: text(input.plan) || row.plan || 'program_pass',
      source: text(input.source) || row.source || 'admin_grant',
      status: text(input.status) || row.status || 'active',
      startsAt: input.startsAt || row.startsAt || nowIso(),
      expiresAt: input.expiresAt ?? row.expiresAt ?? null,
      capabilities: { ...(row.capabilities || {}), ...(input.capabilities || {}) },
      limits: { ...COMMUNITY_HOST_LIMITS, ...(row.limits || {}), ...(input.limits || {}) },
      paymentIntentId: input.paymentIntentId || row.paymentIntentId || null,
      providerReference: input.providerReference || row.providerReference || null,
      createdBy: input.createdBy || row.createdBy || adminId,
      updatedAt: nowIso(),
    })
    if (!entitlements.includes(row)) entitlements.push(row)
    collection(db, 'organizationAuditEvents').push({ id: createId('org_audit'), organizationId, actorId: adminId, action: 'entitlement_updated', resourceType: 'organization_entitlement', resourceId: row.id, metadata: { plan: row.plan, source: row.source }, createdAt: nowIso() })
    return { ok: true, entitlement: organizationEntitlement(organizationId, db) }
  })
}
