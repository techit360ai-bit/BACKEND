import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({ users: [] })),
  storeEnabled: vi.fn(() => true),
  loadUserContact: vi.fn(async () => ({ id: 'user-1', email: 'founder@example.com' })),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb }))
vi.mock('../repositories/supportRepository.js', () => ({
  supportStoreEnabled: mocks.storeEnabled,
  supportFallbackEnabled: () => true,
  loadUserContact: mocks.loadUserContact,
}))

const { deliverSupportNotification } = await import('../services/supportNotificationService.js')

beforeEach(() => { vi.clearAllMocks(); mocks.storeEnabled.mockReturnValue(true) })

describe('support notification contact lookup (§5 cutover)', () => {
  it('reads the recipient row-level without touching the snapshot', async () => {
    const result = await deliverSupportNotification({ userId: 'user-1', subject: 'Update', message: 'Hi', caseNumber: 'C-1' })
    expect(mocks.loadUserContact).toHaveBeenCalledWith('user-1')
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(result).toHaveProperty('ok')
  })

  it('returns user_not_found without a snapshot read', async () => {
    mocks.loadUserContact.mockResolvedValue(null)
    expect(await deliverSupportNotification({ userId: 'missing', subject: 's', message: 'm', caseNumber: 'c' })).toEqual({ ok: false, error: 'user_not_found' })
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })
})
