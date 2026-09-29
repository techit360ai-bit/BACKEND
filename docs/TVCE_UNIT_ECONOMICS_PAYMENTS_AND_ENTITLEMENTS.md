# TVCE Unit Economics, Payment Logic, and Tier Entitlements

**Audience:** platform / finance / product team
**Status:** working note for analysis (not a price sheet)
**Date:** 2026-09-29
**Scope:** TechIT account wallet, TVCE capability gating, credit pricing, checkout and webhook lifecycle, tier/entitlement packaging.

> Numbers marked *(illustrative)* are migration defaults / starting anchors and must be confirmed against live FX, provider fees and observed cohort behaviour before they are treated as commercial commitments.

---

## 1. Authority model — who owns what

Billing is intentionally split so no service invents money or permissions:

```text
Platform Backend (Node) + TVCE        -> identity, active role/context, capability decision,
                                         account wallet, subscriptions, entitlements, usage settlement
TECHIT-PAYMENT-GATWAY                 -> geo pricing, rate cards, checkout, provider adapters,
                                         webhook verification, reconciliation, invoices, COGS/margin
AI Router (ai-router, FastAPI)        -> execution only (model/provider routing). Never reads
                                         balances and never decides whether something is paid.
```

Key sources of truth:

- Capability catalog + free quotas: `BACKEND/config/tvce-commercial.json`
- Entitlement/paywall engine: `BACKEND/backend/src/services/tvceService.js`
- Checkout + provider sessions: `BACKEND/backend/src/services/tvceCheckoutService.js`
- Webhook lifecycle (advance/renew/refund/dispute): `BACKEND/backend/src/services/tvceBillingService.js`, `BACKEND/backend/src/routes/billingWebhooks.js`
- Unit economics / rate cards: `BACKEND/backend/src/services/unitEconomicsService.js`
- Workspace team grant: `BACKEND/backend/src/services/workspaceTeamEntitlementService.js`
- Wallet reads/fulfilment: `BACKEND/backend/src/repositories/financeRepository.js`
- Routing + TVCE contract: `TECHIT-PAYMENT-GATWAY/docs/TVCE_BILLING_ALIGNMENT_REPORT.md`
- Free role boundaries: `BACKEND/docs/TVCE_FREE_ROLE_ACCESS_PLAN.md`

Wallets, purchases, subscriptions and account entitlements are **account-level, keyed by TechIT identity** — not per role. Activating Founder / Collaborator / Investor / Organization does not create a second balance. The **active role and workspace/organization context** still gate every capability.

---

## 2. Unit economics

### 2.1 Credit value and cost model

Defined in `unitEconomicsService.js`:

```text
CREDIT_VALUE_USD      = 0.025   # 1 TechIT credit = $0.025 customer-facing value
DEFAULT_TARGET_MARGIN = 0.60
MINIMUM_MARGIN_FLOOR  = 0.50
```

Provider/infrastructure cost is **not** the credit value. Per request:

```text
provider_cost       = input_tokens*input_rate + output_tokens*output_rate + cached_tokens*cached_rate
direct_service_cogs = provider_cost + infrastructure_cost + external_cost
total_variable_cost = direct_service_cogs + payment_cost
required_revenue    = direct_service_cogs / (1 - target_margin)
required_credits    = max(minimum_charge_credits, ceil(required_revenue / 0.025))
```

Margin policy: target **60–65%** on paid work; **45–55%** acceptable for infrastructure-heavy services (deployment, storage, video, human review). Free usage is acquisition subsidy and is reported separately — it is never forced to meet the paid margin floor. Flag `warning` below 60% and `critical` below the 50% floor.

### 2.2 Default rate cards *(illustrative, versioned in code)*

| Service | Input $/M tok | Output $/M tok | Cached $/M tok | Infra cost (USD) | Target margin | Min credits |
|---|---:|---:|---:|---:|---:|---:|
| `BASIC_AI_ACTION` | 0.15 | 0.60 | 0.03 | 0.0015 | 0.60 | 1 |
| `IDEA_DIAGNOSTICS_BASIC` | 0.15 | 0.60 | 0.03 | 0.002 | 0.60 | 2 |
| `CUSTOMER_VALIDATION_BASIC` | 0.15 | 0.60 | 0.03 | 0.003 | 0.60 | 3 |
| `MVP_PLANNING_BASIC` | 0.15 | 0.60 | 0.03 | 0.005 | 0.60 | 5 |
| `workspace_creation` | 0 | 0 | 0 | 0.02 | 0.50 | 2 |
| `collaborator_matching` | 0.15 | 0.60 | 0.01 | 0.01 | 0.55 | 4 |
| `default` | 0 | 0 | 0 | 0.0015 | 0.60 | 1 |

Rate cards are meant to be **versioned registry rows** (per provider/model/tier), and every quote, reservation and settlement should store the exact `rate_card_version` used. Unknown task types deliberately keep the reservation and telemetry but do **not** invent revenue/margin (`marginStatus: 'unconfigured'`).

**Anchor example:** a $0.30 COGS at 60% target margin needs `$0.30/(1-0.60) = $0.75` revenue → `ceil(0.75/0.025) = 30` credits.

### 2.3 Recommended pack tiers and geo anchors *(illustrative)*

- Global minimum checkout ≈ **$3** equivalent.
- Starter pack ≈ **$8** equivalent → **320 credits** face value.
- Higher tiers: **$15 / $30 / $75 / $150** equivalents, with optional volume bonus credits.
- Market anchor example: **2,000 NGN ≈ $8 ≈ 320 credits** — the local amount must be computed from the current FX quote, a country multiplier, taxes/fees and a rounding rule. **Do not hard-code 2,000 NGN as a universal FX rate.**
- Provider cost stays in USD and is **never** multiplied by a country multiplier. Only customer-facing pack prices, subscription prices and local credit value are geo-adjusted.

---

## 3. Payment logic

### 3.1 Funding order (must be explicit, never silent)

```text
free capability quota  (only for free-eligible work)
  -> subscription allowance   (if explicitly selected and available)
  -> PAYG wallet              (if explicitly enabled by user/workspace policy)
  -> paywall
```

The system must **never** silently charge PAYG after a subscription allowance is exhausted; the funding source is chosen by the entitlement decision and echoed back to the caller. Normal user messaging / workspace chat / collaboration messages are free. Workspace creation and collaborator matching are billable service operations.

### 3.2 Checkout → webhook → fulfilment lifecycle

1. Client asks TVCE to evaluate (`POST /api/tvce/paywall/evaluate`) → decision includes `allowed`, `paywall`, `code`, funding source, estimate.
2. On a paid path, a **hosted checkout session** is created (`tvceCheckoutService.js`) with Stripe / Paystack / Flutterwave; the user is redirected to the provider.
3. The provider posts to `POST /api/billing/webhooks/:provider`. The handler verifies the signature, de-dupes by event id, and drives the lifecycle (`tvceBillingService.js`): advance / renew / refund / dispute.
4. On a successful `completed` payment, credits are fulfilled to the account wallet (`financeRepository`), and entitlement is granted.
5. Usage is settled against the reservation; settlement never exceeds the approved reservation.

### 3.3 Free allowance (canonical, monthly, no carry-over)

From `tvce-commercial.json` (capability counters, reset to quota each cycle):

| Capability | Monthly free allowance |
|---|---:|
| Basic AI actions | 20 |
| Idea diagnostics | 5 |
| Customer validation sessions | 3 |
| Short MVP plan | 1 |
| GSIS refreshes | 3 |
| Startup-health checks | 2 |
| Production deployment | 0 / unavailable |

Free requests are restricted to the allowlisted lightweight model pool with context/output limits; a restricted request returns a **structured paywall before the Router is called**.

---

## 4. Tier entitlements

### 4.1 Capability matrix by role

| Role | Free / included | Runtime-funded (PAYG) | Subscription-only / licensed |
|---|---|---|---|
| **Founder** | basic diagnosis, validation, short MVP plan, GSIS/health baseline, basic Copilot, profile/progress | advanced diagnosis/validation, advanced workspace AI, code analysis, execution/review, collaborator matching, workspace creation | higher workspace limits, autonomous execution, deployment automation, team grants |
| **Collaborator** | profile, **one active collaborator workspace**, assigned tasks, permitted files/reports, contribution evidence, basic Copilot allowance | advanced Copilot, code analysis, execution/review, connectors | multiple workspaces, advanced AI allowance, deployment automation |
| **Investor** | profile, public discovery, basic public profiles, limited watchlist, permitted messaging | investor intelligence, risk analysis, diligence, data-room analysis, founder contact | portfolio intelligence, recurring monitoring, full deal-room ops, continuous verification |
| **Organization** | profile/verification, basic dashboard, one basic program/cohort, limited onboarding, basic cohort/reporting | monitoring, cohort intelligence, mentor intelligence, AI ops, generated reports | managed hackathons, sponsor management, integrations, white-label, institutional support |
| **All roles** | normal messaging and platform chat | named AI/service operations only | capability-specific licensed features |

Organization limits (programs, cohorts, hackathons, participants, reports, storage, seats) are **domain/licence limits, not credit prices**, and remain authoritative in `organizationEntitlements` / `organizationBudgets`.

### 4.2 Subscription packaging *(illustrative global starting packages)*

| Package | Reference price | Face-value credit ceiling | Included non-credit value |
|---|---:|---:|---|
| Founder Builder | $19/mo | 760 credits | standard Founder capabilities, higher limits |
| Founder Pro | $59/mo | 2,360 credits | advanced workspace/AI access |
| Founder Team | $99/mo | 3,960 pooled credits | one Founder workspace team grant |
| Organization Growth | $249/mo | 9,960 pooled credits | programs, seats, reporting limits |
| Organization / Enterprise | custom | custom | managed operations, integrations, SLA |

These are **face-value ceilings, not automatic allowances.** Whatever part of the price is allocated to storage, seats, priority, deployment or support reduces the portion that becomes included credits; that allocation must be stored explicitly in admin configuration.

Subscriptions are **optional packaging over the same account wallet** — PAYG must work with no subscription.

### 4.3 Workspace team grant (Founder Team)

`workspaceTeamEntitlementService.js` provides a workspace-scoped pooled grant:

- owner: the subscribing Founder identity;
- scope: exactly one Founder-owned workspace (or an explicitly configured set);
- eligible users: **active collaborators in that workspace only**;
- grant: advanced workspace capabilities + pooled subscription allowance;
- lifecycle: follows subscription + membership status; every grant/use/revocation is audited;
- hard rule: the grant never confers a role, organization membership, cross-workspace access, or a separate collaborator wallet.

### 4.4 Geography and provider routing *(illustrative)*

| Market | Primary options | Fallback |
|---|---|---|
| Nigeria, Ghana, Kenya, ZA, Egypt | Paystack, Flutterwave | Stripe where supported |
| Francophone W/C Africa | Flutterwave, Orange Money / MTN MoMo / Wave | Card / Paystack |
| East Africa | M-Pesa / Airtel via licensed aggregator, Flutterwave | Card / Stripe |
| India | Razorpay, Cashfree, PayU, UPI | Stripe intl card |
| Singapore | Stripe, Adyen, HitPay/2C2P | card wallets |
| Thailand | Opn/Omise, 2C2P, local bank/QR | Stripe intl card |
| Europe / UK | Stripe, Adyen, Mollie (EUR/GBP) | card |
| Other | Stripe or approved regional PSP | manual / invoice |

Missing country/provider coverage must return a machine-readable `provider_unavailable` and suggest the next configured provider — never silently route through an incompatible currency or PSP.

---

## 5. Current gaps to resolve (so the team prices against reality)

1. **Wallet UI does not exercise the real billing path.** `new-frontend/frontend/src/TechitWallet/Wallet.tsx` → `selectPackage()` → `createWalletPaymentIntent` (`src/lib/api/wallet.ts`) hits `POST /api/domain/wallet/payment-intents`, whose handler (`createPaymentIntent` in `BACKEND/backend/src/services/domainService.js`) only inserts a `paymentIntents` row with `status: 'pending'` and **no provider call and no `checkoutUrl`**. Buying credits therefore never reaches a hosted checkout.
2. **The only real checkout call is dead code.** `new-frontend/frontend/src/components/PaymentModal.tsx` calls `createTvceCheckout()` (real Stripe/Paystack/Flutterwave session) but the component is imported nowhere.
3. **Wallet summary gaps are real, not cosmetic.** `fetchWalletAnalytics()` targets `GET /wallet/analytics`, which is **not routed** in `BACKEND/backend/src/routes/domain.js`, and `walletSummary()` in `financeRepository.js` does not return `subscriptionUsage`, `freePlan`, `sourceTotals` or `deductionOrder`. Hence the Wallet "Unavailable" cards.
4. **Subscription upgrade is not exposed.** The Wallet "Upgrade" button toasts `"Upgrade checkout is not exposed by the current billing API."`
5. **Known engine defects** recorded in `TechIT_AI_Router_Billing_Engineering_Deep_Dive.md` (double-charge path, advertised vs executed credit cost, Stripe completion not crediting the wallet, plan-definition conflicts, monthly-reset mismatch, split billing state across services). These should be closed before go-live pricing.

---

## 6. Decisions requested from the team

1. Confirm `1 credit = $0.025` and the 60% target / 50% floor margins as commercial policy.
2. Approve or revise the subscription tiers and credit ceilings, and specify the **credit-value allocation** inside each price.
3. Confirm the free allowance (20 / 5 / 3 / 1 / 3 / 2) and whether GSIS/health counts belong in the same monthly reset as AI actions.
4. Approve the minimum checkout ($3) and pack ladder ($8 / $15 / $30 / $75 / $150).
5. Decide priority for wiring the Wallet UI to the real TVCE checkout + adding the `/wallet/analytics` route.
