import { continuousIntelligence } from '../services/recommendationIntelligenceService.js'

export function daily(req, res) { return res.json(continuousIntelligence(req.user.id, { ...req.query, role: req.query.role, organizationId: req.query.organizationId, activeContext: req.user.activeContext || null })) }
