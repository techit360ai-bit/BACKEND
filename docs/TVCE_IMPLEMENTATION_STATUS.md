# TechIT Value Conversion Engine Status

This document maps the supplied TVCE build prompt to the implementation in
the current Backend and frontend branches.

## Phase Status

| Phase | Status | Implementation |
| --- | --- | --- |
| 0. Codebase audit | Complete | Existing role, wallet, usage, context, router, and frontend surfaces were retained. |
| 1. Unified capability model | Implemented | `tvceService.js` provides a centralized catalog with role, access, cost, workflow, value, and blocked-message metadata. |
| 2. Entitlement engine | Implemented | Server-side account entitlement, role/context authorization, subscription, credit, and funding decisions are returned by TVCE APIs. |
| 3. Access types | Implemented | Free capabilities, credit unlocks, subscription access, role gates, and organization/investor separation are represented. |
| 4. Free-to-paid map | Implemented | Explorer/basic and Founder/Investor/Organization capability entries are registered. |
| 5. Workspace capabilities | Implemented at route boundary | Mutating runtime, execution, bridge-grant, review, apply, and deployment paths now use TVCE capability gates; basic file/read paths remain free. |
| 6. Organization capabilities | Implemented at policy/API boundary | Organization capabilities require active organization role/context and higher funding. |
| 7. Investor capabilities | Implemented at policy/API boundary | Investor capabilities require active investor role/context and higher funding. |
| 8. Value-aware paywall | Implemented | `POST /api/tvce/paywall/evaluate` and `ValueUnlockModal` provide contextual outcomes and next actions. |
| 9. Personalized recommendation | Implemented | Repeated paywall events and role determine credit vs subscription recommendations. |
| 10. Value meter | Implemented | `GET /api/tvce/progress` computes the persisted idea, validation, execution, and investor readiness dimensions; frontend wallet renders it. |
| 11. Next best action | Implemented | `GET /api/tvce/next-best-action` returns role-aware recommended work and access method. |
| 12. Wallet intelligence | Implemented at API boundary | `GET /api/tvce/wallet/forecast` reports active workflows, projected credits, coverage, and shortfall. |
| 13. Payment flow | Implemented at backend boundary | Idempotent intent creation, signed Stripe/Paystack/Flutterwave webhook verification, event deduplication, fulfillment, account entitlement activation, subscription creation, credit ledgering, and workflow resume are implemented. Hosted checkout creation remains provider-specific. |
| 14. Payment failure | Partial | Pending workflow snapshots are preserved; provider-specific retry UI/webhooks remain to be connected. |
| 15. Low connectivity | Implemented at idempotency boundary | Payment intents, workflow saves, and capability consumption use idempotency keys. |
| 16. Credit ledger | Implemented | Purchases and usage settlement are recorded as ledger events; capability consumption is idempotent. |
| 17. Subscription entitlement | Implemented at webhook boundary | Active, trialing, grace-period, cancellation, and subscription-update events are normalized; invoice and provider-specific billing policy fields remain configurable. |
| 18. Admin controls | Partial | Capability policies remain admin-configurable; a complete TVCE commercial admin UI is not yet present. |
| 19. Analytics funnel | Implemented at API boundary | Paywall events are persisted and `GET /api/tvce/analytics/funnel` returns stage counts and capability dimensions. |
| 20. Conversion metrics | Partial | Core event storage and funnel counts exist; admin cohort/revenue reporting remains. |
| 21. Ethical monetization | Implemented in contract | The paywall exposes real capability/value metadata and preserves work; no fabricated findings are generated. |
| 22. UI design system | Implemented | The contextual modal uses existing frontend primitives and wallet routing. |
| 23. Core journeys | Implemented at service boundary | Free-to-paid evaluation, contextual recommendation, payment fulfillment, workflow preservation, and resume are covered; hosted checkout UI remains provider-specific. |
| 24. Access matrix | Implemented in backend catalog | TVCE catalog entries are machine-readable rather than documentation-only. |
| 25. API contracts | Implemented | Entitlements, capability evaluation, paywall evaluation/events, estimates, forecast, next action, workflow save/resume, and fulfillment routes are exposed under `/api/tvce`. |
| 26. Acceptance criteria | Partial | Core authorization, role isolation, provider webhook idempotency, value paywalls, progress, workspace gates, and resume behavior are covered; hosted checkout UX and admin revenue dashboards remain. |

## Account-Level Purchase Rule

`accountEntitlements` is shared by the identity, not by role. A verified credit
purchase or subscription creates one active account entitlement that applies to
all activated roles. Investor and organization capabilities still require the
matching active role/context and their higher role funding threshold or
role-appropriate subscription.

The AI Router remains execution-only. It must receive backend-issued execution
grants and never make commercial entitlement decisions itself.
