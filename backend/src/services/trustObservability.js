// WS11 trust observability aggregator.
//
// Combines the in-process registry (trustMetrics.js) with live, cheap gauges
// (outbox depth, expired-source count, anomaly window, DB pool saturation) and
// evaluates alerts against the SLO config (trustSlo.js). Every gauge is
// best-effort: a failing/misconfigured source reports `{ available: false,
// error }` instead of throwing, so the admin metrics endpoint, the Prometheus
// exposition, and the health probe never fail because telemetry broke.

import { trustMetricsSnapshot } from './trustMetrics.js'
import { trustPoolStats, trustRepositoryEnabled } from '../repositories/trustRepository.js'
import { trustReverificationDue } from './trustReverificationService.js'
import { trustSloConfig } from '../config/trustSlo.js'
import * as database from '../config/database.js'

const readDb = () => database.readDb()

async function safely(loader) {
  try {
    return { available: true, value: await loader() }
  } catch (error) {
    return { available: false, error: String(error?.message || error).slice(0, 200) }
  }
}

const rows = (db, name) => (Array.isArray(db[name]) ? db[name] : [])

async function outboxDepth() {
  if (trustRepositoryEnabled()) {
    const repo = await import('../repositories/trustRepository.js')
    return { value: await repo.countPendingOutbox(), source: 'postgres' }
  }
  const db = readDb()
  return { value: rows(db, 'trustProjectionOutbox').filter(row => !row.deliveredAt).length, source: 'sqlite' }
}

async function expiredSourceCount() {
  if (trustRepositoryEnabled()) {
    const repo = await import('../repositories/trustRepository.js')
    return { value: await repo.countExpiredProofs(), source: 'postgres' }
  }
  const db = readDb()
  return { value: rows(db, 'trustVerificationProofs').filter(row => row.status === 'expired').length, source: 'sqlite' }
}

async function anomalyWindow(sinceHours) {
  if (trustRepositoryEnabled()) {
    const repo = await import('../repositories/trustRepository.js')
    return { ...(await repo.anomalyStats({ sinceHours })), source: 'postgres' }
  }
  const db = readDb()
  const since = Date.now() - sinceHours * 3600 * 1000
  const events = rows(db, 'trustAnomalyEvents').filter(row => new Date(row.createdAt || row.created_at || 0).getTime() >= since)
  const bySeverity = {}
  for (const event of events) bySeverity[event.severity || 'info'] = (bySeverity[event.severity || 'info'] || 0) + 1
  return { window_hours: sinceHours, total: events.length, by_severity: bySeverity, source: 'sqlite' }
}

function poolSaturation() {
  const stats = trustPoolStats()
  if (!stats) return { available: true, value: null, reason: 'pool_not_opened' }
  const max = Number(stats.max || 0)
  return { available: true, value: { ...stats, utilization: max > 0 && stats.total != null ? Number((stats.total / max).toFixed(4)) : null } }
}

// HTTP outcome rate from the request counter labels (`method=GET,status=500`).
export function httpOutcomeStats(labels = {}) {
  let total = 0
  let errors = 0
  for (const [key, count] of Object.entries(labels.trust_http_requests_total || {})) {
    const value = Number(count) || 0
    total += value
    const match = /(?:^|,)status=(\d{3})(?:,|$)/.exec(key)
    if (match && Number(match[1]) >= 500) errors += value
  }
  return { total, errors, rate: total > 0 ? Number((errors / total).toFixed(6)) : null }
}

const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback)

const alert = (code, severity, value, detail) => ({ code, severity, value, ...(detail ? { detail } : {}) })

export function evaluateTrustAlerts({ counters = {}, latency = {}, gauges = {}, anomalyRate = null, httpErrorRate = null, slo = trustSloConfig() } = {}) {
  const alerts = []
  const attempts = num(counters.trust_adapter_attempts_total)
  const failures = num(counters.trust_adapter_failures_total)
  if (attempts >= slo.min_samples && failures / attempts > 0.2) {
    alerts.push(alert('adapter_failure_rate_high', 'critical', Number((failures / attempts).toFixed(4))))
  }
  const p95 = latency.trust_http_ms?.p95
  if (p95 != null && p95 > slo.p95_ms) alerts.push(alert('trust_latency_p95_high', 'warning', p95, { objective_ms: slo.p95_ms }))
  const p99 = latency.trust_http_ms?.p99
  if (p99 != null && p99 > slo.p99_ms) alerts.push(alert('trust_latency_p99_high', 'warning', p99, { objective_ms: slo.p99_ms }))
  if (httpErrorRate != null && httpErrorRate > slo.error_rate) {
    alerts.push(alert('trust_error_rate_high', 'critical', httpErrorRate, { objective: slo.error_rate }))
  }
  const projectionFailures = num(counters.trust_projection_failed_total)
  if (projectionFailures >= 5) alerts.push(alert('projection_failures', 'warning', projectionFailures))
  const depth = gauges.outbox_depth?.available ? num(gauges.outbox_depth.value?.value) : 0
  if (depth > slo.outbox_depth_alert) alerts.push(alert('outbox_depth_high', 'warning', depth, { threshold: slo.outbox_depth_alert }))
  const pool = gauges.db_pool?.available ? gauges.db_pool.value?.value : null
  if (pool && num(pool.idle) === 0 && num(pool.waiting) > 0) {
    alerts.push(alert('db_pool_saturated', 'critical', num(pool.waiting), { total: pool.total, max: pool.max }))
  }
  if (anomalyRate != null && anomalyRate > 0.1 && num(gauges.anomalies_24h?.value?.total) >= 10) {
    alerts.push(alert('anomaly_rate_high', 'warning', Number(anomalyRate.toFixed(4))))
  }
  const expired = gauges.expired_source_count?.available ? num(gauges.expired_source_count.value?.value) : 0
  if (expired > slo.expired_source_alert) alerts.push(alert('expired_sources_high', 'info', expired, { threshold: slo.expired_source_alert }))
  return alerts
}

export async function trustObservabilitySnapshot({ now = new Date(), anomalyWindowHours = 24, env = process.env } = {}) {
  const registry = trustMetricsSnapshot()
  const slo = trustSloConfig(env)
  const hours = Math.min(24 * 30, Math.max(1, Number(anomalyWindowHours) || 24))
  const [outbox, expired, anomalies] = await Promise.all([
    safely(outboxDepth),
    safely(expiredSourceCount),
    safely(() => anomalyWindow(hours)),
  ])
  const gauges = {
    outbox_depth: outbox.available ? { available: true, value: outbox.value } : outbox,
    expired_source_count: expired.available ? { available: true, value: expired.value } : expired,
    anomalies_24h: anomalies.available ? { available: true, value: anomalies.value } : anomalies,
    reverification_due: await safely(() => trustReverificationDue()),
    db_pool: poolSaturation(),
  }
  const proofWrites = num(registry.counters.trust_proof_writes_total)
  const anomalyTotal = gauges.anomalies_24h.available ? num(gauges.anomalies_24h.value.total) : 0
  const anomalyRate = proofWrites > 0 ? Number((anomalyTotal / proofWrites).toFixed(6)) : null
  const http = httpOutcomeStats(registry.labels)
  return {
    generatedAt: now.toISOString(),
    slo,
    counters: registry.counters,
    labels: registry.labels,
    latency: registry.latency,
    gauges,
    http,
    anomaly_rate_window: hours,
    anomaly_rate: anomalyRate,
    alerts: evaluateTrustAlerts({ counters: registry.counters, latency: registry.latency, gauges, anomalyRate, httpErrorRate: http.rate, slo }),
  }
}
