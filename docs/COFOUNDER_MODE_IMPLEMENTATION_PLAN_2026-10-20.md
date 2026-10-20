# TechIT Network — Co-founder Mode Implementation Plan

**Date:** 2026-10-20

**Status:** Architecture audit and implementation plan. No runtime code has been changed by this document.

## 1. Core Decision

Implement Co-founder Mode as a relationship-scoped extension of the existing TechIT platform.

- A co-founder is not a new platform role.
- A collaborator is not automatically a co-founder after being selected, invited, or added to a workspace.
- Only an `ACTIVE` formal co-founder relationship exposes Co-founder Mode.
- The Founder Dashboard remains the single command center for founders.
- No standalone `/cofounder-dashboard` is created.
- The same relationship-scoped experience is exposed to the other party through the existing collaborator dashboard and the existing Workspace architecture.
- Existing behavior remains unchanged for founders and collaborators without an active relationship.

## 2. Architecture Audit

| Existing component | Reuse? | Decision |
|---|---|---|
| Founder Dashboard — `new-frontend/frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx` | Yes | Add conditional `<CoFounderMode />`; do not create another dashboard. |
| Founder layout and routing — `FounderLayout.tsx`, `App.tsx` | Yes | Preserve current navigation. Open relationship workspaces through the existing Workspaces layout. |
| Collaborator dashboard — `dashboard/collaborators/section/components/collab/Dashboard.tsx` | Yes | Add a relationship card for an active co-founder; otherwise render unchanged. |
| Collaborator selection — `dashboard/matchResults.tsx` | Yes | Add relationship type selection and requirement builder without changing the default collaborator flow. |
| Discovery engine — `BACKEND/backend/src/services/discoveryService.js` | Yes | Add a `relationshipType: "co_founder"` branch and configurable scoring profile. |
| Recommendation intelligence — `recommendationIntelligenceService.js` | Yes | Preserve existing collaborator responses and map co-founder results into the existing recommendation contract. |
| Client-side matching fallback — `lib/collaborationMatching.ts` | Limited | Keep for legacy collaborator matching only. Never use client-side ranking for co-founder scores. |
| Workspace — `domainService.js`, `WorkspacesLayout`, `MainLayout.tsx` | Yes | Provision a relationship-scoped workspace using existing workspace records, members, tasks, reports, and routes. |
| Workspace members — `workspaceMembers` | Yes | Extend memberships with relationship metadata; do not create a second membership model. |
| Roles — `profiles.role`, multi-role context | Yes | No `co_founder` platform role. Co-founder status is a relationship state and permission scope. |
| Ventures/projects — `projects` | Yes | Use the existing project/venture ID. |
| Tasks — `workspaceTasks` | Yes | Reuse the existing task collection in the relationship workspace. |
| Objectives — no canonical product objective model found | No | Create the minimal `cofounderObjectives` collection. |
| Milestones — `milestones`, Trust milestone service | Yes | Link or publish venture milestones. Co-founder-private milestones remain inside objectives and are not exposed through investor/generic milestone surfaces. |
| Execution tracking — `Plugins-MCP/server/techit-service.ts` | Yes | Read the existing execution projection. |
| Execution Reputation Graph — `executionIntelligenceService.js` | Yes | Compose its existing output into the co-founder evidence view. |
| Trust Engine — `trustAuthorityAsync.js`, `trustVerificationAuthority.js` | Yes | Reuse canonical trust proofs and scoring. |
| Verification and evidence — identity, GitHub, LinkedIn, trust proofs | Yes | Compose claimed, verified, and observed evidence without creating a second verification system. |
| Notifications — `notificationController.js` | Yes | Reuse the notification store and add co-founder notification metadata/deep links. |
| Messaging/DM — `BACKEND/messaging-backend` | Yes | Link to existing messaging. No second communication system. |
| Permissions — `capabilityAuthorization.js`, `requireAuth` | Partial | Add capabilities, plus a dedicated relationship-membership guard on every resource. |
| Investor/Data Room — `investorDealRoomService.js` | Yes | Expose only an explicitly approved investor team summary through existing deal-room authorization. |
| Activity feeds | Partial | Keep relationship activity relationship-scoped. Publish only explicitly approved updates through the existing feed. |
| Existing relationship edges — `networkEdges`, `entityRelationships` | No | These are recommendation/social edges, not a formal lifecycle. Create a minimal relationship model. |
| Profile data — public/private profile APIs | Yes | Extend profiles with optional co-founder experience and matching preferences. |
| AI router | Limited | Optional narrative explanation only. It cannot calculate, rank, or override co-founder scores. |

## 3. Relationship Lifecycle

Use one canonical lifecycle record from invitation through termination. Do not create a separate invitation table plus relationship table.

```text
CANDIDATE
    |
    v
INVITED
    |
    v
DISCUSSION
    |
    v
MUTUAL_INTEREST
    |
    v
DUE_DILIGENCE
    |
    v
COFOUNDER_PROPOSAL
    |
    v
ACCEPTED
    |
    v
ACTIVE
```

Additional states:

```text
DECLINED
WITHDRAWN
PAUSED
ENDED
```

Rules:

- `accept-discussion` creates `DISCUSSION`, not Co-founder Mode.
- `MUTUAL_INTEREST` requires explicit interest from both parties.
- `accept-proposal` is candidate-only.
- `ACCEPTED` is transient.
- Proposal acceptance provisions the relationship workspace, memberships, responsibilities, notifications, and audit activity in one transaction, then sets `ACTIVE`.
- `PAUSED` and `ENDED` immediately remove Co-founder Mode and private workspace access.
- Ending never deletes historical execution evidence or relationship history.
- Re-inviting after `ENDED` creates a new relationship record.

## 4. Visibility Model

| Layer | Access |
|---|---|
| `SHARED` | Both relationship parties. |
| `PERSONAL` | The owning party only. |
| `RESTRICTED` | Explicit permission grant only. No implicit access for collaborators, investors, organizations, or administrators. |
| Investor summary | Derived only from explicitly approved venture-level facts. |

The private relationship activity stream is not automatically published to the public feed.

## 5. User Context and Routing

The server resolves user context from the authenticated session and active context. Client-supplied role, venture, relationship, or workspace IDs are never sufficient authorization.

| User state | Entry point |
|---|---|
| Founder without active relationship | `/founder/dashboard` remains unchanged. |
| Founder with active relationship | Existing dashboard receives `<CoFounderMode />`. |
| Co-founder with collaborator platform role | Existing `/collaborator/dashboard` receives a relationship card. |
| Both relationship parties | `/workspaces/cofounder/:relationshipId` inside the existing `WorkspacesLayout`. |
| Invitee before activation | `/cofounder-invitations/:invitationId`, authenticated and invitee-scoped. |
| Unauthorized user | No surface; backend returns `403`/`404`. |
| Investor | Approved team summary through the existing deal room only. |

No `/cofounder-dashboard` route is created.

## 6. Co-founder Requirements

Extend the existing collaborator-selection flow with a relationship type selector:

```text
Co-founder
Core Team Member
Project Collaborator
Specialist
Advisor/Mentor
```

Selecting `Co-founder` activates additional requirements:

- Role type: technical, product, growth, marketing, operations, finance, AI/data, industry/domain, other.
- Commitment: full-time, part-time, transitioning to full-time, flexible.
- Venture stage: idea, validation, MVP, early revenue, growth.
- Ownership responsibilities.
- Required skills from the existing skill system.
- Experience requirements.
- Founder compatibility expectations: vision, risk tolerance, working style, communication, time commitment, decision style, long-term ambition, timezone compatibility, contribution expectations, and equity discussion preference.
- Equity percentages are not required at this stage.

Compatibility inputs must be structured and explicit. Do not infer psychological characteristics.

## 7. Deterministic Co-founder Matching

Extend the existing deterministic discovery branch:

```text
relationshipType = "co_founder"
ventureId / projectId
requirementId + requirementVersion
```

Suggested configurable scoring profile, versioned as `cofounder-fit-v1`:

| Dimension | Initial weight |
|---|---:|
| Capability fit | 22% |
| Skill complementarity | 12% |
| Venture-stage fit | 10% |
| Commitment compatibility | 12% |
| Experience | 8% |
| Vision alignment | 8% |
| Working-style compatibility | 5% |
| Risk compatibility | 4% |
| Geographic/time compatibility | 4% |
| Execution reputation | 7% |
| Trust/verification | 5% |
| Industry/domain fit | 3% |

Rules:

- Scores are computed by the backend.
- Missing compatibility data is reported as missing evidence and is never imputed.
- Every result includes confidence.
- Ties break deterministically by candidate ID.
- Cache keys include relationship type, venture ID, requirement version, and policy version.
- Existing collaborator matching remains unchanged.
- AI narrative cannot change the score, rank, or recommended candidate.
- “Recommended candidate” is based on the highest deterministic score with an evidence explanation.
- Co-founder discovery excludes self, existing active relationships, ineligible candidates, and candidates outside the permitted privacy scope.

## 8. Co-founder Card and Comparison

Extend the existing recommendation card instead of creating a separate visual system.

The card should display:

- Potential co-founder role.
- Overall co-founder fit and confidence.
- Strongest capability and complementarity dimensions.
- Claimed, verified, and observed evidence.
- Commitment and availability.
- Vision, working style, and risk alignment when evidence exists.
- Factual potential concerns.
- Actions: view profile, compare, invite to co-founder discussion.

The comparison view uses the API-provided deterministic breakdown. Do not generate opaque AI scoring claims.

## 9. Invitation and Activation

Invitation payload:

- Venture.
- Candidate.
- Proposed role.
- Responsibilities.
- Expected commitment.
- Venture stage.
- Initial working period.
- Equity discussion status, normally “to be discussed”.

Candidate actions:

```text
Accept Discussion
Request Changes
Decline
```

Accepting the discussion does not activate the relationship.

After proposal acceptance, the server performs one transaction:

1. Verify the relationship is in `COFOUNDER_PROPOSAL`.
2. Verify the actor is the invited candidate.
3. Set `acceptedAt`.
4. Provision or link the relationship-scoped workspace.
5. Add both parties as relationship workspace members.
6. Create agreed responsibilities.
7. Create the activation activity record and notifications.
8. Set `status = ACTIVE` and `activatedAt`.

Failure rolls the transaction back to the proposal state. Retries use an idempotency key.

## 10. Workspace Architecture

Use the existing Workspace backend with a relationship-scoped workspace instance:

- `workspaces.kind = "cofounder"`
- `workspaces.cofounderRelationshipId`
- `workspaces.projectId` references the venture.
- Membership is limited to the two relationship parties.
- No normal venture collaborator is automatically added.

This avoids duplicating the Workspace backend and prevents private co-founder tasks from leaking through the ordinary venture workspace.

Workspace sections:

```text
Overview
Objectives
Responsibilities
Tasks
Milestones
Decisions
Documents
Activity
Communication
Evidence
```

Tasks use the existing `/api/domain/workspaces/:workspaceId/tasks` APIs. Relationship-scoped task rows may carry:

- `cofounderRelationshipId`
- `visibilityLayer`
- owner/assignee metadata

Personal tasks must be filtered server-side; UI hiding is not sufficient.

## 11. Objectives, Responsibilities, and Decisions

### Responsibilities

Each responsibility records:

- Relationship.
- Owner.
- Responsibility area.
- Description.
- Status.
- Optional objective/task/evidence links.

Responsibilities must be capable of producing objectives, tasks, milestones, evidence, contribution signals, and reputation signals.

### Objectives

Each objective supports:

- Owner and co-owner.
- Responsibility link.
- Deadline.
- Progress.
- Linked tasks.
- Milestones.
- Evidence.
- Status.
- Visibility layer.

Co-founder-private milestones remain in the co-founder objective. Venture-visible milestones may be explicitly published to the existing `milestones` collection.

### Decisions

V1 is intentionally lightweight:

- Title and description.
- Proposer.
- Open, approved, rejected, discussion requested, or withdrawn.
- Participant responses.
- Resolution reason and timestamp.
- Visibility layer.

Decision history remains available to authorized relationship parties.

## 12. Alignment and Relationship Health

Alignment and health are deterministic, evidence-based projections.

Suggested health components:

| Component | Weight | Evidence |
|---|---:|---|
| Execution alignment | 30% | On-time responsibility/task completion. |
| Goal alignment | 25% | Shared objective progress and overdue count. |
| Contribution | 15% | Evidence-weighted completed work against agreed ownership. |
| Communication | 15% | Observable response/activity cadence and unresolved discussion age. |
| Decision alignment | 15% | Resolved versus stale decisions and agreement history. |

Rules:

- Every metric includes confidence and evidence references.
- Missing evidence returns “insufficient evidence”, not a fabricated score.
- Vision alignment comes only from explicit structured answers from both parties.
- Never infer sensitive psychological traits.
- Friction messages use neutral language and point to observable data.
- Do not state that a relationship is failing.

Example neutral message:

```text
Potential friction detected.
Decision alignment has declined over the last 30 days.
Consider reviewing the unresolved product decisions.
```

## 13. Execution, Trust, and Evidence

Reuse the canonical Trust Engine and Execution Reputation Graph.

The co-founder evidence view separates:

```text
Claimed
Verified
Observed
```

Examples:

- GitHub: verified trust proof.
- LinkedIn: verified trust proof.
- Previous project: verified evidence where available.
- TechIT milestones: observed execution.
- TechIT collaboration: observed execution.

Do not create an isolated reputation engine or trust formula. The evidence endpoint composes existing trust and execution services for an authorized relationship party.

## 14. Notifications, Feed, and Messaging

### Notifications

Reuse the existing notification store. Use one `cofounder` type and metadata containing:

- `relationshipId`
- notification kind
- safe deep link

Do not create a second notification system.

### Feed

Relationship activity is stored in the relationship-scoped activity collection.

V1 does not add user-targeted private feed audiences. The current messaging backend audience model is role-based, not relationship-membership-aware. Therefore:

- Private co-founder activity never enters the public feed automatically.
- An explicit “Share update” action may create a normal approved team/public feed post through the existing messaging API.
- Shared content must not include private notes, equity discussions, or restricted relationship data.

A future `CO_FOUNDER_ONLY` audience requires server-side relationship membership checks in the messaging service and is deferred.

### Messaging

Link to existing direct messaging. Do not create another messaging system.

## 15. Profile Extension

Extend the existing profile:

- Optional co-founder matching preferences.
- Current co-founder experience.
- Previous co-founder experience.
- Display only according to relationship and privacy permissions.

Do not create a separate co-founder profile.

## 16. Investor/Data Room Integration

Private co-founder data is never exposed automatically.

The venture may explicitly publish a curated summary containing:

- Team roles and titles.
- Approved team strengths.
- Verified team evidence.
- Completed milestone count.
- Verified contributor count.
- Execution consistency.

The summary is stored as `cofounderTeamSummaries` with approval audit metadata. It is exposed only through existing deal-room permissions.

## 17. Data Model

Use the existing `platform_collection_records` persistence pattern. No new normalized relational tables are required for V1.

New collections:

```text
cofounderRequirements
cofounderRelationships
cofounderResponsibilities
cofounderObjectives
cofounderDecisions
cofounderActivity
cofounderAlignmentSnapshots
cofounderTeamSummaries
```

### `cofounderRelationships`

Canonical fields:

```text
id
founderId
cofounderId
ventureId / projectId
workspaceId
roleTitle
responsibilities
commitment
proposedTerms
status
version
invitedAt
discussionAcceptedAt
proposedAt
acceptedAt
activatedAt
pausedAt
endedAt
endReason
createdAt
updatedAt
```

The relationship row is also the invitation record while pre-`ACTIVE`.

### `cofounderRequirements`

```text
id
ventureId / projectId
founderId
relationshipType
roleType
responsibilities
requiredSkills
experience
commitment
compatibility
status
version
createdAt
updatedAt
```

### `cofounderResponsibilities`

```text
id
relationshipId
ventureId
ownerId
title
description
areas
status
version
```

### `cofounderObjectives`

```text
id
relationshipId
ventureId
title
description
kind
ownerId
coOwnerIds
responsibilityId
dueDate
progress
status
visibilityLayer
publishedMilestoneId
version
```

### `cofounderDecisions`

```text
id
relationshipId
ventureId
title
description
proposedBy
status
responses
deadline
resolvedAt
resolutionReason
visibilityLayer
version
```

### `cofounderActivity`

```text
id
relationshipId
ventureId
actorId
visibilityLayer
type
summary
entityType
entityId
sanitizedMetadata
createdAt
```

### `cofounderAlignmentSnapshots`

```text
id
relationshipId
snapshotDate
metrics
overall
confidence
policyVersion
evidenceReferences
createdAt
```

### `cofounderTeamSummaries`

```text
id
ventureId
sourceRelationshipIds
approvedBy
approvedAt
payload
version
```

Database safety:

- Add collections to `INITIAL` in `BACKEND/backend/src/config/database.js`.
- Add idempotent SQLite up/down migrations that seed/remove collection names.
- Add a PostgreSQL partial unique index preventing duplicate non-ended relationships for the same `(projectId, founderId, cofounderId)`.
- Do not backfill existing collaborators.
- Do not infer co-founder status from team size, workspace membership, prior collaboration, or the legacy AI-router `has_cofounder` field.
- Preserve historical rows after `ENDED`.

## 18. API Design

### Matching

```text
GET /api/discovery/recommendations?relationshipType=co_founder&ventureId=...
GET /api/recommendation-intelligence/founders/:projectId/collaborators
    ?relationshipType=co_founder&requirementId=...
```

### Feature and requirements

```text
GET /api/cofounder/capabilities
GET /api/cofounder/ventures/:ventureId/requirements
PUT /api/cofounder/ventures/:ventureId/requirements
```

### Invitations and lifecycle

```text
POST /api/cofounder/invitations
GET  /api/cofounder/invitations
GET  /api/cofounder/invitations/:id
POST /api/cofounder/invitations/:id/accept-discussion
POST /api/cofounder/invitations/:id/request-changes
POST /api/cofounder/invitations/:id/decline
POST /api/cofounder/invitations/:id/withdraw
POST /api/cofounder/invitations/:id/advance
POST /api/cofounder/invitations/:id/accept-proposal
```

### Relationships and workspace

```text
GET  /api/cofounder/ventures/:ventureId/mode
GET  /api/cofounder/relationships
GET  /api/cofounder/relationships/:id
GET  /api/cofounder/relationships/:id/workspace
POST /api/cofounder/relationships/:id/pause
POST /api/cofounder/relationships/:id/resume
POST /api/cofounder/relationships/:id/end
```

### Responsibilities and objectives

```text
GET   /api/cofounder/relationships/:id/responsibilities
POST  /api/cofounder/relationships/:id/responsibilities
PATCH /api/cofounder/responsibilities/:responsibilityId

GET   /api/cofounder/relationships/:id/objectives
POST  /api/cofounder/relationships/:id/objectives
PATCH /api/cofounder/objectives/:objectiveId
```

### Decisions and activity

```text
GET  /api/cofounder/relationships/:id/decisions
POST /api/cofounder/relationships/:id/decisions
POST /api/cofounder/decisions/:decisionId/respond

GET  /api/cofounder/relationships/:id/activity
```

### Health, evidence, and investor summary

```text
GET /api/cofounder/relationships/:id/health
GET /api/cofounder/relationships/:id/evidence

PUT /api/cofounder/ventures/:ventureId/investor-team-summary
GET /api/investor-deals/:dealId/team-summary
```

### Existing task APIs

```text
/api/domain/workspaces/:workspaceId/tasks
```

These are reused with relationship-scoped task visibility enforcement.

API rules:

- Validate relationship membership, status, resource ownership, and visibility on every request.
- Return `404` for resources the caller cannot see.
- Return `409` for invalid lifecycle transitions.
- Use optimistic `version` checks.
- Use idempotency keys for invitation creation, proposal acceptance, and activation.
- Never expose private fields in generic dashboard, profile, feed, trust, or investor responses.

## 19. Files To Modify

### Backend

```text
BACKEND/backend/src/config/database.js
BACKEND/backend/src/config/runtimeConfig.js
BACKEND/backend/.env.example
BACKEND/backend/src/services/discoveryService.js
BACKEND/backend/src/services/discoveryInfrastructure.js
BACKEND/backend/src/repositories/discoveryRepository.js
BACKEND/backend/src/controllers/discoveryController.js
BACKEND/backend/src/controllers/recommendationIntelligenceController.js
BACKEND/backend/src/services/recommendationIntelligenceService.js
BACKEND/backend/src/services/domainService.js
BACKEND/backend/src/controllers/domainController.js
BACKEND/backend/src/controllers/notificationController.js
BACKEND/backend/src/services/investorDealRoomService.js
BACKEND/backend/src/routes/investorDealRoom.js
BACKEND/backend/src/app.js
```

### Frontend

```text
new-frontend/frontend/src/App.tsx
new-frontend/frontend/src/dashboard/founders/section/components/founder/Dashboard.tsx
new-frontend/frontend/src/dashboard/collaborators/section/components/collab/Dashboard.tsx
new-frontend/frontend/src/dashboard/matchResults.tsx
new-frontend/frontend/src/lib/api/recommendationIntelligence.ts
new-frontend/frontend/src/lib/api/users.ts
new-frontend/frontend/src/lib/api/notifications.ts
new-frontend/frontend/src/dashboard/feed/pages/NotificationsPage.tsx
Existing founder/collaborator profile components
```

## 20. Files To Create

### Backend

```text
BACKEND/backend/src/repositories/cofounderRepository.js
BACKEND/backend/src/services/cofounderRelationshipService.js
BACKEND/backend/src/services/cofounderIntelligenceService.js
BACKEND/backend/src/middlewares/cofounderAccess.js
BACKEND/backend/src/controllers/cofounderController.js
BACKEND/backend/src/routes/cofounder.js
BACKEND/backend/migrations/sqlite/012_cofounder_mode.up.sql
BACKEND/backend/migrations/sqlite/012_cofounder_mode.down.sql
BACKEND/backend/migrations/postgres/022_cofounder_mode.sql
```

### Frontend

```text
new-frontend/frontend/src/lib/api/cofounder.ts
new-frontend/frontend/src/dashboard/_shared/cofounder/types.ts
new-frontend/frontend/src/dashboard/_shared/cofounder/CoFounderMode.tsx
new-frontend/frontend/src/dashboard/_shared/cofounder/CoFounderRelationshipCard.tsx
new-frontend/frontend/src/dashboard/_shared/cofounder/CoFounderWorkspace.tsx
new-frontend/frontend/src/dashboard/_shared/cofounder/CoFounderInvitationPage.tsx
new-frontend/frontend/src/dashboard/_shared/cofounder/CoFounderRequirementBuilder.tsx
new-frontend/frontend/src/dashboard/_shared/cofounder/CoFounderComparison.tsx
new-frontend/frontend/src/dashboard/_shared/cofounder/DecisionCenter.tsx
new-frontend/frontend/src/dashboard/_shared/cofounder/RelationshipHealthCard.tsx
new-frontend/frontend/src/dashboard/_shared/cofounder/ExecutionEvidencePanel.tsx
```

## 21. Permissions

Add capabilities such as:

```text
cofounder.relationship.view
cofounder.relationship.manage
cofounder.objective.view
cofounder.objective.create
cofounder.task.assign
cofounder.decision.create
cofounder.decision.respond
cofounder.evidence.view
cofounder.activity.view
cofounder.investor.summary.publish
```

Add a server-side relationship guard that verifies:

1. Authenticated session.
2. Feature enabled.
3. Relationship exists.
4. Caller is a relationship party.
5. Required status for the operation.
6. Relationship owns the requested venture, project, workspace, objective, decision, task, or evidence resource.
7. Requested visibility layer is permitted.

| Actor | Access |
|---|---|
| Founder party | Full active relationship access, subject to visibility layer. |
| Co-founder party | Same shared access; personal data only for self. |
| Other collaborator | No co-founder relationship data. |
| Investor | Only approved investor team summary through the deal room. |
| Organization | No private co-founder data. |
| Explorer | No access. |
| Unauthorized user | Backend `404`/`403`, even with guessed IDs. |
| Administrator | No implicit bypass; any break-glass access must be separately permissioned and audited. |

## 22. Frontend Implementation

- Insert `<CoFounderMode />` into the founder dashboard only when the mode API returns an active relationship.
- Insert `<CoFounderRelationshipCard />` into the collaborator dashboard for an active co-founder.
- Add relationship-type selection to `matchResults.tsx`, defaulting to the existing collaborator behavior.
- Add the requirement builder, match card, comparison breakdown, concerns, and invitation action.
- Add invitation pages with `Accept Discussion`, `Request Changes`, and `Decline`.
- Add the relationship workspace under the existing Workspaces layout.
- Add status-aware empty states: no relationship, pending invitation, discussion, paused, ended.
- Load the mode summary first and details progressively.
- Keep screens responsive and bound payload sizes with pagination.
- Do not add realtime requirements for V1 unless already supported.

## 23. Testing

### Matching

- Deterministic scores reproduce for identical inputs.
- Ranking and tie-breaking are stable.
- Missing compatibility evidence is reported and not invented.
- Existing collaborator matching and fallback tests remain unchanged.
- Co-founder cache keys cannot reuse collaborator results.

### Lifecycle

- Founder can invite; invitee can accept, request changes, decline, or accept the proposal.
- Non-invitee cannot accept.
- Discussion acceptance alone does not create Co-founder Mode.
- Proposal acceptance activates the relationship transactionally.
- Duplicate and concurrent acceptance is idempotent.
- Pause, resume, and end enforce valid transitions.
- Ending revokes access but preserves evidence.

### Dashboard and workspace

- No active relationship: dashboard output is unchanged.
- Pending or discussion state: no Co-founder Mode.
- Active state: mode appears for both parties.
- Multiple relationships aggregate correctly and remain isolated.
- Personal tasks/objectives do not appear to the other party.
- Other workspace members cannot access the relationship workspace.

### Security and permissions

- IDOR tests for relationship, workspace, objective, decision, activity, evidence, and investor summary IDs.
- Cross-venture and cross-relationship access tests.
- Founder, co-founder, other collaborator, investor, organization, explorer, and unauthenticated cases.
- API response leakage tests for private fields.
- Feed tests proving private co-founder activity is not automatically published.
- Notification deep links do not grant access to unauthorized recipients.

### Intelligence

- Health and alignment are deterministic.
- Insufficient evidence returns an explicit low-confidence state.
- Friction text uses neutral language.
- Trust, reputation, GitHub, LinkedIn, and execution evidence preserve claimed/verified/observed separation.

### Frontend

- Conditional rendering for every relationship state.
- No co-founder client-side scoring fallback.
- Comparison table uses API-provided breakdowns.
- Invitation and workspace flows remain usable on mobile and low-bandwidth paths.

## 24. Feature Flags and Rollout

```text
COFOUNDER_MODE_ENABLED=false
COFOUNDER_MODE_ALLOWLIST=
VITE_COFOUNDER_MODE_ENABLED=false
```

Backend flags are authoritative. Frontend flags only control presentation.

Rollout:

1. Merge schema, lifecycle, and authorization with the feature disabled.
2. Enable for internal users.
3. Enable for a controlled founder cohort.
4. Enable for general availability after security and privacy tests pass.
5. Roll back by disabling the flag first; do not delete relationship data.

## 25. Analytics

Use the existing analytics/event pipeline:

```text
cofounder_search_started
cofounder_candidate_viewed
cofounder_candidate_compared
cofounder_invitation_sent
cofounder_invitation_accepted
cofounder_invitation_declined
cofounder_relationship_activated
cofounder_objective_created
cofounder_objective_completed
cofounder_decision_created
cofounder_decision_resolved
cofounder_relationship_paused
cofounder_relationship_ended
```

Store IDs and status metadata only. Do not store private notes, equity discussion content, or health narratives.

## 26. Acceptance Criteria

- Founder without an active relationship sees the existing dashboard unchanged.
- Selecting “Co-founder” adds requirements and deterministic scoring without breaking collaborator matching.
- Inviting a candidate never grants active co-founder status.
- Only candidate acceptance of the proposal activates the relationship.
- Both relationship parties receive the relationship-scoped workspace and dashboard module.
- Other collaborators, investors, and organizations cannot access private relationship data.
- Objectives, responsibilities, tasks, decisions, milestones, and evidence connect to existing execution, trust, and reputation systems.
- Multiple co-founders remain independently permissioned.
- Public feed and investor surfaces expose only explicitly approved information.
- Existing collaborator matching, workspaces, notifications, trust, reputation, and dashboard behavior pass regression tests.

## 27. Primary Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Private co-founder data leaks through generic workspace task APIs | Use a relationship-scoped workspace, server-side visibility filtering, and IDOR tests. |
| Recommendation cache mixes collaborator and co-founder results | Include relationship type, venture, requirement version, and policy version in cache keys. |
| AI overrides deterministic ranking | AI explanation is optional and read-only; scores remain backend-owned. |
| Existing collaborator flow regresses | Keep legacy path unchanged unless `relationshipType=co_founder`. |
| Co-founder becomes an accidental platform role | Store relationship state separately; never modify `profiles.role`. |
| Private activity leaks into the public feed | Relationship activity stays scoped; only explicit approved sharing uses existing feed APIs. |
| Duplicate relationship/invitation sources | Use one canonical lifecycle relationship record and one append-only activity stream. |
| Existing collaborators are silently reclassified | No backfill; relationships only exist after explicit invitation and acceptance. |
