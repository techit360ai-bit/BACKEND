# TechIT Explorer and Multi-Role Implementation Plan

## Scope

This is a compatibility-first extension of the current TechIT platform. It preserves authentication, existing role dashboards, role-specific data, trust and capability authorization, discovery, messaging, organizations, workspaces, and AI execution.

The implementation establishes Explorer as the base account experience, allows one identity to activate several specialized roles, and makes the active role/resource context a server-authoritative platform contract.

Wallet, subscriptions, and billing are not part of this delivery. Existing collections and funding hooks are treated as incomplete scaffolding. This work only leaves stable context identifiers that a separate billing implementation can consume later.

## Architecture Audit

### Current Identity and Authentication

- `users` is the credential identity record.
- `profiles` stores global identity fields plus the legacy primary `role`, `secondaryRoles`, onboarding state, and role-specific compatibility fields.
- Persistent device sessions, rotating hashed refresh tokens, session-bound access tokens, and revocation already exist.
- JWT role claims are compatibility hints. Backend middleware reloads profile role state before authorization.
- Several authentication fallbacks still default to `founder`; these must become Explorer-safe.

### Current Roles and Authorization

- Signup currently accepts one of Founder, Collaborator, Investor, or Organisation.
- `profiles.role` remains the primary compatibility field.
- `profiles.secondaryRoles` and `userRoles` already represent partial multi-role support.
- Trust verification owns progressive role activation and role-specific assurance.
- Capability authorization is centralized and deterministic in Backend.
- Route and role guards still contain single-role assumptions.

### Current Context

- `profiles.activeRole` is already read by authorization middleware when present.
- `contextService` currently provides returning-user state, checkpoints, and role state machines.
- It does not yet provide a durable active role, organization, workspace, and resource selection contract.
- Frontend role menus infer current role from the URL and navigate without persisting an authoritative context.

### Current Explorer Surface

- Feed, discovery, messaging, opportunities, profiles, notifications, and shared learning components already exist.
- Discovery already normalizes `user` and `explorer` as base roles.
- Explorer does not yet have a complete route, navigation shell, onboarding path, profile state, or role activation experience.

### Current Organizations and Workspaces

- Organization membership and verification models already exist in the trust system.
- Workspaces and workspace membership already exist in domain collections and APIs.
- Context authorization must reuse ownership/membership data rather than duplicate it.

### Current AI Boundary

- Backend owns deterministic scoring, eligibility, authorization, persistence, and credit reservation scaffolding.
- AI Router owns provider execution, prompt construction, safety, output validation, and advisory inference.
- AI Router currently models Founder, Collaborator, Investor, Admin, and Accelerator Manager but not Explorer or Organization as first-class contextual roles.
- Active context must be validated by Backend before it is forwarded to AI Router.

### Current Billing and Wallet Status

- Collection names, read models, and capability funding hooks exist.
- They are not considered a complete production wallet, subscription, or billing implementation.
- This project will not add plans, balances, charging, settlement, payment flows, or billing authorization.
- Usage/context analytics may include nullable `roleId`, `contextId`, `workspaceId`, and `organizationId` for future attribution.

## Current to Target Mapping

| Current | Classification | Target |
| --- | --- | --- |
| `users` | KEEP | Stable account identity |
| `profiles` global fields | KEEP | Global identity profile |
| `profiles.role` | DEPRECATE GRADUALLY | Compatibility primary role mirror |
| `profiles.secondaryRoles` | ADAPT | Compatibility projection of active assignments |
| `userRoles` | EXTEND | Canonical role assignments with lifecycle and primary status |
| `profiles.activeRole` | ADAPT | Compatibility mirror of canonical active context |
| `contextService` checkpoints | KEEP | Returning-user continuity alongside active context |
| role dashboards | KEEP | Existing implementations selected by active context |
| URL-derived role switching | REFACTOR | Backend-authorized context switching |
| capability policies | EXTEND | Context-aware deterministic authorization |
| Feed/Discovery | EXTEND | Explorer home and shared discovery surface |
| AI `UserContext` | EXTEND | Explorer/Organization plus validated context identifiers |
| wallet/subscription hooks | DEFER | Separate billing project integration contract |

## Target Contracts

### Role Assignment

Each account always has base Explorer access. Specialized roles are stored as assignments:

```text
id
userId
role
status: PENDING | PENDING_VERIFICATION | ACTIVE | SUSPENDED | REVOKED
isPrimary
verificationStatus
activatedAt
suspendedAt
deactivatedAt
createdAt
updatedAt
```

The legacy profile role remains synchronized during migration so existing consumers keep working.

### Active Context

```text
id
userId
role
roleAssignmentId
organizationId?
workspaceId?
resourceType?
resourceId?
status
startedAt
lastActiveAt
updatedAt
```

The backend validates role assignment status and resource membership/ownership before accepting a context switch.

### Explorer

- Explorer is always available to authenticated, non-restricted accounts.
- It is represented as the base context, not a verification-gated specialized role.
- Explorer can use shared Feed, discovery, messages where allowed, events/hackathons, learning, opportunities, profiles, follows, saves, and AI guidance.
- Explorer cannot access specialized management or sensitive role capabilities.

## Backend API Plan

```text
GET  /context/active
GET  /context/available
POST /context/switch
POST /context/touch

GET  /roles
GET  /roles/assignments
POST /roles/activate
POST /roles/:role/deactivate
```

Existing trust activation endpoints remain valid. New endpoints delegate to the same role records and assurance data rather than creating another role service.

Session responses will include:

```text
roles
roleAssignments
activeContext
availableContexts
```

## Migration Strategy

1. Add active-context and role-history collections plus normalized PostgreSQL tables.
2. Backfill every account with implicit Explorer access.
3. Convert each legacy primary role into an active primary role assignment.
4. Convert valid secondary roles into active secondary assignments.
5. Initialize active context from `activeRole`, then legacy primary role, then Explorer.
6. Preserve onboarding, verification, profile, organization, workspace, and role data.
7. Keep legacy role fields synchronized during the compatibility window.
8. Make migrations idempotent and safe for repeated deployment.

## Implementation Phases

### Phase 1: Audit and Compatibility Design

- Record the architecture map in this document.
- Inventory single-role assumptions and classify them as keep, adapt, refactor, or gradual deprecation.
- Confirm non-goals and backward-compatibility constraints.

### Phase 2: Data and Domain Foundation

- Extend role assignments with lifecycle, primary designation, and timestamps.
- Add active contexts, context history, and role history.
- Add SQLite collection migration and normalized PostgreSQL migration.
- Add idempotent legacy-user backfill.

### Phase 3: Deterministic Backend Services

- Add canonical role normalization and Explorer base access.
- Add available-context resolution.
- Validate role, organization, workspace, and resource context deterministically.
- Add activation, switching, deactivation, and context-touch operations.
- Audit all transitions.

### Phase 4: Authentication and Authorization Integration

- Remove Founder as the default for new or incomplete identities.
- Issue sessions with the backend-resolved active role/context.
- Hydrate request identity with canonical role assignments and active context.
- Keep legacy JWT/profile consumers compatible.
- Enforce role status and context membership server-side.

### Phase 5: Explorer Backend Experience

- Register Explorer-safe capability policies.
- Make discovery, Feed, profiles, follows/saves, learning, public opportunities, and permitted messaging available to Explorer.
- Reject specialized APIs when Explorer has not activated the required role.
- Add explainable, dismissible, rate-limited deterministic role-intent recommendations using existing behavior signals.

### Phase 6: Frontend Identity and Context Layer

- Extend auth types with Explorer, role assignments, and active context.
- Add a global context provider backed by Backend APIs.
- Replace URL-only role inference with server-authoritative context state while retaining route compatibility.
- Add a reusable desktop/mobile context switcher.

### Phase 7: Explorer Product Experience

- Add Explorer as the default signup path.
- Preserve direct specialized-role onboarding.
- Reuse Feed and discovery as the Explorer home.
- Add Explorer navigation for Feed, Discover, Messages, Events/Hackathons, Learning, Opportunities, AI Guide, and Profile.
- Add a non-blocking role activation surface.

### Phase 8: Existing Dashboard Integration

- Connect Founder, Collaborator, Investor, and Organization shells to active context.
- Preserve their routes, pages, data, and onboarding.
- Validate deep links and fall back to a safe role/context destination.
- Prevent cross-context private-data leakage.

### Phase 9: AI Context Integration

- Add Explorer and Organization to AI Router context enums.
- Accept validated active role, assignment, workspace, organization, resource, objective, permissions, and entitlements metadata.
- Keep all permissions and role activation decisions in Backend.
- Treat AI role-intent results as advisory only.

### Phase 10: Analytics and Future Billing Contract

- Add role/context dimensions to role activation, switching, discovery, and AI usage events.
- Track conversion and dismissal events.
- Add nullable context attribution fields for future billing integration.
- Do not implement balances, plans, charging, or subscription enforcement.

### Phase 11: Verification

- Test existing role login, onboarding, dashboards, workspaces, discovery, authorization, and sessions.
- Test Explorer signup and long-term use.
- Test role activation and switching combinations.
- Test suspended/revoked roles and unauthorized context IDs.
- Test cross-role data isolation and frontend manipulation.
- Run backend, frontend, Plugins-MCP, and AI Router suites plus frontend build/lint.

### Phase 12: Delivery

- Commit changes by repository and logical phase.
- Pull/rebase only through non-destructive workflows.
- Push feature branches.
- Create normal pull requests.
- Merge only after required checks pass; do not use administrator bypass.

## Security Rules

- Backend is authoritative for identity, role assignment, active context, capabilities, membership, and resource access.
- Explorer is not a shortcut around specialized-role authorization.
- Client-provided role/context identifiers are untrusted input.
- Suspended or revoked specialized roles lose only their role-specific capabilities unless the account is restricted.
- Context switching never broadens permissions.
- Private role data is not merged into the global profile.
- AI output never activates roles or grants capabilities.
- Context and role transitions are auditable.

## Definition of Done

- Existing users retain access and data.
- Every authenticated account has Explorer access.
- New users can choose Explorer or direct role onboarding.
- One identity can activate multiple specialized roles.
- Active role/resource context is persisted and server-validated.
- Existing dashboards run unchanged inside the new context layer.
- Explorer has a complete reusable experience.
- Backend rejects role/context privilege escalation.
- AI receives validated context but cannot authorize.
- Billing is neither implemented nor required by this feature.
- Tests demonstrate backward compatibility and cross-context isolation.
