import jwt from 'jsonwebtoken'
import { reserveUsage } from './usageSettlementService.js'

const environment = () => String(process.env.NODE_ENV || process.env.ENVIRONMENT || 'development').toLowerCase()
const production = () => ['production', 'staging'].includes(environment())

/**
 * Mirror the ai-router ExecutionGrantVerifier: RS256 by default in
 * production/staging (verified with the platform JWT public key), HS256 in dev
 * (shared secret). Both sides must agree, so an explicit
 * AI_EXECUTION_GRANT_ALGORITHM on either side overrides the default.
 */
export function executionGrantAlgorithm() {
  return String(process.env.AI_EXECUTION_GRANT_ALGORITHM || (production() ? 'RS256' : 'HS256')).toUpperCase()
}

function grantSigningKey(algorithm) {
  if (algorithm === 'RS256') {
    return (process.env.AI_EXECUTION_GRANT_PRIVATE_KEY || process.env.JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  }
  return process.env.AI_EXECUTION_GRANT_SECRET || process.env.JWT_SECRET || ''
}

export function issueExecutionGrant(body = {}) {
  const userId = String(body.user_id || body.userId || '').trim()
  const requestId = String(body.request_id || body.requestId || '').trim()
  const taskType = String(body.task_type || body.taskType || '').trim()
  const estimatedCredits = Number(body.estimated_credits ?? body.estimatedCredits)
  if (!userId || !requestId || !taskType || !Number.isFinite(estimatedCredits) || estimatedCredits <= 0) return { ok: false, error: 'grant_fields_required' }
  const algorithm = executionGrantAlgorithm()
  const secret = grantSigningKey(algorithm)
  if (!secret) {
    return { ok: false, error: algorithm === 'RS256' ? 'execution_grant_private_key_not_configured' : 'execution_grant_secret_not_configured' }
  }
  const reservation = reserveUsage({
    userId, workspaceId: body.workspace_id || body.workspaceId || null, requestId, taskType,
    estimatedCredits, grantId: requestId, fundingSource: body.funding_source || body.fundingSource || 'payg',
    metadata: body.metadata || {},
  })
  if (!reservation.ok) return reservation
  const expiresIn = Math.max(10, Math.min(900, Number(body.expires_in_seconds || 300)))
  const payload = {
    sub: userId, jti: requestId, request_id: requestId, reservation_id: reservation.reservation.reservationId,
    workspace_id: body.workspace_id || body.workspaceId || null,
    execution_profile: body.execution_profile || body.executionProfile || 'balanced',
    allowed_model_ids: Array.isArray(body.allowed_model_ids || body.allowedModelIds)
      ? (body.allowed_model_ids || body.allowedModelIds).map(String).slice(0, 50)
      : [],
    max_input_tokens: positiveInteger(body.max_input_tokens ?? body.maxInputTokens),
    max_output_tokens: positiveInteger(body.max_output_tokens ?? body.maxOutputTokens),
    max_provider_cost_usd: positiveNumber(body.max_provider_cost_usd ?? body.maxProviderCostUsd),
  }
  // The router validates `task_type` against the concrete task it is about to
  // run, so only bind it when the caller knows the exact router task type.
  // Otherwise the reservation still records the task while the grant is bound
  // to the subject + reservation + expiry only.
  if (body.bind_task_type !== false && body.bindTaskType !== false) payload.task_type = taskType
  const token = jwt.sign(payload, secret, { algorithm, issuer: process.env.AI_EXECUTION_GRANT_ISSUER || 'techit-backend', audience: process.env.AI_EXECUTION_GRANT_AUDIENCE || 'techit-ai-router', expiresIn })
  return { ok: true, idempotent: reservation.idempotent, grant: { token, requestId, reservationId: reservation.reservation.reservationId, expiresIn, reservation: reservation.reservation } }
}

function positiveInteger(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined
}

function positiveNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}
