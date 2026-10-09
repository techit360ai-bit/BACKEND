import { describe, expect, it, vi } from 'vitest'
import {
  computeRevenueAggregates,
  detectCredentialMode,
  fetchProviderRevenue,
  monthlyFactor,
  normalizeStripeCharges,
  normalizeStripeSubscriptions,
} from '../services/trustRevenueAdapter.js'

const AS_OF = '2026-06-30T00:00:00.000Z'

function stripeResponse(url) {
  if (url.includes('/v1/account')) {
    return { id: 'acct_1', business_profile: { url: 'https://acme.com' }, email: 'billing@acme.com' }
  }
  if (url.includes('/v1/subscriptions')) {
    return {
      has_more: false,
      data: [
        { id: 'sub_1', status: 'active', livemode: false, currency: 'usd', customer: 'cus_1', created: 1717200000, items: { data: [{ quantity: 1, price: { unit_amount: 2000, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } } }] } },
        { id: 'sub_2', status: 'active', livemode: false, currency: 'usd', customer: 'cus_2', created: 1717200000, items: { data: [{ quantity: 1, price: { unit_amount: 120000, currency: 'usd', recurring: { interval: 'year', interval_count: 1 } } }] } },
        { id: 'sub_3', status: 'canceled', livemode: false, currency: 'usd', customer: 'cus_3', created: 1717200000, canceled_at: Math.floor(new Date('2026-06-10T00:00:00Z').getTime() / 1000), items: { data: [] } },
      ],
    }
  }
  if (url.includes('/v1/charges')) {
    return { data: [
      { id: 'ch_1', customer: 'cus_1', amount: 2000, currency: 'usd', status: 'succeeded', paid: true, livemode: false, created: Math.floor(new Date('2026-06-15T00:00:00Z').getTime() / 1000) },
      { id: 'ch_2', customer: 'cus_4', amount: 5000, currency: 'usd', status: 'succeeded', paid: true, livemode: false, created: Math.floor(new Date('2026-06-20T00:00:00Z').getTime() / 1000) },
    ] }
  }
  throw new Error(`unexpected url ${url}`)
}

describe('revenue adapter aggregates', () => {
  it('normalizes stripe subscriptions to monthly recurring revenue', () => {
    const subs = normalizeStripeSubscriptions([
      { status: 'active', currency: 'usd', customer: 'cus_1', items: { data: [{ quantity: 1, price: { unit_amount: 2000, recurring: { interval: 'month' } } }] } },
      { status: 'active', currency: 'usd', customer: 'cus_2', items: { data: [{ quantity: 1, price: { unit_amount: 120000, recurring: { interval: 'year' } } }] } },
    ])
    expect(subs[0].mrr).toBe(20)
    expect(subs[1].mrr).toBe(100)
  })

  it('computes mrr/arr/paying customers/churn deterministically', () => {
    const subscriptions = normalizeStripeSubscriptions(stripeResponse('https://api.stripe.com/v1/subscriptions').data)
    const charges = normalizeStripeCharges(stripeResponse('https://api.stripe.com/v1/charges').data)
    const aggregates = computeRevenueAggregates({ subscriptions, charges, asOf: AS_OF, windowDays: 30 })
    expect(aggregates.mrr).toBe(120)
    expect(aggregates.arr).toBe(1440)
    expect(aggregates.paying_customers).toBe(3) // cus_1, cus_2 (subs) + cus_4 (one-time charge)
    expect(aggregates.gross_revenue_30d).toBe(70)
    expect(aggregates.active_subscriptions).toBe(2)
    expect(aggregates.churn_rate).toBeCloseTo(0.333333, 5)
    expect(aggregates.net_revenue_retention).toBeNull()
    expect(aggregates.currency).toBe('usd')
  })

  it('keeps currencies separate instead of summing across them', () => {
    const subscriptions = [
      { customerId: 'a', status: 'active', currency: 'USD', mrr: 100, canceledAt: null },
      { customerId: 'b', status: 'active', currency: 'NGN', mrr: 5000, canceledAt: null },
      { customerId: 'c', status: 'active', currency: 'NGN', mrr: 2500, canceledAt: null },
    ]
    const aggregates = computeRevenueAggregates({ subscriptions, asOf: AS_OF })
    expect(aggregates.mrr).toBe(7500)
    expect(aggregates.currency).toBe('ngn')
    expect(aggregates.currencies).toEqual(['NGN', 'USD'])
  })

  it('computes net revenue retention only when a prior snapshot is supplied', () => {
    const subscriptions = [{ customerId: 'a', status: 'active', currency: 'USD', mrr: 150, canceledAt: null }]
    const prior = [{ customerId: 'a', status: 'active', currency: 'USD', mrr: 100 }]
    expect(computeRevenueAggregates({ subscriptions, priorSubscriptions: prior, asOf: AS_OF }).net_revenue_retention).toBe(1.5)
  })

  it('maps billing intervals to monthly factors', () => {
    expect(monthlyFactor('month')).toBe(1)
    expect(monthlyFactor('year')).toBeCloseTo(1 / 12, 6)
    expect(monthlyFactor('month', 3)).toBeCloseTo(1 / 3, 6)
    expect(monthlyFactor('bogus')).toBe(0)
  })
})

describe('revenue adapter provider reads', () => {
  it('detects credential mode from the read-only key prefix', () => {
    expect(detectCredentialMode('stripe', 'rk_live_abc')).toBe('live')
    expect(detectCredentialMode('stripe', 'rk_test_abc')).toBe('test')
    expect(detectCredentialMode('paystack', 'sk_live_abc')).toBe('live')
    expect(detectCredentialMode('stripe', 'unknown')).toBeNull()
  })

  it('fetches and normalizes a stripe account read-only', async () => {
    const fetchImpl = vi.fn(async url => ({ ok: true, status: 200, json: async () => stripeResponse(String(url)) }))
    const result = await fetchProviderRevenue('stripe', 'rk_test_123', { env: {}, fetchImpl })
    expect(result.ok).toBe(true)
    expect(result.livemode).toBe(false)
    expect(result.subject).toBe('acct_1')
    expect(result.accountDomain).toBe('acme.com')
    expect(result.subscriptions).toHaveLength(3)
    // h0st allow-list is enforced by safeFetch; injected fetch must only see stripe hosts
    for (const call of fetchImpl.mock.calls) expect(new URL(String(call[0])).hostname).toBe('api.stripe.com')
  })

  it('reports unsupported providers without calling the network', async () => {
    const fetchImpl = vi.fn()
    const result = await fetchProviderRevenue('square', 'key', { env: {}, fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('unsupported_revenue_provider')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
