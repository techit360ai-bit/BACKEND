# TechIT Platform Security Audit

Date: 2026-08-13

## Scope

Reviewed the Node backend, Go messaging service, Plugins-MCP, AI Router,
frontend authentication flow, uploads, GitHub OAuth, AI usage settlement,
runtime configuration, container configuration, and representative tests.

No application can be guaranteed unhackable or beyond breach. The practical
goal is strong prevention, rapid detection, minimal privileges and blast
radius, encrypted data, tested recovery, and short credential lifetimes.

## Confirmed findings and fixes applied

### Critical: predictable default super-admin credentials

The backend could create a super-admin using source-code defaults. Defaults
were removed. Bootstrap now requires explicit environment values and rejects a
password shorter than 14 characters. Admin routes now authenticate against the
active admin store instead of accepting a normal-user token carrying an admin
role claim.

### High: authorization trusted stale JWT role claims

Backend authorization now derives roles and workspace scope from persisted
profiles. A token whose role disagrees with current backend state is rejected
and must be refreshed. JWT verification is pinned to HS256.

### High: GitHub OAuth tokens stored in plaintext

New GitHub tokens are encrypted with AES-256-GCM before persistence. OAuth
states expire after ten minutes and are single-use. Production must configure
`GITHUB_TOKEN_ENCRYPTION_KEY`. Existing plaintext tokens require reconnection
or a one-time encrypted migration before deployment.

### High: unrestricted and potentially public founder uploads

AI Router uploads now have a 10 MiB default limit, extension/content-type
allow-lists, document-only restrictions for incubation analysis, private
presigned URLs, and server-side object encryption. Production refuses local
temporary storage or missing object-storage credentials.

### High: production AI execution could run without backend grants

Production and staging runtime validation now require
`REQUIRE_AI_EXECUTION_GRANT=true`, preserving the backend authorization and
usage-reservation boundary.

### High: production MCP allowed file persistence and stub connectors

File-backed MCP approvals/audit data and stub connectors are now forbidden in
production and staging. Demo audit seed events are opt-in in development only.
A transactional shared datastore remains required before live MCP deployment.

### Medium: OTPs stored in plaintext or offline-brute-forceable form

New OTP records store a keyed HMAC using `OTP_HASH_SECRET`, so a stolen database
alone is insufficient to brute-force the six-digit code. Legacy plaintext and
unkeyed SHA-256 records remain temporarily readable for a rolling deployment
and are removed after use or expiry.

### Medium: password-reset endpoint accepted weak passwords

Reset passwords now enforce the same minimum length as normal password changes.

### Medium: browser and container hardening gaps

Backend and Router responses now include baseline browser security headers.
Router containers run as a non-root user. Docker production paths no longer
use source bind mounts or Uvicorn reload mode. Messaging JWT verification is
pinned specifically to HS256, and wildcard production CORS is rejected.

### High: production deployment contract enabled forbidden MCP demo paths

The production runbook and CI environment contract still instructed operators
to enable MCP file persistence and stub connectors even though runtime now
rejects them. The contract, examples and smoke tests now require
`MCP_ENABLED=false`, disable demo/file-store flags, and expect MCP routes to be
unavailable until a shared transactional datastore and real connectors exist.

### Medium: GitHub OAuth state replay window

OAuth state was removed only in memory before the outbound token exchange, so
concurrent callbacks could reuse it. State consumption is now persisted before
the external request. Test-only OAuth behavior is limited to `NODE_ENV=test`,
and production rejects placeholder GitHub OAuth configuration.

### Medium: resource-exhaustion and upload spoofing gaps

Backend JSON bodies are now bounded. Router upload reads are capped before the
entire multipart object is loaded, file extension/content-type combinations are
validated, and PDF/image signatures are checked before storage or parsing.
Production Docker Compose no longer publishes PostgreSQL, Redis, or Flower and
no longer bind-mounts scheduler source code.

### Medium: admin and OTP hardening gaps

Admin login now has a dedicated brute-force limit and all newly created/reset
admin passwords require at least 14 characters. OTP digest comparison uses a
constant-time equality check. Router admin endpoints now return HTTP 403 for
non-admin users instead of embedding an error in a successful response.

### High: missing persisted identity could fail open

The backend and Router could retain default or JWT-supplied roles when the
persisted user/profile record was absent. Production authentication now fails
closed when the backend profile is missing or Router identity hydration cannot
prove that the user exists.

### Medium: grant and settlement input integrity

Execution-grant model and token limits are now normalized and bounded before
signing. Settlement idempotency hashes use canonical key ordering, preventing
semantically identical JSON with different property order from being treated
as conflicting replays.

## Required live-deployment work

1. Replace shared HS256 user tokens with asymmetric signing (`EdDSA` or
   `RS256`), short-lived access tokens, rotating refresh tokens, issuer and
   audience validation, key IDs, and a published JWKS endpoint.
2. Move browser access tokens out of `localStorage` into `Secure`, `HttpOnly`,
   `SameSite` cookies. Add CSRF protection for mutating requests.
3. Remove WebSocket tokens from URLs after client migration; use a secure
   cookie or an ephemeral one-time socket ticket.
4. Store GitHub and provider credentials in KMS/Secrets Manager. Rotate all
   previously exposed credentials and reconnect existing GitHub accounts.
5. Use private object storage with block-public-access, KMS encryption,
   malware scanning, quarantine, retention limits, deletion workflows and
   tenant-scoped object keys.
6. Replace SQLite/JSON and the MCP file store with managed PostgreSQL. Apply
   row-level tenant authorization, encrypted backups, point-in-time recovery,
   restore drills and separate credentials per service.
7. Put API, Router and messaging behind a WAF/API gateway with TLS 1.2+, DDoS
   protection, request-size limits, route-specific rate limits and bot controls.
8. Restrict databases, Redis, worker dashboards and internal settlement routes
   to private networks. Do not expose PostgreSQL, Redis or Flower publicly.
9. Enable centralized immutable audit logs, security alerts, anomaly detection,
   secret-access alerts and settlement reconciliation alarms.
10. Add dependency and container scanning in CI: Dependabot/Renovate, npm
    audit, pip-audit, govulncheck, Trivy/Grype, Semgrep/CodeQL and secret scans.
11. Establish incident response: credential-revocation runbooks, breach
    containment, user notification, forensic log retention, quarterly tabletop
    exercises and annual external penetration tests.
12. Enforce least-privilege cloud IAM, separate production/staging accounts,
    MFA/passkeys for operators, protected branches, signed commits/releases,
    required reviews and deployment approvals.

## Residual risks

- Frontend JWTs remain in `localStorage` until the coordinated cookie migration.
- User JWT signing remains a shared symmetric secret across services.
- Legacy WebSocket clients may still send tokens in query strings.
- GitHub token encryption requires live configuration and reconnection/migration.
- MCP cannot be deployed to production until its shared transactional datastore
  implementation replaces the file store.
- External dependency advisory checks were not completed during this audit
  because registry DNS was unavailable; CI must run them with network access.
- Go formatting and unit tests passed using the repository's Go 1.23 container
  image; database-backed integration tests still require the CI service stack.

## Automated security maintenance added

Dependabot now monitors npm, Go modules, Python dependencies and GitHub Actions
across the three repositories. Scheduled and pull-request CodeQL workflows were
added for JavaScript/TypeScript, Go and Python. Registry advisory checks and
container-image scanning still need network-enabled CI steps. CodeQL currently
runs extraction and queries with SARIF upload disabled because GitHub's private
repository security-events integration rejected the upload; enable upload after
repository code-scanning permissions are configured.
