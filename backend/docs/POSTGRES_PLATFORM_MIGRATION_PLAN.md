# PostgreSQL Platform Migration Plan

## Objective

Make PostgreSQL the request authority for every platform capability and role.
SQLite becomes a development-only compatibility adapter and is removed from
production request paths after the final acceptance gate.

## Current Baseline

- The synchronous collection adapter is SQLite/JSON-oriented.
- Several normalized PostgreSQL projections exist, but they are not universal
  request authorities.
- Remaining services call `readDb`, `updateDb`, and `writeDb` directly.
- The new `platform_collection_records` table provides a complete PostgreSQL
  home for collections that do not yet have normalized domain tables.
- Run `npm run platform:db:inventory` before each migration wave. The report
  records every remaining synchronous SQLite authority call.

## Target Architecture

1. Every request handler is async at its storage boundary.
2. Each domain exposes an async repository with transaction support through
   `withPlatformTransaction`.
3. Normalized tables remain authoritative for high-value domains such as
   identity, sessions, finance, trust, investor operations, and support.
4. `platform_collection_records` is the compatibility home for low-coupling
   collections until their normalized schema is completed. It is not a single
   JSON database row; each collection record has its own key, version, indexes,
   and append-only event record.
5. Authorization state, idempotency keys, versions, and audit events are stored
   in PostgreSQL transactions, not in SQLite snapshots.

## Migration Waves

### Wave 0: Foundation and backfill

- Apply all PostgreSQL migrations, including `014_platform_collection_records`.
- Run the SQLite authority inventory.
- Backfill normalized tables first, then compatibility collection records.
- Compare primary-key sets, row counts, checksums, timestamps, balances, and
  append-only event chains.

The executable foundation commands are:

```bash
npm run platform:db:migrate
npm run platform:db:backfill
npm run platform:db:verify
npm run platform:db:inventory
```

### Wave 1: Identity and security

- Users, profiles, roles, contexts, sessions, MFA, verification, trust, and
  authorization policy state.
- Convert password, OTP, profile, role, context, and admin-auth mutations to
  async PostgreSQL transactions.
- Keep token/session rollback available until replay and revocation tests pass.

### Wave 2: Workspace and collaboration

- Projects, workspaces, memberships, invitations, tasks, files, code workspaces,
  bridges, deployments, and execution runs.
- Replace generic domain collection access with repository transactions and
  optimistic version checks.

### Wave 3: Content and communication

- Feed posts/comments/likes, notifications, mentorship rooms/messages/tasks,
  video progress, moments, and messaging surfaces.
- Verify visibility, tenancy, moderation, idempotency, and notification fanout.

### Wave 4: Discovery, intelligence, and academy

- Discovery profiles, recommendations, graph edges, activity states, catch-up,
  deterministic intelligence, academy curricula/progress/assessments, and
  investor/organization intelligence reads.
- Preserve deterministic output and source attribution during dual-read.

### Wave 5: Investor and organization operations

- Deal-room completion records, data rooms, questionnaires, evidence, references,
  term sheets, audit chains, organization memberships, programs, cohorts,
  actions, KPIs, partners, resources, reports, and schedules.
- Enforce PostgreSQL authorization predicates and append-only audit semantics.

### Wave 6: Finance, TVCE, billing, settlement, and support

- Wallets, credit ledger, reservations, usage settlement, subscriptions,
  payment intents, webhook idempotency, entitlements, paywalls, workflows,
  support billing adapters, corrective actions, and support audit logs.
- Run concurrency, duplicate-request, replay, and balance-invariant tests before
  disabling any financial fallback.

### Wave 7: Compliance and final operational surfaces

- Consent, data-subject requests, residency, subprocessors, breach records,
  evidence objects, GitHub connections/OAuth state, settings, admin telemetry,
  maintenance jobs, and remaining generic collections.

## Per-Domain Cutover Contract

For each domain:

1. Add an async repository and transaction tests.
2. Backfill and verify checksums.
3. Dual-write with replayable `platform_collection_events`.
4. Shadow-read and record normalized mismatches.
5. Enable PostgreSQL reads for a canary cohort.
6. Run rollback and duplicate-request drills.
7. Disable the SQLite fallback only after the observation window is clean.
8. Remove all direct synchronous adapter calls for that domain.

## Acceptance Gates

- `npm run platform:db:inventory` reports zero production-path SQLite calls.
- No request handler or maintenance job calls the synchronous collection adapter.
- Live PostgreSQL integration tests pass with RLS, concurrency, failover, and
  idempotency enabled.
- Backfill checksum and primary-key mismatch counts are zero.
- Shadow-read mismatch counts are zero for the agreed observation window.
- Rollback drills pass for every domain.
- Finance balances, ledger totals, reservations, and webhook event uniqueness
  remain invariant under concurrent retries.
- Only after all gates pass may `DB_DRIVER=postgres` and
  `SCALE_PROFILE=multi-replica` become production defaults.

## Rollback

Disable the affected `*_READ_SOURCE` flag, keep PostgreSQL dual-write/replay
enabled, preserve the mismatch report, and do not reverse-copy arbitrary
PostgreSQL writes into SQLite. Recovery uses the append-only event log and an
audited replay or backfill operation.
