import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(mutator => mutator({})),
  repoEnabled: vi.fn(() => true),
  writeEnabled: vi.fn(() => true),
  workerFlush: vi.fn(async () => ({ enabled: true, attempted: 3, results: [] })),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/trustRepository.js', () => ({ trustRepositoryEnabled: mocks.repoEnabled, trustWriteEnabled: mocks.writeEnabled }))
vi.mock('../services/trustProjectionOutboxWorker.js', () => ({ flushTrustProjectionOutboxFromRepository: mocks.workerFlush }))
vi.mock('../services/trustMetrics.js', () => ({ incTrustMetric: vi.fn(), observeTrustLatency: vi.fn() }))

import { flushTrustProjectionOutbox, publishTrustProjection } from '../services/trustProjectionService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.repoEnabled.mockReturnValue(true)
  mocks.writeEnabled.mockReturnValue(true)
})

describe('trust projection service authority gating (§5 cutover)', () => {
  it('skips the snapshot publish when the row-level authority is active', async () => {
    expect(await publishTrustProjection('user-1', null)).toEqual({ enabled: false, skipped: 'repository_authority' })
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('delegates the outbox flush to the repository worker', async () => {
    expect(await flushTrustProjectionOutbox(5)).toEqual({ enabled: true, attempted: 3, results: [] })
    expect(mocks.workerFlush).toHaveBeenCalledWith(5)
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('uses the snapshot path when the row-level authority is off', async () => {
    mocks.repoEnabled.mockReturnValue(false)
    mocks.writeEnabled.mockReturnValue(false)
    mocks.readAuthorityDb.mockReturnValue({ trustProjectionOutbox: [] })
    await flushTrustProjectionOutbox(5)
    expect(mocks.workerFlush).not.toHaveBeenCalled()
    expect(mocks.readAuthorityDb).toHaveBeenCalled()
  })
})
