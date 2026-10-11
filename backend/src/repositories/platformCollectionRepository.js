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

export function mapRow(row) {
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

// Bounded candidate window for discovery-style ranking: the most-recently
// updated rows of a collection (optionally filtered by one payload field such as
// visibility) capped at a configured limit, instead of the whole collection.
export async function listRecordsLimited(client, collectionName, { limit = 500, payloadField = null, payloadValue = null } = {}) {
  const clauses = ['collection_name=$1', 'deleted_at IS NULL']
  const values = [collectionName]
  if (payloadField) { values.push(String(payloadValue)); clauses.push(`payload->>'${payloadField}'=$${values.length}`) }
  values.push(Math.max(1, Math.min(10_000, Number(limit) || 500)))
  const result = await client.query(`SELECT * FROM platform_collection_records WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC LIMIT $${values.length}`, values)
  return result.rows.map(mapRow)
}

// Fetch a bounded set of records by id (e.g. the owners referenced by a
// candidate window) in a single query.
export async function listRecordsByIds(client, collectionName, ids = []) {
  const unique = [...new Set(ids.filter(Boolean).map(String))]
  if (!unique.length) return []
  const result = await client.query(
    `SELECT * FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL AND record_id=ANY($2)`,
    [collectionName, unique],
  )
  return result.rows.map(mapRow)
}

// Match rows whose payload field is one of a bounded set of values (e.g. every
// team of the addressed hackathons) in a single query.
export async function listRecordsByFieldIn(client, collectionName, field, values = [], { limit = null } = {}) {
  const unique = [...new Set(values.filter(Boolean).map(String))]
  if (!unique.length) return []
  const params = [collectionName, unique]
  let sql = `SELECT * FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL AND payload->>'${field}'=ANY($2) ORDER BY updated_at DESC`
  if (limit) { params.push(Math.max(1, Math.min(10_000, Number(limit) || 0))); sql += ` LIMIT $${params.length}` }
  const result = await client.query(sql, params)
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

// Match rows by an arbitrary payload field (e.g. a domain+id lookup that is
// not the owner column).
export async function listRecordsByField(client, collectionName, field, value) {
  const result = await client.query(
    `SELECT * FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL AND payload->>'${field}'=$2 ORDER BY updated_at DESC`,
    [collectionName, String(value)],
  )
  return result.rows.map(mapRow)
}

// Scoped row reads for §5 domain cutovers: one bounded query per collection
// instead of a whole-database snapshot. ownerFields close the gap where a row's
// owner lives in a payload field other than owner_id (collaboratorId,
// assigneeId, applicantId, ...).
export async function listRecordsForOwner(client, collectionName, value, { ownerFields = [] } = {}) {
  const clauses = ownerFields.map((field, index) => `payload->>'${field}'=$${index + 2}`)
  const where = [`collection_name=$1`, 'deleted_at IS NULL', `(owner_id=$2${clauses.length ? ` OR ${clauses.join(' OR ')}` : ''})`]
  const result = await client.query(
    `SELECT * FROM platform_collection_records WHERE ${where.join(' AND ')} ORDER BY updated_at DESC`,
    [collectionName, value, ...ownerFields.map(() => value)],
  )
  return result.rows.map(mapRow)
}

// Cross-collection owner queries (GDPR export/erasure): match every row the
// subject owns in any collection, by record id or by any owner-bearing payload
// field, without loading the whole database.
export async function listRecordsAcrossCollections(client, value, { ownerFields = [] } = {}) {
  const clauses = ownerFields.map((field, index) => `payload->>'${field}'=$${index + 2}`)
  const where = ['deleted_at IS NULL', `(owner_id=$1 OR record_id=$1${clauses.length ? ` OR ${clauses.join(' OR ')}` : ''})`]
  const result = await client.query(
    `SELECT * FROM platform_collection_records WHERE ${where.join(' AND ')} ORDER BY collection_name, updated_at DESC`,
    [value, ...ownerFields.map(() => value)],
  )
  return result.rows.map(row => ({ ...mapRow(row), collectionName: row.collection_name }))
}

export async function deleteRecordsAcrossCollections(client, value, { ownerFields = [] } = {}) {
  const clauses = ownerFields.map((field, index) => `payload->>'${field}'=$${index + 2}`)
  const where = ['deleted_at IS NULL', `(owner_id=$1 OR record_id=$1${clauses.length ? ` OR ${clauses.join(' OR ')}` : ''})`]
  const result = await client.query(
    `UPDATE platform_collection_records SET deleted_at=now(), version=version+1, updated_at=now()
     WHERE ${where.join(' AND ')}`,
    [value, ...ownerFields.map(() => value)],
  )
  return result.rowCount
}

// Soft-delete every row a subject owns in a collection (GDPR erasure).
export async function deleteRecordsForOwner(client, collectionName, value, { ownerFields = [] } = {}) {
  const clauses = ownerFields.map((field, index) => `payload->>'${field}'=$${index + 2}`)
  const where = [`collection_name=$1`, 'deleted_at IS NULL', `(owner_id=$2${clauses.length ? ` OR ${clauses.join(' OR ')}` : ''})`]
  const result = await client.query(
    `UPDATE platform_collection_records SET deleted_at=now(), version=version+1, updated_at=now()
     WHERE ${where.join(' AND ')}`,
    [collectionName, value, ...ownerFields.map(() => value)],
  )
  return result.rowCount
}

export async function closePlatformPool() {
  if (pool) await pool.end()
  pool = null
}
