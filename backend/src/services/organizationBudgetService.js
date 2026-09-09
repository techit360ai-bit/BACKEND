import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'

const collection = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0
const active = row => ['active', 'trialing', 'grace_period'].includes(String(row?.status || '').toLowerCase()) && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now())

function budgetFor(db, { organizationId, budgetId = null, programId = null, hackathonId = null } = {}) {
  return collection(db, 'organizationBudgets')
    .filter(row => row.organizationId === organizationId && active(row) && (!budgetId || row.id === budgetId) && (!programId || row.programId === programId) && (!hackathonId || row.hackathonId === hackathonId))
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))[0] || null
}

export function reserveOrganizationBudget({ organizationId, budgetId = null, programId = null, hackathonId = null, requestId, credits, metadata = {} }) {
  const required = Math.max(0, number(credits))
  if (!organizationId || !requestId || required <= 0) return { ok: false, error: 'organization_budget_fields_required' }
  return updateAuthorityDb(db => {
    const existing = collection(db, 'organizationUsage').find(row => row.requestId === requestId)
    if (existing) return existing.organizationId === organizationId && number(existing.credits) === required ? { ok: true, idempotent: true, usage: existing } : { ok: false, error: 'organization_budget_request_conflict' }
    const budget = budgetFor(db, { organizationId, budgetId, programId, hackathonId })
    if (!budget) return { ok: false, error: 'organization_budget_required', organizationId }
    const balance = number(budget.balance)
    const reserved = number(budget.reservedBalance)
    if (balance - reserved < required) return { ok: false, error: 'organization_budget_exhausted', organizationId, budgetId: budget.id, availableCredits: Math.max(0, balance - reserved), requiredCredits: required }
    const now = nowIso()
    budget.reservedBalance = reserved + required
    budget.updatedAt = now
    const usage = { id: createId('org_usage'), requestId, organizationId, budgetId: budget.id, programId: programId || budget.programId || null, hackathonId: hackathonId || budget.hackathonId || null, credits: required, status: 'reserved', metadata, createdAt: now, updatedAt: now }
    collection(db, 'organizationUsage').push(usage)
    return { ok: true, idempotent: false, usage, budget }
  })
}

export function settleOrganizationBudget({ requestId, status = 'completed', actualCredits = null }) {
  if (!requestId) return { ok: false, error: 'organization_budget_request_required' }
  return updateAuthorityDb(db => {
    const usage = collection(db, 'organizationUsage').find(row => row.requestId === requestId)
    if (!usage) return { ok: false, error: 'organization_usage_not_found' }
    if (usage.status !== 'reserved') return { ok: true, idempotent: true, usage }
    const budget = collection(db, 'organizationBudgets').find(row => row.id === usage.budgetId)
    const reserved = number(usage.credits)
    const settled = status === 'completed' ? Math.max(0, Math.min(reserved, number(actualCredits ?? reserved))) : 0
    if (budget) {
      budget.reservedBalance = Math.max(0, number(budget.reservedBalance) - reserved)
      budget.balance = Math.max(0, number(budget.balance) - settled)
      budget.updatedAt = nowIso()
    }
    usage.status = status === 'completed' ? 'settled' : 'refunded'
    usage.settledCredits = settled
    usage.releasedCredits = Math.max(0, reserved - settled)
    usage.updatedAt = nowIso()
    return { ok: true, idempotent: false, usage, budget }
  })
}

export function createOrganizationBudget(adminId, input = {}) {
  const organizationId = typeof input.organizationId === 'string' ? input.organizationId.trim() : ''
  const balance = number(input.balance)
  if (!organizationId || balance <= 0) return { ok: false, error: 'organization_budget_fields_required' }
  return updateAuthorityDb(db => {
    const now = nowIso()
    const budget = { id: input.id || createId('org_budget'), organizationId, programId: input.programId || null, hackathonId: input.hackathonId || null, source: input.source || 'admin_grant', status: input.status || 'active', balance, reservedBalance: 0, expiresAt: input.expiresAt || null, createdBy: adminId, createdAt: now, updatedAt: now }
    collection(db, 'organizationBudgets').push(budget)
    return { ok: true, budget }
  })
}

