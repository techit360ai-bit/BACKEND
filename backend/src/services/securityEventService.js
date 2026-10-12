import { createId, nowIso } from '../utils/api.js'
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { insertSecurityEvent, listRecentSecurityEvents, securityEventStoreEnabled } from '../repositories/securityEventRepository.js'

export function recordSecurityEvent(event = {}) {
  const row = { id: event.id || createId('security_event'), createdAt: event.createdAt || nowIso(), severity: event.severity || 'INFO', type: String(event.type || 'security_event'), actorId: event.actorId || null, workspaceId: event.workspaceId || null, organizationId: event.organizationId || null, requestId: event.requestId || null, metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {} }
  if (securityEventStoreEnabled()) {
    // Best-effort audit write; never block or fail the request on telemetry.
    void insertSecurityEvent(row).catch(() => { /* audit store unavailable */ })
    return row
  }
  try { updateAuthorityDb(db => { db.securityEvents = (db.securityEvents || []).concat(row).slice(-10000); return row }) } catch { /* unavailable outside authority context */ }
  return row
}

export async function listSecurityEvents(limit = 100) {
  if (securityEventStoreEnabled()) return listRecentSecurityEvents(limit)
  try { const rows = readAuthorityDb().securityEvents || []; return rows.slice(-Math.max(1, Math.min(1000, Number(limit) || 100))).reverse() } catch { return [] }
}
