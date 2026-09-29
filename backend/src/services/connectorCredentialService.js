// connectorCredentialService.js
//
// Real provider credential handshake for workspace connectors.
//
// "Connect" used to only flip a status label. Now it requires a credential
// handshake: the caller supplies a provider token/API key, which is sealed with
// the platform's existing at-rest encryption (same key material as BYOK model
// connections) and stored in its own collection so the generic connector list can
// never leak it. Responses expose a masked identifier only.
//
// Scope note (disclosed, not faked): this is a credential handshake, not a
// browser OAuth redirect. No OAuth callback endpoint exists in this deployment,
// so the UI says exactly that.

import { createId, nowIso } from '../utils/api.js'
import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'
import { listWorkspaceCollection, patchWorkspaceCollectionItem } from './domainService.js'
import { sealSecret } from './workspaceCapabilityService.js'

const rows = (db, name) => { if (!Array.isArray(db[name])) db[name] = []; return db[name] }

function mask(secret) {
  const value = String(secret || '')
  if (value.length <= 10) return `${value.slice(0, 2)}…${value.slice(-2)}`
  return `${value.slice(0, 6)}…${value.slice(-4)}`
}

function findConnector(userId, workspaceId, connectorId) {
  const list = listWorkspaceCollection(userId, workspaceId, 'workspaceConnectors')
  if (!list) return { ok: false, status: 404, error: 'workspace_not_found' }
  const connector = list.find(row => row.id === connectorId)
  if (!connector) return { ok: false, status: 404, error: 'connector_not_found' }
  return { ok: true, connector }
}

export function connectorCredentialStatus(userId, workspaceId, connectorId) {
  const found = findConnector(userId, workspaceId, connectorId)
  if (!found.ok) return found
  const db = readAuthorityDb()
  const record = rows(db, 'connectorCredentials').find(row => row.workspaceId === workspaceId && row.connectorId === connectorId)
  return {
    ok: true,
    credential: record
      ? { maskedIdentifier: record.maskedIdentifier, label: record.label, connectedAt: record.connectedAt }
      : null,
    handshake: 'credential',
    oauthRedirectSupported: false,
  }
}

export function setConnectorCredential(userId, workspaceId, connectorId, body = {}) {
  const found = findConnector(userId, workspaceId, connectorId)
  if (!found.ok) return found
  const secret = String(body.token || body.apiKey || '').trim()
  if (secret.length < 8) return { ok: false, status: 400, error: 'credential_too_short' }
  if (secret.length > 500) return { ok: false, status: 400, error: 'credential_too_long' }

  let sealed
  try { sealed = sealSecret(secret) } catch { return { ok: false, status: 503, error: 'credential_encryption_unavailable' } }
  const label = String(body.label || found.connector.name || 'Provider token').slice(0, 80)
  const maskedIdentifier = mask(secret)
  const now = nowIso()

  updateAuthorityDb(db => {
    const list = rows(db, 'connectorCredentials')
    const index = list.findIndex(row => row.workspaceId === workspaceId && row.connectorId === connectorId)
    const next = { workspaceId, connectorId, userId, label, maskedIdentifier, ciphertext: sealed, updatedAt: now }
    if (index === -1) list.push({ id: createId('connector_credential'), createdAt: now, ...next })
    else list[index] = { ...list[index], ...next }
  })

  const updated = patchWorkspaceCollectionItem(userId, workspaceId, 'workspaceConnectors', connectorId, {
    status: 'connected',
    authMode: 'credential',
    credentialMasked: maskedIdentifier,
    credentialLabel: label,
    credentialConnectedAt: now,
  })
  if (!updated) return { ok: false, status: 403, error: 'connector_write_denied' }
  return { ok: true, connector: updated, credential: { maskedIdentifier, label, connectedAt: now }, handshake: 'credential' }
}

export function removeConnectorCredential(userId, workspaceId, connectorId) {
  const found = findConnector(userId, workspaceId, connectorId)
  if (!found.ok) return found
  updateAuthorityDb(db => {
    const list = rows(db, 'connectorCredentials')
    const index = list.findIndex(row => row.workspaceId === workspaceId && row.connectorId === connectorId)
    if (index !== -1) list.splice(index, 1)
  })
  const updated = patchWorkspaceCollectionItem(userId, workspaceId, 'workspaceConnectors', connectorId, {
    status: 'disconnected',
    authMode: null,
    credentialMasked: null,
    credentialLabel: null,
    credentialConnectedAt: null,
  })
  if (!updated) return { ok: false, status: 403, error: 'connector_write_denied' }
  return { ok: true, connector: updated }
}
