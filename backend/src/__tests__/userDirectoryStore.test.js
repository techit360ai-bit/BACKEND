import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(),
  writeDb: vi.fn(),
  updateDb: vi.fn(),
  findIdentityById: vi.fn(),
  listIdentityProfiles: vi.fn(),
  loadMemberDirectorySources: vi.fn(),
  loadConnectionRequestSources: vi.fn(),
  loadConnectionSources: vi.fn(),
  loadProfileByRef: vi.fn(),
  applyConnectionMutation: vi.fn(),
  entitlement: vi.fn(),
  trustPublic: vi.fn(),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, writeDb: mocks.writeDb, updateDb: mocks.updateDb }))
vi.mock('../services/trustAuthority.js', async importOriginal => ({ ...(await importOriginal()), publicTrustFor: mocks.trustPublic }))
vi.mock('../services/tvceService.js', async importOriginal => ({ ...(await importOriginal()), accountEntitlementAsync: mocks.entitlement }))
vi.mock('../repositories/identityRepository.js', async importOriginal => ({
  ...(await importOriginal()),
  findIdentityById: mocks.findIdentityById,
  listIdentityProfiles: mocks.listIdentityProfiles,
}))
vi.mock('../repositories/userDirectoryRepository.js', () => ({
  userDirectoryEnabled: () => process.env.IDENTITY_READ_SOURCE === 'postgres',
  userDirectoryFallbackEnabled: () => true,
  loadMemberDirectorySources: mocks.loadMemberDirectorySources,
  loadConnectionRequestSources: mocks.loadConnectionRequestSources,
  loadConnectionSources: mocks.loadConnectionSources,
  loadProfileByRef: mocks.loadProfileByRef,
  applyConnectionMutation: mocks.applyConnectionMutation,
}))

import app from '../app.js'
import { readDb } from '../config/database.js'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'
const auth = (userId = 'viewer') => `Bearer ${jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn: '1h' })}`

const viewerProfile = { id: 'viewer', firstName: 'View', lastName: 'Er', role: 'founder', skills: [], industries: [] }
const targetProfile = { id: 'target', firstName: 'Target', lastName: 'Person', role: 'collaborator', username: 'target', skills: [], industries: [] }
const senderProfile = { id: 'sender', firstName: 'Sen', lastName: 'Der', role: 'founder', skills: [], industries: [] }
const trust = { trust_score: 55, tier: 'Verified', verification_status: 'verified', confidence_score: 0.55, breakdown: {}, proof_count: 2, verifiedSkills: [] }

const directoryBundle = () => ({
  profiles: [],
  subscriptions: [{ id: 'sub-1', userId: 'target', status: 'active' }],
  workspaceMembers: [
    { id: 'wm-1', userId: 'viewer', workspaceId: 'w1', status: 'active' },
    { id: 'wm-2', userId: 'target', workspaceId: 'w1', status: 'active' },
  ],
  organizationMemberships: [],
  networkEdges: [],
  connectionRequests: [],
  feedPosts: [],
  feedComments: [],
})

const previous = {}
const setEnv = (key, value) => { previous[key] = process.env[key]; process.env[key] = value }
const restoreEnv = () => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findIdentityById.mockImplementation(async id => ({ user: { id, email: `${id}@example.com` }, profile: id === 'viewer' ? viewerProfile : targetProfile, roles: [], activeContext: null }))
  mocks.listIdentityProfiles.mockResolvedValue([viewerProfile, targetProfile])
  mocks.trustPublic.mockResolvedValue(trust)
  mocks.entitlement.mockResolvedValue(null)
  mocks.loadMemberDirectorySources.mockResolvedValue(directoryBundle())
  mocks.loadConnectionRequestSources.mockResolvedValue({ profiles: [senderProfile], connectionRequests: [{ id: 'r1', fromUserId: 'sender', toUserId: 'viewer', status: 'pending', createdAt: '2026-08-01T00:00:00.000Z' }] })
  mocks.loadConnectionSources.mockResolvedValue({ profiles: [targetProfile], networkEdges: [{ id: 'e1', type: 'CONNECTS', fromEntityId: 'viewer', toEntityId: 'target' }] })
  mocks.loadProfileByRef.mockResolvedValue(targetProfile)
  mocks.applyConnectionMutation.mockImplementation(async (options, mutate) => mutate({
    profiles: [viewerProfile, targetProfile, senderProfile],
    connectionRequests: [{ id: 'r1', fromUserId: 'sender', toUserId: 'viewer', status: 'pending', createdAt: '2026-08-01T00:00:00.000Z' }],
    notifications: [], networkEdges: [], entityRelationships: [], recommendationEvents: [],
  }))
  setEnv('IDENTITY_READ_SOURCE', 'postgres')
})

afterEach(() => { restoreEnv() })

describe('member directory + connections — row-level store (§5 cutover)', () => {
  it('lists the directory from a bounded member bundle when identity is authoritative', async () => {
    const res = await request(app).get('/api/users').set('Authorization', auth())

    expect(res.status).toBe(200)
    expect(res.body.users.map(user => user.id)).toEqual(['target'])
    expect(res.body.users[0]).toMatchObject({ subscriber: true, sharedContext: true })
    expect(mocks.loadMemberDirectorySources).toHaveBeenCalledWith('viewer', ['target'])
    expect(readDb).not.toHaveBeenCalled()
  })

  it('renders a public profile from bounded member + activity rows', async () => {
    const res = await request(app).get('/api/users/target').set('Authorization', auth())

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 'target', name: 'Target Person' })
    expect(mocks.loadMemberDirectorySources).toHaveBeenCalledWith('viewer', ['target'], { activity: true, fullEdgeIds: ['target'] })
    expect(readDb).not.toHaveBeenCalled()
  })

  it('lists the viewer connections from bounded edges without the snapshot', async () => {
    const res = await request(app).get('/api/users/connections').set('Authorization', auth())

    expect(res.status).toBe(200)
    expect(res.body.connections.map(connection => connection.id)).toEqual(['target'])
    expect(mocks.loadConnectionSources).toHaveBeenCalledWith('viewer')
    expect(readDb).not.toHaveBeenCalled()
  })

  it('lists incoming connection requests from bounded request rows without the snapshot', async () => {
    const res = await request(app).get('/api/users/connections/requests').set('Authorization', auth())

    expect(res.status).toBe(200)
    expect(res.body.requests.map(row => row.fromUserId)).toEqual(['sender'])
    expect(mocks.loadConnectionRequestSources).toHaveBeenCalledWith('viewer')
    expect(readDb).not.toHaveBeenCalled()
  })

  it('keeps the snapshot as the fallback when identity is not authoritative', async () => {
    delete process.env.IDENTITY_READ_SOURCE
    readDb.mockReturnValue({
      users: [{ id: 'viewer' }, { id: 'target' }],
      profiles: [viewerProfile, targetProfile],
      subscriptions: [{ id: 'sub-1', userId: 'target', status: 'active' }],
      workspaceMembers: [], organizationMemberships: [], networkEdges: [], connectionRequests: [],
      feedPosts: [], feedComments: [],
    })

    const res = await request(app).get('/api/users').set('Authorization', auth())

    expect(res.status).toBe(200)
    expect(res.body.users.map(user => user.id)).toEqual(['target'])
    expect(mocks.loadMemberDirectorySources).not.toHaveBeenCalled()
    expect(readDb).toHaveBeenCalled()
  })

  it('creates a connection through the bounded write path without the snapshot', async () => {
    const res = await request(app).post('/api/users/target/connect').set('Authorization', auth()).send({})

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, status: 'pending' })
    expect(mocks.loadProfileByRef).toHaveBeenCalledWith('target')
    expect(mocks.applyConnectionMutation).toHaveBeenCalled()
    expect(readDb).not.toHaveBeenCalled()
  })

  it('accepts a connection request through the bounded write path without the snapshot', async () => {
    const res = await request(app)
      .post('/api/users/connections/requests/r1/accept')
      .set('Authorization', auth())
      .send({ decision: 'accept' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, status: 'connected' })
    expect(mocks.applyConnectionMutation).toHaveBeenCalled()
    expect(readDb).not.toHaveBeenCalled()
  })
})
