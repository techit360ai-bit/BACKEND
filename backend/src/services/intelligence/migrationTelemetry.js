const samples = []

export function recordParitySample({ kernel, legacyScore, backendScore, tolerance = 0.01 } = {}) {
  const drift = Math.abs(Number(legacyScore) - Number(backendScore))
  const sample = { kernel, legacyScore: Number(legacyScore), backendScore: Number(backendScore), drift, withinTolerance: drift <= tolerance, recordedAt: new Date().toISOString() }
  samples.push(sample)
  if (samples.length > 1000) samples.shift()
  return sample
}

export function migrationTelemetrySnapshot() {
  const failures = samples.filter(sample => !sample.withinTolerance)
  return { samples: samples.length, parityFailures: failures.length, maxDrift: samples.length ? Math.max(...samples.map(sample => sample.drift)) : 0, recentFailures: failures.slice(-20) }
}
