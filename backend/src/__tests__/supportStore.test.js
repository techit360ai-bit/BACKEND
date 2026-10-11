import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(fn => fn({})),
  storeEnabled: vi.fn(() => true),
  fallbackEnabled: vi.fn(() => true),
  runSupportRead: vi.fn(),
  applySupportMutation: vi.fn(),
  lastReadOptions: null,
  lastWriteOptions: null,
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/supportRepository.js', () => ({
  supportStoreEnabled: mocks.storeEnabled,
  supportFallbackEnabled: mocks.fallbackEnabled,
  runSupportRead: mocks.runSupportRead,
  applySupportMutation: mocks.applySupportMutation,
}))
vi.mock('../services/supportNotificationService.js', () => ({ deliverSupportNotification: vi.fn(async () => {}), deliverSupportTeamNotification: vi.fn(async () => {}) }))
vi.mock('../services/evidenceStorageService.js', () => ({ createPrivateUpload: vi.fn(() => ({ ok: true, objectKey: 'k', uploadUrl: 'u', requiredHeaders: {} })), finalizePrivateUpload: vi.fn(async () => ({ ok: true, sha256: 'sha' })), privateDownloadUrl: vi.fn(() => 'url') }))

const svc = await import('../services/supportService.js')

function usedBounded(db) {
  mocks.readDb.mockReturnValue(db)
  mocks.updateDb.mockImplementation(fn => fn(db))
  mocks.runSupportRead.mockImplementation(async (options, read) => { mocks.lastReadOptions = options; return read() })
  mocks.applySupportMutation.mockImplementation(async (options, mutate) => { mocks.lastWriteOptions = options; return mutate() })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  mocks.fallbackEnabled.mockReturnValue(true)
})

describe('support row-level store (§5 cutover)', () => {
  it('creates a case through the scoped row-level mutation', async () => {
    usedBounded({ supportCases: [], supportMessages: [], supportEvents: [], supportAuditLogs: [], supportSlaPolicies: [], supportSettings: [], notifications: [] })
    const result = await svc.createCaseAsync('u1', { category: 'billing', subject: 'Payment issue', description: 'I paid but access is blocked.' }, 'founder')
    expect(result.ok).toBe(true)
    expect(mocks.applySupportMutation).toHaveBeenCalled()
    expect(mocks.lastWriteOptions).toMatchObject({ userId: 'u1', admin: false, allCases: true })
  })

  it('lists a user\'s cases through the row-level read', async () => {
    usedBounded({ supportCases: [{ id: 'c1', userId: 'u1', caseNumber: 'TKT-1', status: 'received', updatedAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z' }] })
    const result = await svc.listCasesAsync('u1')
    expect(result.cases).toHaveLength(1)
    expect(mocks.runSupportRead).toHaveBeenCalled()
    expect(mocks.lastReadOptions).toMatchObject({ userId: 'u1', admin: false, allCases: true })
  })

  it('loads a single admin case with the addressed-case scope', async () => {
    usedBounded({ supportCases: [{ id: 'c1', userId: 'u2', caseNumber: 'TKT-1', status: 'received', createdAt: '2026-08-01T00:00:00.000Z' }], supportMessages: [], supportEvents: [], supportAttachments: [], supportFeedback: [], supportAssignments: [] })
    const result = await svc.getCaseAsync('admin1', 'c1', true)
    expect(result.ok).toBe(true)
    expect(mocks.lastReadOptions).toMatchObject({ admin: true, allCases: false, caseIds: ['c1'] })
  })

  it('aggregates the admin overview over all cases row-level', async () => {
    usedBounded({ supportCases: [{ id: 'c1', userId: 'u1', status: 'received', createdAt: new Date().toISOString() }] })
    const result = await svc.supportOverviewAsync()
    expect(result.metrics.open).toBe(1)
    expect(mocks.lastReadOptions).toMatchObject({ admin: true, allCases: true })
  })

  it('persists admin configuration changes row-level', async () => {
    usedBounded({ supportCases: [], supportSettings: [], supportSlaPolicies: [], supportCategories: [], supportTeams: [], supportEvents: [], supportAuditLogs: [] })
    const result = await svc.configureSupportAsync('admin1', { businessHoursEnabled: true, incidentThreshold: 3 })
    expect(result.ok).toBe(true)
    expect(mocks.applySupportMutation).toHaveBeenCalled()
  })

  it('falls back to the snapshot path when the row-level store is disabled', async () => {
    mocks.storeEnabled.mockReturnValue(false)
    usedBounded({ supportCases: [], supportMessages: [], supportEvents: [], supportAuditLogs: [], supportSlaPolicies: [], supportSettings: [], notifications: [] })
    const result = await svc.createCaseAsync('u1', { category: 'other', subject: 'Question', description: 'Need help.' })
    expect(result.ok).toBe(true)
    expect(mocks.applySupportMutation).not.toHaveBeenCalled()
    expect(mocks.readDb).toHaveBeenCalled()
  })
})
