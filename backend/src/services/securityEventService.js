import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb as updateAuthorityDb } from '../config/database.js'

export function recordSecurityEvent(event = {}) {
  const row = { id: event.id || createId('security_event'), createdAt: event.createdAt || nowIso(), severity: event.severity || 'INFO', type: String(event.type || 'security_event'), actorId: event.actorId || null, workspaceId: event.workspaceId || null, organizationId: event.organizationId || null, requestId: event.requestId || null, metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {} }
  try { updateAuthorityDb(db => { db.securityEvents = (db.securityEvents || []).concat(row).slice(-10000); return row }) } catch { /* unavailable outside authority context */ }
  return row
}

export function listSecurityEvents(limit = 100) {
  try { const rows = readDb().securityEvents || []; return rows.slice(-Math.max(1, Math.min(1000, Number(limit) || 100))).reverse() } catch { return [] }
}
