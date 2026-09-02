import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readDb, updateDb } from '../config/database.js'
import { evaluateEntitlement, evaluatePaywall, fulfillPayment, saveWorkflow, walletForecast } from '../services/tvceService.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn() }))

describe('TVCE entitlement and continuation contracts', () => {
  let db
  beforeEach(() => {
    db = {
      users: [{ id: 'u1' }],
      profiles: [{ id: 'u1', role: 'founder', activeRole: 'founder', isOnboarded: true, secondaryRoles: ['investor', 'organization'] }],
      userRoles: [{ id: 'r1', userId: 'u1', role: 'founder', status: 'active', active: true }, { id: 'r2', userId: 'u1', role: 'investor', status: 'active', active: true }, { id: 'r3', userId: 'u1', role: 'organization', status: 'active', active: true }],
      activeContexts: [{ id: 'c1', userId: 'u1', role: 'founder', status: 'active' }],
      subscriptions: [], walletAccounts: [{ userId: 'u1', creditBalance: 0 }], creditLedger: [], usageReservations: [], usageEvents: [], paymentIntents: [], accountEntitlements: [], paywallEvents: [], workflowSnapshots: [], billingPlans: [], capabilityPolicies: [], verificationProfiles: [], trustProfiles: [], riskProfiles: [], organizationMemberships: [],
    }
    readDb.mockReturnValue(db)
    updateDb.mockImplementation(fn => fn(db))
  })

  it('shares one paid account entitlement across multiple roles', () => {
    db.paymentIntents.push({ id: 'p1', userId: 'u1', credits: 25, status: 'pending' })
    expect(fulfillPayment('u1', 'p1', { verified: true }).ok).toBe(true)
    expect(evaluateEntitlement('u1', { capability: 'IDEA_DIAGNOSTICS_ADVANCED', role: 'founder' }).accountEntitlement.active).toBe(true)
    expect(evaluateEntitlement('u1', { capability: 'INVESTOR_INTELLIGENCE', role: 'investor' }).accountEntitlement.active).toBe(true)
  })

  it('keeps investor access separately funded at a higher threshold', () => {
    db.paymentIntents.push({ id: 'p1', userId: 'u1', credits: 1, status: 'pending' })
    fulfillPayment('u1', 'p1', { verified: true })
    const result = evaluatePaywall('u1', { capability: 'INVESTOR_INTELLIGENCE', role: 'investor' })
    expect(result.allowed).toBe(false)
    expect(['role_funding_required', 'insufficient_credits', 'verification_required']).toContain(result.code)
  })

  it('resumes a saved workflow after payment and forecasts pending work', () => {
    const saved = saveWorkflow('u1', { capability: 'IDEA_DIAGNOSTICS_ADVANCED', name: 'Deep diagnosis', estimatedCredits: 5, clientRequestId: 'req-1' })
    expect(saved.ok).toBe(true)
    expect(walletForecast('u1').projectedRequirement).toBe(5)
    db.paymentIntents.push({ id: 'p1', userId: 'u1', credits: 5, status: 'pending' })
    const fulfilled = fulfillPayment('u1', 'p1', { verified: true, workflowId: saved.workflow.id })
    expect(fulfilled.workflow.status).toBe('resumed')
  })
})
