import { describe, expect, it } from 'vitest'
import { discoveryCacheTtlSeconds, recommendationCacheKey } from '../services/discoveryInfrastructure.js'

describe('discoveryCacheTtlSeconds', () => {
  it('uses the short TTL for people surfaces', () => {
    expect(discoveryCacheTtlSeconds({ type: 'people' })).toBe(600)
    expect(discoveryCacheTtlSeconds({ type: 'person' })).toBe(600)
    expect(discoveryCacheTtlSeconds({ type: 'founder' })).toBe(600)
  })

  it('uses the long TTL for opportunities', () => {
    expect(discoveryCacheTtlSeconds({ type: 'opportunities' })).toBe(3600)
    expect(discoveryCacheTtlSeconds({ type: 'opportunity' })).toBe(3600)
  })

  it('falls back to the baseline TTL for the general feed', () => {
    expect(discoveryCacheTtlSeconds({ surface: 'feed' })).toBe(300)
    expect(discoveryCacheTtlSeconds({ type: 'startup' })).toBe(300)
  })

  it('keys the cache per surface/type so TTLs cannot collide', () => {
    expect(recommendationCacheKey('u1', { surface: 'feed', type: 'people', limit: 4 })).not.toBe(
      recommendationCacheKey('u1', { surface: 'feed', type: 'opportunities', limit: 4 }),
    )
  })
})
