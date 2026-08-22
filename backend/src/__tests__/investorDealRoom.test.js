import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), writeDb: vi.fn(), updateDb: vi.fn() }))
import { readDb, updateDb, writeDb } from '../config/database.js'

const SECRET = 'test_jwt_secret_do_not_use_in_production'
const token = (id, role = 'investor') => jwt.sign({ sub: id, role }, SECRET, { expiresIn: '1h' })
let db
beforeEach(() => { db = { users: [{ id: 'investor' }, { id: 'founder' }, { id: 'other' }], profiles: [{ id: 'investor', role: 'investor', isOnboarded: true }, { id: 'founder', role: 'founder', isOnboarded: true }, { id: 'other', role: 'investor', isOnboarded: true }], verificationProfiles: [{ userId: 'investor', role: 'investor', assurance: 'VERIFIED', expiresAt: new Date(Date.now() + 86400000).toISOString() }, { userId: 'other', role: 'investor', assurance: 'VERIFIED', expiresAt: new Date(Date.now() + 86400000).toISOString() }], walletAccounts: [{ userId: 'investor', creditBalance: 30 }, { userId: 'other', creditBalance: 30 }], creditLedger: [], usageReservations: [], subscriptions: [], investorWatchlists: [{ investorId: 'investor', projectId: 'project-1' }], dealFlowSnapshots: [], projects: [{ id: 'project-1', title: 'Northstar' }], dealRooms: [], dealRoomParticipants: [], ndaTemplates: [], ndaSignatures: [], diligenceItems: [], dealAuditEvents: [], dealStatusEvents: [], dealQuestions: [], dealQuestionMessages: [], investorInternalNotes: [], icReviews: [], termSheetVersions: [], authorizationAuditLogs: [], capabilityAnalytics: [] }; readDb.mockReturnValue(db); writeDb.mockImplementation(() => {}); updateDb.mockImplementation(fn => fn(db)) })

describe('Investor Deal Room deterministic security', () => {
  it('creates an isolated deal, requires NDA, and validates transitions', async () => {
    const created = await request(app).post('/api/investor-deals').set('Authorization', `Bearer ${token('investor')}`).send({ projectId: 'project-1', founderId: 'founder' })
    expect(created.status).toBe(201); const dealId = created.body.deal.id
    const blocked = await request(app).get(`/api/investor-deals/${dealId}`).set('Authorization', `Bearer ${token('investor')}`)
    expect(blocked.status).toBe(400); expect(blocked.body.error).toBe('nda_required')
    const signed = await request(app).post(`/api/investor-deals/${dealId}/nda/sign`).set('Authorization', `Bearer ${token('investor')}`).send({ accepted: true })
    expect(signed.status).toBe(200); expect(signed.body.deal.state).toBe('diligence_open')
    const invalid = await request(app).post(`/api/investor-deals/${dealId}/status`).set('Authorization', `Bearer ${token('investor')}`).send({ state: 'closed' })
    expect(invalid.status).toBe(400); expect(invalid.body.error).toBe('invalid_deal_transition')
  })

  it('prevents another investor from reading or creating against the same deal', async () => {
    const created = await request(app).post('/api/investor-deals').set('Authorization', `Bearer ${token('investor')}`).send({ projectId: 'project-1' })
    const denied = await request(app).get(`/api/investor-deals/${created.body.deal.id}`).set('Authorization', `Bearer ${token('other')}`)
    expect(denied.status).toBe(404)
    const noRelationship = await request(app).post('/api/investor-deals').set('Authorization', `Bearer ${token('other')}`).send({ projectId: 'project-1' })
    expect(noRelationship.status).toBe(400); expect(noRelationship.body.error).toBe('investor_relationship_required')
  })

  it('keeps internal notes and IC records out of founder responses', async () => {
    const created = await request(app).post('/api/investor-deals').set('Authorization', `Bearer ${token('investor')}`).send({ projectId: 'project-1', founderId: 'founder' })
    const dealId = created.body.deal.id
    await request(app).post(`/api/investor-deals/${dealId}/nda/sign`).set('Authorization', `Bearer ${token('investor')}`).send({ accepted: true })
    const note = await request(app).post(`/api/investor-deals/${dealId}/internal-notes`).set('Authorization', `Bearer ${token('investor')}`).send({ content: 'Internal thesis' })
    expect(note.status).toBe(201)
    db.dealRoomParticipants.push({ id: 'founder-participant', dealId, userId: 'founder', role: 'diligence_owner', status: 'active' })
    const founderView = await request(app).get(`/api/investor-deals/${dealId}`).set('Authorization', `Bearer ${token('founder', 'founder')}`)
    expect(founderView.status).toBe(200); expect(founderView.body.notes).toHaveLength(0); expect(founderView.body.ic).toHaveLength(0)
  })
})
