import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Drive the bounded bundle builder against an in-memory collection store so we
// can assert the payment path reads only the addressed intent + organization
// rows and persists only what changed — never the whole-database snapshot.
const state = vi.hoisted(() => ({ collections: {}, writes: [] }))

vi.mock('../repositories/platformCollectionRepository.js', () => ({
  withPlatformTransaction: async (fn) => fn({}),
  getRecord: vi.fn(async (client, collection, recordId) => (state.collections[collection] || []).find(row => row.id === recordId) || null),
  listRecordsByField: vi.fn(async (client, collection, field, value) => (state.collections[collection] || []).filter(row => String(row[field]) === String(value))),
  upsertRecord: vi.fn(async (client, collection, record, options = {}) => { state.writes.push({ collection, record, options }); return { ...record, version: 1 } }),
}))

const { applyOrganizationPaymentAsync, applyOrganizationPaymentLifecycleAsync } = await import('../services/organizationBillingService.js')
const { saveOrganizationEntitlementAsync } = await import('../services/organizationEntitlementService.js')

const seeded = () => ({
  paymentIntents: [{ id: 'p1', userId: 'u1', organizationId: 'org1', purchaseType: 'program_pass', amount: 100, credits: 0, planId: 'program_pass' }],
  organizations: [{ id: 'org1' }],
  organizationMemberships: [],
  organizationDashboards: [],
  projects: [],
  organizationBillingEvents: [],
  organizationEntitlements: [],
  organizationBudgets: [],
  organizationAuditEvents: [],
  organizationSponsorshipPackages: [],
  sponsorshipApplications: [],
  sponsorshipTransactions: [],
  sponsorshipBenefits: [],
})

beforeEach(() => { state.collections = seeded(); state.writes = []; process.env.ORGANIZATION_SOURCE = 'postgres' })
afterEach(() => { delete process.env.ORGANIZATION_SOURCE })

describe('organization billing row-level store (§5 payment path)', () => {
  it('grants the entitlement + records the billing event without the snapshot', async () => {
    const result = await applyOrganizationPaymentAsync({ userId: 'u1', paymentId: 'p1', provider: 'stripe', providerReference: 'ref_1', planId: 'program_pass' })
    expect(result.ok).toBe(true)
    const entitlement = state.writes.find(write => write.collection === 'organizationEntitlements')
    expect(entitlement.record).toMatchObject({ organizationId: 'org1', paymentIntentId: 'p1', plan: 'program_pass', status: 'active' })
    const event = state.writes.find(write => write.collection === 'organizationBillingEvents')
    expect(event.record).toMatchObject({ organizationId: 'org1', purchaseType: 'program_pass', paymentIntentId: 'p1' })
    // The audit trail for the grant is persisted row-level as well.
    expect(state.writes.some(write => write.collection === 'organizationAuditEvents')).toBe(true)
  })

  it('is idempotent when the billing event already exists', async () => {
    state.collections.organizationBillingEvents = [{ id: 'evt1', organizationId: 'org1', paymentIntentId: 'p1', providerReference: 'ref_1', purchaseType: 'program_pass' }]
    const result = await applyOrganizationPaymentAsync({ userId: 'u1', paymentId: 'p1', provider: 'stripe', providerReference: 'ref_1' })
    expect(result.idempotent).toBe(true)
    expect(state.writes).toHaveLength(0)
  })

  it('creates the budget for a sponsor grant', async () => {
    state.collections.paymentIntents = [{ id: 'p2', userId: 'u1', organizationId: 'org1', purchaseType: 'sponsor_grant', credits: 50, amount: 50 }]
    const result = await applyOrganizationPaymentAsync({ userId: 'u1', paymentId: 'p2', provider: 'stripe', providerReference: 'ref_2' })
    expect(result.ok).toBe(true)
    const budget = state.writes.find(write => write.collection === 'organizationBudgets')
    expect(budget.record).toMatchObject({ organizationId: 'org1', balance: 50, source: 'sponsor_payment', paymentIntentId: 'p2' })
  })

  it('skips a foreign or unknown payment', async () => {
    expect((await applyOrganizationPaymentAsync({ userId: 'other', paymentId: 'p1' })).skipped).toBe(true)
    expect((await applyOrganizationPaymentAsync({ userId: 'u1', paymentId: 'missing' })).skipped).toBe(true)
    expect(state.writes).toHaveLength(0)
  })

  it('saves an organization entitlement row-level for the admin route', async () => {
    const result = await saveOrganizationEntitlementAsync('admin1', { id: 'ent:org1', organizationId: 'org1', plan: 'program_pass', capabilities: { ORGANIZATION_MONITORING: true } })
    expect(result.ok).toBe(true)
    const entitlement = state.writes.find(write => write.collection === 'organizationEntitlements')
    expect(entitlement.record).toMatchObject({ id: 'ent:org1', organizationId: 'org1', plan: 'program_pass', status: 'active' })
    expect(state.writes.some(write => write.collection === 'organizationAuditEvents')).toBe(true)
  })

  it('flips the lifecycle status row-level', async () => {
    state.collections.organizationEntitlements = [{ id: 'ent1', organizationId: 'org1', paymentIntentId: 'p1', providerReference: 'ref_1', status: 'active' }]
    state.collections.organizationBudgets = [{ id: 'bud1', organizationId: 'org1', paymentIntentId: 'p1', providerReference: 'ref_1', status: 'active' }]
    state.collections.sponsorshipTransactions = [{ id: 'tx1', organizationId: 'org1', paymentIntentId: 'p1', providerReference: 'ref_1', status: 'successful' }]
    const result = await applyOrganizationPaymentLifecycleAsync({ paymentId: 'p1', providerReference: 'ref_1', status: 'refunded' })
    expect(result.ok).toBe(true)
    expect(state.writes.find(write => write.collection === 'organizationEntitlements').record.status).toBe('inactive')
    expect(state.writes.find(write => write.collection === 'organizationBudgets').record.status).toBe('frozen')
    expect(state.writes.find(write => write.collection === 'sponsorshipTransactions').record.status).toBe('refunded')
  })
})
