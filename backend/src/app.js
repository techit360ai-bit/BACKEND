import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import authRoutes from './routes/auth.js'
import fileRoutes from './routes/files.js'
import notificationRoutes from './routes/notifications.js'
import userRoutes from './routes/users.js'
import { mountTechitApi } from '../../Plugins-MCP/server/mount.ts'

const app = express()

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
app.use(express.json())

app.get('/', (_req, res) => res.json({ status: 'TechIT API running' }))
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/files', fileRoutes)

// Plugins-MCP backend: tools catalogue, audit log, contributions, approvals,
// invoke + approve. Mounted under /api/mcp so it never collides with the
// platform's existing /api/auth and /api/users surfaces.
//
// Every MCP route is gated on a verified JWT. Actor identity/role come from
// the SAME platform secret as /api/auth so users can't self-declare roles by
// stuffing them into the request body (the SDK's legacy fallback mode).
const JWT_SECRET = process.env.JWT_SECRET
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
          role: String(claims.role ?? 'viewer'),
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

app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
