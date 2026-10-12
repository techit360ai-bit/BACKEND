import { collaboratorRecommendationsAsync, founderCollaboratorRecommendationsAsync, organizationTalentRecommendationsAsync, mentorRecommendationsAsync, investorThesisRecommendationsAsync, matchingAccessAsync } from '../services/recommendationIntelligenceService.js'

const body = req => req.body && typeof req.body === 'object' ? req.body : {}
const send = (res, result) => result?.ok === false ? res.status(result.status || 400).json(result) : res.json(result)

export async function collaborators(req, res) { return send(res, await collaboratorRecommendationsAsync(req.user.id, { ...req.query, ...body(req) })) }
export async function founderCollaborators(req, res) { return send(res, await founderCollaboratorRecommendationsAsync(req.user.id, req.params.projectId, { ...req.query, ...body(req) })) }
export async function organizationTalent(req, res) { return send(res, await organizationTalentRecommendationsAsync(req.user.id, { ...req.query, ...body(req) })) }
export async function mentors(req, res) { return send(res, await mentorRecommendationsAsync(req.user.id, { ...req.query, ...body(req) })) }
export async function investorThesis(req, res) { return send(res, await investorThesisRecommendationsAsync(req.user.id, { ...req.query, ...body(req) })) }
export async function access(req, res) { return send(res, await matchingAccessAsync(req.user.id, req.query.role)) }
