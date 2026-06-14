# WS2 Slice D2 — Audience Q&A — Design

> Status: approved (brainstorm). Branch (backend): `feat/messaging-backend`; (frontend): `feat/messaging-phase1`. Docs committed to both. Builds on WS2 C1 (demo events, roster, lifecycle) and D1 (live A/V room).

## Goal

Let the audience ask questions during a **live** demo. Any participant submits a question; participants upvote (one vote each, toggleable); the host/presenter marks a question **answered** or **dismissed** (answers are spoken on the live A/V stream — there is no written-answer text in this slice). Questions and votes are pushed to all participants in real time over the existing WS1 spine, with a REST fallback so screens render offline.

### Slice re-sequencing

The D1 spec sketched D2 = recording and D3 = AI feedback. This slice re-sequences the "live room" line:
- **D2 (this spec):** audience Q&A.
- **D3 (later):** recording via LiveKit Egress → S3/MinIO + playback.
- **D4 (later):** AI feedback (transcript/metrics → ai-router agent → structured critique). The persisted Q&A history from this slice is a natural input.

## Decisions (from brainstorm)

- **Feature set:** submit + upvote (one per user, toggleable) + host/presenter resolve (answered/dismissed). No written answers, no threading (would overlap the channel/messaging thread model).
- **Ordering:** questions listed in **arrival order**; each row shows its upvote count. No vote-sorted reordering server-side (the client may sort if it wants; default is arrival order).
- **Attribution:** questions are **attributed** — `asker_id` is stored and the asker is shown. No anonymous mode.
- **Submission gating:** a question may be asked **only while `event.status == "live"`**. Upvoting and resolving are also live-gated. Viewing the list is allowed to any participant at any time (draft/scheduled/ended too), so the host can review afterward.
- **Transport posture:** mirror the **feed** slice — all writes are REST; on each successful write the service fans out a `qa.*` envelope to the event's rostered participants via `hub`. No new client→server WS message types (the gateway is untouched).
- **Persistence:** Postgres (not ephemeral) — the Q&A history feeds D4 and lets the host review after the demo.
- **Verification posture:** service + httpapi unit tests, Postgres integration, vet, and a smoke regression on the backend; local node test gate + filtered `tsc` on the frontend. No new infra.

## Architecture

```
FE DemoRoom (Q&A panel, visible when participant can see event)
  ├─ GET  /api/v1/demos/{id}/questions                  → [{id, askerId, body, state, votes, mine, createdAt}]
  ├─ POST /api/v1/demos/{id}/questions {body}           → ask   (live-only)
  ├─ POST /api/v1/demos/{id}/questions/{qid}/upvote     → toggle vote (live-only)
  └─ POST /api/v1/demos/{id}/questions/{qid}/resolve {state} → answered|dismissed (host/presenter, live-only)
        backend httpapi handlers
          ├─ qa.Service authz via demo.Service.GetEvent (host or rostered) → else 403/404
          ├─ live-gating for write ops                                     → else 409
          ├─ persist (QAStore)                                             → else 500
          └─ fan-out qa.* envelope to event roster via hub.RouteToUser
                server→client WS: qa.new | qa.voted | qa.resolved
  FE MessagingProvider/wsReducer folds qa.* into live per-event question state
```

### Backend — `internal/store` (new types + interface)

New file `qa.go` (alongside `demo.go`):

- `type DemoQuestion struct { ID, EventID, AskerID, Body, State string; Votes int; CreatedAt, UpdatedAt time.Time }`
  - `Votes` is a derived/read field (populated by list queries), not a stored column.
- `type QuestionView struct { DemoQuestion; Mine bool }` — a question plus whether the viewer has voted. This is the single shape returned by list (store → service → HTTP), so there is no parallel-slice ambiguity.
- `KnownQuestionState = map[string]bool{"open": true, "answered": true, "dismissed": true}` (default `open`).
- `type QAStore interface {`
  - `CreateQuestion(ctx, DemoQuestion) error`
  - `GetQuestion(ctx, id string) (DemoQuestion, error)` — single question without vote count (authz/ownership checks)
  - `ListQuestions(ctx, eventID, viewerID string) ([]QuestionView, error)` — arrival order (oldest first); each view carries its vote count (`Votes`) and `Mine` (did `viewerID` vote)
  - `SetQuestionState(ctx, id, state string) error`
  - `AddVote(ctx, questionID, userID string) (bool, error)` — returns `true` if a vote was inserted, `false` if it already existed (no-op)
  - `RemoveVote(ctx, questionID, userID string) (bool, error)` — returns `true` if a vote was deleted, `false` if none existed
  - `CountVotes(ctx, questionID string) (int, error)` — current vote count (used by Upvote after a toggle)
  - `}`
- In-memory `FakeQAStore` (mutex-guarded, mirrors `FakeDemoStore`) + Postgres impl.

### Backend — Postgres migration `0006_demo_questions.sql`

```sql
CREATE TABLE IF NOT EXISTS demo_questions (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES demo_events(id) ON DELETE CASCADE,
  asker_id    TEXT NOT NULL,
  body        TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_demo_questions_event ON demo_questions(event_id, created_at);

CREATE TABLE IF NOT EXISTS demo_question_votes (
  question_id TEXT NOT NULL REFERENCES demo_questions(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);
```

(`MigrateAll` globs+sorts `NNNN_*.sql`; 0006 follows 0005.)

### Backend — `internal/qa` (Go, new package)

`qa.Service` depends on `store.QAStore`, the existing `*demo.Service` (for authz + roster), and `store.Router` (the `hub`, for fan-out). Mirrors `channel.Service`.

- `func New(qs store.QAStore, demos *demo.Service, r store.Router) *Service`
- Errors: `ErrNotLive` (write when not live), `ErrQuestionNotFound`, `ErrInvalidState`, `ErrEmptyBody`; demo-layer authz errors (`ErrNotParticipant`/`ErrNotHost`/`ErrEventNotFound`) propagate.
- `Ask(ctx, eventID, askerID, body string) (DemoQuestion, error)` — `GetEvent` authz (host or rostered, else 403/404); require live else `ErrNotLive`; trim+non-empty body else `ErrEmptyBody`; persist with UUIDv7 + `state="open"`; broadcast `qa.new`; return question (votes=0, mine=false).
- `Upvote(ctx, eventID, questionID, userID string) (votes int, mine bool, err error)` — authz; require live; load question (scoped to event); toggle (`AddVote`; if already present, `RemoveVote`); recount; broadcast `qa.voted {questionId, votes}`; return count + whether the user now has a vote.
- `Resolve(ctx, eventID, questionID, userID, state string) (DemoQuestion, error)` — authz **and** require `userID` is the host or a `presenter` in the roster (else `ErrNotHost`); require live; validate `state ∈ {answered, dismissed}` else `ErrInvalidState`; `SetQuestionState`; broadcast `qa.resolved {questionId, state}`; return updated question.
- `List(ctx, eventID, userID string) ([]store.QuestionView, error)` — `GetEvent` authz (any visibility-state); returns the store's arrival-order views (`votes` + `mine`) directly.
- **Fan-out:** `broadcast(ctx, eventID, envelope)` lists the event roster (host + accepted participants) and `hub.RouteToUser`s each. Host is always included. The acting user is included (their own client reconciles optimistic state). Nil-router safe (tests without a hub).

### Backend — `internal/protocol` (server→client types)

Add envelope `type` constants + payloads:
- `qa.new` → `{ eventId, question: {id, askerId, body, state, votes, createdAt} }`
- `qa.voted` → `{ eventId, questionId, votes }`
- `qa.resolved` → `{ eventId, questionId, state }`

No client→server additions; the WS gateway dispatch is unchanged.

### Backend — `internal/transport/httpapi`

New file `demo_qa.go`, 4 handlers, mounted under the existing `/demos/{id}` group:
- `POST /demos/{id}/questions` → `handleAskQuestion`
- `GET  /demos/{id}/questions` → `handleListQuestions`
- `POST /demos/{id}/questions/{qid}/upvote` → `handleUpvoteQuestion`
- `POST /demos/{id}/questions/{qid}/resolve` → `handleResolveQuestion`

`qaErr(w, err)` maps: `ErrEventNotFound`/`ErrQuestionNotFound`→404; `ErrNotParticipant`/`ErrNotHost`→403; `ErrInvalidState`/`ErrEmptyBody`→400; `ErrNotLive`→409; default→500. `QA *qa.Service` added to `httpapi.Deps`; wired in `cmd/server/main.go` (`qa.New(pg.QA, demoSvc, h)`).

## Frontend

- **`lib/demo/qa.ts`** — types (`Question`, `QuestionState`) + offline-safe client: `listQuestions(eventId)`, `askQuestion(eventId, body)`, `upvoteQuestion(eventId, qid)`, `resolveQuestion(eventId, qid, state)` via `msgGet`/`msgPost` + `withFallback` (list → `[]`, writes → `null`).
- **`lib/messaging/wsReducer.ts`** — handle `qa.new` (append to the event's list, preserving arrival order; dedup by question id so the asker's own optimistic insert doesn't double), `qa.voted` (update a question's `votes`), `qa.resolved` (update `state`). Keyed by `eventId`. + mirror unit tests in the local gate.
- **`contexts/MessagingProvider.tsx`** — expose per-event live questions (or a subscribe hook `useDemoQuestions(eventId)`), seeded from `listQuestions` and folded with `qa.*` events. Exact surface finalized in the plan; offline-safe.
- **`dashboard/demos/DemoRoom.tsx`** — a **Q&A panel** rendered when the event is visible (emphasized when live): a submit box (enabled only when live), the question list in arrival order (asker, body, vote count, an upvote toggle button reflecting `mine`), and answered/dismissed controls shown only to host/presenter. Resolved questions are visually de-emphasized (answered) or hidden/struck (dismissed). Uses existing tailwind patterns (no shadcn import).

## Error handling

- Backend: typed sentinel errors → HTTP status via `qaErr`; persist-before-broadcast (a failed broadcast never fails the write — fan-out errors are logged, mirroring feed/channel).
- Vote toggle is idempotent per `(question_id, user_id)` PK; double-submit converges.
- Frontend: every network call is `withFallback`-wrapped; the panel degrades to read-only/empty rather than throwing.

## Testing

- **Backend:** `qa` service unit tests (fakes) — ask authz + live-gating + empty-body; upvote toggle (insert→count1, repeat→count0); resolve host/presenter-only + state validation; list arrival order + votes/mine. `httpapi` tests — 4 endpoints, status codes (404/403/400/409), end-to-end ask→upvote→list→resolve. Postgres integration (real pg16, per-run unique IDs) — vote PK dedup + CASCADE. `vet`. Smoke regression (existing demo + DM paths still pass). `gobc` Docker gate.
- **Frontend:** `qa.ts` offline-safety + `wsReducer` qa.* folding via the local node gate (`npm run test:local`); `tsc` filtered to `lib/demo` + `dashboard/demos` + `lib/messaging`.

## Scope / Non-goals

- **In:** ask, upvote (toggle), resolve (answered/dismissed), live list + real-time push, REST fallback, persistence.
- **Out (later):** written/threaded answers; anonymous questions; vote-sorted server ordering; moderation beyond dismiss; rate-limiting (WS5 security); recording (D3); AI feedback (D4). Q&A on non-live events is view-only.

## Units & boundaries

- `store.QAStore` (+ fake + pg) — persistence only; knows nothing of authz or transport.
- `qa.Service` — Q&A rules + fan-out; depends on `QAStore`, `demo.Service` (authz/roster), `Router` (hub). One clear purpose.
- `httpapi/demo_qa.go` — HTTP boundary; translates requests/errors, no business logic.
- `lib/demo/qa.ts` — FE data access; offline-safe, transport-only.
- `DemoRoom` Q&A panel — presentation; consumes the provider hook, holds no business rules.
