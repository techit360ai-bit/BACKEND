# Postgres connection budget, the shared pool, and PgBouncer

## Why this exists
Every domain `*_DATABASE_URL` aliases one canonical RDS URL
(`ops/ec2/sync-env.mjs`), so the backend was opening **one `pg.Pool` per
repository and per projection** (~14) against the same database. Those pools
competed for `max_connections=81`; under load `pg_stat_activity` sat at 74/81
and writes failed with *"remaining connection slots are reserved for roles with
privileges of the rds_reserved role"*, which silently broke onboarding and
sign-up. Raising `max_connections` alone only moves the cliff — the number of
pools grows with the number of modules.

## The architecture now
1. **One shared Node pool.** `backend/src/repositories/platformCollectionRepository.js`
   owns the only `new pg.Pool(...)` in `backend/src`. Every repository and the
   five `*PostgresProjection` services import `getPlatformPool()`. Connection
   count is a design constant, not a function of module count.
   - `PLATFORM_DB_POOL_SIZE` is the single knob (default 20).
   - Connections are tagged with `application_name` (`PLATFORM_DB_APP_NAME`,
     default `techit-backend`) so `pg_stat_activity` is attributable.
   - `GET /ready` reports `database.pool` (total/idle/waiting/max) and fails
     readiness only when the pool is exhausted **and** requests are queuing.
2. **PgBouncer in transaction-pooling mode** (`ops/ec2/pgbouncer/`) in front of
   RDS, shared by the Node backend, the ai-router/uvicorn + Celery fleet, and
   the Go messaging service. RDS now sees only `default_pool_size` (30) server
   connections no matter how many app processes run.
   - Listens on `127.0.0.1:6432` only; the credential file is owner-only 0600.
   - `server_tls_sslmode=require` (TLS to RDS); the loopback hop is plain.
   - Wildcard `[databases]` entry forwards `techit_db` **and** `techit_msg`.

### Safety properties that make transaction pooling correct here
- Row-level security uses `set_config('app.user_id',$1,true)` — `is_local`, so it
  is scoped to the transaction and released at `COMMIT`.
- `pg_advisory_xact_lock(...)` is transaction-scoped.
- Every `pool.connect()` block already wraps its statements in an explicit
  `BEGIN`/`COMMIT`, so nothing relies on a pinned server connection.
- No `LISTEN/NOTIFY`, session `SET`, temp tables, or cursors.
- Go messaging runs `PGX_QUERY_EXEC_MODE=exec` so pgx's statement cache can
  never pin a prepared statement to a pooled connection.
- Python (`psycopg2` via SQLAlchemy) uses client-side binding — safe by default.

## Cutover (already wired into the deploys)
- `backend` deploy: `ops/ec2/pgbouncer/setup.sh` is run (best-effort) before the
  env sync; if the proxy is listening the backend uses `127.0.0.1:6432`, else it
  falls back to direct RDS. A failed install can never take the service down.
- `ai-router` deploy: prefers `127.0.0.1:6432` when listening, else direct RDS.
- `messaging` deploy: same preference; DSN gets `sslmode=disable` on the loopback.
- Manual re-provision / inspect: **Actions → "Ops — PgBouncer (RDS transaction pool)"**.

## Verify
```sql
-- server side: should sit near PgBouncer default_pool_size (30), not 81
SELECT usename, application_name, count(*)
FROM pg_stat_activity WHERE datname IS NOT NULL
GROUP BY 1,2 ORDER BY 3 DESC;
```
```bash
# box
sudo journalctl -u pgbouncer -n 50 --no-pager
ss -ltn | grep 6432
curl -s https://backend.techitnetwork.com/ready | jq '.checks[] | select(.name=="database.pool")'
```

## Rollback
Set the box's `backend/.env` `PLATFORM_DATABASE_URL` back to the direct RDS URL
(run the deploy with PgBouncer stopped, or `sudo systemctl stop pgbouncer` and
re-run the backend deploy's env sync with the direct URL) and `pm2 restart
techit-backend`. The single shared pool alone already removes the fan-out.

## Raising RDS max_connections (optional now)
With the shared pool + PgBouncer, the stock 81 is normally enough. If server
connections are still pinned, run `ops/ec2/rds-raise-max-connections.sh` **with
the infra AWS account** (the box/instance role is a different account):
```bash
bash ops/ec2/rds-raise-max-connections.sh --region eu-west-1 --instance techit-postgres --value 200          # dry run
bash ops/ec2/rds-raise-max-connections.sh --region eu-west-1 --instance techit-postgres --value 200 --apply
```
`max_connections` is a **static** parameter in a **custom** parameter group and
requires a reboot; the script handles both.
