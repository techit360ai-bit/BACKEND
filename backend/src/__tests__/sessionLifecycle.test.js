import { beforeEach, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test_jwt_secret_do_not_use_in_production'
vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn(), writeDb: vi.fn() }))
import { readDb, updateDb, writeDb } from '../config/database.js'
import { issueSession, listSessions, mobileClient, refreshTokenFromRequest, revokeAllSessions, rotateSession, validateSessionBinding } from '../services/sessionService.js'

function req() { return { ip: '127.0.0.1', get(name) { return name === 'user-agent' ? 'Mozilla/5.0 Chrome Windows' : name === 'x-techit-client' ? 'web' : null }, headers: {} } }

describe('persistent session lifecycle', () => {
  let db
  beforeEach(() => { process.env.JWT_SECRET = TEST_SECRET; db = { users: [{ id: 'u1', email: 'a@example.com' }], profiles: [{ id: 'u1', role: 'founder', firstName: 'Ada', lastName: 'Okafor', username: 'ada', isVerified: true, credibilityScore: 72 }], subscriptions: [{ id: 'sub-1', userId: 'u1', status: 'active', planName: 'Pro' }], userSessions: [], authSecurityEvents: [] }; readDb.mockReturnValue(db); writeDb.mockImplementation(() => {}); updateDb.mockImplementation(fn => { const result = fn(db); writeDb(db); return result }) })
  it('issues a session-bound access token and rotates refresh credentials', () => {
    const issued = issueSession(db.users[0], db.profiles[0], req()); expect(issued.session.sessionIdentifier).toBeTruthy(); expect(db.userSessions).toHaveLength(1)
    const claims = jwt.verify(issued.accessToken, TEST_SECRET); expect(claims.sid).toBe(issued.session.sessionIdentifier); expect(claims).toMatchObject({ name: 'Ada Okafor', username: 'ada', verified: true, subscriber: true, credibility_score: 72, subscription_tier: 'Pro' }); expect(validateSessionBinding(claims).valid).toBe(true)
    const rotated = rotateSession(issued.refreshToken, req()); expect(rotated.ok).toBe(true); expect(rotated.refreshToken).not.toBe(issued.refreshToken); const replay = rotateSession(issued.refreshToken, req()); expect(replay.error).toBe('refresh_token_reuse_detected'); expect(db.userSessions[0].revokedAt).toBeTruthy()
  })
  it('lists device sessions and revokes every session', () => {
    const first = issueSession(db.users[0], db.profiles[0], req()); issueSession(db.users[0], db.profiles[0], req()); expect(listSessions('u1', first.session.sessionIdentifier)).toHaveLength(2); const result = revokeAllSessions('u1'); expect(result.revokedCount).toBe(2); expect(listSessions('u1', null)).toHaveLength(0)
  })
  it('accepts native refresh transport only when explicitly supplied by the client', () => {
    const mobileReq = { body: { refreshToken: 'native-token' }, headers: {}, get(name) { return name === 'x-techit-client' ? 'mobile' : null } }
    expect(mobileClient(mobileReq)).toBe(true); expect(refreshTokenFromRequest(mobileReq)).toBe('native-token')
  })
})
