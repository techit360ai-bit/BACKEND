import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'

vi.mock('../config/database.js', () => ({ readAuthorityDb: vi.fn(), updateAuthorityDb: vi.fn(), currentDriver: () => 'json', currentBoundedDatabase: () => null }))
import { readAuthorityDb, updateAuthorityDb } from '../config/database.js'
import { requestSupportIntelligence } from '../services/aiRouterClient.js'

describe('backend -> AI router retries', () => {
  let db
  beforeEach(() => {
    db = { walletAccounts: [], creditLedger: [], usageEvents: [], usageReservations: [], subscriptions: [] }
    readAuthorityDb.mockReturnValue(db)
    updateAuthorityDb.mockImplementation(mutator => mutator(db))
    process.env.AI_EXECUTION_GRANT_SECRET = 'retry-test-grant-secret-at-least-32-characters'
    process.env.AI_ROUTER_ATTACH_EXECUTION_GRANT = 'true'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.AI_ROUTER_ATTACH_EXECUTION_GRANT
  })

  it('sends a fresh execution grant on every attempt (a reused grant is rejected as a replay)', async () => {
    const grants = []
    const fetchMock = vi.fn(async (_url, init) => {
      grants.push(init.headers['X-AI-Execution-Grant'])
      if (grants.length === 1) return { ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) }
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ answer: 'ok' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const token = jwt.sign({ sub: 'user-retry' }, 'any-signing-key')
    const result = await requestSupportIntelligence(token, { question: 'help' })
    expect(result).toEqual({ answer: 'ok' })
    expect(grants).toHaveLength(2)
    expect(grants[0]).toBeTruthy()
    expect(grants[1]).toBeTruthy()
    expect(grants[1]).not.toBe(grants[0])
    expect(db.usageReservations).toHaveLength(2)
  })
})
