import express from 'express'
import cors from 'cors'
import { verifyJwt } from './services/jwtKeyService.js'
import { randomUUID } from 'crypto'
import authRoutes from './routes/auth.js'
import fileRoutes from './routes/files.js'
import githubRoutes from './routes/github.js'
import notificationRoutes from './routes/notifications.js'
import userRoutes from './routes/users.js'
import videoRoutes from './routes/video.js'
import adminRoutes from './routes/admin.js'
import contextRoutes from './routes/context.js'
import domainRoutes from './routes/domain.js'
import investorIntelligenceRoutes from './routes/investorIntelligence.js'
import investorDealRoomRoutes from './routes/investorDealRoom.js'
import { referenceSubmit } from './controllers/investorDealRoomCompletionController.js'
import organizationIntelligenceRoutes from './routes/organizationIntelligence.js'
import mentorshipRoutes from './routes/mentorship.js'
import complianceRoutes from './routes/compliance.js'
import usageSettlementRoutes from './routes/usageSettlement.js'
import discoveryRoutes from './routes/discovery.js'
import intelligenceRoutes from './routes/intelligence.js'
import authorizationRoutes from './routes/authorization.js'
import trustRoutes from './routes/trust.js'
import supportRoutes from './routes/support.js'
import techitMomentsRoutes from './routes/techitMoments.js'
import academyRoutes from './routes/academy.js'
import codeWorkspaceRoutes from './routes/codeWorkspace.js'
import tvceRoutes from './routes/tvce.js'
import billingWebhookRoutes from './routes/billingWebhooks.js'
import { authorizeCodeDestination, projectCodeCommit } from './services/codeExecutionProjectionService.js'
import { readDb as readAuthorityDb } from './config/database.js'
import { mountTechitApi } from '../../Plugins-MCP/server/mount.ts'
import { globalRateLimit } from './middlewares/globalRateLimit.js'
import { postgresAuthority } from './middlewares/postgresAuthority.js'
import { csrfProtection } from './middlewares/csrf.js'

const app = express()

// Express must trust the platform's single reverse proxy for accurate client
// IP rate limiting. Never use `true`, which trusts attacker-supplied chains.
if (process.env.TRUST_PROXY_HOPS) {
  app.set('trust proxy', Math.max(0, Number(process.env.TRUST_PROXY_HOPS) || 0))
}

function shouldLogRequests() {
  return process.env.NODE_ENV !== 'test' || process.env.LOG_REQUESTS === '1'
}

app.use((req, res, next) => {
  const requestId = req.get('x-request-id') || randomUUID()
  const startedAt = Date.now()
  req.id = requestId
  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    if (!shouldLogRequests()) return
    console.info(JSON.stringify({
      event: 'http_request',
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    }))
  })

  next()
})

// CORS allow-list — comma-separated origins via env, defaults to local Vite
// dev ports. Production MUST set CORS_ORIGINS to the deployed frontend(s);
// without this env var, a real-domain frontend gets blocked at the browser.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}))
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || '1mb',
  verify(req, _res, buffer) {
    // Service-to-service HMAC verification must cover the exact bytes that
    // crossed the wire, not a reconstructed object serialization.
    req.rawBody = buffer.toString('utf8')
  },
}))
app.use(csrfProtection)

// Shared gateway protection. Route-specific limits remain responsible for
// credential, OTP, authorization, and other sensitive operations.
app.use(globalRateLimit())
// When enabled, legacy synchronous services execute against a PostgreSQL
// snapshot and their mutations are flushed as versioned records. This bridge
// keeps every request path on the same authority while domain repositories are
// converted incrementally.
app.use(postgresAuthority)

app.get('/', (_req, res) => res.json({ status: 'TechIT API running' }))
app.use('/api/admin', adminRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/domain', domainRoutes)
app.use('/api/investor-intelligence', investorIntelligenceRoutes)
app.use('/api/investor-deals', investorDealRoomRoutes)
app.post('/api/investor-references/respond/:token', referenceSubmit)
app.use('/api/organization-intelligence', organizationIntelligenceRoutes)
app.use('/api/mentorship', mentorshipRoutes)
app.use('/api/compliance', complianceRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/files', fileRoutes)
app.use('/api/github', githubRoutes)
app.use('/api/video', videoRoutes)
app.use('/api/context', contextRoutes)
app.use('/api/discovery', discoveryRoutes)
app.use('/api/intelligence', intelligenceRoutes)
app.use('/api/authorization', authorizationRoutes)
app.use('/api/trust', trustRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/moments', techitMomentsRoutes)
app.use('/api/academy', academyRoutes)
app.use('/api/code', codeWorkspaceRoutes)
app.use('/api/tvce', tvceRoutes)
app.use('/api/billing/webhooks', billingWebhookRoutes)
app.use('/internal/usage-settlement', usageSettlementRoutes)

// Plugins-MCP backend: tools catalogue, audit log, contributions, approvals,
// invoke + approve. Mounted under /api/mcp so it never collides with the
// platform's existing /api/auth and /api/users surfaces.
//
// Every MCP route is gated on a verified JWT. Actor identity/role come from
// the SAME platform secret as /api/auth so users can't self-declare roles by
// stuffing them into the request body (the SDK's legacy fallback mode).
const JWT_SECRET = process.env.JWT_SECRET
export function mcpRoleFromClaim(role) {
  if (['viewer', 'editor', 'admin', 'owner'].includes(role)) return role
  if (role === 'admin') return 'admin'
  if (role === 'founder' || role === 'organisation' || role === 'organization') return 'owner'
  if (role === 'collaborator') return 'editor'
  return 'viewer'
}
// Fail closed: MCP is exposed only by an explicit opt-in. Production contract
// validation requires all datastore, encryption, and real-connector settings.
const MCP_ENABLED = process.env.MCP_ENABLED === 'true'
if (MCP_ENABLED) {
  await mountTechitApi(app, '/api/mcp', {
    resolveActor(req) {
      if (!JWT_SECRET && !process.env.JWT_PUBLIC_KEY) return null
      const auth = req.headers?.authorization
      if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null
      try {
        const claims = verifyJwt(auth.slice(7), {
          ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}),
          ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}),
        })
        const db = readAuthorityDb()
        const profile = db.profiles.find(row => row.id === claims.sub)
        const testMode = process.env.NODE_ENV === 'test'
        if (!profile && !testMode) return null
        const workspaceId = typeof profile?.workspaceId === 'string'
          ? profile.workspaceId
          : testMode && typeof claims.workspaceId === 'string' ? claims.workspaceId : `user-${claims.sub}`
        const persistedRole = testMode ? String(claims.role || profile?.role || 'explorer') : profile?.role || 'explorer'
        return {
          actor: {
            id: String(claims.sub ?? 'unknown'),
            kind: claims.kind === 'agent' ? 'agent' : 'human',
            role: mcpRoleFromClaim(persistedRole),
            toolsAllowed: Array.isArray(claims.toolsAllowed) ? claims.toolsAllowed : undefined,
            // Plumb workspaceId onto the actor so techit-service.toContext() can
            // scope the invocation per-tenant instead of the seed 'ws-acme' (#9).
            workspaceId,
          },
          workspaceId,
        }
      } catch {
        return null
      }
    },
    authorizeInvocation({ resolved, plugin, tool, params }) {
      if (plugin === 'github' && (tool === 'push_files' || tool === 'run_workflow')) return authorizeCodeDestination(resolved.actor.id, params, { write: true })
      if (plugin === 'github' && (tool === 'get_repository_state' || (tool === 'read_file' && params.projectId))) return authorizeCodeDestination(resolved.actor.id, params)
      return { allowed: true }
    },
    onSuccessfulInvocation({ resolved, plugin, tool, params, data }) {
      if (plugin === 'github' && tool === 'push_files') projectCodeCommit(resolved.actor.id, params, data)
    },
  })
}

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

app.use((err, req, res, _next) => {
  console.error(JSON.stringify({
    event: 'http_error',
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  }))
  res.status(500).json({ error: 'Internal server error', requestId: req.id })
})

export default app
