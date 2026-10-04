# TechIT Platform — Implementation Plan (P0–P4)

**Date:** 2026-10-01
**Companion to:** `PLATFORM_END_TO_END_AUDIT_AND_IMPLEMENTATION_PLAN_2026-09-30.md`
**Goal:** turn the audit findings into production-ready behaviour, one change per
repo, each verifiable by its own test suite.

---

## 0. Workstream summary

| ID | Workstream | Repo(s) | Risk | Status |
|---|---|---|---|---|
| P0.1 | Fail prod build without `VITE_API_STRICT=1` | new-frontend | low | this plan |
| P0.2 | Hard-guard admin synthetic seeding | techit-admin-dashboard | low | this plan |
| P0.3 | Assert ai-router placeholder flag off in prod | ai-router | low | this plan |
| P0.4 | Merge ai-router RS256 PR #84 after #83 | ai-router | low | blocked on #83 |
| P1 | Payment authority: activate **or** retire the dormant gateway | TECHIT-PAYMENT-GATWAY + BACKEND | med | decision below |
| P2 | Remove `fakes.go` from the production Go package | BACKEND/messaging-backend | med | this plan |
| P3 | Recommendation cadence (people-you-may-know / opportunities) | BACKEND + new-frontend | med | shipped |
| P4 | Deliberate-limitation honesty pass | new-frontend | low | this plan |

---

## 1. P0 — Fail-closed production guards

### P0.1 `VITE_API_STRICT` must be on in production

**Finding.** `frontend/src/lib/api/client.ts` `withFallback()` silently returns
bundled/empty data and logs *"using mock fallback"* whenever the API call throws,
**unless** `apiFallbackEnabled()` returns false. `apiFallbackEnabled()` is driven
by `VITE_API_STRICT`. If a production build is compiled without it, the app can
render mock data as real.

**Change.**
- Resolve the flag at build time: treat `PROD` (Vite `import.meta.env.PROD`) as
  strict **by default**, so the fallback only works when a developer explicitly
  opts in.
- Keep `.env` / `.env.example` documented; production must set `VITE_API_STRICT=1`.
- Add a unit test asserting the fallback is disabled under `PROD` with no flag.

**Files.** `frontend/src/lib/api/client.ts`, `frontend/src/lib/messaging/client.ts`,
`frontend/.env.example`, a new `client.strict.test.ts`.

**Acceptance.** In a production build, a failing call throws (surfaces the real
error) instead of returning the fallback; dev keeps the opt-in fallback.

### P0.2 Admin dashboard must never fabricate analytics in production

**Finding.** `techit-admin-dashboard/server/eventStore.js` seeds synthetic
users/events (`server/seedEvents.js`: `u_founder_001`, …) when the event store is
empty **and** `ADMIN_SEED_EVENTS=true`. If that flag is set in production the
operator dashboards render fabricated users as if real.

**Change.**
- Refuse to seed when `NODE_ENV=production` (throw at server start / first read),
  regardless of `ADMIN_SEED_EVENTS`.
- Log a loud, structured warning when seeding does run (non-prod only).
- Add a backend test: production + `ADMIN_SEED_EVENTS=true` ⇒ throws; test env ⇒
  seeds.

**Files.** `server/eventStore.js`, `server/seedEvents.js`, `server/*.test.js`.

**Acceptance.** `NODE_ENV=production` cannot yield seeded analytics; tests prove
the guard.

### P0.3 ai-router placeholder responses must be impossible in prod

**Finding.** `ai_command_layer_impl.py` can return a fabricated completion when
`ALLOW_AI_PLACEHOLDER_RESPONSES` is truthy. It is guarded to non-production, but
that guard is imperative and easy to regress.

**Change.**
- Add `ALLOW_AI_PLACEHOLDER_RESPONSES` to the runtime assertion in
  `runtime_config.py` `assert_runtime_ready()`: fail startup if truthy while
  `ENVIRONMENT in PROD_ENVS`.
- Add a test to `tests/test_runtime_config.py`.

**Files.** `ai-router/runtime_config.py`, `ai-router/tests/test_runtime_config.py`.

**Acceptance.** A prod/staging start with the flag truthy raises; dev/test is
unchanged.

### P0.4 ai-router RS256 merge

Merge PR **#84** once PR **#83** (stale model registry) lands. No new work; do
not recreate the closed #85.

---

## 2. P1 — Payment authority: one source of truth

### Finding (restated precisely)

`TECHIT-PAYMENT-GATWAY` ("Havitech Payment Microservice") is **real code but
dormant**:

- It is a standalone FastAPI + SQLAlchemy service with Stripe/Paystack/Flutterwave
  adapters, geo-pricing, invoices and COGS primitives.
- It has **no Dockerfile and no CI/deploy workflow**, so it is not running.
- The platform does not depend on it: the app checks out through the Node
  `BACKEND/backend/src/services/tvceBillingService.js` (HMAC-SHA256 Stripe /
  sha512 Paystack / Flutterwave verif-hash), reached via `/api/tvce/*`.
- When activated, the gateway would be a **client** of the Backend, not an
  authority: `services/platform_authority.py` calls the Backend's signed
  `POST /internal/usage-settlement/authorize` and `/checkout`. The Backend already
  exposes the matching server seam (`src/middlewares/serviceAuth.js`
  `requirePaymentGatewayService`, wired in `src/routes/usageSettlement.js`).
- Its `billing_logic/` (Prisma "Token Billing API") is the **legacy** service,
  disabled by default (`LEGACY_BILLING_COMPATIBILITY=false`). The single LLM
  **stub** (`billing_logic/services/llm_client.py`, returns
  `"[stub completion …]"`) lives only inside that disabled legacy module.

### Decision

**Retire the duplicate; keep the Node/TVCE backend as the single payment
authority.** Rationale:

1. The platform is already production-serving checkout through `tvceBillingService.js`;
   the gateway is unused. Activating a second provider implementation would create
   two webhook verifiers and two sources of entitlement truth — the exact drift the
   alignment report warns against.
2. The alignment report itself says the gateway "must not become a second
   identity, role, wallet, or entitlement authority". With TVCE already complete,
   the gateway adds surface without adding capability.
3. Any future need for geo-pricing/invoices is cheaper to add as a **Backend
   module** reusing the existing authority, than to run and secure a second
   service with its own DB and webhook processing.

### Tasks

| Task | Owner | Change |
|---|---|---|
| P1.1 Record decision | BACKEND docs | This section is the record; link from `TVCE_…md` |
| P1.2 Archive the gateway repo | TECHIT-PAYMENT-GATWAY | Add `ARCHIVED.md` pointing to `tvceBillingService.js` as authority; mark GitHub repo archived/read-only |
| P1.3 Remove the legacy Prisma module | TECHIT-PAYMENT-GATWAY | Delete `billing_logic/` (disabled legacy + LLM stub) so no stub is mistaken for a capability |
| P1.4 Keep the Backend seam documented | BACKEND | `requirePaymentGatewayService` stays wired but dormant; document that it activates only if a gateway is ever run |

**Acceptance.** Exactly one provider implementation is authoritative; no
reachable stub remains; the dormant seam is documented, not silently broken.

---

## 3. P2 — Remove `fakes.go` from the production Go package

### Finding (restated precisely)

`BACKEND/messaging-backend` production runtime is **Postgres-only**: `cmd/server/main.go`
opens Postgres via `openPostgresWithRetry` and `log.Fatalf`s if it is unavailable
(Redis for cache/presence). There is **no** production in-memory fallback.

However, `internal/store` ships three non-test files with in-memory doubles —
`fakes.go` (831 lines), `demo_fake.go`, `qa_fake.go` — declared as
`package store`. Because they live in the production package, they are compiled
into anything that imports `store`, even though no non-test code calls them.
They are used by **10 test files** across `feed`, `channel`, `messaging`, `qa`,
`demo`, `transport/httpapi`, `transport/ws`, and `store` itself.

### Change (keeps the suite green)

Move the doubles into a dedicated test-support package, the standard Go idiom:

- New package `internal/store/storetest` holding `fakes.go`, `demo_fake.go`,
  `qa_fake.go` (renamed to `*_test`-free normal files, `package storetest`).
- Alias the store types the doubles reference (`type Post = store.Post`, …), so
  the moved code compiles with minimal edits.
- Update the 10 test files: `store.NewFakeStores()` → `storetest.NewFakeStores()`
  (and the related fake types).
- Move the fake-only tests (`fakes_test.go`, `demo_test.go`, `qa_fake_test.go`)
  into `storetest`.

After this, `internal/store` contains only interfaces + real types + the Postgres
adapter, and **nothing in a non-test build can construct an in-memory store**
(`go build ./...` links no fakes; only `go test ./...` does).

**Why not delete the files outright?** The suite depends on them; deleting would
remove the only store double and force testcontainers. The instruction "remove
`fakes.go` and leave Postgres-only" is satisfied at the production layer: the
production package and binary are Postgres-only, and the doubles are explicitly
test-scoped.

**Acceptance.** `go build ./...` succeeds with no `Fake*` symbol in package
`store`; `go test ./...` passes; `rg "type Fake" internal/store/*.go` (non-test)
is empty.

---

## 4. P3 — Recommendation cadence + feed recommendations (shipped)

**Status:** implemented. Backend `feat/recommendation-cadence`; frontend
`feat/feed-recommendation-rows`.

### Current state (verified)

- Recommendations are computed in `discoveryService.js` (`getRecommendations`)
  with types including `person` and `opportunity`.
- `discoveryInfrastructure.js` already caches per user/surface/type in Redis with
  a TTL and invalidates on profile-update, feedback, and recommendation events
  (`invalidateDiscoveryUser`, `enqueueDiscoveryRefresh`).
- `scripts/discovery-worker.js` drains the refresh queue and periodically does a
  full refresh; there is no nightly warm.
- Recommendation generation is separate from presentation: surfaces consume
  `GET /api/discovery/recommendations` and never rank entities themselves.

The cadence existed as **one global TTL (default 300s)** for every type.

### Decision — per-surface cadence (confirmed, shipped)

| Surface | TTL | Env var |
|---|---|---|
| General feed | 5 min | `DISCOVERY_CACHE_TTL_SECONDS` (300) |
| People you may know | 10 min | `DISCOVERY_PEOPLE_TTL_SECONDS` (600) |
| Opportunities | 60 min | `DISCOVERY_OPPORTUNITY_TTL_SECONDS` (3600) |

Refresh model: cache-hit-or-compute + background worker (unchanged). **No nightly
warm** — recompute is driven by activity and invalidation events; scheduled
warming is deferred until usage volume justifies it.

### Invalidation (targeted)

| Event | Action |
|---|---|
| Follow / connect (request or accept) | `invalidateDiscoveryUser` for **both** users |
| New opportunity posted | `invalidateDiscoveryType('opportunities')` — clears only the opportunities surface across users |
| Profile update / feedback / recommendation event | existing `invalidateDiscoveryUser` + enqueue |

### Presentation

- The original mixed **"Recommended for you"** module leads the feed (surface
  `feed`), preserving cross-type serendipity from the initial design.
- Five labelled rows follow, each on its own surface: **People you may know**
  (`feed-people`), **Opportunities for you** (`feed-opportunities`),
  **Startups for you** (`feed-startups`), **Projects for you**
  (`feed-projects`), and **Ideas for you** (`feed-ideas`).
- Rows are de-duplicated against the leading module so one entity is never shown
  — or counted as an impression — twice.
- An unobtrusive **"Updated Xm ago"** label uses the recommendation set's
  `meta.generatedAt`.

### Ranking and feedback

- Ranking stays **fully deterministic** (role/context, skills, industry/domain,
  trust/reputation/GSIS, behaviour/engagement). No LLM enrichment — auditable and
  reproducible.
- `not_interested` is **entity-specific and persistent**, stored and reversible
  (`undo`); it suppresses the exact entity rather than banning the category
  (`dont_recommend_type` remains the explicit category mute).

**Acceptance.** People recommendations refresh within 10 min of a graph change;
opportunities within the hour; general feed within 5 min; the two rows invalidate
on the documented events; exposure/feedback are recorded per surface and type.

---

## 5. P4 — Honesty pass (no fakes, keep labels)

Re-verify and keep labelled: Agents console = polling (not SSE/WebSocket);
Connectors = credential handshake (not OAuth redirect); Files = metadata-only
("Register File"). Any change here is a real feature, never a cosmetic fake.
Also sync `techit-website` (behind `origin/main`) if in release scope.

---

## 6. Verification matrix

| Change | Command |
|---|---|
| P0.1 | `cd new-frontend/frontend && npx vitest run src/lib/api` |
| P0.2 | `cd techit-admin-dashboard && npm run test:backend` |
| P0.3 | `cd ai-router && python3 -m pytest tests/test_runtime_config.py -q` |
| P2 | `cd BACKEND/messaging-backend && go build ./... && go test ./...` |
| P3 | `cd BACKEND/backend && npx vitest run src/__tests__/discovery*` + `cd new-frontend/frontend && npx vitest run src/dashboard/feed` |

---

## 7. Non-goals

- No merging without explicit approval.
- No new identity/wallet/entitlement authority outside Backend/TVCE.
- No converting labelled limitations into fakes.
- No unrelated bug fixes.
