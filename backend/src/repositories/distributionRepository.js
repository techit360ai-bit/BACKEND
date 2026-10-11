// Row-level distribution/referral store (§5 cutover).
//
// Distribution objects, shares, attributions and growth events live in
// platform_collection_records (indexed by collection_name/owner), so the viral
// loop never loads the whole-database snapshot. Enabled with
// DISTRIBUTION_SOURCE=postgres; the sqlite/json snapshot fallback is retained in
// the service until the snapshot authority is deleted.
import { getPlatformPool, withPlatformTransaction, getRecord, upsertRecord } from './platformCollectionRepository.js'

const OBJECTS = 'distributionObjects'
const SHARES = 'distributionShares'
const ATTRIBUTIONS = 'distributionAttributions'
const EVENTS = 'growthEvents'
const SOURCE_COLLECTIONS = ['techitMoments', 'achievements', 'projectMilestones', 'validationSessions', 'investorReadiness']

const enabled = () => ['DISTRIBUTION_SOURCE', 'DISTRIBUTION_READ_SOURCE', 'DISTRIBUTION_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
const fallback = () => process.env.DISTRIBUTION_FALLBACK_SQLITE !== 'false'

export function distributionStoreEnabled() { return enabled() }
export function distributionFallbackEnabled() { return fallback() }

// platformCollectionRepository derives owner_id from ownerId/userId/authorId/
// createdBy. Distribution rows use creatorId/actorId, so set ownerId explicitly.
const owned = (row, ownerId) => ({ ...row, ownerId: ownerId ?? row.ownerId ?? row.userId ?? row.creatorId ?? row.actorId ?? row.signupUserId ?? null })

async function writeEvents(client, events = []) {
  for (const event of events) await upsertRecord(client, EVENTS, owned(event, event.actorId || event.userId), { operation: 'insert', idempotencyKey: `growth:${event.id}` })
}

export async function findDistributionSourceOwner(sourceId) {
  if (!sourceId) return null
  const result = await getPlatformPool().query(
    `SELECT payload FROM platform_collection_records
     WHERE collection_name = ANY($1) AND deleted_at IS NULL AND payload->>'id'=$2
     LIMIT 1`,
    [SOURCE_COLLECTIONS, String(sourceId)],
  )
  const row = result.rows[0]?.payload
  return row?.userId || row?.ownerId || row?.createdBy || row?.founderId || null
}

export async function insertDistributionObject(object, events = []) {
  return withPlatformTransaction(async client => {
    await upsertRecord(client, OBJECTS, owned(object, object.creatorId), { operation: 'insert', idempotencyKey: `distribution:object:${object.id}` })
    await writeEvents(client, events)
    return object
  }, { userId: object.creatorId })
}

export async function loadDistributionObject(id) {
  if (!id) return null
  return withPlatformTransaction(client => getRecord(client, OBJECTS, id))
}

export async function loadDistributionAttribution(id) {
  if (!id) return null
  return withPlatformTransaction(client => getRecord(client, ATTRIBUTIONS, id))
}

export async function saveDistributionObject(object, events = []) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, OBJECTS, object.id)
    await upsertRecord(client, OBJECTS, owned(object, object.creatorId), {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `distribution:object:${object.id}:${object.updatedAt || Date.now()}`,
    })
    await writeEvents(client, events)
    return object
  }, { userId: object.creatorId })
}

export async function insertDistributionShare(share, events = []) {
  return withPlatformTransaction(async client => {
    await upsertRecord(client, SHARES, owned(share, share.userId), { operation: 'insert', idempotencyKey: `distribution:share:${share.id}` })
    await writeEvents(client, events)
    return share
  }, { userId: share.userId })
}

export async function insertDistributionAttribution(attribution, events = []) {
  return withPlatformTransaction(async client => {
    await upsertRecord(client, ATTRIBUTIONS, owned(attribution, attribution.userId), { operation: 'insert', idempotencyKey: `distribution:attribution:${attribution.id}` })
    await writeEvents(client, events)
    return attribution
  })
}

export async function updateDistributionAttribution(attribution, events = []) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, ATTRIBUTIONS, attribution.id)
    await upsertRecord(client, ATTRIBUTIONS, owned(attribution, attribution.userId || attribution.signupUserId), {
      operation: 'update',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `distribution:attribution:${attribution.id}:${attribution.lastTouch || Date.now()}`,
    })
    await writeEvents(client, events)
    return attribution
  })
}

export async function distributionAggregates() {
  const pool = getPlatformPool()
  const counts = await pool.query(
    `SELECT
       count(*) FILTER (WHERE collection_name=$1) AS objects,
       count(*) FILTER (WHERE collection_name=$1 AND payload->>'visibility'='PUBLIC') AS public_objects,
       count(*) FILTER (WHERE collection_name=$2) AS shares,
       count(*) FILTER (WHERE collection_name=$3) AS visits,
       count(*) FILTER (WHERE collection_name=$3 AND payload->>'signupUserId' IS NOT NULL) AS signups,
       count(*) FILTER (WHERE collection_name=$3 AND payload->>'activatedAt' IS NOT NULL) AS activated,
       count(*) FILTER (WHERE collection_name=$3 AND payload->>'convertedAt' IS NOT NULL) AS converted,
       count(*) FILTER (WHERE collection_name=$3 AND payload->>'source'='direct') AS direct_visits
     FROM platform_collection_records WHERE collection_name = ANY($4) AND deleted_at IS NULL`,
    [OBJECTS, SHARES, ATTRIBUTIONS, [OBJECTS, SHARES, ATTRIBUTIONS]],
  )
  const inviters = await pool.query(
    `SELECT count(DISTINCT payload->>'userId') AS inviters FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL`,
    [SHARES],
  )
  const events = await pool.query(
    `SELECT payload FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100`,
    [EVENTS],
  )
  const row = counts.rows[0] || {}
  const number = key => Number(row[key]) || 0
  return {
    objects: number('objects'),
    publicObjects: number('public_objects'),
    shares: number('shares'),
    visits: number('visits'),
    signups: number('signups'),
    activated: number('activated'),
    converted: number('converted'),
    directVisits: number('direct_visits'),
    inviters: Number(inviters.rows[0]?.inviters) || 0,
    events: events.rows.map(entry => entry.payload),
  }
}

export async function closeDistributionPool() { /* pool is shared with platformCollectionRepository */ }
