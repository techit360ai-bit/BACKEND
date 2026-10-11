// Whole-database-read instrumentation for the §5 "1M users" acceptance gate.
//
// The scaling gate requires *query instrumentation* proving the request path
// never performs a whole-database read. The canonical whole-DB read is
// `loadPlatformDatabase()` ->
//   SELECT ... FROM platform_collection_records WHERE deleted_at IS NULL
// which returns every live platform row. This module is the instrument: a
// dependency-free, in-process counter that the snapshot repository increments.
// It is also the "zero whole-DB reads" evidence surfaced by
// `GET /internal/metrics/platform-authority` and asserted by
// `scripts/assert-no-whole-db-reads.js` around a k6 run.
//
// Rules:
//   * Counting is best-effort and must never affect a request.
//   * It never stores row data, ids, or payloads — only counts/timestamps.

// The only HTTP request-path caller is the `postgresAuthority` middleware
// (`app.use(postgresAuthority)`). A k6 run must leave it at zero even though
// background maintenance and the discovery worker may legitimately read the
// whole database through `runWithPlatformDatabase` during the same window.
// Override this set with `--source` when a deployment adds another wrapper.
export const DEFAULT_REQUEST_PATH_SOURCES = ['postgresAuthority']

const snapshot = {
  reads: 0,
  readsBySource: new Map(),
  flushes: 0,
  flushesBySource: new Map(),
  lastReadAt: null,
  lastFlushAt: null,
}

const bump = (map, source) => { const key = String(source || 'unknown'); map.set(key, (map.get(key) || 0) + 1) }
const countIn = (counts, sources) => sources.reduce((total, source) => total + (Number(counts[source]) || 0), 0)

/** Record one whole-database read (loadPlatformDatabase). */
export function recordWholeDbRead(source = 'unknown') {
  snapshot.reads += 1
  snapshot.lastReadAt = new Date().toISOString()
  bump(snapshot.readsBySource, source)
}

/** Record one whole-database flush (flushPlatformDatabase). */
export function recordWholeDbFlush(source = 'unknown') {
  snapshot.flushes += 1
  snapshot.lastFlushAt = new Date().toISOString()
  bump(snapshot.flushesBySource, source)
}

/**
 * Evaluate the §5 gate: zero whole-DB reads attributable to the request path.
 * Pure over a snapshot object so it is unit-testable and reusable by both the
 * metrics endpoint and the CI assertion script.
 */
export function evaluateWholeDbReadGate(snapshotView = {}, { requestPathSources = DEFAULT_REQUEST_PATH_SOURCES } = {}) {
  const bySource = snapshotView.whole_db_reads_by_source || {}
  const violations = requestPathSources
    .map(source => ({ source, reads: Number(bySource[source]) || 0 }))
    .filter(entry => entry.reads > 0)
  return {
    ok: violations.length === 0,
    request_path_sources: requestPathSources,
    request_path_reads: violations.reduce((total, entry) => total + entry.reads, 0),
    violations,
    whole_db_reads: Number(snapshotView.whole_db_reads) || 0,
  }
}

/** A serializable view for the internal metrics endpoint / gate assertion. */
export function platformAuthorityInstrumentationSnapshot({ requestPathSources = DEFAULT_REQUEST_PATH_SOURCES } = {}) {
  const bySource = Object.fromEntries(snapshot.readsBySource)
  const requestPathReads = countIn(bySource, requestPathSources)
  return {
    whole_db_reads: snapshot.reads,
    whole_db_reads_by_source: bySource,
    whole_db_flushes: snapshot.flushes,
    whole_db_flushes_by_source: Object.fromEntries(snapshot.flushesBySource),
    request_path_sources: requestPathSources,
    request_path_reads: requestPathReads,
    // The gate: when false the request path still scales with total data.
    request_path_reads_disabled: requestPathReads === 0,
    last_read_at: snapshot.lastReadAt,
    last_flush_at: snapshot.lastFlushAt,
  }
}


/**
 * Merge per-replica snapshots (multi-replica gate reads each pod) into one
 * aggregate before evaluating the gate. Counts sum; timestamps take the latest.
 */
export function mergePlatformAuthoritySnapshots(snapshots = []) {
  const merged = { whole_db_reads: 0, whole_db_reads_by_source: {}, whole_db_flushes: 0, whole_db_flushes_by_source: {}, last_read_at: null, last_flush_at: null }
  const sumInto = (target, source) => {
    for (const [key, value] of Object.entries(source || {})) target[key] = (target[key] || 0) + (Number(value) || 0)
  }
  for (const snap of snapshots) {
    if (!snap) continue
    merged.whole_db_reads += Number(snap.whole_db_reads) || 0
    merged.whole_db_flushes += Number(snap.whole_db_flushes) || 0
    sumInto(merged.whole_db_reads_by_source, snap.whole_db_reads_by_source)
    sumInto(merged.whole_db_flushes_by_source, snap.whole_db_flushes_by_source)
    if (snap.last_read_at && (!merged.last_read_at || snap.last_read_at > merged.last_read_at)) merged.last_read_at = snap.last_read_at
    if (snap.last_flush_at && (!merged.last_flush_at || snap.last_flush_at > merged.last_flush_at)) merged.last_flush_at = snap.last_flush_at
  }
  return merged
}


/**
 * Per-source difference (current - baseline) so a gate can be evaluated over the
 * window between two scrapes instead of the process lifetime.
 */
export function subtractPlatformAuthoritySnapshots(current = {}, baseline = {}) {
  const diff = (a = {}, b = {}) => {
    const out = {}
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) out[key] = (Number(a[key]) || 0) - (Number(b[key]) || 0)
    return out
  }
  return {
    whole_db_reads: (Number(current.whole_db_reads) || 0) - (Number(baseline.whole_db_reads) || 0),
    whole_db_reads_by_source: diff(current.whole_db_reads_by_source, baseline.whole_db_reads_by_source),
    whole_db_flushes: (Number(current.whole_db_flushes) || 0) - (Number(baseline.whole_db_flushes) || 0),
    whole_db_flushes_by_source: diff(current.whole_db_flushes_by_source, baseline.whole_db_flushes_by_source),
  }
}

// Test seam only. Never called from a request path.
export function resetPlatformAuthorityInstrumentation() {
  snapshot.reads = 0
  snapshot.flushes = 0
  snapshot.readsBySource.clear()
  snapshot.flushesBySource.clear()
  snapshot.lastReadAt = null
  snapshot.lastFlushAt = null
}
