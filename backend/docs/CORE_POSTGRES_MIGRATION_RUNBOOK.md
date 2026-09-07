# Core State PostgreSQL Migration Runbook

## Why the gate exists

The Node backend's core state adapter exposes synchronous `readDb`, `writeDb`, and `updateDb` functions. They currently serialize the application state into SQLite collections. There are approximately 487 call sites, including authentication, profiles, workspaces, projects, feed, messages, wallet, credits, TVCE, and support.

Changing `DB_DRIVER` directly is unsafe because PostgreSQL access is asynchronous, SQLite transactions are process-local, and a JSON/JSONB blob would reintroduce a single hot-row write bottleneck. `SCALE_PROFILE=multi-replica` therefore remains fail-closed until the migration below is complete.

## Target state

- PostgreSQL is authoritative for transactional platform data.
- Redis is authoritative for distributed rate limits, locks, queues, idempotency, and pub/sub.
- Domain tables are normalized and indexed; no whole-database JSON blob is used for concurrent writes.
- Service methods use an explicit async repository interface and transactions.
- SQLite remains a local-development adapter only.

## Current implementation checkpoint

The following projection domains are implemented and can be run together:

- Identity, profiles, roles, active contexts, sessions, and security events.
- Organizations/workspaces, projects, memberships, and workspace tasks.
- Feed posts/comments/likes, files, notifications, and mentorship messages.
- Wallets, credit ledger, usage reservations, subscriptions, payment intents, and billing webhook events.

Run the ordered bootstrap and consistency check with:

```bash
npm run core:db:migrate
```

The command exits non-zero when any projection reports a row-count mismatch. It does not switch request authority; SQLite remains authoritative until the async repository cutover is complete.

Identity read cutover is now feature-flagged:

```text
IDENTITY_READ_SOURCE=postgres
IDENTITY_READ_FALLBACK_SQLITE=true
IDENTITY_SHADOW_READS=true
```

Enable it for a small tenant cohort only after `npm run identity:db:verify` is
consistent. Set `IDENTITY_READ_FALLBACK_SQLITE=false` only after the shadow
read observation window and rollback drill succeed. Identity writes remain on
the existing transaction path until the write repository is migrated.

## Migration sequence

### 1. Freeze and inventory

- Generate the current collection list from `INITIAL` in `src/config/database.js`.
- Classify each collection as identity/auth, social/content, workspace/project, finance/TVCE, or operational.
- Record foreign keys, uniqueness rules, append-only ledgers, and authorization predicates.
- Add contract tests around every public service before changing storage.

### 2. Create the PostgreSQL schema

- Add one migration per domain, using PostgreSQL UUID/text IDs to preserve existing identifiers.
- Add `created_at`, `updated_at`, and version columns to mutable entities.
- Add unique constraints for emails, idempotency keys, webhook event IDs, ledger operation IDs, and workspace membership.
- Add indexes for every existing lookup predicate (`user_id`, `workspace_id`, `project_id`, status, and timestamp combinations).
- Add row-level security only after application authorization queries are covered by tests; do not rely on RLS as the only authorization layer.

### 3. Introduce an async repository boundary

Create `src/repositories/` interfaces such as:

- `identityRepository`
- `workspaceRepository`
- `contentRepository`
- `financeRepository`
- `operationsRepository`

Each method accepts a transaction client where writes can participate in a larger operation. Controllers and services must become `async` at the boundary. Do not make PostgreSQL calls synchronous through subprocesses, worker waits, or a JSONB state row.

### 4. Dual-write in shadow mode

- Keep SQLite as the read authority initially.
- Write the migrated domain to PostgreSQL in the same request using an outbox/idempotency record.
- Record success, latency, and checksum differences without changing the response.
- Retry transient PostgreSQL failures through the existing worker queue; never lose the SQLite result.
- Alert on any mismatch before enabling PostgreSQL reads.

### 5. Backfill with verification

- Quiesce writes per domain for a short, announced window or use an append-only change log.
- Export SQLite rows with stable ordering and deterministic JSON normalization.
- Load in dependency order: identity -> organizations/workspaces -> projects/content -> finance/operational records.
- Compare row counts, primary-key sets, checksums, balances, and ledger totals.
- Preserve original IDs and timestamps so downstream references remain valid.

### 6. Shadow-read and cutover

- Read PostgreSQL and SQLite in parallel for sampled requests.
- Compare only fields with defined normalization rules; ignore storage-specific metadata.
- Start with low-risk read endpoints, then identity/profile, then workspace/content, then finance/TVCE.
- Enable reads through a feature flag per domain and tenant cohort.
- Keep dual-write enabled through the observation window.

### 7. Rollback plan

- If PostgreSQL reads diverge, disable the domain read flag and return to SQLite reads while dual-write continues.
- If PostgreSQL writes fail, keep the request on SQLite and enqueue a replayable outbox operation.
- Do not reverse-migrate arbitrary PostgreSQL writes into SQLite without an audited export and checksum verification.
- Preserve the PostgreSQL database for forensic comparison until the cutover is accepted.

### 8. Finalize and remove the gate

Remove the `SCALE_PROFILE=multi-replica` startup restriction only when all of the following are true:

- No production route calls the SQLite adapter for authoritative state.
- All mutable domain writes are transactional PostgreSQL operations.
- Redis-backed coordination is mandatory and monitored.
- Two or more backend replicas pass failover and duplicate-request tests.
- Backfill and shadow-read mismatch rates are zero for the agreed observation window.
- Finance, wallet, credit, TVCE, billing webhook, and idempotency tests pass under concurrency.

## Recommended implementation order

1. Auth/session/profile and role assignments.
2. Organizations, workspaces, projects, and memberships.
3. Tasks, files, feed, messages, notifications, and activity.
4. Investor and organization intelligence projections.
5. Wallet, credits, TVCE, payment intents, and settlement ledgers.
6. Support, compliance, audit, and remaining operational collections.

Finance and authorization domains are migrated last because incorrect replay or ordering can create irreversible consequences.

## Capacity and pool sizing

Use PgBouncer and calculate the total PostgreSQL connection ceiling across API replicas, workers, migrations, and admin jobs. The pool limit is a deployment setting, not a source-code constant. Load test connection saturation before increasing replicas.

## Exit evidence

Store migration run IDs, row counts, checksums, mismatch reports, latency comparisons, rollback drills, and concurrency test results as release artifacts. Only then set `SCALE_PROFILE=multi-replica`.
