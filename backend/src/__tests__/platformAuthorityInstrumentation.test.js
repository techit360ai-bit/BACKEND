import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../repositories/platformCollectionRepository.js', () => ({
  getPlatformPool: () => ({ query: async () => ({ rows: [] }) }),
  upsertRecord: async () => {},
  deleteRecord: async () => {},
}))

import { loadPlatformDatabase } from '../repositories/platformDatabaseRepository.js'
import {
  DEFAULT_REQUEST_PATH_SOURCES,
  evaluateWholeDbReadGate,
  mergePlatformAuthoritySnapshots,
  platformAuthorityInstrumentationSnapshot,
  recordWholeDbFlush,
  recordWholeDbRead,
  resetPlatformAuthorityInstrumentation,
  subtractPlatformAuthoritySnapshots,
} from '../services/platformAuthorityInstrumentation.js'

afterEach(() => resetPlatformAuthorityInstrumentation())

describe('platform authority instrumentation (§5)', () => {
  it('counts reads/flushes by source and never stores payloads', () => {
    recordWholeDbRead('postgresAuthority')
    recordWholeDbRead('postgresAuthority')
    recordWholeDbRead('discovery-worker')
    recordWholeDbFlush('postgresAuthority')

    const snapshot = platformAuthorityInstrumentationSnapshot()
    expect(snapshot.whole_db_reads).toBe(3)
    expect(snapshot.whole_db_reads_by_source).toEqual({ postgresAuthority: 2, 'discovery-worker': 1 })
    expect(snapshot.whole_db_flushes_by_source).toEqual({ postgresAuthority: 1 })
    expect(snapshot.request_path_reads).toBe(2)
    expect(snapshot.request_path_reads_disabled).toBe(false)
    expect(Object.keys(snapshot)).not.toContain('rows')
  })

  it('reset clears all counters', () => {
    recordWholeDbRead('postgresAuthority')
    resetPlatformAuthorityInstrumentation()
    expect(platformAuthorityInstrumentationSnapshot()).toMatchObject({ whole_db_reads: 0, request_path_reads: 0, request_path_reads_disabled: true })
  })

  it('loadPlatformDatabase records the caller-provided source', async () => {
    await loadPlatformDatabase('postgresAuthority')
    await loadPlatformDatabase()
    const snapshot = platformAuthorityInstrumentationSnapshot()
    expect(snapshot.whole_db_reads).toBe(2)
    expect(snapshot.whole_db_reads_by_source).toEqual({ postgresAuthority: 1, unknown: 1 })
  })
})

describe('whole-DB-read gate', () => {
  it('passes when only non-request-path sources read', () => {
    recordWholeDbRead('discovery-worker')
    recordWholeDbFlush('discovery-worker')
    const gate = evaluateWholeDbReadGate(platformAuthorityInstrumentationSnapshot())
    expect(gate.ok).toBe(true)
    expect(gate.request_path_reads).toBe(0)
    expect(DEFAULT_REQUEST_PATH_SOURCES).toContain('postgresAuthority')
  })

  it('fails and names the offending request-path source', () => {
    recordWholeDbRead('postgresAuthority')
    recordWholeDbRead('postgresAuthority')
    const gate = evaluateWholeDbReadGate(platformAuthorityInstrumentationSnapshot())
    expect(gate.ok).toBe(false)
    expect(gate.request_path_reads).toBe(2)
    expect(gate.violations).toEqual([{ source: 'postgresAuthority', reads: 2 }])
  })

  it('honors a custom request-path source list', () => {
    recordWholeDbRead('discovery-worker')
    const gate = evaluateWholeDbReadGate(platformAuthorityInstrumentationSnapshot(), { requestPathSources: ['discovery-worker'] })
    expect(gate.ok).toBe(false)
  })
})

describe('multi-replica aggregation', () => {
  it('merges per-replica counters and timestamps', () => {
    const merged = mergePlatformAuthoritySnapshots([
      { whole_db_reads: 2, whole_db_reads_by_source: { 'discovery-worker': 2 }, whole_db_flushes: 0, whole_db_flushes_by_source: {}, last_read_at: '2026-01-01T00:00:00.000Z' },
      { whole_db_reads: 1, whole_db_reads_by_source: { postgresAuthority: 1 }, whole_db_flushes: 3, whole_db_flushes_by_source: { postgresAuthority: 3 }, last_read_at: '2026-01-02T00:00:00.000Z' },
    ])
    expect(merged.whole_db_reads).toBe(3)
    expect(merged.whole_db_reads_by_source).toEqual({ 'discovery-worker': 2, postgresAuthority: 1 })
    expect(merged.whole_db_flushes).toBe(3)
    expect(merged.last_read_at).toBe('2026-01-02T00:00:00.000Z')
    expect(evaluateWholeDbReadGate(merged).ok).toBe(false)
  })

  it('computes a window delta between two scrapes', () => {
    const delta = subtractPlatformAuthoritySnapshots(
      { whole_db_reads: 5, whole_db_reads_by_source: { postgresAuthority: 3, 'discovery-worker': 2 }, whole_db_flushes: 4, whole_db_flushes_by_source: { postgresAuthority: 4 } },
      { whole_db_reads: 1, whole_db_reads_by_source: { 'discovery-worker': 1 }, whole_db_flushes: 1, whole_db_flushes_by_source: { postgresAuthority: 1 } },
    )
    expect(delta.whole_db_reads).toBe(4)
    expect(delta.whole_db_reads_by_source).toEqual({ postgresAuthority: 3, 'discovery-worker': 1 })
    expect(evaluateWholeDbReadGate(delta).violations).toEqual([{ source: 'postgresAuthority', reads: 3 }])
  })
})
