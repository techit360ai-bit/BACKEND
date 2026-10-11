import { describe, expect, it } from 'vitest'
import { renderPrometheusText } from '../services/trustMetricsPrometheus.js'
import { httpOutcomeStats } from '../services/trustObservability.js'

const snapshot = {
  slo: { p95_ms: 300, p99_ms: 800, error_rate: 0.001, target_peak_rps: 600, signed_off: true },
  counters: { trust_proof_writes_total: 3, trust_http_requests_total: 5 },
  labels: {
    trust_proof_writes_total: { 'source=github,status=verified': 2, 'source=revenue,status=pending': 1 },
    trust_http_requests_total: { 'method=GET,status=200': 4, 'method=GET,status=500': 1 },
  },
  latency: { trust_http_ms: { count: 10, p50: 20, p95: 250, p99: 600, max: 700 } },
  gauges: {
    outbox_depth: { available: true, value: { value: 12, source: 'postgres' } },
    expired_source_count: { available: true, value: { value: 4 } },
    anomalies_24h: { available: true, value: { total: 1 } },
    reverification_due: { available: true, value: { due_proof_count: 2, due_skill_count: 1 } },
    db_pool: { available: true, value: { value: { total: 5, idle: 0, waiting: 3, max: 5 } } },
  },
  http: { total: 5, errors: 1, rate: 0.2 },
  anomaly_rate: 0.33,
  alerts: [{ code: 'trust_error_rate_high', severity: 'critical' }],
}

describe('trust prometheus exposition (WS11)', () => {
  it('renders counters, latency quantiles, gauges and alerts', () => {
    const text = renderPrometheusText(snapshot)
    expect(text).toContain('# TYPE trust_proof_writes_total counter')
    expect(text).toContain('trust_proof_writes_total{source="github",status="verified"} 2')
    expect(text).toContain('trust_proof_writes_total{source="revenue",status="pending"} 1')
    expect(text).toContain('trust_latency_http_ms{quantile="0.95"} 250')
    expect(text).toContain('trust_latency_http_ms_count 10')
    expect(text).toContain('# TYPE trust_outbox_depth gauge')
    expect(text).toContain('trust_outbox_depth 12')
    expect(text).toContain('trust_pool_waiting 3')
    expect(text).toContain('trust_reverification_due_proofs 2')
    expect(text).toContain('trust_slo_signed_off 1')
    expect(text).toContain('trust_alert{code="trust_error_rate_high",severity="critical"} 1')
    expect(text.endsWith('\n')).toBe(true)
  })

  it('omits unavailable gauges instead of emitting NaN', () => {
    const text = renderPrometheusText({ gauges: { db_pool: { available: true, value: { value: null } } }, counters: {}, labels: {}, latency: {} })
    expect(text).not.toContain('NaN')
    expect(text).not.toContain('trust_pool_total')
  })

  it('escapes label values', () => {
    const text = renderPrometheusText({ counters: { x_total: 1 }, labels: { x_total: { 'k=a"b\\c': 1 } }, latency: {} })
    expect(text).toContain('k="a\\"b\\\\c"')
  })
})

describe('trust http outcome stats (WS11)', () => {
  it('sums totals and 5xx from request counter labels', () => {
    expect(httpOutcomeStats(snapshot.labels)).toEqual({ total: 5, errors: 1, rate: 0.2 })
    expect(httpOutcomeStats({})).toEqual({ total: 0, errors: 0, rate: null })
  })
})
