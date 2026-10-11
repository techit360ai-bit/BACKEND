import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readDb: vi.fn(() => ({})),
  writeDb: vi.fn(),
  storeEnabled: vi.fn(() => true),
  loadSources: vi.fn(),
  loadProfile: vi.fn(async () => ({ id: 'founder-1', firstName: 'Ada' })),
  saveRow: vi.fn(async () => {}),
  deleteCheckpoint: vi.fn(async () => 0),
}))

vi.mock('../config/database.js', () => ({ readDb: mocks.readDb, writeDb: mocks.writeDb }))
vi.mock('../repositories/contextRepository.js', () => ({
  contextStoreEnabled: mocks.storeEnabled,
  contextFallbackEnabled: () => true,
  loadContextSources: mocks.loadSources,
  loadProfile: mocks.loadProfile,
  saveContextRow: mocks.saveRow,
  deleteContextCheckpoint: mocks.deleteCheckpoint,
}))

const { computeUserState, getSessionContext, createCheckpoint, clearCheckpoint, updateSuggestions } = await import('../services/contextService.js')

const emptySources = () => ({ projects: [], projectAnalyses: [], workspaces: [], opportunityApplications: [], contributions: [], equityGrants: [], investorWatchlists: [], dealRooms: [], hackathons: [], userStateMachine: [], userSessionLogs: [], userContextCheckpoints: [], userSuggestions: [], notifications: [] })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.storeEnabled.mockReturnValue(true)
  mocks.loadSources.mockResolvedValue(emptySources())
})

describe('context row-level store (§5 cutover)', () => {
  it('derives and persists founder state row-level', async () => {
    mocks.loadSources.mockResolvedValue({ ...emptySources(), projects: [{ id: 'p1', ownerId: 'founder-1', status: 'launched' }] })
    const result = await computeUserState('founder-1', 'founder')
    expect(result.currentState).toBe('launched')
    expect(mocks.saveRow).toHaveBeenCalledWith('userStateMachine', expect.objectContaining({ userId: 'founder-1', currentState: 'launched' }))
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.writeDb).not.toHaveBeenCalled()
  })

  it('builds the session context and logs the visit row-level', async () => {
    const result = await getSessionContext('founder-1', 'founder')
    expect(result.greeting).toContain('Ada')
    expect(mocks.saveRow).toHaveBeenCalledWith('userSessionLogs', expect.objectContaining({ userId: 'founder-1' }))
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.writeDb).not.toHaveBeenCalled()
  })

  it('creates a checkpoint row-level', async () => {
    const result = await createCheckpoint('founder-1', { checkpointType: 'idea', referenceId: 'idea-1', nextStep: 'Talk to 5 users' })
    expect(result).toEqual({ ok: true })
    expect(mocks.saveRow).toHaveBeenCalledWith('userContextCheckpoints', expect.objectContaining({ checkpointType: 'idea', referenceId: 'idea-1' }))
    expect(mocks.readDb).not.toHaveBeenCalled()
  })

  it('clears a checkpoint row-level without touching the snapshot', async () => {
    expect(await clearCheckpoint('founder-1', 'idea', 'idea-1')).toEqual({ ok: true })
    expect(mocks.deleteCheckpoint).toHaveBeenCalledWith('founder-1', 'idea', 'idea-1')
    expect(mocks.readDb).not.toHaveBeenCalled()
    expect(mocks.writeDb).not.toHaveBeenCalled()
  })

  it('upserts suggestions row-level', async () => {
    const result = await updateSuggestions('founder-1', { doNow: 'Draft MVP scope', weeklyPriority: 'Ship onboarding' })
    expect(result).toEqual({ ok: true })
    expect(mocks.saveRow).toHaveBeenCalledWith('userSuggestions', expect.objectContaining({ userId: 'founder-1', doNow: 'Draft MVP scope' }))
    expect(mocks.writeDb).not.toHaveBeenCalled()
  })
})
