import app from './app.js'
import { validateDatabaseConfig } from './config/database.js'
import { initializeDiscoveryInfrastructure } from './services/discoveryInfrastructure.js'
import { generateReverificationNotifications } from './services/trustVerificationService.js'
import { initializeTrustPostgresProjection } from './services/trustPostgresProjection.js'
import { initializeIdentityPostgresProjection } from './services/identityPostgresProjection.js'
import { cleanupSessions } from './services/sessionService.js'
import { runDealRoomMaintenance } from './services/investorDealRoomCompletionService.js'
import { runOrganizationIntelligenceMaintenance } from './services/organizationIntelligenceService.js'
import { runMaintenance as runSupportMaintenance } from './services/supportService.js'

const PORT = process.env.PORT || 3000

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

const reverificationIntervalMs = Math.max(15 * 60 * 1000, Number(process.env.REVERIFICATION_NOTIFICATION_INTERVAL_MS || 24 * 60 * 60 * 1000))
const reverificationTimer = setInterval(() => {
  try { generateReverificationNotifications() } catch (error) { console.error(JSON.stringify({ event: 'reverification_notification_run_failed', error: error.message })) }
}, reverificationIntervalMs)
reverificationTimer.unref?.()
const sessionCleanupTimer = setInterval(() => { try { cleanupSessions() } catch (error) { console.error(JSON.stringify({ event: 'session_cleanup_failed', error: error.message })) } }, Math.max(15 * 60 * 1000, Number(process.env.AUTH_CLEANUP_INTERVAL_MS || 24 * 60 * 60 * 1000)))
sessionCleanupTimer.unref?.()
const dealRoomMaintenanceTimer = setInterval(() => { try { runDealRoomMaintenance() } catch (error) { console.error(JSON.stringify({ event: 'deal_room_maintenance_failed', error: error.message })) } }, Math.max(15 * 60 * 1000, Number(process.env.DEAL_ROOM_MAINTENANCE_INTERVAL_MS || 60 * 60 * 1000)))
dealRoomMaintenanceTimer.unref?.()
const organizationIntelligenceTimer = setInterval(() => { try { runOrganizationIntelligenceMaintenance() } catch (error) { console.error(JSON.stringify({ event: 'organization_intelligence_maintenance_failed', error: error.message })) } }, Math.max(15 * 60 * 1000, Number(process.env.ORGANIZATION_INTELLIGENCE_INTERVAL_MS || 60 * 60 * 1000)))
organizationIntelligenceTimer.unref?.()
const supportMaintenanceTimer = setInterval(() => { try { runSupportMaintenance() } catch (error) { console.error(JSON.stringify({ event: 'support_maintenance_failed', error: error.message })) } }, Math.max(60 * 1000, Number(process.env.SUPPORT_MAINTENANCE_INTERVAL_MS || 5 * 60 * 1000)))
supportMaintenanceTimer.unref?.()

app.listen(PORT, () => {
  console.log(`TechIT API running on PORT ${PORT}`)
})
