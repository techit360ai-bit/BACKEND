# TechIT Network Threat Model

## Assets

Identity/session credentials, role and organization membership state, workspace code and files, investor deal-room data, trust/evidence records, vector/RAG content, AI provider credentials and spend, wallet/credits/settlement records, payment events, admin actions, audit logs, and deployment secrets.

## Actors

Unauthenticated users, Explorer, Founder, Collaborator, Investor, Organization member/administrator, Admin, AI agent, MCP tool, malicious uploaded document, compromised provider, and compromised operator account.

## Threat Register

| Finding | Severity | Attack scenario | Existing protection | Gap/status | Test evidence |
|---|---|---|---|---|---|
| Stale or forged role claims | HIGH | User changes JWT role to reach investor/admin route | Persisted role derivation and admin store lookup | Continue asymmetric token migration | auth/authorization tests pass |
| Cross-tenant object access | CRITICAL | User A requests User B workspace/org/deal object ID | Route/service ownership and membership checks; PostgreSQL predicates | Production RLS and full endpoint matrix require live verification | domain, deal-room, organization tests |
| Token theft from browser storage | HIGH | XSS or malicious extension reads localStorage token | HttpOnly cookie mode in production; bearer retained for mobile/test compatibility | Complete deployment-wide cookie rollout | frontend/client tests |
| AI grant replay | HIGH | Reuse a valid execution grant to spend credits twice | Replay guard, idempotency, reservation settlement | Redis-backed production verification pending | execution/settlement tests |
| Prompt injection | HIGH | Uploaded/retrieved content instructs agent to exfiltrate or invoke tools | AI is not billing authority; tool policies and grants | Add systematic content isolation tests per task | router execution tests |
| Malicious upload | HIGH | Polyglot/archive or spoofed MIME file reaches parser | Size/extension/content checks, private storage, malware scan | Production scanner/storage configuration pending | file storage tests |
| SSRF | HIGH | URL import targets metadata service/private host | Shared safeFetch blocks private/metadata hosts, schemes, redirects | Apply safeFetch to every outbound integration and run DNS-rebind tests | unit coverage for validator |
| MCP destructive action | HIGH | Agent invokes delete/transfer tool without approval | Explicit MCP opt-in, registry, approvals, audit | Production connector review pending | MCP tests |
| Credit race/double spend | CRITICAL | Concurrent reservations or webhook retries duplicate balance | PostgreSQL transaction/advisory lock path, idempotency keys | Live concurrency test pending | unit tests; RDS unavailable |
| Secret exposure | CRITICAL | Credential committed or logged | env-driven secrets, redacted audit patterns | Rotate credentials and enable secret scanning | CI configuration required |

Risk acceptance requires implementation plus test/configuration evidence; code presence alone is insufficient.

## Register update — 2026-09-28

| Finding | Status change |
|---|---|
| Cross-tenant object access | Horizontal authorization locked at the service boundary for domain, code-workspace and admin surfaces (WS-17/WS-18, `e1218ee`). Live RLS still required. |
| Token theft from browser storage | The SPA no longer writes the access token to web storage (`0a65cce`); it is memory-only, with the HttpOnly cookie as the durable session. Full deployment rollout still required. |
| Prompt injection / agent exposure | ai-router agent and workspace responses are now explicit allow-lists with no internal cost/provider fields (WS-15, `3ee57e7`). |
| (new) Cross-origin messaging disclosure | The messaging service emitted no CORS headers, which blocked all browser feed/DM calls; a credentialed exact-origin CORS policy and per-caller limiter now apply (WS-16, `64a7a86`). |
