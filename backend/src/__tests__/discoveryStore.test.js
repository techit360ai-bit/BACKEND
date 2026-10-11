import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(fn => fn({})),
  storeEnabled: vi.fn(() => true),
  fallbackEnabled: vi.fn(() => true),
  runDiscoveryRead: vi.fn(),
  applyDiscoveryMutation: vi.fn(),
  lastReadOptions: null,
  lastWriteOptions: null,
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/discoveryRepository.js', () => ({
  discoveryStoreEnabled: mocks.storeEnabled,
  discoveryFallbackEnabled: mocks.fallbackEnabled,
  runDiscoveryRead: mocks.runDiscoveryRead,
  applyDiscoveryMutation: mocks.applyDiscoveryMutation,
}))

const svc = await import('../services/discoveryService.js')

function usedBounded(db) {
  mocks.readDb.mockReturnValue(db)
  mocks.updateDb.mockImplementation(fn => fn(db))
  mocks.runDiscoveryRead.mockImplementation(async (options, read) => { mocks.lastReadOptions = options; return read() })
  mocks.applyDiscoveryMutation.mockImplementation(async (options, mutate) => { mocks.lastWriteOptions = options; return mutate() })
}

const viewer = { id: 'u1', role: 'founder', isOnboarded: true, skills: ['Product'], industries: ['FinTech'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }
const candidate = { id: 'u2', role: 'investor', isOnboarded: true, investmentFocus: ['FinTech'], credibilityScore: 80, isVerified: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' }
const base = () => ({ profiles: [viewer, candidate], recommendationProfiles: [], recommendationConfigs: [], recommendations: [], recommendationReasons: [], recommendationEvents: [] })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  mocks.fallbackEnabled.mockReturnValue(true)
})

describe('discovery row-level store (§5 cutover)', () => {
  it('generates recommendations over the viewer scope + candidate window', async () => {
    usedBounded(base())
    const result = await svc.getRecommendationsAsync('u1', { limit: 5 })
    expect(Array.isArray(result.recommendations)).toBe(true)
    expect(mocks.applyDiscoveryMutation).toHaveBeenCalled()
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', candidates: true })
  })

  it('searches through the viewer-scoped mutation', async () => {
    usedBounded(base())
    const result = await svc.searchDiscoveryAsync('u1', 'investor')
    expect(Array.isArray(result.results)).toBe(true)
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', candidates: true })
  })

  it('reads the global discovery config row-level', async () => {
    usedBounded({ recommendationConfigs: [{ id: 'default', value: { version: 2 } }] })
    const config = await svc.getDiscoveryConfigAsync()
    expect(config.version).toBe(2)
    expect(mocks.runDiscoveryRead).toHaveBeenCalled()
    expect(mocks.lastReadOptions).toMatchObject({ global: true, candidates: false })
  })

  it('aggregates discovery analytics over the global rows', async () => {
    usedBounded({ recommendationEvents: [], recommendationExposures: [], recommendationFeedback: [], recommendations: [], profiles: [] })
    const analytics = await svc.getDiscoveryAnalyticsAsync()
    expect(analytics.generated).toBe(0)
    expect(mocks.lastReadOptions).toMatchObject({ global: true, candidates: false })
  })

  it('records exposure for an owned recommendation', async () => {
    usedBounded({ ...base(), recommendations: [{ id: 'rec1', userId: 'u1', surface: 'discovery', entityType: 'person', entityId: 'u2', entity: { type: 'person', entityId: 'u2', skills: [] } }], recommendationExposures: [] })
    const exposure = await svc.recordExposureAsync('u1', 'rec1', {})
    expect(exposure).toBeTruthy()
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1' })
  })

  it('passes mention target ids into the profile window', async () => {
    usedBounded(base())
    await svc.recordRecommendationEventAsync('u1', { eventType: 'mention', entityType: 'person', entityId: 'u2', metadata: { targetUserIds: ['u3'] } })
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', profileIds: ['u3'] })
  })

  it('falls back to the snapshot path when the row-level store is disabled', async () => {
    mocks.storeEnabled.mockReturnValue(false)
    usedBounded(base())
    const result = await svc.getDiscoveryConfigAsync()
    expect(result).toBeTruthy()
    expect(mocks.runDiscoveryRead).not.toHaveBeenCalled()
    expect(mocks.readDb).toHaveBeenCalled()
  })
})
