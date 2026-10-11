// Row-level mentorship store (§5 cutover).
//
// Mentorship rooms and their room-scoped children (mentees, tasks, messages,
// resources, invitations, applications) plus the fan-out rows (notifications,
// feed posts, opportunities) previously loaded the whole-database snapshot.
// This repository resolves owned rooms, published rooms, the requested room and
// its children with bounded queries, then writes back only the changed rows.
// Gated by MENTORSHIP_SOURCE=postgres; the snapshot stays as the sqlite fallback.
import {
  withPlatformTransaction,
  getRecord,
  upsertRecord,
  listRecordsForOwner,
  listRecordsByField,
} from './platformCollectionRepository.js'

const OWNER_COLLECTIONS = {
  mentorshipRooms: ['mentorId', 'userId'],
  mentorshipMentees: ['userId'],
  mentorshipTasks: ['assignedTo', 'createdBy', 'userId'],
  mentorshipMessages: ['senderId'],
  mentorshipResources: ['createdBy'],
  mentorshipInvitations: ['createdBy'],
  mentorshipApplications: ['applicantId'],
  notifications: ['userId'],
  feedPosts: ['authorId'],
  opportunities: ['createdBy', 'ownerId'],
}
const ROOM_COLLECTIONS = ['mentorshipMentees', 'mentorshipTasks', 'mentorshipMessages', 'mentorshipResources', 'mentorshipInvitations', 'mentorshipApplications']
const DOMAIN_COLLECTIONS = Object.keys(OWNER_COLLECTIONS)

export function mentorshipEnabled() { return process.env.MENTORSHIP_SOURCE === 'postgres' }
export function mentorshipFallbackEnabled() { return process.env.MENTORSHIP_FALLBACK_SQLITE !== 'false' }

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

async function loadReferencedProfiles(client, userId, rowsByCollection) {
  const ids = new Set([userId])
  for (const name of ROOM_COLLECTIONS) for (const row of rowsByCollection[name] || []) for (const field of ['userId', 'applicantId', 'mentorId', 'senderId', 'createdBy', 'assignedTo']) if (row[field]) ids.add(row[field])
  const profiles = []
  for (const id of ids) { const profile = await getRecord(client, 'profiles', id); if (profile) profiles.push(profile) }
  return profiles
}

async function buildMentorshipDb(client, userId, roomId = null, invitationTokenHash = null) {
  const db = {}
  for (const [name, ownerFields] of Object.entries(OWNER_COLLECTIONS)) {
    db[name] = await listRecordsForOwner(client, name, userId, { ownerFields })
  }
  // Published rooms are readable by everyone, not just the mentor.
  mergeById(db.mentorshipRooms, await listRecordsByField(client, 'mentorshipRooms', 'status', 'published'))
  if (roomId && !db.mentorshipRooms.some(row => row.id === roomId)) {
    const room = await getRecord(client, 'mentorshipRooms', roomId)
    if (room) db.mentorshipRooms.push(room)
  }
  // Invites are looked up by an unguessable token hash, not by owner.
  if (invitationTokenHash) mergeById(db.mentorshipInvitations, await listRecordsByField(client, 'mentorshipInvitations', 'tokenHash', invitationTokenHash))
  const roomIds = db.mentorshipRooms.map(row => row.id)
  for (const name of ROOM_COLLECTIONS) {
    if (!Array.isArray(db[name])) db[name] = []
    for (const id of roomIds) mergeById(db[name], await listRecordsByField(client, name, 'roomId', id))
  }
  db.profiles = await loadReferencedProfiles(client, userId, db)
  return db
}

export async function readMentorshipSources(userId, { roomId = null } = {}) {
  return withPlatformTransaction(client => buildMentorshipDb(client, userId, roomId), { userId })
}

export async function readMentorshipInviteSource(userId, invitationTokenHash) {
  return withPlatformTransaction(client => buildMentorshipDb(client, userId, null, invitationTokenHash), { userId })
}

export async function applyMentorshipMutation(userId, { roomId = null, invitationTokenHash = null } = {}, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildMentorshipDb(client, userId, roomId, invitationTokenHash)
    const originals = new Map()
    for (const name of DOMAIN_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const out = mutate(db) || {}
    const result = Object.prototype.hasOwnProperty.call(out, 'result') ? out.result : out
    for (const name of DOMAIN_COLLECTIONS) {
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
