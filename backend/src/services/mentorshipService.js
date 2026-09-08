import { createHash, randomBytes } from 'crypto'
import { createId, nowIso, userName } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { createMentorshipMessage as createMentorshipMessagePostgres, createFeedPost as createFeedPostPostgres, contentWriteEnabled, contentWriteFallbackEnabled } from '../repositories/contentRepository.js'

const rows = (db, key) => { if (!Array.isArray(db[key])) db[key] = []; return db[key] }
const clean = value => typeof value === 'string' ? value.trim() : value
const hashToken = token => createHash('sha256').update(token).digest('hex')
const splitList = value => Array.isArray(value) ? value.map(clean).filter(Boolean) : String(value || '').split(',').map(clean).filter(Boolean)
const owner = (room, userId) => room && room.mentorId === userId
const publicRoom = room => {
  if (!room) return null
  const { invitationTokenHash, ...safe } = room
  return { ...safe, share: buildSharePayload(safe) }
}
const profileName = (db, userId) => userName(rows(db, 'profiles').find(p => p.id === userId), 'TechIT Mentor')
function buildSharePayload(room) {
  const baseUrl = process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'https://techit.network'
  const url = `${baseUrl.replace(/\/$/, '')}/investor/mentorship/room/${encodeURIComponent(room.id)}`
  const text = `${room.name} - ${room.description || 'Join this TechIT mentorship room.'}`
  return {
    url,
    text,
    feed: { type: 'mentorship_room', entityId: room.id, title: room.name, body: text },
    opportunity: { type: 'mentorship', title: room.name, description: room.description || '', sourceRoomId: room.id },
    social: {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      email: `mailto:?subject=${encodeURIComponent(room.name)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    },
  }
}

export function listMentorshipRooms(userId, { mine = false, status = 'published' } = {}) {
  const db = readAuthorityDb()
  const rooms = rows(db, 'mentorshipRooms').filter(room => (mine ? owner(room, userId) : room.status === status || room.mentorId === userId)).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
  return { rooms: rooms.map(publicRoom) }
}

export function getMentorshipRoom(userId, roomId) {
  const db = readAuthorityDb()
  const room = rows(db, 'mentorshipRooms').find(item => item.id === roomId && (item.status === 'published' || owner(item, userId)))
  if (!room) return null
  const mentees = rows(db, 'mentorshipMentees').filter(item => item.roomId === roomId && item.status !== 'removed')
  return { room: publicRoom({ ...room, menteeCount: mentees.length }), mentees, tasks: rows(db, 'mentorshipTasks').filter(item => item.roomId === roomId), messages: rows(db, 'mentorshipMessages').filter(item => item.roomId === roomId).slice(-100), resources: rows(db, 'mentorshipResources').filter(item => item.roomId === roomId) }
}

export function createMentorshipRoom(userId, body = {}) {
  const name = clean(body.name)
  const description = clean(body.description)
  const capacity = Number(body.capacity)
  if (!name || !description) return { ok: false, error: 'name_and_description_required' }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return { ok: false, error: 'invalid_capacity' }
  const now = nowIso()
  return updateAuthorityDb(db => {
    const room = { id: createId('mentor_room'), mentorId: userId, name, description, expertise: splitList(body.expertise), capacity, paymentModel: clean(body.paymentModel) || 'free', pricing: body.pricing && typeof body.pricing === 'object' ? body.pricing : {}, requiredSkills: splitList(body.requiredSkills), applicationQuestions: splitList(body.applicationQuestions), advancedHub: Boolean(body.advancedHub), status: body.publish === false ? 'draft' : 'published', createdAt: now, updatedAt: now }
    rows(db, 'mentorshipRooms').push(room)
    return { ok: true, room: publicRoom(room) }
  })
}

export function updateMentorshipRoom(userId, roomId, body = {}) {
  return updateAuthorityDb(db => {
    const room = rows(db, 'mentorshipRooms').find(item => item.id === roomId)
    if (!owner(room, userId)) return { ok: false, error: 'room_not_found' }
    for (const field of ['name', 'description', 'paymentModel', 'status']) if (body[field] !== undefined) room[field] = clean(body[field])
    if (body.capacity !== undefined) { const capacity = Number(body.capacity); if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return { ok: false, error: 'invalid_capacity' }; room.capacity = capacity }
    if (body.expertise !== undefined) room.expertise = splitList(body.expertise)
    if (body.requiredSkills !== undefined) room.requiredSkills = splitList(body.requiredSkills)
    room.updatedAt = nowIso()
    return { ok: true, room: publicRoom(room) }
  })
}

export function applyToMentorshipRoom(userId, roomId, body = {}) {
  return updateAuthorityDb(db => {
    const room = rows(db, 'mentorshipRooms').find(item => item.id === roomId && item.status === 'published')
    if (!room) return { ok: false, error: 'room_not_found' }
    if (room.mentorId === userId) return { ok: false, error: 'mentor_cannot_apply' }
    const existing = rows(db, 'mentorshipApplications').find(item => item.roomId === roomId && item.applicantId === userId && item.status === 'pending')
    if (existing) return { ok: true, application: existing, idempotent: true }
    const enrolled = rows(db, 'mentorshipMentees').filter(item => item.roomId === roomId && item.status === 'active').length
    if (enrolled >= room.capacity) return { ok: false, error: 'room_capacity_reached' }
    const application = { id: createId('mentor_application'), roomId, applicantId: userId, coverLetter: clean(body.coverLetter) || '', skills: splitList(body.skills), experience: clean(body.experience) || '', status: 'pending', createdAt: nowIso(), updatedAt: nowIso() }
    rows(db, 'mentorshipApplications').push(application)
    rows(db, 'notifications').push({ id: createId('notif'), userId: room.mentorId, actorId: userId, type: 'milestone', content: `New application for ${room.name}`, linkTo: `/investor/mentorship/applications?roomId=${room.id}`, metadata: { roomId, applicationId: application.id }, read: false, createdAt: nowIso() })
    return { ok: true, application }
  })
}

export function listMentorshipApplications(userId, { roomId, status } = {}) {
  const db = readAuthorityDb()
  const ownedRooms = new Set(rows(db, 'mentorshipRooms').filter(room => owner(room, userId)).map(room => room.id))
  const applications = rows(db, 'mentorshipApplications').filter(item => ownedRooms.has(item.roomId) && (!roomId || item.roomId === roomId) && (!status || item.status === status))
  const profiles = rows(db, 'profiles')
  return { applications: applications.map(item => ({ ...item, applicantName: userName(profiles.find(p => p.id === item.applicantId)), roomName: rows(db, 'mentorshipRooms').find(r => r.id === item.roomId)?.name || item.roomId })) }
}

export function reviewMentorshipApplication(userId, applicationId, decision) {
  return updateAuthorityDb(db => {
    const application = rows(db, 'mentorshipApplications').find(item => item.id === applicationId)
    const room = rows(db, 'mentorshipRooms').find(item => item.id === application?.roomId)
    if (!application || !owner(room, userId)) return { ok: false, error: 'application_not_found' }
    if (!['accepted', 'rejected'].includes(decision)) return { ok: false, error: 'invalid_decision' }
    if (application.status !== 'pending') return { ok: true, application, idempotent: true }
    if (decision === 'accepted' && rows(db, 'mentorshipMentees').filter(item => item.roomId === room.id && item.status === 'active').length >= room.capacity) return { ok: false, error: 'room_capacity_reached' }
    application.status = decision; application.reviewedBy = userId; application.updatedAt = nowIso()
    if (decision === 'accepted') rows(db, 'mentorshipMentees').push({ id: createId('mentor_mentee'), roomId: room.id, userId: application.applicantId, applicationId, status: 'active', progress: 0, joinedAt: nowIso(), updatedAt: nowIso() })
    rows(db, 'notifications').push({ id: createId('notif'), userId: application.applicantId, actorId: userId, type: 'milestone', content: decision === 'accepted' ? `Your application to ${room.name} was accepted` : `Your application to ${room.name} was declined`, linkTo: `/investor/mentorship/rooms/${room.id}`, metadata: { roomId: room.id, applicationId }, read: false, createdAt: nowIso() })
    return { ok: true, application }
  })
}

export function createMentorshipTask(userId, roomId, body = {}) {
  return updateAuthorityDb(db => {
    const room = rows(db, 'mentorshipRooms').find(item => item.id === roomId)
    if (!owner(room, userId)) return { ok: false, error: 'room_not_found' }
    const task = { id: createId('mentor_task'), roomId, title: clean(body.title), description: clean(body.description) || '', assignedTo: clean(body.assignedTo) || null, dueDate: clean(body.dueDate) || null, priority: ['low', 'medium', 'high'].includes(body.priority) ? body.priority : 'medium', status: 'pending', createdBy: userId, createdAt: nowIso(), updatedAt: nowIso() }
    if (!task.title) return { ok: false, error: 'title_required' }
    rows(db, 'mentorshipTasks').push(task); return { ok: true, task }
  })
}

export function updateMentorshipTask(userId, taskId, body = {}) {
  return updateAuthorityDb(db => {
    const task = rows(db, 'mentorshipTasks').find(item => item.id === taskId)
    const room = rows(db, 'mentorshipRooms').find(item => item.id === task?.roomId)
    const mentee = rows(db, 'mentorshipMentees').find(item => item.roomId === task?.roomId && item.userId === userId && item.status === 'active')
    if (!task || (!owner(room, userId) && !mentee)) return { ok: false, error: 'task_not_found' }
    for (const field of ['title', 'description', 'dueDate', 'priority', 'status', 'assignedTo']) if (body[field] !== undefined) task[field] = clean(body[field])
    task.updatedAt = nowIso(); return { ok: true, task }
  })
}

export function createMentorshipMessage(userId, roomId, body = {}) {
  return updateAuthorityDb(db => {
    const room = rows(db, 'mentorshipRooms').find(item => item.id === roomId)
    const member = rows(db, 'mentorshipMentees').some(item => item.roomId === roomId && item.userId === userId && item.status === 'active')
    if (!owner(room, userId) && !member) return { ok: false, error: 'room_access_required' }
    const content = clean(body.content)
    if (!content) return { ok: false, error: 'content_required' }
    const message = { id: createId('mentor_message'), roomId, senderId: userId, content, createdAt: nowIso() }; rows(db, 'mentorshipMessages').push(message); return { ok: true, message }
  })
}

export async function createMentorshipMessageAsync(userId, roomId, body = {}) {
  const result = createMentorshipMessage(userId, roomId, body)
  if (!result.ok || !contentWriteEnabled()) return result
  try { await createMentorshipMessagePostgres(result.message); return result } catch (error) {
    console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'create_mentorship_message', error: error.message }))
    if (contentWriteFallbackEnabled()) return result
    return { ok: false, error: 'content_write_temporarily_unavailable' }
  }
}

export function createMentorshipResource(userId, roomId, body = {}) {
  return updateAuthorityDb(db => {
    const room = rows(db, 'mentorshipRooms').find(item => item.id === roomId)
    if (!owner(room, userId)) return { ok: false, error: 'room_not_found' }
    const title = clean(body.title); const url = clean(body.url)
    if (!title || !url) return { ok: false, error: 'title_and_url_required' }
    let parsed; try { parsed = new URL(url) } catch { return { ok: false, error: 'invalid_url' } }
    if (!['https:', 'http:'].includes(parsed.protocol)) return { ok: false, error: 'invalid_url' }
    const resource = { id: createId('mentor_resource'), roomId, title, url: parsed.toString(), kind: clean(body.kind) || 'link', createdBy: userId, createdAt: nowIso() }
    rows(db, 'mentorshipResources').push(resource); return { ok: true, resource }
  })
}

export function createMentorshipInvite(userId, roomId, body = {}) {
  return updateAuthorityDb(db => {
    const room = rows(db, 'mentorshipRooms').find(item => item.id === roomId)
    if (!owner(room, userId)) return { ok: false, error: 'room_not_found' }
    const token = randomBytes(32).toString('base64url')
    const invite = { id: createId('mentor_invite'), roomId, createdBy: userId, tokenHash: hashToken(token), expiresAt: body.expiresAt || new Date(Date.now() + 7 * 86400000).toISOString(), revokedAt: null, maxUses: Number(body.maxUses || 0), uses: 0, createdAt: nowIso() }
    rows(db, 'mentorshipInvitations').push(invite)
    return { ok: true, invitation: { id: invite.id, roomId, token, expiresAt: invite.expiresAt, url: `${process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || 'https://techit.network'}/investor/mentorship/invite/${encodeURIComponent(token)}` } }
  })
}

export function resolveMentorshipInvite(userId, token) {
  const db = readAuthorityDb(); const invite = rows(db, 'mentorshipInvitations').find(item => item.tokenHash === hashToken(token))
  if (!invite || invite.revokedAt || new Date(invite.expiresAt).getTime() <= Date.now() || (invite.maxUses > 0 && invite.uses >= invite.maxUses)) return { ok: false, error: 'invite_invalid_or_expired' }
  const room = rows(db, 'mentorshipRooms').find(item => item.id === invite.roomId && item.status === 'published')
  if (!room) return { ok: false, error: 'room_not_found' }
  return { ok: true, room: publicRoom(room), invitation: { id: invite.id, expiresAt: invite.expiresAt } }
}

export function acceptMentorshipInvite(userId, token, body = {}) {
  return updateAuthorityDb(db => {
    const invite = rows(db, 'mentorshipInvitations').find(item => item.tokenHash === hashToken(token))
    if (!invite || invite.revokedAt || new Date(invite.expiresAt).getTime() <= Date.now() || (invite.maxUses > 0 && invite.uses >= invite.maxUses)) {
      return { ok: false, error: 'invite_invalid_or_expired' }
    }
    const room = rows(db, 'mentorshipRooms').find(item => item.id === invite.roomId && item.status === 'published')
    if (!room) return { ok: false, error: 'room_not_found' }
    if (room.mentorId === userId) return { ok: false, error: 'mentor_cannot_join' }
    const existing = rows(db, 'mentorshipMentees').find(item => item.roomId === room.id && item.userId === userId && item.status === 'active')
    if (existing) return { ok: true, idempotent: true, room: publicRoom({ ...room, menteeCount: rows(db, 'mentorshipMentees').filter(item => item.roomId === room.id && item.status !== 'removed').length }), membership: existing }
    const enrolled = rows(db, 'mentorshipMentees').filter(item => item.roomId === room.id && item.status === 'active').length
    if (enrolled >= room.capacity) return { ok: false, error: 'room_capacity_reached' }
    const membership = { id: createId('mentor_mentee'), roomId: room.id, userId, invitationId: invite.id, status: 'active', progress: 0, joinedAt: nowIso(), updatedAt: nowIso() }
    rows(db, 'mentorshipMentees').push(membership)
    invite.uses = Number(invite.uses || 0) + 1
    invite.lastUsedAt = nowIso()
    rows(db, 'notifications').push({ id: createId('notif'), userId: room.mentorId, actorId: userId, type: 'milestone', content: `A founder joined ${room.name}`, linkTo: `/investor/mentorship/room/${room.id}`, metadata: { roomId: room.id, invitationId: invite.id }, read: false, createdAt: nowIso() })
    return { ok: true, room: publicRoom({ ...room, menteeCount: enrolled + 1 }), membership }
  })
}

export function revokeMentorshipInvite(userId, inviteId) { return updateAuthorityDb(db => { const invite = rows(db, 'mentorshipInvitations').find(item => item.id === inviteId && item.createdBy === userId); if (!invite) return { ok: false, error: 'invite_not_found' }; invite.revokedAt = nowIso(); return { ok: true } }) }

export function publishMentorshipFeed(userId, roomId, body = {}) {
  return updateAuthorityDb(db => {
    const room = rows(db, 'mentorshipRooms').find(item => item.id === roomId)
    if (!owner(room, userId)) return { ok: false, error: 'room_not_found' }
    const existing = rows(db, 'feedPosts').find(post => post.authorId === userId && post.metadata?.mentorshipRoomId === roomId && post.metadata?.shareKey === 'feed')
    if (existing) return { ok: true, post: existing, idempotent: true }
    const share = buildSharePayload(room)
    const post = { id: createId('feed_post'), authorId: userId, content: body.message || share.text, visibility: body.visibility || 'public', metadata: { mentorshipRoomId: roomId, shareKey: 'feed', url: share.url }, createdAt: nowIso(), updatedAt: nowIso() }
    rows(db, 'feedPosts').push(post); return { ok: true, post }
  })
}

export async function publishMentorshipFeedAsync(userId, roomId, body = {}) {
  const result = publishMentorshipFeed(userId, roomId, body)
  if (!result.ok || result.idempotent || !contentWriteEnabled()) return result
  try { await createFeedPostPostgres(result.post); return result } catch (error) {
    console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'publish_mentorship_feed', error: error.message }))
    if (contentWriteFallbackEnabled()) return result
    return { ok: false, error: 'content_write_temporarily_unavailable' }
  }
}

export function broadcastMentorshipOpportunity(userId, roomId, body = {}) {
  return updateAuthorityDb(db => {
    const room = rows(db, 'mentorshipRooms').find(item => item.id === roomId)
    if (!owner(room, userId)) return { ok: false, error: 'room_not_found' }
    const existing = rows(db, 'opportunities').find(item => item.createdBy === userId && item.sourceRoomId === roomId && item.type === 'mentorship')
    if (existing) return { ok: true, opportunity: existing, idempotent: true }
    const opportunity = { id: createId('opportunity'), createdBy: userId, ownerId: userId, type: 'mentorship', title: body.title || room.name, description: body.description || room.description, sourceRoomId: roomId, status: 'open', visibility: 'public', createdAt: nowIso(), updatedAt: nowIso() }
    rows(db, 'opportunities').push(opportunity); return { ok: true, opportunity }
  })
}

export function mentorshipAnalytics(userId, roomId) {
  const db = readAuthorityDb(); const rooms = rows(db, 'mentorshipRooms').filter(room => owner(room, userId) && (!roomId || room.id === roomId)); const ids = new Set(rooms.map(r => r.id)); const applications = rows(db, 'mentorshipApplications').filter(a => ids.has(a.roomId)); const mentees = rows(db, 'mentorshipMentees').filter(m => ids.has(m.roomId)); const tasks = rows(db, 'mentorshipTasks').filter(t => ids.has(t.roomId)); return { totalRooms: rooms.length, totalApplications: applications.length, pendingApplications: applications.filter(a => a.status === 'pending').length, activeMentees: mentees.filter(m => m.status === 'active').length, completedMentees: mentees.filter(m => m.status === 'completed').length, totalTasks: tasks.length, completedTasks: tasks.filter(t => t.status === 'completed').length }
}

export { buildSharePayload }
