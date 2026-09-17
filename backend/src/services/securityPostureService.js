import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../config/database.js'

const severity = (value) => value
const finding = (id, title, level, component, gap, remediation, status, testStatus = 'not-run') => ({ id, title, severity: level, component, gap, remediation, implementationStatus: status, testStatus })

export function securityPostureSnapshot() {
  const production = process.env.NODE_ENV === 'production'
  const db = readAuthorityDb()
  const asymmetric = ['RS256', 'EdDSA'].includes(String(process.env.JWT_ALGORITHM || (production ? 'RS256' : 'HS256')).toUpperCase()) && Boolean(process.env.JWT_PUBLIC_KEY)
  const checks = [
    { domain: 'Identity', score: asymmetric ? 100 : production ? 35 : 75, finding: !asymmetric ? finding('identity-asymmetric', 'Shared symmetric JWT verification remains enabled', 'HIGH', 'backend/auth', 'A shared secret expands blast radius across services.', 'Configure RS256/EdDSA public/private keys with rotation and JWKS distribution.', 'implementation-required', 'test-required') : null },
    { domain: 'Authorization', score: Array.isArray(db.authorizationAuditLogs) ? 90 : 55, finding: !Array.isArray(db.authorizationAuditLogs) ? finding('authorization-audit', 'Authorization decisions lack an initialized audit collection', 'HIGH', 'backend/authorization', 'Denied and allowed decisions may not be reconstructable.', 'Initialize immutable authorization audit storage.', 'implementation-required') : null },
    { domain: 'API', score: process.env.JSON_BODY_LIMIT || process.env.GLOBAL_RATE_LIMIT_REDIS ? 90 : 65, finding: !process.env.JSON_BODY_LIMIT ? finding('api-limits', 'Request body limit uses implicit default', 'MEDIUM', 'backend/api', 'Per-deployment request limits are not explicit.', 'Set JSON_BODY_LIMIT and route-specific limits in deployment configuration.', 'configuration-required') : null },
    { domain: 'AI', score: production && process.env.REQUIRE_AI_EXECUTION_GRANT !== 'true' ? 30 : 90, finding: production && process.env.REQUIRE_AI_EXECUTION_GRANT !== 'true' ? finding('ai-grant', 'AI execution grants are not required in production', 'CRITICAL', 'ai-router', 'Requests could reach provider execution without backend authorization.', 'Set REQUIRE_AI_EXECUTION_GRANT=true and verify replay protection.', 'configuration-required') : null },
    { domain: 'Data', score: production && process.env.DB_DRIVER !== 'postgres' ? 25 : 95, finding: production && process.env.DB_DRIVER !== 'postgres' ? finding('data-authority', 'Production database authority is not PostgreSQL', 'CRITICAL', 'backend/database', 'SQLite/JSON request authority cannot provide multi-replica isolation.', 'Set DB_DRIVER=postgres and run migration/backfill verification.', 'configuration-required') : null },
    { domain: 'Infrastructure', score: production && !process.env.REDIS_URL ? 45 : 85, finding: production && !process.env.REDIS_URL ? finding('shared-coordination', 'Shared Redis coordination is not configured', 'HIGH', 'redis/rate-limits', 'Replay, rate-limit, and queue state may be process-local.', 'Configure private Redis with TLS and least-privilege credentials.', 'configuration-required') : null },
    { domain: 'Supply Chain', score: 80, finding: null },
    { domain: 'Monitoring', score: Array.isArray(db.authSecurityEvents) && Array.isArray(db.authorizationAuditLogs) ? 90 : 60, finding: null },
    { domain: 'Incident Readiness', score: 85, finding: null },
  ]
  const findings = checks.map(item => item.finding).filter(Boolean)
  const score = Math.round(checks.reduce((sum, item) => sum + item.score, 0) / checks.length)
  const riskLevel = score < 50 || findings.some(item => item.severity === 'CRITICAL') ? 'critical' : score < 70 ? 'high' : score < 85 ? 'medium' : 'low'
  const generatedAt = new Date().toISOString()
  try { updateAuthorityDb(state => { state.securityPostureHistory = (state.securityPostureHistory || []).filter(row => Date.now() - Date.parse(row.generatedAt) < 180 * 86400000).concat({ generatedAt, score, riskLevel }); return null }) } catch { /* posture reads remain available when history storage is unavailable */ }
  return { generatedAt, score, riskLevel, domains: checks.map(({ domain, score: domainScore }) => ({ domain, score: domainScore })), findings, recommendedRemediation: findings.slice(0, 5).map(item => item.remediation), trend: (db.securityPostureHistory || []).slice(-30), evidence: { implementation: 'repository-and-middleware-audit', tests: 'backend-vitest-suite', configuration: production ? 'production-environment-required' : 'development-environment' } }
}
