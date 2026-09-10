# Workspace Build Paths, BYOK AI, Hackathon Views, and Message Editing

## Purpose

Extend the existing TechIT workspace capabilities after idea and customer
validation without creating a second editor, a second project system, or a
second messaging system.

The implementation preserves:

- existing project-bound workspaces and workspace membership;
- the Monaco editor, WebContainer runtime, live preview, code execution runs,
  review/apply gates, GitHub sync, and VS Code bridge;
- existing hackathon registration, team, submission, team-workspace binding,
  project promotion, and organization ownership records;
- existing personal and organization TVCE allowances;
- the Go messaging service as the authority for direct and channel messages;
- append-only audit expectations for code execution and support records.

The user-facing result is a single workspace with context-aware paths:

```text
Validated idea / customer evidence
          |
          v
  +-----------------------+
  | Choose a build path   |
  | Prototype | Build MVP |
  +-----------------------+
          |
          v
  Same workspace, same files, same preview, same history
          |
          +--> Hackathon view when attached to an event
          |
          +--> Venture view after consented promotion
```

## Existing System Map

### Workspace and editor

Current authoritative pieces:

- `domainService.provisionWorkspace` creates a workspace bound to a project.
- `domainService.workspaceContext` exposes the latest venture analysis/blueprint.
- `codeWorkspaceService` owns project files, versions, safe paths, optimistic
  concurrency, change events, runtime sessions, and deployment evidence.
- `codeExecutionRunService` owns staged execution evidence:
  `execution_intelligence`, `mvp_builder`, `product_architect`, `code`, `test`,
  `debugger`, `security`, `review`, and `deployment`.
- `Code.tsx` already provides Monaco editing, WebContainer commands, terminal,
  problems, reviewable AI changes, and an iframe live preview.
- `workspaceProjectPostgresProjection` and migration `011` project workspace,
  member, task, and project records.

### Validation and venture lifecycle

- Customer validation and incubation APIs persist evidence and synthesis.
- `ventureAnalyses` provide the blueprint/context consumed when a workspace is
  provisioned.
- `projects` are the durable venture object.
- `createProject` already accepts hackathon promotion origin metadata.
- `hackathonTeamWorkspaces` bind a team to a workspace.
- Promotion currently links the team, project, and workspace rather than making
  a replacement workspace.

### AI execution and billing

- The Node backend owns authentication, capability authorization, credit
  reservation/settlement, execution evidence, and mutation approval.
- `aiRouterClient` forwards advisory requests to the AI router.
- Workspace AI currently supports planning, conversation, code review, sprint
  planning, and proposed code changes.
- TVCE and capability consumption already distinguish subscription allowance,
  purchased credits, and runtime usage.

### Feed and messaging

- Feed posts/comments/likes and the frontend feed are backed by the Go
  `messaging-backend` service.
- Direct and channel message storage is PostgreSQL-backed in the Go service.
- The frontend already has `msgPatch` and `msgDelete` transport helpers, but
  no edit/delete message contract or UI exists yet.
- Node content projections consume feed and mentorship data but are not the
  authority for Go direct/channel messages.

## Product Contract

### Build path options

After a validated customer/idea analysis is available, the workspace shows two
explicit actions:

1. **Prototype**: build the smallest testable experience for learning,
   demonstration, and customer feedback.
2. **Build MVP**: build a bounded usable product with an agreed MVP scope,
   acceptance criteria, and deployment evidence.

These are sibling entry paths, not a forced sequence. A user may choose Build
MVP directly. The platform should recommend Prototype when evidence is weak or
scope is uncertain, but recommendation must not block the MVP path.

The path is stored as workspace/project state, not inferred from a URL or local
browser state.

### Cost estimate contract

Before starting a build path, the backend returns:

- estimated AI operations and credits;
- estimated runtime minutes and preview resources;
- included subscription allowance;
- estimated credits to be consumed;
- remaining allowance and projected balance;
- assumptions and confidence (`low`, `medium`, `high`);
- the exact capability and funding source that will be used;
- a warning when the estimate exceeds allowance.

The estimate is advisory until the first operation is reserved. Every actual AI
or runtime operation continues through existing TVCE reservation and settlement
logic. Client-provided cost values are never trusted for billing.

### Workspace views

The workspace remains one resource with one file/version/history graph. The
view is derived from persisted context:

```text
workspace.lifecycleView =
  standard | prototype | mvp | hackathon | venture
```

`buildPath` and `lifecycleView` are related but distinct:

- `buildPath`: `prototype` or `mvp`;
- `lifecycleView`: the presentation/operating context;
- `hackathonContext`: event/team/submission metadata;
- `ventureContext`: promoted project and incubation metadata.

The view changes when the project is attached to a hackathon or promoted to a
venture. Files, runtime sessions, execution runs, comments, and audit history
remain in the same workspace.

## Phase 0: Contracts and Decision Records

### Deliverables

- Add this plan and a machine-readable build-path/view contract.
- Define stable identifiers for capabilities and events:
  `workspace.build_path.choose`, `workspace.cost.estimate`,
  `workspace.byok.use`, `workspace.hackathon.attach`,
  `workspace.lifecycle.promote`, `message.edit`, and `message.delete`.
- Define retention and audit rules for edited/deleted content.
- Confirm supported BYOK providers and regions before implementation.

### Acceptance

- Existing workspace APIs continue to return valid responses when the new fields
  are absent.
- Existing personal workspaces default to `standard` view and no build path.
- Existing hackathon workspaces default to `hackathon` view only when a valid
  binding is present.

## Phase 1: Persisted Workspace Build State

### Schema

Add a PostgreSQL migration and authority-store collections/projection for:

`workspace_build_profiles`

- `workspace_id` unique;
- `project_id`;
- `build_path` (`prototype`, `mvp`);
- `lifecycle_view` (`standard`, `prototype`, `mvp`, `hackathon`, `venture`);
- `source_analysis_id`;
- `validation_snapshot_id`;
- `scope` JSONB (bounded requirements and acceptance criteria);
- `status` (`draft`, `active`, `paused`, `completed`, `promoted`);
- `selected_by`, `selected_at`, `created_at`, `updated_at`.

`workspace_cost_estimates`

- `id`, `workspace_id`, `build_path`, `estimator_version`;
- operation counts, estimated credits, estimated runtime minutes;
- subscription allowance, credit balance, projected balance;
- assumptions JSONB, confidence, expires_at;
- created_by and timestamps.

`workspace_lifecycle_events`

- append-only workspace, project, hackathon, and venture transitions;
- actor, previous view/path, next view/path, reason, metadata, timestamps.

### Services and APIs

Extend `workspaceContext` with `buildProfile`, `costEstimate`, and validated
hackathon/venture context.

Add:

```text
POST /api/code/:workspaceId/build-path
GET  /api/code/:workspaceId/build-path
POST /api/code/:workspaceId/cost-estimate
PATCH /api/code/:workspaceId/lifecycle-view
GET  /api/code/:workspaceId/lifecycle-events
```

`POST build-path` must:

1. verify workspace access and project ownership/membership;
2. require a completed validation/analysis reference or explicitly record that
   the user chose an MVP path without one;
3. calculate the estimate server-side;
4. reserve no credits until a build operation starts;
5. write an audit event and return the updated context.

### Compatibility

- `provisionWorkspace` remains idempotent.
- Existing workspace URLs and editor behavior remain valid.
- No existing project is duplicated when a build path is selected.

## Phase 2: Prototype and MVP Execution Flows

### Prototype flow

Prototype mode adds a bounded workflow around the existing editor:

1. select a narrow hypothesis and target user;
2. choose a template/adapter compatible with the project;
3. generate a reviewable scaffold through the existing execution-run stages;
4. run locally in WebContainer;
5. open a live preview;
6. record feedback/validation evidence;
7. optionally promote the same files to MVP scope.

Prototype generation must use the existing proposal/review/apply flow. It must
never write directly from an LLM response.

### MVP flow

MVP mode adds:

1. bounded MVP scope and acceptance criteria;
2. product architecture and dependency plan;
3. reviewable code changes;
4. tests, debugger, security scan, and deployment evidence;
5. explicit human approval before applying changes or deploying.

The current `mvp_builder`, `product_architect`, `code`, `test`, `debugger`,
`security`, `review`, and `deployment` stages are reused. New path metadata is
attached to the existing `codeExecutionRuns` and `codeChangeEvents` records.

### Frontend

Add a first-run build-path chooser to the existing workspace shell or Code page:

- two equal primary actions: `Prototype` and `Build MVP`;
- a server-provided estimate beside each option;
- an evidence summary showing what customer validation/analysis informed the
  recommendation;
- a direct MVP action even when Prototype is recommended;
- a persistent path badge in the editor header;
- prototype/MVP-specific checklists in the right panel;
- the existing terminal, problems, changes, AI, and preview panels remain.

Do not create separate editors or duplicate file stores.

### Live preview

Reuse `WebContainer` and the existing dev-server callback in `Code.tsx`.

Add:

- a preview status record tied to workspace and execution run;
- preview URL expiry and ownership checks;
- a clear distinction between local preview and deployed preview;
- an iframe sandbox policy that remains at least as restrictive as today;
- automatic cleanup/stop of stale preview processes;
- preview errors recorded as runtime evidence, not silently shown as success.

## Phase 3: BYOK and Connected Model Providers

### Security model

Personal model credentials are secrets, not workspace content.

- Never store raw provider keys in SQLite, project files, prompts, logs, browser
  local storage, analytics, or PostgreSQL JSON payloads.
- Store encrypted secret material in the platform secret manager/KMS-backed
  vault, keyed by `user_id` and provider connection ID.
- Persist only provider, masked identifier, model allow-list, status, scopes,
  last validation time, and secret reference.
- Require re-authentication/MFA for create, reveal, rotate, revoke, and export
  operations. Raw key reveal should not be supported after write.
- Apply SSRF, egress, domain allow-list, timeout, payload-size, and rate-limit
  controls to connected model endpoints.
- Prompt and code data sent to a personal provider must be explicit in the
  request policy and excluded from TechIT model-training defaults.

### Data model

`user_model_connections`

- `id`, `user_id`, provider type, display name, secret reference;
- endpoint/base URL, model allow-list, region, status;
- capabilities, privacy policy acknowledgement, last health check;
- created/rotated/revoked timestamps.

`workspace_model_bindings`

- `workspace_id`, `user_id`, connection ID, model ID;
- allowed operations (`plan`, `chat`, `propose`, `review`, `scaffold`);
- spending/rate limits, priority, fallback policy, status.

`model_usage_events`

- workspace, user, connection, provider, model, operation;
- input/output token estimates when available, provider-reported usage,
  latency, status, error class, request ID, timestamps;
- never store raw prompts or completions by default; retain hashes and bounded
  redacted metadata for audit.

### API surface

```text
GET    /api/models/connections
POST   /api/models/connections
POST   /api/models/connections/:id/validate
PATCH  /api/models/connections/:id
DELETE /api/models/connections/:id
GET    /api/code/:workspaceId/models
PUT    /api/code/:workspaceId/models/:bindingId
DELETE /api/code/:workspaceId/models/:bindingId
GET    /api/code/:workspaceId/model-usage
```

### Execution routing

Extend the existing AI-router request envelope with:

```text
provider_mode: platform | personal_key | connected_endpoint
connection_id?
model_id?
workspace_id
operation
privacy_policy_version
```

The backend remains the policy and billing authority. BYOK changes the funding
source, not authorization, safety, file mutation, or review requirements.

For a valid personal connection:

- TechIT charges zero TechIT AI credits for provider usage;
- the provider bills the user directly according to its own account;
- TechIT may still meter platform infrastructure (execution time, storage,
  queueing, or preview resources) according to existing subscription/credit
  rules;
- if the connection is unavailable, the default is fail closed or explicit
  user-approved fallback, never silent substitution with a paid TechIT model.

For platform-managed models, current TVCE reservation and settlement remain
unchanged.

### UI

Add a model selector in the existing AI panel with:

- TechIT model / Personal connection / Workspace connection;
- provider and model labels;
- privacy and cost indication;
- connection health;
- explicit fallback toggle;
- usage link.

The UI must never render the raw secret.

## Phase 4: Existing Projects Entering Hackathons

### Product behavior

Add an **Attach existing project** path to hackathon registration/submission.
It must not force teams to create a fresh project or duplicate a workspace.

The team chooses one of:

- create fresh project in the current hackathon workspace;
- attach an existing project/workspace they own or are authorized to submit;
- import a repository/preview as evidence while keeping the canonical project
  outside the hackathon workspace.

### Data model

`hackathon_project_entries`

- `hackathon_id`, `team_id`, `project_id`, `workspace_id`;
- `entry_mode` (`fresh`, `attached`, `imported`);
- source repository/preview metadata;
- consent and ownership attestations;
- eligibility status, review status, submitted_at, updated_at.

`hackathon_workspace_context`

- workspace/team/hackathon IDs;
- challenge, deadline, judging rubric, submission status;
- organization ID/tag and visible branding;
- entry mode and source project ID;
- view policy version.

Use unique constraints so one team/event has one canonical project entry and
one workspace binding. Cross-user attachment requires explicit project/workspace
membership and team-leader approval.

### APIs

```text
POST /api/domain/hackathons/:hackathonId/teams/:teamId/project-entry
GET  /api/domain/hackathons/:hackathonId/teams/:teamId/project-entry
PATCH /api/domain/hackathons/:hackathonId/teams/:teamId/project-entry
POST /api/domain/hackathons/:hackathonId/teams/:teamId/submit-existing
```

Reuse current `hackathonTeamWorkspaces`, final submission, scoring, and
organization ownership. Submission validation must confirm:

- project/workspace access;
- repository/preview ownership or permission;
- challenge eligibility;
- consent for judges and sponsor-visible aggregate reporting;
- no private files or secrets are exposed to judges.

### Hackathon view

When a valid entry is attached, the same workspace displays:

- hackathon badge and organization/event name;
- challenge statement and deadline;
- team roster and roles;
- judging rubric and submission status;
- required check-ins and evidence;
- sponsor/mentor notices subject to consent;
- submit/update entry actions.

The view is not a separate route or workspace. It is a context layer in the
workspace header, sidebar, right panel, and relevant actions.

### Promotion to venture

On consented promotion:

1. retain the same workspace ID and code/file history;
2. link the existing project to the venture/incubation record;
3. append a lifecycle event from `hackathon` to `venture`;
4. replace hackathon-specific actions with venture milestones, health, and
   investor/incubation panels;
5. preserve hackathon results, judging, and attribution as historical records;
6. do not expose sponsor or judge data beyond its consent scope.

The existing `createProject`/`hackathon_promote` binding is extended, not
replaced.

## Phase 5: Feed and Messaging Edit/Delete

### Authority boundary

Feed posts/comments and direct/channel messages have different owners:

- feed post/comment mutation belongs in the Go `messaging-backend`;
- direct/channel message mutation also belongs in the Go service;
- Node projections consume the resulting records/events and remain read models.

Do not implement a second Node-only mutation path.

### Policy

For feed posts/comments:

- author can edit within a configurable window, for example 15 minutes;
- author can delete/soft-delete at any time subject to moderation/legal hold;
- moderators/admins can hide/remove with an audit reason;
- edited content returns `editedAt`, `version`, and an edit indicator;
- deleted content returns a tombstone for thread integrity, not raw content.

For direct/channel messages:

- sender can edit within a short configurable window;
- sender can delete-for-everyone within the same window;
- delete-for-me is a separate receipt/user-state operation if product requires it;
- admins cannot silently rewrite message bodies;
- legal/moderation holds prevent destructive deletion and retain an audit copy;
- every mutation writes an append-only audit event with actor, reason, previous
  content hash, new content hash, and timestamp.

### Go contracts

Extend the message store interfaces and PostgreSQL schema with:

- `edited_at`, `edit_version`, `deleted_at`, `deleted_by`, `visibility_state`;
- message edit/delete audit table;
- optimistic version checks;
- notification/WebSocket envelope types for `message.updated` and
  `message.deleted`.

Add HTTP and realtime operations:

```text
PATCH  /api/v1/conversations/:conversationId/messages/:messageId
DELETE /api/v1/conversations/:conversationId/messages/:messageId
PATCH  /api/v1/channels/:channelId/messages/:messageId
DELETE /api/v1/channels/:channelId/messages/:messageId
```

Require participant/member authorization, sender ownership, edit-window check,
and `expectedVersion`. Return conflict on stale edits.

### Feed contracts

Use the equivalent `/posts/:postId` and `/posts/:postId/comments/:commentId`
PATCH/DELETE operations with author/moderator policy, soft deletion, and
versioned responses.

### Frontend

- Add an overflow menu only to content the current user may mutate.
- Use an inline edit composer for feed posts/comments and direct messages.
- Show `Edited` and deleted tombstone states.
- Optimistically update with rollback on conflict.
- Reconcile WebSocket events so other open clients update immediately.
- Preserve offline queue semantics with idempotency keys and version checks.

## Phase 6: TVCE, Entitlements, and Cost Controls

Add capability IDs without changing current free allowances:

```text
WORKSPACE_BUILD_PATH_SELECT
WORKSPACE_PROTOTYPE_BUILD
WORKSPACE_MVP_BUILD
WORKSPACE_PREVIEW_RUNTIME
WORKSPACE_BYOK_CONNECTION
WORKSPACE_BYOK_EXECUTION
WORKSPACE_HACKATHON_ENTRY
WORKSPACE_HACKATHON_ATTACH_EXISTING
WORKSPACE_MESSAGE_EDIT
WORKSPACE_MESSAGE_DELETE
```

Recommended access classes:

- path selection and basic preview: existing workspace entitlement/free access;
- prototype/MVP AI execution: existing `workspace.advanced_ai` reservation;
- BYOK connection: authenticated user capability plus abuse/rate controls;
- existing-project hackathon entry: hackathon/team authorization;
- message edit/delete: sender/author policy, not a paid paywall.

Every advanced operation must return the current machine-readable TVCE decision
and estimated/actual funding source. Organization allowances remain scoped to
organization workspaces; personal workspaces remain personal.

## Phase 7: Testing and Rollout

### Backend tests

- build-path selection is idempotent and does not duplicate workspaces;
- MVP can be selected directly after validation;
- estimate uses server-owned prices/allowances;
- reservation and settlement match actual operations;
- preview ownership and expiry are enforced;
- BYOK secrets never appear in responses/logs/files;
- provider connection validation, revoke, rotation, and fallback policy;
- attached hackathon project requires authorization and preserves project ID;
- hackathon view resolves from binding and promotion preserves workspace ID;
- existing and personal hackathon flows remain unchanged;
- message/feed edit window, ownership, version conflict, soft delete, legal
  hold, audit, and realtime event behavior;
- PostgreSQL projection/backfill and SQLite fallback behavior.

### Frontend tests

- build-path chooser renders both options and the recommendation;
- estimate and allowance states render correctly;
- Monaco/WebContainer preview continues to work for both paths;
- model selector never displays secrets and shows provider funding state;
- hackathon view and venture view switch without losing workspace context;
- attach-existing flow does not create duplicate project/workspace;
- feed/DM/channel edit/delete optimistic and conflict states;
- offline queue and reconnect behavior.

### Go tests

- message store interface and PostgreSQL migrations;
- edit/delete authorization and optimistic versions;
- tombstones and audit events;
- WebSocket fanout for update/delete;
- channel membership and conversation participant checks;
- migration and smoke tests.

### Rollout order

1. Ship read-only context fields and feature flags.
2. Enable build-path selection for internal workspaces.
3. Enable prototype/MVP execution with existing review/apply gates.
4. Enable BYOK for allow-listed providers and internal users.
5. Enable attached hackathon entries for one pilot event.
6. Enable hackathon/venture view switching.
7. Enable feed edits, then DM/channel edits, then deletion after audit review.
8. Expand by tenant/cohort while monitoring credits, provider failures, preview
   resource usage, abuse, and message mutation conflicts.

Rollback is per capability/view flag. Disabling a flag returns the workspace to
the existing editor and route behavior; it never deletes files, projects,
hackathon bindings, provider connections, or message history.

## Open Decisions Before Build

1. Which BYOK providers and custom endpoints are supported in the first release?
2. Is platform infrastructure usage for BYOK included in subscription or metered
   separately?
3. What are the exact prototype/MVP AI operation budgets by personal and
   organization tier?
4. What edit windows and legal/moderation hold rules apply to each message
   surface?
5. Which hackathon artifacts can judges see for attached private projects?
6. Does an attached project remain private outside the event, and which sponsor
   benefits require separate founder consent?
7. Which preview runtimes are allowed in production and how long may they live?

## Definition of Done

- A non-technical user can select Prototype or Build MVP directly from the
  existing workspace after validation.
- The platform explains projected subscription/credit impact before execution.
- Both paths use the existing editor, runtime, preview, review, and approval
  controls.
- A user can securely connect a personal model and execute against it without
  TechIT AI-credit charges for provider usage, while platform resource rules
  remain explicit.
- An existing project can enter a hackathon without duplication, and the same
  workspace changes view from hackathon to venture after consented promotion.
- Feed, DM, and channel messages support audited edit/delete behavior.
- Existing organization allowances, personal hackathons, legacy routes, and
  current workspace flows pass regression tests.
