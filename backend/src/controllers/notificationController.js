import { readDb as readAuthorityDb, writeDb as writeAuthorityDb } from '../config/database.js'
import { avatarGradient, createId, nowIso, timeAgo, userName } from '../utils/api.js'
import { recordActivityInDb, noteUserActivityAsync } from '../services/discoveryService.js'
import { listProfilesByIds } from '../repositories/identityRepository.js'
import { listNotifications as listNotificationsPostgres, createNotification as createNotificationPostgres, markNotificationRead as markNotificationReadPostgres, markAllNotificationsRead as markAllNotificationsReadPostgres, deleteNotification as deleteNotificationPostgres, contentReadEnabled, contentReadFallbackEnabled, contentWriteEnabled, contentWriteFallbackEnabled } from '../repositories/contentRepository.js'

const TYPES = new Set(['fire', 'comment', 'collab', 'gsis', 'milestone', 'mention', 'answer'])

function toNotification(n, findProfile = () => undefined) {
  const actorProfile = findProfile(n.actorId)
  return {
    id: n.id,
    type: TYPES.has(n.type) ? n.type : 'milestone',
    read: Boolean(n.read),
    content: n.content,
    author: n.author || userName(actorProfile, 'TechIT Platform'),
    avatar: n.avatar || avatarGradient(n.actorId || n.author || n.id),
    timeAgo: timeAgo(n.createdAt),
    linkTo: n.linkTo || '/feed',
    metadata: n.metadata && typeof n.metadata === 'object' ? n.metadata : undefined,
    createdAt: n.createdAt,
  }
}

const snapshotProfiles = db => id => (db.profiles || []).find(p => p.id === id)
const snapshotNotifications = (db, userId) => (db.notifications || [])
  .filter(n => n.userId === userId)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

export async function listNotifications(req, res) {
  if (contentReadEnabled()) {
    try {
      const rows = await listNotificationsPostgres(req.user.id)
      const profiles = await listProfilesByIds(rows.map(n => n.actorId))
      const byId = new Map(profiles.map(profile => [profile.id, profile]))
      return res.json({ notifications: rows.map(n => toNotification(n, id => byId.get(id))) })
    } catch (error) {
      console.error(JSON.stringify({ event: 'content_postgres_read_failed', operation: 'list_notifications', error: error.message }))
      if (!contentReadFallbackEnabled()) throw error
    }
  }
  const db = readAuthorityDb()
  return res.json({ notifications: snapshotNotifications(db, req.user.id).map(n => toNotification(n, snapshotProfiles(db))) })
}

export async function createNotification(req, res) {
  const type = TYPES.has(req.body.type) ? req.body.type : 'milestone'
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : ''
  if (!content) return res.status(400).json({ error: 'Content is required' })
  const createdAt = nowIso()
  const notification = {
    id: createId('notif'),
    userId: req.user.id,
    actorId: req.body.actorId || req.user.id,
    type,
    read: false,
    content,
    author: req.body.author,
    avatar: req.body.avatar,
    linkTo: req.body.linkTo || '/feed',
    createdAt,
  }
  if (contentWriteEnabled()) {
    try {
      await createNotificationPostgres(notification)
      return res.status(201).json(toNotification(notification))
    } catch (error) {
      console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'create_notification', error: error.message }))
      if (!contentWriteFallbackEnabled()) return res.status(503).json({ error: 'content_write_temporarily_unavailable' })
    }
  }
  const db = readAuthorityDb()
  if (!Array.isArray(db.notifications)) db.notifications = []
  db.notifications.push(notification)
  writeAuthorityDb(db)
  return res.status(201).json(toNotification(notification, snapshotProfiles(db)))
}

export async function markNotificationRead(req, res) {
  const updatedAt = nowIso()
  if (contentWriteEnabled()) {
    try {
      const payload = await markNotificationReadPostgres(req.user.id, req.params.id, updatedAt)
      if (!payload) return res.status(404).json({ error: 'Notification not found' })
      await noteUserActivityAsync(req.user.id, 'notification_read', 'notifications')
      return res.json(toNotification(payload))
    } catch (error) {
      console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'mark_notification_read', error: error.message }))
      if (!contentWriteFallbackEnabled()) return res.status(503).json({ error: 'content_write_temporarily_unavailable' })
    }
  }
  const db = readAuthorityDb()
  const idx = (db.notifications || []).findIndex(n => n.id === req.params.id && n.userId === req.user.id)
  if (idx === -1) return res.status(404).json({ error: 'Notification not found' })
  db.notifications[idx] = { ...db.notifications[idx], read: true }
  recordActivityInDb(db, req.user.id, 'notification_read', 'notifications')
  writeAuthorityDb(db)
  return res.json(toNotification(db.notifications[idx], snapshotProfiles(db)))
}

export async function markAllNotificationsRead(req, res) {
  if (contentWriteEnabled()) {
    try {
      await markAllNotificationsReadPostgres(req.user.id, nowIso())
      await noteUserActivityAsync(req.user.id, 'notification_read', 'notifications')
      return res.json({ ok: true })
    } catch (error) {
      console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'mark_all_notifications_read', error: error.message }))
      if (!contentWriteFallbackEnabled()) return res.status(503).json({ error: 'content_write_temporarily_unavailable' })
    }
  }
  const db = readAuthorityDb()
  db.notifications = (db.notifications || []).map(n => (
    n.userId === req.user.id ? { ...n, read: true } : n
  ))
  recordActivityInDb(db, req.user.id, 'notification_read', 'notifications')
  writeAuthorityDb(db)
  return res.json({ ok: true })
}

export async function deleteNotification(req, res) {
  if (contentWriteEnabled()) {
    try {
      const deleted = await deleteNotificationPostgres(req.user.id, req.params.id)
      if (!deleted) return res.status(404).json({ error: 'Notification not found' })
      return res.json({ ok: true })
    } catch (error) {
      console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'delete_notification', error: error.message }))
      if (!contentWriteFallbackEnabled()) return res.status(503).json({ error: 'content_write_temporarily_unavailable' })
    }
  }
  const db = readAuthorityDb()
  const before = (db.notifications || []).length
  db.notifications = (db.notifications || []).filter(n => !(n.id === req.params.id && n.userId === req.user.id))
  if (db.notifications.length === before) return res.status(404).json({ error: 'Notification not found' })
  writeAuthorityDb(db)
  return res.json({ ok: true })
}
