import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  db: {},
  platformEvents: [],
}))

vi.mock('../config/database.js', () => ({
  readAuthorityDb: vi.fn(() => mocks.db),
  updateAuthorityDb: vi.fn(mutator => mutator(mocks.db)),
}))
vi.mock('../services/discoveryService.js', () => ({
  appendPlatformEventInDb: vi.fn((_db, event) => { const record = { ...event }; mocks.platformEvents.push(record); return record }),
  appendRelationshipInDb: vi.fn(),
}))

const svc = await import('../services/lifecycleService.js')

const base = () => ({
  projects: [{ id: 'p1', ownerId: 'u1', stage: 'idea', users: 0, revenueMonthly: 0 }],
  workspaces: [{ id: 'w1', projectId: 'p1', ownerId: 'u1' }],
  codeChangeEvents: [],
  projectFiles: [],
  workspaceBuildProfiles: [],
  workspaceLifecycleEvents: [],
  validationSessions: [],
  customerValidations: [],
  validationRounds: [],
  mvpEvents: [],
  milestones: [],
  codeDeploymentVerifications: [],
  codeDeploymentRecords: [],
  documents: [],
})

beforeEach(() => { mocks.db = base(); mocks.platformEvents = [] })

describe('deriveLifecycleStage', () => {
  it('has no stage without evidence', () => {
    expect(svc.deriveLifecycleStage({}).stage).toBe('idea')
  })

  it('first artifact yields prototype', () => {
    expect(svc.deriveLifecycleStage({ hasArtifact: true }).stage).toBe('prototype')
  })

  it('mvp build path yields mvp', () => {
    expect(svc.deriveLifecycleStage({ hasArtifact: true, buildPath: 'mvp' }).stage).toBe('mvp')
  })

  it('validation threshold yields beta', () => {
    expect(svc.deriveLifecycleStage({ buildPath: 'mvp', validationRounds: svc.VALIDATION_BETA_THRESHOLD }).stage).toBe('beta')
    expect(svc.deriveLifecycleStage({ buildPath: 'mvp', validationRounds: svc.VALIDATION_BETA_THRESHOLD - 1 }).stage).toBe('mvp')
  })

  it('verified deploy with live users yields launched', () => {
    expect(svc.deriveLifecycleStage({ verifiedDeployment: true, users: 5 }).stage).toBe('launched')
    expect(svc.deriveLifecycleStage({ verifiedDeployment: true, users: 0 }).stage).toBe('idea')
  })

  it('revenue with 1000+ users yields growth', () => {
    expect(svc.deriveLifecycleStage({ revenue: 500, users: 1200 }).stage).toBe('growth')
    expect(svc.deriveLifecycleStage({ revenue: 500, users: 20 }).stage).toBe('launched')
  })
})

describe('reconcileProjectStage', () => {
  it('advances the project and emits a stage event', () => {
    mocks.db.workspaceBuildProfiles.push({ workspaceId: 'w1', projectId: 'p1', buildPath: 'mvp' })
    const result = svc.reconcileProjectStage('u1', 'p1', { trigger: 'test' })
    expect(result).toMatchObject({ ok: true, changed: true, previous: 'idea', stage: 'mvp', source: 'auto' })
    expect(mocks.db.projects[0].stage).toBe('mvp')
    expect(mocks.db.projects[0].stageSource).toBe('auto')
    expect(mocks.platformEvents).toHaveLength(1)
    expect(mocks.platformEvents[0]).toMatchObject({ eventType: 'project_stage_changed', entityId: 'p1', metadata: { from: 'idea', to: 'mvp', trigger: 'test' } })
    expect(mocks.db.workspaceLifecycleEvents).toHaveLength(1)
    expect(mocks.db.workspaceLifecycleEvents[0]).toMatchObject({ workspaceId: 'w1', previous: { stage: 'idea' }, next: { stage: 'mvp' } })
  })

  it('is monotonic and never downgrades on weaker evidence', () => {
    mocks.db.projects[0].stage = 'launched'
    mocks.db.codeChangeEvents.push({ workspaceId: 'w1', type: 'file_created' })
    const result = svc.reconcileProjectStage('u1', 'p1', {})
    expect(result.changed).toBe(false)
    expect(mocks.db.projects[0].stage).toBe('launched')
    expect(mocks.platformEvents).toHaveLength(0)
  })

  it('keeps an explicit manual override', () => {
    mocks.db.projects[0].stage = 'mvp'
    mocks.db.projects[0].stageSource = 'manual'
    mocks.db.workspaceBuildProfiles.push({ workspaceId: 'w1', projectId: 'p1', buildPath: 'mvp' })
    mocks.db.codeDeploymentVerifications.push({ workspaceId: 'w1', status: 'verified' })
    mocks.db.projects[0].users = 10
    const result = svc.reconcileProjectStage('u1', 'p1', {})
    expect(result).toMatchObject({ changed: false, stage: 'mvp', source: 'manual', manualKept: true })
  })

  it('records a manual stage change as the override source', () => {
    const project = mocks.db.projects[0]
    project.stage = 'launched'
    svc.noteManualStageInDb(mocks.db, 'u1', project, 'idea')
    expect(project.stageSource).toBe('manual')
    expect(mocks.platformEvents[0]).toMatchObject({ metadata: { from: 'idea', to: 'launched', source: 'manual' } })
    const kept = svc.reconcileProjectStage('u1', 'p1', {})
    expect(kept.manualKept).toBe(true)
  })
})
