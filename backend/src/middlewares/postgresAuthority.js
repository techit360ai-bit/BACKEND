import { loadPlatformDatabase, flushPlatformDatabase } from '../repositories/platformDatabaseRepository.js'
import { runDatabaseAuthority, currentDatabaseAuthority } from '../config/database.js'

const enabled = () => process.env.PLATFORM_REQUEST_AUTHORITY === 'postgres' || process.env.DB_DRIVER === 'postgres'

export async function postgresAuthority(req, res, next) {
  if (!enabled()) return next()
  let before
  try { before = await loadPlatformDatabase() } catch (error) {
    if (process.env.PLATFORM_AUTHORITY_FALLBACK_SQLITE === 'false') return next(error)
    console.error(JSON.stringify({ event: 'postgres_authority_snapshot_failed', error: error.message }))
    return next()
  }
  const snapshot = structuredClone(before)
  let flushed = false
  const flush = async () => {
    if (flushed) return
    flushed = true
    const authority = currentDatabaseAuthority()
    if (!authority?.dirty) return
    try { await flushPlatformDatabase(before, snapshot, { userId: req.user?.id || null }) } catch (error) {
      console.error(JSON.stringify({ event: 'postgres_authority_flush_failed', requestId: req.id, error: error.message }))
      if (process.env.PLATFORM_AUTHORITY_FALLBACK_SQLITE === 'false' && !res.headersSent) res.status(503).json({ error: 'postgres_authority_unavailable' })
    }
  }
  for (const method of ['json', 'send', 'end']) {
    const original = res[method].bind(res)
    res[method] = (...args) => {
      void flush().then(() => original(...args)).catch(error => {
        console.error(JSON.stringify({ event: 'postgres_authority_response_flush_failed', requestId: req.id, error: error.message }))
        if (!res.headersSent) original({ error: 'postgres_authority_unavailable' })
      })
      return res
    }
  }
  res.on('finish', () => { void flush() })
  return runDatabaseAuthority(snapshot, () => next())
}

export function postgresAuthorityEnabled() { return enabled() }
