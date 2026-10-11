import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(fn => fn({})),
  storeEnabled: vi.fn(() => true),
  fallbackEnabled: vi.fn(() => true),
  runDealRoomRead: vi.fn(),
  applyDealRoomMutation: vi.fn(),
  investorReadEnabled: vi.fn(() => false),
  investorWriteEnabled: vi.fn(() => false),
  investorFallbackEnabled: vi.fn(() => true),
  listDealRoomsPostgres: vi.fn(async () => ({ deals: [] })),
  getDealRoomPostgres: vi.fn(async () => ({ ok: true, deal: { id: 'd1' } })),
  syncDealAggregate: vi.fn(async () => ({ enabled: true })),
  lastOptions: null,
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/investorDealRoomRepository.js', () => ({
  dealRoomStoreEnabled: mocks.storeEnabled,
  dealRoomFallbackEnabled: mocks.fallbackEnabled,
  runDealRoomRead: mocks.runDealRoomRead,
  applyDealRoomMutation: mocks.applyDealRoomMutation,
  investorReadEnabled: mocks.investorReadEnabled,
  investorWriteEnabled: mocks.investorWriteEnabled,
  investorFallbackEnabled: mocks.investorFallbackEnabled,
  listDealRooms: mocks.listDealRoomsPostgres,
  getDealRoom: mocks.getDealRoomPostgres,
  syncDealAggregate: mocks.syncDealAggregate,
}))
vi.mock('../services/evidenceStorageService.js', () => ({ createPrivateUpload: vi.fn(() => ({ ok: true, objectKey: 'k', uploadUrl: 'u', requiredHeaders: {} })), finalizePrivateUpload: vi.fn(async () => ({ ok: true, sha256: 'sha' })), privateDownloadUrl: vi.fn(() => 'url') }))

const completion = await import('../services/investorDealRoomCompletionService.js')
const core = await import('../services/investorDealRoomService.js')

function useBounded(db) {
  mocks.readDb.mockReturnValue(db)
  mocks.updateDb.mockImplementation(fn => fn(db))
  mocks.runDealRoomRead.mockImplementation(async (options, read) => { mocks.lastOptions = options; return read() })
  mocks.applyDealRoomMutation.mockImplementation(async (options, mutate) => { mocks.lastOptions = options; return mutate() })
}

const deal = { id: 'd1', investorId: 'inv1', founderId: 'f1', projectId: 'p1', status: 'active', state: 'diligence_open', ndaTemplateId: null }
const participant = { id: 'part1', dealId: 'd1', userId: 'inv1', role: 'investor', status: 'active' }
const base = () => ({ dealRooms: [deal], dealRoomParticipants: [participant], dataRoomFolders: [], ndaTemplates: [], ndaSignatures: [] })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  mocks.fallbackEnabled.mockReturnValue(true)
})

describe('investor deal room row-level store (§5 cutover)', () => {
  it('creates a folder through the scoped row-level mutation', async () => {
    useBounded(base())
    const result = await completion.createDealFolderAsync('inv1', 'd1', { name: 'Corporate' })
    expect(result.ok).toBe(true)
    expect(mocks.applyDealRoomMutation).toHaveBeenCalled()
    expect(mocks.lastOptions).toMatchObject({ userId: 'inv1', dealId: 'd1' })
  })

  it('lists folders through the row-level read', async () => {
    useBounded({ ...base(), dataRoomFolders: [{ id: 'folder1', dealId: 'd1', name: 'Corporate' }] })
    const result = await completion.listDealFoldersAsync('inv1', 'd1')
    expect(result.folders).toHaveLength(1)
    expect(mocks.runDealRoomRead).toHaveBeenCalled()
    expect(mocks.lastOptions).toMatchObject({ userId: 'inv1', dealId: 'd1' })
  })

  it('runs deal-room maintenance over all deals row-level', async () => {
    useBounded({ dealRooms: [], diligenceItems: [], diligenceEvidenceLinks: [], referenceRequests: [], investorQuestionnaireSubmissions: [], dataRoomDocuments: [] })
    const result = await completion.runDealRoomMaintenanceAsync()
    expect(result.ok).toBe(true)
    expect(mocks.lastOptions).toMatchObject({ allDeals: true })
  })

  it('lists comparables from the global comparable rows', async () => {
    useBounded({ comparableTransactions: [{ id: 'c1', company: 'Acme', region: 'EU', active: true }] })
    const result = await completion.listComparablesAsync('admin1', { region: 'EU' })
    expect(result.comparables).toHaveLength(1)
    expect(mocks.lastOptions).toMatchObject({ comparables: true })
  })

  it('reads the deal room from the investor projection without the snapshot', async () => {
    mocks.investorReadEnabled.mockReturnValue(true)
    const result = await core.getDealRoomAsync('inv1', 'd1')
    expect(result.deal.id).toBe('d1')
    expect(mocks.getDealRoomPostgres).toHaveBeenCalledWith('inv1', 'd1')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('signs the NDA through the row-level mutation', async () => {
    useBounded({ ...base(), ndaSignatures: [], notifications: [] })
    const result = await core.signDealNdaAsync('inv1', 'd1', { accepted: true })
    expect(mocks.applyDealRoomMutation).toHaveBeenCalled()
    expect(mocks.lastOptions).toMatchObject({ userId: 'inv1', dealId: 'd1' })
    expect(result).toBeTruthy()
  })
})
