// WS11 trust observability — a dependency-free in-process metrics registry.
//
// The trust authority needs a health surface (proof writes, adapter
// success/failure, projection lag, outbox depth, expiry, anomaly rate,
// p95/p99 latency, DB pool saturation) without pulling a Prometheus client
// into the process. Counters are monotonic; each latency metric keeps a bounded
// reservoir (newest-forward eviction) and reports p50/p95/p99 on snapshot.
// Gauges that require I/O (outbox depth, pool saturation, ...) are pulled live
// by trustObservability.js, never stored here.
//
// Everything is best-effort: a metrics failure must never affect a trust write.

const RESERVOIR_SIZE = Math.max(64, Number(process.env.TRUST_METRICS_RESERVOIR || 2048))

const counters = new Map() // name -> { total, labels: Map<labelKey, count> }
const latencies = new Map() // name -> bounded array of samples (ms)

const labelKey = (labels = {}) =>
  Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(',')

/** Increment a counter (optionally labeled). No-op on a bad name/value. */
export function incTrustMetric(name, labels = {}, value = 1) {
  const amount = Number(value)
  if (!name || !Number.isFinite(amount) || amount === 0) return
  const state = counters.get(name) || { total: 0, labels: new Map() }
  state.total += amount
  const key = labelKey(labels)
  if (key) state.labels.set(key, (state.labels.get(key) || 0) + amount)
  counters.set(name, state)
}

/** Record a latency sample (ms). Negative/NaN samples are dropped. */
export function observeTrustLatency(name, ms) {
  const value = Number(ms)
  if (!name || !Number.isFinite(value) || value < 0) return
  const samples = latencies.get(name) || []
  samples.push(value)
  if (samples.length > RESERVOIR_SIZE) samples.splice(0, samples.length - RESERVOIR_SIZE)
  latencies.set(name, samples)
}

export function trustPercentile(samples, percentile) {
  if (!Array.isArray(samples) || samples.length === 0) return null
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1))
  return sorted[rank]
}

export function trustMetricCounter(name) {
  return counters.get(name)?.total ?? 0
}

export function trustMetricsSnapshot() {
  return {
    counters: Object.fromEntries([...counters.entries()].map(([name, state]) => [name, state.total])),
    labels: Object.fromEntries(
      [...counters.entries()]
        .filter(([, state]) => state.labels.size > 0)
        .map(([name, state]) => [name, Object.fromEntries(state.labels)]),
    ),
    latency: Object.fromEntries(
      [...latencies.entries()].map(([name, samples]) => [
        name,
        {
          count: samples.length,
          p50: trustPercentile(samples, 50),
          p95: trustPercentile(samples, 95),
          p99: trustPercentile(samples, 99),
          max: samples.length ? Math.max(...samples) : null,
        },
      ]),
    ),
  }
}

export function resetTrustMetrics() {
  counters.clear()
  latencies.clear()
}

export const __internals = { RESERVOIR_SIZE, labelKey }
