import { getPlatformPool, closePlatformPool } from './platformCollectionRepository.js'

const url = () => process.env.CONTENT_DATABASE_URL || process.env.DATABASE_URL
const enabled = () => process.env.CONTENT_READ_SOURCE === 'postgres'
const fallback = () => process.env.CONTENT_READ_FALLBACK_SQLITE !== 'false'

function getPool() {
  if (!url()) throw new Error('CONTENT_DATABASE_URL or DATABASE_URL is required for PostgreSQL content reads')
  return getPlatformPool()
}

const merged = row => {
  const result = { ...(row.payload || {}), id: row.id }
  for (const [key, value] of Object.entries({ ownerId: row.user_id, userId: row.user_id, workspaceId: row.workspace_id, projectId: row.project_id, status: row.status, read: row.read, createdAt: row.created_at, updatedAt: row.updated_at })) if (value !== null && value !== undefined) result[key] = value
  return result
}
export async function listFiles(userId, workspaceId) {
  const result = await getPool().query('SELECT * FROM core_files WHERE user_id=$1 AND workspace_id=$2 ORDER BY updated_at DESC', [userId, workspaceId])
  return result.rows.map(merged)
}
export async function listNotifications(userId) {
  const result = await getPool().query('SELECT * FROM core_notifications WHERE user_id=$1 ORDER BY created_at DESC', [userId])
  return result.rows.map(merged)
}
export async function createFile(file) {
  await getPool().query('INSERT INTO core_files(id,user_id,workspace_id,project_id,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [file.id, file.ownerId, file.workspaceId || null, file.projectId || null, file.status || null, JSON.stringify(file), file.createdAt, file.updatedAt])
  return file
}
export async function deleteFile(userId, fileId) {
  const result = await getPool().query('DELETE FROM core_files WHERE id=$1 AND user_id=$2', [fileId, userId])
  return result.rowCount > 0
}
export async function createNotification(notification) {
  await getPool().query('INSERT INTO core_notifications(id,user_id,read,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6)', [notification.id, notification.userId, Boolean(notification.read), JSON.stringify(notification), notification.createdAt, notification.updatedAt || notification.createdAt])
  return notification
}
export async function markNotificationRead(userId, id, updatedAt) {
  const result = await getPool().query("UPDATE core_notifications SET read=true,updated_at=$1,payload=jsonb_set(payload,'{read}','true'::jsonb) WHERE id=$2 AND user_id=$3 RETURNING payload", [updatedAt, id, userId])
  return result.rows[0]?.payload || null
}
export async function markAllNotificationsRead(userId, updatedAt) {
  const result = await getPool().query("UPDATE core_notifications SET read=true,updated_at=$1,payload=jsonb_set(payload,'{read}','true'::jsonb) WHERE user_id=$2 AND read=false", [updatedAt, userId])
  return result.rowCount
}
export async function deleteNotification(userId, id) {
  const result = await getPool().query('DELETE FROM core_notifications WHERE id=$1 AND user_id=$2', [id, userId])
  return result.rowCount > 0
}
export async function createMentorshipMessage(message) {
  await getPool().query('INSERT INTO core_mentorship_messages(id,room_id,user_id,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6)', [message.id, message.roomId, message.senderId, JSON.stringify(message), message.createdAt, message.updatedAt || message.createdAt])
  return message
}
export async function createFeedPost(post) {
  await getPool().query('INSERT INTO core_feed_posts(id,user_id,workspace_id,project_id,status,payload,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [post.id, post.authorId || post.userId, post.workspaceId || null, post.projectId || null, post.status || null, JSON.stringify(post), post.createdAt, post.updatedAt || post.createdAt])
  return post
}
export function contentReadEnabled() { return enabled() }
export function contentReadFallbackEnabled() { return fallback() }
export function contentWriteEnabled() { return process.env.CONTENT_WRITE_SOURCE === 'postgres' }
export function contentWriteFallbackEnabled() { return process.env.CONTENT_WRITE_FALLBACK_SQLITE !== 'false' }
export async function closeContentRepository() { await closePlatformPool() }
