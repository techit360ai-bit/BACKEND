# Engineering Plan: Cohort Collaboration, Intelligence Harmonization, Role Addition Gates & S3 Pipeline

**Target Repositories**: `BACKEND`, `new-frontend`  
**Base Branch**: `origin/main`  
**Feature Branches**:
- `BACKEND`: `feat/cohort-collaboration-and-role-gates`
- `new-frontend`: `feat/cohort-collaboration-and-navigation-harmonization`

---

## 1. Context-Aware Intelligence Anomaly Remediation
### Issue
Founders' momentum decay status (`Momentum decay: 100% — Investors can see inactivity on your profile.`) and founder checkpoints were leaking across all roles (Investor, Organization, Collaborator) because:
1. `sessionContext` in `BACKEND/backend/src/controllers/contextController.js` evaluated static `req.user.role` instead of checking `activeContext` or query/header role parameters.
2. `WelcomeBack.tsx` in `new-frontend` defaulted to `founder` theme and did not supply the current view role to `fetchSessionContext()`.
3. `contextService.js` always computed founder decay when the role resolved to founder.

### Fix
- **Backend**:
  - `contextController.js`: Read `req.query.role` or active context via `getActiveContextAsync(req.user.id)` before falling back to `req.user.role`.
  - `contextService.js`: Compute `decayStatus` strictly when the active role is `'founder'`. Provide customized contextual intelligence summaries for `'investor'`, `'organisation'`, and `'collaborator'`.
- **Frontend**:
  - `WelcomeBack.tsx`: Accept `role` prop and pass to `fetchSessionContext({ role })`.
  - Pass role explicitly from `OrgDashboard`, `InvestorDashboard`, `CollabDashboard`, and `FounderDashboard`.

---

## 2. Navigation Logic Harmonization Across Roles
### Issue
- `FounderLayout` and `CollabLayout` possessed a top desktop header with `<TopBarRoleMenu />` (context switcher, wallet, profile quick link).
- `InvestorLayout` and `OrgLayout` completely lacked this top header, leaving institutional users stranded without role switching.
- Mobile quick action headers were inconsistent across layouts.

### Fix
- Add standardized desktop `<header>` with `<TopBarRoleMenu />` to `OrgLayout.tsx` and `InvestorLayout.tsx`.
- Standardize `RoleMobileMenu` header actions (Messages, Support, Profile) across all 4 layouts.
- Normalize design tokens in `InvestorLayout.tsx` to align with the core design system.

---

## 3. Profile Upload Fix & S3 Storage Architecture
### Issue
- `uploadProfileAvatar()` in `new-frontend/frontend/src/lib/api/users.ts` used unauthenticated `fetch` without `credentials: 'include'` and missing `X-CSRF-Token`.
- Direct browser PUT to S3 was subject to CORS errors causing `TypeError: Failed to fetch`.
- `evidenceStorageService.js` only checked `EVIDENCE_STORAGE_*` environment variables and omitted `image/webp`.

### Fix
- **Backend**:
  - Expand `storageConfig()` in `evidenceStorageService.js` to recognize standard AWS variables (`AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ENDPOINT_URL_S3`).
  - Add `image/webp` to supported MIME types and binary magic checks.
  - Add direct multipart server proxy endpoint `POST /api/users/me/avatar/upload` as an automated fallback if direct S3 client upload fails.
- **Frontend**:
  - Send session credentials and CSRF tokens in avatar upload URL requests.
  - Add resilient fallback: if direct presigned URL PUT fails with a network/CORS error, upload seamlessly via the backend S3 proxy endpoint.

---

## 4. Role Addition Verification & Onboarding Gates
### Issue
Users adding Organization or Investor roles in `RoleAdditionPanel.tsx` immediately received active status without undergoing the platform's required KYC, accreditation, and onboarding verification.

### Fix
- **Backend**:
  - In `capabilityAuthorization.js` and `multiRoleContextService.js`, when activating `organization` or `investor`, assign `status = 'pending_verification'` (or `'onboarding'`) with assurance `'CLAIMED'`.
  - Automatically create a `verificationRequest` and `verificationProfile` in status `'in_review'`.
  - Gate operational permissions so high-trust capabilities remain locked until verified.
- **Frontend**:
  - In `RoleAdditionPanel.tsx`, prevent immediate active switching for institutional roles; route the user to `/org/onboarding/step-1` or `/investor/onboarding/step-1` to initiate verification.

---

## 5. Cohort Live Classes, In-Mails, Group Chat & Assignments
### User Mandate
- Organizations can schedule live classes, broadcast notifications and in-mails, host cohort WhatsApp-style group communication, and issue/receive assignment submissions.
- Must integrate directly into the UI of both Founders and Collaborators who belong to a cohort so they naturally chat, receive announcements, and submit assignments from:
  1. Their **Messaging section** (`/founder/messages`, `/collaborator/messages`, `/feed/messages`).
  2. Their **Feed section** (`/feed`).
  3. Their **Cohort / Incubator Hub** views (`/org/incubator`).
- Accomplished **without adding new navigation bars or side features**.

### Implementation Architecture
1. **Backend Endpoints (`organizationIntelligence.js` & `messaging`)**:
   - `GET /api/organization/cohorts/:cohortId/hub`: Full cohort hub snapshot (classes, assignments, group messages, announcements).
   - `POST /api/organization/cohorts/:cohortId/classes`: Schedule a live class.
   - `GET /api/organization/cohorts/:cohortId/classes`: List upcoming & recorded classes.
   - `POST /api/organization/cohorts/:cohortId/broadcast`: Send in-mail & notification to all cohort members.
   - `GET /api/organization/cohorts/:cohortId/messages`: Fetch WhatsApp-style cohort group discussion.
   - `POST /api/organization/cohorts/:cohortId/messages`: Post message/file into cohort group chat.
   - `POST /api/organization/cohorts/:cohortId/assignments`: Create cohort assignment.
   - `GET /api/organization/cohorts/:cohortId/assignments`: List assignments with member submission status.
   - `POST /api/organization/cohorts/:cohortId/assignments/:assignmentId/submit`: Member submits assignment.
   - `GET /api/organization/cohorts/my-cohorts`: Lists cohorts the current user (founder or collaborator) belongs to.
2. **Frontend Porting**:
   - In `Incubator.tsx`: Interactive Cohort Workspace with tabs for Live Classes, Group Discussion, Assignments, and In-Mail Broadcasts.
   - In Messaging (`FounderMessages`, `CollabMessages`, `FeedMessages`): Automatically surface the user's active cohorts as interactive group conversations with live class join links and assignment submission badges.
   - In Feed (`FeedPage.tsx`): Surface cohort broadcast announcements and upcoming live class alerts in the contextual feed view.
