import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ client: null }))
vi.mock('../repositories/platformCollectionRepository.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, withPlatformTransaction: async (fn) => fn(state.client) }
})

const { runVideoRead, applyVideoMutation } = await import('../repositories/videoRepository.js')
const { readAuthorityDb } = await import('../config/database.js')

const toRow = collection => row => ({
  payload: row, record_id: row.id, owner_id: row.userId || null,
  version: 1, created_at: row.createdAt, updated_at: row.updatedAt, collection_name: collection, deleted_at: null,
})

function recordingClient(rowsByCollection = {}) {
  const calls = []
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql, values })
      const collection = values[0]
      const rows = rowsByCollection[collection] || []
      const match = sql.match(/payload->>'([^']+)'=\$(\d+)/)
      if (match) {
        const wanted = String(values[Number(match[2]) - 1])
        return { rows: rows.filter(row => String(row[match[1]]) === wanted).map(toRow(collection)), rowCount: 0 }
      }
      return { rows: rows.map(toRow(collection)), rowCount: 0 }
    },
  }
}

const dataset = () => ({
  videoLessons: [{ id: 'l1', title: 'Intro', order: 2 }, { id: 'l2', title: 'Basics', order: 1 }],
  videoProgress: [{ id: 'p1', userId: 'u1', lessonId: 'l1', progress: 50 }, { id: 'p2', userId: 'u2', lessonId: 'l2', progress: 10 }],
})

beforeEach(() => { state.client = recordingClient() })

describe('video row-level store (§5 cutover)', () => {
  it('reads the catalogue plus only the caller progress rows', async () => {
    state.client = recordingClient(dataset())
    const db = await runVideoRead('u1', () => readAuthorityDb())
    expect(db.videoLessons.map(lesson => lesson.id).sort()).toEqual(['l1', 'l2'])
    expect(db.videoProgress.map(row => row.id)).toEqual(['p1'])
  })

  it('persists a changed progress row through the bounded mutation', async () => {
    state.client = recordingClient(dataset())
    const result = await applyVideoMutation('u1', () => {
      const db = readAuthorityDb()
      db.videoProgress.find(row => row.id === 'p1').progress = 100
      return { ok: true }
    })
    expect(result).toEqual({ ok: true })
    expect(state.client.calls.some(call => /INSERT INTO platform_collection_records/.test(call.sql))).toBe(true)
  })
})
