# Organization Live Data and Mentorship Hub Implementation Plan

## Scope

Convert remaining Organization and Investor Mentorship surfaces from prototype/static UI into production-backed workflows.

This is an extension of the existing TechIT architecture. Existing authentication, role verification, capability authorization, discovery, Feed, Opportunities, messaging, organization intelligence, hackathons, and active-context systems remain the source of truth.

Wallets, subscriptions, payments, invoices, mentor payouts, equity settlement, and billing enforcement are explicitly deferred to the separate billing project.

## Audit Summary

### Organization

Already API-backed and reusable:

- Organization dashboard
- Organization projects
- Cohort health
- Interventions
- Impact reporting
- KPI targets
- Demo-day pipeline, publishing, events, and investor matches
- Hackathons

Still static or incomplete:

- AI Operations
- Organization Hangout
- Incubator Programs
- Market Ready portfolio
- Marketplace
- Talent Pool
- Organization Settings/team roles
- Integrations, webhooks, and API keys
- Portions of Organization Profile persistence

Static business records, fake metrics, fake members, fake integrations, API keys, webhook events, marketplace products, and talent records must not remain in production components.

### Mentorship

The frontend currently uses empty/static `liveData` and local-only handlers. The backend only has empty collection placeholders and no dedicated mentorship routes, services, migrations, capability policies, lifecycle transitions, notifications, or tests.

## Product Boundaries

### Allowed Static Frontend Data

- Labels
- Enum options
- Form metadata
- Chart colors
- Empty-state copy
- Navigation definitions

### Forbidden Static Frontend Data

- Users or mentors
- Organizations or projects
- Operational metrics
- Activity timelines
- Financial values
- Connected integrations
- API keys or webhook data
- Applications, mentees, tasks, messages, or analytics

## Phase 0: Contract Inventory and Safety Gate

1. Create a frontend-to-backend route matrix for every Organization and Mentorship screen.
2. Mark each screen as live, generic-scaffolded, static, or deferred.
3. Add a review rule that rejects production fixture arrays and no-op operational buttons.
4. Preserve existing Organization intelligence and Hackathon contracts.
5. Keep Billing and payment screens explicitly unavailable until billing exists.

## Phase 1: Organization Persistence and Contracts

Create typed backend services and APIs for:

- Organization profile and settings
- Memberships and organization roles
- Programs and cohorts
- AI operations and execution telemetry
- Organization Hangout/feed
- Market-readiness records derived from persisted projects
- Marketplace products, vendors, partnerships, and deployments
- Talent discovery backed by profiles, skills, availability, trust, and organization permissions
- Integrations, webhooks, provider connections, and API key metadata

Use dedicated services for domain validation, ownership, lifecycle transitions, audit events, and pagination. Generic collection APIs may remain for compatibility but must not be the primary contract for sensitive operational workflows.

## Phase 2: Organization Security

- Enforce organization membership and active context server-side.
- Use capability policies for recruiting, analytics, integrations, marketplace publishing, and AI operations.
- Never return raw API keys or provider secrets.
- Encrypt or tokenize external credentials.
- Add connect, disconnect, rotate, test, revoke, and audit operations for integrations.
- Add organization-scoped notifications and activity events.
- Remove fake plan/billing data from Organization navigation and summaries until billing is implemented.

## Phase 3: Organization Frontend Conversion

Replace static records with typed API clients and hooks in:

- `AIOps.tsx`
- `Hangout.tsx`
- `Incubator.tsx`
- `MarketReady.tsx`
- `Marketplace.tsx`
- `TalentPool.tsx`
- `Settings.tsx`
- `Integrations.tsx`

Every view must provide:

- Loading state
- Error state with retry
- Honest empty state
- Server-backed actions
- Capability-gated controls
- Optimistic updates only with rollback
- Pagination/filtering where records can grow

Persist Organization Profile changes through the backend instead of only React `UserContext` state.

## Phase 4: Mentorship Domain and Persistence

Create SQLite and PostgreSQL-compatible persistence for:

```text
mentorship_rooms
mentorship_room_members
mentorship_applications
mentorship_mentees
mentorship_tasks
mentorship_messages
mentorship_sessions
mentorship_events
mentorship_share_links
mentorship_broadcasts
mentorship_analytics_events
```

Required constraints:

- Room owner is an active, authorized mentor.
- A mentee can be enrolled once per room.
- Applications have a controlled status transition.
- Room capacity is enforced atomically.
- Tasks and messages require room membership.
- Share links expose only public room metadata.
- Revoked, archived, or suspended rooms cannot accept new applications.
- All important transitions are auditable.

## Phase 5: Mentorship Authorization

Add Backend capability policies:

```text
mentorship.access
mentorship.room.create
mentorship.room.manage
mentorship.application.submit
mentorship.application.review
mentorship.mentee.manage
mentorship.task.manage
mentorship.message
mentorship.analytics.view
mentorship.cocmentor.manage
mentorship.room.share
mentorship.room.broadcast
```

The Backend must validate active role, assurance, trust/risk state, organization context where relevant, room ownership, membership, and resource status.

Frontend gates are presentation only.

## Phase 6: Mentorship APIs

```text
GET    /mentorship/rooms
POST   /mentorship/rooms
GET    /mentorship/rooms/:roomId
PATCH  /mentorship/rooms/:roomId
POST   /mentorship/rooms/:roomId/archive

GET    /mentorship/rooms/:roomId/applications
POST   /mentorship/rooms/:roomId/applications
PATCH  /mentorship/applications/:applicationId/status

GET    /mentorship/rooms/:roomId/mentees
POST   /mentorship/rooms/:roomId/mentees/:userId/remove

GET    /mentorship/rooms/:roomId/tasks
POST   /mentorship/rooms/:roomId/tasks
PATCH  /mentorship/tasks/:taskId

GET    /mentorship/rooms/:roomId/messages
POST   /mentorship/rooms/:roomId/messages

GET    /mentorship/rooms/:roomId/analytics
GET    /mentorship/analytics
```

## Phase 7: Mentor Sharing and Broadcasting

Mentors must be able to promote a room without exposing private data.

### Secure Invite Links

```text
POST /mentorship/rooms/:roomId/share-links
GET  /mentorship/share/:token
POST /mentorship/share/:token/apply
POST /mentorship/share-links/:id/revoke
```

Share links must:

- Use random, hashed tokens.
- Support expiration and revocation.
- Expose public room title, description, mentor display name, expertise, capacity summary, and application deadline only.
- Never expose private mentees, applications, messages, payments, or internal analytics.
- Track views, clicks, applications, and revocations.

### TechIT Feed Sharing

```text
POST /mentorship/rooms/:roomId/publish-feed
```

The backend creates a Feed post referencing the room/share link. It must be idempotent and permission-checked.

### Opportunities Broadcasting

```text
POST /mentorship/rooms/:roomId/broadcast-opportunity
PATCH /mentorship/broadcasts/:id
POST /mentorship/broadcasts/:id/close
```

Broadcasts must create or update a persisted Opportunity with:

- Type: mentorship
- Room reference
- Public summary
- Required skills/interests
- Audience roles
- Application deadline
- Visibility and status
- Share link reference

Duplicate open broadcasts for the same room must be prevented.

### External Social Sharing

The backend returns a safe share payload:

```text
{
  "url": "https://techit.example/mentorship/share/<token>",
  "title": "Mentorship room title",
  "description": "Public room description",
  "hashtags": ["TechIT", "Mentorship"]
}
```

The frontend may use Web Share API and provider-specific share URLs for LinkedIn, X, WhatsApp, email, or copy-link. External sharing must never send private room payloads directly from the client.

## Phase 8: Mentorship Frontend Conversion

Replace `liveData.ts` imports with API-backed hooks.

Implement:

- Live room list and detail
- Controlled room creation form
- Application fetching and accept/reject actions
- Mentee enrollment and removal
- Task creation and status updates
- Persisted messages using the existing messaging service where appropriate
- Analytics loaded from the Backend
- Secure share-link creation, copy, Web Share, and social-share actions
- Feed publish action
- Opportunity broadcast action
- Public share landing page with apply flow
- Honest unavailable state for payments and equity settlement
- Empty/loading/error/retry states

## Phase 9: Notifications and Discovery

Generate notifications for:

- Application submitted
- Application accepted/rejected
- Mentee enrolled/removed
- Task assigned/completed
- New room message
- Room broadcast published
- Share link application

Feed and Discovery should index public mentorship opportunities through the existing Recommendation and Discovery engine.

## Phase 10: Testing

### Organization

- No static business fixture data
- Profile persistence across reload
- Organization membership isolation
- Integration secret protection
- Real loading/error/empty states
- Every operational button calls a backend contract
- Capability and active-context enforcement

### Mentorship

- Room creation and ownership
- Role/assurance authorization
- Capacity and duplicate enrollment
- Application lifecycle
- Task and message isolation
- Archived/revoked room behavior
- Analytics derivation
- Share-token hashing, expiry, revocation, and public-data boundaries
- Feed publishing idempotency
- Opportunity broadcast deduplication
- External share payload contains no private data
- Frontend API error and empty states

## Delivery Sequence

1. Commit this plan locally.
2. Implement Backend migrations, services, capabilities, APIs, sharing, and tests.
3. Implement Organization API-backed screen replacements.
4. Implement Mentorship frontend and public share landing page.
5. Run Backend and Frontend tests, lint, build, security scans, and migration checks.
6. Pull/rebase from remote `main`.
7. Commit each repository logically.
8. Push feature branches.
9. Create normal pull requests.
10. Merge only after required checks and review pass. Never use administrator bypass.

## Definition of Done

- No fake Organization records remain in production views.
- No no-op operational controls remain.
- Organization profile and settings persist server-side.
- Mentorship rooms, applications, mentees, tasks, messages, and analytics are live.
- Mentors can create secure invite links.
- Mentors can publish to TechIT Feed.
- Mentors can broadcast to Opportunities.
- Mentors can share safe public links to external social networks.
- Private room data is never exposed through public links.
- Backend authorization is authoritative.
- Billing and payment claims remain deferred until the separate billing project exists.
