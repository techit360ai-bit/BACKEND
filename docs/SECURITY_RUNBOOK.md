# Security Runbook

Before deployment: run unit/security tests, dependency and secret scans,
container scan, route inventory, PostgreSQL migration/verification, RLS checks,
and configuration validation. Confirm production demo-auth, stub connectors,
file stores, wildcard CORS, and SQLite are disabled.

During operation: monitor auth failures, policy denials, AI spend/rate limits,
settlement mismatches, malware/SSRF blocks, database health, and audit-log
delivery. Use the incident response procedures for containment and credential
rotation.

Rollback is flag-driven and event-replay based. Do not reverse-copy arbitrary
production writes into SQLite or disable authorization to restore availability.
