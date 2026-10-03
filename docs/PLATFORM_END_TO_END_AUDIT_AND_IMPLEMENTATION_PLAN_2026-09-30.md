# TechIT Platform — End-to-End Audit & Implementation Plan

**Date:** 2026-09-30
**Scope:** `new-frontend/frontend` (React app), `BACKEND/backend` (Node),
`BACKEND/messaging-backend` (Go), `ai-router` (FastAPI), `techit-admin-dashboard`,
`TECHIT-PAYMENT-GATWAY`, `techit-website`.
**Question answered:** Which surfaces are stale, stubbed, mocked, or hard-coded,
and what makes the platform not production-ready?
**Related docs:**
`new-frontend/docs/PLATFORM_FUNCTIONALITY_AUDIT_AND_IMPLEMENTATION_PLAN_2026-09-29.md`,
`BACKEND/docs/TVCE_UNIT_ECONOMICS_PAYMENTS_AND_ENTITLEMENTS.md`,
`TECHIT-PAYMENT-GATWAY/docs/TVCE_BILLING_ALIGNMENT_REPORT.md`,
`TECHIT-PAYMENT-GATWAY/docs/PAYMENT_IMPLEMENTATION_REPORT.md`.

---

## Part 0 — Harmonization log (single home per fix)

The RS256 verification fix must exist in exactly one place to avoid divergent
copies. Final state:

| Item | Repo | Branch | Status |
|---|---|---|---|
| RS256 platform-token verification | `ai-router` | `security/exposure-hardening-2026-09-26` (PR **#84**, commit `b2b4f45`) | **single home** — folded in |
| Standalone RS256 PR | `ai-router` | `fix/router-rs256-verification` (PR **#85**) | **closed**, branch deleted |
| Connection / follow / recommendation / messaging-auth | `BACKEND` | `fix/connections-follows-messaging-rs256` (PR **#141**) | **merged** |
| Feed/connections/follows/workspace calls | `new-frontend` | `fix/feed-connections-follows-calls` (PR **#173**) | **merged** |

All working trees are clean; no uncommitted RS256 copies remain. The fix is owned
by PR #84 because that branch rewrites `main.py`/`.env.example` and a standalone
PR would conflict. Only open item in #84 is the pre-existing "model registry is
stale" release-gate failure owned by PR #83 — unrelated to this work.

---

## Part A — Scope and method

Reconnaissance was run against live source (not docs) with targeted greps for
`TODO|FIXME|stub|mock|hardcod|placeholder|not implemented|fake|seed|fallback`,
plus line-by-line reading of every endpoint/route that a reported symptom
touched. Each finding below cites the file that proves it. Where a surface was
laundered by an in-memory store, a mock fallback, or a seed script, that path was
trace to determine whether it is reachable in production.

---

## Part B — Originally reported symptoms: root cause and resolution

All six symptoms were reproduced to a root cause and fixed. Two of the fixes
(#141, #173) are already merged to `main`; one (#84) is open.

| # | Symptom | Root cause | Fix (PR) |
|---|---|---|---|
| B1 | Incubation "idea analysis" 401 | `ai-router` verified **HS256 only**, but the platform signs user tokens with **RS256** in prod/staging (`jwtKeyService.js`); router also never loaded `JWT_PUBLIC_KEY` | ai-router RS256 + algorithm allowlist (`main.py` `_jwt_verification_material`, `runtime_config.py`) — **PR #84** |
| B2 | Messaging 401 | Go verifier read `JWT_PUBLIC_KEY` but `internal/config/config.go` never **loaded/required** it, and `cmd/server/main.go` never wired `.WithPublicKey(...)` | messaging RS256 config + verifier wiring — **PR #141** (merged) |
| B3 | Feed says "no live post", cannot post | `PostComposer` swallowed failures into a generic toast; feed empty-state conflated offline-empty with service-empty | explicit composer errors + `pending`/offline signalling — **PR #173** (merged) |
| B4 | Connection requests never arrive | `connectUser` wrote the notification only to SQLite (invisible when `CONTENT_READ_SOURCE=postgres`); the edge was stored as `fromEntityId/toEntityId` but counted as `sourceId/targetId`, so counts were always 0 | full connection lifecycle + notification fan-out + correct edge fields — **PR #141** (merged) |
| B5 | Recommendation "value" empty | capability rows returned no `valueStatement`; nothing pulled the commercial config value | recommendations now derive value from `tvce-commercial.json` capabilities — **PR #141** (merged) |
| B6 | Workspace video/audio call looked mocked | call surface was a static UI with no media session | real LiveKit token from `POST /api/domain/workspaces/:id/call-token` + `@livekit` room UI — **PR #173** (merged) |

### B4 / B7 — Connections vs. follows vs. tribe (explicit rule)

Per requirement, counts must not conflate the three concepts:

- **Connections** — explicit connection edges only.
- **Followers / following** — explicit follow edges only
  (`/users/:id/follow-stats`; `discovery.ts` comment: *"Explicit follow edges
  only; tribe/role overlap is not counted."*).
- **Tribe** — role/audience-derived membership, **never** counted as
  connections or followers.

This is implemented in `messaging-backend/internal/store/postgres/posts.go`
(*"Counts are explicit follow relationships only: tribe/role overlap …"*) and
surfaced in `TribePage.tsx`, `UserProfilePage.tsx`, and the feed profile cards.

### B8 — Tribe functionality

Tribe **is functional, not a stub**: `TribePage.tsx` calls `useFeedPosts('tribe')`
→ `GET /api/v1/posts?zone=tribe`, which the Go store filters by `author_role`
(`store/postgres/posts.go`, `store/postkinds.go`), and it hydrates real member
profiles via `fetchPublicUserProfile`. Gap (not a bug): membership is *derived*
(role + post audience); there is no explicit join/leave or member roster. If a
persisted roster is wanted it is an **additive** feature, not a repair — see
Phase P3.

### B9 — Build log and other feed/messaging features

`BuildLogPage.tsx` is wired to a real API (`fetchContributions`). Likes, comments,
save/unsave, post feedback, follow/unfollow, mute/block, discovery-profile sync,
and feed events are all backed by real messaging endpoints (`lib/messaging/feed.ts`,
`discovery.ts`, `messaging-backend/internal/transport/httpapi/posts.go`). No
hard-coded feed/build-log data was found.

---

## Part C — Full-platform findings

Severity: **P0** = breaks production/security, **P1** = wrong or fake data shown,
**P2** = dormant/dead weight that will mislead operators, **P3** = polish/gap.

### C1. Messaging backend (Go) — healthy

| Sev | Finding | Evidence | Status |
|---|---|---|---|
| — | Production store is Postgres-only; process **fatals** if DB is unreachable | `cmd/server/main.go` `openPostgresWithRetry` → `log.Fatalf` | OK |
| — | `internal/store/fakes.go` is in-memory **test-only** (`FakeStores` for unit tests), never constructed outside `_test.go` | `fakes.go` header + constructor grep | OK, not a prod mock |
| — | RS256 public key now loaded/required outside dev/test | `config.go`, `cmd/server/main.go` | Fixed (#141) |
| P3 | Follow/follower counts exist (`follow-stats`) but are only used on profile cards; feed author rows do not show follower counts | `discovery.ts`, `UserProfilePage.tsx` | Gap, optional |

### C2. Node backend — one P1, otherwise sound

| Sev | Finding | Evidence | Status |
|---|---|---|---|
| P1 | `withFallback` mock fallback on the **frontend** returns bundled/empty data and logs "using mock fallback" when the API fails, unless strict mode is on | `frontend/src/lib/api/client.ts:175-199` | Mitigated: `.env` sets `VITE_API_STRICT=1`; **must be enforced in prod** (see P0) |
| P2 | `src/middlewares/serviceAuth.js` defines `requirePaymentGatewayService` and it is wired to `POST /internal/usage-settlement/authorize` + `/checkout`, but **no payment-gateway service is deployed to call it** | `routes/usageSettlement.js` | Live seam awaiting the dormant gateway (C4) |
| P3 | `PAYMENT_GATEWAY_SERVICE_SECRET` unset ⇒ those two endpoints return `503 settlement_service_not_configured` (by design) | `serviceAuth.js` | OK, but document |
| — | Checkout path used by the app is the **real** `tvceBillingService.js` (HMAC-SHA256 Stripe, sha512 Paystack, Flutterwave verif-hash), reached via `/api/tvce/*` | `services/tvceBillingService.js` | OK |
| — | No `TODO/FIXME/stub/mock` markers in `tvceBillingService.js` | grep | OK |

### C3. ai-router — healthy, one guarded dev path

| Sev | Finding | Evidence | Status |
|---|---|---|---|
| P2 | `ALLOW_AI_PLACEHOLDER_RESPONSES` returns a fabricated completion, but is **hard-guarded** to non-prod/dev and defaults off | `ai_command_layer_impl.py` | OK, keep guard; assert in release gate |
| — | RS256 support added; algorithm allowlist rejects `none`/unsigned | `main.py`, `runtime_config.py` | Fixed (#84) |
| P3 | `workers/workers.py` contains empty-return guards (`return []`) — legitimate no-op paths, not stubs | `workers.py` | OK |

### C4. Payment gateway (`TECHIT-PAYMENT-GATWAY`) — real code, currently dormant

This repo is a **separate FastAPI microservice** ("Havitech Payment Microservice")
that is **not deployed and not referenced by any CI/deploy workflow**. The platform
does not depend on it today: the app's checkout goes straight to the Node backend's
`/api/tvce/*`, and the gateway itself is a *client* that would call *back* into
`BACKEND /internal/usage-settlement/authorize` (`services/platform_authority.py`).

| Sev | Finding | Evidence | Status |
|---|---|---|---|
| P2 | Dormant duplicate surface: provider adapters (Stripe/Paystack/Flutterwave) exist in **both** the gateway repo and `tvceBillingService.js`. Two sources of truth for payment authority invite drift | gateway `services/*_gateway.py` vs. `tvceBillingService.js` | Needs a decision: activate or retire (P2) |
| P2 | `billing_logic/` (Prisma "Token Billing API") is legacy and **disabled by default** (`LEGACY_BILLING_COMPATIBILITY=false`); its `services/llm_client.py` is a **stub** returning `"[stub completion …]"` | `billing_logic/main.py`, `services/llm_client.py` | Stub is isolated to the disabled legacy path — delete with the legacy module |
| P3 | No Dockerfile / no CI for the gateway repo | repo root | Blocks "activate" option unless added |

### C5. Admin dashboard — one P2 (synthetic analytics footgun)

| Sev | Finding | Evidence | Status |
|---|---|---|---|
| P2 | `server/seedEvents.js` fabricates users/events (`u_founder_001`, …) and `eventStore.js` seeds them when the store is empty **and** `ADMIN_SEED_EVENTS=true`. If that flag is ever set in prod, operator analytics render **synthetic** data as if real | `eventStore.js:34-46`, `seedEvents.js` | Add a hard prod guard (P0/P1) |
| — | Admin API has real Bearer auth; **refuses to start** in prod unless `ADMIN_API_TOKEN` ≥ 32 chars | `server/app.js:54-56` | OK |
| — | Dashboard views call **real** BACKEND endpoints via `src/app/lib/adminApi.ts` (verification, support, telemetry, intelligence) | `adminApi.ts` | OK |
| P3 | Analytics basis is a **local JSON file** (`data/admin-events.json`), not a shared store — per-instance history only | `eventStore.js` | Document scaling limit |

### C6. Frontend — no hard-coded data; honesty depends on strict mode

| Sev | Finding | Evidence | Status |
|---|---|---|---|
| P1 | Mock fallback is opt-in and currently relies on `VITE_API_STRICT=1` being set in the deploy env | `.env` / `client.ts` | Enforce in CI (P0) |
| — | `Math.random()` hits are legitimate (skeleton shimmer, WS jitter, client message IDs) | `sidebar.tsx`, `ws.ts`, `DirectMessagePage.tsx` | OK, not mock data |
| — | Feed, tribe, build log, discovery, DMs verified wired | Part B | OK |
| P3 | Wallet/plans UI reads real backend data with honest empty states ("rendered exactly as supplied by the backend") | `TechitWallet/Wallet.tsx` | OK |

### C7. Cross-cutting / process

| Sev | Finding | Evidence | Status |
|---|---|---|---|
| P1 | Deliberate limitations must stay **labelled** and never faked: polling vs SSE, credential handshake vs OAuth redirect, metadata-only file registration | `PLATFORM_FUNCTIONALITY_AUDIT_…_2026-09-29.md` Part 0 | Maintain labels |
| P2 | `techit-website` (marketing) is **4 commits behind** `origin/main` | `git status -sb` | Sync if in release scope |
| P2 | Pre-existing ai-router release-gate failure ("model registry is stale") blocks #84 | PR #84 checks | Owned by PR #83 |

---

## Part D — Implementation plan

Sequenced blocker-first. Each task names its repo and the file(s) it owns.

### Phase P0 — Close the remaining production-readiness gaps (~1–2 days)

| Task | Repo | Files | Notes |
|---|---|---|---|
| P0.1 Enforce strict API mode in prod build | new-frontend | `frontend/.env*`, deploy workflow | Fail the build if `VITE_API_STRICT` is unset/`0` in prod |
| P0.2 Hard-guard admin seeding | techit-admin-dashboard | `server/eventStore.js`, `server/seedEvents.js` | Throw if seeding is requested while `NODE_ENV=production`; log loudly on seed |
| P0.3 Assert ai-router placeholder flag off in prod | ai-router | `runtime_config.py` / `release_gate.py` | Fail startup if `ALLOW_AI_PLACEHOLDER_RESPONSES` is truthy in prod/staging |
| P0.4 Merge PR #84 after PR #83 lands (registry) | ai-router | — | RS256 single home; do not recreate a standalone PR |

### Phase P1 — Payment authority: one source of truth (~3–5 days)

Decide (see Part F) whether the gateway repo is **activated** or **retired**;
both paths below remove the duplicate-provider drift.

| Task | Repo | Files | Notes |
|---|---|---|---|
| P1.1 Document the authority decision + owner | BACKEND | `docs/TVCE_…md` | Payment gateway = adapter layer only; Backend/TVCE = identity/wallet/entitlement |
| P1.2 *(if activate)* add Dockerfile + CI + deploy for the gateway, point `PLATFORM_AUTHORITY_URL` at BACKEND, set `PAYMENT_GATEWAY_SERVICE_*` | TECHIT-PAYMENT-GATWAY + BACKEND | deploy workflows, `serviceAuth.js` env | Then `usage-settlement` seam becomes live |
| P1.3 *(if retire)* remove `TECHIT-PAYMENT-GATWAY` from the monorepo, or mark archived with a pointer to `tvceBillingService.js` | TECHIT-PAYMENT-GATWAY | repo | Eliminates the second provider implementation |
| P1.4 Delete the disabled `billing_logic/` legacy module (contains the LLM stub) regardless of choice | TECHIT-PAYMENT-GATWAY | `billing_logic/**` | Stub is unreachable but misleading |

### Phase P2 — Data truthfulness and ops correctness (~2–3 days)

| Task | Repo | Files | Notes |
|---|---|---|---|
| P2.1 Replace the admin JSON event store with a shared store, or clearly badge "local instance" | techit-admin-dashboard | `server/eventStore.js` | Multi-instance analytics correctness |
| P2.2 Surface follower/following counts on feed author rows (explicit-follow only) | new-frontend | feed components + `discovery.ts` | Reuses `follow-stats`; must not include tribe overlap |
| P2.3 Add a regression test asserting tribe overlap ≠ connections/followers | BACKEND/messaging-backend | `internal/store/postgres/posts_test.go` | Locks the B4/B7 rule |

### Phase P3 — Tribe roster (additive, only if product wants it) (~2–4 days)

| Task | Repo | Files | Notes |
|---|---|---|---|
| P3.1 Optional explicit tribe join/leave + roster endpoint | BACKEND/messaging-backend + new-frontend | store, `httpapi`, `TribePage.tsx` | Purely additive; derived membership keeps working |

### Phase P4 — Deliberate-limitation honesty pass (~1 day)

| Task | Repo | Files | Notes |
|---|---|---|---|
| P4.1 Verify every deferred capability is labelled in-UI and in docs (polling, credential handshake, metadata-only files) | new-frontend | workspaces UI + audit doc | Never convert labels into fake completeness |
| P4.2 Sync `techit-website` if in release scope | techit-website | — | 4 commits behind |

---

## Part E — Deliberate limitations (labelled — do **not** fake)

These remain intentionally limited and are honest as-is; keep the labels:

- Agents console uses **polling**, not SSE/WebSocket — the UI says so.
- Connectors use a **credential handshake**, not a browser OAuth redirect
  (`oauthRedirectSupported: false`).
- Files store **metadata only** (name/type/size), labelled "Register File".

Any change here is a real feature, not a bug fix; do not ship a fake to "look"
complete.

---

## Part F — Acceptance criteria

1. No authenticated call (`incubation/idea`, feed, messaging, workspace calls)
   returns 401 in a prod-like RS256 environment across ai-router, messaging, Node.
2. Creating a post, a connection request, and a follow each produce data the
   recipient can see; counts are non-zero and reconcile with the stored edges.
3. Follower/following counts and connections **exclude** tribe/role overlap
   (asserted by a test).
4. Recommendation rows never render an empty value; value derives from the
   commercial capability config.
5. Workspace audio/video connect through a real LiveKit room minted by the
   backend; no static media surface.
6. Prod builds fail closed if `VITE_API_STRICT` is off, admin seeding is
   requested, or the ai-router placeholder flag is set.
7. Exactly one payment-provider implementation is authoritative; the other is
   removed or explicitly archived.

---

## Part G — Explicit non-goals (until approved)

- No merging of PRs without explicit request.
- No replacing real backend wiring with new mocks, and no "fixing" a labelled
  limitation by faking it.
- No new identity/wallet/entitlement authority outside the Node backend/TVCE.
- No unrelated bug fixes outside the surfaces named above.

---

# Part H — 2026-10-03 Addendum: AWS server verification, offline-first fixes, and P0 execution

**Trigger:** production symptoms reported after the first audit —
"Failed to fetch" when an idea is submitted in the Incubation Hub, and the feed
showing *"You are offline and no cached posts are available"* after loading live
posts. Plus a direct question: the three services run on AWS — **how do we verify
them at codebase level?**

## H1. Confirmed production origin (partial CORS)

- The production frontend origin is **`https://beta.techitnetwork.com`**. It is
  not recorded anywhere in the repositories (CloudFront/S3 values live in GitHub
  Actions secrets), so no codebase check can currently prove the deployed origin.
- **Partial CORS fix applied at code level:** the expected origin is now encoded
  in each service's `.env.example` (and origin-contract tests) as
  `https://beta.techitnetwork.com`. It is **not yet applied to the AWS runtime**
  because the frontend-origin secret is not available — the deployed env vars
  (`CORS_ORIGINS`, `ALLOWED_ORIGINS`) still have to be set/confirmed in AWS.
- Measured drift that motivated this: preflight from `app.techitnetwork.com`
  returned no `Access-Control-Allow-Origin` on all three services, and
  `OPTIONS /health` on messaging returned **405** although current code answers
  every `OPTIONS` with **204** — evidence that deployed binaries/config are not
  guaranteed to match `main`.

## H2. Root cause of the two reported messages

**"Failed to fetch" (Incubation Hub)**

- `MainIncubationPanel.handleRunFullAnalysis` → `runVenturePipeline()` →
  `POST ${VITE_API_BASE_URL}/api/v1/incubation/pipeline/run`.
- Local `.env` points `VITE_API_BASE_URL` at `http://localhost:8000`; with no
  listener the browser raises `TypeError: Failed to fetch`.
- `VITE_API_STRICT=1` makes `withFallback` rethrow instead of returning `null`,
  and the `catch` rendered the raw `err.message` — hence the literal string.
- This is an **availability** failure, distinct from the earlier **401**
  (ai-router verified only HS256 while production issues RS256; fixed on
  `security/exposure-hardening-2026-09-26` / PR #84, commit `b2b4f45`).

**"You are offline and no cached posts are available" (Feed)**

- `useFeedPosts` → `fetchPostsPage()` → `GET ${VITE_MESSAGING_BASE_URL}/api/v1/posts`.
- `isNetworkFailure()` treated **any** `TypeError` as device-offline, so a
  server-down / CORS-blocked request was mislabelled as "you are offline".
- `readSnapshot('feed:global:for-you')` is empty because snapshots are only
  written after a successful load, and `setCacheScope()` purges them on auth
  changes. The service worker registers only in PROD and caches the app shell,
  never API data.

**Unifying production suspect:** if the real origin
(`https://beta.techitnetwork.com`) is missing from the three allow-lists (or the
lists still default to localhost), every browser call is CORS-blocked and
surfaces as "Failed to fetch" / "offline".

## H3. Answer: verifying the three AWS services at codebase level

Principle: a deployed service must be able to prove **which commit and which
config** it is running; CI then compares that to `main` and to the contract in
the repo. Five layers, with current status:

| Layer | ai-router | messaging (Go) | Node backend | Action |
|---|---|---|---|---|
| Build/commit stamp (`GIT_SHA`, `BUILD_TIME`, `SERVICE_NAME`, `ENVIRONMENT`) | ❌ `/health` hardcodes `version: "3.0.0"` | ❌ `/health` returns `{"status":"ok"}` only | ❌ no health route | Add stamp + expose via `/health`/`/version` |
| Liveness `/health` | ✅ | ✅ | ❌ (only `GET /`) | Add Node `/health` |
| Readiness `/ready` (config + dependencies) | ✅ (currently **503**) | ❌ | ❌ | Add; fix ai-router `MCP_BASE_URL` |
| Origin contract as code (https, non-wildcard, exact origin) | ✅ validation, ❌ no prod value | ✅ validation, ❌ no prod value | ⚠️ default localhost only | Encode `beta.techitnetwork.com`; assert in `/ready` |
| Post-deploy smoke + drift alarm | partial (`smoke.mjs` hits `/health`) | partial | partial | Extend to `/ready` + `/version` + real CORS preflight |

**Measured today (live):** `backend.techitnetwork.com/` → 200
`{"status":"TechIT API running"}`; `api.techitnetwork.com/health` → 200;
`api.techitnetwork.com/ready` → **503**, failing check `mcp.base_url`
("must use one of: https", `ai-router/runtime_config.py:131`);
`messaging.techitnetwork.com/health` → 200.

**Remediation:** fix the ai-router AWS env `MCP_BASE_URL` to
`https://backend.techitnetwork.com/api/mcp`; add `/ready` to Node + messaging;
stamp every build; extend `frontend/scripts/smoke.mjs` to assert `/ready` == 200
and deployed SHA == `main`; add a scheduled drift workflow.

## H4. Decisions locked

- **Payment authority = ACTIVATE** the standalone `TECHIT-PAYMENT-GATWAY`
  (retirement is only safe if it provably does not affect the whole payment
  logic; default is activate so `usage-settlement` becomes live). Reversible:
  the retire path stays documented in Part D / P1.3.
- **`fakes.go` = REMOVE from production.** It is a normal (non-`_test.go`) file
  in `package store` and compiles into the production binary, but no non-test
  code imports it. Production is Postgres-only (`cmd/server/main.go` already
  `log.Fatal`s on Postgres/migrate/Redis failure). Keep equivalent fixtures in
  `_test.go` files or a `storetest` package only. Applies equally to
  `demo_fake.go` / `qa_fake.go`.
- **Feed surfaces keep the original design:** `Recommended for you` + People +
  Opportunities + Startups + Projects + Ideas (deduped), each with its own
  surface key for exposure/feedback analytics.
- **Recommendation cadence:** people 600s, opportunities 3600s, general 300s;
  env-configurable; cache-hit-or-compute + background worker; targeted
  invalidation; deterministic ranking; per-entity persistent (reversible)
  `not_interested`; "Updated Xm ago" freshness.

## H5. Implementation status (this pass)

| Task | Repo | Status |
|---|---|---|
| H5.1 Failure taxonomy: offline vs service-unavailable vs timeout vs auth | new-frontend | ✅ this pass |
| H5.2 Feed error copy must never claim "offline" while online | new-frontend | ✅ this pass |
| H5.3 Incubation error copy: actionable, no raw "Failed to fetch" | new-frontend | ✅ this pass |
| H5.4 Node `/health` + `/ready` + build stamp | BACKEND/backend | ✅ this pass |
| H5.5 messaging `/ready` + `/health` build stamp | BACKEND/messaging-backend | ✅ this pass |
| H5.6 ai-router build stamp in `/health`/`/version` | ai-router | ✅ this pass |
| H5.7 Partial CORS origin contract (`beta.techitnetwork.com`) | all three | ✅ code-level; AWS env pending |
| H5.8 Node `/ready` asserts CORS + JWT config in prod | BACKEND/backend | ✅ this pass |
| H5.9 Remove `fakes.go` / `*_fake.go` from production package | BACKEND/messaging-backend | ⏳ P2 |
| H5.10 Incubation write-behind queue for true zero-connectivity | new-frontend | ⏳ P1 |
| H5.11 SW network-first API cache + dev registration | new-frontend | ⏳ P1 |
| H5.12 Targeted recommendation cache invalidation hooks | BACKEND + new-frontend | ⏳ P3 |

## H6. Added acceptance criteria

1. Killing a backend while the device is online shows a **service-unavailable**
   message (plus saved content when present), never "you are offline".
2. `GET /health` and `GET /ready` exist and return a build SHA on all three
   services; a deploy fails if `/ready` != 200.
3. CORS preflight from `https://beta.techitnetwork.com` returns the exact
   `Access-Control-Allow-Origin` on all three services (pending AWS env).
4. No fake/dummy store implementation compiles into the production messaging
   binary; production refuses to start without Postgres/Redis.
