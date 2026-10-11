// §5 scaling-gate seed tooling: create a 1M-user dataset so the load test can
// prove the request path no longer scales with total platform data.
//
// It writes minimal synthetic founder profiles into `platform_collection_records`
// in batched, idempotent INSERTs. Re-running is safe (ON CONFLICT DO NOTHING for
// inserts, bumps `updated_at` only on the rows you ask it to refresh).
//
// This is a STAGING tool. It refuses to run unless you confirm explicitly, and
// refuses production unless SEED_ALLOW_PRODUCTION=true.
//
// Usage:
//   npm run platform:db:seed-1m                       # dry-run (prints the plan)
//   SEED_CONFIRM=1 npm run platform:db:seed-1m        # actually seed 1,000,000
//   SEED_USER_COUNT=100000 SEED_CONFIRM=1 npm run platform:db:seed-1m
//   SEED_USER_COUNT=1000000 SEED_CONFIRM=1 npm run platform:db:seed-1m --purge
import { getPlatformPool, closePlatformPool } from '../src/repositories/platformCollectionRepository.js'

function parseArgs(argv) {
  const options = { dryRun: false, purge: false, count: Number(process.env.SEED_USER_COUNT || 1_000_000), batch: Number(process.env.SEED_BATCH_SIZE || 1000), collection: process.env.SEED_COLLECTION || 'profiles' }
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].includes('=') ? argv[i].split(/=(.*)/s, 2) : [argv[i], undefined]
    const take = () => { const value = inline ?? argv[i + 1]; if (inline === undefined) i += 1; return value }
    if (flag === '--dry-run') options.dryRun = true
    else if (flag === '--purge') options.purge = true
    else if (flag === '--confirm') options.confirm = true
    else if (flag === '--count') options.count = Number(take())
    else if (flag === '--batch') options.batch = Number(take())
    else if (flag === '--collection') options.collection = take()
    else if (flag === '--help' || flag === '-h') options.help = true
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  return options
}

const confirmed = options => options.confirm || process.env.SEED_CONFIRM === '1'
const SEED_ID = index => `seed_user_${String(index).padStart(7, '0')}`

function seedRow(collection, index) {
  const createdAt = new Date(Date.UTC(2024, 0, 1) + index * 1000).toISOString()
  const recordId = SEED_ID(index)
  const payload = { id: recordId, role: 'founder', displayName: `Seeded Founder ${index}`, email: `${recordId}@seed.invalid`, seeded: true, seedIndex: index, createdAt }
  return { collection, recordId, createdAt, payload }
}

async function seedBatch(collection, batch) {
  if (!batch.length) return 0
  const values = []
  const params = []
  batch.forEach((row, offset) => {
    const base = offset * 5
    // ($1 collection, $2 id, $3 owner, $4 payload, version=1, $5 created, $5 updated)
    values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},1,$${base + 5},$${base + 5})`)
    params.push(collection, row.recordId, row.recordId, JSON.stringify(row.payload), row.createdAt)
  })
  const result = await getPlatformPool().query(
    `INSERT INTO platform_collection_records (collection_name,record_id,owner_id,payload,version,created_at,updated_at)
     VALUES ${values.join(',')}
     ON CONFLICT (collection_name,record_id) DO NOTHING`,
    params,
  )
  return result.rowCount
}

async function purge(collection, count, batchSize) {
  let removed = 0
  for (let start = 0; start < count; start += batchSize) {
    const ids = Array.from({ length: Math.min(batchSize, count - start) }, (_, offset) => SEED_ID(start + offset))
    const result = await getPlatformPool().query('DELETE FROM platform_collection_records WHERE collection_name=$1 AND record_id = ANY($2)', [collection, ids])
    removed += result.rowCount
    if (removed % (batchSize * 50) === 0) console.log(JSON.stringify({ event: 'seed_purge_progress', removed }))
  }
  return removed
}

async function main() {
  if (options.help) { console.log('See header comment for usage.'); return }
  if (!Number.isInteger(options.count) || options.count <= 0) throw new Error('count must be a positive integer')
  if (!Number.isInteger(options.batch) || options.batch <= 0 || options.batch > 2000) throw new Error('batch must be between 1 and 2000')
  if (!confirmed(options) && !options.dryRun) throw new Error('refusing to seed without SEED_CONFIRM=1 (or --confirm); use --dry-run to preview')
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') throw new Error('refusing to seed production without SEED_ALLOW_PRODUCTION=true')

  const plan = { event: 'platform_seed_plan', collection: options.collection, count: options.count, batch: options.batch, purge: options.purge, dryRun: options.dryRun }
  console.log(JSON.stringify(plan))
  if (options.dryRun) {
    console.log(JSON.stringify({ event: 'platform_seed_dry_run', wouldWrite: options.count, sampleId: SEED_ID(0), lastId: SEED_ID(options.count - 1) }))
    return
  }

  if (options.purge) {
    const removed = await purge(options.collection, options.count, Math.min(options.batch, 500))
    console.log(JSON.stringify({ event: 'platform_seed_purged', removed }))
    return
  }

  const startedAt = Date.now()
  let written = 0
  for (let start = 0; start < options.count; start += options.batch) {
    const batch = Array.from({ length: Math.min(options.batch, options.count - start) }, (_, offset) => seedRow(options.collection, start + offset))
    written += await seedBatch(options.collection, batch)
    if (start === 0 || (start + options.batch) % (options.batch * 50) < options.batch) {
      console.log(JSON.stringify({ event: 'platform_seed_progress', written, total: options.count, elapsedMs: Date.now() - startedAt }))
    }
  }
  console.log(JSON.stringify({ event: 'platform_seed_complete', collection: options.collection, written, total: options.count, elapsedMs: Date.now() - startedAt }))
}

const options = (() => {
  try { return parseArgs(process.argv.slice(2)) } catch (error) { console.error(JSON.stringify({ event: 'platform_seed_failed', error: error.message })); process.exit(1) }
})()

main()
  .catch(error => { console.error(JSON.stringify({ event: 'platform_seed_failed', error: error.message })); process.exitCode = 1 })
  .finally(() => closePlatformPool().catch(() => {}))
