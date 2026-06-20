import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import { mountTechitApi } from '../../Plugins-MCP/server/mount.ts'

const app = express()

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
}))
app.use(express.json())

app.get('/', (_req, res) => res.json({ status: 'TechIT API running' }))
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)

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
      return {
        actor: {
          id: String(claims.sub ?? 'unknown'),
          kind: claims.kind === 'agent' ? 'agent' : 'human',
          role: String(claims.role ?? 'viewer'),
          toolsAllowed: Array.isArray(claims.toolsAllowed) ? claims.toolsAllowed : undefined,
        },
        workspaceId: typeof claims.workspaceId === 'string' ? claims.workspaceId : undefined,
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
