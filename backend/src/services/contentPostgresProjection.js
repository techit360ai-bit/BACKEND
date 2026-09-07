import fs from 'node:fs/promises'
import pg from 'pg'
import { readDb } from '../config/database.js'

let pool = null
let timer = null
const url = () => process.env.CONTENT_DATABASE_URL || process.env.DATABASE_URL
const date = value => value || new Date().toISOString()
const json = value => JSON.stringify(value || {})
const owner = row => row.userId || row.ownerId || row.authorId || null
const project = row => row.projectId || row.startupId || null

async function upsert(client, table, row, columns) {
  const values = columns.map(column => column.value(row))
  const names = columns.map(column => column.name).join(',')
  const params = columns.map((_, index) => `$${index + 1}`).join(',')
  const updates = columns.filter(column => column.update !== false).map(column => `${column.name}=EXCLUDED.${column.name}`).join(',')
  await client.query(`INSERT INTO ${table}(${names}) VALUES(${params}) ON CONFLICT(id) DO UPDATE SET ${updates}`, values)
}

export async function syncContentProjection() {
  if (!pool) return { enabled: false }
  const db = readDb(); const client = await pool.connect()
  const sets = {
    core_feed_posts: db.feedPosts || [], core_feed_comments: db.feedComments || [], core_feed_likes: db.feedLikes || [],
    core_files: db.files || [], core_notifications: db.notifications || [], core_mentorship_messages: db.mentorshipMessages || [],
  }
  try {
    await client.query('BEGIN')
    for (const row of sets.core_feed_posts) await upsert(client, 'core_feed_posts', row, [{ name: 'id', value: r => r.id, update: false }, { name: 'user_id', value: owner }, { name: 'workspace_id', value: r => r.workspaceId || null }, { name: 'project_id', value: project }, { name: 'status', value: r => r.status || null }, { name: 'payload', value: json }, { name: 'created_at', value: r => date(r.createdAt), update: false }, { name: 'updated_at', value: r => date(r.updatedAt) }])
    for (const row of sets.core_feed_comments) await upsert(client, 'core_feed_comments', row, [{ name: 'id', value: r => r.id, update: false }, { name: 'post_id', value: r => r.postId || null }, { name: 'user_id', value: owner }, { name: 'payload', value: json }, { name: 'created_at', value: r => date(r.createdAt), update: false }, { name: 'updated_at', value: r => date(r.updatedAt) }])
    for (const row of sets.core_feed_likes) await upsert(client, 'core_feed_likes', row, [{ name: 'id', value: r => r.id, update: false }, { name: 'post_id', value: r => r.postId || null }, { name: 'user_id', value: owner }, { name: 'payload', value: json }, { name: 'created_at', value: r => date(r.createdAt), update: false }, { name: 'updated_at', value: r => date(r.updatedAt) }])
    for (const row of sets.core_files) await upsert(client, 'core_files', row, [{ name: 'id', value: r => r.id, update: false }, { name: 'user_id', value: owner }, { name: 'workspace_id', value: r => r.workspaceId || null }, { name: 'project_id', value: project }, { name: 'status', value: r => r.status || null }, { name: 'payload', value: json }, { name: 'created_at', value: r => date(r.createdAt), update: false }, { name: 'updated_at', value: r => date(r.updatedAt) }])
    for (const row of sets.core_notifications) await upsert(client, 'core_notifications', row, [{ name: 'id', value: r => r.id, update: false }, { name: 'user_id', value: owner }, { name: 'read', value: r => Boolean(r.read), }, { name: 'payload', value: json }, { name: 'created_at', value: r => date(r.createdAt), update: false }, { name: 'updated_at', value: r => date(r.updatedAt) }])
    for (const row of sets.core_mentorship_messages) await upsert(client, 'core_mentorship_messages', row, [{ name: 'id', value: r => r.id, update: false }, { name: 'room_id', value: r => r.roomId || null }, { name: 'user_id', value: owner }, { name: 'payload', value: json }, { name: 'created_at', value: r => date(r.createdAt), update: false }, { name: 'updated_at', value: r => date(r.updatedAt || r.createdAt) }])
    const count = await client.query(`SELECT (SELECT count(*) FROM core_feed_posts) AS posts,(SELECT count(*) FROM core_feed_comments) AS comments,(SELECT count(*) FROM core_feed_likes) AS likes,(SELECT count(*) FROM core_files) AS files,(SELECT count(*) FROM core_notifications) AS notifications,(SELECT count(*) FROM core_mentorship_messages) AS messages`)
    await client.query('COMMIT')
    const actual = Object.fromEntries(Object.entries(count.rows[0]).map(([key, value]) => [key, Number(value)]))
    const expected = { posts: sets.core_feed_posts.length, comments: sets.core_feed_comments.length, likes: sets.core_feed_likes.length, files: sets.core_files.length, notifications: sets.core_notifications.length, messages: sets.core_mentorship_messages.length }
    const mismatches = Object.fromEntries(Object.keys(expected).filter(key => actual[key] !== expected[key]).map(key => [key, { expected: expected[key], actual: actual[key] }]))
    return { enabled: true, ...actual, expected, mismatches, consistent: Object.keys(mismatches).length === 0 }
  } catch (error) { await client.query('ROLLBACK'); throw error } finally { client.release() }
}

export async function initializeContentPostgresProjection() {
  if (!url()) return { enabled: false }
  pool = new pg.Pool({ connectionString: url(), max: Math.max(1, Number(process.env.CONTENT_DB_POOL_SIZE || 5)), connectionTimeoutMillis: Number(process.env.CONTENT_DB_CONNECTION_TIMEOUT_MS || 5000), ssl: /sslmode=require/.test(url()) ? { rejectUnauthorized: process.env.CONTENT_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
  await pool.query(await fs.readFile(new URL('../../migrations/postgres/012_core_content_projection.sql', import.meta.url), 'utf8'))
  const initial = await syncContentProjection(); const interval = Math.max(5000, Number(process.env.CONTENT_PROJECTION_INTERVAL_MS || 30000))
  timer = setInterval(() => syncContentProjection().catch(error => console.error(JSON.stringify({ event: 'content_projection_failed', error: error.message }))), interval); timer.unref?.()
  return { enabled: true, ...initial }
}

export async function closeContentPostgresProjection() { if (timer) clearInterval(timer); timer = null; if (pool) await pool.end(); pool = null }
