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

## Inventory note — 2026-09-28 (WS-17 sweep)

The WS-17 sweep confirmed a methodology point that the matrix must reflect:
**authorization scoping in this codebase happens at the service boundary, not inline
in the controller.** A controller-level grep for `param === req.user.id` produces
false positives (`supportController`, `investorIntelligenceController`,
`codeWorkspaceController` all forward `req.user.id` into owner-scoped service calls
and had zero inline comparisons). Controller files must therefore be cleared by
reading each service signature, not by grep.

- `domainController` ownership is enforced by the `*Owned` service primitives and
  `workspaceAccess`; locked by four cross-user tests.
- `codeWorkspaceController` binds the VS Code bridge token to one `workspaceId` and
  its granted permission.
- `admin.js` mounts `requireAdminAuth` + `requireAdmin`/`requireSuperAdmin` on every
  route except the rate-limited `/login`; locked by 23 enumerated denial tests.
