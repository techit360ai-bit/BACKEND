import { readDb as readAuthorityDb, writeDb as writeAuthorityDb } from '../config/database.js'
import { avatarGradient, createId, nowIso, timeAgo, userName } from '../utils/api.js'
import { recordActivityInDb } from '../services/discoveryService.js'
import { listNotifications as listNotificationsPostgres, createNotification as createNotificationPostgres, markNotificationRead as markNotificationReadPostgres, markAllNotificationsRead as markAllNotificationsReadPostgres, deleteNotification as deleteNotificationPostgres, contentReadEnabled, contentReadFallbackEnabled, contentWriteEnabled, contentWriteFallbackEnabled } from '../repositories/contentRepository.js'

const TYPES = new Set(['fire', 'comment', 'collab', 'gsis', 'milestone', 'mention', 'answer'])

function toNotification(n, db) {
  const actorProfile = db.profiles.find(p => p.id === n.actorId)
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

export async function listNotifications(req, res) {
  const db = readAuthorityDb()
  let notifications
  if (contentReadEnabled()) {
    try { notifications = (await listNotificationsPostgres(req.user.id)).map(n => toNotification(n, db)) } catch (error) {
      if (!contentReadFallbackEnabled()) throw error
      notifications = db.notifications.filter(n => n.userId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(n => toNotification(n, db))
    }
  } else notifications = db.notifications.filter(n => n.userId === req.user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(n => toNotification(n, db))
  return res.json({ notifications })
}

export async function createNotification(req, res) {
  const db = readAuthorityDb()
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
  db.notifications.push(notification)
  writeAuthorityDb(db)
  if (contentWriteEnabled()) {
    try { await createNotificationPostgres(notification) } catch (error) {
      console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'create_notification', error: error.message }))
      if (!contentWriteFallbackEnabled()) return res.status(503).json({ error: 'content_write_temporarily_unavailable' })
    }
  }
  return res.status(201).json(toNotification(notification, db))
}

export async function markNotificationRead(req, res) {
  const db = readAuthorityDb()
  const idx = db.notifications.findIndex(n => n.id === req.params.id && n.userId === req.user.id)
  if (idx === -1) return res.status(404).json({ error: 'Notification not found' })
  db.notifications[idx] = { ...db.notifications[idx], read: true }
  recordActivityInDb(db, req.user.id, 'notification_read', 'notifications')
  writeAuthorityDb(db)
  if (contentWriteEnabled()) {
    try { await markNotificationReadPostgres(req.user.id, req.params.id, db.notifications[idx].updatedAt || nowIso()) } catch (error) {
      console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'mark_notification_read', error: error.message }))
      if (!contentWriteFallbackEnabled()) return res.status(503).json({ error: 'content_write_temporarily_unavailable' })
    }
  }
  return res.json(toNotification(db.notifications[idx], db))
}

export async function markAllNotificationsRead(req, res) {
  const db = readAuthorityDb()
  db.notifications = db.notifications.map(n => (
    n.userId === req.user.id ? { ...n, read: true } : n
  ))
  recordActivityInDb(db, req.user.id, 'notification_read', 'notifications')
  writeAuthorityDb(db)
  if (contentWriteEnabled()) {
    try { await markAllNotificationsReadPostgres(req.user.id, nowIso()) } catch (error) {
      console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'mark_all_notifications_read', error: error.message }))
      if (!contentWriteFallbackEnabled()) return res.status(503).json({ error: 'content_write_temporarily_unavailable' })
    }
  }
  return res.json({ ok: true })
}

export async function deleteNotification(req, res) {
  const db = readAuthorityDb()
  const before = db.notifications.length
  db.notifications = db.notifications.filter(n => !(n.id === req.params.id && n.userId === req.user.id))
  if (db.notifications.length === before) return res.status(404).json({ error: 'Notification not found' })
  writeAuthorityDb(db)
  if (contentWriteEnabled()) {
    try { await deleteNotificationPostgres(req.user.id, req.params.id) } catch (error) {
      console.error(JSON.stringify({ event: 'content_postgres_write_failed', operation: 'delete_notification', error: error.message }))
      if (!contentWriteFallbackEnabled()) return res.status(503).json({ error: 'content_write_temporarily_unavailable' })
    }
  }
  return res.json({ ok: true })
}
