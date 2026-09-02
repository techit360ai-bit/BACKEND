# TVCE Payment Engineer Report

## Delivered

TVCE is implemented as a server-authoritative value-conversion layer over the existing identity, multi-role context, wallet, credit ledger, subscription, payment-intent, workspace, and AI execution systems. The canonical implementation is on branch `feat/tvce-value-conversion-complete` (commit `c627b40`), with the frontend companion on the same branch (commit `9da0e4d`).

## Account and role rule

A verified credit purchase or subscription creates one `accountEntitlements` record for the user identity. That paid account state is shared across all activated roles. Payment never grants a role: investor and organization actions still require the matching active role/context and their higher funding threshold or role-appropriate subscription. This prevents a multi-role user from having to buy separate access for each account role while preserving role isolation.

## Data ownership

`tvceService.js` owns capability catalog, entitlement evaluation, contextual paywall decisions, wallet forecasts, progress, next-best-action, workflow snapshots, fulfillment, and TVCE analytics. `tvceBillingService.js` owns provider normalization, signature verification, webhook deduplication, subscription lifecycle normalization, and delegation to fulfillment. The AI Router remains execution-only and receives backend-issued grants.

Persisted collections used by TVCE are `accountEntitlements`, `subscriptions`, `paymentIntents`, `creditLedger`, `billingWebhookEvents`, `paywallEvents`, and `workflowSnapshots`. Credit changes are ledger events; successful payment fulfillment and credit allocation are idempotent on payment id.

## Provider webhook contract

Endpoints:

```text
POST /api/billing/webhooks/stripe
POST /api/billing/webhooks/paystack
POST /api/billing/webhooks/flutterwave
```

Stripe uses the raw request body and `STRIPE_WEBHOOK_SECRET`. Paystack uses `x-paystack-signature` and `PAYSTACK_SECRET_KEY`. Flutterwave validates its configured webhook hash/signature settings. Normalized successful events resolve the user and payment intent, record a `billingWebhookEvents` row, mark the payment successful, allocate credits, activate/update subscription state, activate account entitlement, and resume the saved workflow. Duplicate provider event IDs return an idempotent result without double allocation.

## APIs

User-facing TVCE routes are under `/api/tvce`: capabilities, entitlements, entitlement checks, paywall evaluation/events, credit estimates, wallet forecast, progress, next-best-action, funnel, workflow save/resume, and verified payment fulfillment. Admin reporting is protected by `requireAdminAuth` and `requireAdmin`:

```text
GET /api/admin/tvce/analytics?period=all|30d
```

The response includes successful payment and revenue totals, credit buyers, active subscriptions, webhook processed/failed counts, workflow resume rate, funnel stage counts, paid cohorts, role cohorts, and capability conversion. It is sourced only from persisted TVCE records and returns zero/empty cohorts when no events exist.

## Admin dashboard

The existing Revenue & Retention screen now includes a TVCE Conversion Reporting section. It renders paid accounts, credit buyers, subscriptions, webhook health, workflow resume rate, funnel stages, role cohorts, capability conversion, and paid cohorts. No performance claims are hardcoded; amounts are labeled as stored provider units where currency/minor-unit metadata is not available.

## Frontend reliability

The nine offline/mock failures were resolved. Unit-test setup clears local integration `.env` strict flags so tests can explicitly exercise fallback and strict modes. Messaging response parsing accepts both standard `Response.text()` and lightweight `json()` mocks. The full frontend suite now passes 50 files and 178 tests; TypeScript and production build pass.

## Deployment and configuration

Configure `JWT_SECRET`, provider webhook secrets, provider account/API credentials, plan/package identifiers, `CORS_ORIGINS`, and the deployed frontend API URLs. Webhook routes must receive the unmodified request body through the reverse proxy. Provider-hosted checkout session creation is intentionally configuration-dependent: merchant account IDs, secret keys, price/plan IDs, and redirect URLs must be supplied in the deployment environment; no credentials are committed.

## Verification

Backend TVCE and billing tests pass, including shared multi-role entitlement, higher investor funding, workflow resume, Stripe signature verification, Paystack rejection, webhook idempotency, and admin analytics aggregation. The admin dashboard production build passes. The frontend full suite passes 178/178 tests.

## Operational caveats

Provider settlement policy (invoice retries, disputes, refunds, tax, and currency normalization) remains deployment-specific. Admin analytics reports the fields present in the persisted store and does not fabricate missing attribution, CAC, or cohort retention data.
