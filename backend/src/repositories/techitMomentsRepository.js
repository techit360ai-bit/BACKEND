// Row-level TechIT Moments store (§5 cutover).
//
// Moments, their share/referral/event trail and the cross-domain evidence rows
// that generate them live in platform_collection_records, so the moments/viral
// flows never load the whole-database snapshot. Enabled with
// MOMENTS_SOURCE=postgres; the sqlite/json snapshot fallback is retained in the
// service until the snapshot authority is deleted.
import { withPlatformTransaction, getRecord, upsertRecord } from './platformCollectionRepository.js'

const MOMENTS = 'techitMoments'
const EVENTS = 'techitMomentEvents'
const SHARES = 'techitMomentShares'
const REFERRALS = 'techitMomentReferrals'

// Source collections the moment generator reads, with the owner-bearing fields
// each one may use. owner_id only covers ownerId/userId/authorId/createdBy, so
// the payload filter closes the gap for collaborator/assignee/applicant style
// rows.
const SOURCE_OWNER_FIELDS = {
  projects: ['ownerId', 'userId', 'founderId'],
  ventureIntakes: ['ownerId', 'userId', 'founderId'],
  ventureAnalyses: ['ownerId', 'userId', 'founderId'],
  pivotRecords: ['userId', 'ownerId'],
  contributions: ['collaboratorId', 'userId'],
  workspaceTasks: ['assigneeId', 'assignedTo', 'userId', 'ownerId'],
  mentorshipTasks: ['assigneeId', 'assignedTo', 'userId', 'ownerId'],
  opportunityApplications: ['applicantId', 'userId'],
  feedPosts: ['authorId', 'userId'],
  investorWatchlists: ['investorId', 'userId'],
}

export function momentsStoreEnabled() {
  return ['MOMENTS_SOURCE', 'MOMENTS_READ_SOURCE', 'MOMENTS_WRITE_SOURCE'].some(key => process.env[key] === 'postgres')
}
export function momentsFallbackEnabled() { return process.env.MOMENTS_FALLBACK_SQLITE !== 'false' }

function mapRow(row) {
  if (!row) return null
  return { ...(row.payload || {}), id: row.record_id, ownerId: row.owner_id || undefined, version: Number(row.version), createdAt: row.created_at, updatedAt: row.updated_at }
}

// One bounded query per source collection instead of a whole-database read.
export async function loadMomentSources(userId) {
  return withPlatformTransaction(async client => {
    const out = {}
    for (const [collection, fields] of Object.entries(SOURCE_OWNER_FIELDS)) {
      const clauses = fields.map((field, index) => `payload->>'${field}'=$${index + 2}`)
      const result = await client.query(
        `SELECT payload FROM platform_collection_records
         WHERE collection_name=$1 AND deleted_at IS NULL AND (owner_id=$2 OR ${clauses.join(' OR ')})`,
        [collection, userId, ...fields.map(() => userId)],
      )
      out[collection] = result.rows.map(row => ({ ...(row.payload || {}) }))
    }
    return out
  })
}

export async function loadProfile(userId) {
  return withPlatformTransaction(async client => (await getRecord(client, 'profiles', userId)) || (await getRecord(client, 'users', userId)))
}

export async function listUserMoments(userId) {
  return withPlatformTransaction(async client => {
    const result = await client.query(
      `SELECT * FROM platform_collection_records
       WHERE collection_name=$1 AND deleted_at IS NULL AND (owner_id=$2 OR payload->>'userId'=$2)
       ORDER BY updated_at DESC`,
      [MOMENTS, userId],
    )
    return result.rows.map(mapRow)
  })
}

export async function getMoment(momentId) {
  return withPlatformTransaction(client => getRecord(client, MOMENTS, momentId))
}

export async function getPublishedMomentBySlug(slug) {
  if (!slug) return null
  return withPlatformTransaction(async client => {
    const result = await client.query(
      `SELECT * FROM platform_collection_records
       WHERE collection_name=$1 AND deleted_at IS NULL AND payload->>'publicSlug'=$2 AND payload->>'status'='published'
       LIMIT 1`,
      [MOMENTS, slug],
    )
    return mapRow(result.rows[0])
  })
}

export async function insertMoments(moments = [], events = []) {
  if (!moments.length && !events.length) return
  return withPlatformTransaction(async client => {
    for (const moment of moments) await upsertRecord(client, MOMENTS, moment, { operation: 'insert', idempotencyKey: `moments:${moment.id}` })
    for (const event of events) await upsertRecord(client, EVENTS, event, { operation: 'insert', idempotencyKey: `moment-event:${event.id}` })
  }, { userId: moments[0]?.userId || null })
}

export async function saveMoment(moment, events = []) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, MOMENTS, moment.id)
    await upsertRecord(client, MOMENTS, moment, {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `moments:${moment.id}:${moment.updatedAt || Date.now()}`,
    })
    for (const event of events) await upsertRecord(client, EVENTS, event, { operation: 'insert', idempotencyKey: `moment-event:${event.id}` })
    return moment
  }, { userId: moment.userId || null })
}

export async function insertShare(share, events = []) {
  return withPlatformTransaction(async client => {
    await upsertRecord(client, SHARES, share, { operation: 'insert', idempotencyKey: `moment-share:${share.id}` })
    for (const event of events) await upsertRecord(client, EVENTS, event, { operation: 'insert', idempotencyKey: `moment-event:${event.id}` })
    return share
  }, { userId: share.userId || null })
}

export async function getShare(shareId) {
  if (!shareId) return null
  return withPlatformTransaction(client => getRecord(client, SHARES, shareId))
}

export async function insertReferral(referral, events = []) {
  return withPlatformTransaction(async client => {
    await upsertRecord(client, REFERRALS, referral, { operation: 'insert', idempotencyKey: `moment-referral:${referral.id}` })
    for (const event of events) await upsertRecord(client, EVENTS, event, { operation: 'insert', idempotencyKey: `moment-event:${event.id}` })
    return referral
  }, { userId: referral.userId || null })
}

export async function getReferral(referralId) {
  if (!referralId) return null
  return withPlatformTransaction(client => getRecord(client, REFERRALS, referralId))
}

export async function saveReferral(referral, events = []) {
  return withPlatformTransaction(async client => {
    const current = await getRecord(client, REFERRALS, referral.id)
    await upsertRecord(client, REFERRALS, referral, {
      operation: current ? 'update' : 'insert',
      expectedVersion: current ? current.version : null,
      idempotencyKey: `moment-referral:${referral.id}:${referral.activatedAt || Date.now()}`,
    })
    for (const event of events) await upsertRecord(client, EVENTS, event, { operation: 'insert', idempotencyKey: `moment-event:${event.id}` })
    return referral
  }, { userId: referral.signupUserId || referral.userId || null })
}

export async function listShares(momentIds = []) {
  if (!momentIds.length) return []
  return withPlatformTransaction(async client => {
    const result = await client.query(
      `SELECT * FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL AND payload->>'momentId' = ANY($2)`,
      [SHARES, momentIds],
    )
    return result.rows.map(mapRow)
  })
}

export async function listReferrals(momentIds = []) {
  if (!momentIds.length) return []
  return withPlatformTransaction(async client => {
    const result = await client.query(
      `SELECT * FROM platform_collection_records WHERE collection_name=$1 AND deleted_at IS NULL AND payload->>'momentId' = ANY($2)`,
      [REFERRALS, momentIds],
    )
    return result.rows.map(mapRow)
  })
}
