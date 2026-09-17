# OWASP Control Mapping

| Baseline | TechIT control/evidence | Residual work |
|---|---|---|
| OWASP Top 10 2025 A01 Broken Access Control | Persisted role/context checks, workspace/org/deal predicates, admin middleware, PostgreSQL authority bridge | Complete live RLS and endpoint deny matrix |
| A02 Security Misconfiguration | Production config validation, disabled demo/MCP/file-store paths, security headers | Validate AWS deployment values |
| A03 Supply Chain | Dependabot, CodeQL/dependency workflows, lockfiles | Enable registry and container scanners with network access |
| A04 Cryptographic Failures | bcrypt, HMAC OTP, encrypted connector tokens, TLS configuration | Asymmetric JWT/JWKS, KMS verification |
| A05 Injection | bounded inputs, parameterized SQL, upload validation | Central SSRF/outbound client and fuzzing |
| A06 Insecure Design | capability policies, grant/reserve/settle flow, approval boundaries | Complete abuse-case drills |
| A07 Authentication Failures | session binding, rotation/revocation, MFA hooks, brute-force limits | Cookie migration and stronger operator auth |
| A08 Software/Data Integrity | immutable audit chains, idempotency keys, versioned platform records | Verify restore/replay in AWS |
| A09 Logging/Monitoring | auth/authorization/finance/AI/admin events and posture endpoint | Central immutable sink and alert routing |
| A10 Mishandling Exceptions | fail-closed production config, bounded errors, no secret logging | Verify gateway/WAF error policy |
| OWASP API Security Top 10 | Shared auth, capability checks, ownership predicates, rate limits, webhook signatures | Generated endpoint matrix must be reviewed per route change |
| OWASP GenAI/LLM Top 10 | untrusted prompt/RAG model, grants, tool registry, spend/rate limits, output boundaries | Prompt-injection corpus and RAG tenant tests |
| ASVS 5.0 | Security headers, session controls, validation, auditability, deployment gates | Formal requirement-by-requirement verification |
