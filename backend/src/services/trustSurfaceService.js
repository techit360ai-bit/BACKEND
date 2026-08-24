import { createId, nowIso } from '../utils/api.js'
import { readDb, updateDb } from '../config/database.js'
import { ensureTrustProfile } from './capabilityAuthorization.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
const sourceCatalog = [
  ['email', 'Email', 'email_domain'], ['phone', 'Phone', 'manual'], ['github', 'GitHub', 'professional_profile'],
  ['linkedin', 'LinkedIn', 'professional_profile'], ['domain', 'Domain', 'dns'], ['website', 'Website', 'public_evidence'],
  ['organization', 'Organization', 'organization_affiliation'], ['deployment', 'Deployment', 'public_evidence'],
  ['product_analytics', 'Product activity', 'public_evidence'], ['team', 'Team', 'manual'], ['milestone', 'Milestone', 'manual'],
]

function eventFor(db, userId, source, status, metadata = {}) {
  const createdAt = nowIso()
  const event = { id: createId('trust_event'), verification_id: createId('trust_verification'), userId, source, status, event_type: `trust_${status}`, metadata_hash: createId('trust_hash'), created_at: createdAt, metadata }
  rows(db, 'trustVerificationHistory').push(event)
  return event
}

export function trustSurfaceProfile(userId) {
  const db = readDb(); const trust = rows(db, 'trustProfiles').find(row => row.userId === userId) || ensureTrustProfile(db, userId)
  return { verification_status: String(trust?.assurance || 'unverified').toLowerCase(), trust_score: Number(trust?.trustScore || 0), tier: trust?.assurance || 'CLAIMED', confidence_score: Number(trust?.trustScore || 0), badges: trust?.badges || [], signals: trust?.signals || [], breakdown: trust?.breakdown || {}, last_sync_at: trust?.updatedAt || null, privacy: { metadata_only: true, raw_payload_stored: false, secrets_stored: false, history_append_only: true } }
}

export function trustSurfaceBadges(userId) {
  const db = readDb(); const trust = rows(db, 'trustProfiles').find(row => row.userId === userId)
  const history = rows(db, 'trustVerificationHistory').filter(row => row.userId === userId && row.status === 'verified')
  const badges = [...new Map(history.map(row => [row.source, { badge_type: `verified_${row.source}`, label: `${row.source} verified`, source: row.source, status: 'verified', issued_at: row.created_at, active: true }])).values()]
  return { badges: badges.length ? badges : (trust?.badges || []).map(label => ({ badge_type: String(label), label: String(label), source: 'trust', status: 'verified', active: true })), active_badges: badges.map(item => item.label), privacy: 'metadata_only' }
}

export function trustSurfaceHistory(userId, limit = 25) {
  const db = readDb(); const history = rows(db, 'trustVerificationHistory').filter(row => row.userId === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, Math.min(100, Math.max(1, Number(limit) || 25)))
  return { history, append_only: true, privacy: 'metadata_only' }
}

export function trustSurfaceIntegrations(userId) {
  const db = readDb(); const history = rows(db, 'trustVerificationHistory').filter(row => row.userId === userId)
  return { integrations: sourceCatalog.map(([source, display_name, auth_method]) => ({ provider: source, source, display_name, auth_method, scopes: [], sync_frequency_seconds: 86400, stored_fields: ['status', 'metadata_hash', 'timestamps'], forbidden_fields: ['tokens', 'raw_payload'], access_description: 'Metadata-only verification source.', storage_description: 'Only verification metadata and hashes are retained.', token_policy: 'No provider secrets are persisted.', revocation_supported: true, manual_reverification_supported: true, raw_payload_stored: false, connected: history.some(row => row.source === source && row.status === 'verified') })) }
}

export function refreshTrustSurface(userId, source, status = 'verified') {
  return updateDb(db => { const event = eventFor(db, userId, source, status); ensureTrustProfile(db, userId); return { source, status, confidence: status === 'verified' ? 0.8 : 0.2, metadata_hash: event.metadata_hash, raw_payload_stored: false, persisted: true, next_action: status === 'verified' ? 'Verification metadata recorded.' : 'Reconnect this source to verify again.', verification: event } })
}

export function previewTrustSurfaceNotifications(userId) {
  const { history } = trustSurfaceHistory(userId, 100)
  const notification_intents = history.filter(row => ['expired', 'failed', 'disconnected'].includes(row.status)).map(row => ({ notification_id: row.id, notification_type: row.event_type, source: row.source, severity: row.status === 'expired' ? 'critical' : 'warning', message: `${row.source} verification ${row.status}.`, action_required: true, created_at: row.created_at, founder_visible: true, investor_visible: false, raw_payload_stored: false }))
  return { notification_intents, summary: { events_seen: history.length, notifications_prepared: notification_intents.length }, privacy: { metadata_only: true }, owner_ids_exposed_to_investors: false }
}
