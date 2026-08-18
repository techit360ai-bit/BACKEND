const bool = (value, fallback) => value == null ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())

export const intelligenceFlags = Object.freeze({
  deterministicEnabled: bool(process.env.DETERMINISTIC_INTELLIGENCE_ENABLED, true),
  narrativeEnrichmentEnabled: bool(process.env.AI_NARRATIVE_ENRICHMENT_ENABLED, false),
  routerRequiredForTasks: bool(process.env.AI_ROUTER_REQUIRED_FOR_TASKS, false),
  embeddingRefreshMode: ['deterministic', 'provider', 'local'].includes(process.env.EMBEDDING_REFRESH_MODE) ? process.env.EMBEDDING_REFRESH_MODE : 'deterministic',
})
