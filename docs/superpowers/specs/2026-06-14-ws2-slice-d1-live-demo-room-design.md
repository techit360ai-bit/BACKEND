# WS2 Slice D1 — Live Demo Room (LiveKit) — Design

> Status: approved (brainstorm). Branch (backend): `feat/messaging-backend`; (frontend): `feat/messaging-phase1`. Docs committed to both. Builds on WS2 C1 (demo events, roster, lifecycle).

## Goal

Add real-time A/V to a demo event when its host takes it **live**. Presenters publish camera/mic/screen; judges and audience watch. Delivered via the **LiveKit** third-party SDK — our backend only mints scoped access tokens; LiveKit transports the media.

This is the first of three WS2 "live" slices:
- **D1 (this spec):** live room + token minting + role-based publish/subscribe + FE embed.
- **D2 (later):** recording via LiveKit Egress → S3/MinIO + playback.
- **D3 (later):** AI feedback (transcript/metrics → ai-router agent → structured critique).

## Decisions (from brainstorm)

- **A/V delivery:** third-party SDK, **LiveKit** (OSS + Cloud). Go server SDK fits token minting; Egress (D2) covers recording; React components for the room UI.
- **First slice:** D1 only; recording (D2) and AI feedback (D3) are separate later specs.
- **Verification posture:** token-minting unit tests + FE wiring/offline-safety + build/tsc/vet gates here. Real multi-party A/V is verified only in a deployed env with LiveKit keys (NOT in this sandbox).
- **Room liveness:** tokens are issued only when `event.status == "live"`. A presenter "green room" during `scheduled` is **deferred** (optional follow-up).

## Architecture

```
FE DemoRoom (status==live)
  └─ POST /api/v1/demos/{id}/rtc-token  (Bearer JWT)
        backend httpapi handler
          ├─ demo.Service authz: requester is host or rostered  → else 403
          ├─ require event.status == "live"                     → else 400
          ├─ livekit.Service configured?                        → else 503
          ├─ grant = grantForRole(roomRole)                     (publish vs subscribe)
          └─ livekit.Service.Token(room=eventID, identity=userID, grant)
        → { token, url, room, identity, canPublish }
  └─ <DemoStage session> → <LiveKitRoom serverUrl token> → tiles + (canPublish? ControlBar)
```

### Backend — `internal/livekit` (Go, new package)

- `type Grant struct { CanPublish bool }` (minimal; CanSubscribe/RoomJoin/CanPublishData are always set).
- `type Service struct { apiKey, apiSecret, url string }` + `func New(apiKey, apiSecret, url string) *Service`.
- `func (s *Service) Enabled() bool` — true when apiKey/apiSecret/url all non-empty.
- `func (s *Service) Token(room, identity string, g Grant) (string, error)` — builds a LiveKit `auth.AccessToken` with `auth.VideoGrant{ RoomJoin: true, Room: room, CanPublish: &g.CanPublish, CanSubscribe: ptr(true), CanPublishData: ptr(true) }`, sets identity + TTL (e.g. 1h), returns the signed JWT. Returns an error if `!Enabled()`.
- `func (s *Service) URL() string` — the LiveKit ws URL for the client.
- Pure/unit-testable: tokens can be parsed and verified with the same `auth` package.

Library: `github.com/livekit/protocol` (the `auth` subpackage). No media-server control needed in D1.

### Backend — config

Add to `internal/config`: `LiveKitAPIKey`, `LiveKitAPISecret`, `LiveKitURL` from env `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL`. All optional; absence → service disabled (endpoint returns 503).

### Backend — HTTP endpoint

`POST /api/v1/demos/{id}/rtc-token` in the authed group (`httpapi`):
1. `me := currentUser(r)`; load event + authorize via `demo.Service.GetEvent(ctx, id, me)` (404 if not found, 403 if not participant — reuses C1 mapping in `demoErr`).
2. If `event.Status != "live"` → `400 {"error":"event is not live"}`.
3. If `!livekit.Enabled()` → `503 {"error":"live video not configured"}`.
4. Determine the requester's room role: host ⇒ `host`; otherwise read their `RosterEntry.RoomRole` (already loaded with the event roster).
5. `grant := Grant{ CanPublish: roomRole == "host" || roomRole == "presenter" }`.
6. `token := livekit.Token(eventID, me, grant)`.
7. Respond `200 { "token", "url", "room": eventID, "identity": me, "canPublish": grant.CanPublish }` (camelCase).

`grantForRole(roomRole string) Grant` is a small helper next to the handler.

Wiring: add `LiveKit *livekit.Service` to `httpapi.Deps`; construct `livekit.New(cfg...)` in `cmd/server/main.go`.

### Frontend — `lib/demo/rtc.ts` (`feat/messaging-phase1`)

- `export interface RtcSession { token: string; url: string; room: string; identity: string; canPublish: boolean }`
- `export function fetchRtcToken(eventId: string): Promise<RtcSession | null>` — `msgPost<RtcSession>("/demos/{id}/rtc-token")` wrapped in `withFallback(() => null, "rtc token")`. Offline-safe.

### Frontend — `DemoStage.tsx` (new, isolated)

- Props: `{ session: RtcSession }`. Renders `<LiveKitRoom serverUrl={session.url} token={session.token} connect>` from `@livekit/components-react`, with a video grid (`GridLayout` + `ParticipantTile`) and a `<ControlBar>` shown only when `session.canPublish`. Imports `@livekit/components-styles`.
- Knows nothing about demo lifecycle — just renders a LiveKit room. The single file that owns the LiveKit dependency (swappable).

### Frontend — `DemoRoom.tsx` changes

- When `event.status === 'live'`: `fetchRtcToken(id)`; if a session returns, render a **lazily-imported** `<DemoStage session>` (`React.lazy` + `Suspense`) so LiveKit's bundle only loads in a live room.
- If token is `null` (endpoint down / unconfigured) → show "Live video is unavailable right now."
- If status is not `live`: existing room view; host still sees the C1 "Move to live" control to start the session.

## Data model

No schema change. Room identity derives from existing fields: `room = event.id`, `identity = userId`, permissions from `RosterEntry.RoomRole` + `event.status`.

## Error handling

| Condition | Response |
|---|---|
| Not host and not on roster | `403` (demo `ErrNotParticipant`) |
| Event not `live` | `400 "event is not live"` |
| LiveKit env not configured | `503 "live video not configured"` |
| Event missing | `404` (demo `ErrEventNotFound`) |
| FE token fetch fails | render "Live video is unavailable right now." |

## Testing

**Backend (`gobc`, no real LiveKit server):**
- `internal/livekit` unit: mint a token → parse/verify with `auth` → assert `room`, `identity`, and grants (`CanPublish` true for host/presenter, false for judge/audience); assert disabled service (no keys) returns an error.
- `httpapi` test for `/demos/{id}/rtc-token`: host participant → `200` + publish grant; audience participant → `200` + subscribe-only; outsider → `403`; not-live → `400`; unconfigured service → `503`. (Test wires `livekit.New` with dummy key/secret/url; the audience/host distinction is asserted by parsing the returned token.)

**Frontend (local gate + tsc):**
- `rtc.ts` test: returns `null` on fetch failure; shapes `RtcSession` on success (mock fetch).
- `tsc` on changed files; `DemoStage` lazy import compiles.

## Dependencies

- Go: `github.com/livekit/protocol` (auth).
- FE: `@livekit/components-react`, `livekit-client`, `@livekit/components-styles`.

## Out of scope (deferred)

- Recording / Egress (D2). AI feedback (D3). Presenter green-room during `scheduled`. In-room reactions/data messages. Audience Q&A beyond the existing messaging surface. Server-side room lifecycle control (create/close rooms) — not needed for token-only D1.

## Self-review notes

- No placeholders; every endpoint, grant, and error path is specified.
- Consistent with C1: reuses `demo.Service` authz + `demoErr` mapping; no schema change.
- Single-plan sized: one Go package + one endpoint + config + two FE files + tests.
- Ambiguity resolved: tokens are live-only (green room explicitly deferred); publish roles are host+presenter only.
