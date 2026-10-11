// §5 scaling gate assertion: the request path must perform zero whole-DB reads.
//
// The k6 harness (ops/loadtest/founder-trust.k6.js) drives a sized staging
// deployment. While it runs, every replica's `GET /internal/metrics/platform-authority`
// counter must stay at zero for request-path sources. This script aggregates
// those snapshots (one per `--url`, so multi-replica deployments work) and fails
// when any request-path whole-DB read was observed.
//
// Usage:
//   node scripts/assert-no-whole-db-reads.js --url http://localhost:3000
//   node scripts/assert-no-whole-db-reads.js --url https://a --url https://b
//   node scripts/assert-no-whole-db-reads.js --input after.json --baseline before.json
//   node scripts/assert-no-whole-db-reads.js --input snapshot.json
//   node scripts/assert-no-whole-db-reads.js --source postgresAuthority
//
// Exit code 0 = request path clean; 1 = violation (or unreadable evidence).
import { readFile } from 'node:fs/promises'
import {
  DEFAULT_REQUEST_PATH_SOURCES,
  evaluateWholeDbReadGate,
  mergePlatformAuthoritySnapshots,
  subtractPlatformAuthoritySnapshots,
} from '../src/services/platformAuthorityInstrumentation.js'

function parseArgs(argv) {
  const options = { urls: [], inputs: [], baselines: [], sources: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].includes('=') ? argv[i].split(/=(.*)/s, 2) : [argv[i], undefined]
    const take = () => { const value = inline ?? argv[i + 1]; if (inline === undefined) i += 1; if (value === undefined) throw new Error(`${flag} requires a value`); return value }
    if (flag === '--url') options.urls.push(take())
    else if (flag === '--input') options.inputs.push(take())
    else if (flag === '--baseline') options.baselines.push(take())
    else if (flag === '--source') options.sources.push(take())
    else if (flag === '--help' || flag === '-h') options.help = true
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  return options
}

const secret = process.env.INTERNAL_METRICS_SECRET || process.env.TRUST_INGEST_SECRET || ''

async function fetchSnapshot(base) {
  const url = new URL('/internal/metrics/platform-authority', base).toString()
  const response = await fetch(url, { headers: { 'x-techit-internal-secret': secret, accept: 'application/json' } })
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`)
  return response.json()
}

const readJson = async file => JSON.parse(await readFile(file, 'utf8'))

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) { console.log('See header comment for usage.'); return }
  const requestPathSources = options.sources.length ? options.sources : DEFAULT_REQUEST_PATH_SOURCES
  const urls = options.urls.length ? options.urls : (options.inputs.length ? [] : ['http://localhost:3000'])

  const currentSnapshots = []
  for (const url of urls) currentSnapshots.push(await fetchSnapshot(url))
  for (const file of options.inputs) currentSnapshots.push(await readJson(file))
  if (!currentSnapshots.length) throw new Error('no current evidence: pass --url or --input')

  const current = mergePlatformAuthoritySnapshots(currentSnapshots)
  const windowGate = options.baselines.length
    ? evaluateWholeDbReadGate(subtractPlatformAuthoritySnapshots(current, mergePlatformAuthoritySnapshots(await Promise.all(options.baselines.map(readJson)))), { requestPathSources })
    : null
  const gate = evaluateWholeDbReadGate(current, { requestPathSources })
  const ok = gate.ok && (!windowGate || windowGate.ok)

  console.log(JSON.stringify({
    event: 'assert_no_whole_db_reads',
    ok,
    request_path_sources: requestPathSources,
    request_path_reads: gate.request_path_reads,
    whole_db_reads: current.whole_db_reads,
    whole_db_reads_by_source: current.whole_db_reads_by_source,
    violations: [...gate.violations, ...(windowGate?.violations || []).map(v => ({ ...v, window: true }))],
    window: windowGate ? { ok: windowGate.ok, request_path_reads: windowGate.request_path_reads } : null,
    snapshots: currentSnapshots.length,
  }, null, 2))
  if (!ok) process.exitCode = 1
}

main().catch(error => {
  console.error(JSON.stringify({ event: 'assert_no_whole_db_reads_failed', error: error.message }))
  process.exitCode = 1
})
