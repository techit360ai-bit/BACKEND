import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readDb, updateDb } from '../config/database.js'
import { adminTvceAnalytics, capabilityCatalog, evaluateEntitlement, evaluatePaywall, fulfillPayment, freeTierUsage, nextBestAction, saveWorkflow, walletForecast } from '../services/tvceService.js'
import { codeWorkspaceAccess } from '../services/codeWorkspaceService.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn() }))

describe('TVCE entitlement and continuation contracts', () => {
  let db
  beforeEach(() => {
    db = {
      users: [{ id: 'u1' }],
      profiles: [{ id: 'u1', role: 'founder', activeRole: 'founder', isOnboarded: true, secondaryRoles: ['investor', 'organization'] }],
      userRoles: [{ id: 'r1', userId: 'u1', role: 'founder', status: 'active', active: true }, { id: 'r2', userId: 'u1', role: 'investor', status: 'active', active: true }, { id: 'r3', userId: 'u1', role: 'organization', status: 'active', active: true }],
      activeContexts: [{ id: 'c1', userId: 'u1', role: 'founder', status: 'active' }],
      subscriptions: [], walletAccounts: [{ userId: 'u1', creditBalance: 0 }], creditLedger: [], usageReservations: [], usageEvents: [], paymentIntents: [], accountEntitlements: [], paywallEvents: [], workflowSnapshots: [], billingWebhookEvents: [], billingPlans: [], capabilityPolicies: [], verificationProfiles: [], trustProfiles: [], riskProfiles: [], organizationMemberships: [],
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

  it('aggregates persisted TVCE funnel and paid cohorts for admins', () => {
    db.paymentIntents.push({ id: 'p2', userId: 'u1', credits: 0, amount: 7900, status: 'successful', createdAt: '2026-08-01T00:00:00.000Z' })
    db.accountEntitlements.push({ userId: 'u1', status: 'active', createdAt: '2026-08-01T00:00:00.000Z' })
    db.billingWebhookEvents.push({ id: 'b1', status: 'processed', createdAt: '2026-08-01T00:00:00.000Z' })
    db.paywallEvents.push(
      { capability: 'IDEA_DIAGNOSTICS_ADVANCED', role: 'founder', eventType: 'PAYWALL_VIEWED', createdAt: '2026-08-01T00:00:00.000Z' },
      { capability: 'IDEA_DIAGNOSTICS_ADVANCED', role: 'founder', eventType: 'PAYMENT_SUCCESS', createdAt: '2026-08-01T00:00:00.000Z' },
    )
    const analytics = adminTvceAnalytics()
    expect(analytics.metrics.paidAccounts).toBe(1)
    expect(analytics.metrics.totalRevenue).toBe(7900)
    expect(analytics.funnel.find(row => row.stage === 'PAYMENT_SUCCESS').count).toBe(1)
    expect(analytics.capabilityConversion[0].conversionRate).toBe(100)
  })

  it('provides explicit free founder quotas and blocks only after the quota is consumed', () => {
    const first = evaluateEntitlement('u1', { capability: 'CUSTOMER_VALIDATION_BASIC', role: 'founder' })
    expect(first.allowed).toBe(true)
    expect(first.freeQuota).toBeGreaterThan(0)
    db.capabilityConsumptions = Array.from({ length: first.freeQuota }, (_, index) => ({ id: `use-${index}`, userId: 'u1', capability: 'CUSTOMER_VALIDATION_BASIC', fundingSource: 'platform_subsidy', status: 'settled', createdAt: new Date().toISOString() }))
    const exhausted = evaluateEntitlement('u1', { capability: 'CUSTOMER_VALIDATION_BASIC', role: 'founder' })
    expect(exhausted.allowed).toBe(false)
    expect(exhausted.code).toBe('free_allowance_exhausted')
    expect(freeTierUsage('u1')[0].remaining).toBe(0)
  })

  it('limits a free collaborator to one active workspace while preserving paid multi-workspace access', () => {
    db.workspaces = [{ id: 'w1', ownerId: 'owner' }, { id: 'w2', ownerId: 'owner2' }]
    db.workspaceMembers = [
      { id: 'm1', workspaceId: 'w1', userId: 'u1', role: 'collaborator', accessLevel: 'contributor', status: 'active', joinedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'm2', workspaceId: 'w2', userId: 'u1', role: 'collaborator', accessLevel: 'contributor', status: 'active', joinedAt: '2026-01-02T00:00:00.000Z' },
    ]
    expect(codeWorkspaceAccess(db, 'u1', 'w1', true)?.workspace.id).toBe('w1')
    expect(codeWorkspaceAccess(db, 'u1', 'w2', true)).toBeNull()
    db.accountEntitlements.push({ userId: 'u1', status: 'active' })
    expect(codeWorkspaceAccess(db, 'u1', 'w2', true)?.workspace.id).toBe('w2')
  })

  it('keeps TVCE pricing-free and exposes free investor and organization entry capabilities', () => {
    db.tvceConfig = { capabilities: { INVESTOR_INTELLIGENCE: { creditCost: 999, credits: 999 } } }
    const catalog = capabilityCatalog()
    expect(catalog.every(item => item.creditCost === undefined)).toBe(true)
    expect(evaluateEntitlement('u1', { capability: 'INVESTOR_PUBLIC_DISCOVERY', role: 'investor' })).toMatchObject({ allowed: true, metering: 'none' })
    expect(evaluateEntitlement('u1', { capability: 'INVESTOR_WATCHLIST', role: 'investor' })).toMatchObject({ allowed: true, metering: 'none' })
    expect(evaluateEntitlement('u1', { capability: 'ORGANIZATION_PROFILE', role: 'organization' })).toMatchObject({ allowed: true, metering: 'none' })
    expect(evaluateEntitlement('u1', { capability: 'ORGANIZATION_BASIC_DASHBOARD', role: 'organization' })).toMatchObject({ allowed: true, metering: 'none' })
    const paid = evaluateEntitlement('u1', { capability: 'INVESTOR_INTELLIGENCE', role: 'investor' })
    expect(paid.allowed).toBe(false)
    expect(['verification_required', 'credits_required', 'subscription_or_credits_required']).toContain(paid.code)
  })

  it('explains the value and funding path for a role-specific next action', () => {
    const action = nextBestAction('u1', { role: 'investor' })
    expect(action.action).toBe('INVESTOR_INTELLIGENCE')
    expect(action.expectedValue).toBeTruthy()
    expect(action.accessStatus).toBeTruthy()
    expect(action.funding).toBe('subscription_or_credits')
    expect(action.subscriptionRecommendation).toBe(true)
  })

  it('never returns an empty recommendation value and reflects credits or subscription', () => {
    const noFunding = nextBestAction('u1', { role: 'founder', capability: 'IDEA_DIAGNOSTICS_ADVANCED' })
    expect(typeof noFunding.expectedValue).toBe('string')
    expect(noFunding.expectedValue.trim().length).toBeGreaterThan(0)
    expect(noFunding.expectedValue).toMatch(/subscribe|buy credits/i)

    db.walletAccounts = [{ userId: 'u1', creditBalance: 40 }]
    db.creditLedger = [{ id: 'cl1', userId: 'u1', type: 'credit_purchase', deltaCredits: 40 }]
    const withCredits = nextBestAction('u1', { role: 'founder', capability: 'IDEA_DIAGNOSTICS_ADVANCED' })
    expect(withCredits.expectedValue.trim().length).toBeGreaterThan(0)
    expect(withCredits.expectedValue).toMatch(/credit/i)

    db.subscriptions = [{ id: 's1', userId: 'u1', status: 'active', planId: 'founder-pro' }]
    const withSubscription = nextBestAction('u1', { role: 'founder', capability: 'IDEA_DIAGNOSTICS_ADVANCED' })
    expect(withSubscription.expectedValue.trim().length).toBeGreaterThan(0)
    expect(withSubscription.expectedValue).toMatch(/subscription/i)
    expect(withSubscription.expectedValue).toContain('founder-pro')
  })
})
