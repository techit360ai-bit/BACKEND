import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetTrustPoolForTests, __setTrustPoolForTests, anomalyStats, countExpiredProofs, countPendingOutbox, trustPoolStats } from '../repositories/trustRepository.js'

function fakePool() {
  const query = vi.fn(async (text) => {
    if (/FROM trust_projection_outbox/.test(text)) return { rows: [{ count: 7 }], rowCount: 1 }
    if (/FROM trust_verification_proofs/.test(text)) return { rows: [{ count: 3 }], rowCount: 1 }
    if (/FROM trust_anomaly_events/.test(text)) return { rows: [{ severity: 'warning', count: 4 }, { severity: 'critical', count: 1 }], rowCount: 2 }
    return { rows: [], rowCount: 0 }
  })
  return { query, totalCount: 5, idleCount: 0, waitingCount: 2, options: { max: 5 }, end: async () => {} }
}

afterEach(() => __resetTrustPoolForTests())

describe('trust repository observability gauges (WS11)', () => {
  it('counts pending outbox rows and expired proofs', async () => {
    __setTrustPoolForTests(fakePool())
    expect(await countPendingOutbox()).toBe(7)
    expect(await countExpiredProofs()).toBe(3)
  })

  it('groups anomalies by severity within the window', async () => {
    __setTrustPoolForTests(fakePool())
    const stats = await anomalyStats({ sinceHours: 24 })
    expect(stats.total).toBe(5)
    expect(stats.by_severity).toEqual({ warning: 4, critical: 1 })
    expect(stats.window_hours).toBe(24)
  })

  it('does not open a pool just to read saturation', () => {
    expect(trustPoolStats()).toBeNull()
    __setTrustPoolForTests(fakePool())
    expect(trustPoolStats()).toEqual({ total: 5, idle: 0, waiting: 2, max: 5 })
  })
})
