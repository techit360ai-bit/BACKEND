import jwt from 'jsonwebtoken'
import { readDb } from '../config/database.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'This secret must match the value used by ai-router and ' +
    'BACKEND/messaging-backend so platform tokens verify across services.'
  )
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = authHeader.slice(7)
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  const db = readDb()
  const user = db.users.find(u => u.id === payload.sub)
  if (!user) return res.status(401).json({ error: 'User not found' })
  const profile = db.profiles.find(p => p.id === user.id)
  req.user = {
    id: user.id,
    email: user.email,
    role: payload.role || profile?.role || 'founder',
    workspaceId: payload.workspaceId || `user-${user.id}`,
    user_metadata: {},
  }
  next()
}
