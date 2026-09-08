import { readDb as readAuthorityDb, updateDb as updateAuthorityDb } from '../../config/database.js'
import {
  computeCis,
  computeComplianceScore,
  computeFounderReliability,
  computeGsis,
  computeInvestmentScore,
  computeMatchScore,
  computeMarketReadiness,
  computePps,
  computeTss,
  computeTransparencyScore,
  computeUnicornPotentialScore,
  computeWcrs,
} from './scoreKernels.js'
import { createEvidence, intelligenceEnvelope, statusForEvidence } from './responseEnvelope.js'
import { intelligenceFlags } from './featureFlags.js'

const values = input => (input && typeof input === 'object' ? input : {})

function numericFields(input, fields) {
  const source = values(input)
  return fields.filter(field => source[field] !== undefined && source[field] !== null && Number.isFinite(Number(source[field])))
}

export function calculateGsis(input = {}) {
  const source = values(input.components || input.component_scores || input)
  const components = {
    product_progress: source.product_progress ?? source.pps,
    execution_velocity: source.execution_velocity ?? source.evi,
    market_readiness: source.market_readiness ?? source.mrs,
    beta_satisfaction: source.beta_satisfaction ?? source.bss,
    revenue_growth: source.revenue_growth ?? source.rgs,
    founder_reputation: source.founder_reputation ?? source.frs,
    community_influence: source.community_influence ?? source.cis,
    investor_interest: source.investor_interest ?? source.iis,
    compliance: source.compliance ?? source.cs,
  }
  const fields = ['product_progress', 'execution_velocity', 'market_readiness', 'beta_satisfaction', 'revenue_growth', 'founder_reputation', 'community_influence', 'investor_interest', 'compliance']
  const present = numericFields(components, fields)
  const missing = fields.filter(field => !present.includes(field))
  const result = computeGsis(components)
  const evidence = createEvidence({ sources: present.map(field => `input:${field}`), missingFields: missing, confidence: present.length / fields.length })
  return intelligenceEnvelope({ result, score: result.gsis, status: statusForEvidence(evidence), evidence })
}

export function calculateInvestorSignals(input = {}) {
  const source = values(input)
  const fields = ['market_readiness', 'traction', 'team', 'risk_inverse', 'growth', 'differentiation']
  const missing = fields.filter(field => !numericFields(source, [field]).length)
  const result = {
    investmentScore: computeInvestmentScore(source),
    unicorn: computeUnicornPotentialScore(source.unicorn || source),
    marketReadiness: computeMarketReadiness(source),
    wcrs: computeWcrs(source),
  }
  const evidence = createEvidence({ sources: fields.filter(field => !missing.includes(field)).map(field => `input:${field}`), missingFields: missing, confidence: (fields.length - missing.length) / fields.length })
  return intelligenceEnvelope({ result, score: result.investmentScore, status: statusForEvidence(evidence), evidence })
}

export function calculateMatch(input = {}) {
  const source = values(input)
  const fields = ['skill', 'goal', 'execution_style', 'availability', 'trust', 'domain']
  const missing = fields.filter(field => !numericFields(source, [field]).length)
  const score = computeMatchScore(source)
  const evidence = createEvidence({ sources: fields.filter(field => !missing.includes(field)).map(field => `input:${field}`), missingFields: missing, confidence: (fields.length - missing.length) / fields.length })
  return intelligenceEnvelope({ result: { matchScore: score }, score, status: statusForEvidence(evidence), evidence })
}

export function calculateProfileQuality(input = {}) {
  const source = values(input)
  const result = {
    completeness: computeTransparencyScore(source.transparency || source),
    founderReliability: computeFounderReliability(source),
    communityInfluence: computeCis(source),
    teamStrength: computeTss(source),
  }
  const score = Math.round((result.completeness + result.founderReliability + result.communityInfluence + result.teamStrength) / 4)
  const evidence = createEvidence({ sources: Object.keys(source).map(field => `input:${field}`), confidence: Object.keys(source).length ? 1 : 0, missingFields: Object.keys(source).length ? [] : ['profile'] })
  return intelligenceEnvelope({ result, score, status: statusForEvidence(evidence), evidence })
}

export function calculateEvidence(input = {}) {
  const source = values(input)
  const checks = {
    compliance: computeComplianceScore(source.compliance || source),
    transparency: computeTransparencyScore(source.transparency || source),
    delivery: computePps(source.delivery || source),
  }
  const evidence = createEvidence({ sources: Object.keys(source).map(field => `input:${field}`), confidence: Object.keys(source).length ? 1 : 0, missingFields: Object.keys(source).length ? [] : ['evidence'] })
  const score = Math.round((checks.compliance + checks.transparency + checks.delivery) / 3)
  return intelligenceEnvelope({ result: checks, score, status: statusForEvidence(evidence), evidence })
}

export function getDeterministicIntelligenceSnapshot(userId) {
  const db = readAuthorityDb()
  const profile = Array.isArray(db.profiles) ? db.profiles.find(item => item.id === userId) : null
  const recommendationProfile = Array.isArray(db.recommendationProfiles) ? db.recommendationProfiles.find(item => item.userId === userId) : null
  const activity = Array.isArray(db.userActivityStates) ? db.userActivityStates.find(item => item.userId === userId) : null
  return intelligenceEnvelope({
    result: { profile: profile || null, recommendationProfile: recommendationProfile || null, activity: activity || null },
    status: profile ? 'sufficient' : 'insufficient_evidence',
    evidence: createEvidence({ sources: profile ? ['profiles'] : [], missingFields: profile ? [] : ['profile'], confidence: profile ? 1 : 0 }),
    metadata: { deterministic_enabled: intelligenceFlags.deterministicEnabled, embedding_refresh_mode: intelligenceFlags.embeddingRefreshMode },
  })
}

export function persistIntelligenceEvent(userId, event) {
  return updateAuthorityDb(db => {
    if (!Array.isArray(db.recommendationEvents)) db.recommendationEvents = []
    const record = { ...event, userId, createdAt: event.createdAt || new Date().toISOString() }
    db.recommendationEvents.push(record)
    if (db.recommendationEvents.length > 20_000) db.recommendationEvents.splice(0, db.recommendationEvents.length - 20_000)
    return record
  })
}
