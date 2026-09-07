import crypto from 'node:crypto'

const counters = new Map()
const normalize = value => JSON.stringify(value, (_, item) => item instanceof Date ? item.toISOString() : item)
const digest = value => crypto.createHash('sha256').update(normalize(value)).digest('hex')

export function recordCutoverComparison(domain, key, primary, shadow) {
  const state = counters.get(domain) || { comparisons: 0, mismatches: 0, lastMismatchAt: null, lastKey: null }
  state.comparisons += 1
  if (digest(primary) !== digest(shadow)) {
    state.mismatches += 1
    state.lastMismatchAt = new Date().toISOString()
    state.lastKey = String(key || '')
    console.error(JSON.stringify({ event: 'postgres_cutover_mismatch', domain, key: String(key || ''), primaryHash: digest(primary), shadowHash: digest(shadow) }))
  }
  counters.set(domain, state)
  return state
}

export function cutoverMonitorSnapshot() { return Object.fromEntries([...counters.entries()].map(([domain, value]) => [domain, { ...value }])) }
export function resetCutoverMonitor() { counters.clear() }

export function rollbackDrillStatus() {
  const domains = ['IDENTITY', 'WORKSPACE', 'CONTENT', 'INVESTOR', 'ORGANIZATION', 'FINANCE']
  const checks = Object.fromEntries(domains.map(domain => [domain.toLowerCase(), { readSource: process.env[`${domain}_READ_SOURCE`] || 'sqlite', writeSource: process.env[`${domain}_WRITE_SOURCE`] || 'sqlite', fallbackRead: process.env[`${domain}_READ_FALLBACK_SQLITE`] !== 'false', fallbackWrite: process.env[`${domain}_WRITE_FALLBACK_SQLITE`] !== 'false' }]))
  return { ok: Object.values(checks).every(row => row.fallbackRead || row.readSource === 'sqlite') && Object.values(checks).every(row => row.fallbackWrite || row.writeSource === 'sqlite'), generatedAt: new Date().toISOString(), checks, metrics: cutoverMonitorSnapshot() }
}
