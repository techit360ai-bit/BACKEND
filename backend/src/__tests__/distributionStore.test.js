import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({ distributionObjects: [], distributionAttributions: [], growthEvents: [] })),
  updateDb: vi.fn(mutator => mutator({ distributionObjects: [], distributionAttributions: [], growthEvents: [] })),
  storeEnabled: vi.fn(() => true),
  findSourceOwner: vi.fn(async () => 'founder-1'),
  insertObject: vi.fn(async () => {}),
  loadObject: vi.fn(),
  saveObject: vi.fn(async () => {}),
  insertShare: vi.fn(async () => {}),
  insertAttribution: vi.fn(async () => {}),
  loadAttribution: vi.fn(),
  updateAttribution: vi.fn(async () => {}),
  aggregates: vi.fn(),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/distributionRepository.js', () => ({
  distributionStoreEnabled: mocks.storeEnabled,
  distributionFallbackEnabled: () => true,
  findDistributionSourceOwner: mocks.findSourceOwner,
  insertDistributionObject: mocks.insertObject,
  loadDistributionObject: mocks.loadObject,
  saveDistributionObject: mocks.saveObject,
  insertDistributionShare: mocks.insertShare,
  insertDistributionAttribution: mocks.insertAttribution,
  loadDistributionAttribution: mocks.loadAttribution,
  updateDistributionAttribution: mocks.updateAttribution,
  distributionAggregates: mocks.aggregates,
}))

import { activateDistributionReferral, createDistributionObject, getDistributionObject, recordDistributionClick, recordDistributionShare } from '../services/distributionIntelligenceService.js'

const object = { id: 'dist-1', creatorId: 'founder-1', attributionId: 'attr-1', visibility: 'PUBLIC', shareCount: 0, clickCount: 0, destinationRoute: '/x' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  mocks.findSourceOwner.mockResolvedValue('founder-1')
  mocks.loadObject.mockResolvedValue({ ...object })
})

describe('distribution row-level store (§5 cutover)', () => {
  it('creates the object + event row-level without touching the snapshot', async () => {
    const result = await createDistributionObject('founder-1', { sourceType: 'moment', sourceId: 'm-1', visibility: 'PUBLIC', title: 'T' })
    expect(result.ok).toBe(true)
    expect(mocks.insertObject).toHaveBeenCalledTimes(1)
    expect(mocks.findSourceOwner).toHaveBeenCalledWith('m-1')
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('reads an object row-level for the public viewer', async () => {
    expect((await getDistributionObject('dist-1', null)).object.id).toBe('dist-1')
    expect(mocks.loadObject).toHaveBeenCalledWith('dist-1')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('records a share row-level and bumps the object', async () => {
    const result = await recordDistributionShare('founder-1', 'dist-1', 'copy')
    expect(result.ok).toBe(true)
    expect(mocks.insertShare).toHaveBeenCalledTimes(1)
    expect(mocks.saveObject).toHaveBeenCalledWith(expect.objectContaining({ id: 'dist-1', shareCount: 1 }))
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('records a click row-level and bumps the object', async () => {
    const result = await recordDistributionClick('dist-1', { source: 'linkedin' })
    expect(result.ok).toBe(true)
    expect(mocks.insertAttribution).toHaveBeenCalledTimes(1)
    expect(mocks.saveObject).toHaveBeenCalledWith(expect.objectContaining({ id: 'dist-1', clickCount: 1 }))
  })

  it('activates a referral row-level from the attribution record', async () => {
    mocks.loadAttribution.mockResolvedValue({ id: 'ref-1', distributionObjectId: 'dist-1', status: 'visited' })
    const result = await activateDistributionReferral('new-user', 'ref-1', { activationAction: 'account_created' })
    expect(result).toEqual({ ok: true, referralId: 'ref-1', status: 'activated' })
    expect(mocks.updateAttribution).toHaveBeenCalledTimes(1)
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })
})
