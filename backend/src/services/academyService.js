import crypto from 'node:crypto'
import { readDb, updateDb } from '../config/database.js'
import { createId, nowIso } from '../utils/api.js'
import { academyModulesForRole, ACADEMY_CATALOG_VERSION } from './academyCatalog.js'

const STAGE_ORDER = ['idea', 'validation', 'mvp', 'beta', 'launch', 'launched', 'growth', 'scaling']
const DONE = new Set(['completed', 'complete', 'done', 'shipped', 'resolved'])

function rows(db, name) { if (!Array.isArray(db[name])) db[name] = []; return db[name] }
function roleName(role) { const value = String(role || '').toLowerCase(); return value === 'builder' ? 'collaborator' : value }
function stageOf(project) { return String(project?.stage || project?.status || 'idea').toLowerCase() }
function nameOf(project) { return project?.title || project?.name || project?.startupName || project?.id || 'Project' }
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function rankStage(value) { const index = STAGE_ORDER.indexOf(value); return index < 0 ? 0 : index }
function completed(row) { return DONE.has(String(row?.status || '').toLowerCase()) || row?.isCompleted === true }

function collaboratorAccess(db, userId, projectId) {
  return rows(db, 'contributions').some(row => [row.collaboratorId, row.userId].includes(userId) && row.projectId === projectId)
    || [...rows(db, 'workspaceTasks'), ...rows(db, 'mentorshipTasks')].some(row => [row.assigneeId, row.assignedTo, row.userId, row.ownerId].includes(userId) && [row.projectId, row.startupId].includes(projectId))
    || rows(db, 'workspaceMembers').some(row => row.userId === userId && rows(db, 'workspaces').some(workspace => workspace.id === row.workspaceId && workspace.projectId === projectId))
}

function authorizedProject(db, userId, role, projectId) {
  const project = rows(db, 'projects').find(row => row.id === projectId)
  if (!project) return null
  if (role === 'founder' && [project.ownerId, project.userId, project.founderId].includes(userId)) return project
  if (role === 'collaborator' && collaboratorAccess(db, userId, projectId)) return project
  return null
}

export function academyProjects(userId, rawRole) {
  const role = roleName(rawRole); const db = readDb()
  if (!['founder', 'collaborator'].includes(role)) return { ok: true, projects: [] }
  return { ok: true, projects: rows(db, 'projects').filter(project => authorizedProject(db, userId, role, project.id)).map(project => ({ id: project.id, name: nameOf(project), stage: stageOf(project), industry: project.industry || null, updatedAt: project.updatedAt || project.createdAt || null })) }
}

function projectContext(db, project, userId, role) {
  const tasks = [...rows(db, 'workspaceTasks'), ...rows(db, 'mentorshipTasks')].filter(row => [row.projectId, row.startupId].includes(project.id))
  const contributions = rows(db, 'contributions').filter(row => row.projectId === project.id && (role !== 'collaborator' || [row.collaboratorId, row.userId].includes(userId)))
  const analyses = [...rows(db, 'projectAnalyses'), ...rows(db, 'ventureAnalyses')].filter(row => row.projectId === project.id || row.intakeId === project.intakeId)
  const validations = [...rows(db, 'validationSessions'), ...rows(db, 'customerValidations'), ...rows(db, 'validationRounds')].filter(row => row.projectId === project.id)
  const pivots = [...rows(db, 'pivots'), ...rows(db, 'pivotSignals')].filter(row => row.projectId === project.id)
  const mvpEvents = [...rows(db, 'mvpEvents'), ...rows(db, 'milestones')].filter(row => row.projectId === project.id && ['mvp', 'mvp_shipped', 'mvp_ready'].includes(String(row.type || row.kind || row.status || '').toLowerCase()))
  return { projectId: project.id, name: nameOf(project), stage: stageOf(project), industry: project.industry || null, progress: Number(project.progress || 0), gsisScore: Number(project.gsisScore || 0), users: Number(project.users || 0), revenue: Number(project.revenueMonthly || project.mrr || 0), tasks: tasks.length, completedTasks: tasks.filter(completed).length, contributions: contributions.length, analyses: analyses.length, validationRounds: validations.length, pivots: pivots.length, mvpEvents: mvpEvents.length, updatedAt: project.updatedAt || project.createdAt || null }
}

function selectModules(role, context) {
  const catalog = academyModulesForRole(role)
  const stageRank = rankStage(context.stage)
  // Early-stage projects receive a focused first slice; later stages unlock
  // additional phases without changing prior module IDs or evidence.
  const phaseCount = Math.min(catalog.length, Math.max(3, stageRank <= 0 ? 3 : stageRank === 1 ? 5 : stageRank === 2 ? 7 : stageRank === 3 ? 8 : stageRank === 4 ? 9 : 13))
  const ids = catalog.slice(0, phaseCount).map(module => module.id)
  const selected = ids.map(id => catalog.find(module => module.id === id)).filter(Boolean)
  const selectedIds = new Set(selected.map(module => module.id))
  return selected.map(module => ({ ...module, prerequisites: module.prerequisites.filter(id => selectedIds.has(id)) }))
}

function assessment(module) {
  const cases = module.content.caseStudies
  return [
    { id: `${module.id}.case`, question: `Which company is used as the success example in this module?`, options: [cases[0].company, cases[1].company, 'Neither company'], answer: 0 },
    { id: `${module.id}.lesson`, question: `Which lesson best matches the ${cases[1].company} case?`, options: [cases[1].lesson, cases[0].lesson, 'More funding removes the need for validation'], answer: 0 },
  ]
}

function progressFor(db, userId, projectId, moduleId, contentVersion) {
  return rows(db, 'academyProgress').find(row => row.userId === userId && row.projectId === projectId && row.moduleId === moduleId && row.contentVersion === contentVersion) || null
}

function unlocked(module, completedIds) { return module.prerequisites.every(id => completedIds.includes(id)) }
function clientModule(module, progress, completedIds, enrichment) {
  const status = progress?.status === 'complete' ? 'complete' : unlocked(module, completedIds) ? (progress?.status === 'in_progress' ? 'in_progress' : 'unlocked') : 'locked'
  const generated = module.generatedLesson && typeof module.generatedLesson === 'object' ? module.generatedLesson : null
  const content = generated ? {
    ...module.content,
    whyNow: generated.whyNow || module.content.whyNow,
    overview: generated.overview || module.content.overview,
    keyConcepts: Array.isArray(generated.keyConcepts) && generated.keyConcepts.length ? generated.keyConcepts : module.content.keyConcepts,
    steps: Array.isArray(generated.steps) && generated.steps.length ? generated.steps : module.content.steps,
    commonMistakes: Array.isArray(generated.commonMistakes) && generated.commonMistakes.length ? generated.commonMistakes : module.content.commonMistakes,
    reflection: generated.reflection || module.content.reflection,
    exercise: { ...module.content.exercise, instructions: generated.exerciseInstructions || module.content.exercise.instructions },
  } : module.content
  return { ...module, content, generatedLesson: generated ? { modelUsed: generated.modelUsed || null, generatedAt: generated.generatedAt || null, authoritative: false } : null, status, minimumEngagementSeconds: Math.max(120, Math.round(module.estimatedHours * 600)), projectApplication: generated?.projectApplication || enrichment?.projectApplication || null, coachNotes: enrichment?.coachNotes || [], progress: progress ? { engagementSeconds: progress.engagementSeconds || 0, quizScore: progress.quizScore ?? null, quizPassed: Boolean(progress.quizPassed), exerciseReviewStatus: progress.exerciseReviewStatus || null, exerciseReviewFeedback: progress.exerciseReviewFeedback || null, startedAt: progress.startedAt || null, completedAt: progress.completedAt || null, reflectionSubmitted: Boolean(progress.reflectionHash) } : null, assessment: assessment(module).map(({ answer: _answer, ...question }) => question) }
}

export function getAcademyCurriculum(userId, rawRole, projectId) {
  const role = roleName(rawRole); const snapshot = readDb(); const project = authorizedProject(snapshot, userId, role, projectId)
  if (!project) return { ok: false, status: 403, error: 'project_access_denied' }
  const context = projectContext(snapshot, project, userId, role)
  const adaptationSignals = rows(snapshot, 'academyEvents').filter(row => row.projectId === projectId && row.type === 'adaptation_trigger_received').slice(-10).map(row => row.triggerEvent)
  const selected = selectModules(role, context); const stableContext = { ...context, adaptationSignals }; delete stableContext.updatedAt; const contextHash = digest({ context: stableContext, moduleIds: selected.map(module => module.id), catalogVersion: ACADEMY_CATALOG_VERSION })
  return updateDb(db => {
    let curriculum = rows(db, 'academyCurricula').find(row => row.userId === userId && row.role === role && row.projectId === projectId && row.status === 'active')
    if (!curriculum || curriculum.contextHash !== contextHash) {
      if (curriculum) { curriculum.status = 'superseded'; curriculum.supersededAt = nowIso() }
      const previousVersion = rows(db, 'academyCurricula').filter(row => row.userId === userId && row.role === role && row.projectId === projectId).reduce((max, row) => Math.max(max, Number(row.version || 0)), 0)
      curriculum = { id: createId('academy_curriculum'), userId, role, projectId, projectName: nameOf(project), version: previousVersion + 1, contextHash, context, moduleIds: selected.map(module => module.id), catalogVersion: ACADEMY_CATALOG_VERSION, estimatedHours: selected.reduce((sum, module) => sum + module.estimatedHours, 0), estimatedWeeks: Math.max(1, Math.ceil(selected.reduce((sum, module) => sum + module.estimatedHours, 0) / 6)), status: 'active', generatedAt: nowIso(), updatedAt: nowIso() }
      rows(db, 'academyCurricula').push(curriculum)
      const previousModules = previousVersion ? rows(db, 'academyModules').filter(row => row.projectId === projectId && row.curriculumId !== curriculum.id) : []
      const previousProgress = previousVersion ? rows(db, 'academyProgress').filter(row => row.userId === userId && row.projectId === projectId) : []
      const moduleSnapshots = selected.map(module => ({ ...module, curriculumId: curriculum.id, projectId, projectName: nameOf(project), createdAt: nowIso() }))
      rows(db, 'academyModules').push(...moduleSnapshots)
      // Carry forward compatible learner evidence when a curriculum adapts.
      for (const module of moduleSnapshots) {
        const prior = previousModules.find(row => row.id === module.id)
        const priorProgress = previousProgress.find(row => row.moduleId === module.id && row.contentVersion === prior?.contentVersion)
        if (priorProgress && !progressFor(db, userId, projectId, module.id, module.contentVersion)) {
          rows(db, 'academyProgress').push({ ...priorProgress, id: createId('academy_progress'), curriculumId: curriculum.id, contentVersion: module.contentVersion, adaptedAt: nowIso() })
        }
      }
      rows(db, 'academyEvents').push({ id: createId('academy_event'), type: previousVersion ? 'curriculum_adapted' : 'curriculum_generated', userId, projectId, curriculumId: curriculum.id, metadata: { contextHash, version: curriculum.version, reason: previousVersion ? { stage: context.stage, validationRounds: context.validationRounds, pivots: context.pivots, mvpEvents: context.mvpEvents, revenue: context.revenue, contributions: context.contributions } : 'initial_generation' }, createdAt: nowIso() })
    }
    const modules = rows(db, 'academyModules').filter(row => row.curriculumId === curriculum.id)
    const progress = modules.map(module => progressFor(db, userId, projectId, module.id, module.contentVersion)).filter(Boolean)
    const completedIds = progress.filter(row => row.status === 'complete').map(row => row.moduleId)
    const output = modules.map(module => clientModule(module, progress.find(row => row.moduleId === module.id), completedIds, module.enrichment))
    const next = output.find(module => ['in_progress', 'unlocked'].includes(module.status)) || output.find(module => module.status !== 'complete') || null
    const history = rows(db, 'academyCurricula').filter(row => row.userId === userId && row.role === role && row.projectId === projectId).sort((a, b) => Number(a.version || 0) - Number(b.version || 0)).map(row => ({ id: row.id, version: row.version, status: row.status, generatedAt: row.generatedAt, supersededAt: row.supersededAt || null, context: { stage: row.context?.stage || null } }))
    return { ok: true, curriculum: { id: curriculum.id, projectId, projectName: curriculum.projectName, role, stage: context.stage, version: curriculum.version, catalogVersion: curriculum.catalogVersion, estimatedHours: curriculum.estimatedHours, estimatedWeeks: curriculum.estimatedWeeks, modules: output, nextModuleId: next?.id || null, progress: { completed: completedIds.length, total: output.length }, adaptation: { contextHash, generatedAt: curriculum.generatedAt, history }, policy: { curriculumOwnedBy: 'backend', completionOwnedBy: 'backend', badgesOwnedBy: 'backend', aiAuthority: false } } }
  })
}

function authorizeCurriculum(db, userId, curriculumId) { return rows(db, 'academyCurricula').find(row => row.id === curriculumId && row.userId === userId && row.status === 'active') || null }
function moduleIn(db, curriculumId, moduleId) { return rows(db, 'academyModules').find(row => row.curriculumId === curriculumId && row.id === moduleId) || null }
function completedIds(db, curriculum) { return rows(db, 'academyProgress').filter(row => row.userId === curriculum.userId && row.projectId === curriculum.projectId && row.status === 'complete').map(row => row.moduleId) }

export function startAcademyModule(userId, curriculumId, moduleId) {
  return updateDb(db => {
    const curriculum = authorizeCurriculum(db, userId, curriculumId); const module = curriculum && moduleIn(db, curriculumId, moduleId)
    if (!curriculum || !module || !unlocked(module, completedIds(db, curriculum))) return { ok: false, status: 403, error: 'module_locked_or_denied' }
    let progress = progressFor(db, userId, curriculum.projectId, moduleId, module.contentVersion)
    if (!progress) { progress = { id: createId('academy_progress'), userId, projectId: curriculum.projectId, curriculumId, moduleId, contentVersion: module.contentVersion, status: 'in_progress', engagementSeconds: 0, createdAt: nowIso() }; rows(db, 'academyProgress').push(progress) }
    const sessionId = createId('academy_session'); progress.status = progress.status === 'complete' ? 'complete' : 'in_progress'; progress.startedAt = progress.startedAt || nowIso(); progress.activeSessionId = sessionId; progress.lastHeartbeatAt = nowIso(); progress.updatedAt = nowIso()
    rows(db, 'academyEvents').push({ id: createId('academy_event'), type: 'module_started', userId, projectId: curriculum.projectId, curriculumId, moduleId, metadata: { sessionId }, createdAt: nowIso() })
    return { ok: true, sessionId, progress: { status: progress.status, engagementSeconds: progress.engagementSeconds } }
  })
}

export function heartbeatAcademyModule(userId, curriculumId, moduleId, sessionId) {
  return updateDb(db => {
    const curriculum = authorizeCurriculum(db, userId, curriculumId); const progress = curriculum && progressFor(db, userId, curriculum.projectId, moduleId, moduleIn(db, curriculumId, moduleId)?.contentVersion)
    if (!curriculum || !progress || progress.activeSessionId !== sessionId || progress.status === 'complete') return { ok: false, status: 403, error: 'invalid_learning_session' }
    const now = Date.now(); const prior = new Date(progress.lastHeartbeatAt).getTime(); const elapsed = Number.isFinite(prior) ? Math.max(0, Math.min(90, Math.floor((now - prior) / 1000))) : 0
    progress.engagementSeconds = Math.min(86400, Number(progress.engagementSeconds || 0) + elapsed); progress.lastHeartbeatAt = new Date(now).toISOString(); progress.updatedAt = progress.lastHeartbeatAt
    return { ok: true, engagementSeconds: progress.engagementSeconds }
  })
}

export function saveAcademyReflection(userId, curriculumId, moduleId, text) {
  return updateDb(db => { const curriculum = authorizeCurriculum(db, userId, curriculumId); const module = curriculum && moduleIn(db, curriculumId, moduleId); const progress = module && progressFor(db, userId, curriculum.projectId, moduleId, module.contentVersion); const value = typeof text === 'string' ? text.trim() : ''; if (!progress || value.length < 20) return { ok: false, status: 400, error: 'reflection_invalid' }; progress.reflection = value.slice(0, 5000); progress.reflectionHash = digest(progress.reflection); progress.reflectionSubmittedAt = nowIso(); return { ok: true } })
}

export function scoreAcademyQuiz(userId, curriculumId, moduleId, answers) {
  return updateDb(db => { const curriculum = authorizeCurriculum(db, userId, curriculumId); const module = curriculum && moduleIn(db, curriculumId, moduleId); const progress = module && progressFor(db, userId, curriculum.projectId, moduleId, module.contentVersion); if (!progress || !Array.isArray(answers)) return { ok: false, status: 400, error: 'quiz_invalid' }; const key = assessment(module); const correct = key.filter((question, index) => Number(answers[index]) === question.answer).length; const score = Math.round(correct / key.length * 100); progress.quizScore = score; progress.quizPassed = score >= 70; progress.quizSubmittedAt = nowIso(); rows(db, 'academyAssessments').push({ id: createId('academy_assessment'), userId, projectId: curriculum.projectId, curriculumId, moduleId, score, passed: progress.quizPassed, answersHash: digest(answers), createdAt: nowIso() }); return { ok: true, score, passed: progress.quizPassed } })
}

export function saveAcademyExercise(userId, curriculumId, moduleId, submission) {
  return updateDb(db => { const curriculum = authorizeCurriculum(db, userId, curriculumId); const module = curriculum && moduleIn(db, curriculumId, moduleId); const progress = module && progressFor(db, userId, curriculum.projectId, moduleId, module.contentVersion); const value = typeof submission === 'string' ? submission.trim() : ''; if (!progress || value.length < 40) return { ok: false, status: 400, error: 'exercise_invalid' }; progress.exerciseSubmission = value.slice(0, 10000); progress.exerciseHash = digest(progress.exerciseSubmission); progress.exerciseReviewStatus = 'pending'; progress.exerciseSubmittedAt = nowIso(); return { ok: true, reviewStatus: 'pending', exercise: { projectId: curriculum.projectId, moduleId, title: module.title, objective: module.objective, instructions: module.content.exercise.instructions, submission: progress.exerciseSubmission } } })
}

export function applyAcademyExerciseReview(userId, curriculumId, moduleId, review) {
  return updateDb(db => { const curriculum = authorizeCurriculum(db, userId, curriculumId); const module = curriculum && moduleIn(db, curriculumId, moduleId); const progress = module && progressFor(db, userId, curriculum.projectId, moduleId, module.contentVersion); if (!progress) return { ok: false, status: 404, error: 'progress_not_found' }; const passed = review?.passed === true && Number(review?.score || 0) >= 70; progress.exerciseReviewStatus = passed ? 'approved' : 'needs_revision'; progress.exerciseReviewScore = Math.max(0, Math.min(100, Number(review?.score || 0))); progress.exerciseReviewFeedback = String(review?.feedback || '').slice(0, 3000); progress.exerciseReviewedAt = nowIso(); return { ok: true, reviewStatus: progress.exerciseReviewStatus, score: progress.exerciseReviewScore, feedback: progress.exerciseReviewFeedback } })
}

export function applyAcademyEnrichment(userId, curriculumId, enrichment) {
  return updateDb(db => { const curriculum = authorizeCurriculum(db, userId, curriculumId); if (!curriculum || !Array.isArray(enrichment?.modules)) return { ok: false, status: 400, error: 'enrichment_invalid' }; for (const item of enrichment.modules) { const module = moduleIn(db, curriculumId, item.moduleId); if (!module) continue; module.enrichment = { projectApplication: String(item.projectApplication || '').slice(0, 2000), coachNotes: Array.isArray(item.coachNotes) ? item.coachNotes.slice(0, 5).map(note => String(note).slice(0, 500)) : [], modelUsed: enrichment.modelUsed || null, generatedAt: nowIso(), authoritative: false } } return { ok: true } })
}

export function applyAcademyGeneratedLessons(userId, curriculumId, generated) {
  return updateDb(db => {
    const curriculum = authorizeCurriculum(db, userId, curriculumId)
    if (!curriculum || !Array.isArray(generated?.modules)) return { ok: false, status: 400, error: 'generation_invalid' }
    const allowed = new Set(rows(db, 'academyModules').filter(row => row.curriculumId === curriculumId).map(row => row.id))
    for (const item of generated.modules) {
      if (!item || !allowed.has(item.moduleId)) continue
      const module = moduleIn(db, curriculumId, item.moduleId)
      module.generatedLesson = {
        whyNow: String(item.whyNow || '').slice(0, 2000),
        overview: String(item.overview || '').slice(0, 5000),
        keyConcepts: Array.isArray(item.keyConcepts) ? item.keyConcepts.slice(0, 8).map(value => String(value).slice(0, 300)) : [],
        steps: Array.isArray(item.steps) ? item.steps.slice(0, 10).map(value => String(value).slice(0, 700)) : [],
        commonMistakes: Array.isArray(item.commonMistakes) ? item.commonMistakes.slice(0, 8).map(value => String(value).slice(0, 500)) : [],
        reflection: String(item.reflection || '').slice(0, 1000),
        exerciseInstructions: String(item.exerciseInstructions || '').slice(0, 2000),
        projectApplication: String(item.projectApplication || '').slice(0, 2000),
        modelUsed: generated.modelUsed || null,
        generatedAt: nowIso(),
        authoritative: false,
      }
    }
    return { ok: true }
  })
}

export function completeAcademyModule(userId, curriculumId, moduleId) {
  return updateDb(db => {
    const curriculum = authorizeCurriculum(db, userId, curriculumId); const module = curriculum && moduleIn(db, curriculumId, moduleId); const progress = module && progressFor(db, userId, curriculum.projectId, moduleId, module.contentVersion)
    if (!curriculum || !module || !progress || !unlocked(module, completedIds(db, curriculum))) return { ok: false, status: 403, error: 'module_denied' }
    const minimum = Math.max(120, Math.round(module.estimatedHours * 600)); const requirements = { engagementSeconds: minimum, quizPassed: true, exerciseReviewStatus: 'approved', reflectionSubmitted: true }
    if (Number(progress.engagementSeconds || 0) < minimum || !progress.quizPassed || progress.exerciseReviewStatus !== 'approved' || !progress.reflectionHash) return { ok: false, status: 422, error: 'completion_requirements_unmet', requirements }
    if (progress.status === 'complete') return { ok: true, alreadyComplete: true }
    progress.status = 'complete'; progress.completedAt = nowIso(); progress.activeSessionId = null; progress.completionEvidenceHash = digest({ userId, projectId: curriculum.projectId, curriculumId, moduleId, contentVersion: module.contentVersion, engagementSeconds: progress.engagementSeconds, quizScore: progress.quizScore, exerciseHash: progress.exerciseHash, reflectionHash: progress.reflectionHash })
    rows(db, 'academyEvents').push({ id: createId('academy_event'), type: 'module_completed', userId, projectId: curriculum.projectId, curriculumId, moduleId, metadata: { evidenceHash: progress.completionEvidenceHash }, createdAt: nowIso() })
    const allComplete = curriculum.moduleIds.every(id => rows(db, 'academyProgress').some(row => row.userId === userId && row.projectId === curriculum.projectId && row.moduleId === id && row.status === 'complete'))
    if (allComplete && !rows(db, 'academyBadges').some(row => row.userId === userId && row.projectId === curriculum.projectId && row.role === curriculum.role && row.badgeId === `${curriculum.role}-project-certified`)) rows(db, 'academyBadges').push({ id: createId('academy_badge'), userId, projectId: curriculum.projectId, curriculumId, role: curriculum.role, badgeId: `${curriculum.role}-project-certified`, criteriaVersion: 1, evidenceHash: digest(curriculum.moduleIds), earnedAt: nowIso() })
    return { ok: true, progress: { status: progress.status, completedAt: progress.completedAt }, badgeEarned: allComplete }
  })
}

export function academyBadges(userId) { const db = readDb(); return { ok: true, badges: rows(db, 'academyBadges').filter(row => row.userId === userId) } }

const ADAPTATION_EVENTS = new Set(['project_stage_changed', 'customer_validation_completed', 'pivot_recorded', 'mvp_shipped', 'revenue_started', 'investor_interest_recorded', 'task_blocked', 'technical_incident_detected', 'contribution_verified'])

export function triggerAcademyAdaptation(userId, rawRole, projectId, triggerEvent) {
  const role = roleName(rawRole)
  if (!ADAPTATION_EVENTS.has(String(triggerEvent || ''))) return { ok: false, status: 400, error: 'invalid_adaptation_event' }
  const db = readDb()
  const project = authorizedProject(db, userId, role, projectId)
  if (!project) return { ok: false, status: 403, error: 'project_access_denied' }
  updateDb(store => {
    rows(store, 'academyEvents').push({ id: createId('academy_event'), type: 'adaptation_trigger_received', userId, projectId, triggerEvent, metadata: { source: 'academy_adaptation_endpoint' }, createdAt: nowIso() })
    return store
  })
  return getAcademyCurriculum(userId, role, projectId)
}
