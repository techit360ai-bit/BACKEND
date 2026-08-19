import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readDb, updateDb, writeDb } from '../config/database.js'
import { reserveCapabilityConsumption, settleCapabilityConsumption } from '../services/capabilityConsumptionService.js'
import { beginMfaEnrollment, mfaStatus, verifyMfa } from '../services/mfaService.js'

vi.mock('../config/database.js', () => ({ readDb: vi.fn(), updateDb: vi.fn(), writeDb: vi.fn() }))

describe('production authorization controls', () => {
  let db
  beforeEach(() => {
    db = { walletAccounts: [{ userId: 'u1', creditBalance: 10 }], creditLedger: [], usageEvents: [], usageReservations: [], subscriptions: [], capabilityConsumptions: [], capabilityAnalytics: [], mfaProfiles: [] }
    readDb.mockReturnValue(db); updateDb.mockImplementation(fn => { const result = fn(db); writeDb(db); return result })
  })
  it('enrolls and verifies TOTP MFA with a short-lived assertion', () => {
    const enrollment = beginMfaEnrollment('u1', 'u1@example.com'); expect(enrollment.secret).toBeTruthy(); expect(mfaStatus('u1').enabled).toBe(false)
    expect(verifyMfa('u1', 'bad', true).error).toBe('invalid_mfa_code')
    expect(verifyMfa('u1', '12345', true).error).toBe('invalid_mfa_code')
  })
  it('reserves and settles a deterministic capability exactly once', () => {
    const decision = { allowed: true, capability: 'investor.intelligence.view', requiredCredits: 1, subscription: { active: false, entitlements: {} } }
    const first = reserveCapabilityConsumption('u1', decision, 'key-1'); expect(first.ok).toBe(true); expect(first.consumption.reservationId).toBeTruthy()
    const repeat = reserveCapabilityConsumption('u1', decision, 'key-1'); expect(repeat.idempotent).toBe(true)
    const settled = settleCapabilityConsumption(first.consumption.id, 200); expect(settled.ok).toBe(true); expect(db.creditLedger).toHaveLength(1)
    const second = settleCapabilityConsumption(first.consumption.id, 200); expect(second.idempotent).toBe(true); expect(db.creditLedger).toHaveLength(1)
  })
  it('releases a failed capability without debiting credits', () => {
    const decision = { allowed: true, capability: 'investor.intelligence.view', requiredCredits: 1, subscription: { active: false, entitlements: {} } }
    const reserved = reserveCapabilityConsumption('u1', decision, 'key-2'); expect(reserved.ok).toBe(true); expect(settleCapabilityConsumption(reserved.consumption.id, 500).ok).toBe(true); expect(db.creditLedger).toHaveLength(0)
  })
})
