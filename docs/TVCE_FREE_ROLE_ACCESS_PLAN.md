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

## Resume checklist for next context

- Review commits touching `domainService.js`, `codeWorkspaceService.js`, `WorkspaceInvitationPage.tsx`, and `tvceService.js`.
- Run TVCE and billing tests.
- Add frontend tests for the one-workspace invitation message if the invitation API mock is expanded.
- Confirm provider/admin branches remain separate and unrelated dirty files are preserved.
