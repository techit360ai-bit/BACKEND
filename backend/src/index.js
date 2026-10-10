import app from './app.js'
import { validateDatabaseConfig } from './config/database.js'
import { initializeDiscoveryInfrastructure } from './services/discoveryInfrastructure.js'
import { generateReverificationNotifications } from './services/trustVerificationService.js'
import { runRevenueRefresh } from './services/trustRevenueService.js'
import { runAnalyticsRefresh } from './services/trustAnalyticsService.js'
import { runShippingRefresh } from './services/trustShippingService.js'
import { runTeamRefresh } from './services/trustTeamService.js'
import { runIdentityRefresh } from './services/trustIdentityService.js'
import { runTrustReverificationTick } from './services/trustReverificationService.js'
import { flushTrustProjectionOutboxFromRepository } from './services/trustProjectionOutboxWorker.js'
import { initializeTrustPostgresProjection } from './services/trustPostgresProjection.js'
import { initializeIdentityPostgresProjection } from './services/identityPostgresProjection.js'
import { initializeWorkspaceProjectProjection } from './services/workspaceProjectPostgresProjection.js'
import { initializeContentPostgresProjection } from './services/contentPostgresProjection.js'
import { initializeFinancePostgresProjection } from './services/financePostgresProjection.js'
import { initializePlatformCollectionSchema } from './repositories/platformCollectionRepository.js'
import { cleanupSessionsAsync } from './services/sessionService.js'
import { runDealRoomMaintenance } from './services/investorDealRoomCompletionService.js'
import { runOrganizationIntelligenceMaintenance } from './services/organizationIntelligenceService.js'
import { runMaintenance as runSupportMaintenance } from './services/supportService.js'
import { runWithPlatformDatabase } from './repositories/platformDatabaseRepository.js'
import { initializeOrganizationCommercialProjection } from './repositories/organizationOperationsRepository.js'

const PORT = process.env.PORT || 3000
const runMaintenance = async (callback, actorId = null) => {
  if (process.env.DB_DRIVER === 'postgres' || process.env.PLATFORM_REQUEST_AUTHORITY === 'postgres') return runWithPlatformDatabase(() => callback(), { userId: actorId })
  return callback()
}

function validateSecurityConfig() {
  if (process.env.NODE_ENV !== 'production') return
  for (const name of [
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'GITHUB_TOKEN_ENCRYPTION_KEY',
    'OTP_HASH_SECRET',
    'AI_ROUTER_SETTLEMENT_SECRET',
    'ADMIN_AI_ROUTER_TELEMETRY_SECRET',
    'AI_USAGE_GRANT_SERVICE_SECRET',
    'AI_EXECUTION_GRANT_SECRET',
    'VERIFICATION_AUDIT_HMAC_KEY',
    'MFA_ENCRYPTION_KEY',
    'MFA_ASSERTION_SECRET',
    'TRUST_CREDENTIAL_ENCRYPTION_KEY',
  ]) {
    if (!process.env[name]) throw new Error(`${name} is required in production`)
  }
  for (const name of ['EVIDENCE_STORAGE_ENDPOINT', 'EVIDENCE_STORAGE_BUCKET', 'EVIDENCE_STORAGE_ACCESS_KEY', 'EVIDENCE_STORAGE_SECRET_KEY', 'CLAMAV_HOST']) {
    if (!process.env[name]) throw new Error(`${name} is required in production`)
  }
  for (const name of ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'GITHUB_REDIRECT_URI']) {
    const value = process.env[name] || ''
    if (!value || /test-github|localhost|replace/i.test(value)) {
      throw new Error(`${name} must be configured for production`)
    }
  }
  if ((process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET must be at least 32 characters')
  for (const name of [
    'GITHUB_TOKEN_ENCRYPTION_KEY',
    'OTP_HASH_SECRET',
    'AI_ROUTER_SETTLEMENT_SECRET',
    'ADMIN_AI_ROUTER_TELEMETRY_SECRET',
    'AI_USAGE_GRANT_SERVICE_SECRET',
    'AI_EXECUTION_GRANT_SECRET',
    'VERIFICATION_AUDIT_HMAC_KEY',
    'MFA_ENCRYPTION_KEY',
    'MFA_ASSERTION_SECRET',
    'TRUST_CREDENTIAL_ENCRYPTION_KEY',
  ]) {
    if ((process.env[name] || '').length < 32) throw new Error(`${name} must be at least 32 characters`)
  }
  if (!process.env.BACKEND_SUPPORT_MAINTENANCE_SECRET || process.env.BACKEND_SUPPORT_MAINTENANCE_SECRET.length < 32) throw new Error('BACKEND_SUPPORT_MAINTENANCE_SECRET must be at least 32 characters')
}

validateDatabaseConfig()
validateSecurityConfig()
if (process.env.DISCOVERY_DATABASE_URL) await initializeDiscoveryInfrastructure()
if (process.env.TRUST_DATABASE_URL || process.env.DATABASE_URL) await initializeTrustPostgresProjection()
if (process.env.IDENTITY_DATABASE_URL || process.env.DATABASE_URL) await initializeIdentityPostgresProjection()
if (process.env.WORKSPACE_DATABASE_URL || process.env.DATABASE_URL) await initializeWorkspaceProjectProjection()
if (process.env.CONTENT_DATABASE_URL || process.env.DATABASE_URL) await initializeContentPostgresProjection()
if (process.env.FINANCE_DATABASE_URL || process.env.DATABASE_URL) await initializeFinancePostgresProjection()
if (process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL || process.env.IDENTITY_DATABASE_URL) await initializePlatformCollectionSchema()
if (process.env.ORGANIZATION_DATABASE_URL || process.env.DATABASE_URL) await initializeOrganizationCommercialProjection()

const reverificationIntervalMs = Math.max(15 * 60 * 1000, Number(process.env.REVERIFICATION_NOTIFICATION_INTERVAL_MS || 24 * 60 * 60 * 1000))
const reverificationTimer = setInterval(() => {
  runMaintenance(() => generateReverificationNotifications()).catch(error => { console.error(JSON.stringify({ event: 'reverification_notification_run_failed', error: error.message })) })
}, reverificationIntervalMs)
reverificationTimer.unref?.()
const sessionCleanupTimer = setInterval(() => { runMaintenance(() => cleanupSessionsAsync()).catch(error => console.error(JSON.stringify({ event: 'session_cleanup_failed', error: error.message }))) }, Math.max(15 * 60 * 1000, Number(process.env.AUTH_CLEANUP_INTERVAL_MS || 24 * 60 * 60 * 1000)))
sessionCleanupTimer.unref?.()
const dealRoomMaintenanceTimer = setInterval(() => { runMaintenance(() => runDealRoomMaintenance()).catch(error => console.error(JSON.stringify({ event: 'deal_room_maintenance_failed', error: error.message }))) }, Math.max(15 * 60 * 1000, Number(process.env.DEAL_ROOM_MAINTENANCE_INTERVAL_MS || 60 * 60 * 1000)))
dealRoomMaintenanceTimer.unref?.()
const organizationIntelligenceTimer = setInterval(() => { runMaintenance(() => runOrganizationIntelligenceMaintenance()).catch(error => console.error(JSON.stringify({ event: 'organization_intelligence_maintenance_failed', error: error.message }))) }, Math.max(15 * 60 * 1000, Number(process.env.ORGANIZATION_INTELLIGENCE_INTERVAL_MS || 60 * 60 * 1000)))
organizationIntelligenceTimer.unref?.()
const supportMaintenanceTimer = setInterval(() => { runMaintenance(() => runSupportMaintenance()).catch(error => console.error(JSON.stringify({ event: 'support_maintenance_failed', error: error.message }))) }, Math.max(60 * 1000, Number(process.env.SUPPORT_MAINTENANCE_INTERVAL_MS || 5 * 60 * 1000)))
supportMaintenanceTimer.unref?.()
// WS3 revenue refresh worker. Off by default so only one replica (or a scheduler)
// runs it; enable with TRUST_REVENUE_REFRESH_ENABLED=true on a single instance.
if (String(process.env.TRUST_REVENUE_REFRESH_ENABLED || '').toLowerCase() === 'true') {
  const revenueRefreshIntervalMs = Math.max(3600_000, Number(process.env.TRUST_REVENUE_SYNC_INTERVAL_MS || 24 * 3600_000))
  const revenueRefreshTimer = setInterval(() => {
    runRevenueRefresh().catch(error => console.error(JSON.stringify({ event: 'revenue_refresh_failed', error: error.message })))
  }, revenueRefreshIntervalMs)
  revenueRefreshTimer.unref?.()
}
// WS4 product analytics refresh worker (daily). Off by default; enable on one
// replica with TRUST_ANALYTICS_REFRESH_ENABLED=true.
if (String(process.env.TRUST_ANALYTICS_REFRESH_ENABLED || '').toLowerCase() === 'true') {
  const analyticsRefreshIntervalMs = Math.max(3600_000, Number(process.env.TRUST_ANALYTICS_SYNC_INTERVAL_MS || 24 * 3600_000))
  const analyticsRefreshTimer = setInterval(() => {
    runAnalyticsRefresh().catch(error => console.error(JSON.stringify({ event: 'analytics_refresh_failed', error: error.message })))
  }, analyticsRefreshIntervalMs)
  analyticsRefreshTimer.unref?.()
}
// WS5 shipping / deployment cadence refresh worker (daily). Off by default;
// enable on one replica with TRUST_SHIPPING_REFRESH_ENABLED=true.
if (String(process.env.TRUST_SHIPPING_REFRESH_ENABLED || '').toLowerCase() === 'true') {
  const shippingRefreshIntervalMs = Math.max(3600_000, Number(process.env.TRUST_SHIPPING_SYNC_INTERVAL_MS || 24 * 3600_000))
  const shippingRefreshTimer = setInterval(() => {
    runShippingRefresh().catch(error => console.error(JSON.stringify({ event: 'shipping_refresh_failed', error: error.message })))
  }, shippingRefreshIntervalMs)
  shippingRefreshTimer.unref?.()
}
// WS6 team / registry / HRIS refresh worker (daily). Off by default; enable on
// one replica with TRUST_TEAM_REFRESH_ENABLED=true.
if (String(process.env.TRUST_TEAM_REFRESH_ENABLED || '').toLowerCase() === 'true') {
  const teamRefreshIntervalMs = Math.max(3600_000, Number(process.env.TRUST_TEAM_SYNC_INTERVAL_MS || 24 * 3600_000))
  const teamRefreshTimer = setInterval(() => {
    runTeamRefresh().catch(error => console.error(JSON.stringify({ event: 'team_refresh_failed', error: error.message })))
  }, teamRefreshIntervalMs)
  teamRefreshTimer.unref?.()
}

// WS8 identity / KYC + sanctions rescreen worker. Off by default; enable on one
// replica with TRUST_IDENTITY_REFRESH_ENABLED=true.
if (String(process.env.TRUST_IDENTITY_REFRESH_ENABLED || '').toLowerCase() === 'true') {
  const identityRefreshIntervalMs = Math.max(3600_000, Number(process.env.TRUST_IDENTITY_SYNC_INTERVAL_MS || 24 * 3600_000))
  const identityRefreshTimer = setInterval(() => {
    runIdentityRefresh().catch(error => console.error(JSON.stringify({ event: 'identity_refresh_failed', error: error.message })))
  }, identityRefreshIntervalMs)
  identityRefreshTimer.unref?.()
}

// WS9 continuous re-verification / decay scheduler. Off by default; enable on
// exactly one replica with TRUST_REVERIFICATION_ENABLED=true. One tick flips
// stale verified proofs/skills to expired, recomputes affected profiles, and
// enqueues projection outbox rows.
if (String(process.env.TRUST_REVERIFICATION_ENABLED || '').toLowerCase() === 'true') {
  const reverificationIntervalMs = Math.max(60_000, Number(process.env.TRUST_REVERIFICATION_INTERVAL_MS || 6 * 3600_000))
  const reverificationTimer = setInterval(() => {
    runMaintenance(() => runTrustReverificationTick()).catch(error => console.error(JSON.stringify({ event: 'trust_reverification_failed', error: error.message })))
  }, reverificationIntervalMs)
  reverificationTimer.unref?.()
}

// WS9 repository-backed projection outbox worker. The request path only
// enqueues rows; this drains them when the row-level authority is active.
if (process.env.TRUST_PROJECTION_SECRET && process.env.TRUST_PROJECTION_URL && process.env.TRUST_WRITE_SOURCE === 'postgres') {
  const trustOutboxIntervalMs = Math.max(5000, Number(process.env.TRUST_PROJECTION_INTERVAL_MS || 30000))
  const trustOutboxTimer = setInterval(() => {
    runMaintenance(() => flushTrustProjectionOutboxFromRepository()).catch(error => console.error(JSON.stringify({ event: 'trust_projection_outbox_failed', error: error.message })))
  }, trustOutboxIntervalMs)
  trustOutboxTimer.unref?.()
}

app.listen(PORT, () => {
  console.log(`TechIT API running on PORT ${PORT}`)
})
