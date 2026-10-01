import { beforeEach, describe, expect, it, vi } from 'vitest'

const del = vi.fn(async () => 1)
const scanIterator = vi.fn(() => (async function* () { yield 'techit:discovery:recommendations:u1:feed:people:4' })())

vi.mock('redis', () => ({
  createClient: () => ({
    on() {},
    connect: async () => {},
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del,
    scanIterator,
    lPush: vi.fn(async () => 1),
    brPop: vi.fn(async () => null),
  }),
}))

process.env.DISCOVERY_REDIS_URL = 'redis://test.invalid:6379'

const { invalidateDiscoveryType, invalidateDiscoveryUser } = await import('../services/discoveryInfrastructure.js')

describe('discovery cache invalidation', () => {
  beforeEach(() => {
    del.mockClear()
    scanIterator.mockClear()
  })

  it('invalidates a single user across all their surfaces (targeted)', async () => {
    await invalidateDiscoveryUser('u1')
    expect(scanIterator).toHaveBeenCalledWith(expect.objectContaining({ MATCH: 'techit:discovery:recommendations:u1:*' }))
    expect(del).toHaveBeenCalled()
  })

  it('invalidates only the opportunity surface, including aliases', async () => {
    await invalidateDiscoveryType('opportunities')
    const patterns = scanIterator.mock.calls.map(call => call[0].MATCH)
    expect(patterns).toContain('techit:discovery:recommendations:*:*:opportunities:*')
    expect(patterns).toContain('techit:discovery:recommendations:*:*:opportunity:*')
    // People/general caches are untouched.
    expect(patterns.every(p => !p.includes(':people:'))).toBe(true)
  })

  it('is a no-op for an empty type', async () => {
    await expect(invalidateDiscoveryType('')).resolves.toBe(false)
  })
})
