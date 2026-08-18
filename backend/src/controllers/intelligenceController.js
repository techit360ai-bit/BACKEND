import { calculateEvidence, calculateGsis, calculateInvestorSignals, calculateMatch, calculateProfileQuality, getDeterministicIntelligenceSnapshot } from '../services/intelligence/deterministicServices.js'
import { buildTrainingPlan, calculateActivityMomentum, evaluateAdminAnomaly, evaluateTrust } from '../services/intelligence/operationalServices.js'

function body(req) {
  return req.body && typeof req.body === 'object' ? req.body : {}
}

export function gsis(req, res) { return res.json(calculateGsis(body(req))) }
export function investorSignals(req, res) { return res.json(calculateInvestorSignals(body(req))) }
export function match(req, res) { return res.json(calculateMatch(body(req))) }
export function profileQuality(req, res) { return res.json(calculateProfileQuality(body(req))) }
export function evidence(req, res) { return res.json(calculateEvidence(body(req))) }
export function snapshot(req, res) { return res.json(getDeterministicIntelligenceSnapshot(req.user.id)) }
export function training(req, res) { return res.json(buildTrainingPlan(body(req))) }
export function trust(req, res) { return res.json(evaluateTrust(body(req))) }
export function activity(req, res) { return res.json(calculateActivityMomentum(body(req))) }
export function anomaly(req, res) { return res.json(evaluateAdminAnomaly(body(req))) }
