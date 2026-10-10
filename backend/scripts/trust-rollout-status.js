// WS11 rollout status: prints the per-source availability + feature-flag state
// so a canary step can be approved with an explicit blast radius. Informational
// (exit 0 unless a source claims `available` while its own flag is off).
import { trustRolloutSnapshot } from '../src/config/trustSources.js'

const snapshot = trustRolloutSnapshot()
console.log(JSON.stringify({ event: 'trust_rollout_status', ...snapshot }, null, 2))

const inconsistent = snapshot.per_source.filter(entry => entry.availability === 'available' && entry.gated_by && !entry.flag_enabled)
if (inconsistent.length) {
  console.error(JSON.stringify({ event: 'trust_rollout_inconsistent', sources: inconsistent.map(entry => entry.source) }))
  process.exitCode = 1
}
