// Canonical investor-consent scope catalog (Phase C, revised).
//
// Consent is fail-closed. The baseline `approved_evidence_metadata` scope is what
// a founder shares on approval; every other scope must still be explicitly
// requested and granted. Only REVENUE metrics are SENSITIVE: financial data is
// exposed to an investor only when the founder explicitly grants
// `revenue_metrics`. Execution progress/velocity and anonymous cohort comparison
// are non-sensitive execution data and travel with the baseline approval. Adding
// a scope here is the single place that widens what an investor may read —
// nothing sensitive is implied.

export const CONSENT_SCOPES = {
  approved_evidence_metadata: { label: 'Approved evidence metadata', sensitive: false },
  execution_metrics: { label: 'Execution progress and velocity', sensitive: false },
  cohort_benchmarks: { label: 'Anonymous cohort comparison', sensitive: false },
  revenue_metrics: { label: 'Revenue metrics', sensitive: true },
}

export const DEFAULT_CONSENT_SCOPES = ['approved_evidence_metadata']

export function isConsentScope(scope) {
  return Object.prototype.hasOwnProperty.call(CONSENT_SCOPES, scope)
}

export function isSensitiveScope(scope) {
  return isConsentScope(scope) && CONSENT_SCOPES[scope].sensitive === true
}

/** Validate, de-duplicate and cap a raw scope list to known catalog entries. */
export function normalizeConsentScopes(values, { max = 12 } = {}) {
  const raw = Array.isArray(values) ? values : []
  const seen = new Set()
  const out = []
  for (const value of raw) {
    const scope = typeof value === 'string' ? value.trim() : ''
    if (!scope || seen.has(scope) || !isConsentScope(scope)) continue
    seen.add(scope)
    out.push(scope)
    if (out.length >= max) break
  }
  return out
}

/**
 * What a founder grants when they approve WITHOUT naming scopes: the
 * non-sensitive scopes that were requested, never the sensitive ones.
 */
export function defaultGrantedScopes(requested = []) {
  const baseline = normalizeConsentScopes(requested).filter(scope => !isSensitiveScope(scope))
  return baseline.length ? baseline : [...DEFAULT_CONSENT_SCOPES]
}

/** A founder can only grant scopes that were actually requested (fail-closed). */
export function grantedScopesWithinRequest(requested, granted) {
  const request = new Set(normalizeConsentScopes(requested))
  return normalizeConsentScopes(granted).filter(scope => request.has(scope))
}

export function consentScopeCatalog() {
  return Object.entries(CONSENT_SCOPES).map(([scope, meta]) => ({ scope, ...meta }))
}
