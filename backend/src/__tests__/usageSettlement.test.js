import crypto from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import app from '../app.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn() }))
import { readDb, updateDb } from '../config/database.js'

const SECRET = 'settlement-test-secret-at-least-32-chars'
function makeDb() {
  return { walletAccounts: [{ userId: 'u1', creditBalance: 100 }], creditLedger: [], usageEvents: [], usageReservations: [], subscriptions: [] }
}
function signed(body, timestamp = Math.floor(Date.now() / 1000), serviceId = 'ai-router', secret = SECRET) {
  return {
    'x-techit-service-id': serviceId,
    'x-techit-timestamp': String(timestamp),
    'x-techit-signature': crypto.createHmac('sha256', secret).update(`${timestamp}.${JSON.stringify(body)}`).digest('hex'),
  }
}

function grantSigned(body, timestamp = Math.floor(Date.now() / 1000)) {
  return signed(body, timestamp, 'platform-backend', 'grant-service-secret-at-least-32-chars')
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AI_ROUTER_SETTLEMENT_SECRET = SECRET
  process.env.AI_ROUTER_SERVICE_ID = 'ai-router'
  process.env.AI_USAGE_GRANT_SERVICE_ID = 'platform-backend'
  process.env.AI_USAGE_GRANT_SERVICE_SECRET = 'grant-service-secret-at-least-32-chars'
  const db = makeDb()
  readDb.mockReturnValue(db)
  updateDb.mockImplementation(mutator => mutator(db))
})

describe('usage settlement service contract', () => {
  it('rejects unsigned Router settlement calls', async () => {
    const res = await request(app).post('/internal/usage-settlement/settle').send({ request_id: 'r1' })
    expect(res.status).toBe(401)
  })

  it('does not allow the Router settlement credential to issue grants', async () => {
    const body = { userId: 'u1', requestId: 'router-cannot-grant', taskType: 'chat', estimatedCredits: 1 }
    const res = await request(app).post('/internal/usage-settlement/grant').set(signed(body)).send(body)
    expect(res.status).toBe(401)
    expect(readDb().usageReservations).toHaveLength(0)
  })

  it('reserves atomically and settles idempotently', async () => {
    const reserveBody = { userId: 'u1', workspaceId: 'w1', requestId: 'r1', taskType: 'chat', estimatedCredits: 12 }
    const reserve = await request(app).post('/internal/usage-settlement/reserve').set(grantSigned(reserveBody)).send(reserveBody)
    expect(reserve.status).toBe(201)
    expect(reserve.body.reservation.reservedCredits).toBe(12)

    const settleBody = {
      request_id: 'r1', user_id: 'u1', workspace_id: 'w1', task_type: 'chat',
      provider: 'openai', model: 'gpt-test', status: 'completed', prompt_tokens: 10,
      completion_tokens: 5, total_tokens: 15, provider_cost_usd: 0.01,
      reservation_id: 'r1', metadata: { settled_credits: 9, total_cogs: 0.012, customer_price: 0.03, gross_margin: 0.6 },
    }
    const settled = await request(app).post('/internal/usage-settlement/settle').set(signed(settleBody)).send(settleBody)
    const replay = await request(app).post('/internal/usage-settlement/settle').set(signed(settleBody)).send(settleBody)
    expect(settled.status).toBe(200)
    expect(settled.body.idempotent).toBe(false)
    expect(settled.body.usageEvent.credits).toBe(12)
    expect(settled.body.usageEvent.customerPrice).toBe(0)
    expect(settled.body.usageEvent.totalCogs).toBe(0.01)
    expect(settled.body.usageEvent.grossMargin).toBe(0)
    expect(settled.body.reservation.releasedCredits).toBe(0)
    expect(replay.body.idempotent).toBe(true)
    expect(readDb().usageEvents).toHaveLength(1)
    expect(readDb().creditLedger).toHaveLength(1)
  })

  it('rejects conflicting payloads for an existing request id', async () => {
    const first = { request_id: 'r2', user_id: 'u1', task_type: 'summary', status: 'failed' }
    await request(app).post('/internal/usage-settlement/settle').set(signed(first)).send(first)
    const changed = { ...first, status: 'cancelled' }
    const res = await request(app).post('/internal/usage-settlement/settle').set(signed(changed)).send(changed)
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('request_id_payload_conflict')
  })

  it('atomically reserves allowance and returns a signed Router execution grant', async () => {
    process.env.AI_EXECUTION_GRANT_SECRET = 'execution-grant-test-secret-at-least-32'
    const body = { userId: 'u1', workspaceId: 'w1', requestId: 'r-grant', taskType: 'chat', estimatedCredits: 5, maxOutputTokens: 500 }
    const res = await request(app).post('/internal/usage-settlement/grant').set(grantSigned(body)).send(body)
    expect(res.status).toBe(201)
    expect(res.body.grant.token).toBeTruthy()
    expect(res.body.grant.reservationId).toBe('r-grant')
    expect(readDb().usageReservations).toHaveLength(1)
  })

  it('rejects reservation identity mismatches and invalid funding sources', async () => {
    const invalid = { userId: 'u1', requestId: 'bad-source', taskType: 'chat', estimatedCredits: 1, fundingSource: 'automatic' }
    const invalidRes = await request(app).post('/internal/usage-settlement/reserve').set(grantSigned(invalid)).send(invalid)
    expect(invalidRes.status).toBe(400)
    expect(invalidRes.body.error).toBe('invalid_funding_source')

    const reserveBody = { userId: 'u1', workspaceId: 'w1', requestId: 'r-mismatch', taskType: 'chat', estimatedCredits: 2 }
    await request(app).post('/internal/usage-settlement/reserve').set(grantSigned(reserveBody)).send(reserveBody)
    const settleBody = {
      request_id: 'r-mismatch', user_id: 'u2', workspace_id: 'w1', task_type: 'chat',
      status: 'completed', reservation_id: 'r-mismatch',
    }
    const mismatch = await request(app).post('/internal/usage-settlement/settle').set(signed(settleBody)).send(settleBody)
    expect(mismatch.status).toBe(409)
    expect(mismatch.body.error).toBe('reservation_execution_mismatch')
    expect(readDb().usageEvents).toHaveLength(0)
    expect(readDb().creditLedger).toHaveLength(0)
  })

  it('rejects an idempotency-key replay with different reservation terms', async () => {
    const first = { userId: 'u1', workspaceId: 'w1', requestId: 'r-reserve', taskType: 'chat', estimatedCredits: 2 }
    await request(app).post('/internal/usage-settlement/reserve').set(grantSigned(first)).send(first)
    const changed = { ...first, estimatedCredits: 3 }
    const replay = await request(app).post('/internal/usage-settlement/reserve').set(grantSigned(changed)).send(changed)
    expect(replay.status).toBe(409)
    expect(replay.body.error).toBe('request_id_reservation_conflict')
    expect(readDb().usageReservations).toHaveLength(1)
  })

  it('keeps PAYG and capped-subscription reservations strictly separated', async () => {
    readDb().subscriptions.push({ userId: 'u1', status: 'active', includedCredits: 10 })
    const subscription = { userId: 'u1', requestId: 'sub-1', taskType: 'chat', estimatedCredits: 8, fundingSource: 'subscription' }
    const subscriptionRes = await request(app).post('/internal/usage-settlement/reserve').set(grantSigned(subscription)).send(subscription)
    expect(subscriptionRes.status).toBe(201)

    const payg = { userId: 'u1', requestId: 'payg-1', taskType: 'chat', estimatedCredits: 95, fundingSource: 'payg' }
    const paygRes = await request(app).post('/internal/usage-settlement/reserve').set(grantSigned(payg)).send(payg)
    expect(paygRes.status).toBe(201)

    const exhausted = { userId: 'u1', requestId: 'sub-2', taskType: 'chat', estimatedCredits: 3, fundingSource: 'subscription' }
    const exhaustedRes = await request(app).post('/internal/usage-settlement/reserve').set(grantSigned(exhausted)).send(exhausted)
    expect(exhaustedRes.status).toBe(402)
    expect(exhaustedRes.body.error).toBe('subscription_allowance_exhausted')
  })
})
