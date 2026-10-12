// Row-level video-course store (§5 cutover).
//
// The lesson catalogue is a small global set; a member's progress is
// owner-scoped. Both used to come from the whole-DB snapshot. This repository
// resolves the catalogue plus the caller's progress rows and writes back only
// the rows a mutation changed. Gated by VIDEO_SOURCE=postgres; fallback
// VIDEO_FALLBACK_SQLITE keeps the snapshot until the authority is deleted.
import { withPlatformTransaction, listRecords, listRecordsForOwner, upsertRecord } from './platformCollectionRepository.js'
import { runBoundedDatabase } from '../config/database.js'

export function videoStoreEnabled() {
  return process.env.VIDEO_SOURCE === 'postgres' || process.env.VIDEO_READ_SOURCE === 'postgres' || process.env.VIDEO_WRITE_SOURCE === 'postgres'
}
export function videoFallbackEnabled() { return process.env.VIDEO_FALLBACK_SQLITE !== 'false' }

const WRITE_COLLECTIONS = ['videoLessons', 'videoProgress']

async function buildVideoDb(client, userId) {
  const db = { videoLessons: await listRecords(client, 'videoLessons'), videoProgress: [] }
  if (userId) db.videoProgress = await listRecordsForOwner(client, 'videoProgress', userId, { ownerFields: ['userId'] })
  return db
}

export async function runVideoRead(userId, read) {
  return withPlatformTransaction(async client => {
    const db = await buildVideoDb(client, userId)
    return runBoundedDatabase(db, async () => read())
  }, { userId })
}

export async function applyVideoMutation(userId, mutate) {
  return withPlatformTransaction(async client => {
    const db = await buildVideoDb(client, userId)
    const originals = new Map()
    for (const name of WRITE_COLLECTIONS) for (const row of db[name] || []) if (row?.id) originals.set(`${name}:${row.id}`, JSON.stringify(row))
    const result = await runBoundedDatabase(db, async () => mutate())
    for (const name of WRITE_COLLECTIONS) {
      for (const row of db[name] || []) {
        if (!row?.id) continue
        const key = `${name}:${row.id}`
        const next = JSON.stringify(row)
        if (originals.get(key) === next) continue
        await upsertRecord(client, name, row, { operation: originals.has(key) ? 'update' : 'insert', idempotencyKey: `${key}:${next.length}:${Date.now()}` })
      }
    }
    return result
  }, { userId })
}
