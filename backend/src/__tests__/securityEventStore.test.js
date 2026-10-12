import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({ securityEvents: [] })),
  updateAuthorityDb: vi.fn(mutator => mutator({ securityEvents: [] })),
  storeEnabled: vi.fn(() => false),
  insert: vi.fn(async () => {}),
  list: vi.fn(async () => [{ id: 'pg-1' }]),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/securityEventRepository.js', () => ({
  securityEventStoreEnabled: mocks.storeEnabled,
  insertSecurityEvent: mocks.insert,
  listRecentSecurityEvents: mocks.list,
}))

import { listSecurityEvents, recordSecurityEvent } from '../services/securityEventService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(false)
  mocks.readAuthorityDb.mockReturnValue({ securityEvents: [] })
})

describe('security event store (§5 cutover)', () => {
  it('uses the snapshot authority when the row-level store is off', () => {
    const row = recordSecurityEvent({ type: 'csrf_blocked', severity: 'HIGH' })
    expect(row.type).toBe('csrf_blocked')
    expect(mocks.updateAuthorityDb).toHaveBeenCalledTimes(1)
    expect(mocks.insert).not.toHaveBeenCalled()
  })

  it('writes row-level and never touches the snapshot when the store is on', () => {
    mocks.storeEnabled.mockReturnValue(true)
    const row = recordSecurityEvent({ type: 'login_blocked' })
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ id: row.id, type: 'login_blocked' }))
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('lists from the row-level store when enabled', async () => {
    mocks.storeEnabled.mockReturnValue(true)
    expect(await listSecurityEvents(50)).toEqual([{ id: 'pg-1' }])
    expect(mocks.list).toHaveBeenCalledWith(50)
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('falls back to the newest snapshot events when disabled', async () => {
    mocks.readAuthorityDb.mockReturnValue({ securityEvents: [{ id: '1' }, { id: '2' }, { id: '3' }] })
    expect(await listSecurityEvents(2)).toEqual([{ id: '3' }, { id: '2' }])
    expect(mocks.list).not.toHaveBeenCalled()
  })
})
