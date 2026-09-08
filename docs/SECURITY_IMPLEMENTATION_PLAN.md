# Security Implementation Plan

## Completed baseline

Existing backend, Router, MCP, upload, session, authorization, credit, and
deployment hardening was mapped and retained. PostgreSQL authority and audit
boundaries are documented.

## Implemented in this wave

- Production RS256/EdDSA JWT key requirements with shared verification helper.
- HttpOnly auth/refresh cookies, CSRF double-submit protection, and production
  browser-token suppression.
- MFA enforcement for high-risk capabilities and production admin access.
- Discovery vector scope columns and mandatory actor/tenant predicates.
- Central `safeFetch` URL and private-address validation primitive.
- Container-only code execution adapter that fails closed without a sandbox.
- Security event collection, TSPS history, and admin event endpoint.
- Endpoint inventory enforcement metadata and cross-repository CI scan gates.

## Priority 1

Distribute rotated public keys through JWKS, complete coordinated client
rollout, and verify the isolated executor and vector predicates in production.

## Priority 2

Enable registry-backed npm/pip/Go/container/secret scans, immutable centralized
security events, alert routing, admin Security Center posture views, and TSPS
trend storage using the existing admin dashboard and audit/event systems.

## Priority 3

Run production tenant-isolation, concurrency, failover, restore, rollback,
malware, prompt-injection, MCP approval, and provider-kill-switch drills.

## Release gate

Critical findings block deployment. High findings require explicit risk
acceptance by the security owner. No OWASP certification claim is implied.
