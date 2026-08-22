# Organization Intelligence & Operations Hub Extension Plan

## Scope

Extend the existing Organization role and live organization collections. The
current Organization Dashboard, projects, cohort health, interventions, impact,
KPI targets, Demo Day, mentorship, hackathons, programs, people, marketplace,
talent, settings, integrations, community, notifications, auth, and role/context
systems remain the source of truth.

Wallet, billing, subscriptions, pricing, credits, entitlement evaluation, and
BillingGuard are explicitly excluded. This work must not add billing routes,
billing mutations, or feature gates based on plan names.

## Existing-to-target map

| Target capability | Existing implementation | Action |
| --- | --- | --- |
| Organization identity/context | `organizations`, `organizationMemberships`, `activeContexts`, multi-role context service | Extend with server-resolved active organization |
| Organization projects/startups | `projects` with `organizationId`, project APIs | Reuse and aggregate |
| Programs/resources/settings | `organizationPrograms`, `organizationCommunity`, `organizationSettings`, related live collection routes | Reuse |
| Mentorship | `mentorshipRooms`, applications, mentees, tasks, messages, resources | Consume authorized aggregates only |
| Health/interventions/impact/KPIs | `domainService` organization intelligence functions | Extend with snapshots and organization scope |
| Events/opportunities/hackathons | Existing domain and mentorship/hackathon services | Consume existing records |
| Notifications | Existing `notifications` and preferences | Extend with non-sensitive organization events |
| AI reasoning | Existing AI Router client | Send only backend-authorized evidence; AI cannot authorize or mutate canonical state |
| Audit | Existing authorization/audit collections and append-only Deal Room pattern | Add organization action audit records |

## Deterministic backend rules

Backend owns organization resolution, membership status, organization roles,
permissions, resource visibility, pagination/filtering, health/risk/KPI
calculations, pulse windows, action transitions, snapshot creation, audit
records, notification recipients, and report schedule validation. The frontend
only renders server responses and submits user intent.

AI Router is advisory only: it may summarize supplied evidence or explain a
recommendation. It cannot select an organization, bypass membership, change a
score, create an action, or access private notes.

## Delivery phases

1. **Context and authorization bridge**: resolve `organizationId` from the
   active server context, require active membership, normalize organization
   roles, and preserve legacy owner-as-organization behavior as a compatibility
   fallback.
2. **Organization intelligence service**: add deterministic overview, pulse,
   health dimensions, risk monitor, action center, activity timeline, and
   permission-scoped startup/program/cohort aggregation.
3. **Operations and governance**: add organization-scoped actions, configurable
   KPI definitions/values, resource/event/partner/report schedule records where
   no equivalent exists, and immutable sensitive-action audit entries.
4. **Historical snapshots and notifications**: persist health/KPI/pulse
   snapshots, run overdue/deadline maintenance through the existing timer/task
   pattern, and emit preference-safe notifications without sensitive content.
5. **Frontend extension**: keep the existing OrgLayout/sidebar and add live
   Pulse, Actions, Risks, and KPI/impact panels to the existing Dashboard and
   Intelligence screens. No duplicate Organization application or billing work.
6. **Verification**: test tenant isolation, membership/role permissions,
   deterministic aggregations, snapshots, action transitions, audit integrity,
   AI evidence boundaries, mobile layout, and regression of existing routes.

## Initial capability matrix

Organization roles: `owner`, `admin`, `executive`, `program_director`,
`program_manager`, `mentor_manager`, `mentor`, `reviewer`, `analyst`,
`operations`, `communications`, `finance`, `partner`, `read_only`.

Permissions are organization-context permissions, not platform roles. The first
backend matrix covers `organization.view`, `organization.edit`,
`organization.manage_members`, `organization.manage_programs`,
`organization.view_startups`, `organization.view_metrics`,
`organization.view_risks`, `organization.create_intervention`,
`organization.manage_kpis`, `organization.manage_actions`,
`organization.manage_reports`, `organization.export_reports`, and
`organization.view_audit_logs`.

## Definition of done for this extension

- Existing Organization routes and data continue to work.
- Active organization is resolved server-side and cannot be supplied to gain
  access without membership.
- Overview, pulse, health, risks, actions, KPIs, activity, and audit are live and
  deterministic.
- AI receives only authorized evidence and remains advisory.
- No mock production metrics are added.
- No billing, wallet, subscription, pricing, credit, or BillingGuard changes are
  present.
- Focused backend tests and the existing Organization frontend build checks pass
  or unrelated pre-existing failures are documented.
