import { describe, it, expect, vi, beforeEach } from 'vitest'

// Run the bounded bundle builder against a recording client so we can assert
// exactly which collections/fields/ids each directory read touches (a request
// must never widen to the whole collection).
const state = vi.hoisted(() => ({ client: null }))
vi.mock('../repositories/platformCollectionRepository.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, withPlatformTransaction: async (fn) => fn(state.client) }
})

const { loadMemberDirectorySources, loadConnectionRequestSources, loadConnectionSources } = await import('../repositories/userDirectoryRepository.js')

const toRow = collection => row => ({
  payload: row, record_id: row.id, owner_id: row.userId || null,
  version: 1, created_at: row.createdAt, updated_at: row.updatedAt, collection_name: collection, deleted_at: null,
})

function recordingClient(rowsByCollection = {}) {
  const calls = []
  const client = {
    calls,
    async query(sql, values = []) {
      calls.push({ sql, values })
      const collection = values[0]
      const rows = rowsByCollection[collection] || []
      if (sql.includes('record_id=ANY')) {
        const ids = new Set((values[1] || []).map(String))
        return { rows: rows.filter(row => ids.has(String(row.id))).map(toRow(collection)), rowCount: 0 }
      }
      const field = sql.match(/payload->>'([^']+)'=ANY/)?.[1]
      if (field) {
        const ids = new Set((values[1] || []).map(String))
        return { rows: rows.filter(row => ids.has(String(row[field]))).map(toRow(collection)), rowCount: 0 }
      }
      return { rows: rows.map(toRow(collection)), rowCount: 0 }
    },
  }
  return client
}

const dataset = () => ({
  subscriptions: [{ id: 's1', userId: 'member', status: 'active' }, { id: 's2', userId: 'stranger', status: 'active' }],
  workspaceMembers: [
    { id: 'wm1', userId: 'viewer', workspaceId: 'w1', status: 'active' },
    { id: 'wm2', userId: 'member', workspaceId: 'w1', status: 'active' },
    { id: 'wm3', userId: 'stranger', workspaceId: 'w9', status: 'active' },
  ],
  organizationMemberships: [],
  networkEdges: [
    { id: 'e1', type: 'CONNECTS', fromEntityId: 'viewer', toEntityId: 'member' },
    { id: 'e2', type: 'CONNECTS', fromEntityId: 'member', toEntityId: 'viewer' },
    { id: 'e3', type: 'CONNECTS', fromEntityId: 'viewer', toEntityId: 'stranger' },
    { id: 'e4', type: 'CONNECTS', fromEntityId: 'member', toEntityId: 'third' },
  ],
  connectionRequests: [
    { id: 'r1', fromUserId: 'member', toUserId: 'viewer', status: 'pending' },
    { id: 'r2', fromUserId: 'viewer', toUserId: 'third', status: 'pending' },
    { id: 'r3', fromUserId: 'member', toUserId: 'third', status: 'pending' },
  ],
  profiles: [{ id: 'member', firstName: 'Member' }, { id: 'third', firstName: 'Third' }, { id: 'stranger', firstName: 'Stranger' }],
  feedPosts: [{ id: 'p1', authorId: 'member' }, { id: 'p2', authorId: 'stranger' }],
  feedComments: [{ id: 'c1', authorId: 'member' }],
})

const ids = rows => (rows || []).map(row => row.id).sort()
const collectionsQueried = client => client.calls.map(call => call.values[0])

beforeEach(() => { state.client = recordingClient() })

describe('member directory bounded reader (§5 cutover)', () => {
  it('scopes directory reads to the viewer and addressed members only', async () => {
    state.client = recordingClient(dataset())
    const db = await loadMemberDirectorySources('viewer', ['member'])

    expect(ids(db.subscriptions)).toEqual(['s1'])
    expect(ids(db.workspaceMembers)).toEqual(['wm1', 'wm2'])
    // Reciprocity edges only: the viewer↔stranger and member↔third edges stay out.
    expect(ids(db.networkEdges)).toEqual(['e1', 'e2'])
    expect(ids(db.connectionRequests)).toEqual(['r1', 'r2', 'r3'])
    expect(collectionsQueried(state.client)).not.toContain('feedPosts')
  })

  it('loads the whole addressed graph plus feed activity for a public profile', async () => {
    state.client = recordingClient(dataset())
    const db = await loadMemberDirectorySources('viewer', ['member'], { activity: true, fullEdgeIds: ['member'] })

    expect(ids(db.networkEdges)).toEqual(['e1', 'e2', 'e4'])
    expect(ids(db.feedPosts)).toEqual(['p1'])
    expect(ids(db.feedComments)).toEqual(['c1'])
  })

  it('loads incoming request rows plus sender profiles', async () => {
    state.client = recordingClient(dataset())
    const db = await loadConnectionRequestSources('viewer')

    expect(ids(db.connectionRequests)).toEqual(['r1'])
    expect(ids(db.profiles)).toEqual(['member'])
  })

  it('loads the viewer edges plus counterpart profiles', async () => {
    state.client = recordingClient(dataset())
    const db = await loadConnectionSources('viewer')

    expect(ids(db.networkEdges)).toEqual(['e1', 'e2', 'e3'])
    expect(ids(db.profiles)).toEqual(['member', 'stranger'])
  })
})
