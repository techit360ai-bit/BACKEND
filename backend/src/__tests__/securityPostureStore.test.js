import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  updateDb: vi.fn(),
  storeEnabled: vi.fn(() => true),
  hasRows: vi.fn(async () => true),
  listHistory: vi.fn(async () => []),
  insertHistory: vi.fn(async () => {}),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, updateDb: mocks.updateDb }))
vi.mock('../repositories/securityPostureRepository.js', () => ({
  postureStoreEnabled: mocks.storeEnabled,
  postureFallbackEnabled: () => true,
  hasCollectionRows: mocks.hasRows,
  listPostureHistory: mocks.listHistory,
  insertPostureHistory: mocks.insertHistory,
}))

const { securityPostureSnapshot } = await import('../services/securityPostureService.js')

beforeEach(() => { vi.clearAllMocks(); mocks.storeEnabled.mockReturnValue(true); mocks.hasRows.mockResolvedValue(true) })

describe('security posture row-level store (§5 cutover)', () => {
  it('reads audit-collection presence and writes the trend row-level', async () => {
    const result = await securityPostureSnapshot()
    expect(result.domains.map(d => d.domain)).toContain('Authorization')
    expect(mocks.hasRows).toHaveBeenCalledWith('authorizationAuditLogs')
    expect(mocks.insertHistory).toHaveBeenCalledWith(expect.objectContaining({ score: expect.any(Number), riskLevel: expect.any(String) }))
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.updateDb).not.toHaveBeenCalled()
  })

  it('flags an uninitialized audit collection without the snapshot', async () => {
    mocks.hasRows.mockResolvedValue(false)
    const result = await securityPostureSnapshot()
    expect(result.findings.map(f => f.id)).toContain('authorization-audit')
    expect(mocks.readDb).not.toHaveBeenCalled()
  })
})
