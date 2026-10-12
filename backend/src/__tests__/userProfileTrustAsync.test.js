import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const mocks = vi.hoisted(() => ({ trustPublic: vi.fn() }))

vi.mock('../config/database.js', () => ({ readAuthorityDb: vi.fn(), writeAuthorityDb: vi.fn(), updateAuthorityDb: vi.fn() }))
vi.mock('../services/trustAuthority.js', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, publicTrustFor: mocks.trustPublic }
})

import app from '../app.js'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'
const validToken = (userId = 'viewer') => jwt.sign({ sub: userId }, TEST_SECRET, { expiresIn: '1h' })

const baseDb = () => ({
  users: [{ id: 'viewer' }, { id: 'target' }],
  profiles: [
    { id: 'viewer', role: 'founder', skills: [] },
    { id: 'target', firstName: 'Target', lastName: 'Person', role: 'collaborator', skills: [] },
  ],
  feedPosts: [],
  feedComments: [],
  subscriptions: [],
  workspaceMembers: [],
  organizationMemberships: [],
  networkEdges: [],
  connectionRequests: [],
})

beforeEach(() => {
  vi.clearAllMocks()
  updateAuthorityDb.mockImplementation(fn => fn(readAuthorityDb()))
})

describe('public profile trust read — async ripple (§5 remaining controllers)', () => {
  it('awaits the trust dispatcher when building a public profile', async () => {
    readAuthorityDb.mockReturnValue(baseDb())
    mocks.trustPublic.mockResolvedValue({ trust_score: 77, tier: 'Verified', verification_status: 'verified', confidence_score: 0.77, breakdown: { skills: 5 }, proof_count: 4, verifiedSkills: [{ skill: 'go' }] })

    const res = await request(app).get('/api/users/target').set('Authorization', `Bearer ${validToken('viewer')}`)

    expect(res.status).toBe(200)
    expect(mocks.trustPublic).toHaveBeenCalledWith('target', null)
    expect(res.body.trust).toMatchObject({ trust_score: 77, tier: 'Verified', verification_status: 'verified', proof_count: 4 })
    expect(res.body.verifiedSkills).toEqual([{ skill: 'go' }])
  })

  it('awaits the trust dispatcher for each directory entry', async () => {
    readAuthorityDb.mockReturnValue(baseDb())
    mocks.trustPublic.mockResolvedValue({ trust_score: 40, tier: 'Claimed', verification_status: 'unverified', confidence_score: 0.4, breakdown: {}, proof_count: 1, verifiedSkills: [] })

    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${validToken('viewer')}`)

    expect(res.status).toBe(200)
    expect(res.body.users.map(user => user.id)).toEqual(['target'])
    expect(mocks.trustPublic).toHaveBeenCalledWith('target', null)
    expect(res.body.users[0].trust.trust_score).toBe(40)
  })
})
