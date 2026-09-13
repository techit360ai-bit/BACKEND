import { collaboratorRecommendations, founderCollaboratorRecommendations, organizationTalentRecommendations, mentorRecommendations, investorThesisRecommendations } from '../services/recommendationIntelligenceService.js'

const body = req => req.body && typeof req.body === 'object' ? req.body : {}
const send = (res, result) => result?.ok === false ? res.status(result.status || 400).json(result) : res.json(result)

export function collaborators(req, res) { return send(res, collaboratorRecommendations(req.user.id, { ...req.query, ...body(req) })) }
export function founderCollaborators(req, res) { return send(res, founderCollaboratorRecommendations(req.user.id, req.params.projectId, { ...req.query, ...body(req) })) }
export function organizationTalent(req, res) { return send(res, organizationTalentRecommendations(req.user.id, { ...req.query, ...body(req) })) }
export function mentors(req, res) { return send(res, mentorRecommendations(req.user.id, { ...req.query, ...body(req) })) }
export function investorThesis(req, res) { return send(res, investorThesisRecommendations(req.user.id, { ...req.query, ...body(req) })) }
