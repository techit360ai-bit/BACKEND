import { describe, expect, it } from 'vitest'
import {
  listRecordsForOwner,
  deleteRecordsForOwner,
  listRecordsAcrossCollections,
  deleteRecordsAcrossCollections,
} from '../repositories/platformCollectionRepository.js'

// Regression guard for the owner-scoped query builders. Each of these emits a
// variable number of payload-field clauses, and an off-by-one between the
// highest `$N` placeholder and the bind array silently breaks every row-level
// read/write (the request then falls back to the whole-DB snapshot). Assert the
// two always line up.
const maxPlaceholder = sql => Math.max(...[...sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1])), 0)

function recordingClient() {
  const calls = []
  const client = {
    calls,
    async query(sql, values = []) {
      calls.push({ sql, values })
      return { rows: [], rowCount: 0 }
    },
  }
  return client
}

const ownerFieldCases = [[[]], [['a']], [['a', 'b']], [['a', 'b', 'c']]]

describe('owner-scoped platform collection queries', () => {
  it.each(ownerFieldCases)('listRecordsForOwner binds one value per placeholder (ownerFields=%j)', async ownerFields => {
    const client = recordingClient()
    await listRecordsForOwner(client, 'endorsements', 'user-1', { ownerFields })
    const [{ sql, values }] = client.calls
    expect(maxPlaceholder(sql)).toBe(values.length)
  })

  it.each(ownerFieldCases)('deleteRecordsForOwner binds one value per placeholder (ownerFields=%j)', async ownerFields => {
    const client = recordingClient()
    await deleteRecordsForOwner(client, 'endorsements', 'user-1', { ownerFields })
    const [{ sql, values }] = client.calls
    expect(maxPlaceholder(sql)).toBe(values.length)
  })

  it.each(ownerFieldCases)('listRecordsAcrossCollections binds one value per placeholder (ownerFields=%j)', async ownerFields => {
    const client = recordingClient()
    await listRecordsAcrossCollections(client, 'user-1', { ownerFields })
    const [{ sql, values }] = client.calls
    expect(maxPlaceholder(sql)).toBe(values.length)
  })

  it.each(ownerFieldCases)('deleteRecordsAcrossCollections binds one value per placeholder (ownerFields=%j)', async ownerFields => {
    const client = recordingClient()
    await deleteRecordsAcrossCollections(client, 'user-1', { ownerFields })
    const [{ sql, values }] = client.calls
    expect(maxPlaceholder(sql)).toBe(values.length)
  })
})
