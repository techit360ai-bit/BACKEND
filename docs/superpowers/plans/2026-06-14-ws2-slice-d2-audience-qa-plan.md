# WS2 Slice D2 — Audience Q&A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any participant ask questions during a **live** demo, upvote (one toggleable vote each), and let the host/presenter mark a question answered or dismissed — pushed to all participants in real time, with a REST fallback.

**Architecture:** Mirrors the existing `feed`/`channel` slices. A new `internal/qa` service persists questions/votes via a new `store.QAStore`, then fans out `qa.*` envelopes to the event roster through the existing `hub` (`store.Router`). All writes are REST; the WS gateway is untouched (server→client push only). Frontend adds an offline-safe `lib/demo/qa.ts` client, folds `qa.*` into the `wsReducer`, and renders a Q&A panel in `DemoRoom`.

**Tech Stack:** Go (chi, pgx, existing hub/pubsub); React/TS; `gobc` Docker test gate; FE local node gate + `tsc`.

**Branches:** backend tasks (1–7) on `feat/messaging-backend`; frontend tasks (8–11) on `feat/messaging-phase1`. Spec + this plan committed to both.

**`gobc` alias** (run from `backend/`):
```bash
gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
```

## File Structure

**Backend (`feat/messaging-backend`):**
- Create `backend/internal/store/qa.go` — `DemoQuestion`, `QuestionView`, `KnownQuestionState`, `QAStore` interface.
- Create `backend/internal/store/qa_fake.go` — `FakeQAStore` (in-memory).
- Modify `backend/internal/store/fakes.go` — add `QA *FakeQAStore` to `FakeStores` + init.
- Create `backend/internal/store/migrations/0006_demo_questions.sql`.
- Create `backend/internal/store/postgres/qa.go` — `QAStore` (pg impl); modify `postgres.go` to wire `QA`.
- Modify `backend/internal/protocol/envelope.go` — `qa.*` type constants.
- Create `backend/internal/qa/service.go` + `backend/internal/qa/service_test.go`.
- Create `backend/internal/transport/httpapi/demo_qa.go`; modify `router.go` (Deps.QA + mounts) + `httpapi_test.go`.
- Modify `backend/cmd/server/main.go` — construct `qa.New(...)` + pass to Deps.
- Modify `backend/internal/store/postgres/postgres_test.go` — QA integration test.

**Frontend (`feat/messaging-phase1`):**
- Create `frontend/src/lib/demo/qa.ts` + `frontend/src/lib/demo/qa.test.ts`.
- Modify `frontend/src/lib/messaging/wsReducer.ts` + `frontend/src/lib/messaging/wsReducer.test.ts`.
- Modify `frontend/src/dashboard/demos/DemoRoom.tsx`.

---

## Task 1 — store: QA types, `QAStore`, fake, migration

**Branch:** `feat/messaging-backend`.
**Files:**
- Create: `backend/internal/store/qa.go`
- Create: `backend/internal/store/qa_fake.go`
- Modify: `backend/internal/store/fakes.go`
- Create: `backend/internal/store/migrations/0006_demo_questions.sql`
- Test: `backend/internal/store/qa_fake_test.go`

- [ ] **Step 1: Write the failing test** (`backend/internal/store/qa_fake_test.go`)

```go
package store

import (
	"context"
	"testing"
	"time"
)

func newFakeQA() *FakeQAStore {
	return &FakeQAStore{questions: map[string]DemoQuestion{}, order: nil, votes: map[string]map[string]struct{}{}}
}

func TestFakeQAStore_CreateListVoteState(t *testing.T) {
	s := newFakeQA()
	ctx := context.Background()
	now := time.Now().UTC()
	q := DemoQuestion{ID: "q1", EventID: "e1", AskerID: "u1", Body: "why?", State: "open", CreatedAt: now, UpdatedAt: now}
	if err := s.CreateQuestion(ctx, q); err != nil {
		t.Fatalf("create: %v", err)
	}

	// list as viewer u2 -> one view, 0 votes, not mine
	views, err := s.ListQuestions(ctx, "e1", "u2")
	if err != nil || len(views) != 1 {
		t.Fatalf("list: %v len=%d", err, len(views))
	}
	if views[0].Votes != 0 || views[0].Mine {
		t.Fatalf("unexpected view: %+v", views[0])
	}

	// u2 votes -> inserted true; count 1; mine true for u2
	ins, err := s.AddVote(ctx, "q1", "u2")
	if err != nil || !ins {
		t.Fatalf("addvote: %v ins=%v", err, ins)
	}
	if ins2, _ := s.AddVote(ctx, "q1", "u2"); ins2 {
		t.Fatal("second AddVote should be no-op (false)")
	}
	if n, _ := s.CountVotes(ctx, "q1"); n != 1 {
		t.Fatalf("count=%d want 1", n)
	}
	views, _ = s.ListQuestions(ctx, "e1", "u2")
	if views[0].Votes != 1 || !views[0].Mine {
		t.Fatalf("after vote: %+v", views[0])
	}

	// remove vote -> deleted true; count 0
	del, _ := s.RemoveVote(ctx, "q1", "u2")
	if !del {
		t.Fatal("RemoveVote should report deleted")
	}
	if n, _ := s.CountVotes(ctx, "q1"); n != 0 {
		t.Fatalf("count=%d want 0", n)
	}

	// set state
	if err := s.SetQuestionState(ctx, "q1", "answered"); err != nil {
		t.Fatalf("setstate: %v", err)
	}
	got, _ := s.GetQuestion(ctx, "q1")
	if got.State != "answered" {
		t.Fatalf("state=%s", got.State)
	}

	// not found
	if _, err := s.GetQuestion(ctx, "nope"); err != ErrNotFound {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend
gobc test ./internal/store/
```
Expected: FAIL — `undefined: FakeQAStore` / `DemoQuestion` / `QuestionView`.

- [ ] **Step 3: Write the types + interface** (`backend/internal/store/qa.go`)

```go
package store

import (
	"context"
	"time"
)

// DemoQuestion is one audience question in a demo event's Q&A.
// Votes is a derived read field (count), not a stored column.
type DemoQuestion struct {
	ID        string
	EventID   string
	AskerID   string
	Body      string
	State     string // open | answered | dismissed
	Votes     int
	CreatedAt time.Time
	UpdatedAt time.Time
}

// QuestionView is a question plus whether the viewer has upvoted it.
type QuestionView struct {
	DemoQuestion
	Mine bool
}

// KnownQuestionState gates resolve states (open is the default, set at creation).
var KnownQuestionState = map[string]bool{"open": true, "answered": true, "dismissed": true}

// QAStore persists demo questions and their votes.
type QAStore interface {
	CreateQuestion(ctx context.Context, q DemoQuestion) error
	GetQuestion(ctx context.Context, id string) (DemoQuestion, error)
	ListQuestions(ctx context.Context, eventID, viewerID string) ([]QuestionView, error)
	SetQuestionState(ctx context.Context, id, state string) error
	AddVote(ctx context.Context, questionID, userID string) (bool, error)    // true if inserted
	RemoveVote(ctx context.Context, questionID, userID string) (bool, error) // true if deleted
	CountVotes(ctx context.Context, questionID string) (int, error)
}
```

- [ ] **Step 4: Write the fake** (`backend/internal/store/qa_fake.go`)

```go
package store

import (
	"context"
	"sort"
	"sync"
)

// FakeQAStore is an in-memory QAStore for unit tests.
type FakeQAStore struct {
	mu        sync.Mutex
	questions map[string]DemoQuestion         // id -> question
	order     []string                        // insertion order (arrival)
	votes     map[string]map[string]struct{}  // questionID -> set of userIDs
}

func (s *FakeQAStore) CreateQuestion(_ context.Context, q DemoQuestion) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.questions[q.ID] = q
	s.order = append(s.order, q.ID)
	return nil
}

func (s *FakeQAStore) GetQuestion(_ context.Context, id string) (DemoQuestion, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	q, ok := s.questions[id]
	if !ok {
		return DemoQuestion{}, ErrNotFound
	}
	return q, nil
}

func (s *FakeQAStore) ListQuestions(_ context.Context, eventID, viewerID string) ([]QuestionView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []QuestionView
	for _, id := range s.order {
		q := s.questions[id]
		if q.EventID != eventID {
			continue
		}
		voters := s.votes[id]
		q.Votes = len(voters)
		_, mine := voters[viewerID]
		out = append(out, QuestionView{DemoQuestion: q, Mine: mine})
	}
	// order slice already arrival order; keep stable
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt.Before(out[j].CreatedAt) })
	return out, nil
}

func (s *FakeQAStore) SetQuestionState(_ context.Context, id, state string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	q, ok := s.questions[id]
	if !ok {
		return ErrNotFound
	}
	q.State = state
	s.questions[id] = q
	return nil
}

func (s *FakeQAStore) AddVote(_ context.Context, questionID, userID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.questions[questionID]; !ok {
		return false, ErrNotFound
	}
	set := s.votes[questionID]
	if set == nil {
		set = map[string]struct{}{}
		s.votes[questionID] = set
	}
	if _, exists := set[userID]; exists {
		return false, nil
	}
	set[userID] = struct{}{}
	return true, nil
}

func (s *FakeQAStore) RemoveVote(_ context.Context, questionID, userID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	set := s.votes[questionID]
	if _, exists := set[userID]; !exists {
		return false, nil
	}
	delete(set, userID)
	return true, nil
}

func (s *FakeQAStore) CountVotes(_ context.Context, questionID string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.votes[questionID]), nil
}
```

- [ ] **Step 5: Wire `QA` into `FakeStores`** (`backend/internal/store/fakes.go`)

In the `FakeStores` struct (after `Demo *FakeDemoStore`) add:
```go
	QA *FakeQAStore
```
In `NewFakeStores()` (after the `Demo: &FakeDemoStore{...}` line) add:
```go
		QA: &FakeQAStore{questions: map[string]DemoQuestion{}, order: nil, votes: map[string]map[string]struct{}{}},
```

- [ ] **Step 6: Write the migration** (`backend/internal/store/migrations/0006_demo_questions.sql`)

```sql
-- WS2 Demo Day: audience Q&A. TEXT ids (accept dev-token user ids).
CREATE TABLE IF NOT EXISTS demo_questions (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES demo_events(id) ON DELETE CASCADE,
  asker_id    TEXT NOT NULL,
  body        TEXT NOT NULL,
  state       TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_question_votes (
  question_id TEXT NOT NULL REFERENCES demo_questions(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_demo_questions_event ON demo_questions (event_id, created_at);
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd backend
gobc test ./internal/store/
gobc vet ./internal/store/
```
Expected: PASS; vet clean.

- [ ] **Step 8: Commit**

```bash
git add backend/internal/store/qa.go backend/internal/store/qa_fake.go backend/internal/store/qa_fake_test.go backend/internal/store/fakes.go backend/internal/store/migrations/0006_demo_questions.sql
git commit -m "feat(ws2): QA store types, QAStore + fake, migration 0006 (D2)"
```

---

## Task 2 — postgres `QAStore`

**Branch:** `feat/messaging-backend`.
**Files:**
- Create: `backend/internal/store/postgres/qa.go`
- Modify: `backend/internal/store/postgres/postgres.go`

(Unit suite has no DB; this impl is exercised by the integration test in Task 6. The compile-time interface assertion below is the unit-level guard.)

- [ ] **Step 1: Write the implementation** (`backend/internal/store/postgres/qa.go`)

```go
package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type QAStore struct{ pool *pgxpool.Pool }

var _ store.QAStore = (*QAStore)(nil)

func (s *QAStore) CreateQuestion(ctx context.Context, q store.DemoQuestion) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO demo_questions (id, event_id, asker_id, body, state, created_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		q.ID, q.EventID, q.AskerID, q.Body, q.State, q.CreatedAt, q.UpdatedAt)
	return err
}

func (s *QAStore) GetQuestion(ctx context.Context, id string) (store.DemoQuestion, error) {
	var q store.DemoQuestion
	err := s.pool.QueryRow(ctx, `
		SELECT id, event_id, asker_id, body, state, created_at, updated_at
		FROM demo_questions WHERE id=$1`, id).
		Scan(&q.ID, &q.EventID, &q.AskerID, &q.Body, &q.State, &q.CreatedAt, &q.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return store.DemoQuestion{}, store.ErrNotFound
	}
	return q, err
}

func (s *QAStore) ListQuestions(ctx context.Context, eventID, viewerID string) ([]store.QuestionView, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT q.id, q.event_id, q.asker_id, q.body, q.state, q.created_at, q.updated_at,
		       COUNT(v.user_id) AS votes,
		       BOOL_OR(v.user_id = $2) AS mine
		FROM demo_questions q
		LEFT JOIN demo_question_votes v ON v.question_id = q.id
		WHERE q.event_id = $1
		GROUP BY q.id
		ORDER BY q.created_at`, eventID, viewerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.QuestionView
	for rows.Next() {
		var qv store.QuestionView
		var mine *bool // BOOL_OR is NULL when there are no vote rows
		if err := rows.Scan(&qv.ID, &qv.EventID, &qv.AskerID, &qv.Body, &qv.State,
			&qv.CreatedAt, &qv.UpdatedAt, &qv.Votes, &mine); err != nil {
			return nil, err
		}
		qv.Mine = mine != nil && *mine
		out = append(out, qv)
	}
	return out, rows.Err()
}

func (s *QAStore) SetQuestionState(ctx context.Context, id, state string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE demo_questions SET state=$2, updated_at=now() WHERE id=$1`, id, state)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}

func (s *QAStore) AddVote(ctx context.Context, questionID, userID string) (bool, error) {
	tag, err := s.pool.Exec(ctx, `
		INSERT INTO demo_question_votes (question_id, user_id) VALUES ($1,$2)
		ON CONFLICT (question_id, user_id) DO NOTHING`, questionID, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (s *QAStore) RemoveVote(ctx context.Context, questionID, userID string) (bool, error) {
	tag, err := s.pool.Exec(ctx, `DELETE FROM demo_question_votes WHERE question_id=$1 AND user_id=$2`, questionID, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func (s *QAStore) CountVotes(ctx context.Context, questionID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM demo_question_votes WHERE question_id=$1`, questionID).Scan(&n)
	return n, err
}
```

- [ ] **Step 2: Wire `QA` into the postgres `Store`** (`backend/internal/store/postgres/postgres.go`)

In the `Store` struct (after `Demo *DemoStore`) add:
```go
	QA *QAStore
```
In `Open` (after `s.Demo = &DemoStore{pool: pool}`) add:
```go
	s.QA = &QAStore{pool: pool}
```

- [ ] **Step 3: Verify it builds + vet**

```bash
cd backend
gobc build ./...
gobc vet ./internal/store/postgres/
```
Expected: builds clean; vet clean. (The `var _ store.QAStore` assertion fails the build if any method signature drifts.)

- [ ] **Step 4: Commit**

```bash
git add backend/internal/store/postgres/qa.go backend/internal/store/postgres/postgres.go
git commit -m "feat(ws2): postgres QAStore (D2)"
```

---

## Task 3 — protocol `qa.*` types

**Branch:** `feat/messaging-backend`.
**Files:**
- Modify: `backend/internal/protocol/envelope.go`
- Test: `backend/internal/protocol/envelope_test.go`

- [ ] **Step 1: Add the failing test assertion** (append to `backend/internal/protocol/envelope_test.go`)

```go
func TestQATypesDefined(t *testing.T) {
	if TypeQANew == "" || TypeQAVoted == "" || TypeQAResolved == "" {
		t.Fatal("qa.* type constants must be non-empty")
	}
	if TypeQANew != "qa.new" || TypeQAVoted != "qa.voted" || TypeQAResolved != "qa.resolved" {
		t.Fatalf("unexpected qa type values: %s %s %s", TypeQANew, TypeQAVoted, TypeQAResolved)
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend
gobc test ./internal/protocol/
```
Expected: FAIL — `undefined: TypeQANew`.

- [ ] **Step 3: Add the constants** (`backend/internal/protocol/envelope.go`)

In the server→client `const (...)` block (the one containing `TypePostNew`/`TypePostLiked`/`TypePostComment`), after `TypePostComment = "post.comment"` add:
```go
	TypeQANew      = "qa.new"
	TypeQAVoted    = "qa.voted"
	TypeQAResolved = "qa.resolved"
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd backend
gobc test ./internal/protocol/
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/protocol/envelope.go backend/internal/protocol/envelope_test.go
git commit -m "feat(ws2): qa.* protocol type constants (D2)"
```

---

## Task 4 — `internal/qa` service (rules + fan-out)

**Branch:** `feat/messaging-backend`.
**Files:**
- Create: `backend/internal/qa/service.go`
- Test: `backend/internal/qa/service_test.go`

The service depends on `store.QAStore`, the existing `*demo.Service` (authz + roster), and `store.Router` (hub fan-out). It mirrors `channel.Service`.

- [ ] **Step 1: Write the failing test** (`backend/internal/qa/service_test.go`)

```go
package qa

import (
	"context"
	"errors"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/demo"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

// liveEvent creates an event via demo.Service and drives it to "live".
func liveEvent(t *testing.T, ctx context.Context, ds *demo.Service, host string) string {
	t.Helper()
	ev, err := ds.Create(ctx, host, demo.CreateEventInput{Kind: "startup", Title: "T"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := ds.Transition(ctx, ev.ID, host, "scheduled"); err != nil {
		t.Fatalf("sched: %v", err)
	}
	if _, err := ds.Transition(ctx, ev.ID, host, "live"); err != nil {
		t.Fatalf("live: %v", err)
	}
	return ev.ID
}

func newSvc(st *store.FakeStores) (*Service, *demo.Service) {
	ds := demo.New(st.Demo)
	return New(st.QA, ds, &store.FakeRouter{}), ds
}

func TestAsk_RequiresLiveAndParticipant(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	id := liveEvent(t, ctx, ds, "host1")

	// outsider cannot ask
	if _, err := s.Ask(ctx, id, "stranger", "q?"); !errors.Is(err, demo.ErrNotParticipant) {
		t.Fatalf("outsider want ErrNotParticipant, got %v", err)
	}
	// invite + accept an audience member, then they can ask
	if _, err := ds.Invite(ctx, id, "host1", demo.InviteInput{UserID: "aud1", RoomRole: "audience"}); err != nil {
		t.Fatalf("invite: %v", err)
	}
	if _, err := ds.RespondInvite(ctx, id, "aud1", true); err != nil {
		t.Fatalf("accept: %v", err)
	}
	q, err := s.Ask(ctx, id, "aud1", "  why?  ")
	if err != nil {
		t.Fatalf("ask: %v", err)
	}
	if q.Body != "why?" || q.State != "open" || q.AskerID != "aud1" {
		t.Fatalf("bad question: %+v", q)
	}
	// empty body rejected
	if _, err := s.Ask(ctx, id, "host1", "   "); !errors.Is(err, ErrEmptyBody) {
		t.Fatalf("empty want ErrEmptyBody, got %v", err)
	}
}

func TestAsk_NotLive(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	ev, _ := ds.Create(ctx, "host1", demo.CreateEventInput{Kind: "startup", Title: "T"}) // draft
	if _, err := s.Ask(ctx, ev.ID, "host1", "q?"); !errors.Is(err, ErrNotLive) {
		t.Fatalf("draft ask want ErrNotLive, got %v", err)
	}
}

func TestUpvote_Toggle(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	id := liveEvent(t, ctx, ds, "host1")
	q, _ := s.Ask(ctx, id, "host1", "q?")

	votes, mine, err := s.Upvote(ctx, id, q.ID, "host1")
	if err != nil || votes != 1 || !mine {
		t.Fatalf("first upvote: votes=%d mine=%v err=%v", votes, mine, err)
	}
	votes, mine, err = s.Upvote(ctx, id, q.ID, "host1")
	if err != nil || votes != 0 || mine {
		t.Fatalf("toggle off: votes=%d mine=%v err=%v", votes, mine, err)
	}
}

func TestResolve_HostOrPresenterOnly(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	id := liveEvent(t, ctx, ds, "host1")
	q, _ := s.Ask(ctx, id, "host1", "q?")

	// audience participant cannot resolve
	_, _ = ds.Invite(ctx, id, "host1", demo.InviteInput{UserID: "aud1", RoomRole: "audience"})
	_, _ = ds.RespondInvite(ctx, id, "aud1", true)
	if _, err := s.Resolve(ctx, id, q.ID, "aud1", "answered"); !errors.Is(err, ErrNotHost) {
		t.Fatalf("audience resolve want ErrNotHost, got %v", err)
	}
	// invalid state rejected
	if _, err := s.Resolve(ctx, id, q.ID, "host1", "bogus"); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("bad state want ErrInvalidState, got %v", err)
	}
	// presenter can resolve
	_, _ = ds.Invite(ctx, id, "host1", demo.InviteInput{UserID: "pres1", RoomRole: "presenter"})
	_, _ = ds.RespondInvite(ctx, id, "pres1", true)
	got, err := s.Resolve(ctx, id, q.ID, "pres1", "answered")
	if err != nil || got.State != "answered" {
		t.Fatalf("presenter resolve: state=%s err=%v", got.State, err)
	}
}

func TestList_ArrivalOrderAndAuthz(t *testing.T) {
	st := store.NewFakeStores()
	s, ds := newSvc(st)
	ctx := context.Background()
	id := liveEvent(t, ctx, ds, "host1")
	_, _ = s.Ask(ctx, id, "host1", "first")
	_, _ = s.Ask(ctx, id, "host1", "second")

	views, err := s.List(ctx, id, "host1")
	if err != nil || len(views) != 2 {
		t.Fatalf("list: %v len=%d", err, len(views))
	}
	if views[0].Body != "first" || views[1].Body != "second" {
		t.Fatalf("not arrival order: %+v", views)
	}
	// outsider cannot list
	if _, err := s.List(ctx, id, "stranger"); !errors.Is(err, demo.ErrNotParticipant) {
		t.Fatalf("outsider list want ErrNotParticipant, got %v", err)
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend
gobc test ./internal/qa/
```
Expected: FAIL — `undefined: New` / `Service` / `ErrEmptyBody` / etc.

- [ ] **Step 3: Write the implementation** (`backend/internal/qa/service.go`)

```go
// Package qa implements WS2 audience Q&A: ask / upvote (toggle) / resolve over a
// store.QAStore, authorized via demo.Service, with qa.* fan-out to the event
// roster through a store.Router. Mirrors the channel/feed slices.
package qa

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/demo"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

var (
	ErrNotLive          = errors.New("qa: event is not live")
	ErrQuestionNotFound = errors.New("qa: question not found")
	ErrInvalidState     = errors.New("qa: invalid resolve state")
	ErrEmptyBody        = errors.New("qa: empty question body")
)

// Service owns Q&A rules + fan-out.
type Service struct {
	qa     store.QAStore
	demos  *demo.Service
	router store.Router
	now    func() time.Time
}

// New builds a qa.Service. router may be nil (fan-out becomes a no-op) for tests.
func New(qs store.QAStore, demos *demo.Service, r store.Router) *Service {
	return &Service{qa: qs, demos: demos, router: r, now: time.Now}
}

// requireLive authorizes userID for the event (host or rostered) and requires live.
func (s *Service) requireLive(ctx context.Context, eventID, userID string) (store.DemoEvent, error) {
	ev, err := s.demos.GetEvent(ctx, eventID, userID) // 403/404 via demo errors
	if err != nil {
		return store.DemoEvent{}, err
	}
	if ev.Status != "live" {
		return store.DemoEvent{}, ErrNotLive
	}
	return ev, nil
}

// Ask persists a new question (live + participant) and broadcasts qa.new.
func (s *Service) Ask(ctx context.Context, eventID, askerID, body string) (store.DemoQuestion, error) {
	if _, err := s.requireLive(ctx, eventID, askerID); err != nil {
		return store.DemoQuestion{}, err
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return store.DemoQuestion{}, ErrEmptyBody
	}
	now := s.now().UTC()
	q := store.DemoQuestion{
		ID: protocol.NewMsgID(), EventID: eventID, AskerID: askerID, Body: body,
		State: "open", Votes: 0, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.qa.CreateQuestion(ctx, q); err != nil {
		return store.DemoQuestion{}, err
	}
	s.broadcast(ctx, eventID, protocol.TypeQANew, map[string]any{
		"eventId": eventID,
		"question": map[string]any{
			"id": q.ID, "eventId": q.EventID, "askerId": q.AskerID, "body": q.Body,
			"state": q.State, "votes": 0, "createdAt": q.CreatedAt.Format(time.RFC3339),
		},
	})
	return q, nil
}

// Upvote toggles the caller's vote and broadcasts qa.voted with the new count.
func (s *Service) Upvote(ctx context.Context, eventID, questionID, userID string) (int, bool, error) {
	if _, err := s.requireLive(ctx, eventID, userID); err != nil {
		return 0, false, err
	}
	q, err := s.qa.GetQuestion(ctx, questionID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return 0, false, ErrQuestionNotFound
		}
		return 0, false, err
	}
	if q.EventID != eventID {
		return 0, false, ErrQuestionNotFound
	}
	inserted, err := s.qa.AddVote(ctx, questionID, userID)
	if err != nil {
		return 0, false, err
	}
	mine := true
	if !inserted {
		if _, err := s.qa.RemoveVote(ctx, questionID, userID); err != nil {
			return 0, false, err
		}
		mine = false
	}
	votes, err := s.qa.CountVotes(ctx, questionID)
	if err != nil {
		return 0, false, err
	}
	s.broadcast(ctx, eventID, protocol.TypeQAVoted, map[string]any{
		"eventId": eventID, "questionId": questionID, "votes": votes,
	})
	return votes, mine, nil
}

// Resolve marks a question answered/dismissed (host or presenter, live).
func (s *Service) Resolve(ctx context.Context, eventID, questionID, userID, state string) (store.DemoQuestion, error) {
	ev, err := s.requireLive(ctx, eventID, userID)
	if err != nil {
		return store.DemoQuestion{}, err
	}
	if !s.isHostOrPresenter(ctx, ev, userID) {
		return store.DemoQuestion{}, demo.ErrNotHost
	}
	if state != "answered" && state != "dismissed" {
		return store.DemoQuestion{}, ErrInvalidState
	}
	q, err := s.qa.GetQuestion(ctx, questionID)
	if err != nil || q.EventID != eventID {
		return store.DemoQuestion{}, ErrQuestionNotFound
	}
	if err := s.qa.SetQuestionState(ctx, questionID, state); err != nil {
		return store.DemoQuestion{}, err
	}
	q.State = state
	s.broadcast(ctx, eventID, protocol.TypeQAResolved, map[string]any{
		"eventId": eventID, "questionId": questionID, "state": state,
	})
	return q, nil
}

// List returns the event's questions in arrival order (participant-only).
func (s *Service) List(ctx context.Context, eventID, userID string) ([]store.QuestionView, error) {
	if _, err := s.demos.GetEvent(ctx, eventID, userID); err != nil {
		return nil, err
	}
	return s.qa.ListQuestions(ctx, eventID, userID)
}

func (s *Service) isHostOrPresenter(ctx context.Context, ev store.DemoEvent, userID string) bool {
	if ev.HostID == userID {
		return true
	}
	roster, err := s.demos.ListRoster(ctx, ev.ID, userID)
	if err != nil {
		return false
	}
	for _, e := range roster {
		if e.UserID == userID && e.RoomRole == "presenter" {
			return true
		}
	}
	return false
}

// broadcast fans an envelope out to every roster member (nil-router safe).
func (s *Service) broadcast(ctx context.Context, eventID, typ string, data map[string]any) {
	if s.router == nil {
		return
	}
	roster, err := s.demos.store_ListRoster(ctx, eventID)
	if err != nil {
		return
	}
	raw, _ := json.Marshal(data)
	env := protocol.Envelope{Type: typ, ID: protocol.NewMsgID(), TS: s.now().UTC().Format(time.RFC3339), Data: raw}
	for _, e := range roster {
		_, _ = s.router.RouteToUser(ctx, e.UserID, env)
	}
}
```

> **Roster access for fan-out:** `broadcast` needs the full roster without a per-caller authz gate. `demo.Service.ListRoster` requires a participant `userID`. Add a small unauthenticated accessor to `demo.Service` rather than reaching into the store from `qa`. In `backend/internal/demo/service.go`, add:
> ```go
> // Roster returns an event's full roster without an access check (internal
> // fan-out helper for sibling services; callers must authorize separately).
> func (s *Service) Roster(ctx context.Context, eventID string) ([]store.RosterEntry, error) {
> 	return s.store.ListRoster(ctx, eventID)
> }
> ```
> Then in `broadcast` replace `s.demos.store_ListRoster(ctx, eventID)` with `s.demos.Roster(ctx, eventID)`. (The `store_ListRoster` name above is a deliberate placeholder to force this step — it will not compile until you add `Roster` and call it.)

- [ ] **Step 4: Add the `Roster` accessor** (`backend/internal/demo/service.go`)

Add the `Roster` method shown in the note above (after `ListRoster`). Update `qa/service.go`'s `broadcast` to call `s.demos.Roster(ctx, eventID)`.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd backend
gobc test ./internal/qa/ ./internal/demo/
gobc vet ./internal/qa/ ./internal/demo/
```
Expected: PASS; vet clean.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/qa/ backend/internal/demo/service.go
git commit -m "feat(ws2): qa.Service ask/upvote/resolve/list + roster fan-out (D2)"
```

---

## Task 5 — httpapi endpoints + main wiring

**Branch:** `feat/messaging-backend`.
**Files:**
- Create: `backend/internal/transport/httpapi/demo_qa.go`
- Modify: `backend/internal/transport/httpapi/router.go` (Deps.QA + mounts)
- Modify: `backend/cmd/server/main.go` (construct + pass)
- Test: `backend/internal/transport/httpapi/httpapi_test.go`

- [ ] **Step 1: Write the failing test** (append to `backend/internal/transport/httpapi/httpapi_test.go`)

First wire QA into `newAPI`. After `demoSvc := demo.New(st.Demo)` add:
```go
	qaSvc := qa.New(st.QA, demoSvc, h)
```
(`h` is the `hub.New(pubsub.NewInMemory())` already constructed in `newAPI` and passed as the `store.Router` to `channel.New`/`messaging.New` — reuse it here for the same role.) Add `QA: qaSvc,` to the `Deps{...}` literal (next to `Demo: demoSvc,`). Add import `"github.com/techit360ai-bit/new-frontend/backend/internal/qa"`.

Then append:
```go
func TestDemoQAFlow(t *testing.T) {
	r, ver, _ := newAPI(t)
	hostTok, _ := ver.Mint("host1", "Host", "founder")
	hostHdr := map[string]string{"Authorization": "Bearer " + hostTok}

	do := func(method, path, body string, hdr map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewReader([]byte(body)))
		for k, v := range hdr {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}

	// create + go live
	rec := do("POST", "/api/v1/demos", `{"kind":"startup","title":"L"}`, hostHdr)
	var created map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	id := created["id"].(string)

	// ask before live -> 409
	if rec = do("POST", "/api/v1/demos/"+id+"/questions", `{"body":"early?"}`, hostHdr); rec.Code != 409 {
		t.Fatalf("pre-live ask want 409, got %d", rec.Code)
	}
	_ = do("POST", "/api/v1/demos/"+id+"/status", `{"status":"scheduled"}`, hostHdr)
	_ = do("POST", "/api/v1/demos/"+id+"/status", `{"status":"live"}`, hostHdr)

	// ask -> 200, question id present
	rec = do("POST", "/api/v1/demos/"+id+"/questions", `{"body":"why this?"}`, hostHdr)
	if rec.Code != 200 {
		t.Fatalf("ask want 200, got %d body=%s", rec.Code, rec.Body)
	}
	var q struct {
		ID    string `json:"id"`
		Body  string `json:"body"`
		State string `json:"state"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &q)
	if q.ID == "" || q.Body != "why this?" || q.State != "open" {
		t.Fatalf("bad question: %+v", q)
	}

	// empty body -> 400
	if rec = do("POST", "/api/v1/demos/"+id+"/questions", `{"body":"  "}`, hostHdr); rec.Code != 400 {
		t.Fatalf("empty body want 400, got %d", rec.Code)
	}

	// upvote -> 200, votes=1, mine=true
	rec = do("POST", "/api/v1/demos/"+id+"/questions/"+q.ID+"/upvote", "", hostHdr)
	var uv struct {
		Votes int  `json:"votes"`
		Mine  bool `json:"mine"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &uv)
	if rec.Code != 200 || uv.Votes != 1 || !uv.Mine {
		t.Fatalf("upvote: code=%d %+v", rec.Code, uv)
	}

	// list -> 200, one question with votes=1, mine=true
	rec = do("GET", "/api/v1/demos/"+id+"/questions", "", hostHdr)
	var list struct {
		Questions []struct {
			ID    string `json:"id"`
			Votes int    `json:"votes"`
			Mine  bool   `json:"mine"`
		} `json:"questions"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if rec.Code != 200 || len(list.Questions) != 1 || list.Questions[0].Votes != 1 || !list.Questions[0].Mine {
		t.Fatalf("list: code=%d %+v", rec.Code, list)
	}

	// resolve -> 200, answered
	rec = do("POST", "/api/v1/demos/"+id+"/questions/"+q.ID+"/resolve", `{"state":"answered"}`, hostHdr)
	if rec.Code != 200 {
		t.Fatalf("resolve want 200, got %d body=%s", rec.Code, rec.Body)
	}
	// invalid resolve state -> 400
	if rec = do("POST", "/api/v1/demos/"+id+"/questions/"+q.ID+"/resolve", `{"state":"bogus"}`, hostHdr); rec.Code != 400 {
		t.Fatalf("bad state want 400, got %d", rec.Code)
	}

	// outsider ask -> 403
	outTok, _ := ver.Mint("stranger", "S", "founder")
	outHdr := map[string]string{"Authorization": "Bearer " + outTok}
	if rec = do("POST", "/api/v1/demos/"+id+"/questions", `{"body":"hi"}`, outHdr); rec.Code != 403 {
		t.Fatalf("outsider ask want 403, got %d", rec.Code)
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend
gobc test ./internal/transport/httpapi/
```
Expected: FAIL — `qa` undefined / routes 404.

- [ ] **Step 3: Implement the handlers** (`backend/internal/transport/httpapi/demo_qa.go`)

```go
package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/new-frontend/backend/internal/demo"
	"github.com/techit360ai-bit/new-frontend/backend/internal/qa"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func qaErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, demo.ErrEventNotFound), errors.Is(err, qa.ErrQuestionNotFound):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, demo.ErrNotParticipant), errors.Is(err, demo.ErrNotHost):
		writeErr(w, http.StatusForbidden, err.Error())
	case errors.Is(err, qa.ErrInvalidState), errors.Is(err, qa.ErrEmptyBody):
		writeErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, qa.ErrNotLive):
		writeErr(w, http.StatusConflict, err.Error())
	default:
		writeErr(w, http.StatusInternalServerError, err.Error())
	}
}

func questionJSON(q store.DemoQuestion) map[string]any {
	return map[string]any{
		"id": q.ID, "eventId": q.EventID, "askerId": q.AskerID, "body": q.Body,
		"state": q.State, "votes": q.Votes, "createdAt": q.CreatedAt,
	}
}

func handleAskQuestion(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Body string `json:"body"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		q, err := d.QA.Ask(r.Context(), chi.URLParam(r, "id"), currentUser(r), body.Body)
		if err != nil {
			qaErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, questionJSON(q))
	}
}

func handleListQuestions(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		views, err := d.QA.List(r.Context(), chi.URLParam(r, "id"), currentUser(r))
		if err != nil {
			qaErr(w, err)
			return
		}
		out := make([]map[string]any, 0, len(views))
		for _, v := range views {
			m := questionJSON(v.DemoQuestion)
			m["mine"] = v.Mine
			out = append(out, m)
		}
		writeJSON(w, http.StatusOK, map[string]any{"questions": out})
	}
}

func handleUpvoteQuestion(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		votes, mine, err := d.QA.Upvote(r.Context(), chi.URLParam(r, "id"), chi.URLParam(r, "qid"), currentUser(r))
		if err != nil {
			qaErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"questionId": chi.URLParam(r, "qid"), "votes": votes, "mine": mine})
	}
}

func handleResolveQuestion(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			State string `json:"state"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		q, err := d.QA.Resolve(r.Context(), chi.URLParam(r, "id"), chi.URLParam(r, "qid"), currentUser(r), body.State)
		if err != nil {
			qaErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, questionJSON(q))
	}
}
```

- [ ] **Step 4: Add `QA` to `Deps` + mount routes** (`backend/internal/transport/httpapi/router.go`)

Add the import `"github.com/techit360ai-bit/new-frontend/backend/internal/qa"`. In `Deps` (after `Demo *demo.Service`) add:
```go
	QA *qa.Service
```
After `r.Post("/demos/{id}/rtc-token", handleDemoRtcToken(d))` add:
```go
			r.Post("/demos/{id}/questions", handleAskQuestion(d))
			r.Get("/demos/{id}/questions", handleListQuestions(d))
			r.Post("/demos/{id}/questions/{qid}/upvote", handleUpvoteQuestion(d))
			r.Post("/demos/{id}/questions/{qid}/resolve", handleResolveQuestion(d))
```

- [ ] **Step 5: Wire into `main`** (`backend/cmd/server/main.go`)

Add import `"github.com/techit360ai-bit/new-frontend/backend/internal/qa"`. After `demoSvc := demo.New(pg.Demo)` add:
```go
	qaSvc := qa.New(pg.QA, demoSvc, h)
```
In the `httpapi.NewRouter(httpapi.Deps{...})` literal, add `QA: qaSvc,` to the `Demo: demoSvc,` line:
```go
		Feed: feedSvc, Demo: demoSvc, QA: qaSvc, LiveKit: lkSvc, Presence: presSvc,
```

- [ ] **Step 6: Run the tests + vet to verify they pass**

```bash
cd backend
gobc test ./internal/transport/httpapi/
gobc vet ./internal/transport/httpapi/
gobc build ./...
```
Expected: PASS; vet clean; build clean.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/transport/httpapi/demo_qa.go backend/internal/transport/httpapi/router.go backend/internal/transport/httpapi/httpapi_test.go backend/cmd/server/main.go
git commit -m "feat(ws2): demo Q&A HTTP endpoints + main wiring (D2)"
```

---

## Task 6 — postgres integration test (vote PK dedup + cascade)

**Branch:** `feat/messaging-backend`.
**Files:**
- Modify: `backend/internal/store/postgres/postgres_test.go`

- [ ] **Step 1: Append the integration test** (`backend/internal/store/postgres/postgres_test.go`)

```go
func TestPostgresQARoundTrip(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	now := time.Now().UTC()
	// unique ids per run (shared DB persists rows across runs)
	suffix := now.Format("150405.000000")
	ev := store.DemoEvent{ID: "qa-ev-" + suffix, HostID: "h-" + suffix, Kind: "startup", Title: "T", Status: "live", CreatedAt: now, UpdatedAt: now}
	if err := st.Demo.CreateEvent(ctx, ev); err != nil {
		t.Fatalf("create event: %v", err)
	}
	q := store.DemoQuestion{ID: "qa-q-" + suffix, EventID: ev.ID, AskerID: "u-" + suffix, Body: "why?", State: "open", CreatedAt: now, UpdatedAt: now}
	if err := st.QA.CreateQuestion(ctx, q); err != nil {
		t.Fatalf("create question: %v", err)
	}

	// vote dedup via PK
	if ins, _ := st.QA.AddVote(ctx, q.ID, "voter-"+suffix); !ins {
		t.Fatal("first AddVote should insert")
	}
	if ins, _ := st.QA.AddVote(ctx, q.ID, "voter-"+suffix); ins {
		t.Fatal("duplicate AddVote should be a no-op (PK conflict)")
	}
	if n, _ := st.QA.CountVotes(ctx, q.ID); n != 1 {
		t.Fatalf("count=%d want 1", n)
	}

	// list view reflects votes + mine
	views, err := st.QA.ListQuestions(ctx, ev.ID, "voter-"+suffix)
	if err != nil || len(views) != 1 || views[0].Votes != 1 || !views[0].Mine {
		t.Fatalf("list: err=%v %+v", err, views)
	}

	// remove + state transition
	if del, _ := st.QA.RemoveVote(ctx, q.ID, "voter-"+suffix); !del {
		t.Fatal("RemoveVote should delete")
	}
	if err := st.QA.SetQuestionState(ctx, q.ID, "dismissed"); err != nil {
		t.Fatalf("set state: %v", err)
	}
	got, _ := st.QA.GetQuestion(ctx, q.ID)
	if got.State != "dismissed" {
		t.Fatalf("state=%s", got.State)
	}
}
```

- [ ] **Step 2: Run the integration test** (needs Dockerized pg16 on host port 55432)

```bash
cd backend
# start a throwaway pg16 if not already running on 55432:
docker run -d --rm --name qa-itest-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine >/dev/null 2>&1 || true
# wait for readiness:
for i in $(seq 1 30); do docker exec qa-itest-pg pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
gobc() { docker run --rm --network host -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
gobc test -tags integration ./internal/store/postgres/ -run 'TestPostgresQARoundTrip|TestPostgresDemoLifecycle'
```
Expected: PASS. (`--network host` lets the go container reach pg on `localhost:55432`. Leave the container up for Task 7's full integration run, or `docker rm -f qa-itest-pg` when done.)

- [ ] **Step 3: Commit**

```bash
git add backend/internal/store/postgres/postgres_test.go
git commit -m "test(ws2): QA postgres integration — vote PK dedup + state (D2)"
```

---

## Task 7 — Backend full gates

**Branch:** `feat/messaging-backend`.

- [ ] **Step 1: Unit suite + vet + build**

```bash
cd backend
gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
gobc build ./... && gobc test ./... && gobc vet ./...
```
Expected: build OK; all packages pass (incl. `internal/qa`, `internal/store`, `internal/transport/httpapi`); vet clean.

- [ ] **Step 2: Integration (pg16 + redis)**

```bash
cd backend
# pg from Task 6 still on 55432; ensure redis7 too:
docker run -d --rm --name qa-itest-redis -p 6399:6379 redis:7-alpine >/dev/null 2>&1 || true
gobc() { docker run --rm --network host -e GOFLAGS=-mod=mod -e GOSUMDB=off -e TEST_DATABASE_URL='postgres://postgres:postgres@localhost:55432/postgres?sslmode=disable' -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
gobc test -tags integration ./internal/store/postgres/
```
Expected: PASS (all demo + QA + messaging integration tests). Then clean up: `docker rm -f qa-itest-pg qa-itest-redis`.

- [ ] **Step 3: End-to-end smoke regression** (compose; confirms existing DM/demo paths unaffected)

```bash
cd backend
bash scripts/smoke.sh
```
Expected: `SMOKE OK`. (D2 adds no hot-path change; this is a regression guard. If port 55432 is busy, `docker rm -f qa-itest-pg` first.)

- [ ] **Step 4: No commit** (verification only). If any gate fails, fix on the relevant task and re-run.

---

## Task 8 — Frontend: `lib/demo/qa.ts` client

**Branch:** `feat/messaging-phase1`.
**Files:**
- Create: `frontend/src/lib/demo/qa.ts`
- Test: `frontend/src/lib/demo/qa.test.ts`

- [ ] **Step 1: Switch to the frontend branch and bring it up to date**

```bash
cd /home/faithsax/new-frontend
git checkout feat/messaging-phase1
git fetch origin
git merge --ff-only origin/main   # feat/messaging-phase1's commits are all in main; this fast-forwards cleanly
```
(If `--ff-only` refuses because the branch has diverged, inspect with `git log --oneline origin/main..HEAD`; there should be nothing — the D1 frontend was merged. Reset with `git reset --hard origin/main` only after confirming no unmerged local frontend work.)

- [ ] **Step 2: Bring the spec + plan onto this branch**

```bash
git checkout feat/messaging-backend -- docs/superpowers/specs/2026-06-14-ws2-slice-d2-audience-qa-design.md docs/superpowers/plans/2026-06-14-ws2-slice-d2-audience-qa-plan.md
git add docs/superpowers/specs/2026-06-14-ws2-slice-d2-audience-qa-design.md docs/superpowers/plans/2026-06-14-ws2-slice-d2-audience-qa-plan.md
git commit -m "docs(ws2): slice D2 design + plan — audience Q&A"
```

- [ ] **Step 3: Write the failing test** (`frontend/src/lib/demo/qa.test.ts`)

```ts
import { test, expect } from "vitest";
import { listQuestions, askQuestion } from "./qa";

test("listQuestions returns rows on success", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ questions: [{ id: "q1", eventId: "e1", askerId: "u1", body: "why?", state: "open", votes: 2, mine: true, createdAt: "t" }] }),
  })) as unknown as typeof fetch;
  try {
    const qs = await listQuestions("e1");
    expect(qs).toHaveLength(1);
    expect(qs[0].votes).toBe(2);
    expect(qs[0].mine).toBe(true);
  } finally {
    globalThis.fetch = orig;
  }
});

test("listQuestions returns [] on failure (offline-safe)", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("net"); }) as unknown as typeof fetch;
  try {
    expect(await listQuestions("e1")).toEqual([]);
  } finally {
    globalThis.fetch = orig;
  }
});

test("askQuestion returns null on failure (offline-safe)", async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("net"); }) as unknown as typeof fetch;
  try {
    expect(await askQuestion("e1", "hi")).toBeNull();
  } finally {
    globalThis.fetch = orig;
  }
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
cd frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src/lib/demo
```
Expected: FAIL — cannot resolve `./qa`.

- [ ] **Step 5: Write the implementation** (`frontend/src/lib/demo/qa.ts`)

```ts
// Demo Q&A client — talks to the Go messaging service /api/v1/demos/{id}/questions.
// All calls are offline-safe via withFallback so the panel renders without a backend.
import { msgGet, msgPost, withFallback } from "@/lib/messaging/client";

export type QuestionState = "open" | "answered" | "dismissed";

export interface Question {
  id: string;
  eventId: string;
  askerId: string;
  body: string;
  state: QuestionState | string;
  votes: number;
  mine: boolean;
  createdAt: string;
}

export function listQuestions(eventId: string): Promise<Question[]> {
  return withFallback(
    async () => (await msgGet<{ questions: Question[] }>(`/demos/${encodeURIComponent(eventId)}/questions`)).questions ?? [],
    () => [],
    "list questions",
  );
}

export function askQuestion(eventId: string, body: string): Promise<Question | null> {
  return withFallback(
    () => msgPost<Question>(`/demos/${encodeURIComponent(eventId)}/questions`, { body }),
    () => null,
    "ask question",
  );
}

export interface VoteResult { questionId: string; votes: number; mine: boolean }

export function upvoteQuestion(eventId: string, qid: string): Promise<VoteResult | null> {
  return withFallback(
    () => msgPost<VoteResult>(`/demos/${encodeURIComponent(eventId)}/questions/${encodeURIComponent(qid)}/upvote`),
    () => null,
    "upvote question",
  );
}

export function resolveQuestion(eventId: string, qid: string, state: QuestionState): Promise<Question | null> {
  return withFallback(
    () => msgPost<Question>(`/demos/${encodeURIComponent(eventId)}/questions/${encodeURIComponent(qid)}/resolve`, { state }),
    () => null,
    "resolve question",
  );
}
```

- [ ] **Step 6: Run the test + tsc to verify they pass**

```bash
cd frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src/lib/demo
npx tsc -b --noEmit 2>&1 | grep -E "lib/demo/qa" || echo ok
```
Expected: tests pass; no tsc errors for `lib/demo/qa`.

- [ ] **Step 7: Commit**

```bash
cd /home/faithsax/new-frontend
git add frontend/src/lib/demo/qa.ts frontend/src/lib/demo/qa.test.ts
git commit -m "feat(ws2): frontend demo Q&A client (offline-safe) (D2)"
```

---

## Task 9 — Frontend: fold `qa.*` into `wsReducer`

**Branch:** `feat/messaging-phase1`.
**Files:**
- Modify: `frontend/src/lib/messaging/wsReducer.ts`
- Test: `frontend/src/lib/messaging/wsReducer.test.ts`

- [ ] **Step 1: Write the failing test** (append to `frontend/src/lib/messaging/wsReducer.test.ts`)

```ts
test("qa.new appends a question (arrival order, deduped by id)", () => {
  let s = emptyStore();
  s = applyEnvelope(s, { type: "qa.new", id: "1", ts: "t", data: { eventId: "e1", question: { id: "q1", askerId: "u1", body: "first", state: "open", votes: 0, createdAt: "t1" } } }, "me");
  s = applyEnvelope(s, { type: "qa.new", id: "2", ts: "t", data: { eventId: "e1", question: { id: "q2", askerId: "u2", body: "second", state: "open", votes: 0, createdAt: "t2" } } }, "me");
  // duplicate q1 must not double
  s = applyEnvelope(s, { type: "qa.new", id: "3", ts: "t", data: { eventId: "e1", question: { id: "q1", askerId: "u1", body: "first", state: "open", votes: 0, createdAt: "t1" } } }, "me");
  expect(s.questions["e1"]).toHaveLength(2);
  expect(s.questions["e1"][0].body).toBe("first");
  expect(s.questions["e1"][1].body).toBe("second");
});

test("qa.voted updates a question's vote count", () => {
  let s = emptyStore();
  s = applyEnvelope(s, { type: "qa.new", id: "1", ts: "t", data: { eventId: "e1", question: { id: "q1", askerId: "u1", body: "x", state: "open", votes: 0, createdAt: "t1" } } }, "me");
  s = applyEnvelope(s, { type: "qa.voted", id: "2", ts: "t", data: { eventId: "e1", questionId: "q1", votes: 5 } }, "me");
  expect(s.questions["e1"][0].votes).toBe(5);
});

test("qa.resolved updates a question's state", () => {
  let s = emptyStore();
  s = applyEnvelope(s, { type: "qa.new", id: "1", ts: "t", data: { eventId: "e1", question: { id: "q1", askerId: "u1", body: "x", state: "open", votes: 0, createdAt: "t1" } } }, "me");
  s = applyEnvelope(s, { type: "qa.resolved", id: "2", ts: "t", data: { eventId: "e1", questionId: "q1", state: "answered" } }, "me");
  expect(s.questions["e1"][0].state).toBe("answered");
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src/lib/messaging
```
Expected: FAIL — `s.questions` is undefined.

- [ ] **Step 3: Extend the store + reducer** (`frontend/src/lib/messaging/wsReducer.ts`)

Add a `LiveQuestion` interface (near `FeedPost`):
```ts
export interface LiveQuestion {
  id: string;
  askerId: string;
  body: string;
  state: string;
  votes: number;
  createdAt: string;
}
```
Add `questions` to `MsgStore`:
```ts
  questions: Record<string, LiveQuestion[]>; // eventId -> questions (arrival order)
```
Add it to `emptyStore()`:
```ts
  return { threads: {}, channelThreads: {}, online: {}, feed: [], tribe: [], questions: {} };
```
Add three cases to `applyEnvelope` (before `default:`):
```ts
    case "qa.new": {
      const eventId = String(d.eventId ?? "");
      const wq = (d.question ?? {}) as { id: string; askerId: string; body: string; state: string; votes?: number; createdAt: string };
      const prev = s.questions[eventId] ?? [];
      if (prev.some((q) => q.id === wq.id)) return s; // dedup
      const lq: LiveQuestion = { id: wq.id, askerId: wq.askerId, body: wq.body, state: wq.state, votes: wq.votes ?? 0, createdAt: wq.createdAt };
      return { ...s, questions: { ...s.questions, [eventId]: [...prev, lq] } };
    }
    case "qa.voted": {
      const eventId = String(d.eventId ?? "");
      const questionId = String(d.questionId ?? "");
      const votes = Number(d.votes ?? 0);
      const prev = s.questions[eventId] ?? [];
      return { ...s, questions: { ...s.questions, [eventId]: prev.map((q) => (q.id === questionId ? { ...q, votes } : q)) } };
    }
    case "qa.resolved": {
      const eventId = String(d.eventId ?? "");
      const questionId = String(d.questionId ?? "");
      const state = String(d.state ?? "");
      const prev = s.questions[eventId] ?? [];
      return { ...s, questions: { ...s.questions, [eventId]: prev.map((q) => (q.id === questionId ? { ...q, state } : q)) } };
    }
```

- [ ] **Step 4: Run the test + tsc to verify they pass**

```bash
cd frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src/lib/messaging
npx tsc -b --noEmit 2>&1 | grep -E "wsReducer" || echo ok
```
Expected: tests pass; no tsc errors for `wsReducer`.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend
git add frontend/src/lib/messaging/wsReducer.ts frontend/src/lib/messaging/wsReducer.test.ts
git commit -m "feat(ws2): fold qa.* live events into wsReducer (D2)"
```

---

## Task 10 — Frontend: Q&A panel in `DemoRoom`

**Branch:** `feat/messaging-phase1`.
**Files:**
- Modify: `frontend/src/dashboard/demos/DemoRoom.tsx`

`DemoRoom` already imports `useMessaging`? It does not yet — add it. The panel seeds from `listQuestions` (local state) and merges live deltas from `store.questions[id]` (deduped by id, live wins), so both initial history and real-time updates show. Writes call the REST client; the server's `qa.*` echo reconciles via the store.

- [ ] **Step 1: Add imports + Q&A state/effect** (`frontend/src/dashboard/demos/DemoRoom.tsx`)

Add to the imports at the top:
```tsx
import { useMessaging } from "@/contexts/MessagingProvider";
import { listQuestions, askQuestion, upvoteQuestion, resolveQuestion, type Question } from "@/lib/demo/qa";
```
Inside the component, after the existing `const [session, setSession] = useState<RtcSession | null>(null);` line, add:
```tsx
  const { store } = useMessaging();
  const [seed, setSeed] = useState<Question[]>([]);
  const [qBody, setQBody] = useState("");

  // seed the question list once the event is visible
  useEffect(() => {
    if (!event) return;
    let alive = true;
    listQuestions(id).then((qs) => { if (alive) setSeed(qs); });
    return () => { alive = false; };
  }, [event?.id, id]);

  // merge REST seed with live wsReducer deltas (live wins on id collision)
  const live = store.questions[id] ?? [];
  const byId = new Map<string, Question>();
  for (const q of seed) byId.set(q.id, q);
  for (const lq of live) {
    const existing = byId.get(lq.id);
    byId.set(lq.id, {
      id: lq.id, eventId: id, askerId: lq.askerId, body: lq.body,
      state: lq.state, votes: lq.votes, mine: existing?.mine ?? false, createdAt: lq.createdAt,
    });
  }
  const questions = Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
```

- [ ] **Step 2: Add the panel + handlers** (`frontend/src/dashboard/demos/DemoRoom.tsx`)

Add these handlers next to the existing `act` helper (inside the component):
```tsx
  const submitQuestion = async () => {
    const body = qBody.trim();
    if (!body) return;
    const created = await askQuestion(id, body);
    if (created) setSeed((prev) => [...prev, created]);
    setQBody("");
  };
  const toggleVote = async (qid: string) => {
    const res = await upvoteQuestion(id, qid);
    if (res) setSeed((prev) => prev.map((q) => (q.id === qid ? { ...q, votes: res.votes, mine: res.mine } : q)));
  };
  const setState = async (qid: string, state: "answered" | "dismissed") => {
    const updated = await resolveQuestion(id, qid, state);
    if (updated) setSeed((prev) => prev.map((q) => (q.id === qid ? { ...q, state: updated.state } : q)));
  };
  const canModerate = isHost || (mine?.roomRole === "presenter");
```
Insert the panel JSX immediately after the live-stage block (the `{event.status === "live" && ( ... )}` block) and before the `{/* Host controls */}` block:
```tsx
      {/* Audience Q&A */}
      <div className="border border-slate-200 bg-white rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Audience Q&amp;A</h2>
        {event.status === "live" ? (
          <div className="flex items-end gap-2 mb-4">
            <input value={qBody} onChange={(e) => setQBody(e.target.value)} placeholder="Ask a question…"
              onKeyDown={(e) => { if (e.key === "Enter") void submitQuestion(); }}
              className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            <button type="button" disabled={!qBody.trim()} onClick={() => void submitQuestion()}
              className="text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:bg-slate-300 px-3 py-1.5 rounded-lg">
              Ask
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 mb-3">Questions open when the demo goes live.</p>
        )}
        {questions.length === 0 ? (
          <p className="text-xs text-slate-400">No questions yet.</p>
        ) : (
          <ul className="space-y-2">
            {questions.map((q) => (
              <li key={q.id} className={`flex items-start gap-3 text-sm rounded-lg border px-3 py-2 ${q.state === "dismissed" ? "opacity-50 line-through border-slate-100" : q.state === "answered" ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
                <button type="button" disabled={event.status !== "live"} onClick={() => void toggleVote(q.id)}
                  className={`flex flex-col items-center px-2 py-0.5 rounded ${q.mine ? "text-violet-600" : "text-slate-400"} disabled:opacity-40`}>
                  <span className="text-xs">▲</span>
                  <span className="text-xs font-semibold">{q.votes}</span>
                </button>
                <span className="flex-1 text-slate-700">{q.body}</span>
                {canModerate && q.state === "open" && event.status === "live" && (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => void setState(q.id, "answered")}
                      className="text-[10px] font-medium text-emerald-700 hover:underline">Answered</button>
                    <button type="button" onClick={() => void setState(q.id, "dismissed")}
                      className="text-[10px] font-medium text-slate-400 hover:underline">Dismiss</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend
npx tsc -b --noEmit 2>&1 | grep -E "dashboard/demos/DemoRoom" || echo ok
```
Expected: `ok` (no errors in `DemoRoom`). If `useMessaging` is not exported from `@/contexts/MessagingProvider`, confirm the export name (the provider file exports `useMessaging` per its definition) and adjust the import.

- [ ] **Step 4: Run the full local test gate**

```bash
cd frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src
```
Expected: all tests pass (prior 20 + 3 qa.ts + 3 wsReducer qa = 26).

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend
git add frontend/src/dashboard/demos/DemoRoom.tsx
git commit -m "feat(ws2): audience Q&A panel in DemoRoom (D2)"
```

---

## Task 11 — Frontend gates + final verification

**Branch:** `feat/messaging-phase1`.

- [ ] **Step 1: Frontend full gates**

```bash
cd /home/faithsax/new-frontend/frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src
npx tsc -b --noEmit 2>&1 | grep -E "lib/demo|dashboard/demos|lib/messaging" | grep -v "calendar\|resizable" || echo ok
```
Expected: tests pass; no new tsc errors in demo/messaging files.

- [ ] **Step 2: Confirm docs on both branches**

```bash
cd /home/faithsax/new-frontend
git log --oneline feat/messaging-backend | grep -i "ws2.*d2" | head
git log --oneline feat/messaging-phase1 | grep -i "ws2.*d2" | head
```
Expected: the D2 design + plan doc commits appear on both branches (backend committed them in Tasks; frontend Task 8 Step 2 brought them over).

- [ ] **Step 3: Stop. Report status; do NOT push.**

Push + PRs are user-directed. Summarize: backend gates green (unit + integration + smoke), frontend gates green, Q&A live-push verified at the reducer level; real cross-client delivery is exercised only against a running server. Await the user's instruction to push.

---

## Self-Review

- **Spec coverage:**
  - Data model (`demo_questions` + `demo_question_votes`, derived votes, `QuestionView`) → Task 1 (+ migration), Task 2 (pg).
  - `qa.Service` Ask/Upvote(toggle)/Resolve(host+presenter, answered|dismissed)/List(arrival order) + live-gating + fan-out → Task 4.
  - `qa.*` protocol (server→client only) → Task 3.
  - REST endpoints + status mapping (404/403/400/409) + Deps + main wiring → Task 5.
  - Postgres integration (vote PK dedup, cascade) → Task 6; full gates + smoke → Task 7.
  - FE `qa.ts` offline-safe → Task 8; `wsReducer` qa.* fold (append/dedup/vote/resolve) → Task 9; `DemoRoom` panel (submit live-only, arrival order + vote counts, host/presenter resolve) → Task 10; FE gates → Task 11.
  - Attribution (askerId stored/shown), submission live-only, list viewable anytime, toggle upvote → Tasks 4 + 10.
- **Placeholder scan:** The single intentional compile-forcing placeholder is `s.demos.store_ListRoster` in Task 4 Step 3, explicitly resolved in Task 4 Step 4 (add `demo.Service.Roster`, switch the call). No `TODO`/`TBD`/"handle errors" left.
- **Type consistency:** `QAStore` method set is identical across iface (T1), fake (T1), pg (T2), and `var _ store.QAStore` assertions. `QuestionView{DemoQuestion; Mine}` used identically in store, service `List`, and httpapi `handleListQuestions`. `qa.Service` signatures (`Ask`/`Upvote`→`(int,bool,error)`/`Resolve`/`List`) match their httpapi callers (T5) and tests (T4). Protocol constants `TypeQANew/Voted/Resolved` (T3) match the strings emitted by `broadcast` (T4) and consumed by `wsReducer` cases (T9). FE `Question` shape (T8) matches the JSON `questionJSON`+`mine` emits (T5) and the reducer's `LiveQuestion` projection (T9/T10).
- **Scope:** one service, one store, one migration, 4 endpoints, 3 FE files — single implementation plan, no decomposition needed.
