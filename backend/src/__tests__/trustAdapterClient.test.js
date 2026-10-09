import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildTrustAdapterHeaders } from '../services/trustAdapterClient.js'

describe('trust adapter client headers', () => {
  it('always declares backend trust authority', () => {
    const headers = buildTrustAdapterHeaders({ path: '/x', env: {} })
    expect(headers['x-trust-authority']).toBe('backend')
    expect(headers['x-techit-service-id']).toBe('platform-backend')
    expect(headers['x-trust-signature']).toBeUndefined()
  })

  it('signs timestamp.method.path.body when a secret is configured', () => {
    const now = 1_700_000_000_000
    const env = { AI_ROUTER_TRUST_SECRET: 'trust-secret' }
    const headers = buildTrustAdapterHeaders({ method: 'POST', path: '/api/v1/trust/adapters/stripe/verify', rawBody: '{"a":1}', env, now })
    const timestamp = headers['x-trust-timestamp']
    expect(timestamp).toBe(String(Math.floor(now / 1000)))
    const expected = crypto.createHmac('sha256', 'trust-secret').update(`${timestamp}.POST./api/v1/trust/adapters/stripe/verify.{"a":1}`).digest('hex')
    expect(headers['x-trust-signature']).toBe(expected)
  })
})
