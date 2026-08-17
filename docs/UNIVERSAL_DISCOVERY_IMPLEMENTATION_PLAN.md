# Universal Discovery, Recommendation, and Return Intelligence Plan

## Decision

Build the platform-wide intelligence layer in `BACKEND/backend`. It is primarily deterministic data processing and must operate without an AI provider key. AI Router is an optional enrichment dependency for future embeddings and semantic reranking, never an eligibility, permission, or safety authority.

The engine is a shared service consumed by Feed, Discovery, Search, Dashboard, Notifications, profile/startup/project surfaces, Deal Intelligence, and Return Intelligence. Product surfaces must not implement their own scoring rules.

## Existing Engines and Ownership

| Existing capability | Owner | Keep distinct because | Integration with universal engine |
| --- | --- | --- | --- |
| Social post ranking, moderation, feed feedback, follows, Redis feed cache | `messaging-backend/internal/feed` | It owns live post storage, delivery, content safety, and feed-specific engagement | Continue ranking posts; accept shared profile signals and later consume curated cross-entity modules |
| GSIS computation and outcome learning | `ai-router/gsis_v2.py` | It is startup execution/readiness intelligence | Read GSIS as a role-weighted signal; never let it dominate eligibility |
| Incubation recommendations | AI Router and `backend/src/services/domainService.js` | They advise a founder about a specific venture | Treat outputs/outcomes as optional behavioral context, not universal recommendations |
| Trust and investor trust engines | AI Router trust modules and backend read models | They calculate trust, evidence, and verification | Use persisted trust/verification/moderation fields as hard filters and ranking signals |
| Admin AI monitoring | `techit-admin-dashboard` | It measures AI operations, not product discovery quality | Extend later with recommendation and return analytics emitted by this service |
| User context checkpoints and suggestions | `BACKEND/backend` | They support agent context and guided actions | Reuse profile/activity data; do not replace them |

## Delivery Scope

### Phase 1: Shared Backend Foundation

- Add persistent collections for recommendation profiles, preferences, events, feedback, relationships, exposures, generated recommendations, activity state, catch-up state, and configuration.
- Derive a recommendation profile for every existing user from current profile data and historical TechIT activity. New users can submit explicit interests, skills, and intent without a second profile model.
- Generate candidates from existing profiles, projects/startups, opportunities, hackathons/programs, and feed posts. Empty entity sources remain empty; the engine never fabricates records.
- Apply deterministic eligibility and safety filters before scoring.
- Score with configurable role-aware weights, explanations, GSIS/trust signals, recency, negative feedback, cooldowns, and repetition penalties.
- Apply type diversity and configurable limits.
- Record impressions, actions, outcomes, feedback, relationships, and incremental profile signal updates.
- Track meaningful activity timestamps and produce bounded, deduplicated role-aware return summaries and Catch-Up Mode.
- Expose one API family for all consumers.

### Phase 2: Product Integration

- Add native recommendation modules to the Feed without replacing the Go content ranker.
- Add a Discovery route with For You, People, Startups, Projects, Ideas, Opportunities, and Organizations tabs. Tabs with no persisted candidates show an honest empty state.
- Show Return Intelligence at the top of Feed when the configured inactivity threshold is met.
- Support direct actions, explanations, dismiss/undo, seen state, and catch-up completion.
- Keep the future `USER / EXPLORER` role in API types, role policy, language, and routing even though its dashboard is not yet shipped.

### Phase 3: Production Scale

- [x] Project collection-backed recommendation records into normalized PostgreSQL tables.
- [x] Add pgvector-backed deterministic semantic vectors and vector candidate search.
- [x] Add background refresh jobs and Redis recommendation caches.
- [x] Add service-to-service event delivery and cross-entity modules to messaging Feed.
- [x] Add personalized search reranking that preserves complete-results mode.
- [x] Add notification digests, admin tuning controls, and outcome dashboards.
- [x] Feed Return Intelligence into the existing role-dashboard Contextual Intelligence surface.

## API Contract

- `GET /api/discovery/recommendations?surface=&type=&limit=`
- `GET /api/discovery/search?q=&type=&personalized=`
- `GET /api/discovery/return-summary`
- `GET /api/discovery/catch-up?limit=`
- `PUT /api/discovery/profile`
- `POST /api/discovery/events`
- `POST /api/discovery/recommendations/:id/exposure`
- `POST /api/discovery/recommendations/:id/feedback`
- `POST /api/discovery/catch-up/:id/seen`
- `POST /api/discovery/catch-up/complete`
- `GET /api/discovery/config` and admin-authorized configuration update in a later admin wave

## Ranking Contract

1. Build candidates from persisted entities.
2. Enforce permissions, blocks, moderation, availability, expiry, and existing relationship rules.
3. Calculate normalized features.
4. Apply viewer-role and surface configuration.
5. Attach standardized, user-safe explanation reasons.
6. Apply negative feedback, exposure cooldown, repetition, and staleness penalties.
7. Diversify by entity type and creator.
8. Persist generated results and record impressions/actions separately.

No AI output may override steps 1-2.

## Return Intelligence Contract

- Session/activity events update per-surface timestamps and `lastMeaningfulAt`.
- On return, inactivity is classified using configurable thresholds.
- Persisted platform events after the previous meaningful visit become candidates.
- The shared recommendation scorer filters and ranks those candidates.
- The result window is bounded, deduplicated, role-aware, and remembers seen/dismissed items.
- Completing Catch-Up Mode advances the checkpoint and transitions the client to normal recommendations.

## Verification

- Unit/API tests cover role-aware ranking, existing-user profile derivation, cold start, safety filtering, feedback, cooldowns, diversity, explanations, event learning, role transitions, inactivity classification, return ranking, deduplication, seen state, and completion.
- Migration dry-run covers all collection additions.
- Frontend tests cover response parsing and role-aware return/recommendation rendering.
- Backend and frontend production builds must pass.

## Non-Goals for Phase 1

- Training a machine-learning model.
- Requiring OpenAI or another provider key.
- Replacing the messaging service's social-post ranker.
- Fabricating people, startups, projects, ideas, or opportunities to fill a UI.
- Shipping the not-yet-built Explorer dashboard; the contracts will be ready for it.
