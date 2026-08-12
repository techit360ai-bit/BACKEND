import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
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
import complianceRoutes from './routes/compliance.js'
import usageSettlementRoutes from './routes/usageSettlement.js'
import { mountTechitApi } from '../../Plugins-MCP/server/mount.ts'

const app = express()

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
app.use(express.json({
  verify(req, _res, buffer) {
    // Service-to-service HMAC verification must cover the exact bytes that
    // crossed the wire, not a reconstructed object serialization.
    req.rawBody = buffer.toString('utf8')
  },
}))

app.get('/', (_req, res) => res.json({ status: 'TechIT API running' }))
app.use('/api/admin', adminRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/domain', domainRoutes)
app.use('/api/compliance', complianceRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/files', fileRoutes)
app.use('/api/github', githubRoutes)
app.use('/api/video', videoRoutes)
app.use('/api/context', contextRoutes)
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
await mountTechitApi(app, '/api/mcp', {
  resolveActor(req) {
    if (!JWT_SECRET) return null
    const auth = req.headers?.authorization
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null
    try {
      const claims = jwt.verify(auth.slice(7), JWT_SECRET)
      const workspaceId = typeof claims.workspaceId === 'string' ? claims.workspaceId : undefined
      return {
        actor: {
          id: String(claims.sub ?? 'unknown'),
          kind: claims.kind === 'agent' ? 'agent' : 'human',
          role: mcpRoleFromClaim(String(claims.role ?? 'viewer')),
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
})

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
