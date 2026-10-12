import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  projects: [], contributions: [], workspaceTasks: [], mentorshipTasks: [], workspaceMembers: [], workspaces: [],
  projectAnalyses: [], ventureAnalyses: [], validationSessions: [], customerValidations: [], validationRounds: [],
  pivots: [], pivotSignals: [], mvpEvents: [], milestones: [],
  academyCurricula: [], academyModules: [], academyProgress: [], academyAssessments: [], academyBadges: [], academyEvents: [],
}))

const mocks = vi.hoisted(() => ({
  readAuthorityDb: vi.fn(() => ({})),
  updateAuthorityDb: vi.fn(),
  enabled: vi.fn(() => true),
}))

vi.mock('../config/database.js', () => ({ readAuthorityDb: mocks.readAuthorityDb, updateAuthorityDb: mocks.updateAuthorityDb }))
vi.mock('../repositories/academyRepository.js', () => ({
  academyEnabled: () => mocks.enabled(),
  academyFallbackEnabled: () => true,
  readAcademySources: vi.fn(async () => store),
  applyAcademyMutation: vi.fn(async (_userId, _opts, mutate) => mutate(store)),
}))

const { academyProjectsAsync, getAcademyCurriculumAsync, startAcademyModuleAsync, saveAcademyReflectionAsync, academyBadgesAsync } = await import('../services/academyService.js')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.enabled.mockReturnValue(true)
  for (const key of Object.keys(store)) store[key].length = 0
})

describe('academy row-level store (§5 cutover)', () => {
  it('scopes projects row-level without the snapshot', async () => {
    store.projects.push({ id: 'p1', ownerId: 'u1', title: 'Founder venture', stage: 'idea' }, { id: 'p2', ownerId: 'u2', title: 'Someone else', stage: 'mvp' })
    const result = await academyProjectsAsync('u1', 'founder')
    expect(result.projects.map(row => row.id)).toEqual(['p1'])
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('generates a curriculum row-level', async () => {
    store.projects.push({ id: 'p1', ownerId: 'u1', title: 'Founder venture', stage: 'idea' })
    const result = await getAcademyCurriculumAsync('u1', 'founder', 'p1')
    expect(result.ok).toBe(true)
    expect(store.academyCurricula).toHaveLength(1)
    expect(store.academyModules.length).toBeGreaterThan(0)
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('starts a module and records progress row-level', async () => {
    store.projects.push({ id: 'p1', ownerId: 'u1', title: 'Founder venture', stage: 'idea' })
    const curriculum = (await getAcademyCurriculumAsync('u1', 'founder', 'p1')).curriculum
    const unlockedModule = curriculum.modules.find(module => module.status === 'unlocked')
    const started = await startAcademyModuleAsync('u1', curriculum.id, unlockedModule.id)
    expect(started.ok).toBe(true)
    expect(store.academyProgress.some(row => row.moduleId === unlockedModule.id)).toBe(true)
    expect(mocks.updateAuthorityDb).not.toHaveBeenCalled()
  })

  it('saves a reflection row-level', async () => {
    store.projects.push({ id: 'p1', ownerId: 'u1', title: 'Founder venture', stage: 'idea' })
    const curriculum = (await getAcademyCurriculumAsync('u1', 'founder', 'p1')).curriculum
    const unlockedModule = curriculum.modules.find(module => module.status === 'unlocked')
    await startAcademyModuleAsync('u1', curriculum.id, unlockedModule.id)
    const saved = await saveAcademyReflectionAsync('u1', curriculum.id, unlockedModule.id, 'A reflection that records a concrete project decision and the evidence.')
    expect(saved.ok).toBe(true)
    expect(store.academyProgress.find(row => row.moduleId === unlockedModule.id).reflectionHash).toBeTruthy()
  })

  it('reads badges row-level', async () => {
    store.academyBadges.push({ id: 'b1', userId: 'u1', badgeId: 'founder-project-certified' })
    const result = await academyBadgesAsync('u1')
    expect(result.badges.map(row => row.id)).toEqual(['b1'])
    expect(mocks.readAuthorityDb).not.toHaveBeenCalled()
  })

  it('falls back to the snapshot when the source is sqlite', async () => {
    mocks.enabled.mockReturnValue(false)
    mocks.readAuthorityDb.mockReturnValue({ projects: [{ id: 'p1', ownerId: 'u1', title: 'Snapshot venture', stage: 'idea' }] })
    const result = await academyProjectsAsync('u1', 'founder')
    expect(result.projects.map(row => row.id)).toEqual(['p1'])
    expect(mocks.readAuthorityDb).toHaveBeenCalled()
  })
})
