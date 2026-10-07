import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression guard for the class of bug that broke signup OTP after the
// Postgres cutover: the platform authority store is keyed by record_id, so a
// row written without an id is silently dropped by the flush.
const { client, pool, upsertRecord, deleteRecord } = vi.hoisted(() => {
  const client = { query: vi.fn(async () => ({ rows: [] })), release: vi.fn() }
  const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => {}) }
  return { client, pool, upsertRecord: vi.fn(async () => {}), deleteRecord: vi.fn(async () => {}) }
})

vi.mock('../repositories/platformCollectionRepository.js', () => ({
  getPlatformPool: () => pool,
  upsertRecord,
  deleteRecord,
}))

import { flushPlatformDatabase } from '../repositories/platformDatabaseRepository.js'

describe('flushPlatformDatabase stable-id contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client.query.mockResolvedValue({ rows: [] })
  })

  it('log-surfaces (and skips) an id-less row instead of losing it silently', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await flushPlatformDatabase({}, { otps: [{ email: 'a@b.c', codeHmac: 'x' }] })
    expect(upsertRecord).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(expect.stringContaining('platform_row_missing_id'))
    error.mockRestore()
  })

  it('upserts a row that carries a stable id', async () => {
    await flushPlatformDatabase({}, { otps: [{ id: 'otp-1', email: 'a@b.c' }] })
    expect(upsertRecord).toHaveBeenCalledTimes(1)
    expect(upsertRecord.mock.calls[0][1]).toBe('otps')
    expect(upsertRecord.mock.calls[0][2]).toMatchObject({ id: 'otp-1' })
  })
})
