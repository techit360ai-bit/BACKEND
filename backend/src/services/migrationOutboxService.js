import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'

export function recordMigrationEvent(db, { domain, aggregateType, aggregateId, operation, payload = {}, version = 1 }) {
  if (!db.migrationOutbox) db.migrationOutbox = []
  const event = { id: createId('migration_event'), domain: String(domain), aggregateType: String(aggregateType), aggregateId: String(aggregateId), operation: String(operation), version: Number(version), payload, status: 'pending', attempts: 0, createdAt: nowIso(), processedAt: null, lastError: null }
  db.migrationOutbox.push(event)
  return event
}

export function pendingMigrationEvents({ domain, limit = 100 } = {}) {
  return (readAuthorityDb().migrationOutbox || []).filter(event => event.status === 'pending' && (!domain || event.domain === domain)).slice(0, Math.max(1, Number(limit) || 100))
}

export function markMigrationEvent(eventId, { status = 'processed', error = null } = {}) {
  return updateAuthorityDb(db => {
    const event = (db.migrationOutbox || []).find(row => row.id === eventId)
    if (!event) return false
    event.status = status
    event.attempts = Number(event.attempts || 0) + 1
    event.lastError = error ? String(error).slice(0, 1000) : null
    event.processedAt = status === 'processed' ? nowIso() : null
    return true
  })
}

export function outboxStats() {
  return (readAuthorityDb().migrationOutbox || []).reduce((result, event) => { result[event.status] = Number(result[event.status] || 0) + 1; return result }, {})
}
