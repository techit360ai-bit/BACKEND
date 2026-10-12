import { continuousIntelligenceAsync } from '../services/recommendationIntelligenceService.js'

export async function daily(req, res) { return res.json(await continuousIntelligenceAsync(req.user.id, { ...req.query, role: req.query.role, organizationId: req.query.organizationId, activeContext: req.user.activeContext || null })) }
