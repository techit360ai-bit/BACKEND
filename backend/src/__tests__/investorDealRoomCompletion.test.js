import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), writeDb: vi.fn(), updateDb: vi.fn() }))
import { readDb, updateDb, writeDb } from '../config/database.js'

const SECRET = 'test_jwt_secret_do_not_use_in_production'
const token = (id, role) => jwt.sign({ sub: id, role }, SECRET, { expiresIn: '1h' })
let db
const auth = id => ({ Authorization: `Bearer ${token(id, id === 'founder' ? 'founder' : 'investor')}` })

beforeEach(() => {
  process.env.EVIDENCE_STORAGE_ENDPOINT = 'https://objects.example.test'
  process.env.EVIDENCE_STORAGE_BUCKET = 'private'
  process.env.EVIDENCE_STORAGE_ACCESS_KEY = 'access'
  process.env.EVIDENCE_STORAGE_SECRET_KEY = 'secret'
  db = {
    users: [{ id: 'investor' }, { id: 'founder' }, { id: 'reviewer' }, { id: 'outsider' }],
    profiles: [{ id: 'investor', role: 'investor', isOnboarded: true }, { id: 'founder', role: 'founder', isOnboarded: true }, { id: 'reviewer', role: 'investor', isOnboarded: true }, { id: 'outsider', role: 'investor', isOnboarded: true }],
    verificationProfiles: [{ userId: 'investor', role: 'investor', assurance: 'VERIFIED' }, { userId: 'reviewer', role: 'investor', assurance: 'VERIFIED' }, { userId: 'outsider', role: 'investor', assurance: 'VERIFIED' }],
    investorWatchlists: [{ investorId: 'investor', projectId: 'project-1' }], projects: [{ id: 'project-1', title: 'Northstar', industry: 'Fintech', stage: 'Seed' }], projectAnalyses: [{ id: 'code-1', projectId: 'project-1', engine: 'CodebaseAnalysisEngine', updatedAt: new Date().toISOString(), analysis: { summary: 'Stable platform', architecture: 'Services', security: 'Reviewed' } }],
    dealRooms: [], dealRoomParticipants: [], ndaTemplates: [], ndaSignatures: [], diligenceItems: [], diligenceEvidenceLinks: [], dataRoomFolders: [], dataRoomDocuments: [], dataRoomDocumentVersions: [], dealQuestions: [], dealQuestionMessages: [], investorInternalNotes: [], icReviews: [], icApprovalHistory: [], termSheetVersions: [], dealStatusEvents: [], dealAuditEvents: [], investorQuestionnaireTemplates: [], investorQuestionnaireSubmissions: [], revenueVerifications: [], referenceRequests: [], investorPacks: [], comparableTransactions: [], notifications: [], authorizationAuditLogs: [], capabilityAnalytics: [], subscriptions: [], walletAccounts: [], creditLedger: [], usageReservations: [], userRoles: [], riskProfiles: [], trustProfiles: [],
  }
  readDb.mockReturnValue(db); writeDb.mockImplementation(() => {}); updateDb.mockImplementation(fn => fn(db))
})
afterEach(() => { vi.restoreAllMocks() })

async function createSignedDeal() {
  const created = await request(app).post('/api/investor-deals').set(auth('investor')).send({ projectId: 'project-1', founderId: 'founder' })
  expect(created.status).toBe(201)
  const dealId = created.body.deal.id
  const signed = await request(app).post(`/api/investor-deals/${dealId}/nda/sign`).set(auth('investor')).send({ accepted: true })
  expect(signed.status).toBe(200)
  return dealId
}

describe('Investor Deal Room completion security', () => {
  it('creates default folders without billing state and isolates outsiders', async () => {
    const dealId = await createSignedDeal()
    expect(db.dataRoomFolders).toHaveLength(9)
    expect(db.creditLedger).toHaveLength(0); expect(db.usageReservations).toHaveLength(0)
    const denied = await request(app).get(`/api/investor-deals/${dealId}/documents`).set(auth('outsider'))
    expect(denied.status).toBe(404)
  })

  it('finalizes a private document only after signature and malware validation', async () => {
    const dealId = await createSignedDeal()
    const created = await request(app).post(`/api/investor-deals/${dealId}/documents`).set(auth('founder')).send({ name: 'Corporate.pdf', contentType: 'application/pdf', sizeBytes: 5, folderId: db.dataRoomFolders[0].id })
    expect(created.status).toBe(201); expect(created.body.upload.uploadUrl).toContain('X-Amz-Signature=')
    expect(JSON.stringify(db.dataRoomDocumentVersions)).not.toContain('uploadUrl')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from('%PDF-') }))
    const finalized = await request(app).post(`/api/investor-deals/${dealId}/documents/${created.body.document.id}/finalize`).set(auth('founder')).send()
    expect(finalized.status).toBe(200); expect(finalized.body.document.malwareStatus).toBe('clean'); expect(finalized.body.document.checksum).toMatch(/^[a-f0-9]{64}$/)
    const download = await request(app).get(`/api/investor-deals/${dealId}/documents/${created.body.document.id}/download`).set(auth('investor'))
    expect(download.status).toBe(200); expect(download.body.downloadUrl).toContain('X-Amz-Signature='); expect(db.dealAuditEvents.some(row => row.action === 'document_downloaded')).toBe(true)
  })

  it('supports founder questionnaire submission with platform prefill labels', async () => {
    const dealId = await createSignedDeal()
    const form = await request(app).get(`/api/investor-deals/${dealId}/questionnaire`).set(auth('founder'))
    expect(form.status).toBe(200); expect(form.body.prefill.company).toBe('Northstar'); expect(form.body.sourceLabels.company).toBe('platform_verified')
    const answers = { problem: 'Payments', customers: 'SMEs', traction: 'Pilots', risks: 'Licensing', fundraise: 'Product' }
    const submitted = await request(app).put(`/api/investor-deals/${dealId}/questionnaire`).set(auth('founder')).send({ answers, submit: true })
    expect(submitted.status).toBe(200); expect(submitted.body.submission.sourceLabels.problem).toBe('founder_reported')
  })

  it('uses only CodebaseAnalysisEngine output and preserves unverified revenue as null', async () => {
    const dealId = await createSignedDeal()
    const technical = await request(app).get(`/api/investor-deals/${dealId}/technical-dd`).set(auth('investor'))
    expect(technical.status).toBe(200); expect(technical.body.report.source).toBe('CodebaseAnalysisEngine')
    db.projectAnalyses = [{ id: 'venture', projectId: 'project-1', type: 'venture', analysis: { summary: 'must not leak' } }]
    const unavailable = await request(app).get(`/api/investor-deals/${dealId}/technical-dd`).set(auth('investor'))
    expect(unavailable.body.status).toBe('unavailable')
    const revenue = await request(app).get(`/api/investor-deals/${dealId}/revenue`).set(auth('investor'))
    expect(revenue.body.verification.status).toBe('unverified'); expect(revenue.body.verification.aggregate).toBeNull()
  })

  it('clears reference tokens and exposes no reference identity', async () => {
    const dealId = await createSignedDeal()
    const created = await request(app).post(`/api/investor-deals/${dealId}/references`).set(auth('investor')).send({ nomineeRole: 'customer' })
    expect(created.status).toBe(201); const publicToken = created.body.request.token
    const response = await request(app).post(`/api/investor-references/respond/${publicToken}`).send({ name: 'Must disappear', email: 'private@example.test', answers: { one: 'Reliable execution' } })
    expect(response.status).toBe(200); expect(db.referenceRequests[0].tokenHash).toBeNull(); expect(JSON.stringify(db.referenceRequests[0])).not.toContain('private@example.test'); expect(JSON.stringify(response.body)).not.toContain('Must disappear')
  })

  it('enforces institutional roles and keeps internal records from founders', async () => {
    const dealId = await createSignedDeal()
    const added = await request(app).post(`/api/investor-deals/${dealId}/team`).set(auth('investor')).send({ userId: 'reviewer', role: 'read_only' })
    expect(added.status).toBe(201)
    const deniedIc = await request(app).put(`/api/investor-deals/${dealId}/ic`).set(auth('reviewer')).send({ recommendation: 'proceed' })
    expect(deniedIc.status).toBe(403)
    await request(app).post(`/api/investor-deals/${dealId}/internal-notes`).set(auth('investor')).send({ content: 'Private thesis' })
    const founder = await request(app).get(`/api/investor-deals/${dealId}`).set(auth('founder'))
    expect(founder.body.notes).toHaveLength(0); expect(founder.body.ic).toHaveLength(0)
  })

  it('enforces term-sheet negotiation, closing requirements, and audit integrity', async () => {
    const dealId = await createSignedDeal()
    const sheet = await request(app).post(`/api/investor-deals/${dealId}/term-sheet`).set(auth('investor')).send({ terms: { instrument: 'SAFE' } })
    expect(sheet.status).toBe(201); expect(sheet.body.termSheet.disclaimer).toMatch(/not legal advice/i)
    expect((await request(app).post(`/api/investor-deals/${dealId}/term-sheet/share`).set(auth('investor')).send()).status).toBe(200)
    expect((await request(app).post(`/api/investor-deals/${dealId}/term-sheet/comment`).set(auth('founder')).send({ comment: 'Please clarify expiry.' })).status).toBe(200)
    expect((await request(app).post(`/api/investor-deals/${dealId}/term-sheet/finalize`).set(auth('investor')).send()).status).toBe(200)
    const blocked = await request(app).post(`/api/investor-deals/${dealId}/status`).set(auth('investor')).send({ state: 'closed' })
    expect(blocked.status).toBe(400)
    for (const item of db.diligenceItems) item.status = 'accepted'
    db.dealRooms[0].state = 'closing'
    const closed = await request(app).post(`/api/investor-deals/${dealId}/status`).set(auth('investor')).send({ state: 'closed' })
    expect(closed.status).toBe(200)
    const integrity = await request(app).get(`/api/investor-deals/${dealId}/audit/integrity`).set(auth('investor'))
    expect(integrity.status).toBe(200); expect(integrity.body.valid).toBe(true)
    db.dealAuditEvents[0].action = 'tampered'
    const tampered = await request(app).get(`/api/investor-deals/${dealId}/audit/integrity`).set(auth('investor'))
    expect(tampered.body.valid).toBe(false)
  })
})
