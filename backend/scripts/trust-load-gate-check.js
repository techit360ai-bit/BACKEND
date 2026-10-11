// WS11 load-gate readiness check.
//
// The k6 gate (ops/loadtest/founder-trust.k6.js) must run against a SIZED
// staging environment. This script does not run the load — it validates that the
// environment and target profile are configured, prints the exact command, and
// (with --strict) fails when the gate cannot be run. Wire it as a pre-flight in
// the canary procedure, not as a unit test.
//
// Usage:
//   node scripts/trust-load-gate-check.js
//   node scripts/trust-load-gate-check.js --strict   # exit 1 if not ready
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { trustSloConfig } from '../src/config/trustSlo.js'

const strict = process.argv.includes('--strict')
const harness = fileURLToPath(new URL('../ops/loadtest/founder-trust.k6.js', import.meta.url))
const slo = trustSloConfig()
const env = process.env

const checks = [
  { name: 'k6 harness present', ok: existsSync(harness), detail: harness },
  { name: 'k6 installed (optional)', ok: true, detail: 'run `k6 version`; CI image must provide it' },
  { name: 'BASE_URL set', ok: Boolean(String(env.BASE_URL || '').trim()), detail: 'API base, e.g. https://staging.example.com/api' },
  { name: 'AUTH_TOKEN set', ok: Boolean(String(env.AUTH_TOKEN || '').trim()), detail: 'seeded test founder bearer token' },
  { name: 'TARGET_VUS set', ok: Boolean(String(env.TARGET_VUS || '').trim()), detail: 'concurrent virtual users for the target profile' },
  { name: 'target profile signed off', ok: slo.signed_off, detail: 'set TRUST_TARGET_PEAK_RPS or TRUST_TARGET_DAU' },
]

const ready = checks.every(check => check.ok)
const command = [
  'k6 run',
  `-e BASE_URL=${env.BASE_URL || '<staging-api>/api'}`,
  `-e AUTH_TOKEN=${env.AUTH_TOKEN ? '***' : '<token>'}`,
  `-e TARGET_VUS=${env.TARGET_VUS || '<vus>'}`,
  'ops/loadtest/founder-trust.k6.js',
].join(' ')

console.log(JSON.stringify({
  event: 'trust_load_gate_readiness',
  ready,
  strict,
  slo,
  checks: checks.map(check => ({ ...check, detail: check.name.includes('TOKEN') ? '***' : check.detail })),
  command,
  gate: { p95_ms: slo.p95_ms, p99_ms: slo.p99_ms, error_rate: slo.error_rate },
}, null, 2))

if (strict && !ready) {
  console.error(JSON.stringify({ event: 'trust_load_gate_not_ready', missing: checks.filter(c => !c.ok).map(c => c.name) }))
  process.exitCode = 1
}
