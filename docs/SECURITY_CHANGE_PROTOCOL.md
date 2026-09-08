# Security Change Protocol

Every future platform change touching auth, roles, organization/workspace
scope, APIs, AI prompts/tools/RAG, files, code execution, wallet/credits,
secrets, infrastructure, or logging must include:

1. The affected trust boundary and assets.
2. The existing control being extended; no duplicate auth, AI routing, wallet,
   authorization, or audit system.
3. A threat/failure mode and severity.
4. Backend enforcement and a regression test for allow and deny cases.
5. Configuration/secret changes with redaction and rotation notes.
6. Updates to the relevant matrix/runbook and deployment gate.

Pull requests must pass the repository security policy check, unit tests,
dependency/secret checks, and required review from the owning team. A finding
is not closed by code presence alone; it requires implementation plus test,
configuration, or verified runtime evidence.
