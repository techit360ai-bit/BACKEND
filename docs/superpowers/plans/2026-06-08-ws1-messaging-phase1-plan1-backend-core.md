# WS1 Messaging Phase 1 — Plan 1: Backend Core (Domain) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tested business core of the Go messaging service — module scaffold, config, the WS message protocol types, the storage layer (interfaces + Postgres + migrations), and the messaging service (1:1 DM send with persist-before-ACK, delivery/read receipts, read cursors) — with no network transport yet.

**Architecture:** Standard Go layout under `backend/`. Pure-domain packages (`protocol`, `store` interfaces) have no infra deps and are unit-tested with fakes. The `messaging` service orchestrates a `MessageStore`/`ConversationStore` and a `Router` interface (the hub, stubbed in this plan) and is unit-tested with fakes. One integration test exercises the real Postgres store via the host's `psql`/Docker Postgres.

**Tech Stack:** Go 1.23, `jackc/pgx/v5` (Postgres), `google/uuid` (UUIDv7), `stretchr/testify` (assertions). HTTP/WS/Redis libs are introduced in Plan 2, not here.

**Spec:** `docs/superpowers/specs/2026-06-08-ws1-messaging-phase1-design.md`

**This is Plan 1 of 3** for Phase 1:
- Plan 1 (this): backend domain core — protocol, store, messaging service. No network.
- Plan 2: transport & real-time — hub, Redis pub/sub, presence, WS gateway, HTTP API, main, compose, smoke.
- Plan 3: channels + feed services/endpoints + frontend wiring.

---

## Critical execution notes (READ FIRST)

- **Go is NOT installed on the host.** Every `go` command runs inside a container:
  ```
  docker run --rm -v "$PWD":/app -w /app golang:1.23-alpine go <args>
  ```
  Define this alias at the start of each work session:
  ```bash
  cd /home/faithsax/new-frontend/backend
  gob() { docker run --rm -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
  ```
  Then `gob test ./...`, `gob build ./...`, `gob mod tidy`, etc. The module cache
  lives in the container layer; first run downloads deps (network required).
- **All work happens in `backend/`.** First task removes the existing bare Express
  skeleton there.
- **Branch:** `feat/messaging-phase1` (already created off new-frontend `main`).
  Verify with `git branch --show-current` before each commit.
- **Postgres for the integration test:** the host has `psql`. Use a disposable
  Dockerized Postgres for the integration test (see Task 8); the cached
  `redis:7-alpine` is not needed until Plan 2.
- **TDD:** write the failing test first, run it (in container) to see it fail,
  implement, re-run to green, commit. Unit tests need no infra; only Task 8's
  integration test needs Postgres (build-tagged so unit runs stay infra-free).

---

## File Structure (this plan)

```
backend/
├─ go.mod, go.sum
├─ internal/
│  ├─ config/config.go              # env config struct + Load()
│  ├─ config/config_test.go
│  ├─ protocol/envelope.go          # Envelope + payload types, (de)serialize, NewMsgID (UUIDv7)
│  ├─ protocol/envelope_test.go
│  ├─ store/store.go                # domain models + store interfaces + Router interface + ErrNotFound
│  ├─ store/fakes.go                # in-memory fakes (test helper, non-_test so multiple pkgs reuse)
│  ├─ store/postgres/postgres.go    # pgxpool conn + Store struct
│  ├─ store/postgres/conversations.go
│  ├─ store/postgres/messages.go
│  ├─ store/postgres/postgres_test.go   # //go:build integration
│  ├─ store/migrations/0001_init.sql    # full Phase-1 schema
│  └─ messaging/service.go          # SendDM, MarkRead, receipt logic (persist-before-ACK)
│  └─ messaging/service_test.go
└─ (cmd/server, transport/*, hub, presence, feed → Plan 2/3)
```

Note: the migration file includes the FULL Phase-1 schema (channels/posts too) so
the DB is created once; Plan 1 code only touches users/conversations/messages/
receipts tables.

---

## Task 1: Remove Express skeleton, init Go module

**Files:**
- Delete: `backend/package.json`, `backend/package-lock.json`, `backend/src/` (and its empty subdirs), `backend/.gitignore`
- Create: `backend/go.mod`, `backend/.gitignore`

- [ ] **Step 1: Remove the Express skeleton**

```bash
cd /home/faithsax/new-frontend/backend
git rm -r package.json package-lock.json src
rm -f .gitignore
```

- [ ] **Step 2: Create `backend/.gitignore`**

```
# Go
/server
*.test
*.out
vendor/
.env
```

- [ ] **Step 3: Initialize the module (in container)**

```bash
cd /home/faithsax/new-frontend/backend
gob() { docker run --rm -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
gob mod init github.com/techit360ai-bit/new-frontend/backend
```
Expected: creates `backend/go.mod` with `module github.com/techit360ai-bit/new-frontend/backend` and `go 1.23`.

- [ ] **Step 4: Verify module builds (empty)**

Run: `gob build ./... 2>&1 || true`
Expected: no error (nothing to build yet), exit 0. If it prints `no Go files`, that's fine.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend
git add -A backend
git commit -m "chore(ws1): replace Express skeleton with Go module"
```

---

## Task 2: Config package

**Files:**
- Create: `backend/internal/config/config.go`, `backend/internal/config/config_test.go`

- [ ] **Step 1: Write the failing test**

`backend/internal/config/config_test.go`:

```go
package config

import (
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("JWT_SECRET", "s3cret")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want 8080", cfg.Port)
	}
	if cfg.JWTSecret != "s3cret" {
		t.Errorf("JWTSecret = %q, want s3cret", cfg.JWTSecret)
	}
}

func TestLoadRequiresJWTSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	if _, err := Load(); err == nil {
		t.Fatal("expected error when JWT_SECRET is empty")
	}
}

func TestLoadOverrides(t *testing.T) {
	t.Setenv("JWT_SECRET", "x")
	t.Setenv("PORT", "9999")
	t.Setenv("DATABASE_URL", "postgres://u@h/db")
	t.Setenv("REDIS_URL", "redis://localhost:6379")
	cfg, _ := Load()
	if cfg.Port != "9999" || cfg.DatabaseURL != "postgres://u@h/db" || cfg.RedisURL != "redis://localhost:6379" {
		t.Errorf("overrides not applied: %+v", cfg)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `gob test ./internal/config/`
Expected: FAIL — `undefined: Load` / package has no non-test files.

- [ ] **Step 3: Implement `config.go`**

`backend/internal/config/config.go`:

```go
// Package config loads service configuration from environment variables.
package config

import (
	"errors"
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	CORSOrigins string
}

// Load reads configuration from the environment, applying defaults.
// JWT_SECRET is required.
func Load() (Config, error) {
	cfg := Config{
		Port:        envOr("PORT", "8080"),
		DatabaseURL: envOr("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/techit_msg?sslmode=disable"),
		RedisURL:    envOr("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		CORSOrigins: envOr("CORS_ORIGINS", "*"),
	}
	if cfg.JWTSecret == "" {
		return Config{}, errors.New("JWT_SECRET is required")
	}
	return cfg, nil
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `gob test ./internal/config/`
Expected: PASS (ok ... config).

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend
git add backend/internal/config
git commit -m "feat(ws1): config loader with env defaults + required JWT secret"
```

---

## Task 3: Protocol envelope + UUIDv7 message IDs

**Files:**
- Create: `backend/internal/protocol/envelope.go`, `backend/internal/protocol/envelope_test.go`
- Adds deps: `github.com/google/uuid`

- [ ] **Step 1: Write the failing test**

`backend/internal/protocol/envelope_test.go`:

```go
package protocol

import (
	"encoding/json"
	"testing"
)

func TestEnvelopeRoundTrip(t *testing.T) {
	in := Envelope{
		Type: TypeMessageSend,
		ID:   "01890000-0000-7000-8000-000000000000",
		TS:   "2026-06-08T00:00:00Z",
		Data: json.RawMessage(`{"convId":"c1","clientMsgId":"m1","type":"text","body":"hi"}`),
	}
	raw, err := json.Marshal(in)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var out Envelope
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if out.Type != TypeMessageSend || out.ID != in.ID {
		t.Errorf("round trip mismatch: %+v", out)
	}
}

func TestDecodeSendPayload(t *testing.T) {
	data := json.RawMessage(`{"convId":"c1","clientMsgId":"m1","type":"text","body":"hi"}`)
	var p SendPayload
	if err := json.Unmarshal(data, &p); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if p.ConvID != "c1" || p.ClientMsgID != "m1" || p.Body != "hi" {
		t.Errorf("bad payload: %+v", p)
	}
}

func TestNewMsgIDIsTimeOrdered(t *testing.T) {
	a := NewMsgID()
	b := NewMsgID()
	if a == "" || b == "" {
		t.Fatal("empty id")
	}
	if a >= b {
		t.Errorf("UUIDv7 not lexically time-ordered: a=%s b=%s", a, b)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `gob test ./internal/protocol/`
Expected: FAIL — undefined `Envelope`, `TypeMessageSend`, `SendPayload`, `NewMsgID`.

- [ ] **Step 3: Implement `envelope.go`**

`backend/internal/protocol/envelope.go`:

```go
// Package protocol defines the WebSocket message envelope exchanged between
// clients and the messaging service. It has no infrastructure dependencies and
// is the contract the frontend codes against.
package protocol

import (
	"encoding/json"

	"github.com/google/uuid"
)

// Envelope is the single shape used in both directions over the WebSocket.
type Envelope struct {
	Type string          `json:"type"`
	ID   string          `json:"id"`
	TS   string          `json:"ts"`
	Data json.RawMessage `json:"data,omitempty"`
}

// Client -> server message types.
const (
	TypeMessageSend = "message.send"
	TypeTypingStart = "typing.start"
	TypeTypingStop  = "typing.stop"
	TypeReadUpto    = "read.upto"
)

// Server -> client message types.
const (
	TypeMessageAck     = "message.ack"
	TypeMessageNew     = "message.new"
	TypeReceiptUpdate  = "receipt.update"
	TypeTypingIndicator = "typing.indicator"
	TypePresenceChanged = "presence.changed"
	TypeError          = "error"
)

// SendPayload is the data of a message.send envelope. Exactly one of ConvID or
// ChannelID is set.
type SendPayload struct {
	ConvID      string `json:"convId,omitempty"`
	ChannelID   string `json:"channelId,omitempty"`
	ClientMsgID string `json:"clientMsgId"`
	Type        string `json:"type"`
	Body        string `json:"body"`
}

// ReadUptoPayload advances a read cursor.
type ReadUptoPayload struct {
	ConvID    string `json:"convId,omitempty"`
	ChannelID string `json:"channelId,omitempty"`
	MsgID     string `json:"msgId"`
}

// NewMsgID returns a UUIDv7 string. UUIDv7 is time-ordered, so lexical sort
// equals chronological order — used for message IDs and keyset pagination.
func NewMsgID() string {
	return uuid.Must(uuid.NewV7()).String()
}
```

- [ ] **Step 4: Tidy deps and run tests**

```bash
gob mod tidy
gob test ./internal/protocol/
```
Expected: `go.mod`/`go.sum` gain `github.com/google/uuid`; test PASS.

Note: if `TestNewMsgIDIsTimeOrdered` ever flakes (two IDs in the same 1ms tick can
tie), it is acceptable because UUIDv7 adds a monotonic counter within a tick in
google/uuid ≥ v1.6; ensure that version. If it ties, re-run `gob mod tidy` to pull
the latest and re-test.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend
git add backend/internal/protocol backend/go.mod backend/go.sum
git commit -m "feat(ws1): WS protocol envelope + UUIDv7 message ids"
```

---

## Task 4: Domain models + store interfaces + Router interface

**Files:**
- Create: `backend/internal/store/store.go`

- [ ] **Step 1: Write the failing test**

`backend/internal/store/store_test.go`:

```go
package store

import "testing"

// Compile-time + basic sanity that the domain types and sentinel exist.
func TestErrNotFoundMessage(t *testing.T) {
	if ErrNotFound == nil || ErrNotFound.Error() == "" {
		t.Fatal("ErrNotFound must be a non-empty error")
	}
}

func TestMessageZeroValue(t *testing.T) {
	var m Message
	if m.ID != "" || m.Body != "" {
		t.Fatal("unexpected non-zero default")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `gob test ./internal/store/`
Expected: FAIL — undefined `ErrNotFound`, `Message`.

- [ ] **Step 3: Implement `store.go`**

`backend/internal/store/store.go`:

```go
// Package store defines domain models and persistence interfaces for the
// messaging service. Services depend on these interfaces, not concrete DBs.
package store

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound is returned by stores when a row does not exist.
var ErrNotFound = errors.New("not found")

// User is the minimal identity record, upserted from JWT claims on first connect.
type User struct {
	ID          string
	DisplayName string
	AvatarURL   string
	Role        string
	CreatedAt   time.Time
}

// Message is a DM or channel message. Exactly one of ConversationID / ChannelID
// is set. Body is opaque (plaintext in Phase 1, ciphertext when E2EE lands).
type Message struct {
	ID             string
	ConversationID string // empty for channel messages
	ChannelID      string // empty for DM messages
	SenderID       string
	Type           string
	Body           string
	CreatedAt      time.Time
}

// ReceiptState enumerates per-recipient DM delivery states.
type ReceiptState string

const (
	ReceiptSent      ReceiptState = "sent"
	ReceiptDelivered ReceiptState = "delivered"
	ReceiptRead      ReceiptState = "read"
)

// Conversation is a 1:1 DM (exactly two participants in Phase 1).
type Conversation struct {
	ID        string
	CreatedAt time.Time
}

// UserStore upserts and reads users.
type UserStore interface {
	Upsert(ctx context.Context, u User) error
	Get(ctx context.Context, id string) (User, error)
}

// ConversationStore manages 1:1 conversations and read cursors.
type ConversationStore interface {
	// GetOrCreateDM returns the existing conversation between the two users or
	// creates one. The returned bool is true if newly created.
	GetOrCreateDM(ctx context.Context, userA, userB string) (Conversation, bool, error)
	// Participants returns the user IDs in a conversation.
	Participants(ctx context.Context, convID string) ([]string, error)
	// IsParticipant reports whether userID belongs to convID.
	IsParticipant(ctx context.Context, convID, userID string) (bool, error)
	// ListForUser returns conversation IDs the user participates in.
	ListForUser(ctx context.Context, userID string) ([]string, error)
	// SetReadCursor advances last_read_msg_id for a participant.
	SetReadCursor(ctx context.Context, convID, userID, msgID string) error
}

// MessageStore persists and reads messages and DM receipts.
type MessageStore interface {
	// InsertDM stores a DM message (carrying its clientMsgID for dedup) and
	// creates a 'sent' receipt for recipientID, atomically. clientMsgID may be "".
	InsertDM(ctx context.Context, m Message, recipientID, clientMsgID string) error
	// SetReceipt upserts the receipt state for (msgID, userID).
	SetReceipt(ctx context.Context, msgID, userID string, state ReceiptState) error
	// MessagesByConversation returns up to limit messages with id < before
	// (before == "" means latest), ordered by id DESC.
	MessagesByConversation(ctx context.Context, convID, before string, limit int) ([]Message, error)
	// ExistsByClientMsgID reports whether a message from senderID in convID with
	// the given clientMsgID already exists (idempotency/dedup).
	ExistsByClientMsgID(ctx context.Context, convID, senderID, clientMsgID string) (string, bool, error)
}

// Router delivers a server->client envelope to a user's live connections.
// Implemented by the hub in Plan 2; the messaging service depends only on this.
type Router interface {
	// RouteToUser delivers data to all of userID's connections (local + remote).
	// Returns true if at least one local connection received it.
	RouteToUser(ctx context.Context, userID string, env protocol.Envelope) (bool, error)
}
```

NOTE: this references `protocol.Envelope`. Add the import:
```go
import (
	"context"
	"errors"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `gob test ./internal/store/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend
git add backend/internal/store/store.go backend/internal/store/store_test.go
git commit -m "feat(ws1): domain models + store/Router interfaces"
```

---

## Task 5: ClientMsgID storage decision + dedup column

The spec dedups by `clientMsgId`. The schema in the spec does not store it. Fix:
add a nullable `client_msg_id` column to `messages` and a partial unique index.
This task only writes the migration (used by Postgres impl in Task 7-8).

**Files:**
- Create: `backend/internal/store/migrations/0001_init.sql`

- [ ] **Step 1: Write the migration (full Phase-1 schema + client_msg_id)**

`backend/internal/store/migrations/0001_init.sql`:

```sql
-- Phase 1 messaging schema. Body columns are opaque text (E2EE-ready).

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  role         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id  UUID NOT NULL REFERENCES conversations(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  last_read_msg_id UUID,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS channels (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'hangout',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id       UUID NOT NULL REFERENCES channels(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  last_read_msg_id UUID,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  channel_id      UUID REFERENCES channels(id),
  sender_id       UUID NOT NULL REFERENCES users(id),
  client_msg_id   TEXT,
  type            TEXT NOT NULL DEFAULT 'text',
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((conversation_id IS NULL) <> (channel_id IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_messages_channel      ON messages (channel_id, id);
-- dedup: a sender cannot create two messages with the same clientMsgId in a convo
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_client
  ON messages (conversation_id, sender_id, client_msg_id)
  WHERE client_msg_id IS NOT NULL AND conversation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_receipts (
  message_id UUID NOT NULL REFERENCES messages(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  state      TEXT NOT NULL DEFAULT 'sent',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id         UUID PRIMARY KEY,
  author_id  UUID NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL DEFAULT 'update',
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID NOT NULL REFERENCES posts(id),
  user_id UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID PRIMARY KEY,
  post_id    UUID NOT NULL REFERENCES posts(id),
  author_id  UUID NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Validate the SQL against a throwaway Postgres**

```bash
docker run -d --name pg_ddl_check -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine
sleep 6
PGPASSWORD=postgres psql -h localhost -p 55432 -U postgres -v ON_ERROR_STOP=1 \
  -f /home/faithsax/new-frontend/backend/internal/store/migrations/0001_init.sql
echo "exit=$?"
docker rm -f pg_ddl_check
```
Expected: all statements succeed, `exit=0`. (If `postgres:16-alpine` isn't cached, this pulls it; network required.)

- [ ] **Step 3: Commit**

```bash
cd /home/faithsax/new-frontend
git add backend/internal/store/migrations/0001_init.sql
git commit -m "feat(ws1): phase-1 postgres schema + clientMsgId dedup index"
```

---

## Task 6: In-memory store fakes

**Files:**
- Create: `backend/internal/store/fakes.go`

These fakes implement the interfaces for unit-testing the messaging service
without Postgres. Kept in the (non-test) `store` package so the messaging package
can import them in its tests.

- [ ] **Step 1: Write the failing test**

`backend/internal/store/fakes_test.go`:

```go
package store

import (
	"context"
	"testing"
)

func TestFakeConversationGetOrCreateDMStable(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	c1, created1, err := f.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	if err != nil || !created1 {
		t.Fatalf("first create: created=%v err=%v", created1, err)
	}
	c2, created2, _ := f.Conversations.GetOrCreateDM(ctx, "u2", "u1") // order-insensitive
	if created2 {
		t.Error("second call should not create")
	}
	if c1.ID != c2.ID {
		t.Errorf("ids differ: %s vs %s", c1.ID, c2.ID)
	}
}

func TestFakeInsertDMAndQuery(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	c, _, _ := f.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	m := Message{ID: "01890000-0000-7000-8000-000000000001", ConversationID: c.ID, SenderID: "u1", Type: "text", Body: "hi"}
	if err := f.Messages.InsertDM(ctx, m, "u2", "client-1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, err := f.Messages.MessagesByConversation(ctx, c.ID, "", 10)
	if err != nil || len(got) != 1 || got[0].Body != "hi" {
		t.Fatalf("query: got=%v err=%v", got, err)
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `gob test ./internal/store/`
Expected: FAIL — undefined `NewFakeStores`.

- [ ] **Step 3: Implement `fakes.go`**

`backend/internal/store/fakes.go`:

```go
package store

import (
	"context"
	"sort"
	"sync"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

// FakeStores bundles in-memory implementations for unit tests.
type FakeStores struct {
	Users         *FakeUserStore
	Conversations *FakeConversationStore
	Messages      *FakeMessageStore
}

func NewFakeStores() *FakeStores {
	return &FakeStores{
		Users:         &FakeUserStore{m: map[string]User{}},
		Conversations: &FakeConversationStore{convos: map[string][2]string{}, cursors: map[string]string{}},
		Messages:      &FakeMessageStore{byConv: map[string][]Message{}, receipts: map[string]ReceiptState{}, clientIDs: map[string]string{}},
	}
}

type FakeUserStore struct {
	mu sync.Mutex
	m  map[string]User
}

func (s *FakeUserStore) Upsert(_ context.Context, u User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[u.ID] = u
	return nil
}
func (s *FakeUserStore) Get(_ context.Context, id string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.m[id]
	if !ok {
		return User{}, ErrNotFound
	}
	return u, nil
}

type FakeConversationStore struct {
	mu      sync.Mutex
	convos  map[string][2]string // convID -> sorted pair
	cursors map[string]string    // convID|userID -> msgID
	seq     int
}

func pairKey(a, b string) (string, string) {
	if a < b {
		return a, b
	}
	return b, a
}

func (s *FakeConversationStore) GetOrCreateDM(_ context.Context, a, b string) (Conversation, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	lo, hi := pairKey(a, b)
	for id, p := range s.convos {
		if p[0] == lo && p[1] == hi {
			return Conversation{ID: id}, false, nil
		}
	}
	s.seq++
	id := "conv-" + string(rune('a'+s.seq))
	s.convos[id] = [2]string{lo, hi}
	return Conversation{ID: id}, true, nil
}
func (s *FakeConversationStore) Participants(_ context.Context, convID string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.convos[convID]
	if !ok {
		return nil, ErrNotFound
	}
	return []string{p[0], p[1]}, nil
}
func (s *FakeConversationStore) IsParticipant(_ context.Context, convID, userID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.convos[convID]
	if !ok {
		return false, nil
	}
	return p[0] == userID || p[1] == userID, nil
}
func (s *FakeConversationStore) ListForUser(_ context.Context, userID string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []string
	for id, p := range s.convos {
		if p[0] == userID || p[1] == userID {
			out = append(out, id)
		}
	}
	sort.Strings(out)
	return out, nil
}
func (s *FakeConversationStore) SetReadCursor(_ context.Context, convID, userID, msgID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cursors[convID+"|"+userID] = msgID
	return nil
}

type FakeMessageStore struct {
	mu        sync.Mutex
	byConv    map[string][]Message
	receipts  map[string]ReceiptState // msgID|userID -> state
	clientIDs map[string]string       // convID|sender|clientMsgID -> msgID
}

func (s *FakeMessageStore) InsertDM(_ context.Context, m Message, recipientID, clientMsgID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.byConv[m.ConversationID] = append(s.byConv[m.ConversationID], m)
	s.receipts[m.ID+"|"+recipientID] = ReceiptSent
	if clientMsgID != "" {
		s.clientIDs[m.ConversationID+"|"+m.SenderID+"|"+clientMsgID] = m.ID
	}
	return nil
}
func (s *FakeMessageStore) SetReceipt(_ context.Context, msgID, userID string, st ReceiptState) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.receipts[msgID+"|"+userID] = st
	return nil
}
func (s *FakeMessageStore) MessagesByConversation(_ context.Context, convID, before string, limit int) ([]Message, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	all := s.byConv[convID]
	// return newest-first, applying before (id < before) filter
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
func (s *FakeMessageStore) ExistsByClientMsgID(_ context.Context, convID, senderID, clientMsgID string) (string, bool, error) {
	if clientMsgID == "" {
		return "", false, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if id, ok := s.clientIDs[convID+"|"+senderID+"|"+clientMsgID]; ok {
		return id, true, nil
	}
	return "", false, nil
}

// FakeRouter records routed envelopes per user for assertions.
type FakeRouter struct {
	mu   sync.Mutex
	Sent map[string][]protocol.Envelope
	// LocalUsers are considered "connected locally"; RouteToUser returns true for them.
	LocalUsers map[string]bool
}

func NewFakeRouter() *FakeRouter {
	return &FakeRouter{Sent: map[string][]protocol.Envelope{}, LocalUsers: map[string]bool{}}
}
func (r *FakeRouter) RouteToUser(_ context.Context, userID string, env protocol.Envelope) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Sent[userID] = append(r.Sent[userID], env)
	return r.LocalUsers[userID], nil
}
```

- [ ] **Step 4: Run tests**

Run: `gob test ./internal/store/`
Expected: PASS (both fakes_test and store_test).

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend
git add backend/internal/store
git commit -m "feat(ws1): in-memory store + router fakes for unit tests"
```

---

## Task 7: Messaging service — SendDM (persist-before-ACK) + receipts + read

**Files:**
- Create: `backend/internal/messaging/service.go`, `backend/internal/messaging/service_test.go`

- [ ] **Step 1: Write the failing test**

`backend/internal/messaging/service_test.go`:

```go
package messaging

import (
	"context"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newSvc() (*Service, *store.FakeStores, *store.FakeRouter) {
	st := store.NewFakeStores()
	rt := store.NewFakeRouter()
	return New(st.Conversations, st.Messages, rt), st, rt
}

func TestSendDMPersistsThenAcksThenRoutes(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	rt.LocalUsers["u2"] = true // recipient online here

	res, err := svc.SendDM(ctx, "u1", protocol.SendPayload{
		ConvID: c.ID, ClientMsgID: "m1", Type: "text", Body: "hello",
	})
	if err != nil {
		t.Fatalf("SendDM: %v", err)
	}
	// persisted
	msgs, _ := st.Messages.MessagesByConversation(ctx, c.ID, "", 10)
	if len(msgs) != 1 || msgs[0].Body != "hello" {
		t.Fatalf("not persisted: %v", msgs)
	}
	// ack carries server msgId + clientMsgId
	if res.MsgID != msgs[0].ID || res.ClientMsgID != "m1" {
		t.Errorf("bad ack: %+v", res)
	}
	// recipient got message.new
	if got := rt.Sent["u2"]; len(got) == 0 || got[0].Type != protocol.TypeMessageNew {
		t.Errorf("recipient not routed message.new: %v", got)
	}
	// because recipient online locally, a delivered receipt routed back to sender
	senderEnv := rt.Sent["u1"]
	if len(senderEnv) == 0 || senderEnv[len(senderEnv)-1].Type != protocol.TypeReceiptUpdate {
		t.Errorf("sender did not get delivered receipt: %v", senderEnv)
	}
}

func TestSendDMRejectsNonParticipant(t *testing.T) {
	svc, st, _ := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	if _, err := svc.SendDM(ctx, "u3", protocol.SendPayload{ConvID: c.ID, ClientMsgID: "x", Body: "hi"}); err == nil {
		t.Fatal("expected rejection for non-participant")
	}
}

func TestSendDMDedupByClientMsgID(t *testing.T) {
	svc, st, _ := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	p := protocol.SendPayload{ConvID: c.ID, ClientMsgID: "dup", Body: "once"}
	r1, _ := svc.SendDM(ctx, "u1", p)
	r2, _ := svc.SendDM(ctx, "u1", p)
	if r1.MsgID != r2.MsgID {
		t.Errorf("dedup failed: %s vs %s", r1.MsgID, r2.MsgID)
	}
	msgs, _ := st.Messages.MessagesByConversation(ctx, c.ID, "", 10)
	if len(msgs) != 1 {
		t.Errorf("dedup should not double-insert, got %d", len(msgs))
	}
}

func TestMarkReadSetsCursorAndReceipt(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	res, _ := svc.SendDM(ctx, "u1", protocol.SendPayload{ConvID: c.ID, ClientMsgID: "m1", Body: "hi"})
	rt.Sent["u1"] = nil // clear
	if err := svc.MarkRead(ctx, "u2", protocol.ReadUptoPayload{ConvID: c.ID, MsgID: res.MsgID}); err != nil {
		t.Fatalf("MarkRead: %v", err)
	}
	// sender gets a read receipt
	got := rt.Sent["u1"]
	if len(got) == 0 || got[len(got)-1].Type != protocol.TypeReceiptUpdate {
		t.Errorf("no read receipt to sender: %v", got)
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `gob test ./internal/messaging/`
Expected: FAIL — undefined `New`, `Service`, `SendDM`, `MarkRead`.

- [ ] **Step 3: Implement `service.go`**

`backend/internal/messaging/service.go`:

```go
// Package messaging orchestrates direct-message send/deliver/receipt logic.
// It persists before acknowledging (durability), then routes delivery via the
// Router. It has no transport knowledge.
package messaging

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

// ErrNotParticipant is returned when a sender is not part of the conversation.
var ErrNotParticipant = errors.New("not a participant")

// Service handles DM messaging.
type Service struct {
	convos store.ConversationStore
	msgs   store.MessageStore
	router store.Router
	now    func() time.Time
}

// New constructs a messaging Service.
func New(c store.ConversationStore, m store.MessageStore, r store.Router) *Service {
	return &Service{convos: c, msgs: m, router: r, now: time.Now}
}

// AckResult is returned to the sender after a durable write.
type AckResult struct {
	ClientMsgID string
	MsgID       string
	TS          string
}

// SendDM validates membership, persists the message (and a 'sent' receipt for the
// recipient) BEFORE returning the ack, then routes message.new to the recipient
// and a delivered receipt back to the sender if the recipient is connected.
// Idempotent on (convID, sender, clientMsgID).
func (s *Service) SendDM(ctx context.Context, senderID string, p protocol.SendPayload) (AckResult, error) {
	if p.ConvID == "" {
		return AckResult{}, errors.New("convId required")
	}
	ok, err := s.convos.IsParticipant(ctx, p.ConvID, senderID)
	if err != nil {
		return AckResult{}, err
	}
	if !ok {
		return AckResult{}, ErrNotParticipant
	}

	// dedup
	if p.ClientMsgID != "" {
		if existingID, found, err := s.msgs.ExistsByClientMsgID(ctx, p.ConvID, senderID, p.ClientMsgID); err != nil {
			return AckResult{}, err
		} else if found {
			return AckResult{ClientMsgID: p.ClientMsgID, MsgID: existingID, TS: s.now().UTC().Format(time.RFC3339)}, nil
		}
	}

	parts, err := s.convos.Participants(ctx, p.ConvID)
	if err != nil {
		return AckResult{}, err
	}
	recipientID := ""
	for _, u := range parts {
		if u != senderID {
			recipientID = u
		}
	}
	if recipientID == "" {
		return AckResult{}, errors.New("no recipient in conversation")
	}

	msgType := p.Type
	if msgType == "" {
		msgType = "text"
	}
	m := store.Message{
		ID:             protocol.NewMsgID(),
		ConversationID: p.ConvID,
		SenderID:       senderID,
		Type:           msgType,
		Body:           p.Body,
		CreatedAt:      s.now().UTC(),
	}
	// PERSIST BEFORE ACK
	if err := s.msgs.InsertDM(ctx, m, recipientID, p.ClientMsgID); err != nil {
		return AckResult{}, fmt.Errorf("persist: %w", err)
	}
	ack := AckResult{ClientMsgID: p.ClientMsgID, MsgID: m.ID, TS: m.CreatedAt.Format(time.RFC3339)}

	// route message.new to recipient
	newEnv := mustEnvelope(protocol.TypeMessageNew, map[string]any{
		"id": m.ID, "convId": m.ConversationID, "senderId": senderID,
		"type": m.Type, "body": m.Body, "ts": ack.TS,
	})
	delivered, err := s.router.RouteToUser(ctx, recipientID, newEnv)
	if err != nil {
		return ack, nil // ack already valid; delivery is best-effort
	}
	if delivered {
		_ = s.msgs.SetReceipt(ctx, m.ID, recipientID, store.ReceiptDelivered)
		recEnv := mustEnvelope(protocol.TypeReceiptUpdate, map[string]any{
			"msgId": m.ID, "userId": recipientID, "state": string(store.ReceiptDelivered),
		})
		_, _ = s.router.RouteToUser(ctx, senderID, recEnv)
	}
	return ack, nil
}

// MarkRead advances the reader's cursor and notifies the original sender(s) with
// a read receipt.
func (s *Service) MarkRead(ctx context.Context, readerID string, p protocol.ReadUptoPayload) error {
	if p.ConvID == "" || p.MsgID == "" {
		return errors.New("convId and msgId required")
	}
	ok, err := s.convos.IsParticipant(ctx, p.ConvID, readerID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrNotParticipant
	}
	if err := s.convos.SetReadCursor(ctx, p.ConvID, readerID, p.MsgID); err != nil {
		return err
	}
	_ = s.msgs.SetReceipt(ctx, p.MsgID, readerID, store.ReceiptRead)
	parts, err := s.convos.Participants(ctx, p.ConvID)
	if err != nil {
		return err
	}
	recEnv := mustEnvelope(protocol.TypeReceiptUpdate, map[string]any{
		"msgId": p.MsgID, "userId": readerID, "state": string(store.ReceiptRead),
	})
	for _, u := range parts {
		if u != readerID {
			_, _ = s.router.RouteToUser(ctx, u, recEnv)
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

Run: `gob test ./internal/messaging/`
Expected: PASS (all four tests).

- [ ] **Step 5: Run the whole unit suite**

Run: `gob test ./...`
Expected: all packages PASS (config, protocol, store, messaging). No integration tag yet.

- [ ] **Step 6: Commit**

```bash
cd /home/faithsax/new-frontend
git add backend/internal/messaging
git commit -m "feat(ws1): DM messaging service — persist-before-ACK, receipts, read cursor"
```

---

## Task 8: Postgres store implementation + integration test

**Files:**
- Create: `backend/internal/store/postgres/postgres.go`, `conversations.go`, `messages.go`, `users.go`, `postgres_test.go`
- Adds deps: `github.com/jackc/pgx/v5`

- [ ] **Step 1: Write the integration test (build-tagged)**

`backend/internal/store/postgres/postgres_test.go`:

```go
//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func testDSN() string {
	if v := os.Getenv("TEST_DATABASE_URL"); v != "" {
		return v
	}
	return "postgres://postgres:postgres@localhost:55432/postgres?sslmode=disable"
}

func setup(t *testing.T) *Store {
	t.Helper()
	st, err := Open(context.Background(), testDSN())
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := st.Migrate(context.Background(), "../migrations/0001_init.sql"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

func TestPostgresDMRoundTrip(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	// users must exist (FK)
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "A"})
	_ = st.Users.Upsert(ctx, store.User{ID: uuidB, DisplayName: "B"})
	c, created, err := st.Conversations.GetOrCreateDM(ctx, uuidA, uuidB)
	if err != nil || !created {
		t.Fatalf("create dm: created=%v err=%v", created, err)
	}
	m := store.Message{ID: protocol.NewMsgID(), ConversationID: c.ID, SenderID: uuidA, Type: "text", Body: "hi"}
	if err := st.Messages.InsertDM(ctx, m, uuidB, "client-1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	// dedup
	id, found, err := st.Messages.ExistsByClientMsgID(ctx, c.ID, uuidA, "client-1")
	if err != nil || !found || id != m.ID {
		t.Fatalf("dedup lookup: id=%s found=%v err=%v", id, found, err)
	}
	got, err := st.Messages.MessagesByConversation(ctx, c.ID, "", 10)
	if err != nil || len(got) != 1 || got[0].Body != "hi" {
		t.Fatalf("query: %v err=%v", got, err)
	}
}

const (
	uuidA = "01890000-0000-7000-8000-0000000000aa"
	uuidB = "01890000-0000-7000-8000-0000000000bb"
)
```

- [ ] **Step 2: Implement the Postgres store**

`backend/internal/store/postgres/postgres.go`:

```go
// Package postgres implements the store interfaces over PostgreSQL via pgx.
package postgres

import (
	"context"
	"errors"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

// Store aggregates the per-entity stores over one pool.
type Store struct {
	pool          *pgxpool.Pool
	Users         *UserStore
	Conversations *ConversationStore
	Messages      *MessageStore
}

// Open connects a pgx pool and wires the sub-stores.
func Open(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	s := &Store{pool: pool}
	s.Users = &UserStore{pool: pool}
	s.Conversations = &ConversationStore{pool: pool}
	s.Messages = &MessageStore{pool: pool}
	return s, nil
}

func (s *Store) Close() { s.pool.Close() }

// Migrate applies a SQL file (idempotent DDL).
func (s *Store) Migrate(ctx context.Context, path string) error {
	sql, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, string(sql))
	return err
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return store.ErrNotFound
	}
	return err
}
```

`backend/internal/store/postgres/users.go`:

```go
package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type UserStore struct{ pool *pgxpool.Pool }

func (s *UserStore) Upsert(ctx context.Context, u store.User) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (id, display_name, avatar_url, role)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (id) DO UPDATE SET display_name=EXCLUDED.display_name,
		  avatar_url=EXCLUDED.avatar_url, role=EXCLUDED.role`,
		u.ID, u.DisplayName, u.AvatarURL, u.Role)
	return err
}

func (s *UserStore) Get(ctx context.Context, id string) (store.User, error) {
	var u store.User
	err := s.pool.QueryRow(ctx, `SELECT id, display_name, COALESCE(avatar_url,''), COALESCE(role,''), created_at FROM users WHERE id=$1`, id).
		Scan(&u.ID, &u.DisplayName, &u.AvatarURL, &u.Role, &u.CreatedAt)
	if err != nil {
		return store.User{}, notFound(err)
	}
	return u, nil
}
```

`backend/internal/store/postgres/conversations.go`:

```go
package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type ConversationStore struct{ pool *pgxpool.Pool }

// GetOrCreateDM finds the 1:1 conversation that has exactly userA and userB as
// participants, or creates it. Uses a transaction for create.
func (s *ConversationStore) GetOrCreateDM(ctx context.Context, a, b string) (store.Conversation, bool, error) {
	var convID string
	err := s.pool.QueryRow(ctx, `
		SELECT cp.conversation_id
		FROM conversation_participants cp
		JOIN conversation_participants cp2 ON cp.conversation_id = cp2.conversation_id
		WHERE cp.user_id=$1 AND cp2.user_id=$2
		GROUP BY cp.conversation_id
		HAVING count(*) = 1
		LIMIT 1`, a, b).Scan(&convID)
	if err == nil {
		return store.Conversation{ID: convID}, false, nil
	}
	if err != pgx.ErrNoRows {
		return store.Conversation{}, false, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return store.Conversation{}, false, err
	}
	defer tx.Rollback(ctx)
	newID := uuid.Must(uuid.NewV7()).String()
	if _, err := tx.Exec(ctx, `INSERT INTO conversations (id) VALUES ($1)`, newID); err != nil {
		return store.Conversation{}, false, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)`, newID, a, b); err != nil {
		return store.Conversation{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return store.Conversation{}, false, err
	}
	return store.Conversation{ID: newID}, true, nil
}

func (s *ConversationStore) Participants(ctx context.Context, convID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT user_id FROM conversation_participants WHERE conversation_id=$1 ORDER BY user_id`, convID)
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
	if len(out) == 0 {
		return nil, store.ErrNotFound
	}
	return out, rows.Err()
}

func (s *ConversationStore) IsParticipant(ctx context.Context, convID, userID string) (bool, error) {
	var x int
	err := s.pool.QueryRow(ctx, `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2`, convID, userID).Scan(&x)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	return err == nil, err
}

func (s *ConversationStore) ListForUser(ctx context.Context, userID string) ([]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT conversation_id FROM conversation_participants WHERE user_id=$1`, userID)
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

func (s *ConversationStore) SetReadCursor(ctx context.Context, convID, userID, msgID string) error {
	_, err := s.pool.Exec(ctx, `UPDATE conversation_participants SET last_read_msg_id=$3 WHERE conversation_id=$1 AND user_id=$2`, convID, userID, msgID)
	return err
}
```

`backend/internal/store/postgres/messages.go`:

```go
package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

type MessageStore struct{ pool *pgxpool.Pool }

// InsertDM inserts the message and a 'sent' receipt for the recipient in one tx.
func (s *MessageStore) InsertDM(ctx context.Context, m store.Message, recipientID, clientMsgID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var cmid any
	if clientMsgID != "" {
		cmid = clientMsgID
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO messages (id, conversation_id, sender_id, client_msg_id, type, body, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		m.ID, m.ConversationID, m.SenderID, cmid, m.Type, m.Body, m.CreatedAt); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO message_receipts (message_id, user_id, state) VALUES ($1,$2,'sent')`, m.ID, recipientID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *MessageStore) SetReceipt(ctx context.Context, msgID, userID string, st store.ReceiptState) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO message_receipts (message_id, user_id, state, updated_at)
		VALUES ($1,$2,$3, now())
		ON CONFLICT (message_id, user_id) DO UPDATE SET state=EXCLUDED.state, updated_at=now()`,
		msgID, userID, string(st))
	return err
}

func (s *MessageStore) MessagesByConversation(ctx context.Context, convID, before string, limit int) ([]store.Message, error) {
	q := `SELECT id, conversation_id, sender_id, type, body, created_at
	      FROM messages WHERE conversation_id=$1`
	args := []any{convID}
	if before != "" {
		q += ` AND id < $2`
		args = append(args, before)
	}
	q += ` ORDER BY id DESC LIMIT ` + itoa(limit)
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Message
	for rows.Next() {
		var m store.Message
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.SenderID, &m.Type, &m.Body, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *MessageStore) ExistsByClientMsgID(ctx context.Context, convID, senderID, clientMsgID string) (string, bool, error) {
	if clientMsgID == "" {
		return "", false, nil
	}
	var id string
	err := s.pool.QueryRow(ctx, `SELECT id FROM messages WHERE conversation_id=$1 AND sender_id=$2 AND client_msg_id=$3`, convID, senderID, clientMsgID).Scan(&id)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

// itoa avoids importing strconv for a small bounded int.
func itoa(n int) string {
	if n <= 0 {
		return "50"
	}
	digits := ""
	for n > 0 {
		digits = string(rune('0'+n%10)) + digits
		n /= 10
	}
	return digits
}

```

(Step 3 adds compile-time interface assertions to `postgres.go`; do not add a dummy
`var _ = pgxpool.Pool{}` — the struct fields already reference pgxpool.)

- [ ] **Step 3: Add a compile-time interface assertion**

Append to `backend/internal/store/postgres/postgres.go` so the impl is verified to
satisfy the interfaces at build time:
```go
var (
	_ store.UserStore         = (*UserStore)(nil)
	_ store.ConversationStore = (*ConversationStore)(nil)
	_ store.MessageStore      = (*MessageStore)(nil)
)
```
(This replaces the placeholder `var _ = pgxpool.Pool{}` line from Step 2 — delete that line.)

- [ ] **Step 4: Verify build (no infra)**

Run: `gob build ./...`
Expected: compiles. `gob mod tidy` to pull pgx.

- [ ] **Step 5: Run unit suite (integration excluded by default)**

Run: `gob test ./...`
Expected: PASS; the postgres_test.go is skipped (no `integration` tag).

- [ ] **Step 6: Run the integration test against Dockerized Postgres**

```bash
cd /home/faithsax/new-frontend/backend
docker run -d --name pg_it -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine
sleep 6
docker run --rm --network host -v "$PWD":/app -w /app \
  -e TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres?sslmode=disable" \
  golang:1.23-alpine go test -tags=integration ./internal/store/postgres/
echo "exit=$?"
docker rm -f pg_it
```
Expected: `ok ... postgres`, `exit=0`. (`--network host` lets the go container reach the pg container's published port.)

- [ ] **Step 7: Commit**

```bash
cd /home/faithsax/new-frontend
git add backend/internal/store/postgres backend/go.mod backend/go.sum
git commit -m "feat(ws1): postgres store impl + integration test (DM round trip + dedup)"
```

---

## Task 9: Final verification for Plan 1

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite green**

Run: `cd /home/faithsax/new-frontend/backend && gob test ./...`
Expected: all packages `ok`.

- [ ] **Step 2: Vet**

Run: `gob vet ./...`
Expected: no findings.

- [ ] **Step 3: Confirm Express skeleton fully gone**

Run: `ls /home/faithsax/new-frontend/backend` — expect `go.mod go.sum internal .gitignore` (no `package.json`, `src/`).

- [ ] **Step 4: Confirm branch + history**

Run: `cd /home/faithsax/new-frontend && git branch --show-current` → `feat/messaging-phase1`
Run: `git log --oneline origin/main..HEAD` → shows the Plan-1 commits.

Do NOT push or open a PR yet — Plans 2 and 3 build on this branch; we push/PR after the phase (or as the controller directs).

---

## Self-Review (completed by plan author)

- **Spec coverage (Plan-1 portion):** Go module replacing Express → Task 1; config → Task 2; protocol envelope + UUIDv7 → Task 3; domain models + store/Router interfaces → Task 4; Postgres schema (full, + clientMsgId dedup the spec required but omitted from DDL) → Task 5; fakes → Task 6; messaging service persist-before-ACK + receipts + read cursor + dedup → Task 7; Postgres impl + integration test → Task 8; verification → Task 9. Transport/WS/HTTP/hub/presence/feed/channels/frontend are explicitly Plan 2/3, not gaps.
- **Placeholder scan:** none — all code shown in full; commands have expected output. Two inline NOTES (InsertDM arity; dummy var) are resolution instructions, not placeholders — the executor must apply the 4-arg InsertDM signature consistently across store.go, fakes.go, postgres messages.go, and messaging service.go.
- **Type consistency:** `InsertDM(ctx, Message, recipientID, clientMsgID string)` is the canonical signature (Task 4 interface, Task 6 fake, Task 7 caller, Task 8 impl). `Router.RouteToUser(ctx, userID, Envelope) (bool, error)` consistent (Task 4 iface, Task 6 fake, Task 7 caller). `AckResult{ClientMsgID,MsgID,TS}`, `SendPayload`, `ReadUptoPayload` consistent across protocol + messaging. Envelope type constants used in service match those defined in protocol.
- **Known executor caution:** Task 6's fake originally referenced a non-existent `m.clientMsgID`; the NOTE corrects this by routing clientMsgID through InsertDM and a side-map in the fake. Spec/code reviewers must confirm the fake compiles and dedup is exercised by `TestSendDMDedupByClientMsgID`.
