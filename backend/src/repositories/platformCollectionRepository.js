import crypto from 'node:crypto'
import pg from 'pg'
import fs from 'node:fs/promises'

let pool = null

const source = () => process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL || process.env.IDENTITY_DATABASE_URL || process.env.WORKSPACE_DATABASE_URL || process.env.CONTENT_DATABASE_URL || process.env.FINANCE_DATABASE_URL
const poolSize = () => Math.max(1, Number(process.env.PLATFORM_DB_POOL_SIZE || 10))
// Every domain URL aliases the same RDS database (see ops/ec2/sync-env.mjs), so
// the whole backend shares a single pg.Pool. `statement_timeout` bounds a stuck
// query and `application_name` makes each server connection attributable in
// pg_stat_activity instead of an anonymous blob.
const applicationName = () => process.env.PLATFORM_DB_APP_NAME || 'techit-backend'
const now = () => new Date().toISOString()
const id = prefix => `${prefix}_${crypto.randomUUID()}`

// Domain repositories used to each construct their own pg.Pool to the same
// database, so fourteen pools competed for the RDS connection limit. They now
// forward here; this flag lets them report "postgres disabled" without
// throwing when no URL is configured (sqlite/test runs).
export function hasPlatformDatabaseUrl() {
  return Boolean(source())
}

function connectionOptions() {
  const connectionString = source()
  if (!connectionString) throw new Error('PLATFORM_DATABASE_URL or DATABASE_URL is required')
  return {
    connectionString,
    max: poolSize(),
    application_name: applicationName(),
    idleTimeoutMillis: Number(process.env.PLATFORM_DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PLATFORM_DB_CONNECTION_TIMEOUT_MS || 5000),
    ssl: /sslmode=require/.test(connectionString)
      ? { rejectUnauthorized: process.env.PLATFORM_DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : undefined,
  }
}

export function getPlatformPool() {
  pool ||= new pg.Pool(connectionOptions())
  return pool
}

// Non-creating introspection for probes and metrics: never opens the pool just
// to report on it, and never throws before the app has touched the database.
export function platformPoolStats() {
  if (!pool) return null
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    max: Number(pool.options?.max || 0),
    applicationName: pool.options?.application_name || null,
  }
}

export async function initializePlatformCollectionSchema() {
  const sql = await fs.readFile(new URL('../../migrations/postgres/014_platform_collection_records.sql', import.meta.url), 'utf8')
  await getPlatformPool().query(sql)
  return { enabled: true }
}

function normalizeRecord(record = {}) {
  const createdAt = record.createdAt || record.created_at || now()
  const updatedAt = record.updatedAt || record.updated_at || createdAt
  return {
    createdAt,
    updatedAt,
    ownerId: record.ownerId || record.userId || record.authorId || record.createdBy || null,
    organizationId: record.organizationId || record.ownerOrganizationId || null,
    workspaceId: record.workspaceId || null,
    projectId: record.projectId || record.startupId || null,
  }
}

function mapRow(row) {
  if (!row) return null
  return {
    ...(row.payload || {}),
    id: row.record_id,
    ownerId: row.owner_id || undefined,
    organizationId: row.organization_id || undefined,
    workspaceId: row.workspace_id || undefined,
    projectId: row.project_id || undefined,
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  }
}

export async function withPlatformTransaction(fn, { userId = null } = {}) {
  const client = await getPlatformPool().connect()
  try {
    await client.query('BEGIN')
    if (userId) await client.query("SELECT set_config('app.user_id',$1,true)", [String(userId)])
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getRecord(client, collectionName, recordId, { includeDeleted = false } = {}) {
  const result = await client.query(
    `SELECT * FROM platform_collection_records
     WHERE collection_name=$1 AND record_id=$2 ${includeDeleted ? '' : 'AND deleted_at IS NULL'}`,
    [collectionName, recordId],
  )
  return mapRow(result.rows[0])
}

export async function listRecords(client, collectionName, filters = {}) {
  const clauses = ['collection_name=$1']
  const values = [collectionName]
  const fields = { ownerId: 'owner_id', organizationId: 'organization_id', workspaceId: 'workspace_id', projectId: 'project_id' }
  for (const [key, column] of Object.entries(fields)) {
    if (filters[key] === undefined) continue
    values.push(filters[key])
    clauses.push(`${column}=$${values.length}`)
  }
  if (!filters.includeDeleted) clauses.push('deleted_at IS NULL')
  const result = await client.query(`SELECT * FROM platform_collection_records WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`, values)
  return result.rows.map(mapRow)
}

export async function upsertRecord(client, collectionName, record, { idempotencyKey = null, operation = 'update', expectedVersion = null } = {}) {
  if (!record?.id) throw new Error(`A stable id is required for ${collectionName}`)
  const metadata = normalizeRecord(record)
  const current = await getRecord(client, collectionName, record.id, { includeDeleted: true })
  if (expectedVersion !== null && current && Number(current.version) !== Number(expectedVersion)) {
    const error = new Error('platform_record_version_conflict')
    error.code = 'platform_record_version_conflict'
    throw error
  }
  const version = current ? Number(current.version) + 1 : 1
  await client.query(
    `INSERT INTO platform_collection_records
      (collection_name,record_id,owner_id,organization_id,workspace_id,project_id,payload,version,deleted_at,created_at,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10)
     ON CONFLICT(collection_name,record_id) DO UPDATE SET
       owner_id=EXCLUDED.owner_id, organization_id=EXCLUDED.organization_id,
       workspace_id=EXCLUDED.workspace_id, project_id=EXCLUDED.project_id,
       payload=EXCLUDED.payload, version=EXCLUDED.version, deleted_at=NULL,
       updated_at=EXCLUDED.updated_at`,
    [collectionName, record.id, metadata.ownerId, metadata.organizationId, metadata.workspaceId, metadata.projectId, JSON.stringify(record), version, metadata.createdAt, metadata.updatedAt],
  )
  await client.query(
    `INSERT INTO platform_collection_events(id,collection_name,record_id,operation,version,idempotency_key,payload,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT(idempotency_key) DO NOTHING`,
    [id('platform_event'), collectionName, record.id, operation, version, idempotencyKey, JSON.stringify(record), now()],
  )
  return { ...record, version }
}

export async function deleteRecord(client, collectionName, recordId, { expectedVersion = null, idempotencyKey = null } = {}) {
  const current = await getRecord(client, collectionName, recordId)
  if (!current) return false
  if (expectedVersion !== null && Number(current.version) !== Number(expectedVersion)) {
    const error = new Error('platform_record_version_conflict')
    error.code = 'platform_record_version_conflict'
    throw error
  }
  const deletedAt = now()
  await client.query('UPDATE platform_collection_records SET deleted_at=$1,version=version+1,updated_at=$1 WHERE collection_name=$2 AND record_id=$3', [deletedAt, collectionName, recordId])
  await client.query(
    `INSERT INTO platform_collection_events(id,collection_name,record_id,operation,version,idempotency_key,payload,created_at)
     VALUES($1,$2,$3,'delete',$4,$5,'{}',$6) ON CONFLICT(idempotency_key) DO NOTHING`,
    [id('platform_event'), collectionName, recordId, Number(current.version) + 1, idempotencyKey, deletedAt],
  )
  return true
}

export async function closePlatformPool() {
  // Idempotent and race-free: the reference is cleared synchronously before the
  // first await, so concurrent callers (the migration CLIs close several
  // repositories in Promise.all) can never double-end the shared pool.
  const current = pool
  pool = null
  if (current) await current.end().catch(() => {})
}
