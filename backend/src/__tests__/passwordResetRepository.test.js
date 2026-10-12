import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ client: null }))
vi.mock('../repositories/platformCollectionRepository.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, withPlatformTransaction: async (fn) => fn(state.client) }
})

const { replacePasswordReset, consumePasswordReset } = await import('../repositories/passwordResetRepository.js')

const toRow = row => ({ payload: row, record_id: row.id, owner_id: null, version: 1, created_at: row.createdAt, updated_at: row.updatedAt, collection_name: 'passwordResets', deleted_at: null })

function recordingClient(rows = []) {
  const calls = []
  return {
    calls,
    async query(sql, values = []) {
      calls.push({ sql, values })
      if (/payload->>'email'=\$/.test(sql)) {
        const wanted = String(values[1])
        return { rows: rows.filter(row => String(row.email) === wanted).map(toRow), rowCount: 0 }
      }
      if (/record_id=\$/.test(sql)) return { rows: [], rowCount: 0 }
      return { rows: [], rowCount: 0 }
    },
  }
}

const future = new Date(Date.now() + 600000).toISOString()
const past = new Date(Date.now() - 600000).toISOString()

beforeEach(() => { state.client = recordingClient([]) })

describe('password-reset row-level store (§5 cutover)', () => {
  it('writes the reset record row-level', async () => {
    state.client = recordingClient([])
    await replacePasswordReset({ id: 'r1', userId: 'u1', email: 'a@b.com', tokenHash: 'h1', expiresAt: future, consumedAt: null, createdAt: new Date().toISOString() })
    expect(state.client.calls.some(call => /INSERT INTO platform_collection_records/.test(call.sql))).toBe(true)
  })

  it('consumes a matching unexpired record and marks it used', async () => {
    state.client = recordingClient([{ id: 'r1', userId: 'u1', email: 'a@b.com', tokenHash: 'h1', expiresAt: future, consumedAt: null, createdAt: new Date().toISOString() }])
    const consumed = await consumePasswordReset('a@b.com', 'h1', new Date().toISOString())
    expect(consumed).not.toBeNull()
    expect(consumed.consumedAt).toBeTruthy()
    expect(state.client.calls.some(call => /INSERT INTO platform_collection_records/.test(call.sql))).toBe(true)
  })

  it('returns null for an unknown token', async () => {
    state.client = recordingClient([{ id: 'r1', userId: 'u1', email: 'a@b.com', tokenHash: 'h1', expiresAt: future, consumedAt: null }])
    expect(await consumePasswordReset('a@b.com', 'nope', new Date().toISOString())).toBeNull()
  })

  it('ignores expired records', async () => {
    state.client = recordingClient([{ id: 'r1', userId: 'u1', email: 'a@b.com', tokenHash: 'h1', expiresAt: past, consumedAt: null }])
    expect(await consumePasswordReset('a@b.com', 'h1', new Date().toISOString())).toBeNull()
  })
})
