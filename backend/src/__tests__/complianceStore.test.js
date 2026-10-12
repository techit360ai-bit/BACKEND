import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({ consentRecords: [], dataSubjectRequests: [], dataResidencyPreferences: [], subprocessors: [], breachRecords: [] })),
  updateAuthorityDb: vi.fn(mutator => mutator({ consentRecords: [], dataSubjectRequests: [], dataResidencyPreferences: [], subprocessors: [], breachRecords: [] })),
  storeEnabled: vi.fn(() => true),
  loadUserRecords: vi.fn(async () => []),
  listCollection: vi.fn(async () => []),
  insertRecord: vi.fn(async () => {}),
  saveResidency: vi.fn(async row => row),
  exportOwned: vi.fn(async () => []),
  eraseOwned: vi.fn(async () => 0),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/complianceRepository.js', () => ({
  complianceStoreEnabled: mocks.storeEnabled,
  complianceFallbackEnabled: () => true,
  loadUserRecords: mocks.loadUserRecords,
  listCollection: mocks.listCollection,
  insertRecord: mocks.insertRecord,
  saveResidency: mocks.saveResidency,
  exportOwnedRecords: mocks.exportOwned,
  eraseOwnedRecords: mocks.eraseOwned,
}))

const { exportUserData, eraseUserData, listConsents, recordConsent, getResidency, saveResidency, listRegistry, addRegistryRecord } = await import('../services/complianceService.js')

beforeEach(() => { vi.clearAllMocks(); mocks.storeEnabled.mockReturnValue(true) })

describe('compliance row-level store (§5 cutover)', () => {
  it('exports owned records grouped by collection without the snapshot', async () => {
    mocks.exportOwned.mockResolvedValue([{ collectionName: 'projects', id: 'p1', ownerId: 'u1' }, { collectionName: 'projects', id: 'p2', ownerId: 'u1' }, { collectionName: 'consentRecords', id: 'c1', userId: 'u1' }])
    const result = await exportUserData('u1')
    expect(result.subjectId).toBe('u1')
    expect(result.data.projects).toHaveLength(2)
    expect(result.data.consentRecords).toHaveLength(1)
    expect(result.data.projects[0].collectionName).toBeUndefined()
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('erases owned records row-level and reports per-collection counts', async () => {
    mocks.exportOwned.mockResolvedValue([{ collectionName: 'projects', id: 'p1' }, { collectionName: 'projects', id: 'p2' }, { collectionName: 'consentRecords', id: 'c1' }])
    const result = await eraseUserData('u1')
    expect(result.erased).toEqual({ projects: 2, consentRecords: 1 })
    expect(mocks.eraseOwned).toHaveBeenCalledWith('u1')
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('lists and records consents row-level', async () => {
    await listConsents('u1')
    expect(mocks.loadUserRecords).toHaveBeenCalledWith('consentRecords', 'u1')
    const consent = await recordConsent('u1', { purpose: 'marketing', granted: true })
    expect(consent.userId).toBe('u1')
    expect(mocks.insertRecord).toHaveBeenCalledWith('consentRecords', expect.objectContaining({ userId: 'u1', granted: true }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('reads and saves residency row-level', async () => {
    await getResidency('u1')
    expect(mocks.loadUserRecords).toHaveBeenCalledWith('dataResidencyPreferences', 'u1')
    const residency = await saveResidency('u1', { region: 'eu', internationalTransfers: true })
    expect(residency).toMatchObject({ userId: 'u1', region: 'eu' })
    expect(mocks.saveResidency).toHaveBeenCalledTimes(1)
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('lists and adds registry records row-level', async () => {
    await listRegistry('subprocessors')
    expect(mocks.listCollection).toHaveBeenCalledWith('subprocessors')
    const row = await addRegistryRecord('breachRecords', { summary: 'x' }, 'admin-1', 'breach')
    expect(row.createdBy).toBe('admin-1')
    expect(mocks.insertRecord).toHaveBeenCalledWith('breachRecords', expect.objectContaining({ createdBy: 'admin-1' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })
})
