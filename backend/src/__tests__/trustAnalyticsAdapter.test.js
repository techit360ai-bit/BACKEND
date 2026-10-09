import { describe, expect, it, vi } from 'vitest'
import {
  buildMetrics,
  fetchProviderAnalytics,
  normalizeAmplitudeSeries,
  normalizeGa4Report,
  normalizeMixpanelSeries,
  normalizePosthogScalar,
  toFraction,
} from '../services/trustAnalyticsAdapter.js'

const NOW = new Date('2026-07-01T12:00:00.000Z').getTime()

describe('analytics metric reducer', () => {
  it('accepts both fraction and percentage rate inputs and clamps', () => {
    expect(toFraction(0.42)).toBe(0.42)
    expect(toFraction(42)).toBe(0.42)
    expect(toFraction(250)).toBe(1)
    expect(toFraction('')).toBeNull()
    expect(toFraction(-1)).toBeNull()
    expect(toFraction('abc')).toBeNull()
  })

  it('builds a canonical metrics envelope with freshness', () => {
    const metrics = buildMetrics({ mau: 1200.4, dau: 300, wau: '600', retentionD7: 40, activationRate: 0.5, asOf: '2026-07-01T06:00:00.000Z', now: NOW, windowDays: 30 })
    expect(metrics).toMatchObject({ mau: 1200, dau: 300, wau: 600, retention_d7: 0.4, activation_rate: 0.5, window_days: 30 })
    expect(metrics.freshness_hours).toBe(6)
  })

  it('reports null freshness and zeroes negatives when data is absent', () => {
    const metrics = buildMetrics({ mau: -5, asOf: null, now: NOW })
    expect(metrics.mau).toBe(0)
    expect(metrics.as_of).toBeNull()
    expect(metrics.freshness_hours).toBeNull()
    expect(metrics.window_days).toBe(30)
  })
})

describe('provider response normalizers', () => {
  it('reads posthog scalar results from arrays or objects', () => {
    expect(normalizePosthogScalar({ results: [[321]] })).toBe(321)
    expect(normalizePosthogScalar({ results: [{ total: 88 }] })).toBe(88)
    expect(normalizePosthogScalar({})).toBe(0)
  })

  it('maps GA4 report metric headers to canonical fields', () => {
    const report = {
      metricHeaders: [{ name: 'active1DayUsers' }, { name: 'active7DayUsers' }, { name: 'active28DayUsers' }, { name: 'engagementRate' }],
      rows: [{ metricValues: [{ value: '100' }, { value: '400' }, { value: '900' }, { value: '0.62' }] }],
    }
    expect(normalizeGa4Report(report)).toMatchObject({ dau: 100, wau: 400, mau: 900, activationRate: 0.62 })
  })

  it('reduces mixpanel value series', () => {
    const payload = { data: { values: { day: 10, week: 40, month: 120, activation_rate: 30 } } }
    expect(normalizeMixpanelSeries(payload)).toMatchObject({ dau: 10, wau: 40, mau: 120, activationRate: 0.3 })
  })

  it('reduces amplitude series to latest/peak', () => {
    const payload = { data: { series: [[1, 2, 5], [3, 4, 9]], xValues: ['a', 'b', 'c'] } }
    expect(normalizeAmplitudeSeries(payload)).toMatchObject({ dau: 5, wau: 9, mau: 9, asOf: 'c' })
  })
})

describe('provider fetchers', () => {
  it('fetches and reduces posthog actives from a read-only credential', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body)
      const sql = body.query.query
      const value = sql.includes('1 DAY') ? 50 : sql.includes('7 DAY') ? 200 : 800
      return { ok: true, status: 200, json: async () => ({ results: [[value]] }) }
    })
    const result = await fetchProviderAnalytics('posthog', 'ph_key', { env: { POSTHOG_HOST: 'https://app.posthog.com' }, fetchImpl, subject: 'proj-1' })
    expect(result.ok).toBe(true)
    expect(result.metrics).toMatchObject({ dau: 50, wau: 200, mau: 800 })
    for (const call of fetchImpl.mock.calls) expect(new URL(String(call[0])).hostname).toBe('app.posthog.com')
  })

  it('requires a subject (project id) for posthog', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchProviderAnalytics('posthog', 'ph_key', { env: {}, fetchImpl })
    expect(result.error).toBe('analytics_subject_required')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reduces a GA4 report when given a pre-minted access token', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ metricHeaders: [{ name: 'active1DayUsers' }, { name: 'active7DayUsers' }, { name: 'active28DayUsers' }], rows: [{ metricValues: [{ value: '10' }, { value: '70' }, { value: '300' }] }] }),
    }))
    const result = await fetchProviderAnalytics('ga4', 'ya29.token', { env: {}, fetchImpl, subject: 'properties/123' })
    expect(result.ok).toBe(true)
    expect(result.metrics).toMatchObject({ dau: 10, wau: 70, mau: 300 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('rejects producer-required providers without a network call', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchProviderAnalytics('supabase', 'key', { env: {}, fetchImpl })
    expect(result.error).toBe('provider_producer_not_wired')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports unsupported providers without a network call', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchProviderAnalytics('segment', 'key', { env: {}, fetchImpl })
    expect(result.error).toBe('unsupported_analytics_provider')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('surfaces provider rejections as errors, not metrics', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    const result = await fetchProviderAnalytics('posthog', 'bad', { env: {}, fetchImpl, subject: 'proj-1' })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('analytics_provider_rejected')
  })
})
