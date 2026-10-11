import { evaluateWholeDbReadGate, platformAuthorityInstrumentationSnapshot } from '../services/platformAuthorityInstrumentation.js'

// GET /internal/metrics/platform-authority — the §5 whole-DB-read evidence used
// by the k6 gate. Returns the per-process counter plus the evaluated gate.
export function platformAuthorityMetrics(_req, res) {
  const snapshot = platformAuthorityInstrumentationSnapshot()
  return res.json({ ...snapshot, gate: evaluateWholeDbReadGate(snapshot) })
}
