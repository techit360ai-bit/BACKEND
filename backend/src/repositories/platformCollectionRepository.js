import crypto from 'node:crypto'
import pg from 'pg'
import fs from 'node:fs/promises'

let pool = null

const source = () => process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL || process.env.IDENTITY_DATABASE_URL || process.env.WORKSPACE_DATABASE_URL || process.env.CONTENT_DATABASE_URL || process.env.FINANCE_DATABASE_URL
const poolSize = () => Math.max(1, Number(process.env.PLATFORM_DB_POOL_SIZE || 10))
const now = () => new Date().toISOString()
const id = prefix => `${prefix}_${crypto.randomUUID()}`

function connectionOptions() {
  const connectionString = source()
  if (!connectionString) throw new Error('PLATFORM_DATABASE_URL or DATABASE_URL is required')
  return {
    connectionString,
    max: poolSize(),
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
  if (pool) await pool.end()
  pool = null
}
