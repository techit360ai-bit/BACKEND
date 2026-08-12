# Production deployment runbook

For deploying the TechIT platform (BACKEND + ai-router + new-frontend) to a hosted environment. This complements `new-frontend/DEPLOYMENT.md` (build-time env vars) by covering the operational steps: order, secrets, health checks, smoke tests, rollback.

> **Audience:** the on-call engineer / DevOps doing the deploy.
> **Time budget:** 30–45 min for a first deploy, 5–10 min for subsequent rollouts.
> **Assumes:** all four merge gates green, PRs reviewed, branches up to date.

---

## 0. Prerequisites (one-time setup)

| Item | Where | Notes |
|---|---|---|
| Node.js 22.12+ | runtime image | Required for BACKEND's built-in `node:sqlite` durable store and current frontend/tooling dependencies in the root lockfile. |
| Generated `JWT_SECRET` | secrets manager | 32-byte random hex. `python3 -c "import secrets; print(secrets.token_hex(32))"`. **Same value** for BACKEND/main, BACKEND/messaging-backend, ai-router, and Plugins-MCP — they all verify with it. |
| PostgreSQL 16 + pgvector | Cloud SQL / RDS / Supabase / self-hosted | ai-router uses pgvector. BACKEND/messaging-backend also uses PostgreSQL 16 for messaging/demo state. |
| Persistent disk for BACKEND SQLite | mounted volume | Required for Node auth/profile/notification/file metadata. Do not store it in the repository checkout or ephemeral container filesystem. |
| Redis 7 | Upstash / ElastiCache / self-hosted | ai-router Celery broker + Plugins-MCP cache, plus BACKEND/messaging-backend pub/sub and presence. Not needed by BACKEND/main. |
| `RESEND_API_KEY` | secrets manager | OTP and password-reset email (BACKEND/main only). Lazy-init since fix/lazy-resend-init (#5) — missing key no longer crashes boot, but email-sending endpoints require it. |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | secrets manager | ai-router only. Webhook signature is verified on every event. |
| LLM provider keys | secrets manager | At minimum `OPENAI_API_KEY` + `ANTHROPIC_API_KEY`. Optional: `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `COHERE_API_KEY`. ai-router only. |
| Domain + TLS for each service | DNS + ACM/Let's Encrypt | Four public hostnames typically: `api.<domain>` (BACKEND), `ai.<domain>` (ai-router), `messaging.<domain>` (Go messaging), `app.<domain>` (frontend). |

---

## 1. Deploy order (strict)

The platform has a **token-issuer → token-verifier** dependency chain. Deploy in this order, verify each before moving on:

### 1.1 BACKEND `main` (Node Express service)

Issues every platform JWT. Everything else verifies against it.

```bash
# build
cd BACKEND
npm install                              # hoists @techit/* workspaces
cd backend && npm run start              # node --import tsx src/index.js
```

Env vars:
```
JWT_SECRET=<32-byte hex>                 # required, no fallback
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://app.<domain>        # comma-separated browser origins
DB_DRIVER=sqlite
SQLITE_DB_PATH=/var/lib/techit/backend/techit.sqlite
RESEND_API_KEY=<resend key>              # optional at boot; required for /auth/send-otp
FROM_EMAIL="TechIT <noreply@yourdomain.com>"
FRONTEND_URL=https://app.<domain>        # used in password reset links
MCP_DATA_FILE=/var/lib/techit/plugins-mcp.json   # persistent volume; survives restarts
MCP_ALLOW_FILE_STORE=true                # explicit single-replica file-store acknowledgement
MCP_ALLOW_STUB_CONNECTORS=true           # demo connector bridge until real provider wiring lands
MCP_APPROVAL_TTL_MS=900000
```

Health check: `GET /` → `{"status":"TechIT API running"}` (200).

Env contract check before deploy:

```bash
cd BACKEND
NODE_ENV=production \
ENVIRONMENT=production \
PORT=3000 \
JWT_SECRET=<32-byte-hex-or-longer-shared-secret> \
CORS_ORIGINS=https://app.<domain> \
FRONTEND_URL=https://app.<domain> \
DB_DRIVER=sqlite \
SQLITE_DB_PATH=/var/lib/techit/backend/techit.sqlite \
RESEND_API_KEY=<resend key> \
FROM_EMAIL="TechIT <noreply@yourdomain.com>" \
MCP_DATA_FILE=/var/lib/techit/plugins-mcp.json \
MCP_ALLOW_FILE_STORE=true \
MCP_ALLOW_STUB_CONNECTORS=true \
MCP_APPROVAL_TTL_MS=900000 \
DATABASE_URL=postgres://...:5432/techit_msg \
REDIS_URL=redis://...:6379 \
ENABLE_DEV_TOKEN=0 \
npm run env:check
```

Migration check before start:

```bash
cd BACKEND/backend
SQLITE_DB_PATH=/var/lib/techit/backend/techit.sqlite npm run db:migrate:dry-run
SQLITE_DB_PATH=/var/lib/techit/backend/techit.sqlite npm run db:migrate
SQLITE_DB_PATH=/var/lib/techit/backend/techit.sqlite npm run db:rollback:dry-run
```

Backup and restore:

```bash
# backup
sqlite3 /var/lib/techit/backend/techit.sqlite ".backup '/backups/techit-backend-$(date +%Y%m%d%H%M%S).sqlite'"

# restore during maintenance window
systemctl stop techit-backend
cp /backups/<backup>.sqlite /var/lib/techit/backend/techit.sqlite
systemctl start techit-backend
```

Smoke test (1 min):
```bash
# request and verify an OTP, then create a real user with the proof token
curl -X POST https://api.<domain>/api/auth/send-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@x.test"}'

curl -X POST https://api.<domain>/api/auth/verify-otp \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@x.test","code":"<code-from-email>"}'
export EMAIL_VERIFICATION_TOKEN=...

curl -X POST https://api.<domain>/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@x.test","password":"hunter2!","firstName":"S","lastName":"T","emailVerificationToken":"'"$EMAIL_VERIFICATION_TOKEN"'"}'
# returns { token, user, profile }
export TOKEN=...

# verify the JWT round-trips through requireAuth
curl https://api.<domain>/api/auth/session -H "Authorization: Bearer $TOKEN"
# returns { user: { id, email, user_metadata } }

# verify the MCP gate also accepts the same token
curl https://api.<domain>/api/mcp/health -H "Authorization: Bearer $TOKEN"
# returns { ok: true, workspaceId: "ws-acme" }

# verify unauthenticated MCP is rejected
curl -o /dev/null -w '%{http_code}\n' https://api.<domain>/api/mcp/health
# 401
```

If `/api/mcp/health` returns 200 without a token, **stop and fix `resolveActor` wiring** before proceeding — that's a silent auth bypass on the plugin surface.

### 1.2 ai-router (Python FastAPI)

Verifies BACKEND-issued JWTs. Boot must come after BACKEND or its smoke test will fail.

```bash
cd ai-router
docker compose up -d postgres redis
docker compose run --rm migrate
docker compose up -d
```

Env vars (`docker-compose.yml` reads from shell env):
```
JWT_SECRET=<same value as BACKEND>       # required
ENVIRONMENT=production                    # gates the demo-auth refusal (C3)
ALLOW_DEMO_AUTH=false                     # MUST be false; service refuses to boot otherwise
DATABASE_URL=postgresql://techit:<pw>@<host>:5432/techit_db
REDIS_URL=redis://<host>:6379
OPENAI_API_KEY=<key>
ANTHROPIC_API_KEY=<key>
STRIPE_SECRET_KEY=<key>
STRIPE_WEBHOOK_SECRET=<key>
MCP_BASE_URL=https://api.<domain>/api/mcp   # so agents can invoke plugin tools
MCP_TIMEOUT=10
ALLOWED_ORIGINS=https://app.<domain>
SECRET_KEY=<same value as JWT_SECRET>     # legacy alias, harmless; remove once docs settle
```

Health check: `GET /health` → 200 with `{ status, agents, task_types, ... }`.

Smoke test:
```bash
# JWT issued by BACKEND must work here
curl https://ai.<domain>/api/v1/dashboard/intelligence \
  -H "Authorization: Bearer $TOKEN"
# 200 with dashboard JSON

# demo-auth must be off in prod
curl -o /dev/null -w '%{http_code}\n' https://ai.<domain>/api/v1/dashboard/intelligence
# 401, NOT 200 — if you see 200, ALLOW_DEMO_AUTH leaked through
```

If you see 200 without a token: ai-router booted in demo mode despite `ENVIRONMENT=production`. The startup guardrail should have prevented this — investigate before letting any user touch the platform.

### 1.3 BACKEND `messaging-backend/` (Go messaging)

Same `JWT_SECRET` again. Can deploy in parallel with ai-router; just must be after BACKEND/main.

```bash
cd BACKEND/messaging-backend
go build -o server ./cmd/server
./server
```

Env vars:
```
JWT_SECRET=<same value as BACKEND/main>
ENVIRONMENT=production
DATABASE_URL=postgres://...:5432/techit_msg
REDIS_URL=redis://...:6379
LIVEKIT_API_KEY=<optional>
LIVEKIT_API_SECRET=<optional>
LIVEKIT_URL=wss://<livekit-host>
CORS_ORIGINS=https://app.<domain>
PORT=8080
ENABLE_DEV_TOKEN=0
```

Migration check before start:

```bash
cd BACKEND/messaging-backend
DATABASE_URL=postgres://...:5432/techit_msg go run ./cmd/migrate -mode=dry-run
DATABASE_URL=postgres://...:5432/techit_msg go run ./cmd/migrate -mode=apply
```

Health check: `GET /health` → 200.

Smoke test:
```bash
curl https://messaging.<domain>/api/v1/conversations \
  -H "Authorization: Bearer $TOKEN"
# 200 with [] or list

# WebSocket auth via query string — token MUST verify with shared secret
wscat -c "wss://messaging.<domain>/ws?token=$TOKEN"
# upgrades successfully; ping/pong works
```

### 1.4 new-frontend (Vite SPA)

```bash
cd new-frontend
VITE_API_URL=https://api.<domain>/api \
VITE_API_BASE_URL=https://ai.<domain> \
VITE_TECHIT_API=https://api.<domain>/api/mcp \
VITE_MESSAGING_BASE_URL=https://messaging.<domain> \
VITE_MESSAGING_WS_URL=wss://messaging.<domain>/ws \
  npm run build
# deploy dist/ to your CDN / static host
```

End-to-end smoke (do this in a real browser, not curl):
1. Navigate to `https://app.<domain>` → sign up → check inbox → enter OTP → land on dashboard.
2. Open DevTools network tab; confirm calls to `api.<domain>`, `ai.<domain>`, `messaging.<domain>` all return 2xx with the same Bearer token.
3. Navigate to `/plugins` → list of GitHub tools renders (proves `/api/mcp/tools` is reachable from the browser).

---

## 2. Rollback

Each service rolls back independently — the JWT contract is the only cross-service coupling and it's append-only (claim shape additions are safe).

**Order to roll back:** the reverse of deploy. Frontend first (cheapest, fixes most user-facing issues), then ai-router, then BACKEND/messaging, then BACKEND/main.

**JWT-secret rotation rollback:** if you rotated `JWT_SECRET` and one service didn't pick it up, every signed-in user will 401. Restore the old value across **all four services** simultaneously, or accept the forced sign-out and complete the rotation.

---

## 2.1 Observability checks

Every BACKEND response includes an `X-Request-Id` header. Operators should copy that value from failed browser/API calls and search service logs for the same request ID.

When `LOG_REQUESTS=1` is enabled, successful requests emit structured `http_request` JSON logs with `requestId`, `method`, `path`, `statusCode`, and `durationMs`. Unhandled errors emit structured `http_error` JSON logs with the same `requestId`; production logs omit stack traces.

Before promoting a release, make one authenticated request with a known `X-Request-Id`, then confirm the response header and log record match. If request IDs or structured logs are missing, stop the rollout because incident diagnosis will be impaired.

---

## 3. Common issues and diagnosis

| Symptom | Likely cause | Fix |
|---|---|---|
| BACKEND/main exits at boot with `JWT_SECRET environment variable is required` | env var not set | Set it. No fallback by design (#1, was `'fallback_secret_change_in_production'`). |
| BACKEND/main exits with `DB_DRIVER=json is not allowed in production` | production is configured for the development JSON fixture | Set `DB_DRIVER=sqlite` and `SQLITE_DB_PATH` to a persistent volume. |
| BACKEND/main exits with `SQLITE_DB_PATH is required` | production SQLite path omitted | Set `SQLITE_DB_PATH=/var/lib/techit/backend/techit.sqlite` or equivalent persistent path. |
| BACKEND/main cannot send OTP or password-reset emails | `RESEND_API_KEY` missing or invalid | Set it. Other endpoints unaffected (#5 lazy-init). |
| ai-router exits at boot with `ALLOW_DEMO_AUTH=true is forbidden in ENVIRONMENT=production` | demo-auth left on by accident | Set `ALLOW_DEMO_AUTH=false` or unset it. C3 guardrail. |
| ai-router 200s on unauthenticated requests in prod | demo-auth fallback active despite ENVIRONMENT | Verify both `ENVIRONMENT` and `ALLOW_DEMO_AUTH` env are set in the running container, not just the docker-compose template. |
| BACKEND/messaging-backend exits with `ENABLE_DEV_TOKEN=1 is forbidden in production` | local smoke-test token endpoint enabled in prod | Set `ENABLE_DEV_TOKEN=0` or unset it. |
| Frontend logs `401` on every call after a deploy | mismatched `JWT_SECRET` between BACKEND and ai-router/messaging | Compare secret values across services; **same string everywhere**. |
| `/api/mcp/tools` returns 401 | client not forwarding Bearer, or JWT didn't include the verified actor shape | Inspect `Authorization` header; verify `resolveActor` in `backend/src/app.js` returns non-null for valid tokens. |
| Audit log empty after restart | `MCP_DATA_FILE` not on a persistent volume | Point it at a real mount (e.g. `/var/lib/techit/plugins-mcp.json`); F3 file-store reads on boot. |
| Frontend shows React error on `/plugins` | `VITE_TECHIT_API` not set at build time | Rebuild with the env var; Vite inlines it at build, not runtime. |

---

## 4. Smoke-test cheat sheet (paste into a shell)

```bash
DOMAIN=yourdomain.com
EMAIL=smoke-$(date +%s)@x.test

# 1. signup → token
TOKEN=$(curl -sS -X POST https://api.$DOMAIN/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"hunter2!hunter2!\",\"firstName\":\"S\",\"lastName\":\"T\",\"otpVerified\":true}" \
  | jq -r .token)
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { echo FAIL signup; exit 1; }

# 2. four services accept the same token
for url in \
  "https://api.$DOMAIN/api/auth/session" \
  "https://api.$DOMAIN/api/users/me" \
  "https://api.$DOMAIN/api/mcp/health" \
  "https://ai.$DOMAIN/api/v1/dashboard/intelligence" \
  "https://messaging.$DOMAIN/api/v1/conversations"
do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$url" -H "Authorization: Bearer $TOKEN")
  echo "$code  $url"
  [ "$code" -ge 200 ] && [ "$code" -lt 300 ] || { echo FAIL "$url"; exit 1; }
done

# 3. unauthenticated requests are rejected
for url in \
  "https://api.$DOMAIN/api/auth/session" \
  "https://api.$DOMAIN/api/mcp/health" \
  "https://ai.$DOMAIN/api/v1/dashboard/intelligence"
do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$url")
  echo "$code  $url (no token)"
  [ "$code" = "401" ] || { echo FAIL "expected 401 from $url"; exit 1; }
done

echo "ALL GREEN"
```

If this cheat sheet exits non-zero, **do not flip DNS to the new deploy.** Roll back to the previous green deploy and diagnose with the table above.

---

## 5. Known soft spots (worth tightening before scale)

These are open hardening items as of 2026-06-21 — not deploy blockers, but log them in your tracker:

- **No rate limit on `/api/auth/signin` or `/api/auth/send-otp`** (security sweep A1, finding #3) — facilitates brute force / OTP enumeration. Add `express-rate-limit` (5/min for signin, 3/10min for send-otp per IP).
- **ai-router reads `credits_remaining` + `team_size` from JWT claims** (sweep A1, #1, HIGH) — if the issuer is ever compromised, attacker can fabricate paywall bypass. Hydrate from `users` table keyed by `sub` instead.
- **Plugins-MCP file-store has a ~1–5ms write race** (sweep A1, #2) — concurrent `/api/mcp/invoke` calls can lose audit rows. Migrate to SQLite or add a write lock before scaling horizontally.
- **Plugins-MCP hardcodes `WS = 'ws-acme'`** as the workspaceId (sweep A1, #10) — fine while single-tenant; lift to env var or per-user claim when multi-tenant lands.

---

## 6. Resumption protocol (for the next engineer)

Same as the cross-repo alignment plan — read in order:
1. `docs/CROSS-REPO-ALIGNMENT-PLAN.md` (branch `plan/cross-repo-alignment`) for *why* the architecture looks the way it does.
2. This file for *how to deploy* it.
3. `new-frontend/DEPLOYMENT.md` for the four `VITE_*` env vars at build time.

The merged commits referenced by ID throughout (C1–C12, F1–F3, PR #5, #11, #23) are findable via `git log --grep='C2:'` etc.
# AI usage reservation and settlement

The platform backend is the commercial authority for both capped subscriptions
and PAYG credits. Before calling the AI Router, issue a reservation-backed grant
through `POST /internal/usage-settlement/grant`. After execution, the Router
submits signed facts to `POST /internal/usage-settlement/settle`.

Required environment variables:

- `AI_ROUTER_SETTLEMENT_SECRET` — shared HMAC secret, at least 32 characters.
- `AI_ROUTER_SERVICE_ID` — defaults to `ai-router`.
- `AI_ROUTER_SETTLEMENT_MAX_SKEW_SECONDS` — defaults to 300.
- `AI_USAGE_GRANT_SERVICE_ID` — trusted backend orchestrator identity.
- `AI_USAGE_GRANT_SERVICE_SECRET` — separate HMAC key for reservation/grant issuance.
- `AI_EXECUTION_GRANT_SECRET` — signs short-lived Router execution grants.
- `AI_EXECUTION_GRANT_ISSUER` — defaults to `techit-backend`.
- `AI_EXECUTION_GRANT_AUDIENCE` — defaults to `techit-ai-router`.

Subscription reservations consume the active subscription allowance only.
PAYG reservations consume wallet credits only. The caller must explicitly
authorize PAYG overage; the backend never silently switches funding sources.
Settlement is idempotent by request ID, releases failed reservations, and
rejects conflicting replay payloads.

The Router settlement credential can only submit facts and read settlement
health. It cannot reserve credits or issue execution grants. The trusted
backend caller that authenticates the user, selects the explicit funding
source and derives the reserved units must use the separate grant-issuer key.
