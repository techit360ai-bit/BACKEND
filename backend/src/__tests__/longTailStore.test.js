import { beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function decodeBase32(value) {
  const bits = [...String(value).replace(/=+$/, '').toUpperCase()].map(char => ALPHABET.indexOf(char).toString(2).padStart(5, '0')).join('')
  return Buffer.from((bits.match(/.{8}/g) || []).map(byte => parseInt(byte, 2)))
}
function totp(secret, time = Date.now()) {
  const counter = Math.floor(time / 30000); const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(counter))
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(buffer).digest(); const offset = digest[digest.length - 1] & 15
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(),
  identityEnabled: vi.fn(() => true),
  listIdentitySecurityForOwner: vi.fn(async () => []),
  saveIdentitySecurityRow: vi.fn(async () => {}),
  operationalEnabled: vi.fn(() => true),
  listOperationalStateForOwner: vi.fn(async () => []),
  loadOperationalStateById: vi.fn(async () => null),
  saveOperationalStateRow: vi.fn(async () => {}),
  orgBudgetEnabled: vi.fn(() => true),
  saveOrganizationBudgetRow: vi.fn(async () => {}),
  billingRowLevelEnabled: vi.fn(() => true),
  usageSettlementHealthRowLevel: vi.fn(async () => ({ ok: true })),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/identitySecurityRepository.js', () => ({
  identitySecurityEnabled: mocks.identityEnabled,
  identitySecurityFallbackEnabled: () => true,
  listIdentitySecurityForOwner: mocks.listIdentitySecurityForOwner,
  saveIdentitySecurityRow: mocks.saveIdentitySecurityRow,
  loadIdentitySecurityById: vi.fn(async () => null),
}))
vi.mock('../repositories/operationalStateRepository.js', () => ({
  operationalStateEnabled: mocks.operationalEnabled,
  operationalStateFallbackEnabled: () => true,
  listOperationalStateForOwner: mocks.listOperationalStateForOwner,
  saveOperationalStateRow: mocks.saveOperationalStateRow,
  loadOperationalStateById: mocks.loadOperationalStateById,
}))
vi.mock('../repositories/organizationBudgetRepository.js', () => ({
  organizationBudgetEnabled: mocks.orgBudgetEnabled,
  saveOrganizationBudgetRow: mocks.saveOrganizationBudgetRow,
}))
vi.mock('../repositories/billingJobsRepository.js', () => ({
  billingJobsRowLevelEnabled: mocks.billingRowLevelEnabled,
  usageSettlementHealthRowLevel: mocks.usageSettlementHealthRowLevel,
}))

const { beginMfaEnrollmentAsync, verifyMfaAsync, mfaStatusAsync } = await import('../services/mfaService.js')
const { createEvidenceUploadAsync } = await import('../services/evidenceStorageService.js')
const { createOrganizationBudgetAsync } = await import('../services/organizationBudgetService.js')
const { usageSettlementHealthAsync } = await import('../services/usageSettlementService.js')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.identityEnabled.mockReturnValue(true)
  mocks.operationalEnabled.mockReturnValue(true)
  mocks.orgBudgetEnabled.mockReturnValue(true)
  mocks.billingRowLevelEnabled.mockReturnValue(true)
  mocks.listIdentitySecurityForOwner.mockResolvedValue([])
  mocks.listOperationalStateForOwner.mockResolvedValue([])
})

describe('long-tail row-level store — mfa / evidence / org budget / usage health (§5)', () => {
  it('enrolls MFA row-level and verifies a live TOTP without the snapshot', async () => {
    const enrollment = await beginMfaEnrollmentAsync('u1', 'u1@example.com')
    expect(enrollment.ok).toBe(true)
    expect(enrollment.secret).toBeTruthy()
    expect(enrollment.otpauthUrl).toContain('otpauth://totp/')
    expect(mocks.saveIdentitySecurityRow).toHaveBeenCalledWith('mfaProfiles', expect.objectContaining({ userId: 'u1', enabled: false }))
    const saved = mocks.saveIdentitySecurityRow.mock.calls[0][1]
    mocks.listIdentitySecurityForOwner.mockResolvedValue([saved])
    const verified = await verifyMfaAsync('u1', totp(enrollment.secret), true)
    expect(verified.ok).toBe(true)
    expect(verified.enabled).toBe(true)
    expect(mocks.saveIdentitySecurityRow).toHaveBeenLastCalledWith('mfaProfiles', expect.objectContaining({ enabled: true }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('reports MFA status row-level', async () => {
    mocks.listIdentitySecurityForOwner.mockResolvedValue([{ id: 'm1', userId: 'u1', enabled: true, verifiedAt: '2026-01-01T00:00:00.000Z' }])
    expect(await mfaStatusAsync('u1')).toEqual({ enabled: true, verifiedAt: '2026-01-01T00:00:00.000Z' })
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('creates an evidence upload row-level', async () => {
    process.env.EVIDENCE_STORAGE_ENDPOINT = 'https://storage.example.com'
    process.env.EVIDENCE_STORAGE_BUCKET = 'evidence'
    process.env.EVIDENCE_STORAGE_ACCESS_KEY = 'key'
    process.env.EVIDENCE_STORAGE_SECRET_KEY = 'secret'
    try {
      mocks.listOperationalStateForOwner.mockResolvedValue([{ id: 'req1', userId: 'u1' }])
      const result = await createEvidenceUploadAsync('u1', 'req1', { contentType: 'application/pdf', sizeBytes: 2048 })
      expect(result.ok).toBe(true)
      expect(result.uploadUrl).toContain('storage.example.com')
      expect(mocks.saveOperationalStateRow).toHaveBeenCalledWith('evidenceObjects', expect.objectContaining({ userId: 'u1', requestId: 'req1', status: 'upload_pending' }))
      expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
      expect((await createEvidenceUploadAsync('u1', 'req1', { contentType: 'application/zip', sizeBytes: 10 })).error).toBe('unsupported_evidence_type')
    } finally {
      for (const key of ['EVIDENCE_STORAGE_ENDPOINT', 'EVIDENCE_STORAGE_BUCKET', 'EVIDENCE_STORAGE_ACCESS_KEY', 'EVIDENCE_STORAGE_SECRET_KEY']) delete process.env[key]
    }
  })

  it('creates an organization budget row-level', async () => {
    const result = await createOrganizationBudgetAsync('admin', { organizationId: 'org1', balance: 25 })
    expect(result.ok).toBe(true)
    expect(result.budget).toMatchObject({ organizationId: 'org1', balance: 25 })
    expect(mocks.saveOrganizationBudgetRow).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org1', balance: 25, createdBy: 'admin' }))
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect((await createOrganizationBudgetAsync('admin', { organizationId: '', balance: 0 })).error).toBe('organization_budget_fields_required')
  })

  it('reports usage-settlement health row-level', async () => {
    mocks.usageSettlementHealthRowLevel.mockResolvedValue({ ok: true, usageEvents: 3, pendingReservations: 1, lastSettledAt: null })
    const result = await usageSettlementHealthAsync()
    expect(result).toEqual({ ok: true, usageEvents: 3, pendingReservations: 1, lastSettledAt: null })
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })
})
