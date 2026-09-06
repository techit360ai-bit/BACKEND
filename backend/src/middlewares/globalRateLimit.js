import { createClient } from 'redis'

const WINDOW_SECONDS = 60
const localBuckets = new Map()
let redisPromise

function positiveInt(name, fallback) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function limitFor(req) {
  const configured = positiveInt('GLOBAL_API_REQUESTS_PER_MINUTE', 600)
  const authenticated = Boolean(req.user?.id || req.headers.authorization)
  return authenticated ? positiveInt('GLOBAL_AUTH_REQUESTS_PER_MINUTE', configured) : configured
}

function redisEnabled() {
  return Boolean(process.env.REDIS_URL) && process.env.GLOBAL_RATE_LIMIT_REDIS !== 'false'
}

async function getRedis() {
  if (!redisEnabled()) return null
  if (!redisPromise) {
    const client = createClient({ url: process.env.REDIS_URL })
    client.on('error', error => console.error(JSON.stringify({ event: 'global_rate_limit_redis_error', error: error.message })))
    redisPromise = client.connect().then(() => client).catch(error => {
      redisPromise = null
      if (process.env.REQUIRE_SHARED_STATE === 'true' && process.env.NODE_ENV !== 'test') throw error
      return null
    })
  }
  return redisPromise
}

function localCheck(key, limit) {
  const now = Date.now()
  const cutoff = now - WINDOW_SECONDS * 1000
  const events = (localBuckets.get(key) || []).filter(timestamp => timestamp > cutoff)
  if (events.length >= limit) {
    localBuckets.set(key, events)
    return { allowed: false, remaining: 0, resetSeconds: Math.max(1, Math.ceil((events[0] + WINDOW_SECONDS * 1000 - now) / 1000)) }
  }
  events.push(now)
  localBuckets.set(key, events)
  return { allowed: true, remaining: Math.max(0, limit - events.length), resetSeconds: WINDOW_SECONDS }
}

export function globalRateLimit(options = {}) {
  const prefix = options.prefix || 'techit:api:rate'
  return async function globalRateLimitMiddleware(req, res, next) {
    if (process.env.NODE_ENV === 'test' || req.path === '/health' || req.path === '/ready') return next()
    const key = `${prefix}:${req.ip || 'unknown'}`
    const limit = limitFor(req)
    let result
    try {
      const redis = await getRedis()
      if (redis) {
        const redisKey = `${key}:${Math.floor(Date.now() / (WINDOW_SECONDS * 1000))}`
        const count = Number(await redis.incr(redisKey))
        if (count === 1) await redis.expire(redisKey, WINDOW_SECONDS + 5)
        result = { allowed: count <= limit, remaining: Math.max(0, limit - count), resetSeconds: WINDOW_SECONDS }
      } else {
        result = localCheck(key, limit)
      }
    } catch (error) {
      if (process.env.REQUIRE_SHARED_STATE === 'true' && process.env.NODE_ENV !== 'test') {
        return res.status(503).json({ error: 'rate_limit_capacity_unavailable', retryAfterSeconds: WINDOW_SECONDS })
      }
      result = localCheck(key, limit)
    }
    res.setHeader('RateLimit-Limit', String(limit))
    res.setHeader('RateLimit-Remaining', String(result.remaining))
    res.setHeader('RateLimit-Reset', String(result.resetSeconds))
    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.resetSeconds))
      return res.status(429).json({ error: 'api_rate_limit_exceeded', retryAfterSeconds: result.resetSeconds })
    }
    return next()
  }
}
