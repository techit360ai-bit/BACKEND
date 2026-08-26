# TechIT Customer Care & Support Operations

## Team Brief

**Date:** 2026-08-26  
**Scope:** BACKEND, AI Router, `new-frontend`, and `techit-admin-dashboard`  
**Status:** Implemented locally; production deployment verification remains environment-dependent.

## Executive Summary

TechIT now has an additive Customer Care and Support Operations layer built on the existing authentication, notification, persistence, messaging, storage, AI Router, and admin-dashboard architecture.

The system treats every complaint as a structured support case. Messaging exists inside that case, so the customer and support team can see ownership, status, SLA timing, resolution, and audit history in one place.

The implementation deliberately keeps deterministic business rules in BACKEND. AI Router is advisory only and cannot mutate cases, accounts, billing, credits, subscriptions, or security settings.

## What Was Delivered

### Customer experience

- Ticket icon beside messaging for every role.
- `/support` customer-care surface.
- Case creation with category, subject, and description.
- Stable ticket number format: `TKT-YYYY-NNNNNN`.
- Open-case and cooldown duplicate prevention.
- Case history, status, SLA deadline, replies, feedback, and reopening.
- Live SSE updates with ten-second polling fallback.
- Sensitive text masking before persistence and AI use.
- Attachment initialization/finalization through signed private storage URLs.

### Admin experience

- Admin `Messaging` navigation entry.
- Admin `Customer Care / Tickets` navigation entry.
- Queue search by case, user, email, organization, project, and transaction reference.
- Status, priority, assignment, escalation, locking, diagnostics, and reply workflows.
- Explicit internal-note mode; internal notes are hidden from customers.
- AI draft-response action requiring administrator review before sending.
- Support analytics, SLA-risk metrics, incident clusters, and configuration view.

### Backend operations

- Deterministic category and priority rules.
- Configurable SLA policies and business-hours clock.
- SLA breach escalation and resolution-grace auto-close.
- Configurable cooldown, retention, incident, category, team, template, and knowledge-base settings.
- Append-only support messages, events, and audit records at the application layer.
- PostgreSQL append-only triggers and RLS policies.
- SQLite and PostgreSQL additive migrations.
- S3-compatible signed upload and download flow with size/type validation and ClamAV reuse.
- Resend email notification adapter and optional push notification adapter.
- Paystack, Flutterwave, and Stripe verification adapters for entitlement reconciliation.
- Authenticated internal maintenance endpoint.
- Maintenance loop for SLA, retention, incidents, and closure.
- Product/Admin intelligence projection sourced from support evidence.

## Architecture and Ownership

```text
Customer / Admin UI
        |
        v
BACKEND support routes and service
        |
        +--> deterministic case state, SLA, permissions, audit, billing actions
        +--> existing notifications and private object storage
        +--> SSE case stream
        +--> product/admin intelligence projection
        |
        +--> AI Router (advisory only)
                 classification / summary / draft / escalation suggestion
```

### Source of truth

| Concern | Owner |
|---|---|
| Case state and status machine | BACKEND |
| Customer messages and internal notes | BACKEND support records |
| SLA and business-hours calculation | BACKEND |
| Permissions and corrective-action authorization | BACKEND |
| Billing/provider verification | BACKEND adapters |
| Attachment storage authorization | BACKEND + existing object-storage service |
| Customer notification intent | BACKEND notifications collection |
| Email/push delivery | BACKEND delivery adapters |
| AI classification and drafting | AI Router, advisory output only |
| Scheduled maintenance orchestration | AI Router Celery task calling BACKEND |
| Admin presentation | `techit-admin-dashboard` |
| Customer presentation | `new-frontend` |

## Bounded Support Intelligence

“Bounded support intelligence” is a constrained AI capability, not an autonomous support agent.

The AI Router may receive only the redacted information needed for the requested task:

- Case category, subject, status, and priority.
- Redacted customer messages.
- Approved knowledge-base snippets.
- Non-sensitive diagnostic summaries.

It may return:

- Suggested classification.
- Summary of the case history.
- Suggested escalation level.
- Draft response text.
- Confidence and limitations.

It must not:

- Change case status or ownership.
- Close or reopen a case.
- Refund a payment.
- Reissue credits.
- Change subscription entitlements.
- Change account or security settings.
- Expose raw private data.
- Send a customer message automatically.

The administrator reviews and sends any AI draft. BACKEND validates and executes every high-impact action.

AI Router task type:

```text
CUSTOMER_SUPPORT_INTELLIGENCE
```

Endpoint:

```text
POST /api/v1/support/intelligence
```

## Case Lifecycle

```text
RECEIVED
   -> TRIAGING
   -> PROCESSING
   -> WAITING_FOR_USER
   -> ESCALATED
   -> RESOLVED
   -> CLOSED
```

Recently resolved cases may be reopened. Closed cases are immutable historical records.

## Security and Privacy Controls

- Authenticated users can access only their own cases.
- Admin routes require admin authentication and explicit `support.*` permission.
- Internal notes are filtered from customer responses.
- Sensitive number and email patterns are masked in support text.
- Attachments use private signed URLs and are finalized through storage validation.
- Attachment type, size, signature, hash, and malware status are recorded.
- Corrective actions require explicit confirmation and a reason.
- Before/after state is recorded for corrective actions.
- PostgreSQL RLS scopes cases to the authenticated user or support administrator.
- PostgreSQL triggers reject updates/deletes on support evidence tables.
- Retention redaction creates a new audit event; it does not silently erase history.

## Configuration and Secrets

Required or relevant production configuration:

```text
CUSTOMER_SUPPORT_SYSTEM=1
BACKEND_SUPPORT_MAINTENANCE_SECRET=<32+ random characters>
EVIDENCE_STORAGE_ENDPOINT=<S3-compatible endpoint>
EVIDENCE_STORAGE_BUCKET=<private bucket>
EVIDENCE_STORAGE_ACCESS_KEY=<storage access key>
EVIDENCE_STORAGE_SECRET_KEY=<storage secret>
CLAMAV_HOST=<clamav service>
RESEND_API_KEY=<resend key>
FROM_EMAIL=TechIT <verified-domain-sender>
PUSH_NOTIFICATION_URL=<optional push adapter>
PAYSTACK_SECRET_KEY=<optional provider key>
FLUTTERWAVE_SECRET_KEY=<optional provider key>
STRIPE_SECRET_KEY=<optional provider key>
BACKEND_SUPPORT_MAINTENANCE_URL=https://api.example.com/api/support/internal/maintenance
```

Do not put provider keys, payment credentials, card data, CVV, tokens, or passwords into support records.

## Background Processing

The AI Router Celery worker exposes:

```text
workers.support_maintenance
workers.support_ai_reconciliation
```

`workers.support_maintenance` calls the authenticated BACKEND maintenance endpoint. BACKEND remains authoritative and can also run its local maintenance timer.

Maintenance covers:

- SLA breaches.
- Escalation notifications.
- Resolution-grace auto-close.
- Incident clustering.
- Retention redaction.

## API Surface

### Customer

```text
GET    /api/support/health
GET    /api/support/cases
POST   /api/support/cases
GET    /api/support/cases/:caseId
GET    /api/support/cases/:caseId/stream
POST   /api/support/cases/:caseId/messages
POST   /api/support/cases/:caseId/feedback
POST   /api/support/cases/:caseId/reopen
POST   /api/support/cases/:caseId/attachments/init
POST   /api/support/cases/:caseId/attachments/:attachmentId/finalize
GET    /api/support/knowledge-base
```

### Admin

```text
GET    /api/support/admin/overview
GET    /api/support/admin/cases
GET    /api/support/admin/cases/:caseId
GET    /api/support/admin/cases/:caseId/diagnostics
POST   /api/support/admin/cases/:caseId/lock
PATCH  /api/support/admin/cases/:caseId
POST   /api/support/admin/cases/:caseId/messages
POST   /api/support/admin/cases/:caseId/ai
POST   /api/support/admin/cases/:caseId/actions
POST   /api/support/admin/cases/:caseId/attachments/init
POST   /api/support/admin/cases/:caseId/attachments/:attachmentId/finalize
GET    /api/support/admin/config
PATCH  /api/support/admin/config
GET    /api/support/admin/analytics
GET    /api/support/admin/intelligence
POST   /api/support/admin/maintenance/run
POST   /api/support/admin/knowledge-base
POST   /api/support/admin/templates
```

## Testing Completed

Local checks currently passing:

- Backend startup-import contract check.
- Support unit, privacy, locking, corrective-action, and scale tests: `9 passed`.
- Frontend ESLint and production build.
- Admin dashboard typecheck and production build.
- AI Router Python compilation.
- AI Router model-routing tests: `9 passed`.
- SQLite migration dry-run.
- PostgreSQL support migration includes RLS and append-only triggers.

## Deployment Checklist

Before production rollout:

1. Merge the BACKEND, AI Router, frontend, and admin-dashboard commits through their normal review policies.
2. Configure storage, ClamAV, Resend, provider, push, and maintenance secrets.
3. Apply SQLite/PostgreSQL migrations in staging.
4. Run `npm run startup:check --prefix backend`.
5. Run backend, frontend, admin, and AI Router CI gates.
6. Start Celery worker and beat with the scheduled support task registered.
7. Verify `GET /api/support/health` from the deployed network.
8. Create a staging support case and verify acknowledgement, email/push delivery, SSE update, admin reply, internal note isolation, diagnostics, and closure.
9. Upload a test attachment and verify signature, malware, hash, and private-download checks.
10. Execute a provider sandbox entitlement reconciliation with explicit confirmation.
11. Verify RLS with two user identities and one support administrator.
12. Confirm metrics and incident signals appear in the admin dashboard.
13. Roll out behind `CUSTOMER_SUPPORT_SYSTEM` to internal admins first, then a limited user cohort.
14. Monitor SLA breaches, notification failures, storage quarantine, AI Router latency, and corrective-action audit events.

## Known External Blockers

Local implementation is complete and repositories are clean. Production verification still depends on:

- Remote CI availability and billing/runner health.
- A deployed PostgreSQL instance with the support migration applied.
- Production storage and ClamAV services.
- Verified email sender and push adapter configuration.
- Provider sandbox/production credentials.
- Deployment platform access and approval policies.

The team should not claim production readiness until those external checks pass in the target environment.

