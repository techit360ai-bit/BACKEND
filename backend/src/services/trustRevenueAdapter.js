// Read-only revenue adapters (WS3).
//
// Fetches subscriptions/charges from the founder's own payment provider using a
// read-only credential, then computes aggregates client-side (in the authority,
// never trusting provider-reported totals). Only aggregates leave this module:
// no customer records, emails, or raw payloads are returned or persisted.
//
// `computeRevenueAggregates` and the `normalize*` mappers are pure and unit
// tested. Network calls go through safeFetch with a host allow-list.

import { safeFetch } from './outboundHttpService.js'
import { findRevenueProvider, resolveRevenueConfig } from '../config/trustRevenueSources.js'

const round = (value, places = 2) => {
  const factor = 10 ** places
  return Math.round((Number(value) || 0) * factor) / factor
}

// Average number of each interval in a month.
const MONTHLY_UNITS = { day: 365.25 / 12, week: 52 / 12, month: 1, year: 12 }
export const monthlyFactor = (interval, intervalCount = 1) => {
  const perMonth = MONTHLY_UNITS[String(interval || '').toLowerCase()]
  const count = Number(intervalCount) > 0 ? Number(intervalCount) : 1
  return perMonth ? (1 / perMonth) / count : 0
}

const BILLABLE = new Set(['active', 'trialing', 'past_due'])
const toAmount = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function detectCredentialMode(provider, credential) {
  const entry = findRevenueProvider(provider)
  const prefixes = entry?.key_prefixes || {}
  const value = String(credential || '')
  for (const [mode, list] of Object.entries(prefixes)) {
    if (list.some(prefix => value.startsWith(prefix))) return mode
  }
  return null
}

// --- pure mappers -----------------------------------------------------------

export function normalizeStripeSubscriptions(subscriptions = []) {
  return subscriptions.map(sub => {
    const items = sub?.items?.data || []
    const mrr = items.reduce((sum, item) => {
      const price = item?.price || {}
      const amount = toAmount(price.unit_amount) / 100
      const quantity = Number(item?.quantity) > 0 ? Number(item.quantity) : 1
      return sum + amount * quantity * monthlyFactor(price?.recurring?.interval, price?.recurring?.interval_count)
    }, 0)
    return {
      customerId: typeof sub?.customer === 'string' ? sub.customer : sub?.customer?.id || null,
      status: String(sub?.status || '').toLowerCase(),
      currency: String(sub?.currency || items[0]?.price?.currency || 'usd').toUpperCase(),
      mrr: round(mrr),
      createdAt: sub?.created ? new Date(Number(sub.created) * 1000).toISOString() : null,
      canceledAt: sub?.canceled_at ? new Date(Number(sub.canceled_at) * 1000).toISOString() : null,
      livemode: sub?.livemode === true,
    }
  })
}

export function normalizeStripeCharges(charges = []) {
  return charges.map(charge => ({
    customerId: typeof charge?.customer === 'string' ? charge.customer : charge?.customer?.id || null,
    amount: round(toAmount(charge?.amount) / 100),
    currency: String(charge?.currency || 'usd').toUpperCase(),
    status: String(charge?.status || '').toLowerCase(),
    paid: charge?.paid === true,
    createdAt: charge?.created ? new Date(Number(charge.created) * 1000).toISOString() : null,
    livemode: charge?.livemode === true,
  }))
}

export function normalizePaystackSubscriptions(subscriptions = []) {
  return subscriptions.map(sub => {
    const interval = String(sub?.plan?.interval || sub?.interval || 'monthly').toLowerCase()
    const intervalMap = { hourly: 'hour', daily: 'day', weekly: 'week', monthly: 'month', quarterly: 'month', biannually: 'month', annually: 'year' }
    const countMap = { quarterly: 3, biannually: 6 }
    const kind = intervalMap[interval] || 'month'
    const count = countMap[interval] || 1
    const amount = toAmount(sub?.amount) / 100
    const active = ['active', 'non-renewing', 'attention'].includes(String(sub?.status || '').toLowerCase())
    return {
      customerId: sub?.customer == null ? null : String(sub.customer),
      status: active ? 'active' : String(sub?.status || '').toLowerCase(),
      currency: String(sub?.plan?.currency || sub?.currency || 'ngn').toUpperCase(),
      mrr: active ? round(amount * monthlyFactor(kind, count)) : 0,
      createdAt: sub?.createdAt || null,
      canceledAt: null,
      livemode: String(sub?.plan?.currency || '').toUpperCase() !== 'NGN-TEST',
    }
  })
}

export function normalizePaddleSubscriptions(subscriptions = []) {
  return subscriptions.map(sub => {
    const interval = String(sub?.billing_cycle?.interval || sub?.interval || 'month').toLowerCase()
    const count = Number(sub?.billing_cycle?.frequency || sub?.frequency || 1)
    const amount = toAmount(sub?.items?.[0]?.price?.unit_price?.amount ?? sub?.recurring_transaction_details?.unit_price?.amount) / 100
    return {
      customerId: sub?.customer_id || null,
      status: String(sub?.status || '').toLowerCase(),
      currency: String(sub?.currency_code || sub?.items?.[0]?.price?.unit_price?.currency_code || 'usd').toUpperCase(),
      mrr: round(amount * monthlyFactor(interval, count)),
      createdAt: sub?.created_at || null,
      canceledAt: sub?.canceled_at || null,
      livemode: !String(sub?.id || '').startsWith('sub_test'),
    }
  })
}

export function normalizeFlutterwaveSubscriptions(subscriptions = []) {
  return subscriptions.map(sub => {
    const interval = String(sub?.plan?.interval || sub?.interval || 'monthly').toLowerCase()
    const map = { daily: 'day', weekly: 'week', monthly: 'month', quarterly: 'month', yearly: 'year' }
    const kind = map[interval] || 'month'
    const count = interval === 'quarterly' ? 3 : 1
    const amount = toAmount(sub?.amount)
    const active = ['active', 'live', 'successful'].includes(String(sub?.status || '').toLowerCase())
    return {
      customerId: sub?.customer == null ? null : String(sub.customer),
      status: active ? 'active' : String(sub?.status || '').toLowerCase(),
      currency: String(sub?.currency || sub?.plan?.currency || 'usd').toUpperCase(),
      mrr: active ? round(amount * monthlyFactor(kind, count)) : 0,
      createdAt: sub?.created_at || null,
      canceledAt: null,
      livemode: String(sub?.currency || '').toUpperCase() !== 'TEST',
    }
  })
}

export function normalizeRazorpaySubscriptions(subscriptions = []) {
  return subscriptions.map(sub => {
    const interval = String(sub?.plan?.period || sub?.period || 'monthly').toLowerCase()
    const map = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }
    const kind = map[interval] || 'month'
    const count = Number(sub?.plan?.interval || sub?.interval || 1)
    const amount = toAmount(sub?.plan?.item?.amount) / 100
    const active = ['active', 'authenticated'].includes(String(sub?.status || '').toLowerCase())
    return {
      customerId: sub?.customer_id || null,
      status: active ? 'active' : String(sub?.status || '').toLowerCase(),
      currency: String(sub?.plan?.item?.currency || sub?.currency || 'inr').toUpperCase(),
      mrr: active ? round(amount * monthlyFactor(kind, count)) : 0,
      createdAt: sub?.created_at ? new Date(Number(sub.created_at) * 1000).toISOString() : null,
      canceledAt: sub?.canceled_at ? new Date(Number(sub.canceled_at) * 1000).toISOString() : null,
      livemode: !String(sub?.id || '').includes('test'),
    }
  })
}

function dominantCurrency(subscriptions, charges) {
  const counts = new Map()
  for (const item of [...subscriptions, ...charges]) {
    if (!item.currency) continue
    counts.set(item.currency, (counts.get(item.currency) || 0) + 1)
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return { currency: ranked[0]?.[0] || null, currencies: ranked.map(([code]) => code) }
}

// Pure aggregate computation. `priorSubscriptions`, when supplied by a provider
// history endpoint, enables honest net revenue retention; otherwise NRR is null
// rather than fabricated.
export function computeRevenueAggregates({
  subscriptions = [],
  charges = [],
  priorSubscriptions = null,
  asOf = new Date(),
  windowDays = 30,
  costsAmount = null,
} = {}) {
  const { currency, currencies } = dominantCurrency(subscriptions, charges)
  const scoped = currency ? subscriptions.filter(item => item.currency === currency) : subscriptions
  const scopedCharges = currency ? charges.filter(item => item.currency === currency) : charges
  const billable = scoped.filter(item => BILLABLE.has(item.status))
  const asOfTime = new Date(asOf).getTime()
  const windowStart = asOfTime - windowDays * 86400000

  const mrr = round(billable.reduce((sum, item) => sum + toAmount(item.mrr), 0))
  const payingFromSubs = new Set(billable.map(item => item.customerId).filter(Boolean))
  const recentPaidCharges = scopedCharges.filter(charge => charge.paid && charge.status === 'succeeded' && (!charge.createdAt || new Date(charge.createdAt).getTime() >= windowStart))
  const payingFromCharges = new Set(recentPaidCharges.map(charge => charge.customerId).filter(Boolean))
  const payingCustomers = new Set([...payingFromSubs, ...payingFromCharges]).size

  const canceledInWindow = scoped.filter(item => item.canceledAt && new Date(item.canceledAt).getTime() >= windowStart).length
  const churnDenominator = billable.length + canceledInWindow
  const churnRate = churnDenominator > 0 ? round(canceledInWindow / churnDenominator, 6) : 0

  let netRevenueRetention = null
  if (Array.isArray(priorSubscriptions)) {
    const prior = currency ? priorSubscriptions.filter(item => item.currency === currency) : priorSubscriptions
    const priorMrr = prior.filter(item => BILLABLE.has(item.status)).reduce((sum, item) => sum + toAmount(item.mrr), 0)
    if (priorMrr > 0) netRevenueRetention = round(mrr / priorMrr, 4)
  }

  let grossMargin = null
  if (costsAmount != null && mrr > 0) grossMargin = round((mrr - toAmount(costsAmount)) / mrr, 4)

  const grossRevenue30d = round(recentPaidCharges.reduce((sum, charge) => sum + toAmount(charge.amount), 0))

  return {
    mrr,
    arr: round(mrr * 12),
    paying_customers: payingCustomers,
    churn_rate: churnRate,
    net_revenue_retention: netRevenueRetention,
    gross_margin: grossMargin,
    gross_revenue_30d: grossRevenue30d,
    currency: currency ? currency.toLowerCase() : null,
    currencies,
    active_subscriptions: billable.length,
    canceled_in_window: canceledInWindow,
    window_days: windowDays,
    as_of: new Date(asOf).toISOString(),
  }
}

// --- network fetchers -------------------------------------------------------

async function getJson(fetchImpl, url, { headers, timeoutMs, hosts }) {
  const response = await fetchImpl(url, { method: 'GET', headers, signal: AbortSignal.timeout(timeoutMs) }, { schemes: ['https'], allowHosts: hosts })
  if (!response.ok) return { ok: false, status: response.status, error: 'revenue_provider_rejected' }
  const data = await response.json().catch(() => null)
  if (!data) return { ok: false, status: 502, error: 'revenue_provider_invalid_response' }
  return { ok: true, data }
}

async function stripeGet(fetchImpl, entry, credential, path, { config, params = {} } = {}) {
  const url = new URL(path, entry.base_url)
  for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, String(value))
  return getJson(fetchImpl, url.toString(), {
    headers: { authorization: `Bearer ${credential}`, accept: 'application/json', 'stripe-version': '2024-06-20' },
    timeoutMs: config.timeoutMs,
    hosts: entry.hosts,
  })
}

async function fetchStripe(credential, { config, fetchImpl }) {
  const entry = findRevenueProvider('stripe')
  const account = await stripeGet(fetchImpl, entry, credential, '/v1/account', { config })
  if (!account.ok) return account

  const subscriptions = []
  let startingAfter = null
  for (let page = 0; page < 50; page += 1) {
    const result = await stripeGet(fetchImpl, entry, credential, '/v1/subscriptions', {
      config,
      params: { status: 'all', limit: 100, expand: 'data.items', starting_after: startingAfter },
    })
    if (!result.ok) return result
    const rows = result.data?.data || []
    subscriptions.push(...rows)
    if (!result.data?.has_more || !rows.length) break
    startingAfter = rows[rows.length - 1].id
    if (subscriptions.length >= config.maxRecords) break
  }

  const charges = []
  const chargeResult = await stripeGet(fetchImpl, entry, credential, '/v1/charges', { config, params: { limit: 100 } })
  if (chargeResult.ok) charges.push(...(chargeResult.data?.data || []))

  const normalizedSubs = normalizeStripeSubscriptions(subscriptions)
  const normalizedCharges = normalizeStripeCharges(charges)
  const modes = new Set([...normalizedSubs, ...normalizedCharges].map(item => item.livemode))
  return {
    ok: true,
    provider: 'stripe',
    mode: modes.has(true) && modes.size === 1 ? 'live' : modes.has(false) && modes.size === 1 ? 'test' : null,
    livemode: modes.size === 1 ? modes.has(true) : null,
    subject: account.data?.id || null,
    accountDomain: domainFromAccount(account.data),
    subscriptions: normalizedSubs,
    charges: normalizedCharges,
  }
}

function domainFromAccount(account = {}) {
  const raw = account?.business_profile?.url || account?.email || ''
  const value = String(raw).trim()
  if (!value) return null
  try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
}

async function fetchPaystack(credential, { config, fetchImpl }, entry) {
  const result = await getJson(fetchImpl, `${entry.base_url}/subscription?perPage=100`, {
    headers: { authorization: `Bearer ${credential}`, accept: 'application/json' }, timeoutMs: config.timeoutMs, hosts: entry.hosts,
  })
  if (!result.ok) return result
  return { ok: true, provider: 'paystack', mode: null, livemode: null, subject: null, accountDomain: null, subscriptions: normalizePaystackSubscriptions(result.data?.data || []), charges: [] }
}

async function fetchPaddle(credential, { config, fetchImpl }, entry) {
  const result = await getJson(fetchImpl, `${entry.base_url}/subscriptions?per_page=200`, {
    headers: { authorization: `Bearer ${credential}`, accept: 'application/json' }, timeoutMs: config.timeoutMs, hosts: entry.hosts,
  })
  if (!result.ok) return result
  return { ok: true, provider: 'paddle', mode: null, livemode: null, subject: null, accountDomain: null, subscriptions: normalizePaddleSubscriptions(result.data?.data || []), charges: [] }
}

async function fetchFlutterwave(credential, { config, fetchImpl }, entry) {
  const result = await getJson(fetchImpl, `${entry.base_url}/v3/subscriptions?page=1`, {
    headers: { authorization: `Bearer ${credential}`, accept: 'application/json' }, timeoutMs: config.timeoutMs, hosts: entry.hosts,
  })
  if (!result.ok) return result
  return { ok: true, provider: 'flutterwave', mode: null, livemode: null, subject: null, accountDomain: null, subscriptions: normalizeFlutterwaveSubscriptions(result.data?.data || []), charges: [] }
}

async function fetchRazorpay(credential, { config, fetchImpl }, entry) {
  const [keyId, keySecret] = String(credential).split(':')
  if (!keyId || !keySecret) return { ok: false, status: 400, error: 'razorpay_credential_invalid' }
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const result = await getJson(fetchImpl, `${entry.base_url}/v1/subscriptions?count=100`, {
    headers: { authorization: `Basic ${auth}`, accept: 'application/json' }, timeoutMs: config.timeoutMs, hosts: entry.hosts,
  })
  if (!result.ok) return result
  return { ok: true, provider: 'razorpay', mode: null, livemode: null, subject: null, accountDomain: null, subscriptions: normalizeRazorpaySubscriptions(result.data?.items || []), charges: [] }
}

const FETCHERS = { stripe: fetchStripe, paystack: fetchPaystack, paddle: fetchPaddle, flutterwave: fetchFlutterwave, razorpay: fetchRazorpay }

export async function fetchProviderRevenue(provider, credential, { env = process.env, fetchImpl = safeFetch } = {}) {
  const key = String(provider || '').toLowerCase()
  const entry = findRevenueProvider(key)
  if (!entry) return { ok: false, status: 404, error: 'unsupported_revenue_provider' }
  const fetcher = FETCHERS[key]
  if (!fetcher) return { ok: false, status: 501, error: 'revenue_provider_not_implemented' }
  const config = resolveRevenueConfig(env)
  try {
    return await fetcher(credential, { config, fetchImpl }, entry)
  } catch (error) {
    const code = /timeout|abort/i.test(error?.name || '') ? 'revenue_provider_timeout' : 'revenue_provider_unavailable'
    return { ok: false, status: 502, error: code, detail: error?.message }
  }
}
