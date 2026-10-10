// WS9 repository-backed outbox worker.
//
// The row-level authority enqueues `trust.decayed` / `trust.updated` rows into
// `trust_projection_outbox` inside the same transaction that recomputes the
// profile. This worker drains that outbox out-of-band (scheduler/cron), so the
// projection POST never runs in a request path. The payload is rebuilt from the
// row-level scope (not the legacy snapshot), so the AI-router mirror stays in
// step with the authoritative score. Deliveries are marked per-row; failures
// bump `attempts` and keep the row pending for the next tick.

import * as repo from '../repositories/trustRepository.js'
import { trustRepositoryEnabled, trustWriteEnabled } from '../repositories/trustRepository.js'
import { observeTrustLatency } from './trustMetrics.js'

export async function flushTrustProjectionOutboxFromRepository(limit = 20) {
  if (!(trustWriteEnabled() && trustRepositoryEnabled())) return { enabled: false, attempted: 0, results: [] }
  const url = process.env.TRUST_PROJECTION_URL || (process.env.AI_ROUTER_URL ? `${process.env.AI_ROUTER_URL.replace(/\/$/, '')}/internal/trust/projection` : '')
  if (!url || !process.env.TRUST_PROJECTION_SECRET) return { enabled: false, attempted: 0, results: [] }

  const { projectionPayload, postTrustProjection } = await import('./trustProjectionService.js')
  const pending = await repo.listPendingOutbox(limit)
  const results = []
  for (const row of pending) {
    const projectId = row.projectId || null
    const scope = await repo.loadTrustScope(row.userId)
    const result = await postTrustProjection(projectionPayload(scope, row.userId, projectId))
    if (result.enabled && result.delivered) {
      await repo.markOutboxDelivered(row.id)
      // WS11: age from enqueue to delivery is the projection lag.
      const enqueuedAt = row.createdAt ? new Date(row.createdAt).getTime() : null
      if (enqueuedAt && Number.isFinite(enqueuedAt)) observeTrustLatency('trust_projection_lag_ms', Date.now() - enqueuedAt)
      results.push({ id: row.id, delivered: true })
    } else if (!result.enabled) {
      break
    } else {
      await repo.markOutboxFailed(row.id, result.error || 'trust_projection_failed')
      results.push({ id: row.id, delivered: false, error: result.error || 'trust_projection_failed' })
    }
  }
  return { enabled: true, attempted: pending.length, delivered: results.filter(row => row.delivered).length, results }
}
