import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  trustProjectionOutbox: [],
  trustVerificationProofs: [],
  trustAnomalyEvents: [],
  notifications: [],
}

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(() => db),
  writeDb: vi.fn(),
  updateDb: vi.fn(mutator => mutator(db)),
}))

const { evaluateTrustAlerts, trustObservabilitySnapshot } = await import('../services/trustObservability.js')
const { incTrustMetric, observeTrustLatency, resetTrustMetrics } = await import('../services/trustMetrics.js')

function seed() {
  db.trustProjectionOutbox = [{ id: 'o1' }, { id: 'o2', deliveredAt: 'now' }]
  db.trustVerificationProofs = [{ id: 'p1', status: 'expired' }, { id: 'p2', status: 'verified' }, { id: 'p3', status: 'expired' }]
  const now = new Date().toISOString()
  db.trustAnomalyEvents = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, severity: i < 4 ? 'warning' : 'critical', createdAt: now }))
}

describe('trust observability snapshot (WS11)', () => {
  beforeEach(() => {
    resetTrustMetrics()
    seed()
    delete process.env.TRUST_READ_SOURCE
    delete process.env.TRUST_WRITE_SOURCE
  })

  it('aggregates registry counters with legacy gauges', async () => {
    incTrustMetric('trust_proof_writes_total', { source: 'github', status: 'verified' }, 10)
    incTrustMetric('trust_projection_failed_total', { reason: 'trust_projection_500' }, 5)

    const snapshot = await trustObservabilitySnapshot({ now: new Date('2026-07-06T10:00:00Z') })
    expect(snapshot.generatedAt).toBe('2026-07-06T10:00:00.000Z')
    expect(snapshot.counters.trust_proof_writes_total).toBe(10)
    expect(snapshot.gauges.outbox_depth.value).toEqual({ value: 1, source: 'sqlite' })
    expect(snapshot.gauges.expired_source_count.value.value).toBe(2)
    expect(snapshot.gauges.anomalies_24h.value.total).toBe(5)
    expect(snapshot.anomaly_rate).toBeCloseTo(0.5, 6)
    expect(snapshot.alerts.map(a => a.code)).toContain('projection_failures')
  })

  it('never throws when a gauge source fails', async () => {
    const database = await import('../config/database.js')
    database.readDb.mockImplementationOnce(() => { throw new Error('db down') })
    const snapshot = await trustObservabilitySnapshot()
    expect(snapshot.gauges.outbox_depth.available).toBe(false)
    expect(snapshot.gauges.expired_source_count.available).toBe(true)
  })
})

describe('trust alert evaluation (WS11)', () => {
  it('flags adapter failure rate, latency, outbox depth and pool saturation', () => {
    const alerts = evaluateTrustAlerts({
      counters: { trust_adapter_attempts_total: 100, trust_adapter_failures_total: 40 },
      latency: { trust_http_ms: { p95: 900, p99: 2000 } },
      gauges: {
        outbox_depth: { available: true, value: { value: 900 } },
        db_pool: { available: true, value: { value: { total: 5, idle: 0, waiting: 3, max: 5 } } },
        anomalies_24h: { available: true, value: { total: 20 } },
      },
      anomalyRate: 0.25,
    })
    const codes = alerts.map(alert => alert.code)
    expect(codes).toEqual(expect.arrayContaining([
      'adapter_failure_rate_high', 'trust_latency_p95_high', 'trust_latency_p99_high',
      'outbox_depth_high', 'db_pool_saturated', 'anomaly_rate_high',
    ]))
    expect(alerts.find(a => a.code === 'adapter_failure_rate_high').severity).toBe('critical')
  })

  it('stays quiet on a healthy surface', () => {
    const alerts = evaluateTrustAlerts({
      counters: { trust_adapter_attempts_total: 100, trust_adapter_failures_total: 1 },
      latency: { trust_http_ms: { p95: 100, p99: 200 } },
      gauges: { outbox_depth: { available: true, value: { value: 0 } }, db_pool: { available: true, value: { value: { total: 2, idle: 2, waiting: 0, max: 5 } } } },
      anomalyRate: 0,
    })
    expect(alerts).toEqual([])
  })

  it('ignores a pool that has not been opened', () => {
    const alerts = evaluateTrustAlerts({ gauges: { db_pool: { available: true, value: { value: null, reason: 'pool_not_opened' } } } })
    expect(alerts).toEqual([])
  })
})
