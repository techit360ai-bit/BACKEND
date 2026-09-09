# Organization Program and Hackathon Licensing Implementation Plan

## Objective

Extend the existing Organization and TVCE systems with organization-scoped
program, hackathon, capacity, and funding controls without changing current
free-role allowances, personal account entitlements, or existing personal
hackathon behavior.

## Non-negotiable compatibility rules

1. `accountEntitlements` remains identity-scoped for personal TVCE access.
2. Existing free Organization capabilities remain available with their current
   quotas and role/membership requirements.
3. Existing hackathons without `organizationId` retain their current owner-based
   behavior.
4. Payment never creates organization membership or permissions.
5. Organization usage never silently consumes a user's personal credits.
6. TVCE describes access and funding; the runtime usage service remains the only
   source of credit quantities and settlement.
7. New organization capabilities fail closed when no organization entitlement
   exists, while legacy routes remain compatible during migration.
8. Public participant workflows remain free unless an organization explicitly
   funds an advanced operation.

## Capability layers

### Existing free capabilities (unchanged)

- `ORGANIZATION_PROFILE`
- `ORGANIZATION_BASIC_DASHBOARD`
- `ORGANIZATION_PROGRAM_SETUP`
- `ORGANIZATION_BASIC_COHORT`
- `ORGANIZATION_BASIC_REPORTING`

### Existing funded capabilities (unchanged)

- `ORGANIZATION_MONITORING`
- `COHORT_INTELLIGENCE`
- `MENTOR_INTELLIGENCE`
- `organization.analytics`
- `institutional.analytics`

### Additive organization capabilities

- `ORGANIZATION_HACKATHON_BASIC`
- `ORGANIZATION_HACKATHON_ADVANCED`
- `ORGANIZATION_PROGRAM_ANALYTICS`
- `ORGANIZATION_INTERVENTIONS`
- `ORGANIZATION_REPORT_EXPORT`
- `ORGANIZATION_SPONSOR_MANAGEMENT`
- `ORGANIZATION_INTEGRATIONS`
- `ORGANIZATION_WHITE_LABEL`

## Licensing offers

1. **Community Host**: current free organization access plus a separately
   configured basic organization hackathon allowance.
2. **Program Pass**: time-bounded program entitlement with startup, member,
   cohort, judge, mentor, storage, and runtime budgets.
3. **Organization Subscription**: recurring access for multiple programs and
   advanced intelligence.
4. **Sponsor-funded program**: an organization or hackathon budget funded by a
   sponsor grant; participant access remains free.
5. **Institutional contract**: custom limits, integrations, white-label, SLA,
   and institutional analytics.

The first commercial launch should expose Community Host and Program Pass.
Annual and institutional contracts should use the same entitlement contract.

## Product and commercial scope coverage

The implementation covers the complete recommended Organization/Hackathon
model, while activating the smallest safe subset first:

| Recommendation | Implementation location | Activation phase |
|---|---|---|
| Free Community Host | Organization entitlement defaults and domain limits | Phase 1 |
| Program Customer / Program Pass | Time-bounded organization entitlement | Phase 1-3 |
| Institutional Customer | Custom entitlement fields, integrations, SLA metadata | Phase 5 |
| Organization first-class entity | Existing organization/membership authority | Existing, preserved |
| Organization roles and teams | Existing membership roles plus scoped permissions | Existing, preserved |
| Hackathon product object | Existing hackathon model with optional organization scope | Phase 2 |
| Free hackathon acquisition loop | Basic hackathon capability and event limits | Phase 2 |
| Paid hackathon tiers | Capacity and capability limits, not hard-coded prices | Phase 4-5 |
| Basic free participant workflow | Registration, teams, submissions, basic judging, certificates/showcase | Existing, preserved |
| AI and advanced intelligence monetization | Runtime-metered additive capabilities | Phase 3-4 |
| Organization wallet and credit hierarchy | Organization/program/hackathon budgets over existing settlement | Phase 3 |
| Sponsor marketplace and packages | Sponsor records, packages, applications, benefits, transactions | Phase 4 |
| Sponsor-funded credits | Sponsor grant to program/hackathon budget | Phase 4 |
| Privacy-safe sponsor access | Aggregate reporting and explicit participant consent | Phase 4 |
| Separate prize accounting | Prize budget metadata isolated from platform revenue | Phase 4 |
| Managed Hackathon service | Service entitlement and operational checklist | Phase 5 |
| Post-hackathon intelligence report | Existing organization reports plus event-specific projection | Phase 4 |
| Incubation conversion | Consent-based project -> startup candidate -> incubation flow | Phase 4 |
| Demo day and investor pipeline | Existing demo-day/publish/match routes, gated by additive capabilities | Phase 4 |
| Organization conversion funnel | TVCE and distribution events with organization/program dimensions | Phase 0-5 |
| Founding Partner program | Time-limited grant/discount metadata and reference consent | Phase 5 |
| Program Pass and sponsored Program Pass | Same entitlement contract with different grant sources | Phase 3-5 |
| Participant optional monetization | Keep participation free; meter optional founder tools separately | Existing TVCE, preserved |
| Free-to-paid no-card onboarding | Approval and trial workflow before payment | Phase 5 |
| Anti-abuse controls | Event, account, IP, AI, duplicate, approval, and rate limits | Phase 1-4 |
| Organization dashboard | Usage, budget, health, risks, actions, recommendations, conversion prompts | Phase 5 |
| Revenue stack | Subscription, passes, credits, sponsorship, services, analytics, API, white-label | Phase 5 |
| Profitability rule | Free low-variable-cost actions; expensive AI/storage/runtime funded | All phases |
| Launch sequence | 0-3 month free pilots, 3-6 month sponsorship, 6-12 month passes/subscriptions | Rollout |

## Revenue and package boundaries

The platform must support, without hard-coding public prices into TVCE:

- Organization subscriptions.
- One-off Program Passes.
- Hackathon upgrades.
- Organization and event AI credits.
- Sponsor-funded credits and event budgets.
- Managed hackathon setup, support, judging, and demo-day services.
- Advanced analytics and custom reports.
- API and external integrations.
- White-label institutional delivery.
- Optional premium founder capabilities after free participation.
- Incubation programs and investor intelligence for organizations/investors.

TVCE returns access class, entitlement source, capacity state, and funding
options. Billing packages own money, currency, price, tax, provider IDs, and
commercial terms.

## Hackathon lifecycle and conversion

The full event lifecycle is:

```text
organization setup
-> challenge and sponsor configuration
-> participant registration
-> team formation
-> project/brief submission
-> check-ins and workspace
-> judging and leaderboard
-> final submission
-> program intelligence report
-> demo-day pipeline
-> consent-based incubation conversion
-> investor matching and follow-on program
```

At completion, generate an evidence-based report containing participant,
project, completion, health, readiness, and risk aggregates. The report must
offer `Continue Incubation`, `Monitor Cohort`, `Generate Investor Pipeline`,
and `Upgrade Organization` actions without fabricating scores or outcomes.

Projects become `startupCandidates` only after founder consent. Promotion to an
incubation workspace or public startup remains an explicit action.

## Sponsor model

Organizations can publish sponsorship opportunities with configurable packages
such as title, AI, cloud, prize, community, and media partners. Benefits are
represented as entitlements and deliverables, not unrestricted data access.

Sponsors may receive branding, workshops, mentor sessions, talent discovery,
technology credits, and aggregate event intelligence. Personal participant data
requires participant consent. Prize funds are tracked separately from TechIT
platform revenue. Sponsor money can allocate an agreed credit grant directly to
an event budget.

## Anti-abuse and operational controls

Every event and program receives independent limits for participants, projects,
teams, organizers, judges, mentors, AI operations, storage, reports, and
active duration. Additional controls include:

- IP, account, organization, and event rate limits.
- Duplicate-account and repeated-free-event detection.
- Approval workflow for early free events.
- Hard runtime AI budget ceilings.
- Idempotent invitations, registration, payments, grants, and settlement.
- Audit records for denials, role changes, budget use, sponsor access, and
  participant consent.
- Operational support and managed-service runbooks for paid events.

## Organization dashboard contract

The organization dashboard should combine existing intelligence with the new
commercial scope:

- Plan/pass and expiry.
- Active programs and hackathons.
- Startup, participant, judge, mentor, and member counts.
- Organization and event budget usage.
- Program health, risks, stagnation, actions, and recommendations.
- Incubation and investor-ready candidates.
- Sponsor commitments and deliverables.
- Usage, conversion, and upgrade prompts.

All values are derived from persisted organization/project/event records and are
labeled when evidence is unavailable.

## Data and ownership model

Additive records:

- `organizationEntitlements`: organization plan/pass, status, dates,
  capability flags, and limits.
- `organizationBudgets`: organization/program/hackathon funding scopes,
  balances, reservations, and expiry.
- `organizationUsage`: counters for active programs, cohorts, hackathons,
  participants, projects, judges, mentors, reports, and storage.

Add optional fields to existing records:

- `organizationId` on hackathons and derived hackathon records.
- `entitlementScope` and `fundingOwnerId` on capability consumption and usage
  reservations.

Existing rows remain valid because all new ownership fields are nullable.

## Authorization and funding order

Every new organization operation evaluates:

```text
authentication
-> organization context
-> active membership
-> internal organization permission
-> TVCE capability
-> domain capacity
-> organization entitlement/budget
-> runtime reservation
-> operation
```

Funding order for organization-scoped runtime work:

```text
hackathon/program budget
-> organization subscription allowance
-> organization purchased credits
-> explicit user opt-in to personal credits
-> deny
```

No personal-credit fallback is implicit.

## Phases

### Phase 0: Contract and observability

- Land this plan and a machine-readable capability/limit error contract.
- Add metrics for access class, entitlement scope, funding source, capacity
  denials, and conversion events.
- No behavior change.

### Phase 1: Organization entitlement and capacity primitives

- Add organization entitlement resolution with expiry and capability flags.
- Add limit evaluation with explicit `organization_*_limit_reached` errors.
- Add Community Host defaults without changing existing organization quotas.
- Expose organization entitlement state through TVCE APIs.

### Phase 2: Organization-owned hackathons and programs

- Accept optional `organizationId` on hackathon creation.
- Preserve user-owned hackathons and owner-based reads.
- Enforce organization membership/role permissions for organization-owned rows.
- Propagate `organizationId` to teams, projects, workspaces, reports, and
  analytics.

### Phase 3: Organization funding and runtime settlement

- Extend reservation and capability-consumption metadata with organization
  scope and budget identifiers.
- Reserve/settle against organization budgets before personal funding.
- Keep runtime estimation and actual settlement in the existing usage service.
- Add idempotency and refund/expiry handling for organization budgets.

### Phase 4: Advanced intelligence and sponsorship

- Gate advanced monitoring, intervention, reporting, sponsor management, and
  integrations through additive TVCE capabilities.
- Add sponsor grant records and program/hackathon budget allocation.
- Keep participant personal data private by default; expose aggregate sponsor
  reporting and consent-based contact sharing only.

### Phase 5: Frontend and commercial activation

- Extend the existing TVCE entitlement response with organization scope.
- Show free/basic organization surfaces unchanged.
- Add contextual upgrade states for Program Pass and advanced capabilities.
- Add organization usage, budget, and expiry views.
- Activate Community Host and Program Pass before annual or institutional plans.

## Acceptance tests

- Existing free organization capabilities pass unchanged.
- Existing personal hackathons pass unchanged.
- Organization-owned hackathons require membership and the correct role.
- Cross-organization reads and writes are denied.
- Expired entitlements deny only the scoped advanced capability.
- Capacity limits return machine-readable errors and do not mutate state.
- Organization runtime usage never debits personal credits by default.
- Sponsor budgets are isolated to their program or hackathon.
- Subscription, pass, and sponsor grants are idempotent.
- PostgreSQL and authority-store fallback behavior remains intact.
- Frontend displays current free access and new paywalls from server responses.

## Rollout controls

- Feature flag new organization-scoped routes and funding resolution.
- Shadow-evaluate capacity and entitlement decisions before enforcement.
- Enable enforcement for internal organizations first.
- Monitor denials, budget exhaustion, usage, conversion, and privacy events.
- Roll back by disabling the organization extension flag; nullable fields and
  legacy owner paths remain operational.
