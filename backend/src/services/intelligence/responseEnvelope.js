import { policyMetadata } from './scoreKernels.js'

export const INTELLIGENCE_SCHEMA_VERSION = 'intelligence-v1'

export function createEvidence({ sources = [], missingFields = [], freshness = {}, confidence = null } = {}) {
  return {
    sources: Array.isArray(sources) ? sources : [],
    missing_fields: Array.isArray(missingFields) ? missingFields : [],
    freshness: freshness && typeof freshness === 'object' ? freshness : {},
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
  }
}

export function statusForEvidence(evidence, { blocked = false, provisional = true } = {}) {
  if (blocked) return 'blocked'
  if (evidence.missing_fields.length) return 'insufficient_evidence'
  return provisional ? 'provisional_human_review_required' : 'sufficient'
}

export function intelligenceEnvelope({
  result = {},
  score = null,
  status,
  evidence,
  recommendations = [],
  narrative = null,
  aiAvailable = false,
  aiEnrichmentRequested = false,
  metadata = {},
} = {}) {
  const resolvedEvidence = evidence || createEvidence()
  return {
    schema_version: INTELLIGENCE_SCHEMA_VERSION,
    result,
    score: Number.isFinite(Number(score)) ? Number(score) : null,
    status: status || statusForEvidence(resolvedEvidence),
    evidence: resolvedEvidence,
    recommendations: Array.isArray(recommendations) ? recommendations : [],
    narrative: narrative || null,
    ai_available: Boolean(aiAvailable),
    ai_enrichment_requested: Boolean(aiEnrichmentRequested),
    ...policyMetadata(),
    generated_at: new Date().toISOString(),
    ...metadata,
  }
}
