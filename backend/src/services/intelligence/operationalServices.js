import { createEvidence, intelligenceEnvelope } from './responseEnvelope.js'

const list = value => Array.isArray(value) ? value.filter(Boolean) : []
const clamp = value => Math.max(0, Math.min(100, Number(value) || 0))

export function buildTrainingPlan(input = {}) {
  const skills = new Set(list(input.skills).map(value => String(value).toLowerCase()))
  const required = list(input.requiredSkills || input.targetSkills)
  const gaps = required.filter(skill => !skills.has(String(skill).toLowerCase()))
  const weeklyHours = Math.max(1, Number(input.weeklyHours || 5))
  const modules = gaps.map((skill, index) => ({ id: `skill-${index + 1}`, skill, priority: index + 1, estimatedHours: Math.max(2, Number(input.hoursPerSkill || 8)) }))
  const estimatedHours = modules.reduce((sum, module) => sum + module.estimatedHours, 0)
  return intelligenceEnvelope({
    result: { modules, estimatedHours, estimatedDays: Math.ceil(estimatedHours / weeklyHours * 7), adaptive: true },
    score: required.length ? Math.round((required.length - gaps.length) / required.length * 100) : 100,
    status: 'sufficient',
    evidence: createEvidence({ sources: ['profile:skills', 'target:skills'], confidence: 1 }),
  })
}

export function evaluateTrust(input = {}) {
  const blocked = Boolean(input.blocked || input.suspended || input.moderationStatus === 'blocked')
  const verification = input.verified ? 25 : 0
  const reputation = clamp(input.reputationScore)
  const activity = clamp(input.activityScore)
  const reports = Math.min(40, Math.max(0, Number(input.reportCount || 0)) * 8)
  const score = blocked ? 0 : Math.round(verification + reputation * 0.45 + activity * 0.3 - reports)
  return intelligenceEnvelope({
    result: { eligible: !blocked && score >= Number(input.minimumScore || 35), trustScore: clamp(score), badges: input.verified ? ['VERIFIED'] : [], moderationStatus: input.moderationStatus || 'clear' },
    score: clamp(score),
    status: blocked ? 'blocked' : 'provisional_human_review_required',
    evidence: createEvidence({ sources: ['account_status', 'verification', 'reputation', 'activity', 'reports'], confidence: 1 }),
  })
}

export function calculateActivityMomentum(input = {}) {
  const completed = Math.max(0, Number(input.completedActions || 0))
  const planned = Math.max(1, Number(input.plannedActions || 1))
  const inactivityPenalty = Math.min(60, Math.max(0, Number(input.daysInactive || 0)) * 2)
  const score = clamp(completed / planned * 100 - inactivityPenalty)
  const dailyPlan = list(input.pendingActions).slice(0, Math.max(1, Number(input.dailyLimit || 3)))
  return intelligenceEnvelope({ result: { momentumScore: score, dailyPlan, stagnating: score < 35 }, score, status: 'sufficient', evidence: createEvidence({ sources: ['activity_log'], confidence: 1 }) })
}

export function evaluateAdminAnomaly(input = {}) {
  const thresholds = { abuse: Number(input.thresholds?.abuse || 70), spam: Number(input.thresholds?.spam || 60), reports: Number(input.thresholds?.reports || 5) }
  const signals = { abuse: clamp(input.abuseScore), spam: clamp(input.spamScore), reports: Math.max(0, Number(input.reportCount || 0)) }
  const escalations = Object.entries(signals).filter(([key, value]) => value >= thresholds[key]).map(([key]) => key)
  return intelligenceEnvelope({ result: { signals, thresholds, escalations, requiresHumanReview: escalations.length > 0 }, score: Math.max(signals.abuse, signals.spam), status: escalations.length ? 'provisional_human_review_required' : 'sufficient', evidence: createEvidence({ sources: ['moderation_signals'], confidence: 1 }) })
}
