# Data Classification

| Class | Examples | Required handling |
|---|---|---|
| PUBLIC | Published profiles, public discovery cards, public opportunities | Backend visibility predicate; integrity protection |
| INTERNAL | Non-sensitive activity, aggregate analytics, operational status | Authenticated access; least-privilege service access |
| CONFIDENTIAL | Workspace files, support cases, org operations, investor notes | Tenant scope, encryption in transit/at rest, audit access |
| HIGHLY_CONFIDENTIAL | Password hashes, MFA secrets, provider/database/payment keys, deal-room evidence, wallet ledger | KMS/Secrets Manager, strict IAM, redaction, immutable audit, retention/deletion controls |

Vector metadata inherits the highest classification of its source and must
include owner, organization, workspace, resource, visibility, and policy tags.
