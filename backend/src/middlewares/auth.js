import jwt from 'jsonwebtoken'
import { readDb } from '../config/database.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. ' +
    'This secret must match the value used by ai-router and ' +
    'BACKEND/feat/messaging-backend so platform tokens verify across services.'
  )
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const db = readDb()
    const user = db.users.find(u => u.id === payload.sub)
    if (!user) return res.status(401).json({ error: 'User not found' })
    req.user = { id: user.id, email: user.email, user_metadata: {} }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
