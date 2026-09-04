# TVCE Free Role Access Plan

## Decision

Free Collaborators are allowed one active workspace. The limit applies to workspace memberships, not to the number of roles on the identity. A paid account entitlement removes the free membership limit, but never bypasses workspace membership, access level, organization scope, or role authorization.

## Why one workspace is the right default

One workspace is enough to demonstrate contribution value while limiting account farming, invitation abuse, cross-project data exposure, and free compute/storage accumulation. A collaborator can contribute to one real project without paying, while multi-project collaborators have a clear upgrade path.

## Role and entitlement rules

1. A user identity may activate multiple roles.
2. A verified credit purchase or subscription creates one shared account entitlement across activated roles.
3. Role activation alone grants no workspace access.
4. Workspace access requires an owner record or active workspace membership.
5. A free Collaborator may have one active collaborator membership, selected by earliest accepted membership.
6. A paid account may have multiple collaborator memberships, still subject to each workspace's access level.
7. Founder-owned workspaces are not counted as collaborator memberships.
8. Investor and Organization roles cannot use Collaborator membership to bypass their own role/context and funding requirements.
9. Revoked, removed, expired, and declined memberships do not count toward the limit.
10. Invitation acceptance is checked atomically on the backend; client-side hiding is only UX.

## Anti-exploitation controls

- Every workspace read/write route validates the authenticated identity against workspace owner or membership.
- Every code-workspace route also passes through a named capability policy.
- Active context and role are derived from backend state, not trusted request claims.
- Free membership checks are repeated at invitation acceptance and workspace access time to prevent race and stale-list bypasses.
- Paid entitlement is account-level, but payment cannot manufacture membership or organization permissions.
- Audit logs should record membership acceptance denials with `free_collaborator_workspace_limit`.

## Free Collaborator capability set

- Assigned workspace view.
- Tasks, comments, reports, and permitted files.
- Basic Copilot allowance.
- Contribution evidence and activity history.
- Milestone and progress visibility.

Advanced AI, autonomous execution, deployment, and multi-workspace participation remain paid or subscription-backed.

## Implementation sequence

1. Persist policy and commercial limits in backend configuration.
2. Enforce the limit in workspace listing, invitation acceptance, and code-workspace access.
3. Return a machine-readable access policy to the frontend.
4. Show a targeted upgrade message when a second invitation is accepted.
5. Add regression tests for multi-role identities, membership order, removed memberships, and paid entitlement.
6. Monitor denials, upgrades, invitation acceptance, and workspace activity by role.

## Full recommendation coverage

### Founder free-value loop

- Basic idea diagnosis with a configurable monthly allowance.
- Basic validation sessions with explicit remaining usage.
- One initial MVP plan plus configurable revision allowances.
- GSIS refreshes triggered by meaningful new evidence rather than arbitrary page visits.
- Startup-health checks showing score confidence, evidence used, missing evidence, and the recommended corrective action.
- Basic workspace and collaboration operations remain permission-controlled rather than credit-metered.

### Collaborator free-value loop

- One active collaborator workspace for a free account.
- Assigned tasks, comments, reports, milestones, and permitted file operations.
- A configurable basic Copilot allowance.
- Contribution evidence, activity history, and credibility progress.
- Advanced AI, autonomous execution, deployment automation, and additional workspaces require paid account entitlement.

### Workflow-to-TVCE audit

Every Founder and Collaborator workflow must be checked for the correct capability ID, active context, workflow snapshot, idempotency key, usage event, contextual paywall, payment continuation, and outcome event. Backend authorization remains authoritative even when the frontend does not render a gate correctly.

### Evidence quality

GSIS and startup-health responses should return the score, confidence level, evidence sources, missing evidence, and next-best action. Early or incomplete data must be labeled as a baseline or insufficient-evidence state rather than displayed as unjustified precision.

### Collaboration and referral loop

After diagnosis, validation, or MVP planning, Founders should receive a contextual invitation action tied to a real project need. Collaborators should be able to accept the first workspace invitation without payment. Conversion measurement should distinguish invitation sent, invitation accepted, first contribution, retained collaboration, workspace-limit paywall, and paid multi-workspace activation.

### Privacy-safe sharing

Shareable diagnosis, MVP, validation, GSIS, and progress summaries must be generated from an explicit public projection. Private customer responses, founder evidence, organization data, investor notes, internal scores, and restricted documents must never be included by default.

### Other role free boundaries

Investor free access remains limited to profile, public startup discovery, permitted basic intelligence, limited filtering, and watchlists. Organization free access remains limited to profile, basic program setup, limited startup onboarding, basic cohort visibility, and limited reporting. Diligence, portfolio intelligence, cohort intelligence, intervention recommendations, and program analytics remain separately authorized and funded.

### Role-specific onboarding

- Founder: diagnosis, validation, MVP plan, progress result.
- Collaborator: accept workspace, complete task, submit evidence.
- Investor: discover startup, save watchlist, view permitted public intelligence.
- Organization: create program, add startup, view basic cohort.

### Measurement and rollout

Track free workflow completion, time to first value, invitation acceptance, first collaborator contribution, quota exhaustion, workspace-limit denials, credit purchase, subscription conversion, resumed workflow, and 7/30-day retention. Quotas should be changed through TVCE commercial configuration only after observing real cohort behavior.

## Resume checklist for next context

- Review commits touching `domainService.js`, `codeWorkspaceService.js`, `WorkspaceInvitationPage.tsx`, and `tvceService.js`.
- Run TVCE and billing tests.
- Add frontend tests for the one-workspace invitation message if the invitation API mock is expanded.
- Continue the workflow-to-TVCE audit for Founder and Collaborator screens.
- Add evidence-confidence fields and public share projections before enabling share links.
- Add role-specific onboarding completion analytics.
- Confirm provider/admin branches remain separate and unrelated dirty files are preserved.
