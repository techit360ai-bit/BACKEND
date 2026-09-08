# Incident Response

## Detect

Alert on authentication anomalies, authorization denials, impossible travel,
MFA failures, secret access, SSRF blocks, malware detections, prompt-injection
signals, MCP policy denials, credit reconciliation mismatches, webhook replay,
and database/RLS errors.

## Contain

Revoke sessions and grants; disable affected accounts/connectors; activate the
AI kill switch; pause billing fulfillment; quarantine files; block indicators
at WAF/API gateway; preserve immutable audit and provider logs.

## Eradicate and Recover

Rotate exposed credentials, patch and redeploy from a reviewed commit, restore
from a verified backup if required, reconcile wallet/settlement ledgers, replay
idempotent events, and validate tenant isolation before reopening traffic.

## Review

Record timeline, root cause, affected tenants/data, control failures, tests
added, notification obligations, and follow-up owners. Run quarterly tabletop
exercises and an annual independent penetration test.
