# TechIT Platform — Security Implementation Plan (complete coverage)

**Date:** 2026-09-26
**Status:** WS-01 … WS-07 implemented on `security/exposure-hardening-2026-09-26`; see section 11
**Report:** `PLATFORM_SECURITY_AUDIT_2026-09-26.md`
**Scoped plans:** `new-frontend/docs/SECURITY_REMEDIATION_PLAN_2026-09-26.md`,
`ai-router/docs/SECURITY_REMEDIATION_PLAN_2026-09-26.md`

This plan covers the whole audit brief, including the areas the first pass left as
"not yet performed". It is organised so each workstream is independently shippable, verifiable,
and reversible. Constraint honoured throughout: **targeted changes inside existing modules — no new
services, no new routing layers, no restructure.** Where a real fix requires architecture, it is
listed in section 9 instead of being smuggled into a patch.

---

## 1. Live verification (GitHub, 2026-09-26)

The first audit pass was static because the sandbox had no network. Live access changed the picture
and added findings a code review cannot see. Everything below is confirmed against the live API.

### 1.1 Confirmed the critical code finding on the real default branch

Fetched `origin/main` for `BACKEND` and `new-frontend` and re-read the exact files:

- `new-frontend@origin/main:frontend/src/lib/authStorage.ts` writes the access token to
  `sessionStorage` under `techit_access_token`.
- `new-frontend@origin/main:frontend/src/contexts/AuthContext.tsx` reads it back in
  `accessTokenForApi()` and persists it via `saveToken`.
- `BACKEND@origin/main:backend/src/controllers/authController.js` returns
  `token: credentials.accessToken` in `signin` and returns `user: req.user` in `session`;
  `middlewares/auth.js` attaches the raw `token` to `req.user`.

**So C-1 is real on production branches, not an artefact of a stale local checkout.**

### 1.2 New findings — repository governance and supply chain

These are high impact because the authorization code lives in these repositories.

| ID | Finding | Evidence | Impact |
|---|---|---|---|
| G-1 | **No branch protection on the repos that hold auth/authz/billing code.** `BACKEND`, `new-frontend`, `techit-admin-dashboard`, `TECHIT-PAYMENT-GATWAY` are private on a plan that does not offer branch protection | `GET /branches/main/protection` → 403 "Upgrade to GitHub Pro"; only `ai-router` is protected (required checks `analyze`, `python-audit`, `filesystem-scan`; `enforce_admins: true`; 1 review) | Direct pushes to `main` are possible; no required review or status check; an unauthorized change can ship without CI |
| G-2 | **Dependabot alerts disabled on 5 of 6 repos** | API returns "Dependabot alerts are disabled" for `BACKEND`, `new-frontend`, `techit-admin-dashboard`, `TECHIT-PAYMENT-GATWAY`, `techit-website`; only `ai-router` enabled (0 open) | Known-vulnerable dependencies can enter and stay undetected |
| G-3 | **Secret scanning + push protection disabled on all four private repos** | enabled only on the public `ai-router` and `techit-website` | Committed credentials are not detected or blocked where secrets actually live |
| G-4 | **CodeQL is not actually enabled on `BACKEND` and `new-frontend`** | the workflow runs and reports success, but `GET /code-scanning/alerts` → 403 "Code scanning is not enabled". `ai-router` is enabled with 0 open alerts | The CodeQL step is decorative on the two largest repos; findings are never surfaced |
| G-5 | **The dependency-assurance gate is broken, not just red** | `BACKEND` `Dependency Assurance` (main, run 35582206872) → `node-audit: failure` with `npm ci` EUSAGE "can only install with an existing package-lock.json"; `new-frontend` (run 35582500748) → `npm-audit: failure`, identical. `go-audit` and `filesystem-scan` succeeded | The npm vulnerability audit and SBOM step never produce a result — the supply-chain gate is inactive on both Node repos |
| G-6 | **Dependency review never runs on private repos** | both workflows gate the `dependency-review` job on `github.event.repository.private == false`; `dependency-review: skipped` in every run | The gate that would block a high-severity dependency now silently skips where the sensitive code is |
| G-7 | Lockfiles **are** tracked at `origin/main` | `git ls-tree origin/main -- package-lock.json` → present in both repos (lockfileVersion 3) | G-5's root cause is environmental (run-time ref/path), not a missing file — must be diagnosed and the gate proven green |

### 1.3 Live PR / CI state (for sequencing the work)

- `BACKEND`: PR #117 open (dependabot livekit) — failing `Dependency Assurance`, `TECHIT Backend Services`, `security-policy`.
- `new-frontend`: PR #151 open (dependabot, 42 frontend updates).
- `ai-router`: 6 open PRs (#75, #77, #78, #80, #81, #83), including `feat/agentrouter-provider` (local HEAD) and a copilot fix branch.
- `techit-admin-dashboard`: PRs #29–#33 open (all dependabot, including a Vite 6 → 8 major and TypeScript 5.6 → 7.0 major, which the repo's own dependabot policy is supposed to block).
- `TECHIT-PAYMENT-GATWAY`, `techit-website`: no open PRs.

**Sequencing consequence:** G-1/G-5/G-6 must be fixed before the code workstreams, otherwise the
security fixes themselves have no enforced review, no dependency gate, and no required checks.

### 1.4 Correction to the report

`PLATFORM_SECURITY_AUDIT_2026-09-26.md` section 1 said live testing was not performed. That is now
partially superseded: GitHub governance, CI status, and default-branch code state **have** been
live-verified. Runtime API testing (staging requests, ID fuzzing) is still outstanding and remains
Phase 0 below.

---

## 2. Coverage matrix (what the audit covers)

| Brief area | Status | Covered by |
|---|---|---|
| Frontend framework/routing, backend, auth, session, authz middleware, roles, entitlements | Audited | Report §2–3 |
| API routes (Node 25 groups, ai-router 156 routes) | Audited statically | WS-02, WS-04, WS-08, WS-18 |
| WebSocket / SSE and messaging service | **Gap — not audited** | WS-16 |
| Database models, serializers, service layer | Partially audited | WS-02, WS-13, WS-17 |
| AI Router, Incubation Hub, Workspace, MCP | Audited | WS-03, WS-04, WS-05, WS-15 |
| Deal Room, Data Room, Trust Center, Trust Engine, GSIS, scoring | Audited (deal room = strength) | WS-09, WS-18 |
| Billing/payment, organization accounts, collaborator accounts | Partially audited | WS-08, WS-17 |
| Admin dashboard | **Gap — not audited** | WS-19 |
| Notifications | Partial | WS-13 |
| File uploads/downloads, signed URLs | Audited | WS-09 |
| Background jobs, Redis/Celery, external integrations | **Gap — not audited** | WS-10, WS-11 |
| DevTools surface (storage, IndexedDB, SW/PWA, bundle, source maps) | Partial | WS-01, WS-12 |
| IDOR/BOLA, vertical/horizontal, cross-tenant | Test design only | WS-18 |
| Entitlement/premium bypass | Partial | WS-08 |
| Caching security | **Gap** | WS-10 |
| Logging security | **Gap** | WS-11 |
| Error response security | Partial (ai-router `detail: str(exc)` leaks) | WS-12 |
| Security headers / CSP | Partial (no CSP anywhere) | WS-13 |
| Rate limiting | Partial (no ai-router limiter at all) | WS-14 |
| Repository governance / supply chain | **Newly found live** | WS-06, WS-07 |

---

## 3. Guiding rules for every workstream

1. Backend is authoritative. Never trust `role`, `plan`, `credits`, `payment_status`, `is_admin`,
   `is_verified`, `subscription`, or `price` supplied by the browser.
2. UI visibility ≠ API authorization ≠ resource authorization ≠ field authorization ≠ entitlement.
3. If the user should not know it, it is not sent.
4. Every change preserves existing behaviour for legitimately authorized users.
5. Every workstream lands with a test that fails before and passes after.

---

## 4. Tier 0 — Critical

### WS-01 — Token transport and storage hardening
**Finding:** C-1. **Repos:** BACKEND, new-frontend.

| | |
|---|---|
| Objective | Browser clients receive the session as an HttpOnly cookie only; no JWT in any response body or web storage |
| BACKEND files | `controllers/authController.js` (signin, signup, refresh, session), `middlewares/auth.js` (`req.user.token` retention for server-side forwarding only) |
| new-frontend files | `lib/authStorage.ts`, `lib/api/client.ts`, `contexts/AuthContext.tsx` |
| Change | Stop returning `token` in JSON for browser clients; keep explicit-token path only for the existing mobile/non-browser client; `session()` must not serialize `req.user.token`; frontend keeps the token in memory for the tab and relies on the cookie + existing CSRF double-submit |
| Must not break | Onboarding mutations (the original reason the token was mirrored), mobile login, ai-router forwarding (server-side only, from the request, not the client) |
| Tests | signin/session body has no `token`; web storage empty of JWTs after login and after refresh; cookie-only mutation succeeds with CSRF; mobile client still works |
| Acceptance | DevTools → Application shows no JWT; DevTools → Network shows no `token` in any response |
| Rollback | Single revert per repo; cookie path already exists so no migration needed |

---

## 5. Tier 1 — High

### WS-02 — Explicit response projections for user surfaces
**Findings:** H-1, M-1, M-3. **Repo:** BACKEND.

- `controllers/userController.js`: replace `{ ...profile }` in `getMe` with an explicit allow-list.
- Remove `email` from `publicProfile` unless `viewerId === profile.id` **or** a documented
  relationship (workspace/org membership, accepted connection) exists — decide and record the rule
  in `ROLE_PERMISSION_MATRIX.md`.
- Gate `sharedContext`, `subscriber`, `subscriptionLabel`, and trust breakdown behind the same rule.
- Keep `directoryProfile` free of email (it already is) and add a projection test.
- Tests: field-absence assertions per viewer class; regression test for the user's own profile.

### WS-03 — MCP default-deny tool authorization
**Findings:** H-2. **Repos:** BACKEND, Plugins-MCP.

- `Plugins-MCP/server/mount.ts`: make the gate deny by default; require an explicit allow decision.
- `backend/src/app.js` `authorizeInvocation`: derive permitted tools from the verified actor
  (`toolsAllowed` claim intersected with role/workspace capability), not from an exception list.
- Keep the existing GitHub destination checks; add the general rule around them.
- Tests: unknown plugin → 403; tool outside `toolsAllowed` → 403; permitted tool → 200; existing
  github path unchanged.

### WS-04 — ai-router investor role gate at the boundary
**Finding:** H-3. **Repo:** ai-router.

- Apply the existing `_require_investor_role` dependency uniformly to every route tagged `Investor`.
- Tests: non-investor → 403 on all investor routes; investor → unchanged payloads.
- Must not change the Trust read-model privacy behaviour.

### WS-05 — ai-router role freshness
**Finding:** H-4. **Repos:** ai-router (+ BACKEND signal).

- Add a role/permission freshness signal the Router can check per request (e.g. a role-version claim
  plus a lightweight backend check), so a token minted before a downgrade cannot retain the old role.
- Keep issuer/audience and asymmetric verification unchanged.
- Tests: downgrade then reuse old token → denied/reduced within the agreed window.
- Note: the full fix (shared authorization service) is a section 9 architectural item.

### WS-06 — Repository governance: protection, alerting, secret scanning
**Findings:** G-1..G-4. **Owner:** repository administration (no application code).

- Enable branch protection on `BACKEND`, `new-frontend`, `techit-admin-dashboard`,
  `TECHIT-PAYMENT-GATWAY`: require PR + review, require the security jobs, disable force-push,
  apply `enforce_admins`.
- Enable Dependabot alerts + security updates on all repos.
- Enable secret scanning + push protection on all repos; rotate anything already leaked.
- Fix CodeQL: enable code scanning so the existing workflow actually uploads results; treat a
  "successful" run with no uploaded analysis as failure.
- Acceptance: `GET /branches/{default}/protection` succeeds and lists the security checks for every
  repo; secret scanning enabled; code-scanning alerts endpoint reachable.

### WS-07 — Repair and prove the dependency-assurance gate
**Findings:** G-5, G-6. **Repos:** BACKEND, new-frontend (+ admin, payment).

- Diagnose the `npm ci` EUSAGE on the default branch despite a tracked lockfile (run-time ref vs
  working directory) and make the job green.
- Remove or replace the `github.event.repository.private == false` condition so dependency review
  runs on private repos too (or substitute an equivalent that works on the current plan).
- Make the audit job fail closed: if the audit cannot run, the gate must be red, not skipped.
- Tests/evidence: green run URL on `main` for both repos showing npm audit + SBOM produced.
- This must precede WS-01..WS-05 merge, so the fixes are themselves gated.

---

## 6. Tier 2 — Medium

### WS-08 — Entitlement / premium-bypass enforcement
- Enumerate every capability that gates premium data; confirm the backend derives role, plan,
  credits, and entitlement from server state (the existing `capabilityAuthorization.js` policy is the
  right seam).
- Add tests that replay requests with forged `role`, `plan`, `credits`, `payment_status`, `is_admin`,
  `is_verified` and assert no effect.
- Cover AI Router model selection: `requested_model` must only ever narrow, never widen, entitlement.

### WS-09 — Files, documents, signed URLs, Data Room
- Confirm every download path authorizes before presigning; scan for any object-key/`file_id`
  enumeration path (ai-router `file_storage._file_key` is `uploads/<hash><ext>` under a shared
  bucket — verify uploads are not readable across users, and that `documents/{id}/share` links are
  scoped, expiring, and revocable).
- Verify signed URL TTLs, that they expose no unnecessary storage detail, and that they are never
  issued for someone else's object.
- Tests: knowing an id/key does not yield a download; expired link rejected.

### WS-10 — Caching security
- Audit Redis keys in ai-router, the frontend ETag cache in `lib/api/client.ts`, CDN/static caching in
  `render.yaml`, and any service-worker/PWA cache.
- Ensure cache keys include the authorization dimension (or that private responses are not cached at
  all) so one user's response can never be served to another.
- Tests: two users with different entitlements requesting the same resource key get their own
  responses.

### WS-11 — Logging security
- Review Node `http_request` logs, ai-router structlog/telemetry, Celery logs, security-event
  metadata, and admin audit logs for tokens, cookies, OTPs, passwords, payment data, and private
  prompts. Add redaction where needed.
- Test: a request carrying a bearer token/OTP produces no secret in captured logs.

### WS-12 — Error response and frontend-source audit
- ai-router `value_error_handler` returns `detail: str(exc)` — replace with a safe generic message
  and keep detail server-side. Confirm Node's handler stays stack-free in production.
- Run the bundle search (`API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `OPENAI_`, `ANTHROPIC_`,
  `STRIPE_SECRET`, `JWT_SECRET`, `SYSTEM_PROMPT`, `INTERNAL`) against built assets.
- Verify source maps stay disabled in production and that `.env` remains untracked.
- Test: 400/401/403/404/409/422/429/500 bodies contain no stack, query, table name, or path.

### WS-13 — Security headers and CSP
- Generate a CSP compatible with the real origins and surfaces (Vite assets, `backend.`, `api.`,
  `messaging.` including WSS, analytics) and apply on the API and the static host.
- Reconcile `Cross-Origin-Resource-Policy` (`same-site` on API vs `cross-origin` in `render.yaml`).
- Acceptance: staging smoke loads the full app with zero CSP violations in console.

### WS-14 — Rate-limit matrix
- Produce a per-endpoint table (limit, window, enforcement point, test) for login, OTP, password
  reset, verification, AI requests, validation, messaging, file downloads, workspace execution, MCP
  tools, investor data reads, and admin endpoints.
- ai-router currently has no request rate limiter — add one at the app level.
- Test: 429 after N per endpoint, per service.

### WS-15 — Internal AI agent information
- Verify no endpoint returns system prompts, hidden agent instructions, raw chain-of-thought, routing
  policy, or provider credentials; agent outputs must be user-facing explanations only.
- Add a response-scan test over agent/AI endpoints for prompt-leak markers.
- Align with `AI_SECURITY_MODEL.md`.

### WS-16 — Messaging and WebSocket authorization (uncovered gap)
- Audit the Go service: JWT verification (`internal/auth/jwt.go` — RS256 enforced in
  staging/production), WebSocket handshake auth, channel/conversation membership, demo-room
  participation, feed visibility, and the `devtoken.go` path.
- Confirm a user cannot join another workspace's channel or read another conversation by id.
- Tests: WS handshake without token rejected; non-member cannot subscribe/publish to a channel.

### WS-17 — Database / tenant-filter security
- Sweep repository queries for missing ownership/tenant filters, especially in the PostgreSQL
  cutover paths, and confirm authorization-aware accessors are used rather than post-fetch filtering.
- Confirm authorization tests run against the PostgreSQL authority, not only the legacy path.

### WS-18 — Automation administration surface (uncovered gap)
- Apply the same review to `techit-admin-dashboard`: route guards, admin service calls, and what the
  admin bundle can see. Confirm admin-only data is not reachable with a normal token.

---

## 7. Tier 3 — Verification

### WS-19 — Security test suite (added to existing runners)
- Node: `vitest` — IDOR/BOLA, vertical, cross-tenant, entitlement, field-absence, file access,
  API-manipulation.
- ai-router: `pytest` — investor role matrix, role freshness, agent prompt-leak scan.
- Messaging: Go tests — WS auth, channel membership.
- Every test asserts the **negative** case (field absent / 403), not just the happy path.

### WS-20 — DevTools acceptance runbook (per role)
- For Explorer, Founder, Collaborator, Investor, Organization, Admin: perform normal actions with
  DevTools open; verify Network, Storage, IndexedDB, cookies, WebSocket frames, and loaded sources.
- Explicitly do **not** implement F12 blocking, right-click blocking, DevTools detection, or app
  freezing. Information minimization is the fix.
- Record before/after response schemas for every corrected endpoint (report §8 format).

### WS-21 — Documentation and evidence
- Update `SECURITY_POSTURE_SCORE.md`, `API_SECURITY_MATRIX.md`, `THREAT_MODEL.md`,
  `OWASP_CONTROL_MAPPING.md`, and `RELEASE_CANDIDATE_SIGNOFF.md` with real run IDs and owners.
- The release candidate signoff currently has every gate pending — it must not be approved until the
  Tier 0/1 workstreams are green.

---

## 8. Sequence and PR plan

1. **WS-06, WS-07** (governance + gates) — must land first so everything after is gated.
2. **WS-01** (critical token transport) — highest-impact code change; ship alone, verify on staging.
3. **WS-02, WS-03, WS-04, WS-05** (high findings) — one PR each, per repo.
4. **WS-08 … WS-18** (medium) — batched by area, each with its tests.
5. **WS-19 … WS-21** (verification + docs) — before any release approval.

Cross-repo dependencies: WS-05 needs a BACKEND freshness signal; WS-01 touches BACKEND and
new-frontend in lockstep (contract change); WS-13 touches BACKEND, ai-router, and the static host.

## 9. Requires architectural decision (not patched)

1. Shared symmetric JWT across four services — move to asymmetric, per-service audience.
2. Role freshness as a shared authorization service rather than a version signal.
3. SQLite→PostgreSQL authority window — authorization guarantees differ per path.
4. GitHub plan limitation blocking branch protection on private repos — upgrade or change repo
   visibility; no code fix exists.

## 10. Release gate

Do not approve production release until: C-1 and H-1..H-4 are fixed and proven; G-1..G-7 governance
gaps are closed; WS-19 tests run green in CI on protected branches; WS-20 passes for every role; and
`RELEASE_CANDIDATE_SIGNOFF.md` carries real run IDs, operators, and approver names.

---

## 11. Remediation status — WS-01 … WS-07 (2026-09-26)

Verification below is local and live, not static. Full-suite CI confirmation is pending the
corresponding pull requests.

| WS | Finding | Status | Evidence |
|---|---|---|---|
| WS-01 | C-1 token in body + `sessionStorage` | Implemented (opt-in hardening) | Backend stops serializing `req.user.token` and projects the profile; the SPA keeps the JWT in memory only and purges the legacy key. `AUTH_BROWSER_BODY_TOKEN` (default `true`) keeps the body token until ai-router and the Go messaging service accept cookie auth, so no existing client breaks. Tests: `auth.test.js` + `authStorage.test.ts` green. |
| WS-02 | H-1 email/plan over-exposure | Implemented | `projectOwnProfile` allow-list replaces `{ ...profile }`; `publicProfile` returns email/subscriber/subscription only to the owner or an explicit shared context. `users.test.js` green. |
| WS-03 | H-2 MCP default-allow | Implemented | `authorizeInvocation` rejects unknown plugins and enforces `toolsAllowed`; `Plugins-MCP` mount fails closed with no hook. `mcp.test.js` green. |
| WS-04 | H-3 unguarded Investor routes | Implemented | `_require_investor_role` applied to all 10 previously unguarded Investor routes in `main.py`; a scripted check confirms no Investor route lacks the guard. |
| WS-05 | H-4 stale role / revoked session | Implemented | Role was already re-read per request; `_assert_token_fresh` adds an optional age bound and a `user_sessions` revocation check against the platform identity DB, failing open (logged) if that store is unreachable. `tests/test_user_context_db_hydration.py` green. |
| WS-06 | G-1 … G-4 governance | **Partially blocked** | Dependabot alerts + automated security fixes enabled and verified on all five repos. Branch protection, secret scanning, push protection and CodeQL all return `422`/`403` — they require GitHub Pro / Advanced Security on private repos. Owner decision required. |
| WS-07 | G-5, G-6 dependency gate | Implemented | Root cause was merge damage, not a missing file: the BACKEND root `package-lock.json` and `new-frontend/frontend/package-lock.json` were invalid JSON, so npm reported EUSAGE as if no lockfile existed. `new-frontend/frontend/package.json` additionally carried a duplicated `devDependencies` tail (including a forbidden TypeScript 5→7 major and a `vitest` 2→5 major incompatible with `vite ^5.4.21`). Both lockfiles are restored/reconciled, the manifest is deduped, and `dependency-review` now runs a real lockfile-integrity gate on private repos instead of skipping. |

### WS-07 verification

- `npm ci` (BACKEND root, and `npm ci --prefix frontend` for new-frontend) exits `0`; no `Invalid:`
  or `Missing:` sync errors.
- `npm audit` + `.github/scripts/npm-audit-regression.mjs` exits `0` on both repos (BACKEND has 3
  high findings, all covered by the documented baseline; new-frontend reports none).
- `npm run build` in new-frontend now gets past install and fails only on pre-existing TypeScript
  errors in `src/components/ui/chart.tsx`, `src/dashboard/collaborators/.../Earnings.tsx` and
  `src/dashboard/investors/.../AllocationEngine.tsx`. These are unrelated code defects that were
  previously masked because the deploy workflow never got past `npm ci`; they are not caused by
  WS-07 and are left for a separate change.

### WS-07 known limitation

`dependency-review-action` cannot run on private repos without GitHub Advanced Security — verified
live, the dependency-graph compare API returns `403`. The substitute gate fails closed on a missing,
malformed, or out-of-sync lockfile, and the vulnerability gate is enforced by the npm audit job,
which also runs on every pull request. Restoring the native action requires WS-06 to be unblocked.
