import { createId, nowIso } from '../utils/api.js'
import { getPlatformPool, upsertRecord, deleteRecord } from './platformCollectionRepository.js'

const CONFIG_COLLECTIONS = new Set(['tvceConfig'])
const stable = value => JSON.stringify(value, Object.keys(value || {}).sort())

function mapRow(row) {
  return { ...(row.payload || {}), id: row.record_id, version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at }
}

export async function loadPlatformDatabase() {
  const result = await getPlatformPool().query('SELECT collection_name,record_id,payload,version,created_at,updated_at FROM platform_collection_records WHERE deleted_at IS NULL ORDER BY collection_name,updated_at')
  const snapshot = {}
  for (const row of result.rows) {
    if (CONFIG_COLLECTIONS.has(row.collection_name)) snapshot[row.collection_name] = row.payload
    else (snapshot[row.collection_name] ||= []).push(mapRow(row))
  }
  return snapshot
}

export async function flushPlatformDatabase(before, after, { userId = null } = {}) {
  const pool = getPlatformPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (userId) await client.query("SELECT set_config('app.user_id',$1,true)", [String(userId)])
    const names = new Set([...Object.keys(before || {}), ...Object.keys(after || {})])
    for (const name of names) {
      if (CONFIG_COLLECTIONS.has(name)) {
        const next = after[name]
        if (next && typeof next === 'object') await upsertRecord(client, name, { id: name, ...next, createdAt: next.createdAt || nowIso(), updatedAt: nowIso() }, { idempotencyKey: `platform-config:${name}:${Date.now()}`, operation: 'update' })
        continue
      }
      const previousRows = Array.isArray(before?.[name]) ? before[name] : []
      const nextRows = Array.isArray(after?.[name]) ? after[name] : []
      // The store is keyed by record_id, so a row without an id is silently
      // lost. Surface it instead: an id-less write is always a bug (it is how
      // the signup OTP failed to persist after the Postgres cutover).
      if (nextRows.some(row => !row?.id)) console.error(JSON.stringify({ event: 'platform_row_missing_id', collection: name, dropped: nextRows.filter(row => !row?.id).length }))
      const previous = new Map(previousRows.filter(row => row?.id).map(row => [String(row.id), row]))
      const next = new Map(nextRows.filter(row => row?.id).map(row => [String(row.id), row]))
      for (const [recordId, row] of next) {
        if (!previous.has(recordId) || stable(previous.get(recordId)) !== stable(row)) {
          await upsertRecord(client, name, row, { idempotencyKey: `platform:${name}:${recordId}:${row.updatedAt || Date.now()}`, operation: previous.has(recordId) ? 'update' : 'insert' })
        }
      }
      for (const recordId of previous.keys()) if (!next.has(recordId)) await deleteRecord(client, name, recordId, { idempotencyKey: `platform:${name}:${recordId}:delete:${Date.now()}` })
    }
    await client.query('COMMIT')
    return { ok: true }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function runWithPlatformDatabase(callback, { userId = null } = {}) {
  const before = await loadPlatformDatabase()
  const snapshot = structuredClone(before)
  const result = await callback(snapshot)
  await flushPlatformDatabase(before, snapshot, { userId })
  return result
}
