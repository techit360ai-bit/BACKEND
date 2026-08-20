import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), writeDb: vi.fn(), updateDb: vi.fn() }))
import { readDb, updateDb, writeDb } from '../config/database.js'

const SECRET = 'test_jwt_secret_do_not_use_in_production'
const token = (id, role) => jwt.sign({ sub: id, role }, SECRET, { expiresIn: '1h' })
const empty = () => ({
  users: [{ id: 'mentor', email: 'mentor@example.com' }, { id: 'mentee', email: 'mentee@example.com' }],
  profiles: [{ id: 'mentor', role: 'investor', isOnboarded: true, firstName: 'Maya' }, { id: 'mentee', role: 'explorer', isOnboarded: true, firstName: 'Lee' }],
  subscriptions: [], walletAccounts: [], creditLedger: [], usageReservations: [], userRoles: [], verificationProfiles: [], trustProfiles: [], riskProfiles: [], capabilityPolicies: [], authorizationAuditLogs: [], capabilityAnalytics: [],
  mentorshipRooms: [], mentorshipMentees: [], mentorshipTasks: [], mentorshipApplications: [], mentorshipMessages: [], mentorshipInvitations: [], notifications: [], feedPosts: [], opportunities: [],
})
let db
beforeEach(() => { db = empty(); vi.clearAllMocks(); readDb.mockReturnValue(db); writeDb.mockImplementation(() => {}); updateDb.mockImplementation(fn => fn(db)) })

describe('live mentorship hub', () => {
  it('persists rooms and enforces deterministic capacity during review', async () => {
    const created = await request(app).post('/api/mentorship/rooms').set('Authorization', `Bearer ${token('mentor', 'investor')}`).send({ name: 'Founder Office Hours', description: 'Weekly product guidance', capacity: 1 })
    expect(created.status).toBe(201)
    const roomId = created.body.room.id
    const applied = await request(app).post(`/api/mentorship/rooms/${roomId}/apply`).set('Authorization', `Bearer ${token('mentee', 'explorer')}`).send({ coverLetter: 'I am building a startup' })
    expect(applied.status).toBe(201)
    const accepted = await request(app).patch(`/api/mentorship/applications/${applied.body.application.id}`).set('Authorization', `Bearer ${token('mentor', 'investor')}`).send({ status: 'accepted' })
    expect(accepted.status).toBe(200)
    expect(db.mentorshipMentees).toHaveLength(1)
  })

  it('creates hashed invites and publishes idempotently to feed and opportunities', async () => {
    const created = await request(app).post('/api/mentorship/rooms').set('Authorization', `Bearer ${token('mentor', 'investor')}`).send({ name: 'Scale Lab', description: 'Growth mentorship', capacity: 10 })
    const roomId = created.body.room.id
    const invite = await request(app).post(`/api/mentorship/rooms/${roomId}/invites`).set('Authorization', `Bearer ${token('mentor', 'investor')}`).send({})
    expect(invite.status).toBe(201)
    expect(db.mentorshipInvitations[0].tokenHash).not.toBe(invite.body.invitation.token)
    const resolved = await request(app).get(`/api/mentorship/invites/${invite.body.invitation.token}`).set('Authorization', `Bearer ${token('mentee', 'explorer')}`)
    expect(resolved.status).toBe(200)
    await request(app).post(`/api/mentorship/rooms/${roomId}/share/feed`).set('Authorization', `Bearer ${token('mentor', 'investor')}`).send({})
    await request(app).post(`/api/mentorship/rooms/${roomId}/share/feed`).set('Authorization', `Bearer ${token('mentor', 'investor')}`).send({})
    await request(app).post(`/api/mentorship/rooms/${roomId}/share/opportunity`).set('Authorization', `Bearer ${token('mentor', 'investor')}`).send({})
    await request(app).post(`/api/mentorship/rooms/${roomId}/share/opportunity`).set('Authorization', `Bearer ${token('mentor', 'investor')}`).send({})
    expect(db.feedPosts).toHaveLength(1)
    expect(db.opportunities).toHaveLength(1)
    expect(created.body.room.share.social.linkedin).toContain('linkedin.com')
  })

  it('prevents another investor from managing a room', async () => {
    db.users.push({ id: 'other', email: 'other@example.com' })
    db.profiles.push({ id: 'other', role: 'investor', isOnboarded: true })
    const created = await request(app).post('/api/mentorship/rooms').set('Authorization', `Bearer ${token('mentor', 'investor')}`).send({ name: 'Private Lab', description: 'Guidance', capacity: 2 })
    const patched = await request(app).patch(`/api/mentorship/rooms/${created.body.room.id}`).set('Authorization', `Bearer ${token('other', 'investor')}`).send({ name: 'Hijacked' })
    expect(patched.status).toBe(404)
    expect(db.mentorshipRooms[0].name).toBe('Private Lab')
  })
})
