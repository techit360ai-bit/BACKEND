import crypto from 'node:crypto'
import { recordSecurityEvent } from '../services/securityEventService.js'

const unsafe = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const parseCookies = header => Object.fromEntries(String(header || '').split(';').map(item => item.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2))

export function csrfProtection(req, res, next) {
  if (process.env.NODE_ENV === 'test' && process.env.ENFORCE_CSRF_IN_TEST !== 'true') return next()
  if (!unsafe.has(req.method) || !req.headers.cookie) return next()
  // A bearer token is explicitly supplied by the caller and is not exposed to
  // cross-site form requests. Require the double-submit token only for the
  // cookie-only browser transport, where CSRF protection is necessary.
  if (String(req.get('authorization') || '').startsWith('Bearer ')) return next()
  const cookies = parseCookies(req.headers.cookie)
  const access = cookies.techit_access
  if (!access) return next()
  const supplied = String(req.get('x-csrf-token') || '')
  const expected = String(cookies.techit_csrf || '')
  if (!supplied || !expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    recordSecurityEvent({ type: 'csrf_blocked', severity: 'HIGH', requestId: req.id, metadata: { method: req.method, path: req.path } })
    return res.status(403).json({ error: 'csrf_token_invalid' })
  }
  return next()
}
