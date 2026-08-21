# Investor Mentorship Intelligence Implementation Plan

## Scope

Extend the existing Investor section and Mentorship Hub with an investor-safe intelligence layer. The Mentorship Hub remains the operational system for rooms, mentees, tasks, messages, resources, and progress. Investor Intelligence consumes only authorized derived signals and does not expose private mentor or founder conversations.

## Existing-to-target map

| Capability | Existing source | Action |
| --- | --- | --- |
| Investor role and capability authorization | `capabilityAuthorization`, role/context services | Extend with intelligence capabilities |
| Investor watchlist and deal flow | `investorWatchlists`, `dealFlowSnapshots`, domain services | Reuse and scope relationship access |
| Startup/project records | `projects`, project analyses, GSIS/intelligence services | Reuse; derive metrics from persisted records |
| Mentorship activity | `mentorshipRooms`, applications, mentees, tasks, messages | Reuse; expose investor-safe aggregates only |
| Existing scoring | deterministic intelligence score kernels and domain health services | Extend, do not create a competing score |
| Notifications and activity | notifications and discovery activity records | Reuse for alerts/brief availability |
| AI reasoning | existing AI Router client and advisory architecture | Add an advisory task only; no authorization or policy decisions |
| Investor UI | existing investor dashboard, startup overview, watchlist, risk views | Add intelligence panels/routes without sidebar expansion |

## Deterministic backend boundary

The backend alone decides:

- authenticated identity, investor type, relationship scope, subscription/capability entitlement;
- which startups, portfolios, programs, and cohorts are visible;
- metric definitions, time windows, trend deltas, health bands, risk thresholds, stagnation rules;
- aggregation, privacy suppression, minimum cohort sizes, report persistence, alert deduplication;
- audit logging and action authorization.

The frontend is presentation only and cannot submit startup, portfolio, investor, or relationship claims as authority.

## AI Router boundary

Only the AI Router may perform language reasoning over a backend-created evidence packet. It may produce explanations, observed-pattern summaries, confidence wording, and suggested review actions. It must not authorize access, alter risk state, create entitlements, calculate a canonical score, or make an investment decision. AI output is advisory, versioned, traceable, and safely degradable when unavailable.

## Delivery phases

1. **Discovery and contract**: map existing models, relationship fields, event timestamps, and investor routes; define response envelopes and privacy rules.
2. **Backend intelligence aggregation**: add deterministic investor-scoped startup, mentorship-to-execution, what-changed, portfolio, risk, watchlist, and audit services. Persist only snapshots/signals that need history.
3. **AI advisory integration**: send minimized authorized evidence to the AI Router for explanations and recommendations; persist advisory provenance separately from deterministic facts.
4. **Investor UI extension**: add panels inside the existing Investor dashboard and startup overview, reusing current navigation and design patterns. No new sidebar category is introduced.
5. **Alerts and reports**: add preference-aware in-app daily/weekly summaries and deduplicated risk/milestone notifications; billing/subscription entitlements remain governed by existing capability policy.
6. **Testing and rollout**: relationship isolation, privacy suppression, deterministic metric fixtures, AI failure fallback, regression tests for Mentorship Hub and Investor routes, desktop/mobile build validation.

## Initial API contract

- `GET /api/investor-intelligence/overview`
- `GET /api/investor-intelligence/startups/:startupId`
- `GET /api/investor-intelligence/changes`
- `GET /api/investor-intelligence/portfolio`
- `GET /api/investor-intelligence/risks`
- `GET /api/investor-intelligence/advisory/:scope`

All routes require server-side capability authorization and relationship scope. Responses distinguish deterministic facts from optional AI advisory content.

## Acceptance criteria

- Existing Mentorship Hub workflows remain unchanged and functional.
- Individual investors see only followed, evaluated, invested, or otherwise authorized startups.
- Institutional aggregation is available only for authorized portfolio/cohort relationships and privacy thresholds.
- Deterministic backend responses remain complete when AI Router is unavailable.
- AI output is clearly labeled advisory and cannot change access or canonical metrics.
- No new sidebar feature is required; intelligence is embedded in existing Investor surfaces.
