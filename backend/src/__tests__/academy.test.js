import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = {
  projects: [], contributions: [], workspaceTasks: [], mentorshipTasks: [], workspaceMembers: [], workspaces: [],
  projectAnalyses: [], ventureAnalyses: [], academyCurricula: [], academyModules: [], academyProgress: [],
  academyAssessments: [], academyEvents: [], academyBadges: [],
}

vi.mock('../config/database.js', () => ({
  readDb: vi.fn(() => db),
  updateDb: vi.fn(mutator => mutator(db)),
}))

const {
  academyProjects,
  getAcademyCurriculum,
  startAcademyModule,
  saveAcademyReflection,
  scoreAcademyQuiz,
  saveAcademyExercise,
  applyAcademyExerciseReview,
  applyAcademyGeneratedLessons,
  completeAcademyModule,
  triggerAcademyAdaptation,
} = await import('../services/academyService.js')

beforeEach(() => {
  for (const value of Object.values(db)) value.length = 0
})

describe('backend-owned TechIT Academy', () => {
  it('scopes founder and collaborator projects independently', () => {
    db.projects.push(
      { id: 'founder-project', ownerId: 'founder-1', title: 'Founder project', stage: 'idea' },
      { id: 'collab-project', ownerId: 'founder-2', title: 'Collaborator project', stage: 'mvp' },
    )
    db.contributions.push({ collaboratorId: 'collab-1', projectId: 'collab-project' })

    expect(academyProjects('founder-1', 'founder').projects.map(row => row.id)).toEqual(['founder-project'])
    expect(academyProjects('collab-1', 'collaborator').projects.map(row => row.id)).toEqual(['collab-project'])
    expect(getAcademyCurriculum('collab-1', 'collaborator', 'founder-project').error).toBe('project_access_denied')
  })

  it('keeps role tracks and company stories backend-owned', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1', title: 'Evidence venture', stage: 'idea' })
    const founder = getAcademyCurriculum('founder-1', 'founder', 'project-1')
    db.contributions.push({ collaboratorId: 'collab-1', projectId: 'project-1' })
    const collaborator = getAcademyCurriculum('collab-1', 'collaborator', 'project-1')
    expect(founder.curriculum.role).toBe('founder')
    expect(collaborator.curriculum.role).toBe('collaborator')
    expect(founder.curriculum.modules.map(row => row.id)).not.toEqual(collaborator.curriculum.modules.map(row => row.id))
    for (const module of [...founder.curriculum.modules, ...collaborator.curriculum.modules]) {
      expect(module.content.caseStudies.length).toBeGreaterThanOrEqual(2)
      expect(module.content.caseStudies.every(row => /^https?:\/\//.test(row.sourceUrl))).toBe(true)
    }
  })

  it('does not fork a learner curriculum for a timestamp-only project update', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1', title: 'Stable venture', stage: 'idea', updatedAt: '2026-01-01T00:00:00.000Z' })
    const first = getAcademyCurriculum('founder-1', 'founder', 'project-1').curriculum
    db.projects[0].updatedAt = '2026-01-02T00:00:00.000Z'
    const second = getAcademyCurriculum('founder-1', 'founder', 'project-1').curriculum
    expect(second.id).toBe(first.id)
    expect(second.version).toBe(first.version)
  })

  it('rejects locked modules and only completes after server-side gates', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1', title: 'Learning venture', stage: 'idea' })
    const curriculum = getAcademyCurriculum('founder-1', 'founder', 'project-1').curriculum
    const locked = curriculum.modules.find(row => row.status === 'locked')
    expect(startAcademyModule('founder-1', curriculum.id, locked.id).error).toBe('module_locked_or_denied')

    const module = curriculum.modules.find(row => row.status === 'unlocked')
    const started = startAcademyModule('founder-1', curriculum.id, module.id)
    const progress = db.academyProgress.find(row => row.moduleId === module.id)
    progress.engagementSeconds = module.minimumEngagementSeconds
    saveAcademyReflection('founder-1', curriculum.id, module.id, 'This reflection records a concrete project decision and the evidence that would change it.')
    scoreAcademyQuiz('founder-1', curriculum.id, module.id, [0, 0])
    saveAcademyExercise('founder-1', curriculum.id, module.id, 'A project-specific exercise record with evidence, decision criteria, and a measurable next step.')
    applyAcademyExerciseReview('founder-1', curriculum.id, module.id, { passed: true, score: 88, feedback: 'Aligned.' })
    expect(completeAcademyModule('founder-1', curriculum.id, module.id).ok).toBe(true)
    expect(completeAcademyModule('founder-1', curriculum.id, module.id).alreadyComplete).toBe(true)
    expect(started.sessionId).toBeTruthy()
  })

  it('accepts free-model lesson drafts without allowing them to alter authority', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1', title: 'Generated venture', stage: 'idea' })
    const curriculum = getAcademyCurriculum('founder-1', 'founder', 'project-1').curriculum
    const module = curriculum.modules[0]
    expect(applyAcademyGeneratedLessons('founder-1', curriculum.id, { modelUsed: 'openrouter-llama-free', modules: [{ moduleId: module.id, overview: 'Project-specific draft', whyNow: 'Now', keyConcepts: ['evidence'], steps: ['test'], commonMistakes: ['guess'], reflection: 'What changed?', exerciseInstructions: 'Record evidence.', projectApplication: 'Apply to this project.' }] }).ok).toBe(true)
    const reread = getAcademyCurriculum('founder-1', 'founder', 'project-1').curriculum
    expect(reread.modules[0].content.overview).toBe('Project-specific draft')
    expect(reread.modules[0].content.caseStudies.length).toBeGreaterThanOrEqual(2)
    expect(reread.policy.aiAuthority).toBe(false)
  })

  it('exposes all 13 phases for mature projects with complete founder/collaborator tracks', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1', title: 'Mature venture', stage: 'scaling' })
    db.contributions.push({ collaboratorId: 'collab-1', projectId: 'project-1' })
    const founder = getAcademyCurriculum('founder-1', 'founder', 'project-1').curriculum
    const collaborator = getAcademyCurriculum('collab-1', 'collaborator', 'project-1').curriculum
    expect(founder.modules).toHaveLength(13)
    expect(collaborator.modules).toHaveLength(13)
    expect(new Set(founder.modules.map(row => row.phaseIndex))).toEqual(new Set(Array.from({ length: 13 }, (_, index) => index + 1)))
    expect(founder.modules.every(row => row.content.caseStudies.length >= 2 && row.content.steps.length >= 5 && row.content.exercise.instructions.length > 40)).toBe(true)
    expect(collaborator.modules.every(row => row.content.caseStudies.every(item => item.sourceUrl.startsWith('http')))).toBe(true)
  })

  it('creates immutable curriculum history and preserves progress when adaptation signals arrive', () => {
    db.projects.push({ id: 'project-1', ownerId: 'founder-1', title: 'Adapting venture', stage: 'validation' })
    const first = getAcademyCurriculum('founder-1', 'founder', 'project-1').curriculum
    const firstModule = first.modules[0]
    startAcademyModule('founder-1', first.id, firstModule.id)
    const adapted = triggerAcademyAdaptation('founder-1', 'founder', 'project-1', 'customer_validation_completed')
    expect(adapted.ok).toBe(true)
    expect(adapted.curriculum.id).not.toBe(first.id)
    expect(adapted.curriculum.version).toBe(first.version + 1)
    expect(adapted.curriculum.adaptation.history).toHaveLength(2)
    expect(adapted.curriculum.modules[0].progress?.startedAt).toBeTruthy()
    expect(db.academyCurricula.find(row => row.id === first.id).status).toBe('superseded')
    expect(db.academyEvents.some(row => row.triggerEvent === 'customer_validation_completed')).toBe(true)
    const repeated = triggerAcademyAdaptation('founder-1', 'founder', 'project-1', 'pivot_recorded')
    expect(repeated.curriculum.version).toBe(adapted.curriculum.version + 1)
    expect(triggerAcademyAdaptation('founder-1', 'founder', 'project-1', 'unsupported_event').error).toBe('invalid_adaptation_event')
  })
})
