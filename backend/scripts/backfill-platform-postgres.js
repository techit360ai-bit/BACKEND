import crypto from 'node:crypto'
import { readDb } from '../src/config/database.js'
import { getPlatformPool, upsertRecord } from '../src/repositories/platformCollectionRepository.js'
import fs from 'node:fs/promises'

const source = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL
if (!source) throw new Error('PLATFORM_DATABASE_URL or DATABASE_URL is required')
const runId = `backfill_${crypto.randomUUID()}`
const startedAt = new Date().toISOString()
const configuredDriver = process.env.DB_DRIVER
if (configuredDriver === 'postgres') process.env.DB_DRIVER = process.env.LEGACY_DB_DRIVER || 'sqlite'
const db = readDb()
if (configuredDriver === 'postgres') process.env.DB_DRIVER = configuredDriver
const client = await getPlatformPool().connect()
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
let recordCount = 0
const collectionReport = {}
try {
  await client.query('BEGIN')
  await client.query('INSERT INTO platform_backfill_runs(id,source_driver,status,started_at) VALUES($1,$2,$3,$4)', [runId, process.env.DB_DRIVER || 'sqlite', 'running', startedAt])
  for (const [collectionName, value] of Object.entries(db)) {
    if (!Array.isArray(value)) continue
    let count = 0
    for (const record of value) {
      if (!record || typeof record !== 'object' || !record.id) continue
      await upsertRecord(client, collectionName, record, { idempotencyKey: `${runId}:${collectionName}:${record.id}`, operation: 'replay' })
      count += 1
      recordCount += 1
    }
    collectionReport[collectionName] = { count, checksum: hash(value.filter(record => record && record.id).sort((a, b) => String(a.id).localeCompare(String(b.id)))) }
  }
  await client.query('UPDATE platform_backfill_runs SET status=$1,collection_count=$2,record_count=$3,completed_at=$4,report=$5 WHERE id=$6', ['completed', Object.keys(collectionReport).length, recordCount, new Date().toISOString(), JSON.stringify(collectionReport), runId])
  await client.query('COMMIT')
  const output = process.env.PLATFORM_BACKFILL_REPORT_FILE || `/tmp/${runId}.json`
  await fs.writeFile(output, JSON.stringify({ runId, startedAt, completedAt: new Date().toISOString(), recordCount, collections: collectionReport }, null, 2))
  console.log(JSON.stringify({ event: 'platform_postgres_backfill_complete', runId, recordCount, collectionCount: Object.keys(collectionReport).length, output }))
} catch (error) {
  await client.query('ROLLBACK')
  await getPlatformPool().query('UPDATE platform_backfill_runs SET status=$1,completed_at=$2,report=$3 WHERE id=$4', ['failed', new Date().toISOString(), JSON.stringify({ error: error.message }), runId]).catch(() => {})
  throw error
} finally {
  client.release()
  await getPlatformPool().end()
}
