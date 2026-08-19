# Trust and Capability Production Runbook

## Persistence

Run `TRUST_DATABASE_URL=... npm run trust:db:migrate --prefix backend` before deploying the Backend release. The migration creates normalized PostgreSQL tables for roles, verification evidence, organizations, risk, capability policies, authorization audits, consumption, and analytics. With `TRUST_DATABASE_URL` configured, startup migrates and continuously projects the authoritative trust state into PostgreSQL; the existing collection store remains a compatibility cache for legacy services during the rollout.

## Evidence storage

Configure an S3-compatible private bucket with `EVIDENCE_STORAGE_*`. The API only issues short-lived signed PUT/GET URLs. Evidence is private by default, size/type constrained, signature checked, hashed, and unavailable until scanning succeeds.

Configure ClamAV using `CLAMAV_HOST` and `CLAMAV_PORT`. Production startup fails closed when storage or scanning is not configured.

## MFA

Configure `MFA_ENCRYPTION_KEY` and `MFA_ASSERTION_SECRET`. Users enroll through `/api/authorization/mfa/enroll` and verify through `/api/authorization/mfa/verify`. The client sends the returned assertion as `x-mfa-assertion` for high-risk capabilities.

## Billing and entitlements

Capability checks remain read-only. Action routes opt into idempotent capability consumption with `requireCapability(..., { consume: true })`; consumption reserves through the existing usage settlement contract and settles or releases when the response completes.

Plan records may expose capability entitlements as `entitlements[capability]`. An explicit `false` denies that capability even when the subscription is active.

## Operations

Schedule `POST /api/authorization/admin/reverification-notifications/run` daily. Monitor `GET /api/authorization/admin/analytics` for verification requests, denials, completions, releases, and capability conversion. AI evidence analysis remains advisory and cannot authorize access.
