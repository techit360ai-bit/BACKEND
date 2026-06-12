# WS2 Slice C1 — Demo Events & Room Lifecycle — Implementation Plan

> Execute task-by-task (inline). Checkbox steps. TDD. Backend tasks on `feat/messaging-backend`; frontend on `feat/messaging-phase1`. Spec: `docs/superpowers/specs/2026-06-12-ws2-slice-c1-demo-room-lifecycle-design.md`. Docs on both branches.

**`gobc`** (from `backend/`): `gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }`

---

## Task 1 — Domain types, validation helpers, DemoStore fake (backend)

**Branch:** `feat/messaging-backend`. **Files:** `internal/store/demo.go` (new), `internal/store/demo_fake.go` (new), `internal/store/demo_test.go` (new), migration `internal/store/migrations/0005_demo_events.sql` (new).

- [ ] **1. Test first** (`demo_test.go`, package `store`): assert `KnownDemoKind["mentorship"]`, `!KnownDemoKind["x"]`; `AllowedDemoTransition("draft","scheduled")`==true, `AllowedDemoTransition("ended","live")`==false; fake round-trip: `CreateEvent` then `GetEvent`; `UpsertRoster`+`ListRoster` returns 1; `ListEventsForUser` returns hosted + roster events.
- [ ] **2.** Run `gobc test ./internal/store/` → FAIL.
- [ ] **3. `demo.go`:** structs `DemoEvent{ID,HostID,Kind,Title,Description,AssetURL,AssetType,Status string; ScheduledAt *time.Time; CreatedAt,UpdatedAt time.Time}`, `RosterEntry{EventID,UserID,RoomRole,Status string; CreatedAt,UpdatedAt time.Time}`. Allow-set maps `KnownDemoKind` ({startup,investor,hackathon,launch,mentorship}), `KnownAssetType` ({deck,slides,video,link}), `KnownRoomRole` ({host,presenter,judge,audience}), `KnownDemoStatus` ({draft,scheduled,live,ended,cancelled}). `var demoTransitions = map[string][]string{"draft":{"scheduled","cancelled"},"scheduled":{"live","cancelled"},"live":{"ended","cancelled"}}` + `AllowedDemoTransition(from,to) bool`. Interface `DemoStore{ CreateEvent(ctx,DemoEvent)error; GetEvent(ctx,id)(DemoEvent,error); ListEventsForUser(ctx,userID)([]DemoEvent,error); UpdateEvent(ctx,DemoEvent)error; UpsertRoster(ctx,RosterEntry)error; GetRosterEntry(ctx,eventID,userID)(RosterEntry,error); ListRoster(ctx,eventID)([]RosterEntry,error) }`.
- [ ] **4. `demo_fake.go`:** `FakeDemoStore` with `mu`, `events map[string]DemoEvent`, `roster map[string][]RosterEntry` (keyed by eventID). Implement all 7 methods; `GetEvent`/`GetRosterEntry` return `ErrNotFound` when absent; `ListEventsForUser` = events where `HostID==userID` OR a roster row has `UserID==userID`, newest-first by `CreatedAt`. Add `Demo *FakeDemoStore` to `FakeStores` + init in `NewFakeStores`.
- [ ] **5. `0005_demo_events.sql`:** `CREATE TABLE demo_events (...)` + `CREATE TABLE demo_roster (... PRIMARY KEY(event_id,user_id), FOREIGN KEY(event_id) REFERENCES demo_events(id) ON DELETE CASCADE)` per spec columns; index `demo_roster(user_id)`.
- [ ] **6.** `gobc test ./internal/store/` → PASS. **Commit** `feat(ws2): demo domain types, validation, DemoStore fake + migration 0005`.

---

## Task 2 — Postgres DemoStore (backend)

**Branch:** `feat/messaging-backend`. **Files:** `internal/store/postgres/demo.go` (new), `postgres.go` (wire `Demo` field), `postgres_test.go` (append).

- [ ] **1. Integration test** (`//go:build integration`, append `postgres_test.go`): `TestPostgresDemoLifecycle` — `CreateEvent`, `GetEvent`, `UpsertRoster` (host + one invitee), `ListRoster`==2, `ListEventsForUser(invitee)` returns the event, `UpdateEvent` changes status, re-`GetEvent` reflects it.
- [ ] **2.** Run integration (pg up) → FAIL (no impl).
- [ ] **3. `demo.go`:** `type DemoStore struct{ pool *pgxpool.Pool }` implementing the 7 methods with pgx; null-handling for `asset_url/asset_type` (`COALESCE`/`*string`), `scheduled_at` (`*time.Time`). Wire `Demo: &DemoStore{pool}` into the `Store` struct in `postgres.go` (assert it satisfies `store.DemoStore`).
- [ ] **4.** Integration → PASS. **Commit** `feat(ws2): postgres DemoStore`.

---

## Task 3 — demo.Service (backend)

**Branch:** `feat/messaging-backend`. **Files:** `internal/demo/service.go` (new), `internal/demo/service_test.go` (new).

- [ ] **1. Test first** (package `demo`, fake store): create stamps `draft` + host roster (`room_role=host,status=accepted`); `GetEvent` outsider → `ErrNotParticipant`; `Transition` draft→scheduled ok, ended→live → `ErrBadTransition`; `UpdateEvent` non-host → `ErrNotHost`, non-draft → `ErrNotEditable`; `Invite` non-host → `ErrNotHost`, host adds roster; `RespondInvite` non-invitee → `ErrNotInvitee`, invitee accept → status `accepted`.
- [ ] **2.** `gobc test ./internal/demo/` → FAIL.
- [ ] **3. `service.go`:** sentinels (`ErrEventNotFound,ErrNotHost,ErrNotParticipant,ErrNotInvitee,ErrInvalidField,ErrBadTransition,ErrNotEditable`). Input structs `CreateEventInput{Kind,Title,Description,AssetURL,AssetType string; ScheduledAt *time.Time}`, `PatchEventInput` (same, pointers/optional), `InviteInput{UserID,RoomRole string}`. `Service{ store store.DemoStore; now func()time.Time }` + `New`. Methods per spec; map store `ErrNotFound`→`ErrEventNotFound`; validate via `store.Known*`; `Transition` uses `store.AllowedDemoTransition`.
- [ ] **4.** PASS. **Commit** `feat(ws2): demo.Service (lifecycle, roster, invites, authz)`.

---

## Task 4 — HTTP API (backend)

**Branch:** `feat/messaging-backend`. **Files:** `internal/transport/httpapi/demo.go` (new), `router.go` (mount + `Deps.Demo *demo.Service`), `httpapi_test.go` (append), wire `demo.New` into `cmd/server/main.go`.

- [ ] **1. Test** (append `httpapi_test.go`): create (200) → list (200, len 1) → get (200) happy path for host; outsider token GET → 403; `POST .../status {"status":"live"}` from draft → 400 (`ErrBadTransition`); GET missing id → 404. (Extend `newAPI` to construct `demo.Service` with the fake `st.Demo` and set `Deps.Demo`.)
- [ ] **2.** `gobc test ./internal/transport/httpapi/` → FAIL.
- [ ] **3. `demo.go`:** 7 handlers per spec; `demoErr(w,err)` mapping (404/403/400/500); camelCase JSON. Mount routes in `router.go` authed group; add `Demo *demo.Service` to `Deps`; construct in `main.go`.
- [ ] **4.** PASS. **Commit** `feat(ws2): demo HTTP API (events, status, invites)`.

---

## Task 5 — Frontend lib/demo (frontend)

**Branch:** `feat/messaging-phase1`. **Files:** `src/lib/demo/transitions.ts` (+ `.test.ts`), `src/lib/demo/types.ts`, `src/lib/demo/client.ts`, add `msgPatch` to `src/lib/messaging/client.ts`.

- [ ] **1. Test first** `transitions.test.ts` (local gate): `canTransition("draft","scheduled")` true, `("live","ended")` true, `("ended","live")` false, `("draft","live")` false.
- [ ] **2.** `node --no-warnings --experimental-strip-types scripts/run-tests.mjs src/lib/demo` → FAIL.
- [ ] **3.** `transitions.ts` (`ALLOWED_TRANSITIONS` mirror + `canTransition`); `types.ts` (`DemoEvent`,`RosterEntry`,`DemoKind`,`AssetType`,`RoomRole`,`DemoStatus`); add `msgPatch<T>` to messaging `client.ts`; `client.ts` fetchers (`listEvents,getEvent,createEvent,patchEvent,transitionStatus,invite,respondInvite`) via `msgGet/msgPost/msgPatch` + `withFallback`.
- [ ] **4.** Tests PASS; `npx tsc -b --noEmit 2>&1 | grep -E "lib/demo|lib/messaging/client" || echo ok`. **Commit** `feat(ws2): frontend demo client + transitions (local gate)`.

---

## Task 6 — Frontend screens + routes (frontend)

**Branch:** `feat/messaging-phase1`. **Files:** `src/dashboard/demos/{DemoList,DemoCreate,DemoRoom}.tsx` (new), `App.tsx` (routes).

- [ ] **1.** `DemoList` (fetch listEvents, status badges, link to room, create button), `DemoCreate` (form → createEvent → navigate), `DemoRoom` (getEvent; show asset/roster/status; host: transition buttons filtered by `canTransition(cur,*)` + invite; invitee: accept/decline). Offline-safe (empty fallback).
- [ ] **2.** Routes in `App.tsx`: `/demos` (DemoList), `/demos/new` (DemoCreate), `/demos/:id` (DemoRoom), inside `MessagingProvider`.
- [ ] **3.** `npx tsc -b --noEmit 2>&1 | grep -E "dashboard/demos|App.tsx" | grep -v react-router-dom || echo ok`. **Commit** `feat(ws2): demo day screens + routes`.

---

## Task 7 — Verify + push

- [ ] **1.** Backend (`feat/messaging-backend`): `gobc test ./...` + `gobc vet ./...` + `bash scripts/smoke.sh`.
- [ ] **2.** Frontend (`feat/messaging-phase1`): `node ... run-tests.mjs src` + tsc on changed files.
- [ ] **3.** Commit this plan on both branches (cherry-pick). Push both branches (PR #12, #13).

---

## Self-Review
- Spec coverage: data model→T1/T2; service+authz+state machine→T3; HTTP→T4; frontend client+transitions→T5; screens→T6; tests in each + T7. Docs-on-both→T7.
- Types consistent: `AllowedDemoTransition`(Go)↔`canTransition`(TS) same pairs; sentinels defined T3, mapped T4; `DemoStore` defined T1, impl T2, used T3.
- No placeholders (signatures + behavior given; follows existing store/postgres/httpapi patterns).
