# TechIT Network Security Architecture Map

Date: 2026-09-08
Scope: `BACKEND` Node/Go services, `ai-router` FastAPI workers, `new-frontend` React/Vite application, and `techit-admin-dashboard`.

## Platform Components

| Component | Trust role | Primary controls | Authoritative data |
|---|---|---|---|
| Node backend | API and policy authority | JWT verification, persisted roles, object authorization, rate limits, audit events | PostgreSQL collections/domain tables |
| Messaging backend | Realtime transport | JWT/HS256 verification, workspace/channel scope, service isolation | PostgreSQL/Redis deployment state |
| AI Router | Untrusted reasoning/execution service | Backend execution grants, replay guard, rate limits, circuit breakers, provider limits | Router runtime plus backend settlement authority |
| MCP layer | Tool execution boundary | explicit opt-in, tool registry, approval state, encrypted secrets, audit log | PostgreSQL MCP store in production |
| New frontend | Presentation/client | route guards, authenticated API client, no authorization authority | none |
| Admin dashboard | Operations UI | backend admin authorization, audited corrective actions, restricted API token | backend operational events |
| PostgreSQL | Durable authority | transactions, RLS/domain predicates, versioned records, append-only events | users, roles, workspaces, finance, audit |
| Redis | Shared coordination | rate-limit buckets, replay keys, queues, circuit state | ephemeral coordination only |
| Object storage | Untrusted file persistence | private bucket, encryption, quarantine, malware scan, presigned access | file bytes and metadata |

## Trust Boundaries and Flows

1. Browser to backend: TLS, CORS allow-list, bearer token/cookie credential, request IDs, route authentication and authorization.
2. Backend to PostgreSQL: service credentials, transaction boundary, tenant predicates/RLS, audit event writes.
3. Backend to AI Router: authenticated user context plus short-lived execution grant; Router cannot mint grants or decide billing.
4. AI Router to providers: provider adapter allow-list, model/task policy, bounded tokens/cost, timeout and circuit breaker.
5. Backend to MCP: authenticated actor, tool registry policy, resource scope, approval for sensitive/destructive actions.
6. Browser to object storage: backend-issued short-lived presigned URL only after authorization and scan status.
7. Workers to queues/storage: least-privilege service identities, idempotent jobs, no browser credentials.

## Security Invariants

- Frontend state is advisory; backend authorization is authoritative.
- AI output, prompts, retrieved documents, and uploaded files are untrusted data.
- Credits are reserved before execution and settled exactly once by the backend.
- Similarity/vector ranking never bypasses tenant, workspace, owner, visibility, or classification predicates.
- Agents and MCP tools operate on explicit allow-lists with bounded resources and approvals.
- Secrets never appear in client bundles, logs, audit payloads, or AI prompts.

## Current Gaps Requiring Live Verification

- Replace shared HS256 platform tokens with asymmetric signing and JWKS.
- Move browser access tokens from `localStorage` to Secure/HttpOnly SameSite cookies with CSRF protection.
- Remove legacy WebSocket query-string credentials in coordinated client/server rollout.
- Verify PostgreSQL RLS policies, private networking, encrypted backups, restore, and failover in AWS.
- Verify vector metadata predicates against production pgvector/index configuration.
- Enable registry-backed dependency, secret, and container scanners in CI.
