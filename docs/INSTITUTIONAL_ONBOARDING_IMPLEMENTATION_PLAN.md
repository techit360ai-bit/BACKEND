# Institutional Onboarding, Program Management & AI Application Intelligence — Implementation Plan

**Scope:** Extension of TechIT Network's existing Organization section, Program management, Institutional Community bulk import, Account matching/invitations, Unique program application links, and AI Application Evaluation Agents without adding new sidebars or duplicate dashboards.

---

## 1. Codebase Audit: What We Already Have

| System Component | Existing Assets & Paths | Extension Strategy |
|---|---|---|
| **Organizations & Programs** | `organizations`, `organizationPrograms`, `organizationMemberships`, `organizationEntitlements` | Extend `organizationPrograms` with eligibility criteria, scoring weights, evaluation frameworks, and unique application slugs. |
| **Opportunities & Applications** | `/opportunities`, `opportunityApplications`, `fetchCollaboratorOpportunities` | Reuse opportunity pipeline for public program applications, connecting unique application links (`/programs/:programId/apply`) to the shared application workflow. |
| **AI Router & Evaluation** | `ai-router/` agent orchestration, `ventureAnalyses`, scoring kernels | Implement AI program configuration & application evaluation service leveraging existing AI router endpoints for multi-factor scoring and document intelligence. |
| **Workspace & Execution** | `workspaces`, `workspaceTasks`, execution tracking | Connect selected program participants to workspace execution and milestone deliverables. |

---

## 2. What Needs to be Implemented (Complementary Backend & AI Router Integrations)

### Phase 1: Institutional Community Import & Account Matching
- **Data Model**: Add `organizationContacts` (or extend `organizationCommunity`) for staging bulk-imported member/beneficiary records (CSV/JSON).
- **Service & API**:
  - `POST /api/domain/organization/community/import` (bulk import database/CSV records).
  - Intelligent account matcher against existing TechIT `profiles` to prevent duplicates and generate secure claim/invitation tokens (`membershipInvitations`).

### Phase 2: Program Management & Unique Application Links
- **Data Model**: Enhance `organizationPrograms` schema to support program guidelines, eligibility gates, supporting document requirements, criteria weights, and unique application slugs.
- **Service & API**:
  - `POST /api/domain/organization/programs` (create/configure program).
  - `POST /api/domain/programs/:programId/apply` (public progressive application endpoint allowing submissions without mandatory pre-registration).

### Phase 3: AI Program Configuration & Application Evaluation Agent
- **Data Model**: Add `programEvaluations` or extend `opportunityApplications` with structured evaluation results, eligibility outcomes, weighted merit scores, and evidence references.
- **Service & API**:
  - AI evaluation service in `ai-router` / backend to assess applicant data against approved criteria.
  - Deterministic weighted score calculation and evidence-backed assessment generation.

### Phase 4: Human Review & Decision Management
- **Workflow**:
  - Reviewer assignment, status progression (Screening, Shortlisted, Interview, Selected, Waitlisted, Unsuccessful).
  - Human score overrides with audit logging and applicant notification triggers.

---

## 3. Implementation Steps

1. **Backend Collections & Services**:
   - Update `database.js`, `db.json`, and `domainRepository.js` to include required staging and evaluation collections (`organizationContacts`, `programEvaluations`).
   - Implement bulk community import and account matching service in `domainService.js`.
   - Implement AI evaluation and scoring service.
2. **API Routes**:
   - Add institutional community import routes, public program application routes, and AI evaluation trigger routes in `domain.js` and `domainController.js`.
3. **Tests & Verification**:
   - Write comprehensive unit and integration tests covering bulk import, account matching, progressive applications, and AI evaluation workflows.
