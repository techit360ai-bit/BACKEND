const POLICY_ID = 'techit-scoring-2026-08-14-v1'
const POLICY_VERSION = '2026-08-14.1'

const WEIGHTS = Object.freeze({
  gsis: Object.freeze({ product_progress: 0.15, execution_velocity: 0.15, market_readiness: 0.20, beta_satisfaction: 0.10, revenue_growth: 0.10, founder_reputation: 0.10, community_influence: 0.05, investor_interest: 0.10, compliance: 0.05 }),
  unicorn: Object.freeze({ market_size: 0.15, problem_severity: 0.12, founder_advantage: 0.10, technological_moat: 0.12, scalability: 0.12, network_effects: 0.10, revenue_model_strength: 0.10, market_timing: 0.08, competition_landscape: 0.06, capital_efficiency: 0.05 }),
  eviInvestor: Object.freeze({ mdr: 0.25, is: 0.20, trv: 0.15, rta: 0.20, ugm: 0.10, cev: 0.10 }),
  investment: Object.freeze({ market_readiness: 0.30, traction: 0.25, team: 0.15, risk_inverse: 0.15, growth: 0.10, differentiation: 0.05 }),
  match: Object.freeze({ skill: 0.30, goal: 0.20, execution_style: 0.15, availability: 0.15, trust: 0.10, domain: 0.10 }),
})

const clamp = (value, min = 0, max = 100) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.max(min, Math.min(max, number))
}

const round = (value, digits = 2) => Number(Number(value).toFixed(digits))

export function policyMetadata() {
  return { policyId: POLICY_ID, policyVersion: POLICY_VERSION }
}

export function computeDecayFactor(daysInactive = 0) {
  return round(Math.exp(-0.02 * Math.max(0, Number(daysInactive) || 0)), 4)
}

export function computeGcis(components = {}) {
  const normalized = Object.fromEntries(Object.entries(WEIGHTS.gsis).map(([key]) => [key, clamp(components[key])]))
  const score = Object.entries(WEIGHTS.gsis).reduce((sum, [key, weight]) => sum + weight * normalized[key], 0)
  const gsis = round(clamp(score))
  const alertScore = round(Math.min(100, Math.max(0, 40 - gsis) + Math.max(0, 30 - normalized.execution_velocity) + Math.max(0, 30 - normalized.market_readiness)))
  const classification = gsis >= 80 ? 'Exceptional' : gsis >= 65 ? 'Strong' : gsis >= 50 ? 'Moderate' : 'At Risk'
  return { gsis, classification, alertScore, alertTriggered: alertScore > 20, components: normalized, ...policyMetadata(), humanReviewRequired: true }
}

export const computeGsis = computeGcis

export function computeUnicornPotentialScore(drivers = {}) {
  const driverBreakdown = {}
  let total = 0
  for (const [key, weight] of Object.entries(WEIGHTS.unicorn)) {
    const rawScore = clamp(drivers[key], 0, 10)
    const contribution = rawScore * weight * 10
    total += contribution
    driverBreakdown[key] = { rawScore, weight, contribution: round(contribution) }
  }
  const score = round(clamp(total))
  return { unicornPotentialScore: score, classification: score >= 80 ? 'Exceptional Opportunity' : score >= 65 ? 'Strong Opportunity' : score >= 50 ? 'Promising Opportunity' : 'Weak Opportunity', driverBreakdown, scoreKind: 'heuristic_human_review_required', probabilityCalibrated: false, ...policyMetadata(), humanReviewRequired: true }
}

export function computeEvi({ milestonesCompleted30d = 0, avgResponseTimeHours = 24, iterationsPerMonth = 0, codeDesignContributions = 0, stagnationDays = 0 } = {}) {
  const mc = Math.min(1, Math.max(0, milestonesCompleted30d / 10))
  const rc = Math.min(1, 1 / Math.max(1, avgResponseTimeHours))
  const ic = Math.min(1, Math.max(0, iterationsPerMonth / 20))
  const cc = Math.min(1, Math.max(0, codeDesignContributions / 50))
  const st = Math.min(1, Math.max(0, stagnationDays / 30))
  return round(clamp((0.30 * mc + 0.20 * rc + 0.20 * ic + 0.20 * cc - 0.10 * st) * 100))
}

export function computeEviInvestor(values = {}) {
  const raw = Object.entries(WEIGHTS.eviInvestor).reduce((sum, [key, weight]) => sum + weight * clamp(values[key]), 0)
  const decayFactor = computeDecayFactor(values.daysSinceLastUpdate || 0)
  const adjusted = round(clamp(raw * decayFactor))
  return { rawEviI: round(clamp(raw)), decayFactor, adjustedEviI: adjusted, signal: adjusted >= 80 ? 'exceptional' : adjusted >= 65 ? 'strong' : adjusted >= 50 ? 'moderate' : 'stalled', dimensions: Object.fromEntries(Object.keys(WEIGHTS.eviInvestor).map(key => [key, clamp(values[key])])), ...policyMetadata(), humanReviewRequired: true }
}

export function computeRgs({ mrrGrowthPct = 0, userGrowthPct = 0, retentionPct = 0, revenueConsistencyScore = 0 } = {}) {
  return round(clamp(0.35 * clamp(mrrGrowthPct) + 0.25 * clamp(userGrowthPct) + 0.25 * clamp(retentionPct) + 0.15 * clamp(revenueConsistencyScore)))
}

export function computeBss({ avgUxRating = 0, avgPerformanceRating = 0, nps = -100, willingnessToPayPct = 0 } = {}) {
  return round(clamp(0.30 * Math.min(10, Math.max(0, avgUxRating)) / 10 * 100 + 0.25 * Math.min(10, Math.max(0, avgPerformanceRating)) / 10 * 100 + 0.25 * clamp((Number(nps) + 100) / 2) + 0.20 * clamp(willingnessToPayPct)))
}

export function computeComplianceScore(items = {}) {
  const checks = ['data_policy_present', 'security_audit_complete', 'ai_bias_disclosure', 'region_compatibility_verified', 'api_risk_scan_passed']
  return round(checks.filter(key => items[key] === true).length / checks.length * 100)
}

export function computeMarketReadiness({ executionScore = 0, betaSatisfaction = 0, revenueSignal = 0, complianceScore = 0, globalReadiness = 0, stabilityScore = 0 } = {}) {
  return round(clamp(0.25 * clamp(executionScore) + 0.20 * clamp(betaSatisfaction) + 0.20 * clamp(revenueSignal) + 0.15 * clamp(complianceScore) + 0.10 * clamp(globalReadiness) + 0.10 * clamp(stabilityScore)))
}

export function computeTransparencyScore(items = {}) {
  const checks = ['pitch_deck_uploaded', 'financials_provided', 'team_profiles_complete', 'product_demo_linked', 'metrics_dashboard_public', 'legal_docs_uploaded']
  return round(checks.filter(key => items[key] === true).length / checks.length * 100)
}

export function computeFounderReliability({ loginConsistencyPct = 0, milestoneHitRatePct = 0, feedbackResponsiveness = 0, communityContribution = 0, profileCompletenessPct = 0 } = {}) {
  return round(clamp(0.30 * clamp(loginConsistencyPct) + 0.30 * clamp(milestoneHitRatePct) + 0.20 * clamp(feedbackResponsiveness) + 0.10 * clamp(communityContribution) + 0.10 * clamp(profileCompletenessPct)))
}

export function computeCis({ postEngagementScore = 0, contentValueScore = 0, followerQualityScore = 0 } = {}) {
  return round(clamp((clamp(postEngagementScore) + clamp(contentValueScore) + clamp(followerQualityScore)) / 3))
}

export function computeIis({ profileViewsNormalised = 0, savesNormalised = 0, contactRequestsNormalised = 0, watchlistAddsNormalised = 0 } = {}) {
  return round(clamp((clamp(profileViewsNormalised) + clamp(savesNormalised) + clamp(contactRequestsNormalised) + clamp(watchlistAddsNormalised)) / 4))
}

export function computePps({ completedTasks = 0, totalTasks = 0, qualityFactor = 0 } = {}) {
  if (Number(totalTasks) <= 0) return 0
  return round(clamp(Math.max(0, completedTasks) / totalTasks * Math.min(1, Math.max(0, qualityFactor)) * 100))
}

export function computeTss({ skillCoveragePct = 0, activityLevelScore = 0, deliveryRatePct = 0, collaborationScore = 0 } = {}) {
  return round(clamp((clamp(skillCoveragePct) + clamp(activityLevelScore) + clamp(deliveryRatePct) + clamp(collaborationScore)) / 4))
}

export function computeWcrs({ marketReadiness = 0, executionVelocity = 0, betaSatisfaction = 0, revenueGrowthSignal = 0, complianceScore = 0, transparencyScore = 0, founderReliabilityScore = 0, qualityFlags = 0, daysSinceLastUpdate = 0 } = {}) {
  const base = 0.25 * clamp(marketReadiness) + 0.20 * clamp(executionVelocity) + 0.15 * clamp(betaSatisfaction) + 0.15 * clamp(revenueGrowthSignal) + 0.10 * clamp(complianceScore) + 0.10 * clamp(transparencyScore) + 0.05 * clamp(founderReliabilityScore)
  const qualityMultiplier = 1 + 0.05 * Math.min(3, Math.max(0, qualityFlags))
  const finalBeforeDecay = base * qualityMultiplier
  return { baseWcrs: round(base), qualityMultiplier: round(qualityMultiplier, 4), finalBeforeDecay: round(finalBeforeDecay), decayFactor: computeDecayFactor(daysSinceLastUpdate), adjustedScore: round(finalBeforeDecay * computeDecayFactor(daysSinceLastUpdate)), ...policyMetadata() }
}

export function computeInvestmentScore(values = {}) {
  const score = Object.entries(WEIGHTS.investment).reduce((sum, [key, weight]) => sum + weight * clamp(values[key]), 0)
  return round(clamp(score))
}

export function computeMatchScore(values = {}) {
  const score = Object.entries(WEIGHTS.match).reduce((sum, [key, weight]) => sum + weight * clamp(values[key], 0, 1), 0)
  return round(clamp(score * 100))
}

export function computeDcs({ deliveryRate = 0, qualityScore = 0, responseVelocity = 0, collaborationReliability = 0 } = {}) {
  return round(clamp(0.35 * clamp(deliveryRate) + 0.25 * clamp(qualityScore) + 0.20 * clamp(responseVelocity) + 0.20 * clamp(collaborationReliability)))
}

export const SCORE_KERNELS = Object.freeze({ computeGsis, computeGcis, computeUnicornPotentialScore, computeEvi, computeEviInvestor, computeRgs, computeBss, computeComplianceScore, computeMarketReadiness, computeTransparencyScore, computeFounderReliability, computeCis, computeIis, computePps, computeTss, computeWcrs, computeInvestmentScore, computeMatchScore, computeDecayFactor, computeDcs })

