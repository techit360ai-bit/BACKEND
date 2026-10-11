// Row-level organization program store (§5 cutover).
//
// Sponsorship packages/applications/transactions/benefits, sponsor consent,
// managed hackathon operations and institutional settings previously loaded the
// whole-database snapshot, and hackathon outcomes/conversions read the hackathon
// children. This repository resolves the owner/organization-scoped rows plus the
// addressed hackathon's children with bounded queries and writes back only the
// rows the mutation changed. Gated by ORGANIZATION_SOURCE=postgres.
import {
  withPlatformTransaction,
  getRecord,
  upsertRecord,
  listRecords,
  listRecordsForOwner,
  listRecordsByField,
} from './platformCollectionRepository.js'

// Written by this domain, with the owner-bearing fields each may use.
const DOMAIN_OWNER_FIELDS = {
  organizationSponsorshipPackages: ['organizationId', 'createdBy'],
  sponsorshipApplications: ['organizationId', 'createdBy'],
  sponsorshipTransactions: ['organizationId'],
  sponsorshipBenefits: ['organizationId'],
  consentRecords: ['userId', 'organizationId'],
  managedHackathonOperations: ['organizationId', 'createdBy'],
  organizationInstitutionalSettings: ['organizationId'],
  startupCandidates: ['organizationId', 'founderId'],
  organizationAbuseReviews: [],
  hackathons: ['ownerId', 'userId', 'organizationId'],
}
const WRITE_COLLECTIONS = Object.keys(DOMAIN_OWNER_FIELDS)
// Hackathon evidence is read-only for this domain.
const HACKATHON_CHILD_COLLECTIONS = ['hackathonTeams', 'hackathonMembers', 'hackathonFinalSubmissions', 'hackathonScores']

export function organizationProgramEnabled() {
  return process.env.ORGANIZATION_SOURCE === 'postgres' || process.env.ORGANIZATION_WRITE_SOURCE === 'postgres'
}
export function organizationProgramFallbackEnabled() { return process.env.ORGANIZATION_FALLBACK_SQLITE !== 'false' }

async function upsertScoped(client, collectionName, row) {
  const current = await getRecord(client, collectionName, row.id)
  await upsertRecord(client, collectionName, row, {
    operation: current ? 'update' : 'insert',
    expectedVersion: current ? current.version : null,
    idempotencyKey: `${collectionName}:${row.id}:${row.updatedAt || row.createdAt || Date.now()}`,
  })
  return row
}

function mergeById(target, additions) {
  for (const row of additions) {
    const index = target.findIndex(item => item.id === row.id)
    if (index >= 0) target[index] = row
    else target.push(row)
  }
  return target
}

async function buildOrgProgramDb(client, userId, { organizationId = null, hackathonId = null, ids = {} } = {}) {
  const db = {}
  for (const name of WRITE_COLLECTIONS) {
    db[name] = await listRecordsForOwner(client, name, userId, { ownerFields: DOMAIN_OWNER_FIELDS[name] })
    if (organizationId) mergeById(db[name], await listRecordsByField(client, name, 'organizationId', organizationId))
  }
  // Abuse reviews are an admin-global queue.
  mergeById(db.organizationAbuseReviews, await listRecords(client, 'organizationAbuseReviews', {}))
  // Addressed records (e.g. the application being reviewed before its org is known).
  for (const [name, values] of Object.entries(ids)) {
    if (!Array.isArray(db[name])) db[name] = []
    for (const id of values || []) { const row = await getRecord(client, name, id); if (row) mergeById(db[name], [row]) }
  }
  if (hackathonId) { const hackathon = await getRecord(client, 'hackathons', hackathonId); if (hackathon) mergeById(db.hackathons, [hackathon]) }
  const hackathonIds = db.hackathons.map(row => row.id)
  for (const name of HACKATHON_CHILD_COLLECTIONS) {
    db[name] = []
    for (const id of hackathonIds) mergeById(db[name], await listRecordsByField(client, name, 'hackathonId', id))
  }
  db.organizationMemberships = await listRecordsForOwner(client, 'organizationMemberships', userId, { ownerFields: ['userId'] })
  return db
}

// Read a single addressed record (used to resolve an organization before the
// permission check, e.g. reviewing an application by id).
export async function readOrgProgramRecord(collectionName, id) {
  return withPlatformTransaction(client => getRecord(client, collectionName, id))
}

export async function readOrgProgramSources(userId, options = {}) {
  return withPlatformTransaction(client => buildOrgProgramDb(client, userId, options), { userId })
}

export async function applyOrgProgramMutation(userId, options = {}, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildOrgProgramDb(client, userId, options)
    const originals = new Map()
    for (const name of WRITE_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const out = mutate(db) || {}
    const result = Object.prototype.hasOwnProperty.call(out, 'result') ? out.result : out
    for (const name of WRITE_COLLECTIONS) {
      for (const row of db[name] || []) {
        if (!row?.id) continue
        if (originals.get(`${name}:${row.id}`) === JSON.stringify(row)) continue
        await upsertScoped(client, name, row)
      }
    }
    for (const item of out.append || []) await upsertScoped(client, item.collection, item.row)
    return result
  }, { userId })
}
