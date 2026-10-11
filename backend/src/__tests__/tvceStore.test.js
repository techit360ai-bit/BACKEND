import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(),
  loadSnapshot: vi.fn(async () => ({})),
  loadAdminSnapshot: vi.fn(async () => ({})),
  loadProgress: vi.fn(async () => ({})),
  saveAdminConfig: vi.fn(async () => ({ ok: true })),
  financePostgresEnabled: vi.fn(() => true),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/financeRepository.js', () => ({
  fulfillPaymentPostgres: vi.fn(),
  loadFinanceSnapshotPostgres: mocks.loadSnapshot,
  loadFinanceAdminSnapshotPostgres: mocks.loadAdminSnapshot,
  loadProgressMeterPostgres: mocks.loadProgress,
  saveAdminCommercialConfigPostgres: mocks.saveAdminConfig,
  recordPaywallEventPostgres: vi.fn(),
  reversePaymentCreditsPostgres: vi.fn(),
  resumeWorkflowPostgres: vi.fn(),
  saveWorkflowPostgres: vi.fn(),
  financePostgresEnabled: mocks.financePostgresEnabled,
}))

const { estimateCreditsAsync, walletForecastAsync, progressMeterAsync, conversionFunnelAsync, freeTierUsageAsync, nextBestActionAsync, adminTvceAnalyticsAsync, adminCommercialConfigAsync, updateAdminCommercialConfigAsync } = await import('../services/tvceService.js')

beforeEach(() => {
  vi.clearAllMocks()
  process.env.FINANCE_READ_SOURCE = 'postgres'
  process.env.FINANCE_WRITE_SOURCE = 'postgres'
  delete process.env.FINANCE_READ_FALLBACK_SQLITE
  delete process.env.FINANCE_WRITE_FALLBACK_SQLITE
  mocks.loadSnapshot.mockResolvedValue({})
  mocks.loadAdminSnapshot.mockResolvedValue({})
  mocks.loadProgress.mockResolvedValue({})
  mocks.saveAdminConfig.mockResolvedValue({ ok: true })
})

describe('TVCE row-level store (§5 cutover)', () => {
  it('forecasts the wallet from the row-level finance snapshot', async () => {
    mocks.loadSnapshot.mockResolvedValue({
      walletAccounts: [{ userId: 'u1', creditBalance: 100 }], creditLedger: [], usageReservations: [],
      workflowSnapshots: [{ id: 'w1', userId: 'u1', name: 'Deep diagnosis', estimatedCredits: 5, status: 'pending' }],
    })
    const forecast = await walletForecastAsync('u1')
    expect(forecast.availableCredits).toBe(100)
    expect(forecast.projectedRequirement).toBe(5)
    expect(forecast.covered).toBe(true)
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('estimates credits from the row-level finance snapshot', async () => {
    mocks.loadSnapshot.mockResolvedValue({ walletAccounts: [{ userId: 'u1', creditBalance: 40 }], creditLedger: [], usageReservations: [] })
    const estimate = await estimateCreditsAsync('u1', { actions: [{ estimatedCredits: 10 }] })
    expect(estimate.estimatedCredits).toBe(10)
    expect(estimate.availableCredits).toBe(40)
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('computes the progress meter from owner-scoped rows', async () => {
    mocks.loadProgress.mockResolvedValue({ ventureIntakes: [{ id: 'v1', userId: 'u1' }], projects: [{ id: 'p1', ownerId: 'u1' }], workspaces: [] })
    const meter = await progressMeterAsync('u1')
    expect(meter.meter.ideaClarity).toBe(100)
    expect(mocks.loadProgress).toHaveBeenCalledWith('u1')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('reads the free-tier usage row-level', async () => {
    mocks.loadSnapshot.mockResolvedValue({ tvceConfig: { freeQuotas: {} }, capabilityConsumptions: [], capabilityAnalytics: [] })
    const usage = await freeTierUsageAsync('u1')
    expect(Array.isArray(usage)).toBe(true)
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('reads the conversion funnel row-level', async () => {
    mocks.loadSnapshot.mockResolvedValue({ paywallEvents: [{ userId: 'u1', capability: 'MVP_PLANNING_BASIC', eventType: 'PAYWALL_VIEWED', createdAt: new Date().toISOString() }] })
    const funnel = await conversionFunnelAsync('u1')
    expect(funnel.totalEvents).toBe(1)
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('recommends the next best action row-level', async () => {
    mocks.loadSnapshot.mockResolvedValue({ profiles: [{ id: 'u1', role: 'founder', activeRole: 'founder' }], workflowSnapshots: [], capabilityConsumptions: [], paywallEvents: [] })
    const action = await nextBestActionAsync('u1', {})
    expect(action.action).toBeTruthy()
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('aggregates admin analytics from the global row-level finance snapshot', async () => {
    mocks.loadAdminSnapshot.mockResolvedValue({ paymentIntents: [{ id: 'p1', userId: 'u1', status: 'successful', amount: 7900, createdAt: '2026-08-01T00:00:00.000Z' }] })
    const analytics = await adminTvceAnalyticsAsync('all', {})
    expect(analytics.metrics.totalRevenue).toBe(7900)
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('reads and writes the admin commercial config row-level', async () => {
    mocks.loadSnapshot.mockResolvedValue({ tvceConfig: { freeQuotas: {} }, billingPlans: [], creditPackages: [], rateCards: [], geoPricingProfiles: [] })
    const config = await adminCommercialConfigAsync()
    expect(config).toHaveProperty('freeQuotas')
    const result = await updateAdminCommercialConfigAsync('admin1', { plans: [{ id: 'plan_pro', name: 'Pro' }] })
    expect(result.ok).toBe(true)
    expect(mocks.saveAdminConfig).toHaveBeenCalled()
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })
})
