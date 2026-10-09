import { describe, expect, it, vi } from 'vitest'
import {
  buildCadence,
  fetchProviderShipping,
  normalizeCloudflareDeployments,
  normalizeGithubActions,
  normalizeNetlifyDeploys,
  normalizeRailwayDeployments,
  normalizeRenderDeploys,
  normalizeVercelDeployments,
  toFraction,
} from '../services/trustShippingAdapter.js'

const DAY = 86400000
const NOW = new Date('2026-07-31T00:00:00.000Z').getTime()
const ago = days => new Date(NOW - days * DAY).toISOString()

describe('cadence reducer', () => {
  it('computes windowed counts, success rate, and last deploy', () => {
    const deploys = [
      { at: NOW - 1 * DAY, success: true },
      { at: NOW - 3 * DAY, success: false },
      { at: NOW - 40 * DAY, success: true },
      { at: NOW - 80 * DAY, success: true },
    ]
    const cadence = buildCadence({
      deploys,
      mergedPrs: [{ at: NOW - 2 * DAY }, { at: NOW - 50 * DAY }],
      releases: [{ at: NOW - 5 * DAY }],
      uptimes: [0.999, 99.5],
      leadTimeHours: [4, 8],
      now: NOW,
      windowDays: 30,
    })
    expect(cadence.deploys_30d).toBe(2)
    expect(cadence.deploys_90d).toBe(4)
    expect(cadence.deploy_success_rate_30d).toBe(0.5)
    expect(cadence.last_deploy_at).toBe(new Date(NOW - 1 * DAY).toISOString())
    expect(cadence.merged_prs_30d).toBe(1)
    expect(cadence.merged_prs_90d).toBe(2)
    expect(cadence.releases_30d).toBe(1)
    expect(cadence.uptime_30d).toBeCloseTo(0.997, 4)
    expect(cadence.lead_time_hours).toBe(6)
    expect(cadence.window_days).toBe(30)
  })

  it('returns nulls rather than fabricating metrics when there is no data', () => {
    const cadence = buildCadence({ now: NOW })
    expect(cadence.deploys_30d).toBe(0)
    expect(cadence.deploy_success_rate_30d).toBeNull()
    expect(cadence.last_deploy_at).toBeNull()
    expect(cadence.uptime_30d).toBeNull()
    expect(cadence.lead_time_hours).toBeNull()
  })

  it('normalizes percentage/ratio uptime inputs', () => {
    expect(toFraction(0.99)).toBe(0.99)
    expect(toFraction(99)).toBe(0.99)
    expect(toFraction(200)).toBe(1)
    expect(toFraction(-1)).toBeNull()
    expect(toFraction('nope')).toBeNull()
  })
})

describe('provider normalizers', () => {
  it('reduces github actions runs, merged PRs, and releases', () => {
    const result = normalizeGithubActions({
      runs: [{ status: 'completed', conclusion: 'success', updated_at: ago(1) }, { status: 'completed', conclusion: 'failure', updated_at: ago(2) }, { status: 'in_progress', updated_at: ago(3) }],
      pulls: [{ merged_at: ago(2) }, { merged_at: null }],
      releases: [{ published_at: ago(4) }],
    })
    expect(result.deploys).toHaveLength(2)
    expect(result.deploys[0]).toMatchObject({ success: true })
    expect(result.mergedPrs).toHaveLength(1)
    expect(result.releases).toHaveLength(1)
  })

  it('maps each PaaS deploy shape to success/failure', () => {
    expect(normalizeVercelDeployments([{ state: 'READY', createdAt: NOW }, { state: 'ERROR', createdAt: NOW }]).deploys.map(d => d.success)).toEqual([true, false])
    expect(normalizeRenderDeploys([{ deploy: { status: 'live', finishedAt: ago(1) } }, { deploy: { status: 'build_failed', finishedAt: ago(2) } }]).deploys.map(d => d.success)).toEqual([true, false])
    expect(normalizeRailwayDeployments([{ status: 'SUCCESS', createdAt: ago(1) }, { status: 'FAILED', createdAt: ago(2) }]).deploys.map(d => d.success)).toEqual([true, false])
    expect(normalizeCloudflareDeployments([{ latest_stage: { status: 'success' }, created_on: ago(1) }, { latest_stage: { status: 'failure' }, created_on: ago(2) }]).deploys.map(d => d.success)).toEqual([true, false])
    expect(normalizeNetlifyDeploys([{ state: 'ready', created_at: ago(1) }, { state: 'error', created_at: ago(2) }]).deploys.map(d => d.success)).toEqual([true, false])
  })
})

describe('provider fetchers', () => {
  it('fetches and reduces github actions from a read-only token', async () => {
    const fetchImpl = vi.fn(async url => {
      const value = String(url)
      if (value.includes('/actions/runs')) return { ok: true, status: 200, json: async () => ({ workflow_runs: [{ status: 'completed', conclusion: 'success', updated_at: ago(1) }] }) }
      if (value.includes('/pulls')) return { ok: true, status: 200, json: async () => ([{ merged_at: ago(2) }]) }
      if (value.includes('/releases')) return { ok: true, status: 200, json: async () => ([{ published_at: ago(3) }]) }
      throw new Error(`unexpected ${value}`)
    })
    const result = await fetchProviderShipping('github_actions', 'ghp_x', { env: {}, fetchImpl, subject: 'acme/app' })
    expect(result.ok).toBe(true)
    expect(result.deploys).toHaveLength(1)
    for (const call of fetchImpl.mock.calls) expect(new URL(String(call[0])).hostname).toBe('api.github.com')
  })

  it('requires a subject (repo/service/site) for subject-bound providers', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchProviderShipping('render', 'r', { env: {}, fetchImpl })
    expect(result.error).toBe('shipping_subject_required')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports unsupported providers without a network call', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchProviderShipping('jenkins', 'x', { env: {}, fetchImpl })
    expect(result.error).toBe('unsupported_shipping_provider')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('surfaces provider rejections as errors, not cadence', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }))
    const result = await fetchProviderShipping('vercel', 'bad', { env: {}, fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('shipping_provider_rejected')
  })
})
