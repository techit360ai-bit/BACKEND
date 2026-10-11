import { beforeEach, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(),
  createSession: vi.fn(async () => {}),
  findByPrev: vi.fn(async () => null),
  findByHash: vi.fn(async () => ({ id: 'row1', userId: 'u1', sessionIdentifier: 'sid1', refreshTokenHash: 'h', expiresAt: new Date(Date.now() + 3600e3).toISOString(), revokedAt: null, rotationCounter: 0 })),
  rotateSession: vi.fn(async () => ({ id: 'row1', userId: 'u1', sessionIdentifier: 'sid1', rotationCounter: 1 })),
  revokeByIdentifier: vi.fn(async () => {}),
  findById: vi.fn(async () => ({ user: { id: 'u1', email: 'a@b.c' }, profile: { role: 'founder', firstName: 'Ada', lastName: 'Okafor', username: 'ada', isVerified: true, credibilityScore: 72 } })),
  loadActiveContext: vi.fn(async () => ({ role: 'founder', organizationId: 'org1', workspaceId: 'ws1', resourceType: 'project', resourceId: 'p1' })),
  loadActiveSubscription: vi.fn(async () => ({ planName: 'Pro', status: 'active' })),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/identitySessionRepository.js', () => ({
  createSession: mocks.createSession,
  findByPreviousRefreshTokenHash: mocks.findByPrev,
  findByRefreshTokenHash: mocks.findByHash,
  rotateSession: mocks.rotateSession,
  revokeByIdentifier: mocks.revokeByIdentifier,
}))
vi.mock('../repositories/identityRepository.js', () => ({ findIdentityById: mocks.findById }))
vi.mock('../repositories/sessionClaimsRepository.js', () => ({
  sessionClaimsEnabled: () => process.env.IDENTITY_WRITE_SOURCE === 'postgres' || process.env.IDENTITY_READ_SOURCE === 'postgres',
  sessionClaimsFallbackEnabled: () => true,
  loadActiveContext: mocks.loadActiveContext,
  loadActiveSubscription: mocks.loadActiveSubscription,
}))

const { issueSessionAsync, rotateSessionAsync } = await import('../services/sessionService.js')

function req() { return { ip: '127.0.0.1', get() { return null }, headers: {} } }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = TEST_SECRET
  process.env.IDENTITY_WRITE_SOURCE = 'postgres'
  mocks.readDb.mockReturnValue({})
  mocks.findByPrev.mockResolvedValue(null)
})

describe('session claims row-level store (§5 cutover)', () => {
  it('signs access-token claims from row-level context/subscription without the snapshot', async () => {
    const credentials = await issueSessionAsync({ id: 'u1', email: 'a@b.c' }, { role: 'founder', firstName: 'Ada', lastName: 'Okafor', username: 'ada', isVerified: true, credibilityScore: 72 }, req())
    const claims = jwt.verify(credentials.accessToken, TEST_SECRET)
    expect(claims).toMatchObject({ active_role: 'founder', organization_id: 'org1', workspaceId: 'ws1', subscriber: true, subscription_tier: 'Pro', name: 'Ada Okafor' })
    expect(mocks.loadActiveContext).toHaveBeenCalledWith('u1')
    expect(mocks.loadActiveSubscription).toHaveBeenCalledWith('u1')
    expect(mocks.createSession).toHaveBeenCalledWith(credentials.session, expect.objectContaining({ eventType: 'session_created' }))
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('re-signs a rotated session from row-level claims without the snapshot', async () => {
    const result = await rotateSessionAsync('refresh-token', req())
    expect(result.ok).toBe(true)
    const claims = jwt.verify(result.accessToken, TEST_SECRET)
    expect(claims).toMatchObject({ active_role: 'founder', subscriber: true, subscription_tier: 'Pro' })
    expect(mocks.loadActiveContext).toHaveBeenCalledWith('u1')
    expect(mocks.loadActiveSubscription).toHaveBeenCalledWith('u1')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('falls back to the snapshot claims builder when the identity source is sqlite', async () => {
    process.env.IDENTITY_WRITE_SOURCE = 'sqlite'
    mocks.readDb.mockReturnValue({ activeContexts: [{ userId: 'u1', status: 'active', role: 'contributor' }], subscriptions: [] })
    const credentials = await issueSessionAsync({ id: 'u1', email: 'a@b.c' }, { role: 'founder' }, req())
    const claims = jwt.verify(credentials.accessToken, TEST_SECRET)
    expect(claims).toMatchObject({ active_role: 'contributor', subscriber: false })
    expect(mocks.loadActiveContext).not.toHaveBeenCalled()
    expect(mocks.readDb).toHaveBeenCalled()
  })
})
