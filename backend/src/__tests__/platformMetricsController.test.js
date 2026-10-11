import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { platformAuthorityMetrics } from '../controllers/platformMetricsController.js'
import { requireInternalMetricsAuth } from '../middlewares/internalMetricsAuth.js'
import { recordWholeDbRead, resetPlatformAuthorityInstrumentation } from '../services/platformAuthorityInstrumentation.js'

const fakeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() })

beforeEach(() => resetPlatformAuthorityInstrumentation())
afterEach(() => resetPlatformAuthorityInstrumentation())

describe('platformAuthorityMetrics handler', () => {
  it('returns a clean snapshot + gate', () => {
    const res = fakeRes()
    platformAuthorityMetrics({}, res)
    expect(res.json).toHaveBeenCalledTimes(1)
    expect(res.json.mock.calls[0][0]).toMatchObject({ whole_db_reads: 0, request_path_reads_disabled: true, gate: { ok: true, violations: [] } })
  })

  it('surfaces a request-path violation', () => {
    recordWholeDbRead('postgresAuthority')
    const res = fakeRes()
    platformAuthorityMetrics({}, res)
    expect(res.json.mock.calls[0][0].gate).toMatchObject({ ok: false, request_path_reads: 1, violations: [{ source: 'postgresAuthority', reads: 1 }] })
  })
})

describe('requireInternalMetricsAuth', () => {
  const saved = { INTERNAL_METRICS_SECRET: process.env.INTERNAL_METRICS_SECRET, TRUST_INGEST_SECRET: process.env.TRUST_INGEST_SECRET }
  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('fails closed when unconfigured', () => {
    delete process.env.INTERNAL_METRICS_SECRET
    delete process.env.TRUST_INGEST_SECRET
    const res = fakeRes()
    requireInternalMetricsAuth({ get: () => '' }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(503)
  })

  it('rejects a wrong secret and accepts the configured one', () => {
    process.env.INTERNAL_METRICS_SECRET = 'right-secret'
    const denied = fakeRes()
    requireInternalMetricsAuth({ get: () => 'wrong-secret' }, denied, vi.fn())
    expect(denied.status).toHaveBeenCalledWith(401)

    const next = vi.fn()
    requireInternalMetricsAuth({ get: () => 'right-secret' }, fakeRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('falls back to TRUST_INGEST_SECRET when no dedicated secret is set', () => {
    delete process.env.INTERNAL_METRICS_SECRET
    process.env.TRUST_INGEST_SECRET = 'trust-secret'
    const next = vi.fn()
    requireInternalMetricsAuth({ get: () => 'trust-secret' }, fakeRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
