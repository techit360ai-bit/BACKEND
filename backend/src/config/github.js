/**
 * Shared GitHub OAuth configuration.
 *
 * There are two independent entry points into GitHub OAuth and they must agree
 * on the scopes they request:
 *
 *   1. The connect flow  — controllers/githubController.js:githubAuthorize
 *   2. The trust surface — services/trustVerificationAuthority.js
 *                          (beginProviderVerification)
 *
 * They share one callback (GITHUB_REDIRECT_URI -> githubController.githubCallback)
 * and one state array (db.githubOauthStates), so a user can legitimately start
 * from either surface. When the two requested different scopes, entering via the
 * trust surface produced a token with no `repo` scope, the callback's
 * GET /user/repos failed, and the language-skill enrichment silently recorded
 * zero skills. Keeping one constant here makes that drift impossible.
 *
 * GitHub grants the intersection of what is requested and what the OAuth app has
 * configured, so a single app-wide set is the correct model. A partial grant is
 * still possible if the app itself is under-configured — which is why callers
 * should record the *granted* scope from the token response rather than assuming
 * the requested set was honoured.
 */
export const GITHUB_OAUTH_SCOPES = 'repo read:user user:email'

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
