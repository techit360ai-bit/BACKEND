import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({ usageReservations: [], workspaceTeamEntitlements: [], subscriptions: [], usageEvents: [], marginAlerts: [], billingJobRuns: [] })),
  updateDb: vi.fn(mutator => mutator({ usageReservations: [], workspaceTeamEntitlements: [], subscriptions: [], usageEvents: [], marginAlerts: [], billingJobRuns: [] })),
  rowLevelEnabled: vi.fn(() => false),
  runRowLevel: vi.fn(async (actor, opts) => ({ ok: true, ranAt: opts.runAt, results: { via: 'row-level' } })),
  statusRowLevel: vi.fn(async () => ({ lastRun: { id: 'run-1' }, marginAlerts: [] })),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/billingJobsRepository.js', () => ({
  billingJobsRowLevelEnabled: mocks.rowLevelEnabled,
  runBillingJobsRowLevel: mocks.runRowLevel,
  billingJobStatusRowLevel: mocks.statusRowLevel,
}))
vi.mock('../services/tvceService.js', () => ({ TVCE_FREE_QUOTAS: { a: 1, b: 2 } }))

import { billingJobStatus, runBillingJobs } from '../services/billingJobsService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rowLevelEnabled.mockReturnValue(false)
})

describe('billing jobs store (§5 cutover)', () => {
  it('runs the snapshot job when the row-level store is off', async () => {
    const result = await runBillingJobs('tester')
    expect(result.ok).toBe(true)
    expect(mocks.updateDb).toHaveBeenCalledTimes(1)
    expect(mocks.runRowLevel).not.toHaveBeenCalled()
  })

  it('runs the row-level job and never touches the snapshot when enabled', async () => {
    mocks.rowLevelEnabled.mockReturnValue(true)
    const result = await runBillingJobs('tester')
    expect(result.results).toEqual({ via: 'row-level' })
    expect(mocks.runRowLevel).toHaveBeenCalledWith('tester', expect.objectContaining({ freeQuotaCycles: 2 }))
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('reads status row-level when enabled', async () => {
    mocks.rowLevelEnabled.mockReturnValue(true)
    expect(await billingJobStatus()).toEqual({ lastRun: { id: 'run-1' }, marginAlerts: [] })
    expect(mocks.statusRowLevel).toHaveBeenCalledTimes(1)
  })
})
