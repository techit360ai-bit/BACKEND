// Row-level domain store (§5 cutover) — endorsements + investor views.
//
// `domainService` is a large aggregate; this store is cut over sub-slice by
// sub-slice. This first slice resolves the caller's own rows for:
//   * endorsements (authored + received) plus the author/subject profiles,
//     subject users and referenced projects, and
//   * the investor surface (watchlist + preferences, the caller's deal-flow
//     snapshots plus public snapshots, and the referenced projects), and
//   * the investor collection endpoints (capital pools, deal/data rooms,
//     reputation) which are owner-scoped by the bound collection name.
// Only changed rows are written back. Enabled with DOMAIN_SOURCE=postgres; the
// snapshot fallback stays in the service until the authority is deleted.
import { withPlatformTransaction, getRecord, upsertRecord, deleteRecord, listRecordsForOwner, listRecordsLimited, listRecordsByIds, listRecordsByFieldIn } from './platformCollectionRepository.js'
import { runBoundedDatabase } from '../config/database.js'
import { createId } from '../utils/api.js'

export function domainStoreEnabled() {
  return ['DOMAIN_SOURCE', 'DOMAIN_READ_SOURCE', 'DOMAIN_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function domainFallbackEnabled() { return process.env.DOMAIN_FALLBACK_SQLITE !== 'false' }
export function domainCandidateLimit() { return Math.max(50, Number(process.env.DOMAIN_CANDIDATE_LIMIT || 500)) }

// Owner-scoped collections this slice reads/writes, with the payload fields that
// may carry the owner id (insertOwned sets the caller-supplied owner field).
const OWNER_FIELDS = {
  endorsements: ['authorId', 'subjectId'],
  investorWatchlists: ['investorId', 'ownerId', 'userId'],
  investorWatchlistPreferences: ['investorId', 'ownerId', 'userId'],
  dealFlowSnapshots: ['investorId', 'ownerId', 'userId'],
  capitalPools: ['investorId', 'ownerId', 'userId'],
  dealRooms: ['investorId', 'ownerId', 'userId'],
  dataRooms: ['investorId', 'ownerId', 'userId'],
  investorReputation: ['investorId', 'ownerId', 'userId'],
  // Organization intelligence slice.
  projects: ['organizationId', 'ownerId', 'userId'],
  orgKpiTargets: ['organizationId', 'ownerId', 'userId'],
  orgDemoDayEvents: ['organizationId', 'ownerId', 'userId'],
  organizationDashboards: ['ownerId', 'userId', 'organizationId'],
  hackathons: ['organizationId', 'ownerId', 'userId'],
  // Hackathon slice.
  hackathonTeams: ['leaderId', 'ownerId', 'userId', 'organizationId'],
  hackathonMembers: ['userId', 'ownerId', 'createdBy'],
  hackathonBriefs: ['createdBy', 'userId', 'ownerId'],
  hackathonCheckIns: ['createdBy', 'userId', 'ownerId'],
  hackathonScores: ['createdBy', 'userId', 'ownerId'],
  hackathonFinalSubmissions: ['createdBy', 'userId', 'ownerId'],
  hackathonInvitations: ['inviterId', 'collaboratorId', 'userId', 'ownerId'],
  hackathonTeamWorkspaces: ['ownerId', 'userId', 'organizationId'],
  hackathonTeamReports: ['createdBy', 'ownerId', 'userId'],
  organizationAbuseReviews: ['organizationId', 'ownerId', 'userId'],
  workspaces: ['ownerId', 'userId', 'organizationId'],
  workspaceMembers: ['userId', 'ownerId', 'workspaceOwnerId'],
  notifications: ['userId'],
  // Contracts + opportunity applications slice.
  contracts: ['founderId', 'collaboratorId', 'ownerId', 'userId'],
  opportunities: ['ownerId', 'userId', 'createdBy'],
  opportunityApplications: ['applicantId', 'ownerId', 'userId'],
  // Venture intakes + analyses slice.
  ventureIntakes: ['ownerId', 'userId'],
  ventureAnalyses: ['ownerId', 'userId'],
  projectAnalyses: ['ownerId', 'userId'],
  // Notification preferences + contributor scores slice.
  notificationPreferences: ['userId', 'ownerId'],
  contributions: ['collaboratorId', 'userId', 'ownerId'],
  // Generic owner-scoped collections slice. `genericCreate`/`genericPatch`
  // append a recommendationEvent for the caller, and the discovery helpers may
  // touch the relationship edges (loaded explicitly by the generic wrappers).
  recommendationEvents: ['userId'],
  networkEdges: ['userId'],
  entityRelationships: ['userId'],
  // Generic public surfaces slice (bounded owner + public windows).
  files: ['ownerId', 'userId', 'createdBy'],
  settingsEvents: ['userId', 'ownerId'],
  // Equity / earnings / founder cap-table slice.
  equityGrants: ['collaboratorId', 'ownerId', 'userId'],
  collaboratorEarnings: ['collaboratorId', 'ownerId', 'userId'],
  payouts: ['collaboratorId', 'ownerId', 'userId'],
  dilutionEvents: ['collaboratorId', 'ownerId', 'userId'],
  workspaceInvitations: ['collaboratorId', 'inviterId', 'userId', 'ownerId'],
  // Wallet analytics slice (completed usage events).
  usageEvents: ['userId', 'ownerId'],
}
const WRITE_COLLECTIONS = Object.keys(OWNER_FIELDS)

function namedCollections(entries = []) {
  return entries.map(entry => (typeof entry === 'string' ? entry : entry?.name)).filter(Boolean)
}

function mergeById(target, additions) {
  for (const row of additions) {
    if (!row) continue
    const index = target.findIndex(item => item.id === row.id)
    if (index >= 0) target[index] = row
    else target.push(row)
  }
  return target
}

async function loadByIds(client, collectionName, ids, target) {
  const unique = [...new Set(ids.filter(Boolean).map(String))]
  if (unique.length) mergeById(target, await listRecordsByIds(client, collectionName, unique))
}

async function buildDomainDb(client, { userId = null, endorsements = false, investor = false, organization = false, hackathon = false, hackathonId = null, teamId = null, contracts = false, opportunityId = null, collaboratorId = null, venture = false, workspaceId = null, notificationPreferences = false, contributions = false, equity = false, wallet = false, founderProjects = false, workspaceWrites = false, collections = [], publicCollections = [], subjectUserId = null, projectIds = [] } = {}) {
  const db = {}
  const writeCollections = new Set([...WRITE_COLLECTIONS, ...namedCollections(collections), ...namedCollections(publicCollections)])
  for (const name of writeCollections) db[name] = []
  db.profiles = []
  db.users = []
  db.workspaceMembers = []
  db.projects = []

  if (userId && endorsements) {
    mergeById(db.endorsements, await listRecordsForOwner(client, 'endorsements', userId, { ownerFields: OWNER_FIELDS.endorsements }))
    mergeById(db.profiles, [await getRecord(client, 'profiles', userId)])
    const profileIds = [subjectUserId]
    for (const row of db.endorsements) profileIds.push(row.authorId, row.subjectId)
    await loadByIds(client, 'profiles', profileIds, db.profiles)
    await loadByIds(client, 'users', [subjectUserId], db.users)
    await loadByIds(client, 'projects', [...db.endorsements.map(row => row.projectId), ...projectIds], db.projects)
  }

  if (userId && investor) {
    mergeById(db.investorWatchlists, await listRecordsForOwner(client, 'investorWatchlists', userId, { ownerFields: OWNER_FIELDS.investorWatchlists }))
    mergeById(db.investorWatchlistPreferences, await listRecordsForOwner(client, 'investorWatchlistPreferences', userId, { ownerFields: OWNER_FIELDS.investorWatchlistPreferences }))
    mergeById(db.dealFlowSnapshots, await listRecordsForOwner(client, 'dealFlowSnapshots', userId, { ownerFields: OWNER_FIELDS.dealFlowSnapshots }))
    mergeById(db.dealFlowSnapshots, await listRecordsLimited(client, 'dealFlowSnapshots', { limit: domainCandidateLimit(), payloadField: 'visibility', payloadValue: 'public' }))
    await loadByIds(client, 'projects', [...db.investorWatchlists.map(row => row.projectId), ...db.dealFlowSnapshots.map(row => row.projectId)], db.projects)
  }

  if (userId && organization) {
    mergeById(db.projects, await listRecordsForOwner(client, 'projects', userId, { ownerFields: ['organizationId'] }))
    mergeById(db.orgKpiTargets, await listRecordsForOwner(client, 'orgKpiTargets', userId, { ownerFields: ['organizationId'] }))
    mergeById(db.dealFlowSnapshots, await listRecordsForOwner(client, 'dealFlowSnapshots', userId, { ownerFields: ['organizationId', 'ownerId', 'userId'] }))
    mergeById(db.orgDemoDayEvents, await listRecordsForOwner(client, 'orgDemoDayEvents', userId, { ownerFields: ['organizationId'] }))
    mergeById(db.organizationDashboards, await listRecordsForOwner(client, 'organizationDashboards', userId, { ownerFields: ['ownerId', 'userId'] }))
    mergeById(db.hackathons, await listRecordsForOwner(client, 'hackathons', userId, { ownerFields: ['ownerId'] }))
    // Investor matchmaking / demo-day reach read cross-org rows: bounded windows.
    mergeById(db.profiles, await listRecordsLimited(client, 'profiles', { limit: domainCandidateLimit(), payloadField: 'role', payloadValue: 'investor' }))
    mergeById(db.investorWatchlists, await listRecordsLimited(client, 'investorWatchlists', { limit: domainCandidateLimit() }))
  }

  if (userId && hackathon) {
    if (!Array.isArray(db.organizationMemberships)) db.organizationMemberships = []
    mergeById(db.organizationMemberships, await listRecordsForOwner(client, 'organizationMemberships', userId, { ownerFields: ['userId'] }))
    mergeById(db.hackathons, await listRecordsLimited(client, 'hackathons', { limit: domainCandidateLimit() }))
    const orgIds = db.organizationMemberships.filter(row => row.status === 'active').map(row => row.organizationId)
    mergeById(db.hackathons, await listRecordsByFieldIn(client, 'hackathons', 'organizationId', orgIds))
    if (hackathonId) mergeById(db.hackathons, [await getRecord(client, 'hackathons', hackathonId)])
    if (teamId) mergeById(db.hackathonTeams, [await getRecord(client, 'hackathonTeams', teamId)])
    const hackathonIds = db.hackathons.map(row => row.id)
    mergeById(db.hackathonTeams, await listRecordsForOwner(client, 'hackathonTeams', userId, { ownerFields: ['leaderId', 'ownerId', 'userId'] }))
    mergeById(db.hackathonTeams, await listRecordsByFieldIn(client, 'hackathonTeams', 'hackathonId', hackathonIds))
    const teamIds = db.hackathonTeams.map(row => row.id)
    for (const name of ['hackathonBriefs', 'hackathonCheckIns', 'hackathonScores', 'hackathonFinalSubmissions', 'hackathonInvitations', 'hackathonTeamWorkspaces']) {
      mergeById(db[name], await listRecordsByFieldIn(client, name, 'teamId', teamIds))
    }
    mergeById(db.hackathonMembers, await listRecordsByFieldIn(client, 'hackathonMembers', 'teamId', teamIds))
    mergeById(db.hackathonMembers, await listRecordsByFieldIn(client, 'hackathonMembers', 'hackathonId', hackathonIds))
    mergeById(db.hackathonMembers, await listRecordsForOwner(client, 'hackathonMembers', userId, { ownerFields: ['userId'] }))
    mergeById(db.hackathonInvitations, await listRecordsForOwner(client, 'hackathonInvitations', userId, { ownerFields: ['collaboratorId', 'userId'] }))
    mergeById(db.hackathonTeamReports, await listRecordsForOwner(client, 'hackathonTeamReports', userId, { ownerFields: ['createdBy', 'ownerId', 'userId'] }))
    mergeById(db.organizationAbuseReviews, await listRecordsForOwner(client, 'organizationAbuseReviews', userId, { ownerFields: ['organizationId'] }))
    mergeById(db.notifications, await listRecordsForOwner(client, 'notifications', userId, { ownerFields: ['userId'] }))
    const profileIds = [userId]
    for (const row of db.hackathonTeams) profileIds.push(row.leaderId)
    for (const row of db.hackathonMembers) profileIds.push(row.userId)
    for (const row of db.hackathonInvitations) profileIds.push(row.collaboratorId)
    await loadByIds(client, 'profiles', profileIds, db.profiles)
    await loadByIds(client, 'projects', db.hackathonTeamWorkspaces.map(row => row.projectId), db.projects)
    await loadByIds(client, 'workspaces', db.hackathonTeamWorkspaces.map(row => row.workspaceId), db.workspaces)
  }

  if (userId && contracts) {
    mergeById(db.contracts, await listRecordsForOwner(client, 'contracts', userId, { ownerFields: ['founderId', 'collaboratorId', 'ownerId', 'userId'] }))
    mergeById(db.opportunityApplications, await listRecordsForOwner(client, 'opportunityApplications', userId, { ownerFields: ['applicantId', 'ownerId', 'userId'] }))
    mergeById(db.opportunities, await listRecordsForOwner(client, 'opportunities', userId, { ownerFields: ['ownerId', 'userId', 'createdBy'] }))
    mergeById(db.profiles, [await getRecord(client, 'profiles', userId)])
  }
  if (opportunityId) mergeById(db.opportunities, [await getRecord(client, 'opportunities', opportunityId)])
  if (collaboratorId) {
    await loadByIds(client, 'users', [collaboratorId], db.users)
    await loadByIds(client, 'profiles', [collaboratorId], db.profiles)
  }

  if (userId && venture) {
    mergeById(db.ventureIntakes, await listRecordsForOwner(client, 'ventureIntakes', userId, { ownerFields: OWNER_FIELDS.ventureIntakes }))
    mergeById(db.ventureAnalyses, await listRecordsForOwner(client, 'ventureAnalyses', userId, { ownerFields: OWNER_FIELDS.ventureAnalyses }))
  }

  if (workspaceId) {
    mergeById(db.workspaces, [await getRecord(client, 'workspaces', workspaceId)])
    mergeById(db.workspaceMembers, await listRecordsByFieldIn(client, 'workspaceMembers', 'workspaceId', [workspaceId]))
  }

  if (userId && notificationPreferences) {
    mergeById(db.notificationPreferences, await listRecordsForOwner(client, 'notificationPreferences', userId, { ownerFields: OWNER_FIELDS.notificationPreferences }))
  }
  if (userId && contributions) {
    mergeById(db.contributions, await listRecordsForOwner(client, 'contributions', userId, { ownerFields: OWNER_FIELDS.contributions }))
  }

  // Equity / earnings / founder cap-table: the caller's grants, earnings and
  // payouts, plus the workspace + invitation + member rows the cap table derives
  // from, and the referenced projects/profiles.
  if (userId && equity) {
    mergeById(db.equityGrants, await listRecordsForOwner(client, 'equityGrants', userId, { ownerFields: OWNER_FIELDS.equityGrants }))
    mergeById(db.collaboratorEarnings, await listRecordsForOwner(client, 'collaboratorEarnings', userId, { ownerFields: OWNER_FIELDS.collaboratorEarnings }))
    mergeById(db.payouts, await listRecordsForOwner(client, 'payouts', userId, { ownerFields: OWNER_FIELDS.payouts }))
    mergeById(db.workspaces, await listRecordsForOwner(client, 'workspaces', userId, { ownerFields: ['ownerId', 'userId'] }))
    const workspaceIds = db.workspaces.map(row => row.id)
    mergeById(db.workspaceMembers, await listRecordsByFieldIn(client, 'workspaceMembers', 'workspaceId', workspaceIds))
    mergeById(db.workspaceInvitations, await listRecordsByFieldIn(client, 'workspaceInvitations', 'workspaceId', workspaceIds))
    mergeById(db.workspaceInvitations, await listRecordsForOwner(client, 'workspaceInvitations', userId, { ownerFields: OWNER_FIELDS.workspaceInvitations }))
    await loadByIds(client, 'projects', db.workspaces.map(row => row.projectId), db.projects)
    // The addressed invitation's workspace + inviter (a collaborator does not
    // own the workspace, so it is not in db.workspaces above).
    await loadByIds(client, 'workspaces', db.workspaceInvitations.map(row => row.workspaceId), db.workspaces)
    const profileIds = []
    for (const row of db.workspaceMembers) profileIds.push(row.userId)
    for (const row of db.workspaceInvitations) profileIds.push(row.collaboratorId)
    for (const row of db.workspaceInvitations) profileIds.push(row.invitedBy)
    await loadByIds(client, 'profiles', profileIds, db.profiles)
  }

  // Wallet analytics only needs the caller's completed usage events.
  if (userId && wallet) {
    mergeById(db.usageEvents, await listRecordsForOwner(client, 'usageEvents', userId, { ownerFields: OWNER_FIELDS.usageEvents }))
  }

  // Founder project/workspace writes (§5 2b): the caller's own projects and
  // workspaces, their published deal-flow snapshots, and the analyses for the
  // addressed project ids — the bounded window the project/workspace write
  // functions mutate.
  if (userId && founderProjects) {
    mergeById(db.projects, await listRecordsForOwner(client, 'projects', userId, { ownerFields: ['ownerId'] }))
    mergeById(db.workspaces, await listRecordsForOwner(client, 'workspaces', userId, { ownerFields: ['ownerId'] }))
    mergeById(db.dealFlowSnapshots, await listRecordsForOwner(client, 'dealFlowSnapshots', userId, { ownerFields: ['ownerId'] }))
    mergeById(db.projectAnalyses, await listRecordsByFieldIn(client, 'projectAnalyses', 'projectId', projectIds))
  }

  // Workspace invitation/membership writes (§5 2b): the caller's workspaces,
  // memberships and invitations (addressed to them, sent by them, or on their
  // workspaces), the notifications that de-dupe invitation notices, and the
  // entitlement rows the free-collaborator workspace check reads.
  if (userId && workspaceWrites) {
    mergeById(db.workspaces, await listRecordsForOwner(client, 'workspaces', userId, { ownerFields: ['ownerId', 'userId'] }))
    if (workspaceId) mergeById(db.workspaces, [await getRecord(client, 'workspaces', workspaceId)])
    mergeById(db.workspaceMembers, await listRecordsForOwner(client, 'workspaceMembers', userId, { ownerFields: ['userId'] }))
    mergeById(db.workspaceInvitations, await listRecordsForOwner(client, 'workspaceInvitations', userId, { ownerFields: OWNER_FIELDS.workspaceInvitations }))
    mergeById(db.notifications, await listRecordsForOwner(client, 'notifications', userId, { ownerFields: ['userId'] }))
    if (subjectUserId) mergeById(db.notifications, await listRecordsForOwner(client, 'notifications', subjectUserId, { ownerFields: ['userId'] }))
    db.accountEntitlements = await listRecordsForOwner(client, 'accountEntitlements', userId, { ownerFields: ['userId'] })
    db.subscriptions = await listRecordsForOwner(client, 'subscriptions', userId, { ownerFields: ['userId'] })
    db.creditLedger = await listRecordsForOwner(client, 'creditLedger', userId, { ownerFields: ['userId'] })
    const invitationWorkspaceIds = db.workspaceInvitations.map(row => row.workspaceId)
    mergeById(db.workspaceMembers, await listRecordsByFieldIn(client, 'workspaceMembers', 'workspaceId', [...db.workspaces.map(row => row.id), ...invitationWorkspaceIds]))
    await loadByIds(client, 'workspaces', invitationWorkspaceIds, db.workspaces)
    mergeById(db.workspaceInvitations, await listRecordsByFieldIn(client, 'workspaceInvitations', 'workspaceId', db.workspaces.map(row => row.id)))
    const profileIds = [userId, subjectUserId]
    for (const row of db.workspaceMembers) profileIds.push(row.userId)
    for (const row of db.workspaceInvitations) profileIds.push(row.collaboratorId, row.invitedBy)
    await loadByIds(client, 'profiles', profileIds, db.profiles)
  }

  for (const entry of collections) {
    const name = typeof entry === 'string' ? entry : entry.name
    if (!name) continue
    if (workspaceId) {
      mergeById(db[name], await listRecordsByFieldIn(client, name, 'workspaceId', [workspaceId]))
      continue
    }
    const field = (typeof entry === 'object' && entry.field) || (OWNER_FIELDS[name] ? OWNER_FIELDS[name][0] : 'userId')
    mergeById(db[name], await listRecordsForOwner(client, name, userId, { ownerFields: [field] }))
  }

  for (const entry of publicCollections) {
    const name = typeof entry === 'string' ? entry : entry?.name
    if (!name) continue
    const ownerFields = (typeof entry === 'object' && entry.ownerFields) || OWNER_FIELDS[name] || ['userId']
    const limit = (typeof entry === 'object' && entry.limit) || domainCandidateLimit()
    // The caller's own rows (all visibilities) plus a bounded window of rows
    // owned by others that are public — matching `isRecordVisible`.
    mergeById(db[name], await listRecordsForOwner(client, name, userId, { ownerFields }))
    mergeById(db[name], await listRecordsLimited(client, name, { limit, payloadField: 'visibility', payloadValue: 'public' }))
    mergeById(db[name], await listRecordsLimited(client, name, { limit, payloadField: 'public', payloadValue: true }))
  }
  if (publicCollections.length) {
    const profileIds = []
    for (const entry of publicCollections) {
      const name = typeof entry === 'string' ? entry : entry?.name
      for (const row of db[name] || []) profileIds.push(row.ownerId, row.userId, row.createdBy)
    }
    await loadByIds(client, 'profiles', profileIds, db.profiles)
  }
  return db
}

async function persistChanges(client, db, originals, writeCollections) {
  for (const name of writeCollections) {
    const seen = new Set()
    for (const row of db[name] || []) {
      if (!row) continue
      if (!row.id) row.id = createId('domain_row')
      const key = `${name}:${row.id}`
      seen.add(key)
      const next = JSON.stringify(row)
      if (originals.get(key) === next) continue
      await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
    }
    // Rows loaded for this collection but no longer present were removed by the
    // mutation (splice/filter), so soft-delete them.
    for (const key of originals.keys()) {
      if (!key.startsWith(`${name}:`) || seen.has(key)) continue
      await deleteRecord(client, name, key.slice(name.length + 1))
    }
  }
}

function writeCollectionsFor(options) {
  return new Set([...WRITE_COLLECTIONS, ...namedCollections(options.collections), ...namedCollections(options.publicCollections)])
}

export async function runDomainRead(options, read) {
  return withPlatformTransaction(async client => {
    const db = await buildDomainDb(client, options)
    return runBoundedDatabase(db, async () => read())
  }, { userId: options.userId || null })
}

export async function applyDomainMutation(options, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildDomainDb(client, options)
    const writeCollections = writeCollectionsFor(options)
    const originals = new Map()
    for (const name of writeCollections) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runBoundedDatabase(db, async () => mutate())
    await persistChanges(client, db, originals, writeCollections)
    return result
  }, { userId: options.userId || null })
}
