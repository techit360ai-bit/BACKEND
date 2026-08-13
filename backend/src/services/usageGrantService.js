import jwt from 'jsonwebtoken'
import { reserveUsage } from './usageSettlementService.js'

export function issueExecutionGrant(body = {}) {
  const userId = String(body.user_id || body.userId || '').trim()
  const requestId = String(body.request_id || body.requestId || '').trim()
  const taskType = String(body.task_type || body.taskType || '').trim()
  const estimatedCredits = Number(body.estimated_credits ?? body.estimatedCredits)
  if (!userId || !requestId || !taskType || !Number.isFinite(estimatedCredits) || estimatedCredits <= 0) return { ok: false, error: 'grant_fields_required' }
  const secret = process.env.AI_EXECUTION_GRANT_SECRET || process.env.JWT_SECRET || ''
  if (!secret) return { ok: false, error: 'execution_grant_secret_not_configured' }
  const reservation = reserveUsage({
    userId, workspaceId: body.workspace_id || body.workspaceId || null, requestId, taskType,
    estimatedCredits, grantId: requestId, fundingSource: body.funding_source || body.fundingSource || 'payg',
    metadata: body.metadata || {},
  })
  if (!reservation.ok) return reservation
  const expiresIn = Math.max(10, Math.min(900, Number(body.expires_in_seconds || 300)))
  const payload = {
    sub: userId, jti: requestId, request_id: requestId, reservation_id: reservation.reservation.reservationId,
    workspace_id: body.workspace_id || body.workspaceId || null, task_type: taskType,
    execution_profile: body.execution_profile || body.executionProfile || 'balanced',
    allowed_model_ids: Array.isArray(body.allowed_model_ids || body.allowedModelIds)
      ? (body.allowed_model_ids || body.allowedModelIds).map(String).slice(0, 50)
      : [],
    max_input_tokens: positiveInteger(body.max_input_tokens ?? body.maxInputTokens),
    max_output_tokens: positiveInteger(body.max_output_tokens ?? body.maxOutputTokens),
    max_provider_cost_usd: positiveNumber(body.max_provider_cost_usd ?? body.maxProviderCostUsd),
  }
  const token = jwt.sign(payload, secret, { algorithm: process.env.AI_EXECUTION_GRANT_ALGORITHM || 'HS256', issuer: process.env.AI_EXECUTION_GRANT_ISSUER || 'techit-backend', audience: process.env.AI_EXECUTION_GRANT_AUDIENCE || 'techit-ai-router', expiresIn })
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
