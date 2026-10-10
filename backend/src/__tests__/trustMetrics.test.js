import { beforeEach, describe, expect, it } from 'vitest'
import {
  incTrustMetric,
  observeTrustLatency,
  resetTrustMetrics,
  trustMetricCounter,
  trustMetricsSnapshot,
  trustPercentile,
} from '../services/trustMetrics.js'

describe('trust metrics registry (WS11)', () => {
  beforeEach(() => resetTrustMetrics())

  it('accumulates unlabeled and labeled counters', () => {
    incTrustMetric('trust_proof_writes_total', { source: 'github', status: 'verified' })
    incTrustMetric('trust_proof_writes_total', { source: 'github', status: 'verified' })
    incTrustMetric('trust_proof_writes_total', { source: 'revenue', status: 'pending' })
    incTrustMetric('trust_projection_delivered_total')

    expect(trustMetricCounter('trust_proof_writes_total')).toBe(3)
    const snapshot = trustMetricsSnapshot()
    expect(snapshot.counters.trust_projection_delivered_total).toBe(1)
    expect(snapshot.labels.trust_proof_writes_total['source=github,status=verified']).toBe(2)
  })

  it('drops malformed counter updates instead of throwing', () => {
    incTrustMetric('', {}, 1)
    incTrustMetric('trust_x_total', {}, Number.NaN)
    incTrustMetric('trust_x_total', {}, 0)
    expect(trustMetricCounter('trust_x_total')).toBe(0)
  })

  it('records latency percentiles over a bounded reservoir', () => {
    for (let i = 1; i <= 100; i += 1) observeTrustLatency('trust_http_ms', i)
    observeTrustLatency('trust_http_ms', -5)
    observeTrustLatency('trust_http_ms', Number.NaN)

    const latency = trustMetricsSnapshot().latency.trust_http_ms
    expect(latency.count).toBe(100)
    expect(latency.p50).toBe(50)
    expect(latency.p95).toBe(95)
    expect(latency.p99).toBe(99)
    expect(latency.max).toBe(100)
  })

  it('computes percentiles with a floor and rank clamp', () => {
    expect(trustPercentile([], 95)).toBeNull()
    expect(trustPercentile([5], 99)).toBe(5)
    expect(trustPercentile([10, 20, 30, 40], 50)).toBe(20)
  })
})
