import { academyProjects, getAcademyCurriculum, triggerAcademyAdaptation, startAcademyModule, heartbeatAcademyModule, saveAcademyReflection, scoreAcademyQuiz, saveAcademyExercise, applyAcademyExerciseReview, applyAcademyEnrichment, applyAcademyGeneratedLessons, completeAcademyModule, academyBadges } from '../services/academyService.js'
import { requestAcademyEnrichment, requestAcademyExerciseReview, requestAcademyModuleGeneration } from '../services/aiRouterClient.js'
import { intelligenceStateEnabled, intelligenceStateFallbackEnabled, syncIntelligenceState } from '../repositories/intelligenceStateRepository.js'

function send(res, value, created = false) { return res.status(value?.status || (value?.ok === false ? 400 : created ? 201 : 200)).json(value) }
async function persisted(req, value) { if (!intelligenceStateEnabled() || value?.ok === false) return value; try { await syncIntelligenceState(req.user.id); return value } catch (error) { if (intelligenceStateFallbackEnabled()) return value; return { ok: false, error: 'intelligence_write_temporarily_unavailable' } } }
export function projects(req, res) { return send(res, academyProjects(req.user.id, req.user.role)) }
export async function adapt(req, res) { return send(res, await persisted(req, triggerAcademyAdaptation(req.user.id, req.user.role, String(req.body?.projectId || ''), String(req.body?.triggerEvent || '')))) }
export async function curriculum(req, res) {
  const result = getAcademyCurriculum(req.user.id, req.user.role, String(req.query.projectId || ''))
  if (!result.ok) return send(res, result)
  const needsGeneration = result.curriculum.modules.some(module => !module.generatedLesson)
  if (needsGeneration) {
    const generated = await requestAcademyModuleGeneration(req.user.token, {
      curriculumId: result.curriculum.id,
      role: result.curriculum.role,
      project: { id: result.curriculum.projectId, name: result.curriculum.projectName, stage: result.curriculum.stage },
      modules: result.curriculum.modules.map(module => ({
        id: module.id,
        title: module.title,
        description: module.description,
        objective: module.objective,
        phase: module.phase,
        tags: module.tags,
        verifiedCases: module.content.caseStudies,
      })),
    })
    if (generated?.modules?.length) applyAcademyGeneratedLessons(req.user.id, result.curriculum.id, generated)
  }
  const enrichment = await requestAcademyEnrichment(req.user.token, { curriculumId: result.curriculum.id, project: { id: result.curriculum.projectId, name: result.curriculum.projectName, stage: result.curriculum.stage }, role: result.curriculum.role, modules: result.curriculum.modules.map(module => ({ id: module.id, title: module.title, objective: module.objective, phase: module.phase })) })
  if (enrichment?.modules) applyAcademyEnrichment(req.user.id, result.curriculum.id, enrichment)
  return send(res, getAcademyCurriculum(req.user.id, req.user.role, String(req.query.projectId || '')))
}
export async function start(req, res) { return send(res, await persisted(req, startAcademyModule(req.user.id, req.params.curriculumId, req.params.moduleId)), true) }
export async function heartbeat(req, res) { return send(res, await persisted(req, heartbeatAcademyModule(req.user.id, req.params.curriculumId, req.params.moduleId, req.body?.sessionId))) }
export async function reflection(req, res) { return send(res, await persisted(req, saveAcademyReflection(req.user.id, req.params.curriculumId, req.params.moduleId, req.body?.text))) }
export async function quiz(req, res) { return send(res, await persisted(req, scoreAcademyQuiz(req.user.id, req.params.curriculumId, req.params.moduleId, req.body?.answers))) }
export async function exercise(req, res) {
  const submitted = await persisted(req, saveAcademyExercise(req.user.id, req.params.curriculumId, req.params.moduleId, req.body?.submission))
  if (!submitted.ok) return send(res, submitted)
  const review = await requestAcademyExerciseReview(req.user.token, submitted.exercise)
  if (!review) return send(res, { ok: true, reviewStatus: 'pending', message: 'Exercise saved. Review is pending.' })
  return send(res, applyAcademyExerciseReview(req.user.id, req.params.curriculumId, req.params.moduleId, review))
}
export async function complete(req, res) { return send(res, await persisted(req, completeAcademyModule(req.user.id, req.params.curriculumId, req.params.moduleId))) }
export function badges(req, res) { return send(res, academyBadges(req.user.id)) }
