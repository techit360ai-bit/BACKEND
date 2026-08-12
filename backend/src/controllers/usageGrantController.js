import { issueExecutionGrant } from '../services/usageGrantService.js'

export function usageGrantIssue(req, res) {
  const result = issueExecutionGrant(req.body || {})
  const status = result.ok ? (result.idempotent ? 200 : 201)
    : ['insufficient_credits', 'subscription_allowance_exhausted'].includes(result.error) ? 402
      : result.error === 'request_id_reservation_conflict' ? 409 : 400
  return res.status(status).json(result)
}
