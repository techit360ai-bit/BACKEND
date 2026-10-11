// WS11 scrape/export shape.
//
// Decision: expose the trust metrics twice from the same registry/snapshot —
//   * GET /trust/admin/metrics      -> JSON (admin UI + humans), and
//   * GET /internal/metrics/trust   -> Prometheus text (scrape), service-auth.
//
// We emit the text exposition directly instead of adding prom-client, because
// the platform already uses an internal service-auth telemetry pattern
// (ai-router /internal/admin/telemetry) and has no scrape dependency. If the
// platform standardizes on a collector, an openmetrics sidecar can scrape the
// same endpoint unchanged.

import { trustObservabilitySnapshot } from './trustObservability.js'

const escapeLabel = value => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')

function labelString(labels) {
  const entries = Object.entries(labels || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (!entries.length) return ''
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(',')}}`
}

function parseLabelKey(key) {
  if (!key) return {}
  return Object.fromEntries(
    key.split(',').map(pair => {
      const idx = pair.indexOf('=')
      return idx === -1 ? [pair, ''] : [pair.slice(0, idx), pair.slice(idx + 1)]
    }),
  )
}

const finite = value => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const line = (name, labels, value) => (value === null ? null : `${name}${labelString(labels)} ${value}`)

export function renderPrometheusText(snapshot) {
  const out = []
  const { counters = {}, labels = {}, latency = {}, gauges = {}, http = {}, anomaly_rate: anomalyRate, slo } = snapshot || {}

  for (const [name, total] of Object.entries(counters)) {
    out.push(`# TYPE ${name} counter`)
    const labelKeys = Object.keys(labels[name] || {})
    if (labelKeys.length) {
      for (const key of labelKeys) out.push(line(name, parseLabelKey(key), finite(labels[name][key]) ?? 0))
    } else {
      out.push(line(name, {}, finite(total) ?? 0))
    }
  }

  for (const [name, stats] of Object.entries(latency)) {
    const metric = `trust_latency_${name.replace(/^trust_/, '')}`
    out.push(`# TYPE ${metric} gauge`)
    for (const [quantile, key] of [['0.5', 'p50'], ['0.95', 'p95'], ['0.99', 'p99']]) {
      out.push(line(metric, { quantile }, finite(stats[key])))
    }
    out.push(line(`${metric}_count`, {}, finite(stats.count) ?? 0))
    out.push(line(`${metric}_max`, {}, finite(stats.max)))
  }

  const gaugeDefs = [
    ['trust_outbox_depth', gauges.outbox_depth?.value?.value],
    ['trust_expired_source_count', gauges.expired_source_count?.value?.value],
    ['trust_anomaly_events_24h', gauges.anomalies_24h?.value?.total],
    ['trust_reverification_due_proofs', gauges.reverification_due?.value?.due_proof_count],
    ['trust_reverification_due_skills', gauges.reverification_due?.value?.due_skill_count],
    ['trust_pool_total', gauges.db_pool?.value?.value?.total],
    ['trust_pool_idle', gauges.db_pool?.value?.value?.idle],
    ['trust_pool_waiting', gauges.db_pool?.value?.value?.waiting],
    ['trust_pool_max', gauges.db_pool?.value?.value?.max],
    ['trust_http_requests', http.total],
    ['trust_http_errors', http.errors],
    ['trust_anomaly_rate', anomalyRate],
    ['trust_slo_p95_ms', slo?.p95_ms],
    ['trust_slo_p99_ms', slo?.p99_ms],
    ['trust_slo_error_rate', slo?.error_rate],
    ['trust_slo_target_peak_rps', slo?.target_peak_rps],
    ['trust_slo_signed_off', slo?.signed_off ? 1 : 0],
  ]
  const emitted = new Set()
  for (const [name, value] of gaugeDefs) {
    const body = line(name, {}, finite(value))
    if (body === null) continue
    if (!emitted.has(name)) { out.push(`# TYPE ${name} gauge`); emitted.add(name) }
    out.push(body)
  }

  for (const alertEntry of snapshot?.alerts || []) {
    out.push(line('trust_alert', { code: alertEntry.code, severity: alertEntry.severity }, 1))
  }
  return `${out.filter(Boolean).join('\n')}\n`
}

export async function trustPrometheusText(options) {
  return renderPrometheusText(await trustObservabilitySnapshot(options))
}
