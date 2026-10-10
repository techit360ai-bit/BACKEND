// Source re-verification intervals ("SYNC_INTERVALS") for continuous
// verification (WS9).
//
// This is the single Node-side source of truth for how long a verified source
// stays fresh and therefore when it must be re-observed. It mirrors
// ai-router/trust_engine_lite.py `TrustEngineComputer.SYNC_INTERVALS` so the
// Node reverification scheduler and the AI-router `TrustRefreshPlanner` agree
// on the same clocks. Every value is env-overridable with a per-source
// `TRUST_SYNC_INTERVAL_<SOURCE>_MS` and never guessed from request data.

const HOUR_MS = 3600 * 1000
const DAY_MS = 24 * HOUR_MS

export const DEFAULT_SYNC_INTERVAL_MS = 7 * DAY_MS

export const SYNC_INTERVALS_MS = Object.freeze({
  email: 365 * DAY_MS,
  phone: 365 * DAY_MS,
  github: 1 * DAY_MS,
  linkedin: 30 * DAY_MS,
  domain: 7 * DAY_MS,
  website: 7 * DAY_MS,
  organization: 90 * DAY_MS,
  deployment: 12 * HOUR_MS,
  product_analytics: 1 * DAY_MS,
  revenue: 1 * DAY_MS,
  team: 30 * DAY_MS,
  milestone: 180 * DAY_MS,
  identity: 365 * DAY_MS,
})

const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeSource = source => String(source || '').trim().toLowerCase()

// Minimum 60s so a mistyped env value can never make a source flap every tick.
export function syncIntervalMsFor(source, env = process.env) {
  const key = normalizeSource(source)
  const base = SYNC_INTERVALS_MS[key] ?? DEFAULT_SYNC_INTERVAL_MS
  const override = env[`TRUST_SYNC_INTERVAL_${key.toUpperCase()}_MS`]
  return Math.max(60_000, num(override, base))
}

export function syncIntervalDaysFor(source, env = process.env) {
  return syncIntervalMsFor(source, env) / DAY_MS
}

// Returns the ISO instant a source verified at `verifiedAt` should be
// considered stale and auto-expired. Never returns null: every verified source
// carries an expiry so a badge can never go stale silently.
export function expiryForSource(source, verifiedAt = new Date(), env = process.env) {
  const base = verifiedAt instanceof Date ? verifiedAt.getTime() : new Date(verifiedAt).getTime()
  const startedAt = Number.isFinite(base) ? base : Date.now()
  return new Date(startedAt + syncIntervalMsFor(source, env)).toISOString()
}

// True when `expiresAt` is missing (treated as due/expired) or in the past.
export function isExpired(expiresAt, now = Date.now()) {
  if (!expiresAt) return true
  const at = new Date(expiresAt).getTime()
  return !Number.isFinite(at) || at <= now
}

export function listSyncIntervals(env = process.env) {
  return Object.keys(SYNC_INTERVALS_MS).map(source => ({
    source,
    interval_ms: syncIntervalMsFor(source, env),
    interval_days: syncIntervalDaysFor(source, env),
  }))
}
