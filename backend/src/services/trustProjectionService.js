import crypto from 'node:crypto'
import * as database from '../config/database.js'
const readAuthorityDb = (...args) => database.readDb(...args)
const updateAuthorityDb = mutator => { try { if (typeof database.updateDb === 'function') return database.updateDb(mutator) } catch {} return mutator(database.readDb()) }
import { safeFetch } from './outboundHttpService.js'
import { incTrustMetric, observeTrustLatency } from './trustMetrics.js'

const endpoint = () => process.env.TRUST_PROJECTION_URL || (process.env.AI_ROUTER_URL ? `${process.env.AI_ROUTER_URL.replace(/\/$/, '')}/internal/trust/projection` : '')
const secret = () => process.env.TRUST_PROJECTION_SECRET || ''

function signedBody(body) {
  const raw = JSON.stringify(body); const timestamp = String(Math.floor(Date.now() / 1000)); const signature = crypto.createHmac('sha256', secret()).update(`${timestamp}.${raw}`).digest('hex'); return { raw, timestamp, signature }
}

export function projectionPayload(db, userId, projectId = null) {
  const proofs = (db.trustVerificationProofs || []).filter(row => row.userId === userId && (!projectId || row.projectId == null || row.projectId === projectId) && row.status === 'verified' && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now()))
  const skills = (db.verifiedSkills || []).filter(row => row.userId === userId && row.status === 'verified' && (!projectId || row.projectId == null || row.projectId === projectId) && (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now())).map(row => ({ skill: row.skill, source: row.source, confidence: row.confidence, expiresAt: row.expiresAt }))
  const github = proofs.find(row => row.source === 'github')
  const has = source => proofs.some(row => row.source === source)
  const trust = (db.trustProfiles || []).find(row => row.userId === userId)
  return { userId, projectId, profile: { email_verified: has('email'), phone_verified: has('phone'), github_connected: has('github'), linkedin_connected: has('linkedin'), domain_verified: has('domain') || has('website'), organization_verified: has('organization'), deployment_live: has('deployment'), product_activity_verified: has('product_analytics'), team_verified_count: proofs.filter(row => row.source === 'team').reduce((sum, row) => sum + Number(row.metadata?.verifiedCount || row.metadata?.count || 1), 0), milestone_count: proofs.filter(row => row.source === 'milestone').reduce((sum, row) => sum + Number(row.metadata?.count || 1), 0), deployments_30d: Number(proofs.find(row => row.source === 'deployment')?.metadata?.deployments30d || 0), mau: Number(proofs.find(row => row.source === 'product_analytics')?.metadata?.mau || 0), dau: Number(proofs.find(row => row.source === 'product_analytics')?.metadata?.dau || 0), github_repo_count: Number(github?.metadata?.repoCount || 0), github_commit_count: Number(github?.metadata?.commitCount || 0), github_contributor_count: Number(github?.metadata?.contributorCount || 0), verifiedSkills: skills, proof_count: proofs.length, client_score: trust?.trustScore || 0 }, proofs: proofs.map(row => ({ id: row.id, source: row.source, method: row.method, status: row.status, confidence: row.confidence, evidenceHash: row.evidenceHash, expiresAt: row.expiresAt })) }
}

// Sign + POST an already-built projection payload. Shared by the legacy
// snapshot path and the repository-backed outbox worker (WS9).
export async function postTrustProjection(body) {
  const url = endpoint(); if (!url || !secret()) return { enabled: false }
  const signed = signedBody(body)
  const startedAt = Date.now()
  try {
    const target = new URL(url)
    const response = await safeFetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-trust-timestamp': signed.timestamp, 'x-trust-signature': signed.signature }, body: signed.raw }, { schemes: process.env.NODE_ENV === 'production' ? ['https'] : ['http', 'https'], allowHosts: [target.hostname] })
    if (!response.ok) throw new Error(`trust_projection_${response.status}`)
    incTrustMetric('trust_projection_delivered_total')
    observeTrustLatency('trust_projection_ms', Date.now() - startedAt)
    return { enabled: true, delivered: true }
  } catch (error) {
    incTrustMetric('trust_projection_failed_total', { reason: String(error.message || 'error').slice(0, 60) })
    observeTrustLatency('trust_projection_ms', Date.now() - startedAt)
    return { enabled: true, delivered: false, error: error.message }
  }
}

export async function publishTrustProjection(userId, projectId = null) {
  const url = endpoint(); if (!url || !secret()) return { enabled: false }
  const db = readAuthorityDb(); const body = projectionPayload(db, userId, projectId)
  const result = await postTrustProjection(body)
  if (result.enabled && result.delivered) {
    updateAuthorityDb(state => { for (const row of state.trustProjectionOutbox || []) if (row.userId === userId && row.projectId === projectId && !row.deliveredAt) row.deliveredAt = new Date().toISOString(); return state })
    if (!projectId) {
      const projectIds = (db.projects || []).filter(row => row.ownerId === userId || row.creatorId === userId || row.founderId === userId).map(row => row.id).filter(Boolean)
      for (const id of projectIds) await publishTrustProjection(userId, id)
    }
  }
  return result
}

export async function flushTrustProjectionOutbox(limit = 20) {
  const db = readAuthorityDb(); const pending = (db.trustProjectionOutbox || []).filter(row => !row.deliveredAt).slice(0, limit); const results = []
  for (const row of pending) results.push(await publishTrustProjection(row.userId, row.projectId || null))
  return { attempted: pending.length, results }
}
