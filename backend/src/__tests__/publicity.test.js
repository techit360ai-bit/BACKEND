import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ db: {}, active: true }))

vi.mock('../config/database.js', () => ({
  readAuthorityDb: vi.fn(() => mocks.db),
  updateAuthorityDb: vi.fn(mutator => mutator(mocks.db)),
}))
vi.mock('../services/capabilityAuthorization.js', () => ({
  subscriptionEntitlement: vi.fn(() => ({ active: mocks.active })),
}))

const svc = await import('../services/publicityService.js')

const base = () => ({
  projects: [{ id: 'p1', ownerId: 'u1', title: 'Nova', tagline: 'AI for X', industry: 'saas', stage: 'launched' }],
  feedPosts: [],
  notifications: [],
  notificationPreferences: [],
})

beforeEach(() => { mocks.db = base(); mocks.active = true })

describe('publicizeLaunchInDb', () => {
  it('publishes a public feed post + founder notification for a subscriber launch', () => {
    const result = svc.publicizeLaunchInDb(mocks.db, 'u1', 'p1')
    expect(result).toMatchObject({ ok: true })
    expect(mocks.db.feedPosts).toHaveLength(1)
    expect(mocks.db.feedPosts[0]).toMatchObject({ authorId: 'u1', visibility: 'public', metadata: { projectId: 'p1', shareKey: 'launch_publicity' } })
    expect(mocks.db.notifications[0]).toMatchObject({ userId: 'u1', type: 'publicity' })
  })

  it('is idempotent per project', () => {
    svc.publicizeLaunchInDb(mocks.db, 'u1', 'p1')
    const second = svc.publicizeLaunchInDb(mocks.db, 'u1', 'p1')
    expect(second.idempotent).toBe(true)
    expect(mocks.db.feedPosts).toHaveLength(1)
  })

  it('requires an active subscription', () => {
    mocks.active = false
    expect(svc.publicizeLaunchInDb(mocks.db, 'u1', 'p1')).toMatchObject({ ok: false, error: 'subscription_required' })
    expect(mocks.db.feedPosts).toHaveLength(0)
  })

  it('respects an explicit publicity opt-out', () => {
    mocks.db.notificationPreferences.push({ userId: 'u1', preferences: { publicity: false } })
    expect(svc.publicizeLaunchInDb(mocks.db, 'u1', 'p1')).toMatchObject({ ok: false, error: 'publicity_disabled' })
  })

  it('respects an opt-out stored in the categories or founder scope', () => {
    mocks.db.notificationPreferences.push({ userId: 'u1', preferences: { categories: { publicity: false } } })
    expect(svc.publicizeLaunchInDb(mocks.db, 'u1', 'p1')).toMatchObject({ ok: false, error: 'publicity_disabled' })
    mocks.db.notificationPreferences[0] = { userId: 'u1', preferences: { founder: { publicity: false } } }
    expect(svc.publicizeLaunchInDb(mocks.db, 'u1', 'p1')).toMatchObject({ ok: false, error: 'publicity_disabled' })
  })

  it('does nothing before launch', () => {
    mocks.db.projects[0].stage = 'mvp'
    expect(svc.publicizeLaunchInDb(mocks.db, 'u1', 'p1')).toMatchObject({ ok: false, error: 'not_launched' })
  })
})
