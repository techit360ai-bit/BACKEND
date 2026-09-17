# TVCE Cost-Free Access and Role Conversion Plan

## Decision

TVCE is an access and value-conversion layer. It must answer:

- Is this role and context allowed to use the capability?
- Is the capability free, runtime-metered, or subscription-only?
- What verification, membership, or account state is required?
- What is the next useful action and which funding paths are available?

TVCE must not answer how many credits an operation costs. It must not contain
`creditCost`, `credits`, minimum-credit thresholds, price tables, or role prices.
Credit quantities are owned by the execution usage meter. The execution planner
may send a runtime estimate to `reserveUsage`; the settlement service records
actual provider usage and debits the selected credit source. Subscription plans
may expose an allowance through billing, but the capability policy does not
translate a capability into a fixed credit amount.

## Reconciliation of the Previous Conflict

The former model had two competing sources of truth:

1. `config/tvce-commercial.json` assigned capability credit costs.
2. `capabilityAuthorization.js` assigned different policy credit amounts.

That model is removed. The commercial config now contains only value copy,
blocked copy, and optional free-use quotas. Authorization policies contain role,
assurance, funding source, and membership requirements only. Runtime estimates
are accepted only at execution time and are never read from a capability catalog.

## Access Model

Each capability has an access class:

| Access class | TVCE behavior | Credit quantity source |
| --- | --- | --- |
| `free` | Authorize role/context and any domain limit | None, or platform subsidy quota |
| `metered` | Require a valid role and a subscription or available credit source when free allowance is exhausted | Runtime planner and usage settlement |
| `subscription` | Require an active subscription and the capability in its entitlements | Subscription billing and allowance ledger |

`metering: runtime` is metadata, not a price. A positive
`estimatedCredits` may be supplied to an entitlement check only as a preflight
for a concrete operation. If it is absent, TVCE returns `usageEstimateRequired`
for metered work and does not invent an estimate.

## Role Capability Boundaries

### Collaborator

Free: profile and onboarding, settings, one active collaborator workspace,
assigned tasks, comments, permitted files and reports, milestones, contribution
history, performance, equity ledger, earnings history, opportunities, academy,
reputation, messaging, feed, and support.

Runtime-metered: Copilot requests, advanced code analysis, execution and review
actions, connector operations, and other AI work whose usage is measured by the
execution service.

Subscription: multiple workspaces, advanced AI allowances, autonomous execution,
deployment automation, and higher account limits.

### Investor

Free: investor profile and onboarding, public startup discovery, public/basic
startup profiles, limited filtering, limited watchlists, reputation, mentorship
browsing/applying, and permitted messaging. These are represented by
`INVESTOR_PUBLIC_DISCOVERY` and `INVESTOR_WATCHLIST`, mapped to the free
`investment.opportunity.view` policy.

Runtime-metered: sensitive startup profiles, investor intelligence, risk
analysis/radar, EVI analysis, heatmap refreshes, data-room access, one-off
diligence, investment indications, and founder contact.

Subscription: portfolio intelligence, recurring monitoring and alerts, full
deal-room operations, internal notes, IC and term sheets, capital-pool
automation, continuous trust verification, and mentorship-room creation and
analytics.

### Organization

Free: organization profile and verification, basic dashboard, one basic
program/cohort, limited startup onboarding, basic team/project visibility,
community/feed, and basic reports. These are represented by
`ORGANIZATION_PROFILE`, `ORGANIZATION_BASIC_DASHBOARD`,
`ORGANIZATION_PROGRAM_SETUP`, `ORGANIZATION_BASIC_COHORT`, and
`ORGANIZATION_BASIC_REPORTING`, mapped to the free
`organization.profile.manage` policy. The one-program, cohort, and record-count
limits remain domain rules, not TVCE prices.

Runtime-metered: recruitment actions, marketplace publishing, hackathon
publishing/analytics, AI-operations runs, advanced monitoring, and generated
reports.

Subscription: cohort intelligence, intervention recommendations,
program/portfolio analytics, automation at scale, integrations, larger
team/project limits, institutional analytics, and white-label features.

## Implementation Status

Completed in this change:

1. Removed capability credit costs from the commercial JSON and sanitized legacy
   persisted pricing fields from TVCE responses.
2. Removed numeric credit requirements from authorization policies.
3. Changed funding checks to test for a funding source or available balance;
   actual quantities are checked only when a runtime estimate is supplied.
4. Added free Investor and Organization catalog capabilities.
5. Changed capability consumption so it creates an entitlement event without a
   debit when no runtime estimate is supplied.
6. Passed positive runtime estimates from request bodies into usage reservation.
7. Updated frontend paywalls and progress surfaces to describe runtime usage
   instead of showing invented capability prices.
8. Gated advanced Investor and Organization routes while leaving their free
   profile, dashboard, discovery, watchlist, and basic setup surfaces reachable.

## Remaining Work Before Commercial Launch

1. Add a versioned runtime estimator owned by the execution service. It should
   derive usage from model, tokens, tool calls, storage, or deployment units and
   return an estimate before execution.
2. Make every AI-backed route create an execution grant with an idempotency key;
   TVCE should receive the grant result, not calculate the amount.
3. Move subscription included allowances to the billing ledger with an explicit
   cadence (`monthly`, `annual`, `per_project`, or `unlimited`).
4. Add domain counters for free Investor watchlists and Organization programs,
   cohorts, teams, and reports. Return machine-readable limit codes and keep
   these limits separate from credit funding.
5. Add route-level tests for every free and paid entry in the matrix above.
6. Add admin validation that rejects future pricing fields in TVCE config and
   emits a migration warning for old persisted records.
7. Add analytics dimensions for `accessClass`, `fundingSource`,
   `usageEstimateProvided`, free-domain-limit denials, credit purchase, and
   subscription conversion.

## Acceptance Criteria

- No TVCE source, config, or API response contains a capability credit price.
- No authorization policy contains a numeric credit threshold.
- A free Investor can activate the role, discover public startups, and use a
  watchlist without a purchase.
- A free Organization can activate the role, manage its profile, view the basic
  dashboard, and create its permitted basic program/cohort records.
- Paid Investor and Organization actions fail with a funding-source error when
  neither a subscription nor available credits exist.
- A metered operation with no runtime estimate does not debit credits.
- A metered operation with a runtime estimate reserves and settles through the
  usage ledger exactly once.
- A subscription or credit purchase does not bypass role, verification,
  membership, organization scope, or workspace permissions.
- Frontend locked capability UI offers usage credits and subscriptions without
  displaying a hard-coded capability price.

## Rollout

Deploy the policy/catalog change behind the existing TVCE routes, run the focused
authorization, TVCE, usage-settlement, and frontend build suites, then monitor
free-role completion and funding-source conversion for 7 and 30 days. Adjust
domain limits and billing packages through their owning systems; do not add
capability prices back into TVCE.
