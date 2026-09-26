# TechIT Platform — Frontend Data Exposure & Authorization Security Audit

**Date:** 2026-09-26
**Status:** audit complete; remediation not started
**Scope:** `BACKEND` (Node API + Plugins-MCP), `new-frontend`, `ai-router`
**Objective:** a user must never receive data from a server unless that server has independently
determined the user is authorized to receive it. DevTools does not need to be disabled; it must
simply never reveal data the user was not authorized to receive.

This document is the report **and** the implementation plan. No production code has been changed.
It extends, and does not replace, the existing security documents in this folder:
`DATA_CLASSIFICATION.md`, `ROLE_PERMISSION_MATRIX.md`, `API_SECURITY_MATRIX.md`,
`SECURITY_ARCHITECTURE_MAP.md`, `MCP_SECURITY_MODEL.md`, `AI_SECURITY_MODEL.md`,
`OWASP_CONTROL_MAPPING.md`, `PLATFORM_SECURITY_AUDIT_2026-08-13.md`.

---

## 1. Method and limits

Evidence was gathered by static review of routing, middleware, controllers, services, repositories,
the frontend API/auth layer, and the ai-router request path. Reviewed: all 25 mounted Node route
groups, `requireAuth`/`requireRole`/`requireCapability`/`requireAdminAuth`, session + CSRF handling,
MCP mount and `authorizeInvocation`, ai-router `get_user_context` and the investor/Trust read models,
frontend `AuthContext`/`authStorage`/`client.ts`, Vite build config, and the response serializers for
users, files, deals, and evidence.

Not performed in this pass (and called out so it is not mistaken for "clean"):

- No live staging or production request testing; GitHub and the deployed hosts were unreachable from
  the audit sandbox. Every finding below is code-evidence based and must be re-confirmed with the
  runtime tests in Phase 1.
- No dynamic fuzzing of IDs across the full 139-route `domain.js` surface; the plan requires
  automated horizontal/vertical tests per resource before sign-off.
- Redis/Celery runtime cache-key inspection (ai-router deployment not running locally).

---

## 2. Security map

```text
FRONTEND            API                  AUTH                 AUTHORIZATION            SERVICE                 DATA
new-frontend   →    BACKEND /api/*   →   requireAuth      →   requireRole          →   services/*          →   sqlite/json
(React SPA)         ai-router /api/v1    verifyJwt            requireCapability        repositories/*          postgres (cutover)
                    /api/mcp (MCP)       session binding      requireAdminAuth         mcp authorizeInvocation
                    messaging /api/v1    CSRF double-submit   resource ownership       ai-router services
```

| Layer | Implementation | Audit note |
|---|---|---|
| Frontend | React 19 + Vite SPA, `AuthProvider`, `RequireAuth`/`RequireRole`/`CapabilityGate` | Route guards are UX only; treated as non-authoritative |
| Node API | Express 5, 25 mounted route groups | `requireAuth` applied per-route or router-level |
| ai-router | FastAPI, 156 routes, shared JWT secret | Role comes from JWT claims |
| MCP | Mounted at `/api/mcp`, opt-in via `MCP_ENABLED` | Actor from verified JWT; tool authorization is default-allow (H-2) |
| Session | HttpOnly `techit_access` cookie + double-submit `techit_csrf` | Also mirrored into `sessionStorage` (C-1) |
| Data | SQLite/JSON with per-domain PostgreSQL cutover flags | Authority flags enforced at startup for multi-replica |

---

## 3. Controls that already work (preserve — do not rebuild)

- Session binding: JWT `sid` validated against persisted sessions; revoked sessions fail closed.
- CSRF: double-submit token required for cookie-only unsafe methods; bearer requests excluded.
- Admin: separate `requireAdminAuth` + `requireAdmin`/`requireSuperAdmin`, MFA assertion enforced in
  production.
- Capability authorization: role + assurance level + funding source (`capabilityAuthorization.js`)
  is a strong, centralized policy model — the right place to extend, not replace.
- Deal rooms: every mutation checks `dealRoomParticipants` membership and role, plus NDA gating for
  internal states. This is a model for the rest of the platform.
- Evidence/files: private uploads are namespaced by owner (`profile-avatars/<userId>/`), download
  URLs are pre-signed with a short expiry, and evidence reads are owner- or admin-scoped.
- ai-router investor Trust read model: explicit `ownerIdsExposed: false`, `investorNotesPrivate`,
  metadata-only projections. Good pattern to hold constant.
- AI execution: signed, one-time execution grants with replay protection; Router holds no billing
  authority.
- Service-to-service: HMAC-signed internal endpoints (`x-techit-signature`) with timestamp skew and
  `timingSafeEqual`.
- Ops: CORS allow-list, `X-Content-Type-Options`, `X-Frame-Options: DENY`, HSTS in production,
  safe error handler (no stack traces in production), Vite source maps not enabled.

---

## 4. Findings

### CRITICAL

#### C-1 — Bearer token returned in response bodies and persisted in `sessionStorage`

- **Location:** `BACKEND/backend/src/middlewares/auth.js` (`req.user.token`), `BACKEND/backend/src/controllers/authController.js` (`signin`, `session`), `new-frontend/frontend/src/lib/authStorage.ts`, `new-frontend/frontend/src/lib/api/client.ts`, `new-frontend/frontend/src/contexts/AuthContext.tsx`
- **Affected endpoint/component:** `POST /api/auth/signin`, `GET /api/auth/session`, frontend auth storage + API client
- **Attack scenario:** The access token is returned in the JSON body of `signin` and (via `user: req.user`) of `session`. The SPA copies it into `sessionStorage` under `techit_access_token` and replays it as `Authorization: Bearer`. Anyone with DevTools, the user's browser profile, a shared device, or a single XSS can read the token and impersonate the user across every service that trusts the shared `JWT_SECRET` — Node API, ai-router, MCP, and the Go messaging service. Because it is presented as a bearer header, the CSRF double-submit protection does not apply.
- **Affected roles:** all authenticated roles
- **Data exposed:** full account session — profile, Trust data, investor deal/data rooms, workspaces, wallet, messaging
- **Severity:** Critical
- **Root cause:** token is treated as a response payload and a client-persisted credential instead of an HttpOnly cookie, so secret material is delivered to the browser's readable surface.
- **Planned fix:** WS-1
- **Test proving the fix:** signin/session responses contain no `token`; `sessionStorage`/`localStorage` contain no JWT after login; cookie-only flow authenticates mutations with CSRF.

### HIGH

#### H-1 — Verified users' email addresses are exposed to every authenticated viewer

- **Location:** `BACKEND/backend/src/controllers/userController.js` → `publicProfile()`
- **Affected endpoint/component:** `GET /api/users/:id`
- **Attack scenario:** `email: viewerId === profile.id || profile.isVerified ? profile.email : null` returns the email of any verified user to any logged-in caller. Enumerate IDs (`/api/users/:id`) to harvest a verified-user contact list — high-value phishing and investor/founder targeting.
- **Affected roles:** any authenticated user
- **Data exposed:** verified users' email addresses (PII)
- **Severity:** High
- **Root cause:** email was folded into a "public profile" serializer behind a verification check instead of an authorization check.
- **Planned fix:** WS-2
- **Test proving the fix:** `GET /api/users/:id` for a verified user returns no `email` to a non-connected viewer; the user's own `GET /api/users/me` still returns it.

#### H-2 — MCP tool authorization is default-allow

- **Location:** `BACKEND/backend/src/app.js` (`authorizeInvocation`), `BACKEND/Plugins-MCP/server/mount.ts`
- **Affected endpoint/component:** `POST /api/mcp/invoke`
- **Attack scenario:** `authorizeInvocation` returns `{ allowed: true }` for every plugin/tool except a small GitHub set. The `toolsAllowed` claim resolved from the JWT is never enforced in the gate. Any authenticated user can invoke any catalogued tool with arbitrary params; only workspace scoping and the two GitHub cases constrain them.
- **Affected roles:** founder, collaborator, investor, organization — any authenticated caller
- **Data exposed:** depends on plugin surface (files, connectors, executions, audit)
- **Severity:** High
- **Root cause:** authorization was implemented as a targeted exception list rather than a default-deny capability check.
- **Planned fix:** WS-3
- **Test proving the fix:** invoking a tool outside the actor's allowed set returns 403; `toolsAllowed` claim narrowing is enforced; unknown plugin/tool is denied.

#### H-3 — ai-router investor endpoints outside the Trust read model have no role gate

- **Location:** `ai-router/main.py` (routes under tag `Investor`: `/api/v1/investor/deal-flow`, `/api/v1/investor/evi/{project_id}`, `/api/v1/investor/capital-pools`, `/api/v1/investor/deal-rooms`, `/api/v1/investor/data-rooms`, `/api/v1/investor/reputation`, `/api/v1/investor/heatmap`)
- **Affected endpoint/component:** ai-router Investor routes
- **Attack scenario:** `_require_investor_role` guards only the Trust routes added in Waves 45/46. The remaining Investor routes rely on data scoping alone, so a non-investor authenticated caller can reach investor-labelled read/write surfaces and receive investor-shaped payloads (or 500s that leak internals) instead of a clean 403.
- **Affected roles:** founder, collaborator, organization
- **Data exposed:** investor-facing projections; potential vertical escalation if a scoping bug exists in one handler
- **Severity:** High
- **Root cause:** role enforcement was added per-wave to new routes instead of uniformly at the Investor router boundary.
- **Planned fix:** WS-4
- **Test proving the fix:** non-investor role receives 403 on every `/api/v1/investor/*` route; investor receives normal payload.

#### H-4 — ai-router authorizes from JWT claim role only (stale-role window)

- **Location:** `ai-router/main.py` → `get_user_context`; `UserContext.role`
- **Affected endpoint/component:** every ai-router route that branches on `user.role`
- **Attack scenario:** the Node API re-reads persisted roles on every request (`middlewares/auth.js`), but ai-router trusts the `role` claim inside the token. A user whose role is downgraded, suspended, or had a role assignment revoked keeps full ai-router access until the token expires.
- **Affected roles:** any role change or revocation
- **Data exposed:** whatever the old role could read (investor/organization surfaces)
- **Severity:** High
- **Root cause:** role authority is duplicated; ai-router has no freshness signal for role changes.
- **Planned fix:** WS-5
- **Test proving the fix:** after a role downgrade, the pre-downgrade token is rejected (or reduced) by ai-router within the agreed window.

### MEDIUM

#### M-1 — `GET /users/me` returns the entire profile row without an allow-list

- **Location:** `BACKEND/backend/src/controllers/userController.js` → `getMe` (`const response = { ...profile }`)
- **Attack scenario:** any field later added to the profile shape (internal scores, flags, integration ids) is auto-exposed to the client. No deliberate decision is made per field.
- **Affected roles:** self (contained today, unbounded tomorrow)
- **Severity:** Medium
- **Root cause:** spread-serializer instead of an explicit projection.
- **Planned fix:** WS-2
- **Test proving the fix:** snapshot test asserts `/users/me` returns exactly the approved field set.

#### M-2 — Full user object persisted in `localStorage` under `techit_user`

- **Location:** `new-frontend/frontend/src/contexts/AuthContext.tsx` (`saveUser`), `MessagingProvider.tsx`, `DemoRoom.tsx`
- **Attack scenario:** profile/user JSON persists across tabs and sessions on shared devices, readable in DevTools → Application → Local Storage long after logout (logout clears it, but crash/close paths may not).
- **Severity:** Medium
- **Root cause:** convenience persistence of server state beyond what the session requires.
- **Planned fix:** WS-6
- **Test proving the fix:** after sign-out and on fresh load, `techit_user` is absent; only non-sensitive UI keys remain.

#### M-3 — User directory profiling via `/users/:id` and `/users`

- **Location:** `userController.js` (`publicProfile`, `directoryProfile`)
- **Attack scenario:** `sharedContext`, `subscriber`, `subscriptionLabel`, `credibilityScore`, and trust breakdown are enumerable for arbitrary IDs; combined with H-1 this builds a target list.
- **Severity:** Medium
- **Root cause:** directory fields were scoped for UX discovery, not for authorization review.
- **Planned fix:** WS-2
- **Test proving the fix:** fields absent unless a documented relationship/entitlement applies.

#### M-4 — No `Content-Security-Policy` on API responses or the static frontend

- **Location:** `BACKEND/backend/src/app.js` (header block), `new-frontend/render.yaml`
- **Attack scenario:** CSP is the primary containment for XSS, which is exactly the vector that turns C-1 into full account takeover. Its absence materially raises C-1/M-2 impact.
- **Severity:** Medium
- **Root cause:** hardening stopped at X-Frame-Options/HSTS/CORP.
- **Planned fix:** WS-7
- **Test proving the fix:** CSP header present and compatible with Vite assets, ai-router, MCP, and WebSocket origins in a staging smoke.

#### M-5 — Rate-limit coverage must be proven per sensitive endpoint

- **Location:** `BACKEND/backend/src/middlewares/globalRateLimit.js`, route files; ai-router route dependencies
- **Attack scenario:** a global limiter exists, but login, OTP, password reset, AI execution, file download, MCP invoke, and investor data access need per-route budgets that are demonstrably enforced. Unverified limiters are indistinguishable from missing ones.
- **Severity:** Medium
- **Root cause:** no consolidated per-endpoint rate-limit matrix.
- **Planned fix:** WS-8
- **Test proving the fix:** 429 after N requests per sensitive route, per service.

#### M-6 — Production mock/fallback data can mask real backend state

- **Location:** `new-frontend/frontend/src/lib/api/config.ts` (`apiFallbackEnabled`), `.env.example`
- **Attack scenario:** with `VITE_API_FALLBACK` set and `VITE_API_STRICT` unset, dashboards render bundled mock records. This is not a data leak, but it lets a "verified" DevTools walkthrough show fabricated data and hide real authorization failures, undermining the audit's own acceptance test.
- **Severity:** Medium (audit integrity)
- **Planned fix:** WS-6 (enforce `VITE_API_STRICT=1` in production builds via the existing `env:check`).

### LOW / INFORMATIONAL

- **L-1** `Cross-Origin-Resource-Policy: same-site` on the API vs `cross-origin` in `render.yaml` — confirm intended pairing.
- **L-2** ai-router `ALLOW_DEMO_AUTH` demo context must be provably impossible in staging/production (existing C3 guard) — add an explicit startup assertion to the existing env validation.
- **L-3** Confirm logging never records bodies/tokens: review `http_request` logs, ai-router telemetry, Celery logs, and security-event metadata for auth headers, OTPs, and payout fields.
- **L-4** Re-verify at release that source maps remain disabled and that `.env` stays untracked (`new-frontend/frontend/.env` is correctly git-ignored).
- **L-5** `lib/api/client.ts` keeps an in-memory `accessToken` copy alongside storage; after WS-1 it becomes the only copy — confirm no other module reads `sessionStorage` directly.
- **L-6** Confirm `getMe` avatar presign expiry (900s) is acceptable for a URL shared into chat/feed surfaces.

---

## 5. Data classification mapping

Extends `DATA_CLASSIFICATION.md`. No new classes are introduced.

| Class | Where this audit found risk | Required rule |
|---|---|---|
| PUBLIC | `publicProfile` base fields, Moments, feed | Must be intentional and reviewed per field |
| AUTHENTICATED | directory records, posts, workspaces list | No PII beyond the approved directory projection |
| ROLE_RESTRICTED | `/api/v1/investor/*`, admin, org intelligence | Role gate at the router boundary, not per-handler |
| WORKSPACE_RESTRICTED | workspaces, MCP tools, files | Membership check + default-deny tool capability |
| ORGANIZATION_RESTRICTED | org programs/cohorts | Tenant filter in the query, not the serializer |
| INVESTOR_RESTRICTED | deal rooms, internal notes, IC reviews | Participant + NDA gate (already correct — keep) |
| ADMIN_ONLY | admin routes, audit metadata | `requireAdminAuth` + MFA (already correct — keep) |
| SYSTEM_SECRET | JWT, HMAC keys, provider keys, execution grants | Must never appear in a browser-readable surface (C-1) |

---

## 6. Role matrix

Extends `ROLE_PERMISSION_MATRIX.md` with the VIEW/CREATE/EDIT/DELETE/EXPORT/SHARE/EXECUTE/ADMINISTER
grid per resource. The matrix is already the agreed authority for role intent; the gap this audit
found is **enforcement placement**, not policy definition:

- Node API enforces per-route or router-level — correct pattern, needs coverage proof (M-5, WS-8).
- ai-router must gain a single router-boundary dependency (H-3) rather than per-route checks.
- MCP must gain a default-deny tool capability gate (H-2).
- Frontend role checks remain UX-only and must never be the only gate.

---

## 7. Implementation plan

Constraint honored: **targeted corrections inside existing files and modules only.** No new services,
no new routing layers, no architecture changes. Each workstream is independently shippable and
verifiable, and must not regress existing functionality (Rule 26 of the brief).

### Phase 0 — Runtime confirmation (blocks everything else)
- Stand up staging with real Node API, ai-router, MCP, messaging.
- Re-run every finding below against live traffic to convert "code-evidence" into "confirmed".
- Capture before/after response schemas for section 8.

### Phase 1 — Critical + High remediation

| WS | Fix | Repo | Files (existing) | Done when |
|---|---|---|---|---|
| WS-1 | Stop returning the JWT in bodies; make the HttpOnly cookie the browser transport; keep only in-memory token for non-browser clients | BACKEND, new-frontend | `controllers/authController.js`, `middlewares/auth.js`, `lib/authStorage.ts`, `lib/api/client.ts`, `contexts/AuthContext.tsx` | no `token` in signin/session JSON for cookie clients; no JWT in web storage; mobile path preserved |
| WS-2 | Replace spread/public serializers with explicit projections; remove email from public profile | BACKEND | `controllers/userController.js` | allow-list tests pass; email only for self |
| WS-3 | Default-deny MCP tool gate; enforce `toolsAllowed` | BACKEND, Plugins-MCP | `backend/src/app.js`, `Plugins-MCP/server/mount.ts` | unauthorized tool → 403 |
| WS-4 | Add investor role gate at the Investor router boundary in ai-router | ai-router | `main.py` | non-investor → 403 on every investor route |
| WS-5 | Add role-freshness check (revocation/assignment version) to ai-router auth | ai-router, BACKEND | `main.py` `get_user_context`, session/role payload | downgraded token loses access within agreed window |

### Phase 2 — Medium remediation
- WS-6: explicit `/users/me` projection; drop `techit_user` persistence to the minimum UI state;
  enforce `VITE_API_STRICT=1` for production builds via `scripts/validate-env.mjs`.
- WS-7: add a CSP generated for the real origins (Vite assets, `backend.techitnetwork.com`,
  `api.techitnetwork.com`, `messaging.techitnetwork.com`, WSS, analytics), on API + static host.
- WS-8: consolidate per-endpoint rate limits for login/OTP/reset/AI/files/MCP/investor reads and add
  the enforcement tests.

### Phase 3 — Verification and release gate
- Add the security test suite (section 9) to each repo's existing test runner.
- Execute the DevTools acceptance walkthrough (section 10) per role on staging.
- Update `SECURITY_POSTURE_SCORE.md`, `API_SECURITY_MATRIX.md`, and
  `RELEASE_CANDIDATE_SIGNOFF.md` with real run IDs before approval.

---

## 8. Before/after API examples

```text
POST /api/auth/signin
BEFORE: { "token": "<raw JWT>", "user": {...}, "profile": {...} }
AFTER : { "user": {...}, "profile": {...} }        + Set-Cookie: techit_access (HttpOnly, Secure, SameSite)

GET /api/auth/session
BEFORE: { "user": { ..., "token": "<raw JWT>" }, ... }
AFTER : { "user": { ... }, ... }                   (no token field)

GET /api/users/{id}                    (viewer is not the owner, target is verified)
BEFORE: { "email": "founder@example.com", "subscriber": true, "sharedContext": false, ... }
AFTER : { ...public projection... }                (no email; directory fields per matrix)

POST /api/mcp/invoke   { "plugin":"files","tool":"write" }   (actor lacks the capability)
BEFORE: 200 with tool result
AFTER : 403 { "error": { "code": "permission_denied" } }
```

---

## 9. Security test suite (added to existing runners)

- **IDOR/BOLA:** User A vs User B for projects, workspaces, users, organizations, messages,
  documents, files, tasks, deals, data rooms, Trust profiles.
- **Vertical:** explorer → founder route, founder → admin route, collaborator → investor route.
- **Cross-tenant:** Org A → Org B, Workspace A → Workspace B.
- **Entitlement:** free user calling premium backend capability directly.
- **Field visibility:** unauthorized fields absent from JSON (not merely hidden in UI).
- **Files:** knowing `file_id`/`objectKey` does not yield a download.
- **API manipulation:** `role`/`plan`/`credits`/`is_admin`/`payment_status` in body are ignored.
- **Token handling:** bearer token never appears in any response body or web storage.

## 10. DevTools acceptance test (manual, per role)

Perform normal platform actions as Explorer, Founder, Collaborator, Investor, Organization, Admin with
DevTools → Network open. Verify every API response, request body, response header, WebSocket frame,
`localStorage`, `sessionStorage`, IndexedDB, cookie, and loaded source contains only data the role is
authorized to receive. A founder seeing their own startup is expected; a founder seeing another
founder's private data, admin-only fields, investor-private data, secrets, provider credentials, or
system prompts is a failure.

## 11. Residual risks requiring architectural change (flagged, not hidden)

1. **Shared symmetric JWT across four services.** One leaked token is valid everywhere. Moving to
   asymmetric per-service audiences (issuer/audience already supported in code) is an architectural
   decision, not a targeted patch — recommend a separate approved initiative.
2. **Role freshness in ai-router** (H-4) is patched with a version/freshness signal; a full fix is a
   shared authorization service. Recommend evaluating after WS-5.
3. **SQLite/JSON dual-authority window.** Authorization tests must run against the PostgreSQL
   authority before cutover, otherwise results reflect the legacy path only.
4. **No live dynamic ID fuzzing** was possible in this sandbox; Phase 0 must include it.

## 12. Release gate

Do not approve production release until: C-1 and H-1..H-4 are fixed and proven by tests; the security
suite runs green in CI for all three repos; the DevTools walkthrough passes for every role; and
`RELEASE_CANDIDATE_SIGNOFF.md` carries real run IDs, operators, and approver names.
