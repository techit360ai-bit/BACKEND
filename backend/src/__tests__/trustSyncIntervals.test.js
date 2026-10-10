import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SYNC_INTERVAL_MS,
  SYNC_INTERVALS_MS,
  expiryForSource,
  isExpired,
  listSyncIntervals,
  syncIntervalDaysFor,
  syncIntervalMsFor,
} from '../config/trustSyncIntervals.js'

const HOUR_MS = 3600 * 1000
const DAY_MS = 24 * HOUR_MS

describe('trust sync intervals (WS9)', () => {
  it('mirrors the AI-router SYNC_INTERVALS clocks', () => {
    expect(SYNC_INTERVALS_MS.github).toBe(DAY_MS)
    expect(SYNC_INTERVALS_MS.deployment).toBe(12 * HOUR_MS)
    expect(SYNC_INTERVALS_MS.milestone).toBe(180 * DAY_MS)
    expect(SYNC_INTERVALS_MS.email).toBe(365 * DAY_MS)
  })

  it('lets ops override per source and never lets a typo make a source flap', () => {
    expect(syncIntervalMsFor('github', {})).toBe(DAY_MS)
    expect(syncIntervalMsFor('github', { TRUST_SYNC_INTERVAL_GITHUB_MS: '7200000' })).toBe(7200000)
    expect(syncIntervalMsFor('github', { TRUST_SYNC_INTERVAL_GITHUB_MS: '5000' })).toBe(60_000)
    expect(syncIntervalMsFor('not_a_source', {})).toBe(DEFAULT_SYNC_INTERVAL_MS)
  })

  it('computes an expiry TTL from the moment of verification', () => {
    const at = new Date('2026-01-01T00:00:00.000Z')
    expect(expiryForSource('github', at, {})).toBe('2026-01-02T00:00:00.000Z')
    expect(isExpired('2026-01-02T00:00:00.000Z', new Date('2026-01-02T00:00:01.000Z').getTime())).toBe(true)
    expect(isExpired('2026-01-02T00:00:00.000Z', at.getTime())).toBe(false)
    expect(isExpired(null)).toBe(true)
    expect(isExpired(undefined)).toBe(true)
  })

  it('lists every source with ms + day intervals', () => {
    const entries = listSyncIntervals({})
    expect(entries).toHaveLength(Object.keys(SYNC_INTERVALS_MS).length)
    expect(entries.find(row => row.source === 'deployment').interval_days).toBe(0.5)
    expect(syncIntervalDaysFor('milestone', {})).toBe(180)
  })
})
