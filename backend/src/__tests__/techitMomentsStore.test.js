import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({ techitMoments: [], techitMomentEvents: [], techitMomentShares: [], techitMomentReferrals: [] })),
  updateDb: vi.fn(mutator => mutator({ techitMoments: [], techitMomentEvents: [], techitMomentShares: [], techitMomentReferrals: [] })),
  createDistribution: vi.fn(async () => ({ ok: false })),
  storeEnabled: vi.fn(() => true),
  loadSources: vi.fn(),
  loadProfile: vi.fn(async () => ({ id: 'founder-1', firstName: 'Ada', lastName: 'Lovelace' })),
  listUserMoments: vi.fn(async () => []),
  getPublished: vi.fn(async () => null),
  insertMoments: vi.fn(async () => {}),
  saveMoment: vi.fn(async () => {}),
  insertShare: vi.fn(async () => {}),
  getShare: vi.fn(async () => null),
  insertReferral: vi.fn(async () => {}),
  getReferral: vi.fn(async () => null),
  saveReferral: vi.fn(async () => {}),
  listShares: vi.fn(async () => []),
  listReferrals: vi.fn(async () => []),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../services/distributionIntelligenceService.js', () => ({ createDistributionObject: mocks.createDistribution }))
vi.mock('../repositories/techitMomentsRepository.js', () => ({
  momentsStoreEnabled: mocks.storeEnabled,
  momentsFallbackEnabled: () => true,
  loadMomentSources: mocks.loadSources,
  loadProfile: mocks.loadProfile,
  listUserMoments: mocks.listUserMoments,
  getPublishedMomentBySlug: mocks.getPublished,
  insertMoments: mocks.insertMoments,
  saveMoment: mocks.saveMoment,
  insertShare: mocks.insertShare,
  getShare: mocks.getShare,
  insertReferral: mocks.insertReferral,
  getReferral: mocks.getReferral,
  saveReferral: mocks.saveReferral,
  listShares: mocks.listShares,
  listReferrals: mocks.listReferrals,
}))

const { generateMoments, dismissMoment, recordShare, getPublicMoment, recordVisit, activateReferral, analytics } = await import('../services/techitMomentsService.js')

const sources = () => ({ projects: [{ id: 'project-1', ownerId: 'founder-1', stage: 'mvp' }], ventureIntakes: [], ventureAnalyses: [], pivotRecords: [], contributions: [], workspaceTasks: [], mentorshipTasks: [], opportunityApplications: [], feedPosts: [], investorWatchlists: [] })
const pendingMoment = () => ({ id: 'moment-1', userId: 'founder-1', role: 'founder', status: 'pending', kind: 'project_started', sourceKey: 'projects:project-1', title: 'T', subtitle: 'S', publicSlug: 'founder-project_started-abc', publicUrl: 'http://x/moments/founder-project_started-abc', shareCount: 0, referralCount: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  mocks.loadSources.mockResolvedValue(sources())
  mocks.listUserMoments.mockResolvedValue([])
})

describe('TechIT Moments row-level store (§5 cutover)', () => {
  it('generates and persists moments without touching the snapshot', async () => {
    const result = await generateMoments('founder-1', 'founder')
    expect(result.ok).toBe(true)
    expect(result.moments.some(row => row.kind === 'project_started')).toBe(true)
    expect(result.moments.some(row => row.kind === 'mvp_ready')).toBe(true)
    expect(mocks.insertMoments).toHaveBeenCalledTimes(1)
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('deduplicates against row-level existing moments', async () => {
    mocks.listUserMoments.mockResolvedValue([{ ...pendingMoment() }])
    const result = await generateMoments('founder-1', 'founder')
    expect(result.moments).toHaveLength(2)
    expect(mocks.insertMoments).toHaveBeenCalledTimes(1)
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('dismisses a pending moment row-level', async () => {
    mocks.listUserMoments.mockResolvedValue([{ ...pendingMoment() }])
    const result = await dismissMoment('founder-1', 'moment-1')
    expect(result).toEqual({ ok: true })
    expect(mocks.saveMoment).toHaveBeenCalledWith(expect.objectContaining({ id: 'moment-1', status: 'dismissed' }), expect.any(Array))
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('records a share row-level and bumps the object', async () => {
    mocks.listUserMoments.mockResolvedValue([{ ...pendingMoment() }])
    const result = await recordShare('founder-1', 'moment-1', 'copy')
    expect(result.ok).toBe(true)
    expect(mocks.insertShare).toHaveBeenCalledTimes(1)
    expect(mocks.saveMoment).toHaveBeenCalledWith(expect.objectContaining({ id: 'moment-1', shareCount: 1, status: 'published' }))
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('reads a published moment and records a visit row-level', async () => {
    mocks.getPublished.mockResolvedValue({ ...pendingMoment(), status: 'published' })
    expect((await getPublicMoment('founder-project_started-abc')).ok).toBe(true)
    const visit = await recordVisit('founder-project_started-abc', null, 'direct')
    expect(visit.ok).toBe(true)
    expect(mocks.insertReferral).toHaveBeenCalledTimes(1)
    expect(mocks.saveMoment).toHaveBeenCalledWith(expect.objectContaining({ id: 'moment-1', referralCount: 1 }))
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('activates a referral and aggregates analytics row-level', async () => {
    mocks.getReferral.mockResolvedValue({ id: 'ref-1', momentId: 'moment-1', status: 'visited' })
    expect((await activateReferral('ref-1', 'new-user')).ok).toBe(true)
    expect(mocks.saveReferral).toHaveBeenCalledTimes(1)
    mocks.listUserMoments.mockResolvedValue([{ ...pendingMoment() }])
    mocks.listShares.mockResolvedValue([{ momentId: 'moment-1', channel: 'copy' }])
    mocks.listReferrals.mockResolvedValue([{ momentId: 'moment-1', activatedAt: '2026-01-01T00:00:00.000Z' }])
    const summary = await analytics('founder-1')
    expect(summary.totals).toEqual({ moments: 1, shares: 1, referrals: 1 })
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })
})
