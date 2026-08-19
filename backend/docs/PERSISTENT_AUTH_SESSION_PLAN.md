# Persistent Authentication and Returning User Plan

## Audit Findings

- Backend currently issues a seven-day bearer JWT and validates persisted roles in `middlewares/auth.js`.
- Frontend currently persists the bearer JWT in `localStorage` and bootstraps through `/api/auth/session`.
- Logout currently clears client state but does not revoke server-side credentials.
- No device/session collection or refresh-token rotation exists.
- Existing role and onboarding routing is in `contexts/AuthContext`, `RouteGuards`, and `lib/roleRoutes`.
- Existing `userSessionLogs`, checkpoints, and notifications already provide return-context data.

## Sequential Implementation

1. Add server-tracked device sessions, hashed rotating refresh tokens, HttpOnly cookies, revocation, global logout, cleanup, and security events.
2. Preserve legacy bearer JWT validation for non-browser service clients and existing tests; browser requests may authenticate through the short-lived access cookie.
3. Add centralized frontend bootstrap with `UNKNOWN -> RESTORING_SESSION -> AUTHENTICATED/ANONYMOUS`, refresh locking, one-retry API behavior, cross-tab logout propagation, and safe destination resolution.
4. Expose active-session management and reauthentication-ready endpoints without exposing secrets.
5. Restore role/onboarding/verification/workspace context through existing profile and context services, falling back safely when a saved route is invalid.
6. Add lifecycle, revocation, refresh, routing, and regression tests, then run full Backend/frontend security gates.

## Security Decisions

- Refresh tokens are random, hashed at rest, rotated on every refresh, and never returned to JavaScript.
- Access credentials are short-lived. The browser uses HttpOnly cookies; a compatibility access response remains available to existing native/service clients.
- Logout revokes the current server session. Password changes and global logout revoke all sessions.
- Refresh retries are single-flight and one attempt per failed request.
- JWTs without a session identifier remain accepted only for backward-compatible non-browser clients; newly issued browser credentials always carry a session identifier.
