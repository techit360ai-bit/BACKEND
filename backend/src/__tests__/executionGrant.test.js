import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

vi.mock('../services/usageSettlementService.js', () => ({ reserveUsage: vi.fn(() => ({ ok: true, reservation: { reservationId: 'res-1' } })) }))
import { reserveUsage } from '../services/usageSettlementService.js'
import { executionGrantAlgorithm, issueExecutionGrant } from '../services/usageGrantService.js'

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const ENV_KEYS = ['NODE_ENV', 'ENVIRONMENT', 'AI_EXECUTION_GRANT_ALGORITHM', 'AI_EXECUTION_GRANT_PRIVATE_KEY', 'JWT_PRIVATE_KEY', 'AI_EXECUTION_GRANT_SECRET', 'JWT_SECRET']
let saved
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
})
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('execution grant algorithm alignment with ai-router', () => {
  it('defaults to RS256 in production/staging and HS256 in dev', () => {
    process.env.NODE_ENV = 'production'
    expect(executionGrantAlgorithm()).toBe('RS256')
    process.env.NODE_ENV = 'development'
    expect(executionGrantAlgorithm()).toBe('HS256')
  })

  it('honours an explicit AI_EXECUTION_GRANT_ALGORITHM on both sides', () => {
    process.env.NODE_ENV = 'production'
    process.env.AI_EXECUTION_GRANT_ALGORITHM = 'HS256'
    expect(executionGrantAlgorithm()).toBe('HS256')
  })

  it('signs RS256 with the platform private key when production defaults apply', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_PRIVATE_KEY = privateKey
    const result = issueExecutionGrant({ userId: 'u1', requestId: 'r1', taskType: 'gsis_compute', estimatedCredits: 1 })
    expect(result.ok).toBe(true)
    const decoded = jwt.verify(result.grant.token, publicKey, { algorithms: ['RS256'] })
    expect(decoded.sub).toBe('u1')
    expect(decoded.task_type).toBe('gsis_compute')
  })

  it('omits the task_type binding when the caller does not know the router task', () => {
    process.env.NODE_ENV = 'production'
    process.env.JWT_PRIVATE_KEY = privateKey
    const result = issueExecutionGrant({ userId: 'u1', requestId: 'r2', taskType: 'router_enrichment', estimatedCredits: 1, bindTaskType: false })
    expect(result.ok).toBe(true)
    expect(jwt.decode(result.grant.token).task_type).toBeUndefined()
    expect(reserveUsage).toHaveBeenCalled()
  })

  it('fails closed when RS256 is required but no private key is configured', () => {
    process.env.NODE_ENV = 'production'
    const result = issueExecutionGrant({ userId: 'u1', requestId: 'r3', taskType: 'gsis_compute', estimatedCredits: 1 })
    expect(result).toMatchObject({ ok: false, error: 'execution_grant_private_key_not_configured' })
  })
})
