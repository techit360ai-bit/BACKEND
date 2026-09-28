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
| WS-06 | G-1 … G-4 governance | **Closed on the three public repos; open on the two private ones** | Owner made `BACKEND`, `new-frontend` and `ai-router` public on 2026-09-27. Branch protection, secret scanning, push protection and CodeQL are now enabled and verified there — see 12.11. `techit-admin-dashboard` and `TECHIT-PAYMENT-GATWAY` remain private, so `GET /branches/main/protection` still returns `403 Upgrade to GitHub Pro`. Dependabot alerts are enabled on all six. |
| WS-07 | G-5, G-6 dependency gate | Implemented | Root cause was merge damage, not a missing file: the BACKEND root `package-lock.json` and `new-frontend/frontend/package-lock.json` were invalid JSON, so npm reported EUSAGE as if no lockfile existed. `new-frontend/frontend/package.json` additionally carried a duplicated `devDependencies` tail (including a forbidden TypeScript 5→7 major and a `vitest` 2→5 major incompatible with `vite ^5.4.21`). Both lockfiles are restored/reconciled, the manifest is deduped, and `dependency-review` now runs a real lockfile-integrity gate on private repos instead of skipping. |

### WS-07 verification

- `npm ci` (BACKEND root, and `npm ci --prefix frontend` for new-frontend) exits `0`; no `Invalid:`
  or `Missing:` sync errors.
- `npm audit` + `.github/scripts/npm-audit-regression.mjs` exits `0` on both repos (BACKEND has 3
  high findings, all covered by the documented baseline; new-frontend reports none).
- `npm run build` in new-frontend exits `0` (re-verified 2026-09-26: 30s, no errors, chunks emitted).
  The TypeScript failures this plan previously recorded in `src/components/ui/chart.tsx`,
  `src/dashboard/collaborators/.../Earnings.tsx` and `src/dashboard/investors/.../AllocationEngine.tsx`
  no longer reproduce: they were type breakages introduced by the out-of-policy `recharts` 3 major,
  which the WS-07 realignment returned to `^2.15.2`. Side effect: `Build and Deploy`,
  `Frontend Quality Gates` and `security` flip to pass for the first time since 17 September.

### WS-07 known limitation

`dependency-review-action` cannot run on private repos without GitHub Advanced Security — verified
live, the dependency-graph compare API returns `403`. The substitute gate fails closed on a missing,
malformed, or out-of-sync lockfile, and the vulnerability gate is enforced by the npm audit job,
which also runs on every pull request. Restoring the native action requires WS-06 to be unblocked.

---

## 12. Completion plan — WS-08 … WS-21 and the seven open gaps

**Status:** plan only — no WS-08+ code is written. Written 2026-09-26 after re-verifying branches,
PRs and CI live.

### 12.1 The seven reported gaps, re-assessed

| # | Reported gap | Re-verified position |
|---|---|---|
| 1 | WS-01 landed only half | **Split into two findings.** The cookie gap is *smaller* than reported: `ai-router/main.py:154` already runs `CORSMiddleware(allow_credentials=True, allow_origins=ALLOWED_ORIGINS)`, and the SPA already sends `credentials: 'include'` to it (`new-frontend/frontend/src/lib/api/client.ts:93`). ai-router never reads a cookie — `main.py` contains no `Cookie` reference at all — so the gap is cookie *extraction and verification* in two existing auth adapters, not a transport redesign. The second finding is *larger* than reported: WS-01 removed the storage writer but left **four readers** of the purged key behind, two of which de-authenticated live surfaces — see 12.2 item 1. |
| 2 | WS-05 mitigates H-4 rather than closing it | Unchanged. Still needs the identity store wired and strict mode enabled. |
| 3 | WS-06 blocked by the GitHub plan | Unchanged, and not fixable in code — decision D1. |
| 4 | Dependency majors changed beyond security scope | Real and disclosed. It is also, separately, why the frontend build is green again — decision D2. |
| 5 | Two pre-existing red jobs | Unchanged. `ai-router#83` is the upstream fix for the router gate; the WebContainer job is external and flaky. |
| 6 | `BACKEND/frontend/package.json` duplicate keys | Unchanged; reference-only module with the deploy workflow disabled, deliberately untouched. |
| 7 | WS-08 … WS-21 untouched | Unchanged. Sections 12.4–12.7 are the plan for them. |

### 12.2 Leftovers found while writing this plan

All four are small, in-scope, and were not in the original report:

1. **WS-01 removed the writer for `techit_access_token` but left four readers**, two of which silently
   de-authenticated live surfaces. This is the most serious thing found in this pass, and it is a
   regression introduced by our own change, not a pre-existing defect:
   - `src/lib/api/authorization.ts:2` — capability checks, verification status/evidence and MFA
     enrolment, used by `CapabilityGate`, `VerificationCenter`, `MfaSetup` and `OrgStep2`. It read the
     purged key directly, had no getter override, and did not send `credentials: 'include'`. Every one
     of those calls went out unauthenticated.
   - `src/lib/techitApi.ts:19` — the MCP/plugins client used by `PluginsDashboard`, Workspace
     `Code.tsx` and `codeSync.ts`. It read the purged key, and `setTechitApiTokenGetter` is referenced
     only in tests, never by the application.
   - `src/lib/messaging/config.ts:30` — reads the purged key, but is correctly overridden at
     `App.tsx:167` with the in-memory token, so messaging was unaffected.
   - `src/lib/api/session.ts:4` — sent the purged key as a bearer header on session revocation. The
     resulting empty `Bearer ` value also bypassed the backend CSRF check
     (`BACKEND/backend/src/middlewares/csrf.js:12` skips CSRF whenever an `Authorization: Bearer`
     header is present).

   Fixed in this pass: all four now use the tab-scoped in-memory token, and the two that call the Node
   backend also send the session cookie and the CSRF double-submit header. Locked by a regression test
   added to the existing `src/lib/techitApi.test.ts` (fails against the old getter, passes now).
2. `VITE_COOKIE_AUTH=true` is declared in `new-frontend/frontend/.env.example` but referenced nowhere
   in `src/` — dead configuration that implies cookie auth is already switched on.
3. `AUTH_BROWSER_BODY_TOKEN` and `AUTH_COOKIE_DOMAIN`, the two switches WS-01 introduced, are absent
   from `BACKEND/backend/.env.example`. No deployment can discover them. Documented as part of this pass.
4. `.github/dependency-audit-baseline.json` **expires 2026-09-30** — four days out. On 2026-10-01 the
   npm audit gate turns red on every PR across both Node repos, by design. This is the nearest hard
   deadline in the whole programme.
5. **The npm audit gate and Dependabot disagree about the same lockfile.** On `new-frontend` the
   WS-07 gate reports 0 findings while Dependabot reports 3 open alerts against
   `frontend/package.json` (1 high, 2 medium) — all on `vite`: installed `5.4.21`, vulnerable
   `<= 6.4.2`, first patched `6.4.3`, a major the repo's own Dependabot policy blocks. So
   "`npm audit` exits 0" is **not** equivalent to "no known vulnerabilities", and the release gate
   must consume both signals. The three advisories are Vite *dev-server* issues (Windows UNC
   handling in `launch-editor`, a `server.fs.deny` bypass, optimized-deps `.map` traversal), so the
   realistic exposure is a developer machine rather than the shipped bundle — which is why they are
   medium-priority, not critical.

### 12.3 The method

All seven gaps share one cause: the work was proven with unit tests, local builds and CI — never with
an executable statement of *"this user must not receive this"*. There was no runtime verification and
no per-role walkthrough, so the fixes are reasoned, not demonstrated. Every remaining workstream is an
authorization contract, and the cheapest way to get all of them right is to make the negative
statement executable first, then drive the fixes through it.

Five rules, applied to every slice:

1. **Measure before fixing.** No workstream starts without a probe that reproduces the violation
   against a running server as a specific role. A finding that cannot be reproduced is a hypothesis.
2. **Fail closed.** A gate that cannot run is red, not skipped. WS-07 set this precedent; WS-06,
   WS-14 and WS-19 must follow it.
3. **One contract per slice.** Each slice ships a server-side projection *and* a field-absence
   assertion. Never "hide it in React".
4. **Smallest diff in existing files.** No new services, layers, routers or schemas. New behaviour
   sits behind an env flag documented in the existing `.env.example`. Where a real fix needs
   architecture it goes to section 9 rather than being smuggled into a patch.
5. **Independently shippable and reversible.** One PR per slice, one commit-range revert per slice,
   merged in the order given in 12.10.

The loop for every slice: **reproduce → assert a failing test → fix in the existing
service/middleware → assert it passes → record the before/after JSON pair in the audit report → merge.**

### 12.4 Phase 0 — finish what is already 80% done

Cheap, unblocks everything else, and removes the half-landed criticism. Target: one week.

- **P0-1 WS-01c — finish the cookie transport.** Add cookie extraction to the existing ai-router auth
  dependency and to the Go messaging verifier (both already verify the same platform JWT); add
  `credentials: 'include'` to `new-frontend/frontend/src/lib/messaging/client.ts`; then set
  `AUTH_BROWSER_BODY_TOKEN=false`. There is a production startup warning
  (`auth_cookie_migration_incomplete`, `sessionService.js:34`) that fires on every boot until this
  lands — treat it as the completion signal. Evidence: `Network` shows no `token` in any response;
  ai-router and messaging accept the cookie; CSRF double-submit holds on both.
- **P0-2 WS-05c — actually close H-4.** Wire `AI_ROUTER_IDENTITY_DATABASE_URL` to the platform
  identity database and set `AI_ROUTER_SESSION_REVOCATION_STRICT=true`, so the check fails closed
  instead of logging and continuing. Add a test that revoking a session denies a still-valid token.
- **P0-3 Baseline cliff (4 days).** Either upgrade the five baselined packages (`ip-address`,
  `nanoid`, `postcss`, `react-router`, `react-router-dom`) or regenerate the baseline with a written
  justification and a new expiry. Do not let it expire silently — that converts a managed risk into a
  blocked pipeline on 2026-10-01.
- **P0-4 ai-router model registry.** Refresh the stale production registry metadata. This is the
  single upstream cause of the `TECHIT AI Router` red gate and of `ai-router#83`; until it is fixed,
  `ai-router#84` cannot be merged.
- **P0-5 Merge the green PRs** in this order: `BACKEND#123`, `techit-admin-dashboard#34`, then
  `ai-router#84` once P0-4 lands, then `new-frontend#152`. All four carry the WS-01…WS-07 work.
- **P0-6 Leftover cleanup** — items 1–3 of 12.2.
- **P0-7 Dependabot triage** (parallel, non-blocking): the BACKEND default branch carries
  88 findings (10 critical, 44 high). Re-confirm the count, then split into (a) exploitable-at-runtime,
  (b) build-time only, (c) needs a major upgrade. Item (a) is part of the release gate. Also
  reconcile the gate with Dependabot (12.2 item 5) so an open alert cannot coexist with a green
  audit job.

### 12.5 Phase 1 — build the authorization harness before the bulk fixes (WS-19 core)

**This phase deliberately precedes WS-08 … WS-18.** Without it every remaining fix is unverifiable,
which is exactly the gap that produced the current situation. It adds tests to the existing runners —
no new framework, no new service.

- A **role fixture** for the seven roles in the brief (Explorer, Founder, Collaborator, Investor,
  Organization, Admin, service account).
- A **route inventory** (the existing `security:endpoint-inventory` script already enumerates routes)
  joined to a table of *who is allowed* — the machine-readable form of the WS-18 role matrix.
- Four assertion families, each table-driven over that inventory:
  - **horizontal** — A requests B's `{resource}/{id}`; expect 403/404 *and* assert B's identifiers
    appear nowhere in the body;
  - **vertical** — lower role hits a higher-role route; expect 403;
  - **entitlement** — free plan hits a premium route; expect 402/403;
  - **field visibility** — response-body allow-list per viewer class, asserting *absence*, not just
    presence.
- One **live probe** against a staging deployment: the same four families executed once as real HTTP,
  so the suite cannot drift into "mocked tests that pass while production leaks".

Deliverable is a deliberately failing baseline that enumerates the current violations. That list — not
this document — becomes the authoritative work queue for Phase 2, and its size is the honest measure
of how much of WS-08 … WS-18 is real.

### 12.6 Phase 2 — remaining workstreams, risk-ordered

Ordered by *data sensitivity × exploitability × harness coverage*, not by WS number. Sizing is
relative: S ≤ 1 day, M 2–3 days, L 4–8 days.

| Order | WS | What it closes | Why here | Repos | Size |
|---|---|---|---|---|---|
| 1 | WS-17 | Missing tenant/org/workspace filters, over-broad serializers | Root-cause class: every other leak is a symptom of an authorization-unaware query. Fixing it first stops later slices reintroducing IDOR. | BACKEND | L |
| 2 | WS-09 | Files, documents, signed URLs, Data Room | Highest-sensitivity payloads (investor decks, verification documents); a leak here is unrecoverable. Must not regress the Deal Room privacy read-model, currently the strongest area. | BACKEND, ai-router | M–L |
| 3 | WS-08 | Entitlement / premium bypass | Direct revenue impact and premium-data exposure; the brief's "never trust plan/credits/role from the browser" rule lands here. | BACKEND, ai-router | M–L |
| 4 | WS-16 | Messaging and WebSocket authorization | Completely unaudited, so the risk is *unknown* and must be measured early. Note `messaging-backend/cmd/smoke/main.go:102` passes the token as `?token=` in the WS URL — a token in a query string is logged and cached; move to a header or subprotocol. | messaging-backend, BACKEND | M–L |
| 5 | WS-15 | Internal AI agent information | Prompt, routing-policy and credential leakage through the Router; distinct from WS-08 (entitlement) and WS-12 (errors). | ai-router | S–M |
| 6 | WS-18 | Admin and automation surface | Vertical escalation; also the missing admin-dashboard audit from the coverage matrix. | BACKEND, admin | M |
| 7 | WS-10 | Caching (Redis, CDN, service worker, query cache, browser cache) | Cross-user cache poisoning is only definable once the role matrix exists. Cache keys must include identity *and* permission version. | BACKEND, ai-router, new-frontend | M |
| 8 | WS-12 | Error responses, stack traces, source maps | Failure-path disclosure; ai-router's `detail: str(exc)` is already a known instance. Also decide production source-map policy. | all | S–M |
| 9 | WS-11 | Logging security | No direct browser exposure, but logs feed ops, audit and error tracking; token-in-URL (WS-16) lands in logs and must be caught here. | all | S–M |
| 10 | WS-13 | CSP, HSTS, security headers | Defence in depth, and it needs the real origin inventory produced by P0-1 before a CSP can be written that does not break WebSocket, MCP or analytics. | BACKEND, ai-router, static host | S–M |
| 11 | WS-14 | Rate limits on login, reset, AI, validation, messaging, downloads, MCP, admin | Abuse rather than disclosure, so it protects what the other slices lock down — and it must fail closed. | BACKEND, ai-router, messaging-backend | M |

### 12.7 Phase 3 — evidence and release gate (WS-20, WS-21)

- **WS-20** — the per-role DevTools runbook, executed against staging for all seven roles, recording
  Network, Application/Storage, cookies, IndexedDB, WebSocket frames and source maps. The acceptance
  test is not "F12 is empty"; it is "everything visible is information this role may legitimately
  receive". Signed with run IDs and operator names.
- **WS-21** — fold every before/after response pair, every test name and every remaining risk into the
  audit report, including the items that need architecture rather than a patch (section 9).
- **Release gate** — unchanged from section 10, plus: no gate may be "skipped", the dependency
  baseline must be current, and WS-16 must have a recorded runtime probe.

### 12.8 Decisions required

- **D1 — GitHub plan. RESOLVED 2026-09-27.** The owner made the three sensitive repos public, which
  unblocked G-1 … G-4; see 12.11 for the verified state and 12.12 for the residual exposure this
  creates. `techit-admin-dashboard` and `TECHIT-PAYMENT-GATWAY` remain private and cannot get branch
  protection, secret scanning or push protection without GitHub Pro. Remaining choice: make those two
  public as well, upgrade the plan, or accept and record the gap.
- **D2 — Dependency majors.** Accept the WS-07 realignment (`vitest` 5→2.1.9, `typescript` 7→5.9.3,
  `recharts` 3→2.15.2; admin `@vitejs/plugin-react` 6→4.7.0, `date-fns` 4→3.6.0,
  `react-resizable-panels` 4→2.1.7) and record it in the change log (recommended — it restored the
  frontend build), or revert and keep the build broken. These majors were proposed by Dependabot
  against the repo's own policy and were never intended to be in the tree.
- **D3 — WS-01c path.** Cookie across subdomains (recommended, verified small in 12.1) or a BACKEND
  edge proxy for ai-router and messaging (cleaner long-term, materially larger diff, and adds routing
  structure the brief forbids).
- **D4 — WS-05c strictness.** Enable `AI_ROUTER_SESSION_REVOCATION_STRICT=true` once the identity
  store is wired, accepting that a store outage denies AI requests. Recommended: yes — fail closed.
- **D5 — Scope guard on WS-09.** The investor Deal Room is currently the strongest area in the
  platform. Confirm it may be touched only to add tests, not to change its behaviour.

### 12.9 Definition of done for every slice

1. The violation is reproduced against a running server, as a named role, with the request recorded.
2. A test exists that fails before the change and passes after, and runs in CI.
3. The response body has an explicit allow-list and a field-absence assertion.
4. The before/after JSON pair is recorded in the audit report.
5. No new files, modules, routes or schemas; any new env flag is documented in the existing `.env.example`.
6. A single revert restores the previous behaviour.

### 12.10 Sequencing at a glance

```text
Phase 0  P0-3 baseline cliff (4-day deadline)
         P0-1 WS-01c cookie  ->  P0-2 WS-05c strict  ->  P0-4 registry  ->  P0-5 merge PRs
         P0-6 leftovers      ->  P0-7 Dependabot triage (parallel)
Phase 1  WS-19 harness + live probe  ->  authoritative violation list
Phase 2  WS-17 -> WS-09 -> WS-08 -> WS-16 -> WS-15 -> WS-18 -> WS-10 -> WS-12 -> WS-11 -> WS-13 -> WS-14
Phase 3  WS-20 per-role DevTools runbook  ->  WS-21 evidence  ->  release gate
```

Cross-repo merges stay serialised on the auth contract: `BACKEND` first, then `new-frontend`, then
`ai-router`, then `messaging-backend`, so no window exists in which the SPA sends a cookie that a
service cannot yet read.

### 12.11 WS-06 closure — verified state (2026-09-27)

Verified live against the GitHub API immediately after the change.

| Control | BACKEND | new-frontend | ai-router | admin | payment | website |
|---|---|---|---|---|---|---|
| Public | yes | yes | yes | no | no | yes |
| Branch protection on `main` | **enabled** — 12 required checks, 1 review, `enforce_admins`, no force-push, no deletion | **enabled** — 7 checks | **enabled** — 5 checks | `403` | `403` | n/a |
| Secret scanning | **enabled** | enabled | enabled | blocked | blocked | enabled |
| Push protection | **enabled** | enabled | enabled | blocked | blocked | enabled |
| Code scanning (CodeQL) | **live, 0 alerts** | **live, 0 alerts** | **live, 0 alerts** | n/a | n/a | n/a |
| Dependabot alerts | enabled | enabled | enabled | enabled | enabled | enabled |

**G-4 root cause — this was not a permissions problem.** All three repos carry a `codeql.yml` whose
`analyze` step was pinned to `upload: false`. CodeQL analysed every commit and then discarded the
result, so the job reported success while no analysis was ever stored — which is why
`/code-scanning/alerts` returned `404 no analysis found` on BACKEND and new-frontend. The fix is the
removal of that one option in all three workflows (one commit per repo). Re-running the workflow on
the security branches produced stored analyses, and the alerts endpoint now returns a real (empty)
list on all three. This is the correct pattern for any future "the gate is green but produces
nothing" finding: check whether the workflow is configured to throw its result away.

**Leaked-credential check.** Secret scanning reports **no open alerts** on any of the three newly
public repos, so no provider-recognised credential is exposed in their history. Non-provider patterns
and validity checks could not be enabled through the API (`secret_scanning_non_provider_patterns` and
`secret_scanning_validity_checks` stay `disabled`); enable both from the repository Security tab when
convenient, as they catch generic API keys and private keys that provider patterns miss.

**Actions hardening (already correct, re-verified).** All three repos run with
`default_workflow_permissions=read` and `can_approve_pull_request_reviews=false`, so a pull request
cannot grant itself write scope or approve itself. Branch protection now also requires review plus the
security checks before anything reaches `main`.

**Practical consequence to expect.** With 1 required approval and no self-approval, the owner cannot
merge their own pull requests. Merges now need one collaborator review — the repos do have writers
(`eso8484`, `chimcha67`, `andrewanuga`, `Calito55831`, `Opeyemi-Builds`, `wrefinity`) — or the review
requirement can be temporarily set to 0 while keeping every status check required.

### 12.12 Residual exposure created by making the repos public

Going public bought the controls above; it also changed the threat model, and two consequences are
worth recording rather than hiding.

1. **The dependency backlog is now public and enumerable.** BACKEND's default branch carries 88 open
   advisories (10 critical, 44 high). Anyone can read that list. Exploitability still depends on what
   is reachable at runtime, but this promotes `P0-7` from hygiene to a time-critical item, and item
   (a) of that triage — exploitable-at-runtime — belongs on the release gate.
2. **The authorization code itself is now readable.** An attacker can target the exact checks that
   WS-08 … WS-18 will harden, rather than having to discover them. This makes the WS-19 harness and
   the Phase 2 workstreams more urgent, not less. It also means field-visibility and entitlement gaps
   must be assumed discoverable, which is the premise the whole programme already runs on.

Neither is a reason to revert the visibility change: security by obscurity was never a control, and
the same code was always reachable over the network. It does mean "public" should be treated as the
new baseline from which the residual-risk register is written.

### 12.13 WS-01c status — cookie transport (2026-09-27)

Code-complete on the server side; the flag flip is deliberately held behind one unverified
precondition, because flipping it blind would remove the only credential path that currently works
for the messaging service.

**Landed.**

- **ai-router** — `get_user_context` now falls back to the `techit_access` cookie when no bearer
  header is present, and enforces the `techit_csrf` double-submit token on `POST`/`PUT`/`PATCH`/`DELETE`
  for cookie-authenticated requests, mirroring `BACKEND/backend/src/middlewares/csrf.js`. A bearer
  header is still an explicit credential and skips the CSRF check. `_extract_bearer_token`, which
  forwards the caller's JWT to `BACKEND/api/mcp`, now falls back to the cookie too, so the Workspace
  MCP path keeps working in cookie mode. CORS already allowed credentials with an explicit origin
  list, so no change was needed there. Five tests added to
  `tests/test_user_context_db_hydration.py`; ai-router is 191/191.
- **messaging-backend** — `authMiddleware` accepts the session cookie when there is no bearer header
  and applies the same double-submit rule. The WebSocket gateway already accepted the cookie and
  already refuses `?token=` outside development, so that path needed nothing.
- **new-frontend** — the messaging client now sends `credentials: 'include'` on all five verbs, so
  the cookie is transmitted at all. Frontend is 189/189 and `tsc` is clean.

**Held — `AUTH_BROWSER_BODY_TOKEN` stays `true` until this is resolved.** Two findings block a safe
flip, both about the messaging origin (`https://n.techitnetwork.com`, configured in
`new-frontend/.github/workflows/frontend.yml`):

1. **The messaging service has no CORS middleware.** `CORSOrigins` is threaded through
   `config.CORSOrigins` into `httpapi.Deps` and then never read — no `Access-Control-Allow-Origin`
   is emitted anywhere in the service. A cross-origin browser call therefore cannot succeed today,
   and a cookie-authenticated one additionally needs `Access-Control-Allow-Credentials: true`, which
   cannot be true together with a `*` origin.
2. **`n.techitnetwork.com` has no resolvable A record** (checked with `getent hosts`; the same
   resolver resolves `github.com`), so the cookie path cannot be verified end to end from here.

If the edge in front of that host already terminates CORS, it must be confirmed to send
`Access-Control-Allow-Credentials: true` with the exact application origin. Until then, keeping the
body token preserves working messaging and violates no authorization rule — the token is never
written to web storage, and the backend no longer serialises `req.user.token`.

### 12.14 WS-19 status — authorization harness and inventory evidence (2026-09-28)

**Harness landed.** Fourteen assertions added to the existing
`backend/src/__tests__/authorization.test.js`, run against the real mounted Express router rather than
mocks of the middleware, so a route mounted outside `requireAuth` fails in CI instead of in
production:

- **anonymous** — ten protected routes across users, files, notifications, moments, distribution,
  admin, investor deals and authorization must each return `401` with no token;
- **malformed credential** — a syntactically invalid bearer must be `401`, not treated as anonymous
  and allowed through;
- **vertical** — a founder token against `/api/admin/ai-router/telemetry` must be `401`/`403`;
- **horizontal** — `GET /api/users/u2` as `u1` must not contain `u2@example.com` in the response;
- **IDOR** — `DELETE /api/files/f2` as the owner of `f1` must not return `200` and must leave `f2`
  intact.

Every assertion checks the *absence* of privilege, so the suite cannot pass by exercising a happy
path. Backend is 281/281 (was 267).

**Inventory evidence** (`npm run security:endpoint-inventory` → 546 endpoints):

| Dimension | Enforced | Review required |
|---|---|---|
| Authentication | **543** | 3 |
| Authorization | 263 | **283** |
| Validation | 76 | 470 |
| Rate limit | 132 | 414 |
| Audit | 130 | 416 |

The three authentication exceptions are, and are the only ones:

| Route | Assessment |
|---|---|
| `GET /` (`app.js`) | Deliberate root/health surface. |
| `POST /api/billing/webhooks/:provider` | Correctly unauthenticated — webhooks authenticate by provider signature, which must be verified before any state change. Worth a dedicated signature-verification test. |
| `POST /api/investor-references/respond/:token` | Token-in-URL flow. The token is the credential, so it must be single-use, expiring and scoped; needs review rather than an auth guard. |

**Not yet covered.** The 283 authorization-review and 414 rate-limit-review endpoints are the real
Phase 2 backlog (WS-17 and WS-14). There is still no live staging probe: every result above is a local
test run, so the "measure against a running server" rule in 12.3 is only partly satisfied.

### 12.15 WS-11 / WS-12 / WS-13 status (2026-09-28)

**WS-13 — security headers. Mostly already in place, one real gap closed.** The Node backend
(`backend/src/app.js:102`) and ai-router (`main.py:163`) both already send `X-Content-Type-Options`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy` and
production HSTS. The Go messaging service sent **none** of them; it now does, from a `securityHeaders`
middleware on the chi router, so all three browser-facing services agree. The WebSocket gateway is
mounted outside that router and is covered by its own origin check. A CSP is deliberately not added
here: these services return JSON, and the policy that matters belongs on the static host that serves
the SPA, which is outside these repositories.

**WS-11 — logging. No token, secret or password logging found** in `BACKEND/backend/src` outside of
`error.message` fields. Token-in-URL logging, which was the specific risk, is already blocked: the
messaging WebSocket refuses `?token=` outside development.

**WS-12 — error responses. Open, and the largest remaining disclosure surface.** `ai-router/main.py`
raises `HTTPException` with `detail=str(exc)` at **28 call sites**, returning raw internal exception
text — database errors, provider errors, internal paths — to the caller. This is not fixed in this
pass on purpose: the sites mix deliberate user-facing validation messages (422 with hand-written
text) with accidental internal leakage, and the brief requires refactoring carefully rather than
blindly changing a contract the SPA may depend on. The targeted fix is to split them — keep authored
validation messages, and replace anything derived from a caught exception with a generic message plus
a server-side log — and it is the first item of Phase 2's error-response work.
