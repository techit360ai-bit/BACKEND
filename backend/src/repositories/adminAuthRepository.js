// Row-level admin authority (§5 cutover).
//
// Admin credentials/roles and the telemetry snapshot history live in
// `platform_collection_records` (`adminUsers`, `adminTelemetrySnapshots`)
// instead of the whole-database snapshot, so `requireAdminAuth` and the admin
// CRUD routes no longer load the request authority snapshot.
import { withPlatformTransaction, getRecord, listRecords, listRecordsByField, upsertRecord, deleteRecord } from './platformCollectionRepository.js'

const ADMIN_USERS = 'adminUsers'
const TELEMETRY = 'adminTelemetrySnapshots'

export function adminAuthEnabled() {
  return process.env.ADMIN_AUTH_SOURCE === 'postgres' || process.env.DB_DRIVER === 'postgres'
}

export async function findAdminById(id) {
  if (!id) return null
  return withPlatformTransaction(client => getRecord(client, ADMIN_USERS, id))
}

export async function findAdminByEmail(email) {
  if (!email) return null
  return withPlatformTransaction(client => listRecordsByField(client, ADMIN_USERS, 'email', email))
    .then(rows => rows[0] || null)
}

export async function listAdminRecords() {
  return withPlatformTransaction(client => listRecords(client, ADMIN_USERS))
}

export async function saveAdmin(admin) {
  return withPlatformTransaction(client => upsertRecord(client, ADMIN_USERS, admin, { operation: 'update' }))
}

export async function deleteAdminRecord(id) {
  return withPlatformTransaction(client => deleteRecord(client, ADMIN_USERS, id))
}

// Collections aggregated by the admin intelligence-telemetry snapshot. Each is
// one bounded query instead of the whole-database request snapshot.
const TELEMETRY_COLLECTIONS = [
  'users', 'profiles', 'projects', 'mentorshipRooms', 'mentorshipApplications', 'mentorshipTasks',
  'organizations', 'organizationMemberships', 'organizationPrograms', 'organizationCohorts',
  'organizationRiskSignals', 'organizationActions', 'dealRooms', 'diligenceItems',
  'investorRecommendations', 'notifications', 'authSecurityEvents', 'authorizationAuditLogs',
  'ndaSignatures', 'investorQuestionnaireSubmissions', 'revenueVerifications', 'referenceRequests',
  'icReviews', ADMIN_USERS,
]

export async function adminTelemetryCollections() {
  return withPlatformTransaction(async client => {
    const out = {}
    for (const name of TELEMETRY_COLLECTIONS) out[name] = await listRecords(client, name)
    out[TELEMETRY] = await listRecords(client, TELEMETRY)
    return out
  })
}

export async function appendAdminTelemetry(snapshot) {
  return withPlatformTransaction(client => upsertRecord(client, TELEMETRY, snapshot, { operation: 'insert' }))
}
