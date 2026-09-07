import pg from 'pg'

let pool = null
const url = () => process.env.CONTENT_DATABASE_URL || process.env.DATABASE_URL
const enabled = () => process.env.CONTENT_READ_SOURCE === 'postgres'
const fallback = () => process.env.CONTENT_READ_FALLBACK_SQLITE !== 'false'

function getPool() {
  if (!url()) throw new Error('CONTENT_DATABASE_URL or DATABASE_URL is required for PostgreSQL content reads')
  pool ||= new pg.Pool({ connectionString: url(), max: Math.max(1, Number(process.env.CONTENT_READ_POOL_SIZE || 5)), connectionTimeoutMillis: Number(process.env.CONTENT_DB_CONNECTION_TIMEOUT_MS || 5000), ssl: /sslmode=require/.test(url()) ? { rejectUnauthorized: process.env.CONTENT_DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined })
  return pool
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
export function contentReadEnabled() { return enabled() }
export function contentReadFallbackEnabled() { return fallback() }
export async function closeContentRepository() { if (pool) await pool.end(); pool = null }
