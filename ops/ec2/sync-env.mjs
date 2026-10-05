#!/usr/bin/env node
/**
 * Apply the committed production env template + CI-injected secrets to the
 * box's `backend/.env` without disturbing hand-managed keys.
 *
 * Usage:
 *   node ops/ec2/sync-env.mjs --template ops/ec2/platform.env --target backend/.env
 *
 * Precedence (low -> high):
 *   1. template file values (safe, secret-free defaults)
 *   2. non-empty process-env overrides for any template key (CI secrets)
 *   3. derived values: canonical PostgreSQL URL aliases + DB_DRIVER-driven
 *      read/write source switches
 *
 * The target `.env` is rewritten in place, deduplicated, and chmod 600. Keys
 * that are not part of the template are preserved verbatim.
 */
import fs from 'node:fs'
import path from 'node:path'

function parseArgs(argv) {
  const out = { template: null, target: null }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--template') out.template = argv[++i]
    else if (argv[i] === '--target') out.target = argv[++i]
  }
  return out
}

const { template, target } = parseArgs(process.argv.slice(2))
if (!template || !target) {
  console.error('usage: sync-env.mjs --template <file> --target <file>')
  process.exit(2)
}

const templatePath = path.resolve(template)
const targetPath = path.resolve(target)

const order = []
const merged = new Map()
const templateKeys = new Set()
const setKey = (key, value) => {
  if (!merged.has(key)) order.push(key)
  merged.set(key, value)
}

for (const rawLine of fs.readFileSync(templatePath, 'utf8').split('\n')) {
  const line = rawLine.trim()
  if (!line || line.startsWith('#')) continue
  const eq = line.indexOf('=')
  if (eq <= 0) continue
  const key = line.slice(0, eq).trim()
  templateKeys.add(key)
  setKey(key, line.slice(eq + 1))
}

// (2) CI/operator overrides: any template key present & non-empty in the env.
for (const key of [...order]) {
  const value = process.env[key]
  if (value !== undefined && value !== '') merged.set(key, value)
}

// (3a) One canonical PostgreSQL URL -> every per-domain alias the template
// declares. A template that only wants DATABASE_URL gets only DATABASE_URL.
const canonical = (merged.get('PLATFORM_DATABASE_URL') || '').trim()
if (canonical) {
  if (templateKeys.has('DATABASE_URL')) setKey('DATABASE_URL', canonical)
  for (const alias of [
    'MCP_DATABASE_URL', 'IDENTITY_DATABASE_URL', 'WORKSPACE_DATABASE_URL',
    'CONTENT_DATABASE_URL', 'INVESTOR_DATABASE_URL', 'ORGANIZATION_DATABASE_URL',
    'FINANCE_DATABASE_URL', 'TRUST_DATABASE_URL', 'DISCOVERY_DATABASE_URL',
  ]) {
    if (templateKeys.has(alias)) setKey(alias, canonical)
  }
}

// (3b) DB_DRIVER is the single cutover switch. Derive the request authority and
// every domain read/write source so sqlite and postgres can never half-flip.
// Only applies to templates that opt into the concept (the platform backend).
const driver = (merged.get('DB_DRIVER') || 'sqlite').trim().toLowerCase()
if (templateKeys.has('DB_DRIVER')) {
const postgres = driver === 'postgres'
setKey('PLATFORM_REQUEST_AUTHORITY', postgres ? 'postgres' : 'sqlite')
setKey('PLATFORM_AUTHORITY_FALLBACK_SQLITE', postgres ? 'false' : 'true')

const domains = ['IDENTITY', 'WORKSPACE', 'CONTENT', 'INVESTOR', 'ORGANIZATION', 'FINANCE']
for (const domain of domains) {
  setKey(`${domain}_READ_SOURCE`, postgres ? 'postgres' : 'sqlite')
  setKey(`${domain}_WRITE_SOURCE`, postgres ? 'postgres' : 'sqlite')
  setKey(`${domain}_READ_FALLBACK_SQLITE`, postgres ? 'false' : 'true')
  setKey(`${domain}_WRITE_FALLBACK_SQLITE`, postgres ? 'false' : 'true')
}
setKey('WORKSPACE_CODE_SOURCE', postgres ? 'postgres' : 'sqlite')
setKey('WORKSPACE_CODE_FALLBACK_SQLITE', postgres ? 'false' : 'true')
for (const domain of ['INTELLIGENCE', 'OPERATIONAL']) {
  setKey(`${domain}_SOURCE`, postgres ? 'postgres' : 'sqlite')
  setKey(`${domain}_READ_SOURCE`, postgres ? 'postgres' : 'sqlite')
  setKey(`${domain}_WRITE_SOURCE`, postgres ? 'postgres' : 'sqlite')
  setKey(`${domain}_FALLBACK_SQLITE`, postgres ? 'false' : 'true')
}
} // end platform-driver derivation

// Merge into the existing target, preserving unmanaged keys and deduplicating.
const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : ''
// Values with real or escaped newlines (e.g. a PEM public key) must be written
// as a single quoted line so `docker compose --env-file` and Node's
// `--env-file` both decode them back into the multi-line value.
const renderLine = (key, value) => (/[\r\n]|\\n/.test(value)
  ? `${key}="${value.replace(/\r?\n/g, '\\n')}"`
  : `${key}=${value}`)
const seen = new Set()
const rendered = (existing ? existing.split('\n') : []).map((line) => {
  const match = /^\s*([A-Za-z0-9_]+)\s*=/.exec(line)
  if (!match || !merged.has(match[1])) return line
  seen.add(match[1])
  return renderLine(match[1], merged.get(match[1]))
})
const appended = order.filter((key) => !seen.has(key)).map((key) => renderLine(key, merged.get(key)))
let out = rendered.join('\n')
if (out && !out.endsWith('\n')) out += '\n'
if (appended.length) out += `${appended.join('\n')}\n`
fs.writeFileSync(targetPath, out, { mode: 0o600 })
try { fs.chmodSync(targetPath, 0o600) } catch { /* best effort on non-posix */ }

console.log(JSON.stringify({
  event: 'env_synced',
  target: targetPath,
  driver,
  managedKeys: merged.size,
  appendedKeys: appended.length,
}))
