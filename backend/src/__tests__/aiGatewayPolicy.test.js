import { describe, it, expect } from 'vitest'
import { gatewayPrefixes, resolveGatewayTarget } from '../services/aiGatewayPolicy.js'

describe('ai gateway policy', () => {
  it('allows listed prefixes and keeps the query string', () => {
    expect(resolveGatewayTarget('GET', '/incubation/validate/sessions?limit=5')).toEqual({ ok: true, path: '/api/v1/incubation/validate/sessions', query: 'limit=5' })
  })
  it('blocks admin and unknown prefixes', () => {
    expect(resolveGatewayTarget('GET', '/admin/monitor/scan').status).toBe(404)
    expect(resolveGatewayTarget('GET', '/').status).toBe(404)
  })
  it('rejects traversal and encoded separators', () => {
    for (const url of ['/incubation/../admin/x', '/incubation/%2e%2e/admin', '/incubation//x', '/incubation/a%2Fb', '/incubation\\x']) {
      expect(resolveGatewayTarget('GET', url).status).toBe(400)
    }
  })
  it('rejects unsupported methods', () => {
    expect(resolveGatewayTarget('TRACE', '/incubation/x').status).toBe(405)
  })
  it('honours AI_GATEWAY_ALLOWED_PREFIXES', () => {
    const env = { AI_GATEWAY_ALLOWED_PREFIXES: 'trust, bad/prefix' }
    expect([...gatewayPrefixes(env)]).toEqual(['trust'])
    expect(resolveGatewayTarget('GET', '/incubation/x', env).status).toBe(404)
  })
})
