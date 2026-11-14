import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'

// The AI gateway signs which model tier the Router may use: users who are not
// subscribed or paying run on the standard tier (Bedrock by default).
const issued = vi.hoisted(() => [])
const store = vi.hoisted(() => ({ db: null }))
// In-memory authority store: the grant issuer reserves usage before signing.
vi.mock('../config/database.js', () => ({
  readAuthorityDb: () => store.db,
  updateAuthorityDb: mutator => mutator(store.db),
  currentDriver: () => 'json',
  currentBoundedDatabase: () => null,
}))
vi.mock('../services/usageGrantService.js', async importOriginal => {
  const actual = await importOriginal()
  return {
    ...actual,
    issueExecutionGrantAsync: vi.fn(async body => {
      issued.push(body)
      return { ok: true, grant: { token: 'grant-token' } }
    }),
  }
})

const { forwardToAiRouter } = await import('../services/aiGatewayService.js')
const { routingTier } = await import('../services/usageGrantService.js')

function response() {
  const res = { statusCode: 0, headers: {}, body: null, writableEnded: false, headersSent: false }
  res.on = () => res
  res.setHeader = (name, value) => { res.headers[name] = value }
  res.status = code => { res.statusCode = code; return res }
  res.send = body => { res.body = body; res.writableEnded = true; return res }
  res.json = body => { res.body = body; res.writableEnded = true; return res }
  res.end = () => res
  return res
}

function request(entitlement) {
  return {
    method: 'POST', url: '/incubation/idea/diagnose', body: { idea: 'x' }, headers: { 'content-type': 'application/json' },
    get: () => undefined, id: 'req-1',
    user: { id: 'user-1', token: 'user-token', workspaceId: 'w-1', accountEntitlement: entitlement },
  }
}

describe('AI gateway routing tier', () => {
  beforeEach(() => {
    issued.length = 0
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, headers: { get: () => 'application/json' }, arrayBuffer: async () => new TextEncoder().encode('{}').buffer })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('signs the standard tier for users without a subscription or purchase', async () => {
    await forwardToAiRouter(request({ active: false, status: 'none' }), response())
    expect(issued[0]).toMatchObject({ routingTier: 'standard', bindTaskType: false })
  })

  it('signs the premium tier for subscribed or paying users', async () => {
    await forwardToAiRouter(request({ active: true, source: 'subscription' }), response())
    expect(issued[0].routingTier).toBe('premium')
  })

  it('treats a missing entitlement as standard', async () => {
    await forwardToAiRouter(request(undefined), response())
    expect(issued[0].routingTier).toBe('standard')
  })

  it('accepts only known tiers', () => {
    expect(routingTier('Standard')).toBe('standard')
    expect(routingTier('premium')).toBe('premium')
    expect(routingTier('gold')).toBeUndefined()
    expect(routingTier(undefined)).toBeUndefined()
  })
})

describe('execution grant routing_tier claim', () => {
  beforeEach(() => {
    store.db = { walletAccounts: [], creditLedger: [], usageEvents: [], usageReservations: [], subscriptions: [] }
    process.env.AI_EXECUTION_GRANT_SECRET = 'tier-test-grant-secret-at-least-32-characters'
  })

  it('is signed into the grant only when it is a known tier', async () => {
    const { issueExecutionGrant } = await vi.importActual('../services/usageGrantService.js')
    const decode = result => jwt.decode(result.grant.token)
    const base = { userId: 'u-tier', taskType: 'chat', estimatedCredits: 1, fundingSource: 'platform_subsidy' }
    const standard = issueExecutionGrant({ ...base, requestId: 'tier-1', routingTier: 'standard' })
    const unknown = issueExecutionGrant({ ...base, requestId: 'tier-2', routingTier: 'gold' })
    expect(decode(standard).routing_tier).toBe('standard')
    expect(decode(unknown).routing_tier).toBeUndefined()
  })
})
