# Security Implementation Plan

## Completed baseline

Existing backend, Router, MCP, upload, session, authorization, credit, and
deployment hardening was mapped and retained. PostgreSQL authority and audit
boundaries are documented.

## Priority 1

Move platform tokens to EdDSA/RS256 with JWKS; migrate browser credentials to
HttpOnly cookies plus CSRF; finish RAG metadata predicates; centralize outbound
HTTP/SSRF validation; and verify code execution isolation in AWS.

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
