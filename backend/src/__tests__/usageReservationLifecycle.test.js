import crypto from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../app.js'
import { issueExecutionGrant } from '../services/usageGrantService.js'
import { runBillingJobs } from '../services/billingJobsService.js'
import { reservationHolds, settlementBelongsToReservation } from '../services/usageReservationPolicy.js'

vi.mock('../config/database.js', () => ({ readAuthorityDb: vi.fn(), updateAuthorityDb: vi.fn() }))
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'

const SECRET = 'settlement-test-secret-at-least-32-chars'
let db

function routerSigned(body) {
  const timestamp = Math.floor(Date.now() / 1000)
  return {
    'x-techit-service-id': 'ai-router',
    'x-techit-timestamp': String(timestamp),
    'x-techit-signature': crypto.createHmac('sha256', SECRET).update(`${timestamp}.${JSON.stringify(body)}`).digest('hex'),
  }
}

async function settle(body) {
  return request(app).post('/internal/usage-settlement/settle').set(routerSigned(body)).send(body)
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AI_ROUTER_SETTLEMENT_SECRET = SECRET
  process.env.AI_ROUTER_SERVICE_ID = 'ai-router'
  process.env.AI_EXECUTION_GRANT_SECRET = 'execution-grant-test-secret-at-least-32'
  delete process.env.USAGE_RESERVATION_TTL_SECONDS
  db = { walletAccounts: [{ userId: 'u1', creditBalance: 10 }], creditLedger: [], usageEvents: [], usageReservations: [], subscriptions: [], billingJobRuns: [], marginAlerts: [], workspaceTeamEntitlements: [] }
  readAuthorityDb.mockReturnValue(db)
  updateAuthorityDb.mockImplementation(mutator => mutator(db))
})
afterEach(() => { vi.useRealTimers() })

describe('usage reservation lifecycle', () => {
  it('gives every reservation an expiry so unsettled credits are not locked forever', () => {
    const grant = issueExecutionGrant({ userId: 'u1', requestId: 'r-exp', taskType: 'chat', estimatedCredits: 4 })
    expect(grant.ok).toBe(true)
    expect(Date.parse(db.usageReservations[0].expiresAt)).toBeGreaterThan(Date.now())
  })

  it('stops holding PAYG credits once a reservation expires', () => {
    vi.useFakeTimers({ now: new Date('2026-11-13T00:00:00Z') })
    expect(issueExecutionGrant({ userId: 'u1', requestId: 'r-hold', taskType: 'chat', estimatedCredits: 10 }).ok).toBe(true)
    // Balance 10, all reserved: a second reservation is refused...
    expect(issueExecutionGrant({ userId: 'u1', requestId: 'r-hold-2', taskType: 'chat', estimatedCredits: 1 }).error).toBe('insufficient_credits')
    // ...until the first one expires without ever being settled.
    vi.setSystemTime(new Date('2026-11-13T02:00:00Z'))
    expect(issueExecutionGrant({ userId: 'u1', requestId: 'r-hold-3', taskType: 'chat', estimatedCredits: 1 }).ok).toBe(true)
  })

  it('billing jobs release legacy reservations that were written without an expiry', async () => {
    db.usageReservations.push({ id: 'legacy', reservationId: 'legacy', requestId: 'legacy', userId: 'u1', taskType: 'chat', reservedCredits: 3, fundingSource: 'payg', status: 'reserved', createdAt: '2026-01-01T00:00:00.000Z' })
    const result = await runBillingJobs('test')
    expect(result.results.expiredReservations).toBe(1)
    expect(db.usageReservations[0]).toMatchObject({ status: 'refunded', releasedCredits: 3 })
    expect(reservationHolds(db.usageReservations[0])).toBe(false)
  })
})

describe('gateway settlements', () => {
  function gatewayGrant(requestId = 'gw_1') {
    return issueExecutionGrant({ userId: 'u1', requestId, taskType: 'gateway:incubation', estimatedCredits: 1, fundingSource: 'platform_subsidy', bindTaskType: false })
  }

  it('accepts the concrete Router task type for an unbound gateway reservation', async () => {
    gatewayGrant()
    const res = await settle({ request_id: 'gw_1', user_id: 'u1', task_type: 'market_intelligence', status: 'completed', reservation_id: 'gw_1', provider: 'bedrock', model: 'claude', prompt_tokens: 10, completion_tokens: 5 })
    expect(res.status).toBe(200)
    expect(res.body.usageEvent.taskType).toBe('market_intelligence')
    expect(db.usageReservations[0].status).toBe('settled')
  })

  it('does not debit the user for platform-subsidised executions', async () => {
    gatewayGrant()
    const res = await settle({ request_id: 'gw_1', user_id: 'u1', task_type: 'idea_evaluation', status: 'completed', reservation_id: 'gw_1' })
    expect(res.status).toBe(200)
    expect(res.body.usageEvent).toMatchObject({ credits: 0, subsidizedCredits: 1, fundingSource: 'platform_subsidy' })
    expect(db.creditLedger).toHaveLength(0)
  })

  it('records additional executions under one grant without charging again', async () => {
    issueExecutionGrant({ userId: 'u1', requestId: 'payg_1', taskType: 'gateway:incubation', estimatedCredits: 2, bindTaskType: false })
    const first = await settle({ request_id: 'payg_1', user_id: 'u1', task_type: 'idea_evaluation', status: 'completed', reservation_id: 'payg_1' })
    const second = await settle({ request_id: 'payg_1:2', user_id: 'u1', task_type: 'embeddings', status: 'completed', reservation_id: 'payg_1' })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.body.usageEvent).toMatchObject({ credits: 0, additionalExecution: true, taskType: 'embeddings' })
    expect(db.usageEvents).toHaveLength(2)
    expect(db.creditLedger.reduce((sum, row) => sum + row.deltaCredits, 0)).toBe(-2)
  })

  it('still rejects a settlement that does not belong to the reservation', async () => {
    gatewayGrant()
    const res = await settle({ request_id: 'other-request', user_id: 'u1', task_type: 'chat', status: 'completed', reservation_id: 'gw_1' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('reservation_execution_mismatch')
  })

  it('still binds bound reservations to their task type', async () => {
    issueExecutionGrant({ userId: 'u1', requestId: 'bound_1', taskType: 'chat', estimatedCredits: 1 })
    const res = await settle({ request_id: 'bound_1', user_id: 'u1', task_type: 'business_plan', status: 'completed', reservation_id: 'bound_1' })
    expect(res.status).toBe(409)
  })

  it('records a completed execution without a reservation as unbilled telemetry instead of a permanent rejection', async () => {
    const res = await settle({ request_id: 'worker-1', user_id: 'u1', task_type: 'gsis_compute', status: 'completed' })
    expect(res.status).toBe(200)
    expect(res.body.usageEvent).toMatchObject({ credits: 0, fundingSource: 'unreserved' })
    expect(db.creditLedger).toHaveLength(0)
  })

  it('matches derived sub-request ids to their reservation only', () => {
    expect(settlementBelongsToReservation({ requestId: 'gw_1' }, 'gw_1:3')).toBe(true)
    expect(settlementBelongsToReservation({ requestId: 'gw_1' }, 'gw_10')).toBe(false)
  })
})
