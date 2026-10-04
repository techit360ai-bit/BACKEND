/**
 * Shared GitHub OAuth configuration.
 *
 * There are two independent entry points into GitHub OAuth and they share one
 * callback (GITHUB_REDIRECT_URI -> githubController.githubCallback) and one
 * state array (db.githubOauthStates). Historically they requested different
 * scopes, which silently broke repo-scoped enrichment for users who entered via
 * the trust surface (F2 in the MCP report).
 *
 * The fix is NOT to request the widest set everywhere — that would ask a user
 * who only wanted a *trust proof* for `repo` access to all their repositories.
 * Instead the requested scope is a function of the flow's **purpose**:
 *
 *   1. The connect flow  — repositories are the product → needs `repo`.
 *   2. The trust surface — only identity/email is needed  → no `repo`.
 *
 * Both still land on one callback; `purpose` on the OAuth state tells the
 * callback which contract to honour. GitHub returns the intersection of the
 * requested scope and the app's configured scope, so callers MUST record the
 * *granted* scope from the token response, never assume the request was met.
 */

/** Scopes for `purpose: 'connect'` — the platform wants repo access. */
export const GITHUB_OAUTH_SCOPES_CONNECT = 'repo read:user user:email'

/** Scopes for `purpose: 'trust'` — identity proof only, least privilege. */
export const GITHUB_OAUTH_SCOPES_TRUST = 'read:user user:email'

/**
 * @deprecated Use the purpose-specific constants. Kept as an alias for callers
 * that predate purpose-scoping; equals the connect (superset) set.
 */
export const GITHUB_OAUTH_SCOPES = GITHUB_OAUTH_SCOPES_CONNECT

/** The scopes to request for a given OAuth flow purpose. */
export function scopesForPurpose(purpose) {
  return purpose === 'trust' ? GITHUB_OAUTH_SCOPES_TRUST : GITHUB_OAUTH_SCOPES_CONNECT
}

/** Parse the `scope` field GitHub returns from the access_token exchange. */
export function parseGrantedScopes(scopeValue) {
  return typeof scopeValue === 'string'
    ? scopeValue.split(/[,\s]+/).map(part => part.trim()).filter(Boolean)
    : []
}

/** True when `granted` (a string or parsed array) includes every scope in `required`. */
export function hasScopes(granted, required) {
  const list = Array.isArray(granted) ? granted : parseGrantedScopes(granted)
  return required.every(scope => list.includes(scope))
}
