import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn() }))
import { readDb, updateDb } from '../config/database.js'
import { decideInvestorTrustAccess, investorTrustAccessStatus, listFounderTrustAccessRequests, requestInvestorTrustAccess } from '../services/investorTrustAccessService.js'

let db
beforeEach(() => {
  db = { projects: [{ id: 'project-1', ownerId: 'founder-1' }], investorTrustAccessRequests: [], investorTrustAccessHistory: [], notifications: [] }
  readDb.mockReturnValue(db)
  updateDb.mockImplementation(mutator => mutator(db))
})

describe('investor Trust access requests', () => {
  it('creates one pending request and notifies the founder', () => {
    const created = requestInvestorTrustAccess('investor-1', 'project-1', { purpose: 'Due diligence' })
    const duplicate = requestInvestorTrustAccess('investor-1', 'project-1', { purpose: 'Duplicate' })
    expect(created.ok).toBe(true)
    expect(created.created).toBe(true)
    expect(duplicate.created).toBe(false)
    expect(db.investorTrustAccessRequests).toHaveLength(1)
    expect(db.notifications[0].userId).toBe('founder-1')
    expect(investorTrustAccessStatus('investor-1', 'project-1').requestAccessAllowed).toBe(false)
  })

  it('allows only the startup owner to decide the request', () => {
    const created = requestInvestorTrustAccess('investor-1', 'project-1', {})
    expect(decideInvestorTrustAccess('other-founder', created.request.id, { decision: 'approved' }).status).toBe(403)
    const decision = decideInvestorTrustAccess('founder-1', created.request.id, { decision: 'approved' })
    expect(decision.request.status).toBe('approved')
    expect(listFounderTrustAccessRequests('founder-1').requests[0].status).toBe('approved')
    expect(db.investorTrustAccessHistory.map(row => row.action)).toEqual(['requested', 'approved'])
  })
})
