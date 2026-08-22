# Investor Due Diligence + Deal Room Implementation Plan

## Fit With Existing TechIT

Discovery, startup cards, Request Intro, investor role/context, watchlists, deal-flow snapshots, trust/capability authorization, file validation, notifications, and the existing Investor section remain the source of truth. This work adds a permissioned deal layer after investor interest; it does not rebuild discovery, Mentorship Hub, authentication, billing, scoring, or the application shell.

The existing Investor sidebar remains unchanged. Deal Room entry is exposed from existing startup/deal surfaces and the current Investor dashboard through contextual links and panels.

## Backend-only deterministic rules

The Backend owns every rule that affects access or canonical state:

- relationship scope and investor/founder participant membership;
- NDA version, signature, expiry, and access gate;
- allowed deal state transitions;
- checklist statuses, ownership, due dates, and completion percentage;
- document visibility, version metadata, expiry, access/download auditing;
- Q&A thread/message visibility and assignment;
- institutional participant roles and internal-note/IC privacy;
- term-sheet fields, versioning, legal disclaimer, and sharing state;
- immutable deal status/audit events and notification payload safety.

The frontend only renders server responses and submits user intent. It cannot grant itself access by changing route parameters or local state.

AI Router integration, when added, receives a minimized backend-authorized evidence packet for optional narrative analysis only. It cannot authorize, mutate deal state, calculate permissions, or replace verified data labels.

## Delivery phases

1. **Plan and contract**: document current routes/models and commit this plan.
2. **Deal Room security core**: add deal records, participant scope, NDA state, deterministic state machine, and audit events.
3. **Diligence workspace**: add checklist, evidence/document metadata, versioning, visibility, and access logs using existing file/storage security boundaries.
4. **Collaboration**: add Q&A threads/messages, assignments, founder-visible versus investor-internal visibility, and notifications.
5. **Institutional review**: add internal notes, IC review, approval history, and team permissions without exposing them to founders.
6. **Deal execution**: add Investor Pack summary metadata, template term-sheet versions with mandatory disclaimer, and closing-readiness state.
7. **Investor UI integration**: add contextual pipeline/deal-room pages under the existing Investor routes with no sidebar expansion.
8. **AI advisory and reports**: only after deterministic evidence is stable; use existing AI Router/BillingGuard contracts.
9. **Testing and migration**: relationship isolation, NDA gates, invalid transitions, document privacy, founder/internal-note separation, audit, and regression tests.

## Initial backend contract

- `POST /api/investor-deals`
- `GET /api/investor-deals`
- `GET /api/investor-deals/:dealId`
- `POST /api/investor-deals/:dealId/nda/sign`
- `POST /api/investor-deals/:dealId/status`
- `GET/POST /api/investor-deals/:dealId/checklist`
- `PATCH /api/investor-deals/:dealId/checklist/:itemId`
- `GET/POST /api/investor-deals/:dealId/documents`
- `GET/POST /api/investor-deals/:dealId/questions`
- `POST /api/investor-deals/:dealId/questions/:questionId/messages`
- `GET/POST /api/investor-deals/:dealId/internal-notes`
- `GET/POST /api/investor-deals/:dealId/ic`
- `GET/POST /api/investor-deals/:dealId/term-sheet`

All protected endpoints resolve identity, active investor context, relationship, participant role, and NDA state server-side.

## Completion criteria

- Existing Investor Hub and Mentorship Hub remain functional.
- A founder cannot read investor-internal notes or IC content.
- An investor cannot read another investor's Deal Room.
- Protected deal content is inaccessible until the current NDA is signed.
- Invalid deal transitions fail deterministically and are audited.
- Every datum has a source label or is explicitly unavailable.
- No sensitive content is sent to public Feed, search, ordinary notifications, or analytics exports.
- All local tests and frontend build pass before delivery.
