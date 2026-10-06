# AWS RDS / ElastiCache cutover + platform activation — DevOps guide

**Date:** 2026-10-05
**Scope:** BACKEND (Node + Go messaging) · ai-router · new-frontend smoke
**Host:** EC2 `t3.micro` `54.220.111.242` (eu-west-1)

This is the operational guide for moving the platform off the legacy SQLite
authority onto the shared AWS RDS PostgreSQL database, activating Plugins-MCP,
and fixing the TLS/URL misconfigurations that left `/ready` red. Read it top to
bottom before touching production.

---

## 1. Target architecture (as provided)

```
EC2 t3.micro (54.220.111.242, eu-west-1)
  ai-router (Docker)          https://api.techitnetwork.com
  techit-messaging (Docker)   https://messaging.techitnetwork.com
  techit-backend (pm2)        https://backend.techitnetwork.com
  Celery worker (Docker)      background task processor
  Celery scheduler (Docker)   14 scheduled jobs

RDS PostgreSQL db.t3.micro   techit-postgres.czoo08wowahy.eu-west-1.rds.amazonaws.com:5432
ElastiCache Redis            techit-redis.jbcdwd.0001.euw1.cache.amazonaws.com:6379
S3                           techit-storage / techit-frontend / techit-admin / techit-website-prod
CloudFront                   techitnetwork.com / beta.techitnetwork.com / admin.techitnetwork.com
```

## 2. Database topology (decided + enforced)

| Service | Database | Why |
|---|---|---|
| Node backend (platform authority, projections) | `techit_db` | Single RDS database; every table is domain-prefixed (`core_*`, `trust_*`, `investor_*`, …) |
| Plugins-MCP | `techit_db` | `mcp_*`-prefixed tables; no separate database needed |
| ai-router | `techit_db` | Its Alembic schema already lives there (42 tables) |
| Go messaging | **`techit_msg`** | Its unpinned `users`/`posts` tables would collide with ai-router's schema — must NOT share `techit_db` |

Rule of thumb: **one RDS instance, `techit_db` for platform/ai-router/MCP,
`techit_msg` for messaging.** The messaging deploy creates `techit_msg`
idempotently if it is missing.

## 3. What was actually broken (root causes)

1. **Backend on SQLite.** The box booted a pre-cutover build with
   `DB_DRIVER=sqlite`; `DB_DRIVER` also drives `PLATFORM_REQUEST_AUTHORITY` and
   every `*_READ_SOURCE`/`*_WRITE_SOURCE`, so the whole authority layer was
   SQLite-backed and the RDS projections were never used.
2. **MCP disabled.** `backend/.env` had no MCP contract, so `mountTechitApi`
   never ran → `/api/mcp/health` returned **404** and the platform smoke
   `mcp-auth-boundary` check failed (expected 401).
3. **ai-router `/ready` 503.** Two independent misconfigs: `docker-compose.yml`
   hardcoded `postgres:5432` / `redis:6379` (no such containers) so
   `database.ping` failed, and `MCP_BASE_URL` defaulted to `http://…`, failing
   the `mcp.base_url must use https` gate.
4. **Messaging stale + insecure.** It had only a Render deploy hook, so the EC2
   container ran old code: no `/ready` (404), no `JWT_PUBLIC_KEY` (RS256 tokens
   rejected), and `ENABLE_DEV_TOKEN` was live in production.
5. **TLS.** RDS presents the AWS CA, which is not in Node's default trust store.

## 4. How the https/TLS issues were resolved

| Symptom | Fix |
|---|---|
| `mcp.base_url must use https` | `MCP_BASE_URL=https://backend.techitnetwork.com/api/mcp` (compose default + provisioned) |
| `database.ping … host "postgres"` | `DATABASE_URL` now provisioned from RDS (compose reads the env) |
| `redis.url` / `celery.broker` | `REDIS_URL`/`CELERY_BROKER` provisioned from ElastiCache |
| RDS TLS handshake | `?sslmode=require` + `<DOMAIN>_DB_SSL_REJECT_UNAUTHORIZED=false`, i.e. libpq `sslmode=require` (encrypted, no CA pin). See §9 for the verify-full hardening |
| CORS | `CORS_ORIGINS`/`ALLOWED_ORIGINS` are https-only; `/ready` fails closed otherwise |

## 5. Required GitHub secret/variable state

**`techit360ai-bit/BACKEND`**

| Key | Kind | Value |
|---|---|---|
| `PLATFORM_DATABASE_URL` | secret | `postgresql://techit:<pw>@techit-postgres…:5432/techit_db?sslmode=require` |
| `REDIS_URL` | secret | `redis://techit-redis.jbcdwd.0001.euw1.cache.amazonaws.com:6379` |
| `MCP_SECRET_KEY` | secret | base64 of 32 random bytes (`openssl rand -base64 32`) |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | secret | RS256 keypair (already set) |
| `EC2_HOST` / `EC2_SSH_KEY` | secret | deploy target (already set) |
| `PLATFORM_DB_DRIVER` | **variable** | `sqlite` before cutover, `postgres` after (§7) |

**`techit360ai-bit/ai-router`**

| Key | Value |
|---|---|
| `DATABASE_URL` | same RDS `techit_db` URL |
| `REDIS_URL` | same ElastiCache URL |
| `JWT_PUBLIC_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | already set |

## 6. How env reaches the box

The EC2 hosts are only reachable through the repo's deploy workflows (they hold
`EC2_SSH_KEY`), so provisioning is code, not manual SSH:

- `ops/ec2/platform.env` — committed, secret-free template for `backend/.env`.
- `ops/ec2/sync-env.mjs` — applies the template + CI secrets to `backend/.env`,
  derives the per-domain URLs from `PLATFORM_DATABASE_URL`, and flips the
  authority/source switches from `DB_DRIVER` so the cutover is atomic.
- `messaging-backend/ops/production.env` — the same for the Go service.

## 7. Cutover runbook (strict order)

1. **Secrets + variable** (§5) set; `PLATFORM_DB_DRIVER=sqlite`.
2. **Merge the ops PR.** The auto-deploy pipes the RDS URL + MCP contract into
   `backend/.env` but keeps the app on SQLite (`PLATFORM_DB_DRIVER=sqlite`).
   MCP activates immediately → `/api/mcp/health` must return **401** (anonymous).
3. **Backfill data (no downtime):**
   ```
   gh workflow run cutover-platform-postgres.yml -f mode=plan    # read-only
   gh workflow run cutover-platform-postgres.yml -f mode=apply   # migrate + backfill + verify
   ```
   `apply` must end with `"consistent": true`. Re-runnable safely.
4. **Flip the authority:** set `PLATFORM_DB_DRIVER=postgres` and re-run the
   backend deploy. `/ready` must report the Postgres authority.
5. **ai-router:** merge its PR → deploy provisions RDS/ElastiCache + https MCP
   URL, runs Alembic against RDS, and requires `/version` + `/ready` to pass.
6. **Messaging:** the EC2 workflow (gated on a green CI run) provisions
   `techit_msg`, copies the shared RS256 public key, sets `ENABLE_DEV_TOKEN=0`,
   and requires `/health` + `/ready` to pass.
7. **Verify the platform:** re-run the new-frontend smoke/drift gate.

## 8. Verification commands

```bash
curl -s https://backend.techitnetwork.com/health   # 200, sha == deployed
curl -s https://backend.techitnetwork.com/ready     # 200, jwt.keys true RS256
curl -so /dev/null -w '%{http_code}\n' https://backend.techitnetwork.com/api/mcp/health  # 401
curl -s https://api.techitnetwork.com/version       # 200, sha == deployed
curl -s https://api.techitnetwork.com/ready         # 200
curl -s https://messaging.techitnetwork.com/ready   # 200
```

## 9. Rollback + follow-ups

- **Instant rollback:** set `PLATFORM_DB_DRIVER=sqlite` and re-run the backend
  deploy. SQLite is retained at `SQLITE_DB_PATH=/home/ubuntu/backend-data/techit.db`
  and no data is destroyed by the backfill (it only upserts into RDS).
- **Hardening — pin the RDS CA (verify-full).** Today the platform uses
  `sslmode=require` (encrypted, no certificate pin), matching libpq/RDS defaults.
  To upgrade: install the AWS `global-bundle.pem` on the box, set
  `NODE_EXTRA_CA_CERTS`, and set `PLATFORM_DB_SSL_REJECT_UNAUTHORIZED=true`.
- **Rotate the RDS password** (it has been shared in plaintext) and update the
  `PLATFORM_DATABASE_URL` secret + both services.
- **Rotate `MCP_SECRET_KEY`** when connector credentials are imported into the
  vault (`MCP_SECRET_KEY_PREVIOUS` supports an overlap window).
