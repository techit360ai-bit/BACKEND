// WS11 trust SLO + alert thresholds.
//
// Thresholds are derived from named capacity inputs instead of hard-coded
// magic numbers, so "real" alerting is a function of the signed-off target
// profile:
//
//   TRUST_SLO_P95_MS / TRUST_SLO_P99_MS   latency objective (defaults match the
//                                         k6 gate: 300 / 800 ms)
//   TRUST_SLO_ERROR_RATE                  5xx objective (default 0.001 = 0.1%)
//   TRUST_TARGET_PEAK_RPS                 signed-off peak request rate, OR
//   TRUST_TARGET_DAU + TRUST_PEAK_FACTOR  (peak RPS = DAU/86400 * factor, 6x)
//   TRUST_OUTBOX_MAX_LAG_SECONDS          acceptable enqueue→delivery lag
//
// The outbox-depth alert scales with traffic: depth = peak_rps * max_lag, so a
// busier profile tolerates a proportionally deeper queue before alerting. When
// no capacity input is provided we fall back to the documented placeholder and
// mark the profile `signed_off: false` so ops can see it is not yet tuned.
//
// Nothing here enables a source or changes scoring; it is observation only.

const num = (value, fallback = null) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function trustSloConfig(env = process.env) {
  const p95 = num(env.TRUST_SLO_P95_MS, 300)
  const p99 = num(env.TRUST_SLO_P99_MS, 800)
  const errorRate = num(env.TRUST_SLO_ERROR_RATE, 0.001)
  const peakFactor = num(env.TRUST_PEAK_FACTOR, 6)
  const targetDau = num(env.TRUST_TARGET_DAU, null)
  const explicitRps = num(env.TRUST_TARGET_PEAK_RPS, null)
  const peakRps = explicitRps ?? (targetDau ? (targetDau / 86400) * peakFactor : null)
  const outboxMaxLagSeconds = num(env.TRUST_OUTBOX_MAX_LAG_SECONDS, 60)
  const derivedDepth = peakRps ? Math.ceil(peakRps * outboxMaxLagSeconds) : null
  return {
    p95_ms: p95,
    p99_ms: p99,
    error_rate: errorRate,
    target_dau: targetDau,
    peak_factor: peakFactor,
    target_peak_rps: peakRps,
    outbox_max_lag_seconds: outboxMaxLagSeconds,
    outbox_depth_alert: num(env.TRUST_OUTBOX_DEPTH_ALERT, derivedDepth ?? 500),
    expired_source_alert: num(env.TRUST_EXPIRED_SOURCE_ALERT, 1000),
    min_samples: num(env.TRUST_METRICS_MIN_SAMPLES, 20),
    signed_off: Boolean(explicitRps || targetDau),
  }
}
