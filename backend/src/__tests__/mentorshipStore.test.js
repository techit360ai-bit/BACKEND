import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'crypto'

const store = vi.hoisted(() => ({
  profiles: [], mentorshipRooms: [], mentorshipMentees: [], mentorshipTasks: [], mentorshipMessages: [],
  mentorshipResources: [], mentorshipInvitations: [], mentorshipApplications: [], notifications: [], feedPosts: [], opportunities: [],
}))

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(),
  enabled: vi.fn(() => true),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/contentRepository.js', () => ({ createMentorshipMessage: vi.fn(), createFeedPost: vi.fn(), contentWriteEnabled: () => false, contentWriteFallbackEnabled: () => true }))
vi.mock('../repositories/mentorshipRepository.js', () => ({
  mentorshipEnabled: () => mocks.enabled(),
  mentorshipFallbackEnabled: () => true,
  readMentorshipSources: vi.fn(async () => store),
  readMentorshipInviteSource: vi.fn(async () => store),
  applyMentorshipMutation: vi.fn(async (_userId, _opts, mutate) => mutate(store)),
}))

const { createMentorshipRoomAsync, listMentorshipRoomsAsync, getMentorshipRoomAsync, applyToMentorshipRoomAsync, createMentorshipTaskAsync, resolveMentorshipInviteAsync } = await import('../services/mentorshipService.js')

const hash = token => createHash('sha256').update(token).digest('hex')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabled.mockReturnValue(true)
  for (const key of Object.keys(store)) store[key].length = 0
})

describe('mentorship row-level store (§5 cutover)', () => {
  it('creates and lists a room without the snapshot', async () => {
    const created = await createMentorshipRoomAsync('mentor-1', { name: 'Fundraising 101', description: 'Weekly cohort', capacity: 10 })
    expect(created.ok).toBe(true)
    expect(store.mentorshipRooms).toHaveLength(1)
    const list = await listMentorshipRoomsAsync('mentor-1', { mine: true })
    expect(list.rooms.map(row => row.id)).toEqual([created.room.id])
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('applies to a published room row-level', async () => {
    store.mentorshipRooms.push({ id: 'r1', mentorId: 'mentor-1', name: 'Room', status: 'published', capacity: 5, createdAt: '2026-01-01T00:00:00.000Z' })
    const applied = await applyToMentorshipRoomAsync('applicant-1', 'r1', { coverLetter: 'Keen' })
    expect(applied.ok).toBe(true)
    expect(store.mentorshipApplications.some(row => row.applicantId === 'applicant-1')).toBe(true)
    expect(store.notifications.some(row => row.userId === 'mentor-1')).toBe(true)
  })

  it('creates a task and reads the room row-level', async () => {
    store.mentorshipRooms.push({ id: 'r1', mentorId: 'mentor-1', name: 'Room', status: 'published', createdAt: '2026-01-01T00:00:00.000Z' })
    const task = await createMentorshipTaskAsync('mentor-1', 'r1', { title: 'Intro call' })
    expect(task.ok).toBe(true)
    const room = await getMentorshipRoomAsync('mentor-1', 'r1')
    expect(room.tasks.map(row => row.id)).toEqual([task.task.id])
  })

  it('resolves an invite by token hash row-level', async () => {
    store.mentorshipRooms.push({ id: 'r1', mentorId: 'mentor-1', name: 'Room', status: 'published', createdAt: '2026-01-01T00:00:00.000Z' })
    store.mentorshipInvitations.push({ id: 'i1', roomId: 'r1', createdBy: 'mentor-1', tokenHash: hash('secret-token'), expiresAt: new Date(Date.now() + 86400000).toISOString(), revokedAt: null, maxUses: 0, uses: 0, createdAt: '2026-01-01T00:00:00.000Z' })
    const resolved = await resolveMentorshipInviteAsync('applicant-1', 'secret-token')
    expect(resolved.ok).toBe(true)
    expect(resolved.room.id).toBe('r1')
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('falls back to the snapshot when the source is sqlite', async () => {
    mocks.enabled.mockReturnValue(false)
    mocks.readAuthorityDb.mockReturnValue({ mentorshipRooms: [{ id: 'r1', mentorId: 'mentor-1', name: 'Snapshot room', status: 'published', createdAt: '2026-01-01T00:00:00.000Z' }], profiles: [] })
    const list = await listMentorshipRoomsAsync('mentor-1', { mine: true })
    expect(list.rooms.map(row => row.id)).toEqual(['r1'])
    expect(mocks.readAuthorityDb).toHaveBeenCalled()
  })
})
