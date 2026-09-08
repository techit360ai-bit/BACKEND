# TechIT Distribution Architecture Map

## Decision

TechIT already contains the majority of product-growth primitives. The
distribution layer is therefore an extension of the existing TechIT Moments,
invitation, notification, discovery, feed, TVCE, wallet, and admin analytics
systems rather than a second referral or sharing platform.

## Existing capability map

| Capability | Existing owner | Reuse point |
|---|---|---|
| Share moments and public previews | `techitMomentsService`, `/api/moments` | Generate outcome prompts, social URLs, public preview pages |
| Workspace/mentor/org invitations | domain, mentorship, organization services | Preserve invitation validation and membership authority |
| Feed/community distribution | discovery and messaging backends | Publish only explicitly public artifacts |
| Notifications | notification/support services | Deliver sparse share and invitation prompts |
| Referral analytics | admin dashboard and analytics server | Consume standardized growth events |
| Wallet/credits/subscriptions | TVCE/finance services | Reward only through existing entitlement/ledger rules |
| Onboarding | auth/frontend contexts | Accept referral context as optional input |
| Public URLs/deep links | frontend routes and Moments | Route unauthenticated viewers to preview then signup |

## Cross-repository fit

| Repository | Existing logic | Distribution extension |
|---|---|---|
| `BACKEND` | authoritative identity, permissions, Moments, domain milestones, invitations, TVCE and analytics events | `distributionIntelligenceService`, privacy checks, attribution lifecycle, growth metrics and APIs |
| `ai-router` | deterministic scoring, validation, GSIS, trust and execution outputs | remains an output producer; it does not publish, attribute, authorize or reward shares |
| `new-frontend` | Moments prompt/card, public Moment route, auth/onboarding, feed sharing, PWA resilience | preserves current components, adds referral-aware signup context and typed distribution API |
| `techit-admin-dashboard` | referral/collaboration analytics and operational panels | existing referral dashboard is the first consumer; future panels can consume `/api/distribution/metrics` |
| `messaging-backend` | realtime feed and workspace messaging | remains the transport for explicitly public feed distribution and invitations |

## New shared contract

`distributionIntelligenceService` adds only the missing cross-module contract:

- privacy-checked `distributionObjects`
- share and click records
- referral attribution through signup and activation
- standardized growth events
- share rate, activation rate, and K-factor metrics

Source ownership remains with the producing domain. The service never copies
private startup intelligence into a public object and never grants billing,
role, workspace, or organization access.

## Trust boundaries

1. Authenticated producer -> distribution API: ownership and visibility checks.
2. Public viewer -> preview/click API: only PUBLIC, non-expired objects.
3. Signup -> attribution activation: one referral can bind to one account.
4. Admin -> metrics: aggregate events only; no private artifact payloads.

## Initial end-to-end loop

Founder milestone or diagnostic -> existing TechIT Moment -> public preview ->
distribution click attribution -> signup -> `account_created` activation ->
admin funnel metrics. Workspace, mentor, organization, investor, QR, and
partner flows can adopt the same contract incrementally without changing their
existing invitation or billing implementations.

## Explicit non-goals

- no duplicate referral ledger
- no duplicate invitation system
- no automatic publication of private data
- no reward issuance in this foundation wave
- no social-provider SDK requirement
