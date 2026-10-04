// Build + runtime identity and production config assertions.
//
// Readiness probes must be able to prove which commit and which configuration a
// deployed instance is running. Values come from the deploy workflow / platform
// env; none of them are secrets.

const PROD_ENVS = new Set(['production', 'staging'])

export const SERVICE_NAME = String(process.env.SERVICE_NAME || 'techit-backend')
export const GIT_SHA = String(
  process.env.GIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'unknown',
)
export const BUILD_TIME = String(process.env.BUILD_TIME || process.env.BUILD_TIMESTAMP || 'unknown')
export const VERSION = String(process.env.APP_VERSION || '0.0.0')

export function currentEnvironment() {
  return String(process.env.ENVIRONMENT || process.env.APP_ENV || process.env.NODE_ENV || 'development')
}

// Kept for callers that just want the boot-time value.
export const ENVIRONMENT = currentEnvironment()

// The deployed SPA origin. Kept here so readiness can report whether the
// runtime allow-list actually includes it (the AWS value is applied separately).
export const EXPECTED_PRODUCTION_ORIGIN = 'https://beta.techitnetwork.com'

export function isProdLike(env = currentEnvironment()) {
  return PROD_ENVS.has(String(env).toLowerCase())
}

export function buildInfo() {
  return {
    service: SERVICE_NAME,
    version: VERSION,
    sha: GIT_SHA,
    builtAt: BUILD_TIME,
    environment: currentEnvironment(),
    uptimeSeconds: Math.round(process.uptime()),
  }
}

export function corsOrigins() {
  return String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
}

/**
 * Fail-closed origin config check. In production/staging the allow-list must be
 * explicit, https and non-wildcard (credentials are enabled, so `*` is invalid).
 */
export function assertCorsConfigured(env = currentEnvironment()) {
  const origins = corsOrigins()
  if (!isProdLike(env)) {
    return { ok: true, detail: origins.length ? origins.join(',') : 'development defaults' }
  }
  if (!origins.length) return { ok: false, detail: 'CORS_ORIGINS must list the deployed frontend origin(s)' }
  if (origins.includes('*')) return { ok: false, detail: 'CORS_ORIGINS must not contain * with credentials enabled' }
  const nonHttps = origins.find(origin => !origin.startsWith('https://'))
  if (nonHttps) return { ok: false, detail: `CORS_ORIGINS must be https in production: ${nonHttps}` }
  return { ok: true, detail: origins.join(',') }
}

export function expectedOriginAllowed() {
  return corsOrigins().includes(EXPECTED_PRODUCTION_ORIGIN)
}

/**
 * Side-effect-free mirror of `validateDatabaseConfig()` for probes. The real
 * validator runs SQLite migrations as a side effect, so it must not be called
 * on every readiness request.
 */
export function databaseConfigStatus() {
  const driver = String(process.env.DB_DRIVER || 'sqlite').toLowerCase()
  if (!['json', 'sqlite', 'postgres'].includes(driver)) {
    return { ok: false, detail: `Unsupported DB_DRIVER "${driver}"` }
  }
  if (process.env.NODE_ENV === 'production' && driver === 'json') {
    return { ok: false, detail: 'DB_DRIVER=json is not allowed in production' }
  }
  if (
    process.env.NODE_ENV === 'production'
    && driver === 'postgres'
    && !process.env.PLATFORM_DATABASE_URL
    && !process.env.DATABASE_URL
  ) {
    return { ok: false, detail: 'PLATFORM_DATABASE_URL or DATABASE_URL is required for postgres in production' }
  }
  return { ok: true, detail: `driver=${driver}` }
}
