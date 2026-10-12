// Row-level GitHub connector store (§5 cutover).
//
// The connect/trust OAuth flow writes a short-lived oauth state and the caller's
// connector token; status/repos read that connector. All of it used to come from
// the whole-DB snapshot. This repository keeps the state and connector rows
// per-user with bounded queries. Gated by GITHUB_SOURCE=postgres; fallback
// GITHUB_FALLBACK_SQLITE keeps the snapshot until the authority is deleted.
import { withPlatformTransaction, getRecord, listRecords, listRecordsForOwner, listRecordsByField, upsertRecord, deleteRecord, deleteRecordsForOwner } from './platformCollectionRepository.js'

export function githubStoreEnabled() {
  return process.env.GITHUB_SOURCE === 'postgres' || process.env.GITHUB_READ_SOURCE === 'postgres' || process.env.GITHUB_WRITE_SOURCE === 'postgres'
}
export function githubFallbackEnabled() { return process.env.GITHUB_FALLBACK_SQLITE !== 'false' }

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

export async function loadGithubConnection(userId) {
  return withPlatformTransaction(async client => {
    const rows = await listRecordsForOwner(client, 'githubConnections', userId, { ownerFields: ['userId'] })
    return rows[0] || null
  }, { userId })
}

export async function saveGithubConnection(connection) {
  return withPlatformTransaction(async client => {
    // One connector per user: the snapshot replaced the previous row.
    await deleteRecordsForOwner(client, 'githubConnections', connection.userId, { ownerFields: ['userId'] })
    await upsertRecord(client, 'githubConnections', connection, { operation: 'insert', idempotencyKey: `${connection.id}:insert` })
  }, { userId: connection.userId })
}

export async function saveGithubOauthState(row) {
  return withPlatformTransaction(async client => {
    const cutoff = Date.now() - OAUTH_STATE_TTL_MS
    for (const entry of await listRecords(client, 'githubOauthStates')) {
      if (new Date(entry.createdAt).getTime() < cutoff) await deleteRecord(client, 'githubOauthStates', entry.id)
    }
    await upsertRecord(client, 'githubOauthStates', row, { operation: 'insert', idempotencyKey: `${row.id}:insert` })
  }, { userId: row.userId })
}

// Single-use consumption: prune expired states, find the matching one and delete
// it before the (slow) external token exchange so a racing callback cannot replay.
export async function consumeGithubOauthState(state) {
  return withPlatformTransaction(async client => {
    const cutoff = Date.now() - OAUTH_STATE_TTL_MS
    const rows = await listRecordsByField(client, 'githubOauthStates', 'state', state)
    const entry = rows.find(row => new Date(row.createdAt).getTime() > cutoff)
    if (!entry) return null
    await deleteRecord(client, 'githubOauthStates', entry.id)
    return entry
  })
}

export async function loadProfileWorkspaceId(userId) {
  return withPlatformTransaction(async client => {
    const profile = await getRecord(client, 'profiles', userId)
    return profile?.workspaceId || null
  }, { userId })
}
