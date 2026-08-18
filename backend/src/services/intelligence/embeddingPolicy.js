import { intelligenceFlags } from './featureFlags.js'

export function embeddingRefreshDecision({ changed = false, eligible = true, cached = false, budgetRemaining = 0 } = {}) {
  const mode = intelligenceFlags.embeddingRefreshMode
  if (!eligible) return { refresh: false, reason: 'ineligible', mode }
  if (!changed) return { refresh: false, reason: 'unchanged', mode }
  if (cached) return { refresh: false, reason: 'cache_hit', mode }
  if (mode === 'provider' && Number(budgetRemaining) <= 0) return { refresh: false, reason: 'budget_exhausted', mode }
  return { refresh: true, reason: 'entity_changed', mode, backgroundOnly: true }
}
