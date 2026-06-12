# WS2 Slice C1 — Demo Events & Room Lifecycle — Design Spec

**Date:** 2026-06-12
**Workstream:** WS2 (Demo Day)
**Branches:** backend → `feat/messaging-backend` (PR #13); frontend → `feat/messaging-phase1` (PR #12). Backend and frontend stay on separate branches. Spec + plan committed to **both** (docs-on-both).

## Goal

Build the foundation of WS2 Demo Day: a backend domain and frontend screens for creating, scheduling, populating, and running demo "rooms" through a validated lifecycle. No live video, recording, or AI feedback in this slice — those are later slices that build on this.

## WS2 decomposition (context)

WS2 is decomposed into vertical slices. **This spec is C1.**

- **C1 (this) — Demo events & room lifecycle:** data model + Go API + frontend create/list/join. Zero external dependencies.
- C2 — Live room: presence + Q&A + reactions (reuse WS1 WebSocket/presence/channels).
- C3 — Demo asset upload/storage (real files; C1 uses external links only).
- C4 — Live video/streaming (integrate a third-party SFU). Also where the existing Mentorship Hub UI gets re-wired to this backend.
- C5 — Recording storage.
- C6 — AI-generated feedback (ai-router; depends on a real `_call_llm`).

## Scope decisions (resolved during brainstorming)

- **Backend home:** extend the existing Go backend (`backend/`), new `internal/demo` package + tables in the same Postgres DB. Reuses JWT auth, pgx/chi, migrations, and (for C2) the WS/presence infra.
- **One model + `kind` enum:** a single `demo_events` row with `kind`; type-specific behavior deferred.
- **Hosting open to all:** any authenticated user (organizations **and** individuals) can create a demo event and becomes its `host`. No role restriction.
- **Mentorship included:** `kind` includes `mentorship` so the Mentorship Hub's video mentoring is a hosted event on this same lifecycle/roster/host model. C1 makes the model *support* mentorship; re-wiring the existing mentorship screens + actual video is C4 (not this slice).
- **Roster with room-roles:** per-attendee `room_role` + invite `status`; rooms are invite-only, gated by the roster.
- **Asset = external link only:** `asset_url` + `asset_type`; real upload is C3.
- **Full lifecycle:** `draft → scheduled → live → ended`, plus `cancelled`; host-only, state-machine validated.

## Non-Goals (this slice)

Live video/streaming (C4), recording (C5), AI feedback (C6), file upload (C3), re-wiring the existing Mentorship Hub UI (C4), per-kind specialized flows (e.g. hackathon judging rubrics), public/discoverable rooms (invite-only only).

## Data Model

Migration `backend/internal/store/migrations/0005_demo_events.sql`.

**`demo_events`**
| column | type | notes |
|---|---|---|
| `id` | text | PK (UUIDv7 via `protocol.NewMsgID()`) |
| `host_id` | text | creator user id |
| `kind` | text | `startup` \| `investor` \| `hackathon` \| `launch` \| `mentorship` |
| `title` | text | not empty |
| `description` | text | may be empty |
| `asset_url` | text | nullable |
| `asset_type` | text | nullable: `deck` \| `slides` \| `video` \| `link` |
| `status` | text | `draft` \| `scheduled` \| `live` \| `ended` \| `cancelled` |
| `scheduled_at` | timestamptz | nullable |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**`demo_roster`**
| column | type | notes |
|---|---|---|
| `event_id` | text | FK → `demo_events.id` `ON DELETE CASCADE` |
| `user_id` | text | |
| `room_role` | text | `host` \| `presenter` \| `judge` \| `audience` |
| `status` | text | `invited` \| `accepted` \| `declined` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| | | PK `(event_id, user_id)` |

On create, the host is inserted as `(host_id, room_role=host, status=accepted)`. `kind`, `asset_type`, `room_role`, `status` are validated against fixed allow-sets (normalize-or-reject; invalid → 400).

## Backend (Go — `internal/demo`, branch `feat/messaging-backend`)

New package `internal/demo` with: a `store.DemoStore` interface (in `internal/store`) + fake + Postgres impl, and a `demo.Service`. Mounted under `/api/v1/demo`, behind the existing JWT auth middleware (provides `currentUser`/`currentRole`).

### Domain types (`internal/store`)
```
type DemoEvent struct {
    ID, HostID, Kind, Title, Description string
    AssetURL, AssetType                 string // "" when absent
    Status                              string
    ScheduledAt                         *time.Time
    CreatedAt, UpdatedAt                time.Time
}
type RosterEntry struct {
    EventID, UserID, RoomRole, Status string
    CreatedAt, UpdatedAt              time.Time
}
```

### Store interface (`DemoStore`)
- `CreateEvent(ctx, DemoEvent) error`
- `GetEvent(ctx, id) (DemoEvent, error)` — `ErrNotFound` when missing
- `ListEventsForUser(ctx, userID) ([]DemoEvent, error)` — events hosted by, or with a roster row for, the user; newest first
- `UpdateEvent(ctx, DemoEvent) error` — full row update (used for PATCH + status)
- `UpsertRoster(ctx, RosterEntry) error`
- `GetRosterEntry(ctx, eventID, userID) (RosterEntry, error)`
- `ListRoster(ctx, eventID) ([]RosterEntry, error)`

Validation helpers (in `internal/store`, mirroring `KnownRoles`): `KnownDemoKind`, `KnownAssetType`, `KnownRoomRole`, `KnownDemoStatus` (allow-set maps) and `AllowedDemoTransition(from, to string) bool`.

### Service (`demo.Service`) + sentinels
Sentinels (package `demo`): `ErrEventNotFound`, `ErrNotHost`, `ErrNotParticipant`, `ErrNotInvitee`, `ErrInvalidField`, `ErrBadTransition`, `ErrNotEditable`.

- `CreateEvent(ctx, hostID string, in CreateEventInput) (DemoEvent, error)` — validates `kind`/`asset_type`; stamps `status=draft`, `id`, timestamps; persists event + host roster row.
- `GetEvent(ctx, userID, id) (DemoEvent, []RosterEntry, error)` — `ErrNotParticipant` unless host or on roster.
- `ListEvents(ctx, userID) ([]DemoEvent, error)`.
- `UpdateEvent(ctx, userID, id string, in PatchEventInput) (DemoEvent, error)` — `ErrNotHost` if not host; `ErrNotEditable` if status ≠ `draft`; validates changed fields.
- `Transition(ctx, userID, id, to string) (DemoEvent, error)` — `ErrNotHost`; `ErrBadTransition` if `!AllowedDemoTransition(cur, to)`.
- `Invite(ctx, userID, id string, entries []InviteInput) error` — `ErrNotHost`; validates `room_role`; upserts roster rows `status=invited`.
- `RespondInvite(ctx, userID, id, response string) error` — `ErrNotInvitee` if no roster row for user; `response ∈ {accept, decline}` → roster status `accepted`/`declined` (else `ErrInvalidField`).

### HTTP (`internal/transport/httpapi/demo.go` + router)
All under the authed `/api/v1` group:
| Method & path | Handler → service |
|---|---|
| `POST /demo/events` | `CreateEvent` → 200 `{event}` |
| `GET /demo/events` | `ListEvents` → 200 `{events:[...]}` |
| `GET /demo/events/{id}` | `GetEvent` → 200 `{event, roster:[...]}` |
| `PATCH /demo/events/{id}` | `UpdateEvent` → 200 `{event}` |
| `POST /demo/events/{id}/status` | body `{status}` → `Transition` → 200 `{event}` |
| `POST /demo/events/{id}/invites` | body `{invites:[{userId,roomRole}]}` → `Invite` → 200 |
| `POST /demo/events/{id}/invites/respond` | body `{response}` → `RespondInvite` → 200 |

A `demoErr(w, err)` helper maps sentinels: `ErrEventNotFound`→404; `ErrNotHost`/`ErrNotParticipant`/`ErrNotInvitee`→403; `ErrInvalidField`/`ErrBadTransition`/`ErrNotEditable`→400; else 500. JSON wire shape uses camelCase keys (`hostId`, `assetUrl`, `assetType`, `scheduledAt`, `roomRole`).

### State machine
```
draft     → scheduled, cancelled
scheduled → live, cancelled
live      → ended, cancelled
ended     → (none)
cancelled → (none)
```

## Frontend (TS — `feat/messaging-phase1`)

New `src/lib/demo/`:
- `types.ts` — `DemoEvent`, `RosterEntry`, `DemoKind`, etc. (wire shapes).
- `client.ts` — fetchers over the shared messaging client (`msgGet`/`msgPost` + a `msgPatch`) reusing `MESSAGING_BASE_URL` + token: `listEvents`, `getEvent`, `createEvent`, `patchEvent`, `transitionStatus`, `invite`, `respondInvite`; all wrapped in `withFallback` for offline-safety.
- `transitions.ts` — pure `ALLOWED_TRANSITIONS` + `canTransition(from, to)` mirroring Go. **Local-gate unit-tested.**

Screens under a new `/demos` route (added in `App.tsx`, role-agnostic):
- **DemoList** — my hosted + invited events (status badges).
- **DemoCreate** — form: kind, title, description, asset url + type, scheduled_at.
- **DemoRoom** — event detail: asset link, roster (with room-roles + invite status), status badge; host controls render only the transition buttons legal for the current status (`canTransition`) plus an invite control; invitees see accept/decline.

Offline-safe: fetchers fall back to empty; screens render the empty/mock state if the backend is unreachable.

## Testing & Verification

### Backend
- `internal/store` fakes + `fakes_test.go`: `DemoStore` fake round-trips events + roster; `ListEventsForUser` returns hosted + roster; validation helpers + `AllowedDemoTransition` unit-tested.
- `internal/demo/service_test.go`: create stamps `draft` + host roster; `GetEvent` returns `ErrNotParticipant` for an outsider; `Transition` accepts legal / rejects illegal (`ErrBadTransition`); `UpdateEvent` rejects non-host (`ErrNotHost`) and non-draft (`ErrNotEditable`); `Invite` adds roster (non-host → `ErrNotHost`); `RespondInvite` sets status (non-invitee → `ErrNotInvitee`).
- `internal/transport/httpapi/httpapi_test.go`: create→list→get happy path 200s; outsider GET → 403; illegal transition → 400; missing event → 404.
- Postgres integration (`postgres_test.go`, `//go:build integration`): event + roster lifecycle against a real DB; migration `0005` applies.
- Regression: `go test ./...`, `go vet ./...`, `scripts/smoke.sh`.

### Frontend
- `src/lib/demo/transitions.test.ts` via the local gate (`node scripts/run-tests.mjs`): `canTransition` matches the Go state machine (legal pairs true, illegal/terminal false).
- `tsc -b --noEmit` clean on changed files (excluding pre-existing project-wide noise).

## Open Questions

None. All resolved in brainstorming: backend home (extend existing), one model + `kind` enum (incl. `mentorship`), hosting open to all, roster with room-roles, asset external-link-only, full lifecycle with `cancelled`. Mentorship-UI rewire + live video explicitly deferred to C4.
