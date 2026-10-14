# Platform Live-Execution Plan — Router, Execution Ledger, Lifecycle, Org, Publicity

Status: Approved for sequential implementation
Scope: `ai-router/`, `BACKEND/`, `new-frontend/` (consumers only; no new stores where an existing one fits)
Standard: production-grade, DB row-level (no whole-DB snapshot), must scale to 1M+ registered users
Goal: every surface listed below is live, real and functional — not stubbed, mocked or fake.

## Design principle (do not over-build)

One **Execution Ledger** (append-only events/timeline) → one **canonical projection** →
thin **lifecycle**, **consent** and **delivery** layers. Every requested capability is a
consumer of data we already persist (workspace execution events, trust timeline, venture
intakes/analyses, TechIT Moments), not a new subsystem per feature.

- Storage: row-level, indexed, owner/program-scoped access. No whole-DB snapshot reads.
- Router stays execution-only; the ledger stays evidence-only; consent/notification gate
  *delivery*, never storage.
- Reuse: `workspaceInvitations`, `notificationPreferences`, `techitMoments`, `trust milestone`.

## Delivery phases (sequential)

### R — Router: all providers real and validated (foundation)
Problem (verified): the registry declares 9 providers with real adapters, but credential
health/readiness only cover OpenAI + Anthropic (`provider_key_health.py:19-24`,
`runtime_config.py:156-158`), and the route chain still appends *unconfigured* providers
(`routing_engine.py:316-322`), so non-OpenAI/Anthropic models fail at call time.
- Generalize provider credential health to every registry provider (base_url + headers),
  optional providers probed only when a key is present.
- Readiness checks all configured providers; keep OpenAI/Anthropic mandatory.
- `select_chain` excludes unconfigured providers from attempts (env escape hatch).
- Acceptance: with only `GEMINI_API_KEY` (or OpenRouter/Mistral), a task routes to that
  provider and performs a real (mocked-HTTP) call; `/ready` reflects every provider.

### E — Execution Ledger + Intelligence depth (core)
Problem: execution-intelligence returns current events/artifacts/velocity only; no baseline,
delta, cohort or cumulative view; dashboard is text/scalars.
- Canonical milestone/stage **event** (reuse workspace execution events + trust milestone).
- Projection adds `baseline`, `delta` (vs start), `cohort` (similar industry+stage, anonymous
  aggregate), `cumulative` improvements — all computed from stored events.
- Frontend: visual panel (delta chips, sparkline, cohort percentile), subscriber-gated.
- Non-goal: no new scoring engine, no ML.

### L — Lifecycle: build→launch + FastTrack honesty
Problem: `stage` is manual (`domainService.js:338`), `LAUNCHED_STAGES` is string-match
(`:542`); FastTrack stage is a funding dropdown, no MVP-vs-launched detection; repo/doc/prototype
continuation into workspace is not guaranteed surfaced.
- Derive stage transitions from observed evidence (first artifact→prototype; build-path mvp→MVP;
  validation threshold→beta; verified deploy+users→launched) and emit stage events. Manual override kept.
- FastTrack: product-stage dropdown + one explicit "already launched?" + repo inference; manual fallback.
- Ensure `project_id`/`workspace_id` persist and the repo/doc/prototype surfaces and continues in the workspace.

### M — Platform metrics
Problem: org impact counts startups/launched only; no platform-wide prototypes/MVPs/milestones counts.
- One aggregate endpoint computed from the ledger: startups, prototypes, MVPs completed,
  launches, milestones, per-founder milestones. Surfaced on founder, org and admin dashboards.

### O — Org programs: invites, onboarding, tracking
Problem: `/organization/programs` is generic CRUD (`Incubator.tsx:2`); org projects are manual
and separate from founder projects; hackathon has invites, programs don't.
- Program↔founder link (reuse `workspaceInvitations` or add `programEnrollments`); invite token →
  accept → link founder project to program.
- Org dashboard reads execution-intelligence scoped by `programId`/`cohortId` (projection already supports).
- Wire Incubator/Programs to invites + roster; auto-populate instead of manual entry.

### P — Publicity for subscribers (reuse, don't rebuild)
Problem: Moments + feed + notification prefs exist; no "completed → broadcast" trigger.
- Trigger: project reaches `launched` + user subscribed → generate a TechIT Moment + feed post.
- New `publicity` notification-preference category gates delivery; cost = 0 for subscribers.
- Non-goal: no new broadcast system.

### C — Consent
- Extend investor trust-access request/decision to cover execution/cohort fields; default private;
  investor dashboard reads only approved metadata.

### X — Everything live (hardening, tracked while touching each surface)
- Remove silent `withFallback`/static-array mocks in sampled frontend clients; back
  `messaging-backend` with Postgres; ensure `DOMAIN_SOURCE=postgres`; fix feature gates
  (e.g. execution intelligence requires `MCP_ENABLED`).

## 1M-user scalability contract
- Row-level indexed reads/writes only; pagination + bounded candidate limits (existing pattern).
- Respect `config/scalability_slos.json` (read p95 ≤ 500ms, 0.999 availability) and the
  `scripts/capacity_model.py` scenarios up to 1,000,000 users.
- Aggregates are precomputed/rolled-up, never full scans per request.
- Migrations additive, reversible; no destructive schema changes.

## Definition of done (per phase)
Implementation works end-to-end; tests added and passing; no regressions; docs updated;
production-readiness and scalability maintained or improved; no mock/fake path left on the surface touched.

## Status log (implemented, sequential)

- Phase R — done (ai-router `291f29e`).
- Phase E — done (BACKEND `98f779b`, new-frontend `ed41aeb`).
- Phase L — done (BACKEND `069f56a`, ai-router `886909d`, new-frontend `ba2e51c`).
- Phase M — done (BACKEND `c860244`, new-frontend `4b3334a`).
- Phase O — done (BACKEND `1748880`, new-frontend `5235e29`).
- Phase P — done (BACKEND `1945b5b`, new-frontend `36d2f03`).
- Phase C — done (BACKEND `67b15a0`, ai-router `6d4f9db`, new-frontend `c809dd9`).
  Consent is fail-closed: approval grants only the non-sensitive requested scopes unless the
  founder names sensitive scopes; execution/cohort fields stay private until granted. An
  investor can never scope an organization/program/cohort that is not theirs; investors only
  read startups they are authorized for (watchlist/deal room/relationship/mentorship room they
  run) and only with the granted execution scope.
- Phase X — done for the surfaces touched here (BACKEND `e92ba69`, new-frontend `5292936`):
  the canonical execution-intelligence view no longer depends on the MCP connector flag, and
  the FastTrack/incubation client surfaces real pipeline errors instead of a silent `null`.

### Remaining deployment prerequisites (environment, not app code)
- Run the row-level stores as authoritative: `DOMAIN_SOURCE=postgres` and the sibling
  `*_READ_SOURCE`/`*_WRITE_SOURCE` flags (`.env.example` still ships `sqlite` dev defaults).
  These are validated by the production config check and cannot be flipped in code.
- `messaging-backend` already ships a pgx/Postgres store (`internal/store/postgres`); the
  deployed instance must point it at the platform database.
