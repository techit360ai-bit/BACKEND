import { reserveUsage, settleUsage, usageSettlementHealth } from '../services/usageSettlementService.js'

export function usageReserve(req, res) {
  const result = reserveUsage(req.body || {})
  const status = result.ok ? (result.idempotent ? 200 : 201)
    : ['insufficient_credits', 'subscription_allowance_exhausted'].includes(result.error) ? 402
      : result.error === 'request_id_reservation_conflict' ? 409 : 400
  return res.status(status).json(result)
}

export function usageSettle(req, res) {
  const result = settleUsage(req.body || {})
  return res.status(result.ok ? 200 : [
    'request_id_payload_conflict', 'reservation_execution_mismatch', 'reservation_grant_mismatch',
  ].includes(result.error) ? 409 : 400).json(result)
}

export function usageHealth(_req, res) {
  return res.json(usageSettlementHealth())
}
