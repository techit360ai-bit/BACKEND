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
| Token theft from browser storage | HIGH | XSS or malicious extension reads localStorage token | Frontend route guards and backend token validation | Cookie/CSRF migration pending | client tests only |
| AI grant replay | HIGH | Reuse a valid execution grant to spend credits twice | Replay guard, idempotency, reservation settlement | Redis-backed production verification pending | execution/settlement tests |
| Prompt injection | HIGH | Uploaded/retrieved content instructs agent to exfiltrate or invoke tools | AI is not billing authority; tool policies and grants | Add systematic content isolation tests per task | router execution tests |
| Malicious upload | HIGH | Polyglot/archive or spoofed MIME file reaches parser | Size/extension/content checks, private storage, malware scan | Production scanner/storage configuration pending | file storage tests |
| SSRF | HIGH | URL import targets metadata service/private host | Provider-specific fetch validation exists in selected paths | Central outbound client and DNS-rebind tests pending | partial |
| MCP destructive action | HIGH | Agent invokes delete/transfer tool without approval | Explicit MCP opt-in, registry, approvals, audit | Production connector review pending | MCP tests |
| Credit race/double spend | CRITICAL | Concurrent reservations or webhook retries duplicate balance | PostgreSQL transaction/advisory lock path, idempotency keys | Live concurrency test pending | unit tests; RDS unavailable |
| Secret exposure | CRITICAL | Credential committed or logged | env-driven secrets, redacted audit patterns | Rotate credentials and enable secret scanning | CI configuration required |

Risk acceptance requires implementation plus test/configuration evidence; code presence alone is insufficient.
