// Row-level organization intelligence store (§5 cutover).
//
// The organization intelligence reads (overview, pulse, risks, recommendations,
// activity, members, audit, portfolio, program health, resource allocation,
// alumni/cohort benchmarks) previously loaded the whole-database snapshot. This
// repository resolves an organization-scoped bundle with bounded queries: the
// caller's access rows (active context / membership / dashboards), the
// organization's own rows across the intelligence collections, its projects and
// workspace tasks, and the member/project-owner profiles they reference. The
// mutation path runs the existing synchronous service logic against that bundle
// via `runDatabaseAuthority`, persists (and, where the domain keeps normalized
// Postgres projections, re-syncs) only the rows the call changed. Gated by
// ORGANIZATION_SOURCE / ORGANIZATION_READ_SOURCE / ORGANIZATION_WRITE_SOURCE
// (or an authoritative authorization source); the snapshot stays as the sqlite
// fallback.
import {
  withPlatformTransaction,
  getRecord,
  upsertRecord,
  listRecordsForOwner,
  listRecordsByField,
  listRecordsByIds,
} from './platformCollectionRepository.js'
import { runDatabaseAuthority } from '../config/database.js'
import { createId } from '../utils/api.js'

// Collections keyed by `organizationId` and read by the intelligence domain.
const ORG_COLLECTIONS = [
  'organizationPrograms',
  'organizationRiskSignals',
  'organizationActions',
  'organizationActivityEvents',
  'organizationAuditEvents',
  'organizationRecommendations',
  'organizationHealthSnapshots',
  'organizationReports',
  'organizationCohorts',
  'organizationPartners',
  'organizationResources',
  'organizationReportSchedules',
  'organizationKpiDefinitions',
  'organizationKpiValues',
  'organizationEntitlements',
  'organizationBudgets',
  'organizationUsage',
  'organizationSponsorshipPackages',
  'sponsorshipApplications',
  'startupCandidates',
  'organizationMarketplace',
  'opportunities',
  'mentorshipRooms',
]

// Organization collections the synchronous service logic mutates. Only rows
// that actually changed are written back after a mutation call.
const WRITE_COLLECTIONS = [
  'organizationActions',
  'organizationKpiDefinitions',
  'organizationKpiValues',
  'organizationMemberships',
  'organizationReports',
  'organizationReportSchedules',
  'organizationRecommendations',
  'organizationHealthSnapshots',
  'organizationAuditEvents',
  'organizationCohorts',
  'organizationPartners',
  'organizationResources',
  'organizationRiskSignals',
]

export function organizationIntelligenceEnabled() {
  return process.env.ORGANIZATION_SOURCE === 'postgres'
    || process.env.ORGANIZATION_READ_SOURCE === 'postgres'
    || process.env.ORGANIZATION_WRITE_SOURCE === 'postgres'
    || process.env.AUTHORIZATION_SOURCE === 'postgres'
}
export function organizationIntelligenceFallbackEnabled() { return process.env.ORGANIZATION_FALLBACK_SQLITE !== 'false' }

function mergeById(target, additions) {
  for (const row of additions) {
    const index = target.findIndex(item => item.id === row.id)
    if (index >= 0) target[index] = row
    else target.push(row)
  }
  return target
}

async function buildOrganizationIntelligenceScope(client, userId, requestedOrganizationId = null) {
  const activeContexts = await listRecordsForOwner(client, 'activeContexts', userId, { ownerFields: ['userId'] })
  const organizationMemberships = await listRecordsForOwner(client, 'organizationMemberships', userId, { ownerFields: ['userId'] })
  const organizationDashboards = await listRecordsForOwner(client, 'organizationDashboards', userId, { ownerFields: ['ownerId', 'userId'] })
  const candidate = requestedOrganizationId || activeContexts.find(row => row.status === 'active')?.organizationId || userId

  const db = { activeContexts, organizationMemberships, organizationDashboards }
  for (const name of ORG_COLLECTIONS) db[name] = await listRecordsByField(client, name, 'organizationId', candidate)

  mergeById(db.organizationMemberships, await listRecordsByField(client, 'organizationMemberships', 'organizationId', candidate))
  db.workspaceTasks = await listRecordsByField(client, 'workspaceTasks', 'organizationId', candidate)
  mergeById(db.workspaceTasks, await listRecordsByField(client, 'workspaceTasks', 'ownerOrganizationId', candidate))
  db.projects = await listRecordsByField(client, 'projects', 'organizationId', candidate)
  db.organizations = [await getRecord(client, 'organizations', candidate)].filter(Boolean)

  const profileIds = new Set()
  for (const row of db.organizationMemberships) if (row.userId) profileIds.add(row.userId)
  for (const row of db.projects) profileIds.add(row.ownerId || row.userId)
  db.profiles = await listRecordsByIds(client, 'profiles', [...profileIds].filter(Boolean))

  return db
}

function captureOriginals(db) {
  const originals = new Map()
  for (const name of WRITE_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
  return originals
}

async function persistChanges(client, db, originals) {
  for (const name of WRITE_COLLECTIONS) {
    for (const row of db[name] || []) {
      if (!row) continue
      if (!row.id) row.id = createId('org_row')
      const key = `${name}:${row.id}`
      const next = JSON.stringify(row)
      if (originals.get(key) === next) continue
      await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
    }
  }
}

export async function runOrganizationIntelligenceRead(options, read) {
  return withPlatformTransaction(async client => {
    const db = await buildOrganizationIntelligenceScope(client, options.userId, options.organizationId ?? null)
    return runDatabaseAuthority(db, async () => read())
  }, { userId: options.userId || null })
}

export async function applyOrganizationIntelligenceMutation(options, mutate, after) {
  return withPlatformTransaction(async client => {
    const db = await buildOrganizationIntelligenceScope(client, options.userId, options.organizationId ?? null)
    const originals = captureOriginals(db)
    const result = await runDatabaseAuthority(db, async () => {
      const value = await mutate()
      if (typeof after === 'function') await after(value)
      return value
    })
    await persistChanges(client, db, originals)
    return result
  }, { userId: options.userId || null })
}
