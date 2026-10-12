// Row-level member-directory store (§5 cutover).
//
// The member directory, the public profile and the connection lists used to
// read the whole-DB snapshot to resolve the candidate's active subscription,
// the viewer↔candidate shared workspace/organization/connection context, feed
// activity and the connection request/edge rows. This repository resolves only
// the rows a request needs with bounded queries (scoped to the viewer plus the
// addressed members) so the request path never loads the whole database.
// Gated by IDENTITY_READ_SOURCE=postgres (the source the directory profiles are
// read from); the controllers keep the snapshot read as the fallback until the
// authority is deleted.
import { withPlatformTransaction, listRecordsByField, listRecordsByFieldIn, listRecordsByIds, upsertRecord } from './platformCollectionRepository.js'
import { runBoundedDatabase } from '../config/database.js'
import { createId } from '../utils/api.js'

export function userDirectoryEnabled() {
  return process.env.IDENTITY_READ_SOURCE === 'postgres'
}

export function userDirectoryFallbackEnabled() {
  return process.env.USER_DIRECTORY_FALLBACK_SQLITE !== 'false'
}

const asIds = values => [...new Set(values.filter(Boolean).map(String))]
const dedupeById = rows => {
  const map = new Map()
  for (const row of rows) if (row?.id) map.set(row.id, row)
  return [...map.values()]
}

const mergeById = (target, additions) => {
  for (const row of additions || []) {
    if (!row) continue
    const index = target.findIndex(item => item.id === row.id)
    if (index >= 0) target[index] = row
    else target.push(row)
  }
  return target
}

// Edges that touch any of the given subjects (either endpoint).
async function edgesTouching(client, ids) {
  if (!ids.length) return []
  const [from, to] = await Promise.all([
    listRecordsByFieldIn(client, 'networkEdges', 'fromEntityId', ids),
    listRecordsByFieldIn(client, 'networkEdges', 'toEntityId', ids),
  ])
  return dedupeById([...from, ...to])
}

// Only the viewer↔member edges, so directory listings never pull a member's
// entire graph just to decide whether the viewer shares a connection with them.
async function viewerMemberEdges(client, viewerId, memberIds) {
  if (!viewerId || !memberIds.length) return []
  const members = new Set(memberIds.map(String))
  const [fromViewer, toViewer] = await Promise.all([
    listRecordsByFieldIn(client, 'networkEdges', 'fromEntityId', [viewerId]),
    listRecordsByFieldIn(client, 'networkEdges', 'toEntityId', [viewerId]),
  ])
  return dedupeById([
    ...fromViewer.filter(edge => members.has(String(edge.toEntityId))),
    ...toViewer.filter(edge => members.has(String(edge.fromEntityId))),
  ])
}

// Requests where the subject is either party.
async function requestsTouching(client, ids) {
  if (!ids.length) return []
  const [from, to] = await Promise.all([
    listRecordsByFieldIn(client, 'connectionRequests', 'fromUserId', ids),
    listRecordsByFieldIn(client, 'connectionRequests', 'toUserId', ids),
  ])
  return dedupeById([...from, ...to])
}

// Directory list + public profile bundle. `fullEdgeIds` scopes edges to the
// subjects whose whole edge set is needed (the public profile's connection
// count); when omitted only viewer↔member reciprocity edges are read.
export async function loadMemberDirectorySources(viewerId, memberIds = [], { activity = false, fullEdgeIds = [] } = {}) {
  const members = asIds(memberIds)
  const scope = asIds([viewerId, ...members])
  const full = asIds(fullEdgeIds)
  return withPlatformTransaction(async client => {
    const db = { profiles: [], subscriptions: [], workspaceMembers: [], organizationMemberships: [], networkEdges: [], connectionRequests: [], feedPosts: [], feedComments: [] }
    if (!scope.length) return db
    const [subscriptions, workspaceMembers, organizationMemberships, networkEdges, connectionRequests] = await Promise.all([
      listRecordsByFieldIn(client, 'subscriptions', 'userId', members),
      listRecordsByFieldIn(client, 'workspaceMembers', 'userId', scope),
      listRecordsByFieldIn(client, 'organizationMemberships', 'userId', scope),
      full.length ? edgesTouching(client, full) : viewerMemberEdges(client, viewerId, members),
      requestsTouching(client, scope),
    ])
    db.subscriptions = subscriptions
    db.workspaceMembers = workspaceMembers
    db.organizationMemberships = organizationMemberships
    db.networkEdges = networkEdges
    db.connectionRequests = connectionRequests
    if (activity) {
      const [feedPosts, feedComments] = await Promise.all([
        listRecordsByFieldIn(client, 'feedPosts', 'authorId', members),
        listRecordsByFieldIn(client, 'feedComments', 'authorId', members),
      ])
      db.feedPosts = feedPosts
      db.feedComments = feedComments
    }
    return db
  }, { userId: viewerId })
}

// Incoming connection requests for the viewer, plus the sender profiles the
// summary renders.
export async function loadConnectionRequestSources(viewerId) {
  return withPlatformTransaction(async client => {
    const connectionRequests = await listRecordsByFieldIn(client, 'connectionRequests', 'toUserId', [viewerId])
    const profiles = await listRecordsByIds(client, 'profiles', connectionRequests.map(row => row.fromUserId))
    return { profiles, connectionRequests }
  }, { userId: viewerId })
}

// The viewer's connection edges plus the counterpart profiles.
export async function loadConnectionSources(viewerId) {
  return withPlatformTransaction(async client => {
    const networkEdges = await edgesTouching(client, [viewerId])
    const counterpartIds = new Set()
    for (const edge of networkEdges) {
      for (const id of [edge.fromEntityId, edge.toEntityId]) {
        if (id && String(id) !== String(viewerId)) counterpartIds.add(String(id))
      }
    }
    const profiles = await listRecordsByIds(client, 'profiles', [...counterpartIds])
    return { profiles, networkEdges }
  }, { userId: viewerId })
}

// Connection writes (connect / accept / decline) append discovery events/edges
// and notifications, so the bundle carries those collections for the two
// parties. Only the rows a call actually changed are upserted.
const CONNECTION_WRITE_COLLECTIONS = ['connectionRequests', 'notifications', 'recommendationEvents', 'networkEdges', 'entityRelationships']

export async function loadProfileByRef(ref) {
  if (!ref) return null
  return withPlatformTransaction(async client => {
    const byId = await listRecordsByIds(client, 'profiles', [ref])
    if (byId.length) return byId[0]
    const byUsername = await listRecordsByField(client, 'profiles', 'username', ref)
    return byUsername[0] || null
  })
}

export async function applyConnectionMutation({ userId, peerId = null }, mutate) {
  return withPlatformTransaction(async client => {
    const seedIds = asIds([userId, peerId])
    const connectionRequests = seedIds.length ? await requestsTouching(client, seedIds) : []
    const profileIds = asIds([...seedIds, ...connectionRequests.flatMap(row => [row.fromUserId, row.toUserId])])
    const db = {
      profiles: await listRecordsByIds(client, 'profiles', profileIds),
      connectionRequests,
      notifications: await listRecordsByFieldIn(client, 'notifications', 'userId', profileIds),
      recommendationEvents: [],
      networkEdges: await edgesTouching(client, profileIds),
      entityRelationships: await listRecordsByFieldIn(client, 'entityRelationships', 'userId', profileIds),
    }
    const originals = new Map()
    for (const name of CONNECTION_WRITE_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runBoundedDatabase(db, async () => mutate(db))
    for (const name of CONNECTION_WRITE_COLLECTIONS) {
      for (const row of db[name] || []) {
        if (!row) continue
        if (!row.id) row.id = createId('connection_row')
        const key = `${name}:${row.id}`
        const next = JSON.stringify(row)
        if (originals.get(key) === next) continue
        await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
      }
    }
    return result
  }, { userId })
}
