import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  persisted: { cofounderRequirements: [] },
  bounded: null,
  domainStore: false,
}))

vi.mock('../config/database.js', () => ({
  readAuthorityDb: () => mocks.bounded || mocks.persisted,
  updateAuthorityDb: (mutate) => {
    const snapshot = structuredClone(mocks.persisted)
    const result = mutate(snapshot)
    if (result && typeof result.then === 'function') throw new Error('mutator must be synchronous')
    mocks.persisted = snapshot
    return result
  },
  runBoundedDatabase: (snapshot, callback) => {
    const previous = mocks.bounded
    mocks.bounded = snapshot
    try {
      return callback()
    } finally {
      mocks.bounded = previous
    }
  },
}))

vi.mock('../repositories/domainRepository.js', () => ({
  applyDomainMutation: vi.fn(),
  domainFallbackEnabled: () => true,
  domainStoreEnabled: () => mocks.domainStore,
  runDomainRead: vi.fn(),
}))

const { applyCofounderMutation } = await import('../repositories/cofounderRepository.js')
const { applyDomainMutation } = await import('../repositories/domainRepository.js')

describe('co-founder mutation persistence fallback', () => {
  beforeEach(() => {
    mocks.persisted = { cofounderRequirements: [] }
    mocks.bounded = null
    mocks.domainStore = false
  })

  it('persists changes made through readAuthorityDb in the SQLite/JSON fallback', async () => {
    const result = await applyCofounderMutation('founder', { projectId: 'venture-1' }, () => {
      const db = mocks.bounded || mocks.persisted
      db.cofounderRequirements.push({ id: 'requirement-1' })
      return { ok: true }
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.persisted.cofounderRequirements).toEqual([{ id: 'requirement-1' }])
    expect(mocks.bounded).toBeNull()
  })

  it('uses the same bounded snapshot when the domain store falls back after an error', async () => {
    mocks.domainStore = true
    applyDomainMutation.mockRejectedValueOnce(new Error('domain store unavailable'))

    const result = await applyCofounderMutation('founder', { projectId: 'venture-1' }, () => {
      const db = mocks.bounded || mocks.persisted
      db.cofounderRequirements.push({ id: 'requirement-2' })
      return { ok: true }
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.persisted.cofounderRequirements).toEqual([{ id: 'requirement-2' }])
    expect(mocks.bounded).toBeNull()
  })
})
