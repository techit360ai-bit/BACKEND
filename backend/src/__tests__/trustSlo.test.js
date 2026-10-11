import { describe, expect, it } from 'vitest'
import { trustSloConfig } from '../config/trustSlo.js'

describe('trust SLO config (WS11)', () => {
  it('defaults to the k6 gate and an unsigned (untuned) profile', () => {
    const slo = trustSloConfig({})
    expect(slo.p95_ms).toBe(300)
    expect(slo.p99_ms).toBe(800)
    expect(slo.error_rate).toBe(0.001)
    expect(slo.target_peak_rps).toBeNull()
    expect(slo.outbox_depth_alert).toBe(500)
    expect(slo.signed_off).toBe(false)
  })

  it('derives peak RPS and outbox depth from a sign-off target', () => {
    const slo = trustSloConfig({ TRUST_TARGET_DAU: '8640000', TRUST_PEAK_FACTOR: '6', TRUST_OUTBOX_MAX_LAG_SECONDS: '30' })
    // 8.64M DAU / 86400s * 6 = 600 peak RPS; depth = 600 * 30 = 18000.
    expect(slo.target_peak_rps).toBe(600)
    expect(slo.outbox_depth_alert).toBe(18000)
    expect(slo.signed_off).toBe(true)
  })

  it('honors an explicit peak RPS and explicit thresholds over derived values', () => {
    const slo = trustSloConfig({ TRUST_TARGET_PEAK_RPS: '250', TRUST_OUTBOX_DEPTH_ALERT: '10', TRUST_TARGET_DAU: '100000' })
    expect(slo.target_peak_rps).toBe(250)
    expect(slo.outbox_depth_alert).toBe(10)
  })
})
