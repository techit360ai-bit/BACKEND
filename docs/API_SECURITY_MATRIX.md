# API Security Matrix

The backend exposes approximately 450 route declarations across auth, users,
domain/workspaces, discovery, intelligence, trust, authorization, support,
academy, code, TVCE, billing, files, and MCP. Route modules apply shared
authentication middleware; sensitive controllers additionally invoke capability
and resource-scope checks.

## Required Endpoint Contract

| Dimension | Required evidence |
|---|---|
| Method/path | Route declaration and OpenAPI/inventory output |
| Authentication | `requireAuth`, `requireAdminAuth`, or explicit service HMAC |
| Role/assurance | Capability policy or role middleware |
| Resource scope | owner/workspace/organization/deal predicate |
| Validation | bounded body/query/path parser |
| Rate limit | global plus route-specific limiter for auth/OTP/AI/settlement |
| Audit | auth, authorization, financial, admin, export, or destructive event |
| Error behavior | no credential/tenant existence leakage |

## Mandatory Regression Cases

BOLA across users/workspaces/organizations; property-level role fields;
function-level admin endpoints; expired/revoked tokens; replayed idempotency
keys; excessive AI consumption; SSRF/private URL attempts; malformed uploads;
webhook signature/replay; and unauthorized MCP/RAG access.

The generated route inventory must be refreshed whenever a route module changes.
