# WS1 Messaging Phase 1 — Plan 3: Channels + Feed (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the messaging backend with group **Hangout channels** (membership, history, fan-out send, read cursors), the social **Feed** (posts, likes, comments with live broadcast), and **typing indicators** (DM + channel) — reusing the Plan-1/2 patterns (stores behind interfaces, persist-before-ack, hub fan-out).

**Architecture:** New `ChannelService` (channel send = validate membership → persist one message → fan-out `message.new` to members via the hub) and `FeedService` (create/like/comment → broadcast `post.*` to connected users). Two new store interfaces (`ChannelStore`, `PostStore`) with in-memory fakes + Postgres impls over the already-migrated tables. The WS gateway dispatches channel sends (when `channelId` is set) and relays typing; the HTTP API gains `/channels/*` and `/posts/*`. No schema change — tables exist from migration `0001`.

**Tech Stack:** Go 1.23 (containerized), pgx/v5, chi/v5, coder/websocket — all already in `go.mod`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-08-ws1-messaging-phase1-design.md`
**Builds on:** Plans 1 & 2 (committed on `feat/messaging-phase1`, head `3105d8b`). Module path: `github.com/techit360ai-bit/new-frontend/backend`.

**This is Plan 3 of 4** for Phase 1 (Plan 2's "channels+feed+FE" split in two): Plan 3 = channels + feed + typing **backend**; **Plan 4 = frontend wiring** (`lib/ws/client.ts`, `MessagingProvider`, swap the mock screens).

---

## Critical execution notes (READ FIRST)

- **Go runs in Docker** (not on host). Define on the SAME shell line as each command:
  ```bash
  cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./...
  ```
- **cwd/env do not persist between tool calls.** For git commits use `git -C /home/faithsax/new-frontend ...` to avoid the `backend/backend` path trap.
- **Branch:** `feat/messaging-phase1` (continues from Plan 2). Verify before each commit. Do NOT push (Plan 4 follows).
- **Integration tests** (`//go:build integration`) need Dockerized `postgres:16-alpine` (host port 55432) + `redis:7-alpine` (56379) with the go container on `--network host`. Pattern (from Plan 2 Task 12):
  ```bash
  docker rm -f pg_it redis_it >/dev/null 2>&1 || true
  docker run -d --name pg_it -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine
  docker run -d --name redis_it -p 56379:6379 redis:7-alpine ; sleep 8
  docker run --rm --network host -e GOFLAGS=-mod=mod -e GOSUMDB=off \
    -e TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres?sslmode=disable" \
    -e TEST_REDIS_URL="redis://localhost:56379" \
    -v "$PWD":/app -w /app golang:1.23-alpine go test -tags=integration ./...
  docker rm -f pg_it redis_it
  ```
- **Patterns to mirror (already verified in the repo):** `internal/store/store.go` interfaces; `internal/store/fakes.go` fakes; `internal/store/postgres/{conversations,messages}.go`; `internal/messaging/service.go` (persist-before-ack + `mustEnvelope`); `internal/transport/httpapi/conversations.go`. New code should look like its DM sibling.

---

## File Structure (this plan)

```
backend/internal/
├─ protocol/envelope.go         # MODIFY: add post.* server types + PostPayload structs
├─ store/
│  ├─ store.go                  # MODIFY: add Channel, Post, Comment models + ChannelStore + PostStore interfaces
│  ├─ fakes.go                  # MODIFY: add FakeChannelStore, FakePostStore; wire into FakeStores
│  ├─ fakes_test.go             # MODIFY: add a couple of fake sanity tests
│  └─ postgres/
│     ├─ channels.go            # CREATE: ChannelStore impl
│     ├─ posts.go               # CREATE: PostStore impl
│     ├─ postgres.go            # MODIFY: add Channels, Posts to Store; interface asserts
│     └─ postgres_test.go       # MODIFY: add channel + post integration tests
├─ channel/service.go           # CREATE: ChannelService (SendChannel + RelayTyping)
├─ channel/service_test.go      # CREATE
├─ feed/service.go              # CREATE: FeedService (CreatePost/Like/Unlike/AddComment + list)
├─ feed/service_test.go         # CREATE
└─ transport/
   ├─ ws/gateway.go             # MODIFY: dispatch channel send + typing relay; add Channel to Deps
   ├─ ws/gateway_test.go        # MODIFY: add a channel-delivery test
   └─ httpapi/
      ├─ router.go              # MODIFY: add Channels/Posts to Deps; mount routes
      ├─ channels.go            # CREATE: list/history/send/read handlers
      ├─ posts.go               # CREATE: list/create/like/comment handlers
      └─ httpapi_test.go        # MODIFY: add channel + post endpoint tests
cmd/server/main.go              # MODIFY: construct ChannelService + FeedService; wire into gateway + api
```

---

## Task 1: Protocol — post.* types + payload structs

**Files:** Modify `backend/internal/protocol/envelope.go`

- [ ] **Step 1: Write the failing test**

Append to `backend/internal/protocol/envelope_test.go`:

```go
func TestPostPayloadDecode(t *testing.T) {
	data := json.RawMessage(`{"kind":"update","body":"shipped v1"}`)
	var p CreatePostPayload
	if err := json.Unmarshal(data, &p); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if p.Kind != "update" || p.Body != "shipped v1" {
		t.Errorf("bad payload: %+v", p)
	}
}

func TestPostServerTypesExist(t *testing.T) {
	if TypePostNew == "" || TypePostLiked == "" || TypePostComment == "" {
		t.Fatal("post server type constants must be non-empty")
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/protocol/`
Expected: FAIL — undefined `CreatePostPayload`, `TypePostNew`, etc.

- [ ] **Step 3: Add the constants + structs**

In `backend/internal/protocol/envelope.go`, add to the "Server -> client message types" const block:

```go
	TypePostNew     = "post.new"
	TypePostLiked   = "post.liked"
	TypePostComment = "post.comment"
```

And add these payload structs after `ReadUptoPayload`:

```go
// CreatePostPayload is the body of a create-post request (REST).
type CreatePostPayload struct {
	Kind string `json:"kind"`
	Body string `json:"body"`
}

// CommentPayload is the body of an add-comment request (REST).
type CommentPayload struct {
	Body string `json:"body"`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/protocol/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/protocol && git -C /home/faithsax/new-frontend commit -m "feat(ws1): protocol post.* types + post payloads"
```

---

## Task 2: Domain models + ChannelStore + PostStore interfaces

**Files:** Modify `backend/internal/store/store.go`

- [ ] **Step 1: Write the failing test**

Append to `backend/internal/store/store_test.go`:

```go
func TestChannelAndPostZeroValues(t *testing.T) {
	var c Channel
	var p Post
	var cm Comment
	if c.ID != "" || p.ID != "" || cm.ID != "" {
		t.Fatal("unexpected non-zero defaults")
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/store/`
Expected: FAIL — undefined `Channel`, `Post`, `Comment`.

- [ ] **Step 3: Add models + interfaces**

In `backend/internal/store/store.go`, add after the `Conversation` struct:

```go
// Channel is a group/Hangout channel.
type Channel struct {
	ID        string
	Name      string
	Kind      string // hangout|workspace
	CreatedAt time.Time
}

// Post is a social-feed post.
type Post struct {
	ID        string
	AuthorID  string
	Kind      string
	Body      string
	CreatedAt time.Time
}

// Comment is a comment on a Post.
type Comment struct {
	ID        string
	PostID    string
	AuthorID  string
	Body      string
	CreatedAt time.Time
}
```

And add these interfaces after `MessageStore`:

```go
// ChannelStore manages group channels, membership, and read cursors.
type ChannelStore interface {
	// ListForUser returns channels the user is a member of.
	ListForUser(ctx context.Context, userID string) ([]Channel, error)
	// Members returns the user IDs in a channel.
	Members(ctx context.Context, channelID string) ([]string, error)
	// IsMember reports whether userID belongs to channelID.
	IsMember(ctx context.Context, channelID, userID string) (bool, error)
	// MessagesByChannel returns up to limit messages with id < before
	// (before == "" means latest), ordered by id DESC.
	MessagesByChannel(ctx context.Context, channelID, before string, limit int) ([]Message, error)
	// InsertChannelMessage stores a channel message (carrying clientMsgID for dedup).
	InsertChannelMessage(ctx context.Context, m Message, clientMsgID string) error
	// ExistsByClientMsgID reports an existing channel message id for dedup.
	ExistsByClientMsgID(ctx context.Context, channelID, senderID, clientMsgID string) (string, bool, error)
	// SetReadCursor advances last_read_msg_id for a member.
	SetReadCursor(ctx context.Context, channelID, userID, msgID string) error
}

// PostStore manages feed posts, likes, and comments.
type PostStore interface {
	CreatePost(ctx context.Context, p Post) error
	ListPosts(ctx context.Context, before string, limit int) ([]Post, error)
	Like(ctx context.Context, postID, userID string) error
	Unlike(ctx context.Context, postID, userID string) error
	LikeCount(ctx context.Context, postID string) (int, error)
	AddComment(ctx context.Context, c Comment) error
	ListComments(ctx context.Context, postID string) ([]Comment, error)
	PostExists(ctx context.Context, postID string) (bool, error)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/store/`
Expected: PASS (the new struct test; interfaces have no impls yet but compile).

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store/store.go backend/internal/store/store_test.go && git -C /home/faithsax/new-frontend commit -m "feat(ws1): channel + post domain models and store interfaces"
```

---

## Task 3: In-memory fakes for ChannelStore + PostStore

**Files:** Modify `backend/internal/store/fakes.go`, `backend/internal/store/fakes_test.go`

- [ ] **Step 1: Write the failing test**

Append to `backend/internal/store/fakes_test.go`:

```go
func TestFakeChannelSendAndQuery(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	f.Channels.AddMember("ch1", "u1")
	f.Channels.AddMember("ch1", "u2")
	m := Message{ID: "01890000-0000-7000-8000-000000000010", ChannelID: "ch1", SenderID: "u1", Type: "text", Body: "hey team"}
	if err := f.Channels.InsertChannelMessage(ctx, m, "c1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, _ := f.Channels.MessagesByChannel(ctx, "ch1", "", 10)
	if len(got) != 1 || got[0].Body != "hey team" {
		t.Fatalf("query: %v", got)
	}
	members, _ := f.Channels.Members(ctx, "ch1")
	if len(members) != 2 {
		t.Fatalf("members: %v", members)
	}
}

func TestFakePostLifecycle(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	_ = f.Posts.CreatePost(ctx, Post{ID: "p1", AuthorID: "u1", Kind: "update", Body: "hi"})
	_ = f.Posts.Like(ctx, "p1", "u2")
	_ = f.Posts.Like(ctx, "p1", "u2") // idempotent
	n, _ := f.Posts.LikeCount(ctx, "p1")
	if n != 1 {
		t.Fatalf("like count = %d, want 1", n)
	}
	_ = f.Posts.AddComment(ctx, Comment{ID: "cm1", PostID: "p1", AuthorID: "u3", Body: "nice"})
	cs, _ := f.Posts.ListComments(ctx, "p1")
	if len(cs) != 1 {
		t.Fatalf("comments: %v", cs)
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/store/`
Expected: FAIL — `f.Channels`/`f.Posts` undefined.

- [ ] **Step 3: Implement the fakes**

In `backend/internal/store/fakes.go`, extend `FakeStores` and `NewFakeStores`:

```go
// (modify the FakeStores struct)
type FakeStores struct {
	Users         *FakeUserStore
	Conversations *FakeConversationStore
	Messages      *FakeMessageStore
	Channels      *FakeChannelStore
	Posts         *FakePostStore
}

// (modify NewFakeStores to add the two new stores)
func NewFakeStores() *FakeStores {
	return &FakeStores{
		Users:         &FakeUserStore{m: map[string]User{}},
		Conversations: &FakeConversationStore{convos: map[string][2]string{}, cursors: map[string]string{}},
		Messages:      &FakeMessageStore{byConv: map[string][]Message{}, receipts: map[string]ReceiptState{}, clientIDs: map[string]string{}},
		Channels:      &FakeChannelStore{members: map[string]map[string]struct{}{}, byChan: map[string][]Message{}, clientIDs: map[string]string{}, cursors: map[string]string{}},
		Posts:         &FakePostStore{posts: map[string]Post{}, order: nil, likes: map[string]map[string]struct{}{}, comments: map[string][]Comment{}},
	}
}
```

Then add the two fake types at the end of the file:

```go
// FakeChannelStore is an in-memory ChannelStore.
type FakeChannelStore struct {
	mu        sync.Mutex
	members   map[string]map[string]struct{} // channelID -> set of userIDs
	byChan    map[string][]Message
	clientIDs map[string]string // channelID|sender|clientMsgID -> msgID
	cursors   map[string]string // channelID|userID -> msgID
}

// AddMember is a test helper to seed membership.
func (s *FakeChannelStore) AddMember(channelID, userID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.members[channelID] == nil {
		s.members[channelID] = map[string]struct{}{}
	}
	s.members[channelID][userID] = struct{}{}
}

func (s *FakeChannelStore) ListForUser(_ context.Context, userID string) ([]Channel, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Channel
	for ch, set := range s.members {
		if _, ok := set[userID]; ok {
			out = append(out, Channel{ID: ch, Name: ch, Kind: "hangout"})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}
func (s *FakeChannelStore) Members(_ context.Context, channelID string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []string
	for u := range s.members[channelID] {
		out = append(out, u)
	}
	sort.Strings(out)
	return out, nil
}
func (s *FakeChannelStore) IsMember(_ context.Context, channelID, userID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.members[channelID][userID]
	return ok, nil
}
func (s *FakeChannelStore) MessagesByChannel(_ context.Context, channelID, before string, limit int) ([]Message, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	all := s.byChan[channelID]
	out := make([]Message, 0, len(all))
	for i := len(all) - 1; i >= 0; i-- {
		if before != "" && all[i].ID >= before {
			continue
		}
		out = append(out, all[i])
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}
func (s *FakeChannelStore) InsertChannelMessage(_ context.Context, m Message, clientMsgID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.byChan[m.ChannelID] = append(s.byChan[m.ChannelID], m)
	if clientMsgID != "" {
		s.clientIDs[m.ChannelID+"|"+m.SenderID+"|"+clientMsgID] = m.ID
	}
	return nil
}
func (s *FakeChannelStore) ExistsByClientMsgID(_ context.Context, channelID, senderID, clientMsgID string) (string, bool, error) {
	if clientMsgID == "" {
		return "", false, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if id, ok := s.clientIDs[channelID+"|"+senderID+"|"+clientMsgID]; ok {
		return id, true, nil
	}
	return "", false, nil
}
func (s *FakeChannelStore) SetReadCursor(_ context.Context, channelID, userID, msgID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cursors[channelID+"|"+userID] = msgID
	return nil
}

// FakePostStore is an in-memory PostStore.
type FakePostStore struct {
	mu       sync.Mutex
	posts    map[string]Post
	order    []string // post IDs in creation order
	likes    map[string]map[string]struct{}
	comments map[string][]Comment
}

func (s *FakePostStore) CreatePost(_ context.Context, p Post) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.posts[p.ID] = p
	s.order = append(s.order, p.ID)
	return nil
}
func (s *FakePostStore) ListPosts(_ context.Context, before string, limit int) ([]Post, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Post, 0, limit)
	for i := len(s.order) - 1; i >= 0; i-- {
		id := s.order[i]
		if before != "" && id >= before {
			continue
		}
		out = append(out, s.posts[id])
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}
func (s *FakePostStore) Like(_ context.Context, postID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.likes[postID] == nil {
		s.likes[postID] = map[string]struct{}{}
	}
	s.likes[postID][userID] = struct{}{}
	return nil
}
func (s *FakePostStore) Unlike(_ context.Context, postID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.likes[postID], userID)
	return nil
}
func (s *FakePostStore) LikeCount(_ context.Context, postID string) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.likes[postID]), nil
}
func (s *FakePostStore) AddComment(_ context.Context, c Comment) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.comments[c.PostID] = append(s.comments[c.PostID], c)
	return nil
}
func (s *FakePostStore) ListComments(_ context.Context, postID string) ([]Comment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Comment(nil), s.comments[postID]...), nil
}
func (s *FakePostStore) PostExists(_ context.Context, postID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.posts[postID]
	return ok, nil
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/store/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store && git -C /home/faithsax/new-frontend commit -m "feat(ws1): in-memory fakes for ChannelStore + PostStore"
```

---

## Task 4: ChannelService — send (fan-out) + typing relay

**Files:** Create `backend/internal/channel/service.go`, `backend/internal/channel/service_test.go`

- [ ] **Step 1: Write the failing test**

`backend/internal/channel/service_test.go`:

```go
package channel

import (
	"context"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newSvc() (*Service, *store.FakeStores, *store.FakeRouter) {
	st := store.NewFakeStores()
	rt := store.NewFakeRouter()
	return New(st.Channels, rt), st, rt
}

func TestSendChannelFansOutToOtherMembers(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	st.Channels.AddMember("ch1", "u1")
	st.Channels.AddMember("ch1", "u2")
	st.Channels.AddMember("ch1", "u3")

	ack, err := svc.SendChannel(ctx, "u1", protocol.SendPayload{
		ChannelID: "ch1", ClientMsgID: "c1", Type: "text", Body: "team update",
	})
	if err != nil {
		t.Fatalf("send: %v", err)
	}
	if ack.MsgID == "" {
		t.Fatal("empty ack msgId")
	}
	// persisted
	msgs, _ := st.Channels.MessagesByChannel(ctx, "ch1", "", 10)
	if len(msgs) != 1 || msgs[0].Body != "team update" {
		t.Fatalf("not persisted: %v", msgs)
	}
	// fan-out to u2 and u3 but NOT back to sender u1
	if len(rt.Sent["u2"]) == 0 || rt.Sent["u2"][0].Type != protocol.TypeMessageNew {
		t.Errorf("u2 not delivered: %v", rt.Sent["u2"])
	}
	if len(rt.Sent["u3"]) == 0 {
		t.Errorf("u3 not delivered")
	}
	if len(rt.Sent["u1"]) != 0 {
		t.Errorf("sender u1 should not be fanned out to: %v", rt.Sent["u1"])
	}
}

func TestSendChannelRejectsNonMember(t *testing.T) {
	svc, st, _ := newSvc()
	st.Channels.AddMember("ch1", "u1")
	if _, err := svc.SendChannel(context.Background(), "stranger", protocol.SendPayload{ChannelID: "ch1", Body: "hi"}); err == nil {
		t.Fatal("expected rejection for non-member")
	}
}

func TestSendChannelDedup(t *testing.T) {
	svc, st, _ := newSvc()
	st.Channels.AddMember("ch1", "u1")
	p := protocol.SendPayload{ChannelID: "ch1", ClientMsgID: "dup", Body: "once"}
	r1, _ := svc.SendChannel(context.Background(), "u1", p)
	r2, _ := svc.SendChannel(context.Background(), "u1", p)
	if r1.MsgID != r2.MsgID {
		t.Errorf("dedup failed: %s vs %s", r1.MsgID, r2.MsgID)
	}
	msgs, _ := st.Channels.MessagesByChannel(context.Background(), "ch1", "", 10)
	if len(msgs) != 1 {
		t.Errorf("dedup should not double-insert, got %d", len(msgs))
	}
}

func TestRelayTypingToOtherMembers(t *testing.T) {
	svc, st, rt := newSvc()
	st.Channels.AddMember("ch1", "u1")
	st.Channels.AddMember("ch1", "u2")
	if err := svc.RelayTyping(context.Background(), "u1", "ch1", true); err != nil {
		t.Fatalf("typing: %v", err)
	}
	if len(rt.Sent["u2"]) == 0 || rt.Sent["u2"][0].Type != protocol.TypeTypingIndicator {
		t.Errorf("u2 missed typing indicator: %v", rt.Sent["u2"])
	}
	if len(rt.Sent["u1"]) != 0 {
		t.Errorf("typing should not echo to sender")
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/channel/`
Expected: FAIL — undefined `New`, `Service`, `SendChannel`.

- [ ] **Step 3: Implement `service.go`**

`backend/internal/channel/service.go`:

```go
// Package channel orchestrates group/Hangout channel messaging: membership-gated
// send with persist-before-ack and fan-out to other members, plus typing relay.
package channel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

// ErrNotMember is returned when a user is not a member of the channel.
var ErrNotMember = errors.New("not a channel member")

// Service handles channel messaging.
type Service struct {
	chans  store.ChannelStore
	router store.Router
	now    func() time.Time
}

// New constructs a channel Service.
func New(c store.ChannelStore, r store.Router) *Service {
	return &Service{chans: c, router: r, now: time.Now}
}

// AckResult is returned to the sender after a durable write.
type AckResult struct {
	ClientMsgID string
	MsgID       string
	TS          string
}

// SendChannel validates membership, persists the message BEFORE acking, then
// fans out message.new to every other member. Idempotent on
// (channelID, sender, clientMsgID).
func (s *Service) SendChannel(ctx context.Context, senderID string, p protocol.SendPayload) (AckResult, error) {
	if p.ChannelID == "" {
		return AckResult{}, errors.New("channelId required")
	}
	member, err := s.chans.IsMember(ctx, p.ChannelID, senderID)
	if err != nil {
		return AckResult{}, err
	}
	if !member {
		return AckResult{}, ErrNotMember
	}

	if p.ClientMsgID != "" {
		if id, found, err := s.chans.ExistsByClientMsgID(ctx, p.ChannelID, senderID, p.ClientMsgID); err != nil {
			return AckResult{}, err
		} else if found {
			return AckResult{ClientMsgID: p.ClientMsgID, MsgID: id, TS: s.now().UTC().Format(time.RFC3339)}, nil
		}
	}

	msgType := p.Type
	if msgType == "" {
		msgType = "text"
	}
	m := store.Message{
		ID:        protocol.NewMsgID(),
		ChannelID: p.ChannelID,
		SenderID:  senderID,
		Type:      msgType,
		Body:      p.Body,
		CreatedAt: s.now().UTC(),
	}
	if err := s.chans.InsertChannelMessage(ctx, m, p.ClientMsgID); err != nil {
		return AckResult{}, fmt.Errorf("persist: %w", err)
	}
	ack := AckResult{ClientMsgID: p.ClientMsgID, MsgID: m.ID, TS: m.CreatedAt.Format(time.RFC3339)}

	members, err := s.chans.Members(ctx, p.ChannelID)
	if err != nil {
		return ack, nil // ack already durable; fan-out is best-effort
	}
	env := mustEnvelope(protocol.TypeMessageNew, map[string]any{
		"id": m.ID, "channelId": m.ChannelID, "senderId": senderID,
		"type": m.Type, "body": m.Body, "ts": ack.TS,
	})
	for _, u := range members {
		if u != senderID {
			_, _ = s.router.RouteToUser(ctx, u, env)
		}
	}
	return ack, nil
}

// RelayTyping broadcasts an ephemeral typing indicator to other channel members.
func (s *Service) RelayTyping(ctx context.Context, fromUser, channelID string, isTyping bool) error {
	member, err := s.chans.IsMember(ctx, channelID, fromUser)
	if err != nil {
		return err
	}
	if !member {
		return ErrNotMember
	}
	members, err := s.chans.Members(ctx, channelID)
	if err != nil {
		return err
	}
	env := mustEnvelope(protocol.TypeTypingIndicator, map[string]any{
		"channelId": channelID, "userId": fromUser, "isTyping": isTyping,
	})
	for _, u := range members {
		if u != fromUser {
			_, _ = s.router.RouteToUser(ctx, u, env)
		}
	}
	return nil
}

func mustEnvelope(t string, data map[string]any) protocol.Envelope {
	raw, _ := json.Marshal(data)
	return protocol.Envelope{Type: t, ID: protocol.NewMsgID(), TS: time.Now().UTC().Format(time.RFC3339), Data: raw}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/channel/`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/channel && git -C /home/faithsax/new-frontend commit -m "feat(ws1): channel service — membership-gated send, fan-out, typing relay"
```

---

## Task 5: FeedService — create / like / comment with broadcast

**Files:** Create `backend/internal/feed/service.go`, `backend/internal/feed/service_test.go`

The feed broadcasts `post.*` to a set of "audience" users. In Phase 1 the audience
is "all currently connected users," which the gateway provides via a member list;
to keep `FeedService` decoupled from presence, it accepts an `audience []string`
from the caller (the HTTP handler passes the online-user list). This keeps the
service unit-testable and avoids a hidden dependency.

- [ ] **Step 1: Write the failing test**

`backend/internal/feed/service_test.go`:

```go
package feed

import (
	"context"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newSvc() (*Service, *store.FakeStores, *store.FakeRouter) {
	st := store.NewFakeStores()
	rt := store.NewFakeRouter()
	return New(st.Posts, rt), st, rt
}

func TestCreatePostPersistsAndBroadcasts(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	post, err := svc.CreatePost(ctx, "u1", protocol.CreatePostPayload{Kind: "update", Body: "shipped!"}, []string{"u2", "u3"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if post.ID == "" {
		t.Fatal("empty post id")
	}
	posts, _ := st.Posts.ListPosts(ctx, "", 10)
	if len(posts) != 1 || posts[0].Body != "shipped!" {
		t.Fatalf("not persisted: %v", posts)
	}
	// broadcast post.new to audience (excluding author)
	if len(rt.Sent["u2"]) == 0 || rt.Sent["u2"][0].Type != protocol.TypePostNew {
		t.Errorf("u2 missed post.new: %v", rt.Sent["u2"])
	}
	if len(rt.Sent["u1"]) != 0 {
		t.Errorf("author should not be broadcast to")
	}
}

func TestLikeBroadcastsAndCounts(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	_ = st.Posts.CreatePost(ctx, store.Post{ID: "p1", AuthorID: "u1", Kind: "update", Body: "x"})
	n, err := svc.Like(ctx, "p1", "u2", []string{"u1", "u3"})
	if err != nil {
		t.Fatalf("like: %v", err)
	}
	if n != 1 {
		t.Errorf("like count = %d, want 1", n)
	}
	if len(rt.Sent["u1"]) == 0 || rt.Sent["u1"][0].Type != protocol.TypePostLiked {
		t.Errorf("u1 missed post.liked: %v", rt.Sent["u1"])
	}
}

func TestLikeMissingPostFails(t *testing.T) {
	svc, _, _ := newSvc()
	if _, err := svc.Like(context.Background(), "ghost", "u2", nil); err == nil {
		t.Fatal("expected error liking nonexistent post")
	}
}

func TestAddCommentBroadcasts(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	_ = st.Posts.CreatePost(ctx, store.Post{ID: "p1", AuthorID: "u1", Kind: "update", Body: "x"})
	c, err := svc.AddComment(ctx, "p1", "u2", protocol.CommentPayload{Body: "great"}, []string{"u1"})
	if err != nil {
		t.Fatalf("comment: %v", err)
	}
	if c.ID == "" {
		t.Fatal("empty comment id")
	}
	if len(rt.Sent["u1"]) == 0 || rt.Sent["u1"][0].Type != protocol.TypePostComment {
		t.Errorf("u1 missed post.comment: %v", rt.Sent["u1"])
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/feed/`
Expected: FAIL — undefined `New`, `Service`, `CreatePost`.

- [ ] **Step 3: Implement `service.go`**

`backend/internal/feed/service.go`:

```go
// Package feed orchestrates the social feed: create posts, like/unlike, and
// comment, persisting each then broadcasting post.* envelopes to an audience.
package feed

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

// ErrPostNotFound is returned when an action targets a missing post.
var ErrPostNotFound = errors.New("post not found")

// Service handles feed posts.
type Service struct {
	posts  store.PostStore
	router store.Router
	now    func() time.Time
}

func New(p store.PostStore, r store.Router) *Service {
	return &Service{posts: p, router: r, now: time.Now}
}

// CreatePost persists a post then broadcasts post.new to the audience
// (excluding the author).
func (s *Service) CreatePost(ctx context.Context, authorID string, p protocol.CreatePostPayload, audience []string) (store.Post, error) {
	kind := p.Kind
	if kind == "" {
		kind = "update"
	}
	post := store.Post{ID: protocol.NewMsgID(), AuthorID: authorID, Kind: kind, Body: p.Body, CreatedAt: s.now().UTC()}
	if err := s.posts.CreatePost(ctx, post); err != nil {
		return store.Post{}, err
	}
	s.broadcast(ctx, authorID, audience, protocol.TypePostNew, map[string]any{
		"id": post.ID, "authorId": authorID, "kind": post.Kind, "body": post.Body, "ts": post.CreatedAt.Format(time.RFC3339),
	})
	return post, nil
}

// Like records a like (idempotent), returns the new like count, and broadcasts.
func (s *Service) Like(ctx context.Context, postID, userID string, audience []string) (int, error) {
	ok, err := s.posts.PostExists(ctx, postID)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, ErrPostNotFound
	}
	if err := s.posts.Like(ctx, postID, userID); err != nil {
		return 0, err
	}
	n, err := s.posts.LikeCount(ctx, postID)
	if err != nil {
		return 0, err
	}
	s.broadcast(ctx, userID, audience, protocol.TypePostLiked, map[string]any{
		"postId": postID, "userId": userID, "likeCount": n,
	})
	return n, nil
}

// Unlike removes a like (idempotent) and returns the new count.
func (s *Service) Unlike(ctx context.Context, postID, userID string) (int, error) {
	if err := s.posts.Unlike(ctx, postID, userID); err != nil {
		return 0, err
	}
	return s.posts.LikeCount(ctx, postID)
}

// AddComment persists a comment then broadcasts post.comment.
func (s *Service) AddComment(ctx context.Context, postID, authorID string, p protocol.CommentPayload, audience []string) (store.Comment, error) {
	ok, err := s.posts.PostExists(ctx, postID)
	if err != nil {
		return store.Comment{}, err
	}
	if !ok {
		return store.Comment{}, ErrPostNotFound
	}
	c := store.Comment{ID: protocol.NewMsgID(), PostID: postID, AuthorID: authorID, Body: p.Body, CreatedAt: s.now().UTC()}
	if err := s.posts.AddComment(ctx, c); err != nil {
		return store.Comment{}, err
	}
	s.broadcast(ctx, authorID, audience, protocol.TypePostComment, map[string]any{
		"id": c.ID, "postId": postID, "authorId": authorID, "body": c.Body, "ts": c.CreatedAt.Format(time.RFC3339),
	})
	return c, nil
}

// ListPosts returns recent posts (keyset paginated).
func (s *Service) ListPosts(ctx context.Context, before string, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return s.posts.ListPosts(ctx, before, limit)
}

// ListComments returns a post's comments.
func (s *Service) ListComments(ctx context.Context, postID string) ([]store.Comment, error) {
	return s.posts.ListComments(ctx, postID)
}

func (s *Service) broadcast(ctx context.Context, actor string, audience []string, typ string, data map[string]any) {
	raw, _ := json.Marshal(data)
	env := protocol.Envelope{Type: typ, ID: protocol.NewMsgID(), TS: time.Now().UTC().Format(time.RFC3339), Data: raw}
	for _, u := range audience {
		if u != actor {
			_, _ = s.router.RouteToUser(ctx, u, env)
		}
	}
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/feed/`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/feed && git -C /home/faithsax/new-frontend commit -m "feat(ws1): feed service — create/like/comment with broadcast"
```

---

## Task 6: Postgres ChannelStore

**Files:** Create `backend/internal/store/postgres/channels.go`; modify `postgres.go`

- [ ] **Step 1: Implement `channels.go`**

`backend/internal/store/postgres/channels.go`:

```go
package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type ChannelStore struct{ pool *pgxpool.Pool }

func (s *ChannelStore) ListForUser(ctx context.Context, userID string) ([]store.Channel, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT c.id, c.name, c.kind, c.created_at
		FROM channels c JOIN channel_members m ON m.channel_id = c.id
		WHERE m.user_id = $1 ORDER BY c.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Channel
	for rows.Next() {
		var c store.Channel
		if err := rows.Scan(&c.ID, &c.Name, &c.Kind, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *ChannelStore) Members(ctx context.Context, channelID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT user_id FROM channel_members WHERE channel_id=$1 ORDER BY user_id`, channelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (s *ChannelStore) IsMember(ctx context.Context, channelID, userID string) (bool, error) {
	var x int
	err := s.pool.QueryRow(ctx, `SELECT 1 FROM channel_members WHERE channel_id=$1 AND user_id=$2`, channelID, userID).Scan(&x)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

func (s *ChannelStore) MessagesByChannel(ctx context.Context, channelID, before string, limit int) ([]store.Message, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, channel_id, sender_id, type, body, created_at FROM messages WHERE channel_id=$1`
	args := []any{channelID}
	if before != "" {
		q += ` AND id < $2`
		args = append(args, before)
	}
	q += ` ORDER BY id DESC LIMIT ` + itoaSafe(limit)
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Message
	for rows.Next() {
		var m store.Message
		if err := rows.Scan(&m.ID, &m.ChannelID, &m.SenderID, &m.Type, &m.Body, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *ChannelStore) InsertChannelMessage(ctx context.Context, m store.Message, clientMsgID string) error {
	var cmid any
	if clientMsgID != "" {
		cmid = clientMsgID
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO messages (id, channel_id, sender_id, client_msg_id, type, body, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		m.ID, m.ChannelID, m.SenderID, cmid, m.Type, m.Body, m.CreatedAt)
	return err
}

func (s *ChannelStore) ExistsByClientMsgID(ctx context.Context, channelID, senderID, clientMsgID string) (string, bool, error) {
	if clientMsgID == "" {
		return "", false, nil
	}
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id FROM messages WHERE channel_id=$1 AND sender_id=$2 AND client_msg_id=$3`, channelID, senderID, clientMsgID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

func (s *ChannelStore) SetReadCursor(ctx context.Context, channelID, userID, msgID string) error {
	tag, err := s.pool.Exec(ctx, `UPDATE channel_members SET last_read_msg_id=$3 WHERE channel_id=$1 AND user_id=$2`, channelID, userID, msgID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return store.ErrNotFound
	}
	return nil
}
```

NOTE: `itoaSafe` above is a placeholder — there is no such helper, and
`messages.go` already uses `strconv.Itoa` (no private `itoa` to collide with).
When writing `channels.go`, add `"strconv"` to the imports and use
`strconv.Itoa(limit)` for the LIMIT clause (replace the `itoaSafe(limit)` token).

- [ ] **Step 2: Wire ChannelStore into the Store struct**

In `backend/internal/store/postgres/postgres.go`, add `Channels *ChannelStore` to
the `Store` struct, initialize it in `Open` (`s.Channels = &ChannelStore{pool: pool}`),
and add to the interface-assertion block:
```go
var _ store.ChannelStore = (*ChannelStore)(nil)
```

- [ ] **Step 3: Build**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob build ./...`
Expected: compiles. (Replace `itoaSafe` with `strconv.Itoa` per the note before building.)

- [ ] **Step 4: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store/postgres && git -C /home/faithsax/new-frontend commit -m "feat(ws1): postgres ChannelStore"
```

---

## Task 7: Postgres PostStore + channel/post integration tests

**Files:** Create `backend/internal/store/postgres/posts.go`; modify `postgres.go`, `postgres_test.go`

- [ ] **Step 1: Implement `posts.go`**

`backend/internal/store/postgres/posts.go`:

```go
package postgres

import (
	"context"
	"errors"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type PostStore struct{ pool *pgxpool.Pool }

func (s *PostStore) CreatePost(ctx context.Context, p store.Post) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO posts (id, author_id, kind, body, created_at) VALUES ($1,$2,$3,$4,$5)`,
		p.ID, p.AuthorID, p.Kind, p.Body, p.CreatedAt)
	return err
}

func (s *PostStore) ListPosts(ctx context.Context, before string, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, author_id, kind, body, created_at FROM posts`
	var args []any
	if before != "" {
		q += ` WHERE id < $1`
		args = append(args, before)
	}
	q += ` ORDER BY id DESC LIMIT ` + strconv.Itoa(limit)
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Post
	for rows.Next() {
		var p store.Post
		if err := rows.Scan(&p.ID, &p.AuthorID, &p.Kind, &p.Body, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *PostStore) Like(ctx context.Context, postID, userID string) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, postID, userID)
	return err
}

func (s *PostStore) Unlike(ctx context.Context, postID, userID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2`, postID, userID)
	return err
}

func (s *PostStore) LikeCount(ctx context.Context, postID string) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `SELECT count(*) FROM post_likes WHERE post_id=$1`, postID).Scan(&n)
	return n, err
}

func (s *PostStore) AddComment(ctx context.Context, c store.Comment) error {
	_, err := s.pool.Exec(ctx, `INSERT INTO post_comments (id, post_id, author_id, body, created_at) VALUES ($1,$2,$3,$4,$5)`,
		c.ID, c.PostID, c.AuthorID, c.Body, c.CreatedAt)
	return err
}

func (s *PostStore) ListComments(ctx context.Context, postID string) ([]store.Comment, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, post_id, author_id, body, created_at FROM post_comments WHERE post_id=$1 ORDER BY id`, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Comment
	for rows.Next() {
		var c store.Comment
		if err := rows.Scan(&c.ID, &c.PostID, &c.AuthorID, &c.Body, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *PostStore) PostExists(ctx context.Context, postID string) (bool, error) {
	var x int
	err := s.pool.QueryRow(ctx, `SELECT 1 FROM posts WHERE id=$1`, postID).Scan(&x)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}
```

- [ ] **Step 2: Wire PostStore into the Store struct**

In `postgres.go`: add `Posts *PostStore` to `Store`, init in `Open`
(`s.Posts = &PostStore{pool: pool}`), and add assertion
`var _ store.PostStore = (*PostStore)(nil)`.

- [ ] **Step 3: Add integration tests**

Append to `backend/internal/store/postgres/postgres_test.go` (already has
`//go:build integration` + `uuidA`/`uuidB`):

```go
func TestPostgresChannelMessage(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "A"})
	chID := protocol.NewMsgID()
	if _, err := st.pool.Exec(ctx, `INSERT INTO channels (id, name) VALUES ($1,'hangout')`, chID); err != nil {
		t.Fatalf("seed channel: %v", err)
	}
	if _, err := st.pool.Exec(ctx, `INSERT INTO channel_members (channel_id, user_id) VALUES ($1,$2)`, chID, uuidA); err != nil {
		t.Fatalf("seed member: %v", err)
	}
	ok, err := st.Channels.IsMember(ctx, chID, uuidA)
	if err != nil || !ok {
		t.Fatalf("IsMember: ok=%v err=%v", ok, err)
	}
	m := store.Message{ID: protocol.NewMsgID(), ChannelID: chID, SenderID: uuidA, Type: "text", Body: "hi chan"}
	if err := st.Channels.InsertChannelMessage(ctx, m, "cc1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, err := st.Channels.MessagesByChannel(ctx, chID, "", 10)
	if err != nil || len(got) != 1 || got[0].Body != "hi chan" {
		t.Fatalf("query: %v err=%v", got, err)
	}
}

func TestPostgresPostLifecycle(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "A"})
	_ = st.Users.Upsert(ctx, store.User{ID: uuidB, DisplayName: "B"})
	pid := protocol.NewMsgID()
	if err := st.Posts.CreatePost(ctx, store.Post{ID: pid, AuthorID: uuidA, Kind: "update", Body: "hello feed"}); err != nil {
		t.Fatalf("create: %v", err)
	}
	_ = st.Posts.Like(ctx, pid, uuidB)
	_ = st.Posts.Like(ctx, pid, uuidB) // idempotent via ON CONFLICT
	n, _ := st.Posts.LikeCount(ctx, pid)
	if n != 1 {
		t.Fatalf("like count = %d, want 1", n)
	}
	cid := protocol.NewMsgID()
	if err := st.Posts.AddComment(ctx, store.Comment{ID: cid, PostID: pid, AuthorID: uuidB, Body: "nice"}); err != nil {
		t.Fatalf("comment: %v", err)
	}
	cs, _ := st.Posts.ListComments(ctx, pid)
	if len(cs) != 1 {
		t.Fatalf("comments: %v", cs)
	}
}
```

NOTE: these tests reference `st.pool` (unexported field on the postgres `Store`).
The test file is in `package postgres`, so it can access `st.pool` directly. Also
ensure `postgres_test.go` imports `"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"`
(add it to the import block if not present).

- [ ] **Step 4: Build + run unit suite (integration excluded)**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob build ./... && gob test ./...`
Expected: build clean; all unit packages PASS.

- [ ] **Step 5: Run integration tests (pg + redis)**

Use the integration command from the Critical-notes block. Expected: all
integration packages `ok`, including the two new postgres tests.

- [ ] **Step 6: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store/postgres && git -C /home/faithsax/new-frontend commit -m "feat(ws1): postgres PostStore + channel/post integration tests"
```

---

## Task 8: Gateway — channel send dispatch + typing relay

**Files:** Modify `backend/internal/transport/ws/gateway.go`, `gateway_test.go`

- [ ] **Step 1: Add a channel-delivery test**

Append to `backend/internal/transport/ws/gateway_test.go`:

```go
func TestGatewayDeliversChannelMessage(t *testing.T) {
	srv, ver, st := newTestGateway(t)
	ctx := context.Background()
	st.Channels.AddMember("chX", "u1")
	st.Channels.AddMember("chX", "u2")
	tokA, _ := ver.Mint("u1", "U1", "founder")
	tokB, _ := ver.Mint("u2", "U2", "founder")

	dctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	connB, _, err := websocket.Dial(dctx, wsURL(srv.URL, tokB), nil)
	if err != nil {
		t.Fatalf("B dial: %v", err)
	}
	defer connB.Close(websocket.StatusNormalClosure, "")
	connA, _, err := websocket.Dial(dctx, wsURL(srv.URL, tokA), nil)
	if err != nil {
		t.Fatalf("A dial: %v", err)
	}
	defer connA.Close(websocket.StatusNormalClosure, "")
	time.Sleep(100 * time.Millisecond)

	send := protocol.Envelope{Type: protocol.TypeMessageSend, ID: protocol.NewMsgID()}
	send.Data, _ = json.Marshal(protocol.SendPayload{ChannelID: "chX", ClientMsgID: "c1", Type: "text", Body: "hi chan"})
	raw, _ := json.Marshal(send)
	if err := connA.Write(dctx, websocket.MessageText, raw); err != nil {
		t.Fatalf("A write: %v", err)
	}
	got := readEnvelope(t, dctx, connB)
	if got.Type != protocol.TypeMessageNew {
		t.Fatalf("B expected message.new, got %s", got.Type)
	}
}
```

Also update `newTestGateway` (in the same file) to construct and pass a channel
service. Replace the `gw := New(Deps{...})` line with:

```go
	chSvc := channel.New(st.Channels, h)
	gw := New(Deps{Hub: h, Verifier: ver, Users: st.Users, Messaging: msg, Channels: chSvc, Presence: pres, InsecureSkipOriginCheck: true})
```

and add the import `"github.com/techit360ai-bit/new-frontend/backend/internal/channel"`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/transport/ws/`
Expected: FAIL — `Deps` has no `Channels` field / undefined.

- [ ] **Step 3: Add Channels to Deps + dispatch logic**

In `gateway.go`, add to the `Deps` struct (after `Messaging`):
```go
	Channels  *channel.Service
```
and add the import `"github.com/techit360ai-bit/new-frontend/backend/internal/channel"`.

Replace the `dispatch` method's `TypeMessageSend` case and the typing case with
the following (the `TypeReadUpto` case is unchanged from Plan 2 and shown here for
position only):

```go
	case protocol.TypeMessageSend:
		var p protocol.SendPayload
		if json.Unmarshal(env.Data, &p) != nil {
			return
		}
		// Route by target: channelId set -> channel send; else DM. Each branch
		// produces its own package's AckResult; both emit a message.ack.
		if p.ChannelID != "" {
			a, err := g.d.Channels.SendChannel(ctx, userID, p)
			if err != nil {
				g.sendError(ctx, userID, "send_failed", err.Error())
				return
			}
			g.send(ctx, userID, protocol.TypeMessageAck, map[string]any{
				"clientMsgId": a.ClientMsgID, "msgId": a.MsgID, "ts": a.TS,
			})
			return
		}
		a, err := g.d.Messaging.SendDM(ctx, userID, p)
		if err != nil {
			g.sendError(ctx, userID, "send_failed", err.Error())
			return
		}
		g.send(ctx, userID, protocol.TypeMessageAck, map[string]any{
			"clientMsgId": a.ClientMsgID, "msgId": a.MsgID, "ts": a.TS,
		})
	case protocol.TypeReadUpto:
		var p protocol.ReadUptoPayload
		if json.Unmarshal(env.Data, &p) != nil {
			return
		}
		if err := g.d.Messaging.MarkRead(ctx, userID, p); err != nil {
			g.sendError(ctx, userID, "read_failed", err.Error())
		}
	case protocol.TypeTypingStart, protocol.TypeTypingStop:
		var p protocol.ReadUptoPayload // reuses the {convId?, channelId?} shape
		if json.Unmarshal(env.Data, &p) != nil {
			return
		}
		if p.ChannelID != "" {
			_ = g.d.Channels.RelayTyping(ctx, userID, p.ChannelID, env.Type == protocol.TypeTypingStart)
		}
		// DM typing relay deferred to a later phase (needs conv participant lookup).
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/transport/ws/`
Expected: PASS (DM + channel delivery + auth reject).

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/transport/ws && git -C /home/faithsax/new-frontend commit -m "feat(ws1): gateway dispatches channel sends + channel typing relay"
```

---

## Task 9: HTTP API — channel endpoints

**Files:** Create `backend/internal/transport/httpapi/channels.go`; modify `router.go`, `httpapi_test.go`

- [ ] **Step 1: Add Channels to Deps + mount routes**

In `router.go`, add to `Deps`:
```go
	Channels       *channel.Service
	ChannelStore   store.ChannelStore
```
and import `"github.com/techit360ai-bit/new-frontend/backend/internal/channel"`.
Inside the authed group in `NewRouter`, add:
```go
			r.Get("/channels", handleListChannels(d))
			r.Get("/channels/{id}/messages", handleChannelHistory(d))
			r.Post("/channels/{id}/messages", handleChannelSend(d))
			r.Post("/channels/{id}/read", handleChannelRead(d))
```

- [ ] **Step 2: Implement `channels.go`**

`backend/internal/transport/httpapi/channels.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

func handleListChannels(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		chans, err := d.ChannelStore.ListForUser(r.Context(), me)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(chans))
		for _, c := range chans {
			out = append(out, map[string]any{"id": c.ID, "name": c.Name, "kind": c.Kind})
		}
		writeJSON(w, http.StatusOK, map[string]any{"channels": out})
	}
}

func handleChannelHistory(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		chID := chi.URLParam(r, "id")
		ok, err := d.ChannelStore.IsMember(r.Context(), chID, me)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !ok {
			writeErr(w, http.StatusForbidden, "not a member")
			return
		}
		msgs, err := d.ChannelStore.MessagesByChannel(r.Context(), chID, r.URL.Query().Get("before"), 50)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(msgs))
		for _, m := range msgs {
			out = append(out, map[string]any{
				"id": m.ID, "channelId": m.ChannelID, "senderId": m.SenderID,
				"type": m.Type, "body": m.Body, "ts": m.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"messages": out})
	}
}

func handleChannelSend(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		chID := chi.URLParam(r, "id")
		var body struct {
			ClientMsgID string `json:"clientMsgId"`
			Type        string `json:"type"`
			Body        string `json:"body"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		ack, err := d.Channels.SendChannel(r.Context(), me, protocol.SendPayload{
			ChannelID: chID, ClientMsgID: body.ClientMsgID, Type: body.Type, Body: body.Body,
		})
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"clientMsgId": ack.ClientMsgID, "msgId": ack.MsgID, "ts": ack.TS})
	}
}

func handleChannelRead(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		chID := chi.URLParam(r, "id")
		var body struct {
			MsgID string `json:"msgId"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.MsgID == "" {
			writeErr(w, http.StatusBadRequest, "msgId required")
			return
		}
		if err := d.ChannelStore.SetReadCursor(r.Context(), chID, me, body.MsgID); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}
```

- [ ] **Step 3: Add a channel endpoint test**

Append to `httpapi_test.go` — first update `newAPI` to wire the channel service +
store into `Deps`:
```go
	chSvc := channel.New(st.Channels, h)
	// ... add to NewRouter(Deps{...}): Channels: chSvc, ChannelStore: st.Channels,
```
(add import `"github.com/techit360ai-bit/new-frontend/backend/internal/channel"`).
Then add:
```go
func TestChannelSendAndHistory(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	st.Channels.AddMember("ch1", "u1")
	tok, _ := ver.Mint("u1", "U1", "founder")

	rec := httptest.NewRecorder()
	sb, _ := json.Marshal(map[string]string{"clientMsgId": "m1", "type": "text", "body": "hi chan"})
	req := httptest.NewRequest("POST", "/api/v1/channels/ch1/messages", bytes.NewReader(sb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("send code=%d body=%s", rec.Code, rec.Body)
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/channels/ch1/messages", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("history code=%d", rec.Code)
	}
	var hist struct{ Messages []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &hist)
	if len(hist.Messages) != 1 {
		t.Fatalf("want 1 channel message, got %d", len(hist.Messages))
	}
}
```

- [ ] **Step 4: Run tests**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/transport/httpapi/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/transport/httpapi && git -C /home/faithsax/new-frontend commit -m "feat(ws1): HTTP API channel endpoints (list/history/send/read)"
```

---

## Task 10: HTTP API — feed/post endpoints

**Files:** Create `backend/internal/transport/httpapi/posts.go`; modify `router.go`, `httpapi_test.go`

- [ ] **Step 1: Add Feed to Deps + mount routes**

In `router.go`, add to `Deps`:
```go
	Feed *feed.Service
```
import `"github.com/techit360ai-bit/new-frontend/backend/internal/feed"`. Inside the
authed group:
```go
			r.Get("/posts", handleListPosts(d))
			r.Post("/posts", handleCreatePost(d))
			r.Post("/posts/{id}/like", handleLikePost(d))
			r.Delete("/posts/{id}/like", handleUnlikePost(d))
			r.Get("/posts/{id}/comments", handleListComments(d))
			r.Post("/posts/{id}/comments", handleAddComment(d))
```

- [ ] **Step 2: Implement `posts.go`**

`backend/internal/transport/httpapi/posts.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

// audience returns the set of users to broadcast feed events to: the currently
// online users (Phase 1 audience = everyone connected).
func audience(d Deps, r *http.Request) []string {
	ids, _ := d.Presence.ListOnline(r.Context())
	return ids
}

func handleListPosts(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		posts, err := d.Feed.ListPosts(r.Context(), r.URL.Query().Get("before"), 50)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(posts))
		for _, p := range posts {
			out = append(out, map[string]any{
				"id": p.ID, "authorId": p.AuthorID, "kind": p.Kind, "body": p.Body, "ts": p.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"posts": out})
	}
}

func handleCreatePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		var p protocol.CreatePostPayload
		if json.NewDecoder(r.Body).Decode(&p) != nil || p.Body == "" {
			writeErr(w, http.StatusBadRequest, "body required")
			return
		}
		post, err := d.Feed.CreatePost(r.Context(), me, p, audience(d, r))
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": post.ID, "authorId": post.AuthorID, "kind": post.Kind, "body": post.Body, "ts": post.CreatedAt,
		})
	}
}

func handleLikePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		postID := chi.URLParam(r, "id")
		n, err := d.Feed.Like(r.Context(), postID, me, audience(d, r))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"likeCount": n})
	}
}

func handleUnlikePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		postID := chi.URLParam(r, "id")
		n, err := d.Feed.Unlike(r.Context(), postID, me)
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"likeCount": n})
	}
}

func handleListComments(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		postID := chi.URLParam(r, "id")
		cs, err := d.Feed.ListComments(r.Context(), postID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(cs))
		for _, c := range cs {
			out = append(out, map[string]any{
				"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "body": c.Body, "ts": c.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"comments": out})
	}
}

func handleAddComment(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		postID := chi.URLParam(r, "id")
		var p protocol.CommentPayload
		if json.NewDecoder(r.Body).Decode(&p) != nil || p.Body == "" {
			writeErr(w, http.StatusBadRequest, "body required")
			return
		}
		c, err := d.Feed.AddComment(r.Context(), postID, me, p, audience(d, r))
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": c.ID, "postId": c.PostID, "authorId": c.AuthorID, "body": c.Body, "ts": c.CreatedAt,
		})
	}
}
```

- [ ] **Step 3: Add a feed endpoint test**

Append to `httpapi_test.go` — first wire feed into `newAPI`:
```go
	feedSvc := feed.New(st.Posts, h)
	// add to NewRouter(Deps{...}): Feed: feedSvc,
```
(add import `"github.com/techit360ai-bit/new-frontend/backend/internal/feed"`). Then:
```go
func TestCreateAndListPosts(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	tok, _ := ver.Mint("u1", "U1", "founder")

	rec := httptest.NewRecorder()
	pb, _ := json.Marshal(map[string]string{"kind": "update", "body": "shipped v1"})
	req := httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("create code=%d body=%s", rec.Code, rec.Body)
	}
	var created struct{ ID string }
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if created.ID == "" {
		t.Fatal("no post id")
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/posts", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	var list struct{ Posts []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list.Posts) != 1 {
		t.Fatalf("want 1 post, got %d", len(list.Posts))
	}

	// like it
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("POST", "/api/v1/posts/"+created.ID+"/like", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("like code=%d", rec.Code)
	}
}
```

- [ ] **Step 4: Run tests**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/transport/httpapi/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/transport/httpapi && git -C /home/faithsax/new-frontend commit -m "feat(ws1): HTTP API feed endpoints (list/create/like/comment)"
```

---

## Task 11: Wire ChannelService + FeedService into main

**Files:** Modify `backend/cmd/server/main.go`

- [ ] **Step 1: Construct and wire the services**

In `main.go`, after `msgSvc := messaging.New(...)`, add:
```go
	chSvc := channel.New(pg.Channels, h)
	feedSvc := feed.New(pg.Posts, h)
```
Add imports `"github.com/techit360ai-bit/new-frontend/backend/internal/channel"` and
`"github.com/techit360ai-bit/new-frontend/backend/internal/feed"`.

Update the `ws.New(ws.Deps{...})` to include `Channels: chSvc,`.

Update `httpapi.NewRouter(httpapi.Deps{...})` to include:
```go
		Channels: chSvc, ChannelStore: pg.Channels, Feed: feedSvc,
```

- [ ] **Step 2: Build the server**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob build ./cmd/server/`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/cmd/server && git -C /home/faithsax/new-frontend commit -m "feat(ws1): wire channel + feed services into server main"
```

---

## Task 12: Final verification for Plan 3

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite + vet**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./... && gob vet ./...`
Expected: all packages ok (now including `internal/channel`, `internal/feed`); vet clean.

- [ ] **Step 2: Integration (pg + redis)**

Run the integration command from the Critical-notes block.
Expected: all integration packages `ok` (incl. the new channel/post postgres tests).

- [ ] **Step 3: Race check on changed concurrency surface**

Run: `cd /home/faithsax/new-frontend/backend && docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine sh -c "apk add --no-cache gcc musl-dev >/dev/null && go test -race ./internal/channel/ ./internal/feed/ ./internal/transport/ws/"`
Expected: PASS, no data races.

- [ ] **Step 4: Smoke still green (regression)**

Run: `cd /home/faithsax/new-frontend/backend && bash scripts/smoke.sh`
Expected: `==> smoke passed` (DM path unaffected by channel/feed additions).

- [ ] **Step 5: Confirm branch + history**

Run: `git -C /home/faithsax/new-frontend branch --show-current` → `feat/messaging-phase1`
Run: `git -C /home/faithsax/new-frontend log --oneline 3105d8b..HEAD` → Plan-3 commits.

Do NOT push — Plan 4 (frontend wiring) builds on this branch; push/PR after Phase 1 is complete.

---

## Self-Review (completed by plan author)

- **Spec coverage (Plan-3 portion):** Hangout channels (membership, history, fan-out send, read cursor) → Tasks 2,3,4,6,8,9; social Feed (posts/likes/comments + live broadcast) → Tasks 1,2,3,5,7,10; typing indicators (channel; DM deferred with note) → Tasks 1,4,8; wiring → Task 11; verification → Task 12. Frontend wiring is Plan 4, not a gap.
- **Placeholder scan:** Two NOTES flag editing hazards (the `itoaSafe`→`strconv.Itoa` choice in Task 6; the stray `var ack interface{}` artifact in Task 8) with the exact correct end state shown. No "TBD"/"handle errors"/uncoded steps. The Task-8 dispatch note explicitly states the final compiling shape (if channelId→SendChannel else→SendDM, both emit message.ack).
- **Type consistency:** `channel.Service.SendChannel(ctx, senderID, protocol.SendPayload) (channel.AckResult, error)` and `messaging.Service.SendDM(...) (messaging.AckResult, error)` — distinct AckResult types per package; the gateway uses each within its branch (no cross-type reference). `store.ChannelStore`/`store.PostStore` method sets match across interface (Task 2), fakes (Task 3), and postgres impls (Tasks 6,7). `feed.Service` methods take `audience []string` consistently (Tasks 5,10). `Deps` gains `Channels`, `ChannelStore`, `Feed` referenced identically in router (Tasks 9,10) and main (Task 11). protocol `TypePostNew/Liked/Comment` + `CreatePostPayload`/`CommentPayload` defined Task 1, used Tasks 5,10.
- **Executor cautions:** run `gob`-defn + command on one shell line; commit via `git -C <root>`; the `messages` table is shared by DM and channel (CHECK enforces exactly one FK) so channel inserts set `channel_id` and leave `conversation_id` NULL. Audience for feed broadcast = `Presence.ListOnline` (Phase 1 = all connected); documented limitation, fine for P1.
