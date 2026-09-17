# Connectivity Resilience: Existing Map and Implementation Plan

## Scope and Guardrail

This plan extends the current TechIT platform. It does not replace the Vite
React application, Node/Express API, AI Router, Workspace, code editor,
messaging services, feed, authentication, authorization, database, or billing
systems. Work should be delivered incrementally around the existing APIs and
state owners.

## Existing -> Extend -> New Map

| Capability | Existing implementation | Current offline/cache/sync state | Classification | Planned action |
| --- | --- | --- | --- | --- |
| Frontend architecture | Vite + React + React Router in `new-frontend/frontend`; Tailwind/Vite config | No Next.js App Router; no service worker or PWA plugin found | A/C | Preserve Vite architecture; add only a small resilience provider and service-worker entry when needed |
| API abstraction | `frontend/src/lib/api/client.ts`, `techitApi.ts`, platform and messaging clients | Auth headers, timeouts, refresh, and fallback responses already exist; no shared cache or queue | B | Extend request metadata, cache hooks, connectivity classification, and retry policy without replacing clients |
| Authentication/session | `AuthContext`, session storage access token, local-storage user projection, refresh endpoint | Last user projection survives reload; credentials are not persisted in IndexedDB | A/B | Preserve security boundary; expose last-authenticated offline shell and mark server validation as pending |
| Authorization | Backend capability policies and role/context checks | Server remains authoritative; offline cannot revalidate current permissions | A | Reuse existing checks; queue only actions that are safe to revalidate on replay |
| Browser storage | `localStorage` for theme, user projection, route, onboarding flags; `sessionStorage` for token and transient drafts | No generic IndexedDB data layer | B | Add one shared IndexedDB database for cached records and operations; keep LocalStorage for preferences only |
| Workspace Code editor | `dashboard/workspaces/pages/Code.tsx` and existing Monaco editor | Existing IndexedDB `codeJournal`, offline upsert/delete/move queue, reconnect flush, path safety, and three-way merge | A/B | Extend the existing journal schema/status UI and sync telemetry; do not create another editor or workspace |
| Workspace API sync | `codeSync.ts` uses existing MCP GitHub tools; `codeWorkspace.ts` uses platform API | Remote state, selected-file pull, push approval, conflict handling already exist | A/B | Add connectivity-aware request behavior and durable sync status around these calls |
| Workspace non-code data | Existing workspace tasks, files, reports, agents, connectors, chat routes and clients | Mostly online requests; no durable generic offline records found | B | Start with cached read snapshots and safe task/draft mutations; defer connectors, agents, deployment, and destructive actions |
| Messaging | Existing Go messaging service clients, REST conversations, WebSocket client/reducer, optimistic send behavior | WebSocket reconnects with exponential backoff; no durable IndexedDB outbox or truthful offline delivery state | B | Extend the existing conversation store with cached threads and an outbox; preserve REST/WS transport and server IDs |
| Feed | Existing React feed routes, layout, posts, comments, notifications, and API clients | Fallback/mock behavior exists in shared clients; no persisted feed cache or stale timestamp model | B | Cache recent read projections and drafts; disable or queue only explicitly safe interactions |
| Notifications | Existing notification API, pages, and local read interactions | No persisted notification cache or offline unread reconciliation found | B | Cache last-known notifications and enqueue read-state mutations for replay |
| Profiles/settings | Existing role profiles and settings APIs/components | Local profile projections exist; writes are online-bound | A/B | Cache safe profile reads; queue non-sensitive preference edits only |
| Ideas/drafts/tasks/projects | Existing incubation, project, task, and workspace screens with local transient state in places | No unified durable draft/action store found | B | Introduce entity-scoped draft records and idempotent mutation envelopes around existing endpoints |
| Search | Existing server-backed discovery/search clients | No local search index found | B | Add bounded search over cached profiles/projects/posts/messages; label results as cached and incomplete |
| AI Router/AI outputs | Existing FastAPI AI Router and Node clients; prior outputs appear in UI/state | AI generation requires network; no general persisted AI-output cache found | A/B | Cache previously delivered outputs only; never fake fresh generation or intelligence offline |
| Billing/wallet/subscriptions | Existing wallet, checkout, subscription, and credit ledger flows | Online/provider dependent; no offline mutation path | A | Keep payments, wallet mutations, and subscription changes online-only |
| Backend persistence | Node/Express backend with JSON/SQLite/Postgres projection paths; AI Router with PostgreSQL/Redis/Celery support | Idempotency and usage settlement exist in selected flows; no general sync endpoint/operation inbox found | B | Reuse idempotency conventions; add a narrow replay contract only where endpoint behavior is already safe |
| Backend caching/payloads | Timeouts, fallback clients, pagination on selected endpoints, Redis in AI Router, rate limits | No consistent ETag/conditional request layer found in inspected active APIs | C | Add conditional requests only to stable read endpoints after measuring payloads; do not redesign APIs globally |
| Service worker/PWA shell | No active service worker, Workbox, manifest, or PWA plugin found in `new-frontend` | Cannot launch the app shell offline today | D | Add a minimal service worker and manifest for critical shell assets only, after cache boundaries are tested |
| Connectivity UI | Plugins page has online/offline state; Workspace Code shows `navigator.onLine`; no global indicator found | Local feature-specific indicators only | B | Add a small global connectivity status provider/indicator with online, limited, offline, and sync states |
| Low-data mode | No global data-saver preference or request policy found | Image/media behavior is component-specific | D | Add a preference and request hints progressively; do not rewrite every component or API payload |
| Observability | Existing backend audit, capability analytics, usage, and frontend console warnings | No resilience-specific metrics found | B | Extend existing telemetry with queue depth, sync outcome, cache hit, and connectivity class without collecting sensitive content |

## Connectivity State Model

Use one shared state projection, not separate applications:

```text
ONLINE       -> existing requests and live updates
DEGRADED     -> existing requests with bounded timeout/retry, reduced optional fetches
OFFLINE      -> cached reads + local drafts + safe durable queue
RECONNECTING  -> replay queue through existing authenticated APIs
CONFLICT     -> entity-specific resolution only where concurrent edits are possible
```

`navigator.onLine` is only a hint. Degraded detection should combine recent
request latency, timeout/error classification, and explicit browser online/offline
events. No connectivity state may bypass backend authorization.

## Phased Implementation

### Phase 0: Baseline and instrumentation

1. Add a read-only capability inventory test/check to prevent duplicate storage,
   transport, or route systems.
2. Measure current request latency, payload size, fallback rate, and feature
   access patterns using existing telemetry hooks.
3. Define the resilience vocabulary: `online`, `degraded`, `offline`,
   `pending_sync`, `syncing`, `synced`, `sync_failed`, `needs_attention`.

### Phase 1: Shared browser resilience primitives

1. Add a single `ConnectivityProvider` under the existing app provider tree.
2. Add one IndexedDB database with versioned stores for `snapshots`, `drafts`,
   `operations`, and `syncMetadata`; do not store tokens, passwords, payment
   credentials, API keys, or private secrets.
3. Add operation IDs, entity keys, base version/hash, retry count, and status to
   every queued mutation.
4. Extend the existing API clients with network classification and bounded
   exponential retry for idempotent reads only.
5. Add the subtle global indicator and a human-readable sync status surface.

### Phase 2: Offline shell and read caching

1. Add a minimal service worker and manifest for the existing Vite build.
2. Precache only the app shell, critical CSS/JavaScript, icons, and offline
   status UI; use runtime caching for bounded, non-sensitive GET snapshots.
3. Persist current-user projection, current workspace/project snapshot, recent
   feed, recent conversations, and notifications with `lastSyncedAt` metadata.
4. Render cached data with an explicit stale label and timestamp; never present
   it as live.

### Phase 3: Workspace extension

1. Extend `codeJournal` rather than replacing it. Preserve path safety,
   idempotent file keys, base versions, and current three-way merge behavior.
2. Add truthful statuses and a queue inspector to the existing Code screen.
3. Cache the last valid workspace snapshot and permit local edits only for
   supported files/notes/tasks.
4. Keep runtime execution, deployment, GitHub push, connector changes, and
   destructive operations online-dependent unless an explicit server contract
   exists.

### Phase 4: Messaging, feed, and notification extensions

1. Extend the existing messaging conversation store with cached history and an
   IndexedDB outbox. Preserve WebSocket reconnect and REST fallback behavior.
2. Show `Saved locally`, `Waiting for connection`, `Syncing`, `Sent`, or
   `Needs attention`; never show delivered before server acknowledgment.
3. Cache recent feed posts/comments and notifications; add last-sync metadata.
4. Queue only safe, idempotent actions. Keep moderation, deletion, financial,
   permission, and irreversible operations online-only.

### Phase 5: Conflict and replay contract

1. Replay operations after authenticated reconnection in creation order per
   entity, with bounded retries and transient/permanent error classification.
2. Reuse existing endpoint idempotency keys and add server-side operation
   recognition only for endpoints that lack it and are safe to extend.
3. Apply automatic merge only to versioned workspace files and simple drafts.
4. Surface a focused Keep Mine/Keep Server/Review flow for genuine conflicts;
   do not add conflict UI to every entity.

### Phase 6: Low-data mode and payload efficiency

1. Add a persisted Data Saver preference using the existing settings pattern.
2. Suppress optional prefetch/polling, defer media, and request compact fields
   where existing APIs support it.
3. Add pagination/conditional requests to measured high-volume reads without
   breaking existing response contracts.
4. Optimize images at their existing component boundaries; do not replace the
   image system wholesale.

### Phase 7: Testing and rollout

1. Unit-test IndexedDB migrations, operation IDs, queue ordering, retry limits,
   stale labels, and conflict outcomes.
2. Add Playwright scenarios for online, throttled, offline, reload-offline,
   reconnect, failed replay, and duplicate prevention.
3. Verify payments, authorization, server-side verification, AI generation,
   external integrations, and live delivery remain online-dependent.
4. Roll out shell/read caching first, then Workspace journaling, then messaging
   outbox, then safe feed/notification mutations.

## Explicitly Online-Only

New AI generation, fresh investor intelligence, payments, subscription changes,
wallet transactions, server verification, external integrations, live search,
real-time delivery, deployment, and irreversible security or financial actions
must remain online-dependent. Offline UI should explain the pending action or
cached state instead of simulating success.

## Acceptance Gates

- Existing Workspace Code offline journaling remains intact and passes all prior
  tests.
- No second workspace, editor, message transport, auth layer, API router,
  database, or feed is introduced.
- Cached content always includes freshness metadata.
- Queued operations survive reload and cannot duplicate on retry.
- Authorization is revalidated by the existing backend on replay.
- Offline edits are never silently discarded or overwritten.
- Payment, subscription, wallet, AI generation, and external service actions do
  not pretend to complete offline.
- App shell launch, cached reads, drafts, queue replay, and conflict behavior are
  tested on supported browsers and mobile viewport profiles.

## Decision Log

- The active frontend is Vite + React, not Next.js; the plan does not introduce
  a framework migration.
- IndexedDB already exists for Workspace Code, so the first extension should
  generalize that pattern carefully rather than add another storage mechanism.
- Existing client timeouts/fallbacks and WebSocket backoff are valuable
  resilience primitives and should be reused.
- Service worker/PWA support is genuinely missing, so it is the only net-new
  platform layer proposed, and it is intentionally limited to the app shell.
