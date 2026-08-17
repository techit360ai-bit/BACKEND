# Dependency assurance policy

Dependency updates are proposals and must pass repository evidence before merge.

## Required evidence

- Reproducible install from committed lock or checksum files.
- Existing unit, integration, type, lint, build, and migration gates.
- Dependency review with high and critical findings rejected.
- Ecosystem vulnerability audit, Trivy scan, CodeQL, and an SBOM.
- Manual review for major, runtime, database, authentication, payment, AI, and messaging updates.
- A migration and rollback note when APIs, schemas, runtimes, or production behavior can change.

## Update classes

- Patch: may be merged after all required checks and review.
- Minor: may be merged after checks; high-risk packages require explicit review.
- Major: must be replaced by an engineer-led migration PR.
- Unknown provenance, unexpected registry, prohibited license, or suspicious install script: reject.

## Release and rollback

Dependency changes deploy through staging or the repository release-candidate process first. Monitor errors, latency, authentication, database health, and service startup. Stop rollout and restore the previous known-good commit or image when thresholds regress. Database changes must use backward-compatible expand/contract migrations and a tested rollback or restore procedure.

## Direct pushes

Production branches accept changes through pull requests. The Direct Push Audit marks commits without a merged PR as invalid release candidates. Server-side rejection is additionally enabled through GitHub branch protection where the repository plan supports it.

