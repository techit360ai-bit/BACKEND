# TechIT Security Posture Score (TSPS)

The backend endpoint `GET /api/admin/security/posture` calculates a defensive
posture score from identity, authorization, API, AI, data, infrastructure,
supply-chain, monitoring, and incident-readiness evidence. It is an internal
operational indicator, not a certification.

Scores are accompanied by domain scores, severity-ranked findings,
implementation status, test status, and recommended remediation. Production
configuration findings intentionally reduce the score until verified.

## Hardening status — 2026-09-28

Recorded on branch `security/exposure-hardening-2026-09-26`; see
`PLATFORM_SECURITY_IMPLEMENTATION_PLAN_2026-09-26.md` §12 and
`PLATFORM_SECURITY_AUDIT_2026-09-26.md` §13–15 for the full evidence chain.

- **WS-10** (`1750c09`) — every Node and ai-router response is `private, no-store`;
  the browser resilience cache is account-scoped and purged on account change
  (`560bf89` in `new-frontend`).
- **WS-15** (`3ee57e7` in `ai-router`) — internal AI cost/provider fields removed
  from agent and workspace responses; projections allow-listed.
- **WS-17/WS-18** (`e1218ee`) — admin surface denial (23 route tests) and
  service-boundary ownership isolation (domain + code-bridge tests) locked.
- **WS-16** (`64a7a86`) — Go 1.26.8 built locally; messaging CORS, per-caller rate
  limiter and WebSocket origin allow-list added and tested. This also fixed the SPA
  feed/DM failure caused by the missing CORS headers.
- **Suspended** — WS-20 DevTools acceptance still needs a reachable staging
  environment; the messaging `/ws?token=` frontend contract flip needs DNS.
