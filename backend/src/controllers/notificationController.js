import { readDb, writeDb } from '../config/database.js'
import { avatarGradient, createId, nowIso, timeAgo, userName } from '../utils/api.js'

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

export function listNotifications(req, res) {
  const db = readDb()
  const notifications = db.notifications
    .filter(n => n.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(n => toNotification(n, db))
  return res.json({ notifications })
}

export function createNotification(req, res) {
  const db = readDb()
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
  writeDb(db)
  return res.status(201).json(toNotification(notification, db))
}

export function markNotificationRead(req, res) {
  const db = readDb()
  const idx = db.notifications.findIndex(n => n.id === req.params.id && n.userId === req.user.id)
  if (idx === -1) return res.status(404).json({ error: 'Notification not found' })
  db.notifications[idx] = { ...db.notifications[idx], read: true }
  writeDb(db)
  return res.json(toNotification(db.notifications[idx], db))
}

export function markAllNotificationsRead(req, res) {
  const db = readDb()
  db.notifications = db.notifications.map(n => (
    n.userId === req.user.id ? { ...n, read: true } : n
  ))
  writeDb(db)
  return res.json({ ok: true })
}

export function deleteNotification(req, res) {
  const db = readDb()
  const before = db.notifications.length
  db.notifications = db.notifications.filter(n => !(n.id === req.params.id && n.userId === req.user.id))
  if (db.notifications.length === before) return res.status(404).json({ error: 'Notification not found' })
  writeDb(db)
  return res.json({ ok: true })
}
