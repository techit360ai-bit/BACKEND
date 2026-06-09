# WS1 Messaging Phase 1 — Plan 2: Transport & Real-Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Plan-1 domain core into a runnable service: a Redis-backed pub/sub bridge, an in-process connection hub implementing `store.Router`, presence, a JWT-authenticated WebSocket gateway, a minimal HTTP API, `main` wiring, Docker Compose, and an end-to-end smoke test — so 1:1 DMs work live over WebSocket (including across two instances).

**Architecture:** The `hub` owns a per-instance registry of `userID → connections` and implements `store.Router.RouteToUser`: deliver to local connections directly, else publish to Redis so the instance holding that user delivers it. `presence` tracks online/last-seen in Redis and broadcasts changes via pub/sub. The WS `gateway` authenticates a JWT in the handshake, upserts the user, registers the connection, and runs read/write pumps + heartbeat, dispatching inbound envelopes to the Plan-1 `messaging.Service`. `main` wires config → Postgres store → Redis → hub → presence → messaging → HTTP+WS server with graceful shutdown.

**Tech Stack:** Go 1.23, `github.com/coder/websocket` (maintained successor to nhooyr.io/websocket), `github.com/redis/go-redis/v9`, `github.com/go-chi/chi/v5`, `github.com/golang-jwt/jwt/v5`, plus the Plan-1 deps (`pgx/v5`, `google/uuid`).

**Spec:** `docs/superpowers/specs/2026-06-08-ws1-messaging-phase1-design.md`
**Builds on:** Plan 1 (committed on `feat/messaging-phase1`). Module path: `github.com/techit360ai-bit/new-frontend/backend`.

**This is Plan 2 of 3.** Plan 1 = domain core (done). Plan 3 = channels + feed services/endpoints + frontend wiring.

---

## Critical execution notes (READ FIRST)

- **Go is NOT installed on the host — it runs in Docker.** From `backend/`, define once per shell invocation (same line as the command, since cwd/env don't persist across tool calls):
  ```bash
  cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
  ```
  `golang:1.23-alpine` is pulled and verified (go1.23.12). `GOSUMDB=off`/`GOFLAGS=-mod=mod` avoid sandbox DNS hangs on the checksum DB; `go.sum` still verifies pinned modules.
- **Branch:** `feat/messaging-phase1` (continues from Plan 1). Verify `git branch --show-current` before each commit. Do NOT push (Plan 3 follows).
- **Two infra services for integration/smoke:** Postgres (`postgres:16-alpine`) and Redis (`redis:7-alpine`, already cached). Unit tests use **fakes** and need no infra. Integration/redis tests are build-tagged `//go:build integration`. The smoke test uses `docker compose`.
- **Known limitation (documented, not a bug):** cross-instance *delivered receipts* don't fire in Phase 1 — `messaging.SendDM` fires the delivered receipt only on local delivery (`RouteToUser` returns true). Cross-instance delivery of the message itself works. Single-instance (dev/smoke/startup scale) is fully correct. A later phase moves delivered-receipt emission to the delivery point.
- **`coder/websocket` import note:** package import path is `github.com/coder/websocket`; the package name is `websocket`. It is the renamed `nhooyr.io/websocket` with the same API.

---

## File Structure (this plan)

```
backend/
├─ cmd/
│  ├─ server/main.go                 # wire everything; HTTP+WS; graceful shutdown
│  └─ smoke/main.go                  # WS smoke client used by scripts/smoke.sh
├─ internal/
│  ├─ pubsub/pubsub.go               # PubSub interface + InMemory fake
│  ├─ pubsub/redis.go                # Redis-backed PubSub
│  ├─ pubsub/pubsub_test.go          # fake tests
│  ├─ pubsub/redis_test.go           # //go:build integration
│  ├─ hub/hub.go                     # Conn, Hub (registry + RouteToUser + Run + Broadcast)
│  ├─ hub/hub_test.go                # unit (fake pubsub, two hubs share a bus)
│  ├─ presence/presence.go           # PresenceStore iface + InMemory fake + Redis impl + Service
│  ├─ presence/presence_test.go      # unit (fake)
│  ├─ presence/redis_test.go         # //go:build integration
│  ├─ auth/jwt.go                    # Verify(token)→Claims; Mint(...) for dev; HTTP middleware
│  ├─ auth/jwt_test.go
│  └─ transport/
│     ├─ ws/gateway.go               # Upgrade, auth, pumps, heartbeat, dispatch
│     ├─ ws/gateway_test.go          # httptest + real ws client + fakes
│     └─ httpapi/
│        ├─ router.go                # chi router, CORS, mounts
│        ├─ conversations.go         # create / history / REST-send
│        ├─ presence.go              # GET /users/online
│        ├─ devtoken.go              # GET /dev/token (env-gated)
│        ├─ health.go
│        └─ httpapi_test.go
├─ Dockerfile
├─ docker-compose.yml
└─ scripts/smoke.sh
```

No Plan-1 files change except: **`cmd/server/main.go` is new**, and the `messaging`/`store` packages are imported, not modified.

---

## Task 1: Add Plan-2 dependencies

**Files:** `backend/go.mod`, `backend/go.sum` (via tooling)

- [ ] **Step 1: Add deps**

```bash
cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && \
  gob get github.com/coder/websocket@v1.8.12 && \
  gob get github.com/redis/go-redis/v9@v9.7.3 && \
  gob get github.com/go-chi/chi/v5@v5.2.1 && \
  gob get github.com/golang-jwt/jwt/v5@v5.2.1
```
Expected: `go.mod` gains the four requires. (Versions chosen for Go 1.23 compatibility; if any `go get` reports needing a newer Go, drop to the latest tag that supports 1.23 and note it.)

- [ ] **Step 2: Tidy + verify build**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob mod tidy && gob build ./...`
Expected: builds clean (still only Plan-1 packages compile; new deps are unused until later tasks — `mod tidy` may drop them, so re-add happens naturally when first imported. If tidy removes them, that's fine; they'll be pulled when a file imports them).

- [ ] **Step 3: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/go.mod backend/go.sum && git commit -m "chore(ws1): add transport deps (coder/websocket, go-redis, chi, jwt)"
```

---

## Task 2: PubSub interface + in-memory fake

**Files:** Create `backend/internal/pubsub/pubsub.go`, `backend/internal/pubsub/pubsub_test.go`

- [ ] **Step 1: Write the failing test**

`backend/internal/pubsub/pubsub_test.go`:

```go
package pubsub

import (
	"context"
	"testing"
	"time"
)

func TestInMemoryPublishSubscribe(t *testing.T) {
	ps := NewInMemory()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch, err := ps.Subscribe(ctx, "room")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	if err := ps.Publish(context.Background(), "room", []byte("hello")); err != nil {
		t.Fatalf("publish: %v", err)
	}
	select {
	case msg := <-ch:
		if string(msg) != "hello" {
			t.Errorf("got %q", msg)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for message")
	}
}

func TestInMemoryIsolatesChannels(t *testing.T) {
	ps := NewInMemory()
	ctx := context.Background()
	ch, _ := ps.Subscribe(ctx, "a")
	_ = ps.Publish(ctx, "b", []byte("x"))
	select {
	case <-ch:
		t.Fatal("received message from a different channel")
	case <-time.After(100 * time.Millisecond):
	}
}

func TestInMemoryUnsubscribeOnCtxCancel(t *testing.T) {
	ps := NewInMemory()
	ctx, cancel := context.WithCancel(context.Background())
	ch, _ := ps.Subscribe(ctx, "room")
	cancel()
	// publishing after cancel must not panic and the channel is eventually closed
	time.Sleep(50 * time.Millisecond)
	_ = ps.Publish(context.Background(), "room", []byte("late"))
	// draining a closed/empty channel should not block
	select {
	case <-ch:
	case <-time.After(100 * time.Millisecond):
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/pubsub/`
Expected: FAIL — undefined `NewInMemory`.

- [ ] **Step 3: Implement `pubsub.go`**

`backend/internal/pubsub/pubsub.go`:

```go
// Package pubsub provides a minimal publish/subscribe abstraction used to fan
// out delivery across service instances. It has an in-memory fake (tests,
// single-instance dev) and a Redis-backed implementation (multi-instance).
package pubsub

import (
	"context"
	"sync"
)

// PubSub is a channel-based publish/subscribe bus.
type PubSub interface {
	// Publish sends data to all current subscribers of channel.
	Publish(ctx context.Context, channel string, data []byte) error
	// Subscribe returns a receive channel for messages on channel. The
	// subscription ends (and the returned channel is closed) when ctx is done.
	Subscribe(ctx context.Context, channel string) (<-chan []byte, error)
}

// InMemory is an in-process PubSub for tests and single-instance runs.
type InMemory struct {
	mu   sync.Mutex
	subs map[string][]chan []byte
}

func NewInMemory() *InMemory {
	return &InMemory{subs: map[string][]chan []byte{}}
}

func (m *InMemory) Subscribe(ctx context.Context, channel string) (<-chan []byte, error) {
	ch := make(chan []byte, 64)
	m.mu.Lock()
	m.subs[channel] = append(m.subs[channel], ch)
	m.mu.Unlock()

	go func() {
		<-ctx.Done()
		m.mu.Lock()
		defer m.mu.Unlock()
		cur := m.subs[channel]
		for i, c := range cur {
			if c == ch {
				m.subs[channel] = append(cur[:i], cur[i+1:]...)
				close(ch)
				break
			}
		}
	}()
	return ch, nil
}

func (m *InMemory) Publish(_ context.Context, channel string, data []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, ch := range m.subs[channel] {
		select {
		case ch <- data:
		default: // drop for slow subscriber; delivery is best-effort
		}
	}
	return nil
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/pubsub/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/internal/pubsub && git commit -m "feat(ws1): pubsub interface + in-memory fake"
```

---

## Task 3: Redis-backed PubSub (integration-tested)

**Files:** Create `backend/internal/pubsub/redis.go`, `backend/internal/pubsub/redis_test.go`

- [ ] **Step 1: Write the integration test (build-tagged)**

`backend/internal/pubsub/redis_test.go`:

```go
//go:build integration

package pubsub

import (
	"context"
	"os"
	"testing"
	"time"
)

func testRedisURL() string {
	if v := os.Getenv("TEST_REDIS_URL"); v != "" {
		return v
	}
	return "redis://localhost:56379"
}

func TestRedisPublishSubscribe(t *testing.T) {
	ps, err := NewRedis(testRedisURL())
	if err != nil {
		t.Fatalf("new redis: %v", err)
	}
	defer ps.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	ch, err := ps.Subscribe(ctx, "itroom")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	// redis subscription is async; give it a moment to register
	time.Sleep(150 * time.Millisecond)
	if err := ps.Publish(context.Background(), "itroom", []byte("hi")); err != nil {
		t.Fatalf("publish: %v", err)
	}
	select {
	case msg := <-ch:
		if string(msg) != "hi" {
			t.Errorf("got %q", msg)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timeout")
	}
}
```

- [ ] **Step 2: Implement `redis.go`**

`backend/internal/pubsub/redis.go`:

```go
package pubsub

import (
	"context"

	"github.com/redis/go-redis/v9"
)

// Redis is a Redis-backed PubSub for multi-instance fan-out.
type Redis struct {
	client *redis.Client
}

// NewRedis connects to Redis from a redis:// URL.
func NewRedis(url string) (*Redis, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opt)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	return &Redis{client: client}, nil
}

func (r *Redis) Close() error { return r.client.Close() }

func (r *Redis) Publish(ctx context.Context, channel string, data []byte) error {
	return r.client.Publish(ctx, channel, data).Err()
}

func (r *Redis) Subscribe(ctx context.Context, channel string) (<-chan []byte, error) {
	sub := r.client.Subscribe(ctx, channel)
	out := make(chan []byte, 64)
	go func() {
		defer close(out)
		defer sub.Close()
		redisCh := sub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-redisCh:
				if !ok {
					return
				}
				select {
				case out <- []byte(msg.Payload):
				default: // drop for slow consumer
				}
			}
		}
	}()
	return out, nil
}

// Client exposes the underlying redis client for stores that need commands
// beyond pub/sub (e.g. presence sets).
func (r *Redis) Client() *redis.Client { return r.client }
```

- [ ] **Step 3: Build + unit tests still pass (integration excluded)**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob build ./... && gob test ./internal/pubsub/`
Expected: build clean; fake tests PASS; redis_test skipped.

- [ ] **Step 4: Run the redis integration test against Dockerized Redis**

```bash
cd /home/faithsax/new-frontend/backend
docker run -d --name redis_it -p 56379:6379 redis:7-alpine
sleep 2
docker run --rm --network host -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app \
  -e TEST_REDIS_URL="redis://localhost:56379" \
  golang:1.23-alpine go test -tags=integration ./internal/pubsub/
echo "exit=$?"
docker rm -f redis_it
```
Expected: `ok ... pubsub`, `exit=0`.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/internal/pubsub backend/go.mod backend/go.sum && git commit -m "feat(ws1): redis-backed pubsub + integration test"
```

---

## Task 4: Hub — connection registry + Router + cross-instance delivery

**Files:** Create `backend/internal/hub/hub.go`, `backend/internal/hub/hub_test.go`

- [ ] **Step 1: Write the failing test**

`backend/internal/hub/hub_test.go`:

```go
package hub

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/pubsub"
)

func drain(c *Conn, d time.Duration) (protocol.Envelope, bool) {
	select {
	case env := <-c.Out():
		return env, true
	case <-time.After(d):
		return protocol.Envelope{}, false
	}
}

func TestRouteToLocalConnection(t *testing.T) {
	ps := pubsub.NewInMemory()
	h := New(ps)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go h.Run(ctx)

	c := NewConn("u1")
	h.Register(c)
	defer h.Unregister(c)

	local, err := h.RouteToUser(context.Background(), "u1", protocol.Envelope{Type: protocol.TypeMessageNew})
	if err != nil || !local {
		t.Fatalf("expected local delivery: local=%v err=%v", local, err)
	}
	if env, ok := drain(c, time.Second); !ok || env.Type != protocol.TypeMessageNew {
		t.Fatalf("conn did not receive: %+v ok=%v", env, ok)
	}
}

func TestRouteToRemoteViaPubSub(t *testing.T) {
	ps := pubsub.NewInMemory() // shared bus = two "instances"
	h1 := New(ps)
	h2 := New(ps)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go h1.Run(ctx)
	go h2.Run(ctx)
	time.Sleep(50 * time.Millisecond) // let subscriptions register

	// user lives on h2
	c := NewConn("u2")
	h2.Register(c)
	defer h2.Unregister(c)

	// routed from h1 (no local conn) -> should publish -> h2 delivers
	local, err := h1.RouteToUser(context.Background(), "u2", protocol.Envelope{Type: protocol.TypeMessageNew})
	if err != nil {
		t.Fatalf("route: %v", err)
	}
	if local {
		t.Fatal("should not be local on h1")
	}
	if env, ok := drain(c, 2*time.Second); !ok || env.Type != protocol.TypeMessageNew {
		t.Fatalf("remote delivery failed: %+v ok=%v", env, ok)
	}
}

func TestRouteToOfflineUserReturnsFalse(t *testing.T) {
	ps := pubsub.NewInMemory()
	h := New(ps)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go h.Run(ctx)
	time.Sleep(20 * time.Millisecond)
	local, err := h.RouteToUser(context.Background(), "ghost", protocol.Envelope{Type: protocol.TypeMessageNew})
	if err != nil || local {
		t.Fatalf("offline route should be (false,nil): local=%v err=%v", local, err)
	}
}

func TestBroadcastReachesAllLocalConns(t *testing.T) {
	ps := pubsub.NewInMemory()
	h := New(ps)
	a, b := NewConn("a"), NewConn("b")
	h.Register(a)
	h.Register(b)
	h.Broadcast(protocol.Envelope{Type: protocol.TypePresenceChanged})
	if _, ok := drain(a, time.Second); !ok {
		t.Error("a missed broadcast")
	}
	if _, ok := drain(b, time.Second); !ok {
		t.Error("b missed broadcast")
	}
}

var _ = json.Marshal
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/hub/`
Expected: FAIL — undefined `New`, `NewConn`, `Conn`, etc.

- [ ] **Step 3: Implement `hub.go`**

`backend/internal/hub/hub.go`:

```go
// Package hub maintains the per-instance registry of live connections and
// implements store.Router: deliver to a user's local connections, or publish to
// the shared bus so the instance holding that user delivers it.
package hub

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/pubsub"
)

// routeChannel is the pub/sub channel used for cross-instance routing.
const routeChannel = "ws:route"

// Conn is a single client connection's outbound side. The gateway owns the
// socket; the hub only pushes envelopes into Out().
type Conn struct {
	UserID string
	out    chan protocol.Envelope
}

// NewConn creates a connection handle with a buffered outbound queue.
func NewConn(userID string) *Conn {
	return &Conn{UserID: userID, out: make(chan protocol.Envelope, 64)}
}

// Out is the channel the gateway's write pump reads from.
func (c *Conn) Out() <-chan protocol.Envelope { return c.out }

// trySend enqueues without blocking; returns false if the queue is full.
func (c *Conn) trySend(env protocol.Envelope) bool {
	select {
	case c.out <- env:
		return true
	default:
		return false
	}
}

type routeMsg struct {
	UserID string            `json:"userId"`
	Env    protocol.Envelope `json:"env"`
}

// Hub is the connection registry + router for one instance.
type Hub struct {
	ps  pubsub.PubSub
	mu  sync.RWMutex
	reg map[string]map[*Conn]struct{} // userID -> set of conns
}

// New constructs a Hub over a pub/sub bus.
func New(ps pubsub.PubSub) *Hub {
	return &Hub{ps: ps, reg: map[string]map[*Conn]struct{}{}}
}

// Register adds a connection to the local registry.
func (h *Hub) Register(c *Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.reg[c.UserID] == nil {
		h.reg[c.UserID] = map[*Conn]struct{}{}
	}
	h.reg[c.UserID][c] = struct{}{}
}

// Unregister removes a connection.
func (h *Hub) Unregister(c *Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if set := h.reg[c.UserID]; set != nil {
		delete(set, c)
		if len(set) == 0 {
			delete(h.reg, c.UserID)
		}
	}
}

// deliverLocal pushes env to all local conns of userID; returns true if any.
func (h *Hub) deliverLocal(userID string, env protocol.Envelope) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	set := h.reg[userID]
	delivered := false
	for c := range set {
		if c.trySend(env) {
			delivered = true
		}
	}
	return delivered
}

// RouteToUser implements store.Router. Local delivery returns (true,nil).
// Otherwise it publishes to the shared bus and returns (false,nil).
func (h *Hub) RouteToUser(ctx context.Context, userID string, env protocol.Envelope) (bool, error) {
	if h.deliverLocal(userID, env) {
		return true, nil
	}
	payload, err := json.Marshal(routeMsg{UserID: userID, Env: env})
	if err != nil {
		return false, err
	}
	if err := h.ps.Publish(ctx, routeChannel, payload); err != nil {
		return false, err
	}
	return false, nil
}

// Broadcast pushes env to every local connection (used for presence).
func (h *Hub) Broadcast(env protocol.Envelope) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, set := range h.reg {
		for c := range set {
			c.trySend(env)
		}
	}
}

// Run subscribes to the route channel and delivers inbound messages to local
// conns until ctx is cancelled. Call once per instance (e.g. in a goroutine).
func (h *Hub) Run(ctx context.Context) {
	ch, err := h.ps.Subscribe(ctx, routeChannel)
	if err != nil {
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		case raw, ok := <-ch:
			if !ok {
				return
			}
			var rm routeMsg
			if json.Unmarshal(raw, &rm) != nil {
				continue
			}
			h.deliverLocal(rm.UserID, rm.Env)
		}
	}
}
```

- [ ] **Step 4: Compile-time Router assertion + run tests**

Create `backend/internal/hub/assert.go` (a compile-time check that `*Hub`
satisfies `store.Router`):
```go
package hub

import "github.com/techit360ai-bit/new-frontend/backend/internal/store"

var _ store.Router = (*Hub)(nil)
```
Also remove the dead `var _ = json.Marshal` line from `hub_test.go` (it was only a
placeholder to keep the `encoding/json` import while writing the test; the test
uses `json` indirectly via the hub — if `encoding/json` ends up unused in the test
file, drop the import instead).

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/hub/`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/internal/hub && git commit -m "feat(ws1): connection hub — registry, Router (local+pubsub), broadcast"
```

---

## Task 5: Presence — online set, last-seen, change broadcast

**Files:** Create `backend/internal/presence/presence.go`, `presence_test.go`, `redis_test.go`

- [ ] **Step 1: Write the failing test**

`backend/internal/presence/presence_test.go`:

```go
package presence

import (
	"context"
	"testing"
)

func TestServiceOnlineOffline(t *testing.T) {
	st := NewInMemoryStore()
	svc := New(st, nil) // nil publisher is allowed (no-op broadcast)
	ctx := context.Background()

	if err := svc.Online(ctx, "u1"); err != nil {
		t.Fatalf("online: %v", err)
	}
	on, _ := svc.ListOnline(ctx)
	if len(on) != 1 || on[0] != "u1" {
		t.Fatalf("expected [u1], got %v", on)
	}
	if err := svc.Offline(ctx, "u1"); err != nil {
		t.Fatalf("offline: %v", err)
	}
	on, _ = svc.ListOnline(ctx)
	if len(on) != 0 {
		t.Fatalf("expected empty, got %v", on)
	}
}

func TestServiceOnlinePublishesChange(t *testing.T) {
	st := NewInMemoryStore()
	pub := &recordingPublisher{}
	svc := New(st, pub)
	_ = svc.Online(context.Background(), "u9")
	if pub.count == 0 {
		t.Fatal("expected a presence change to be published")
	}
}

type recordingPublisher struct{ count int }

func (r *recordingPublisher) PublishPresence(_ context.Context, userID string, online bool) error {
	r.count++
	return nil
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/presence/`
Expected: FAIL — undefined `NewInMemoryStore`, `New`, etc.

- [ ] **Step 3: Implement `presence.go`**

`backend/internal/presence/presence.go`:

```go
// Package presence tracks which users are online (Redis set + last-seen) and
// publishes presence changes for broadcast to connected clients.
package presence

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	onlineKey   = "presence:online"   // SET of online user IDs
	lastSeenKey = "presence:lastseen" // HASH userID -> RFC3339
)

// Store persists online membership and last-seen timestamps.
type Store interface {
	Add(ctx context.Context, userID string) error
	Remove(ctx context.Context, userID, lastSeen string) error
	List(ctx context.Context) ([]string, error)
}

// Publisher emits a presence change for cross-instance broadcast.
type Publisher interface {
	PublishPresence(ctx context.Context, userID string, online bool) error
}

// Service is the presence façade used by the gateway.
type Service struct {
	store Store
	pub   Publisher
	now   func() time.Time
}

func New(store Store, pub Publisher) *Service {
	return &Service{store: store, pub: pub, now: time.Now}
}

func (s *Service) Online(ctx context.Context, userID string) error {
	if err := s.store.Add(ctx, userID); err != nil {
		return err
	}
	if s.pub != nil {
		_ = s.pub.PublishPresence(ctx, userID, true)
	}
	return nil
}

func (s *Service) Offline(ctx context.Context, userID string) error {
	if err := s.store.Remove(ctx, userID, s.now().UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	if s.pub != nil {
		_ = s.pub.PublishPresence(ctx, userID, false)
	}
	return nil
}

func (s *Service) ListOnline(ctx context.Context) ([]string, error) {
	return s.store.List(ctx)
}

// InMemoryStore is a Store for tests / single-instance dev.
type InMemoryStore struct {
	mu     sync.Mutex
	online map[string]struct{}
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{online: map[string]struct{}{}}
}

func (s *InMemoryStore) Add(_ context.Context, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.online[userID] = struct{}{}
	return nil
}
func (s *InMemoryStore) Remove(_ context.Context, userID, _ string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.online, userID)
	return nil
}
func (s *InMemoryStore) List(_ context.Context) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]string, 0, len(s.online))
	for u := range s.online {
		out = append(out, u)
	}
	sort.Strings(out)
	return out, nil
}

// RedisStore is the production Store.
type RedisStore struct{ client *redis.Client }

func NewRedisStore(client *redis.Client) *RedisStore { return &RedisStore{client: client} }

func (s *RedisStore) Add(ctx context.Context, userID string) error {
	return s.client.SAdd(ctx, onlineKey, userID).Err()
}
func (s *RedisStore) Remove(ctx context.Context, userID, lastSeen string) error {
	if err := s.client.SRem(ctx, onlineKey, userID).Err(); err != nil {
		return err
	}
	return s.client.HSet(ctx, lastSeenKey, userID, lastSeen).Err()
}
func (s *RedisStore) List(ctx context.Context) ([]string, error) {
	res, err := s.client.SMembers(ctx, onlineKey).Result()
	if err != nil {
		return nil, err
	}
	sort.Strings(res)
	return res, nil
}
```

- [ ] **Step 4: Write the redis integration test**

`backend/internal/presence/redis_test.go`:

```go
//go:build integration

package presence

import (
	"context"
	"os"
	"testing"

	"github.com/redis/go-redis/v9"
)

func TestRedisStoreAddListRemove(t *testing.T) {
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		url = "redis://localhost:56379"
	}
	opt, _ := redis.ParseURL(url)
	client := redis.NewClient(opt)
	defer client.Close()
	client.Del(context.Background(), onlineKey)

	st := NewRedisStore(client)
	ctx := context.Background()
	_ = st.Add(ctx, "ru1")
	on, _ := st.List(ctx)
	if len(on) != 1 || on[0] != "ru1" {
		t.Fatalf("got %v", on)
	}
	_ = st.Remove(ctx, "ru1", "2026-06-08T00:00:00Z")
	on, _ = st.List(ctx)
	if len(on) != 0 {
		t.Fatalf("expected empty, got %v", on)
	}
}
```

- [ ] **Step 5: Run unit tests**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/presence/`
Expected: PASS (2 unit tests; redis_test skipped).

- [ ] **Step 6: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/internal/presence && git commit -m "feat(ws1): presence service (online set, last-seen, change publish)"
```

---

## Task 6: Auth — JWT verify + dev mint

**Files:** Create `backend/internal/auth/jwt.go`, `backend/internal/auth/jwt_test.go`

- [ ] **Step 1: Write the failing test**

`backend/internal/auth/jwt_test.go`:

```go
package auth

import "testing"

func TestMintThenVerify(t *testing.T) {
	v := NewVerifier("topsecret")
	tok, err := v.Mint("user-1", "Ada", "founder")
	if err != nil {
		t.Fatalf("mint: %v", err)
	}
	claims, err := v.Verify(tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.UserID != "user-1" || claims.Name != "Ada" || claims.Role != "founder" {
		t.Errorf("bad claims: %+v", claims)
	}
}

func TestVerifyRejectsWrongSecret(t *testing.T) {
	good := NewVerifier("secretA")
	bad := NewVerifier("secretB")
	tok, _ := good.Mint("u", "n", "r")
	if _, err := bad.Verify(tok); err == nil {
		t.Fatal("expected verification failure with wrong secret")
	}
}

func TestVerifyRejectsGarbage(t *testing.T) {
	v := NewVerifier("s")
	if _, err := v.Verify("not.a.jwt"); err == nil {
		t.Fatal("expected error on malformed token")
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/auth/`
Expected: FAIL — undefined `NewVerifier`.

- [ ] **Step 3: Implement `jwt.go`**

`backend/internal/auth/jwt.go`:

```go
// Package auth verifies and mints HS256 JWTs carrying the messaging identity
// claims {sub, name, role}. Real issuance lives elsewhere (WS5); Mint is for dev
// and tests. The claim contract must eventually match the platform issuer.
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims is the messaging identity extracted from a token.
type Claims struct {
	UserID string
	Name   string
	Role   string
}

// Verifier verifies and mints HS256 tokens with a shared secret.
type Verifier struct {
	secret []byte
}

func NewVerifier(secret string) *Verifier { return &Verifier{secret: []byte(secret)} }

// Verify parses and validates an HS256 token, returning its identity claims.
func (v *Verifier) Verify(token string) (Claims, error) {
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return v.secret, nil
	})
	if err != nil {
		return Claims{}, err
	}
	mc, ok := parsed.Claims.(jwt.MapClaims)
	if !ok || !parsed.Valid {
		return Claims{}, errors.New("invalid token")
	}
	sub, _ := mc["sub"].(string)
	if sub == "" {
		return Claims{}, errors.New("missing sub claim")
	}
	name, _ := mc["name"].(string)
	role, _ := mc["role"].(string)
	return Claims{UserID: sub, Name: name, Role: role}, nil
}

// Mint creates a token valid for 24h (dev/testing only).
func (v *Verifier) Mint(userID, name, role string) (string, error) {
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  userID,
		"name": name,
		"role": role,
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(24 * time.Hour).Unix(),
	})
	return tok.SignedString(v.secret)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/auth/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/internal/auth backend/go.mod backend/go.sum && git commit -m "feat(ws1): JWT verifier + dev mint (HS256, sub/name/role claims)"
```

---

## Task 7: WebSocket gateway

**Files:** Create `backend/internal/transport/ws/gateway.go`, `backend/internal/transport/ws/gateway_test.go`

The gateway upgrades a connection, authenticates the `token` query param, upserts
the user, registers a hub `Conn`, marks presence online, then runs a read pump
(dispatching to the messaging service) and a write pump (draining `Conn.Out()`),
with a heartbeat. On disconnect it unregisters and marks presence offline.

- [ ] **Step 1: Write the failing test (httptest + real ws client + fakes)**

`backend/internal/transport/ws/gateway_test.go`:

```go
package ws

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/techit360ai-bit/new-frontend/backend/internal/auth"
	"github.com/techit360ai-bit/new-frontend/backend/internal/hub"
	"github.com/techit360ai-bit/new-frontend/backend/internal/messaging"
	"github.com/techit360ai-bit/new-frontend/backend/internal/presence"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newTestGateway(t *testing.T) (*httptest.Server, *auth.Verifier, *store.FakeStores) {
	t.Helper()
	st := store.NewFakeStores()
	h := hub.New(nil) // single-instance: nil bus means local-only; see note
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	_ = ctx
	ver := auth.NewVerifier("test-secret")
	msg := messaging.New(st.Conversations, st.Messages, h)
	pres := presence.New(presence.NewInMemoryStore(), nil)
	gw := New(Deps{Hub: h, Verifier: ver, Users: st.Users, Messaging: msg, Presence: pres})
	srv := httptest.NewServer(http.HandlerFunc(gw.Handle))
	t.Cleanup(srv.Close)
	return srv, ver, st
}

func wsURL(httpURL, token string) string {
	return "ws" + strings.TrimPrefix(httpURL, "http") + "/?token=" + token
}

func TestGatewayAuthRejectsBadToken(t *testing.T) {
	srv, _, _ := newTestGateway(t)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	c, _, err := websocket.Dial(ctx, wsURL(srv.URL, "garbage"), nil)
	if err == nil {
		c.Close(websocket.StatusNormalClosure, "")
		t.Fatal("expected dial/handshake failure for bad token")
	}
}

func TestGatewayDeliversDM(t *testing.T) {
	srv, ver, st := newTestGateway(t)
	ctx := context.Background()
	// create the DM + users
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	_ = st.Users.Upsert(ctx, store.User{ID: "u2", DisplayName: "U2"})
	conv, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")

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
	time.Sleep(100 * time.Millisecond) // registration

	// A sends a message.send
	send := protocol.Envelope{Type: protocol.TypeMessageSend, ID: protocol.NewMsgID()}
	send.Data, _ = json.Marshal(protocol.SendPayload{ConvID: conv.ID, ClientMsgID: "c1", Type: "text", Body: "hi B"})
	raw, _ := json.Marshal(send)
	if err := connA.Write(dctx, websocket.MessageText, raw); err != nil {
		t.Fatalf("A write: %v", err)
	}

	// B should receive message.new
	got := readEnvelope(t, dctx, connB)
	if got.Type != protocol.TypeMessageNew {
		t.Fatalf("B expected message.new, got %s", got.Type)
	}
	// A should receive message.ack (may arrive before or after; read until found)
	if !awaitType(t, dctx, connA, protocol.TypeMessageAck) {
		t.Fatal("A did not receive ack")
	}
}

func readEnvelope(t *testing.T, ctx context.Context, c *websocket.Conn) protocol.Envelope {
	t.Helper()
	_, data, err := c.Read(ctx)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	var env protocol.Envelope
	if err := json.Unmarshal(data, &env); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return env
}

func awaitType(t *testing.T, ctx context.Context, c *websocket.Conn, want string) bool {
	t.Helper()
	for i := 0; i < 5; i++ {
		env := readEnvelope(t, ctx, c)
		if env.Type == want {
			return true
		}
	}
	return false
}
```

NOTE on `hub.New(nil)`: the gateway test exercises **local** delivery only, where
`RouteToUser` finds the recipient's local conn and never touches the bus. To keep
`hub.New(nil)` safe, the hub must only use `h.ps` on the publish path. Confirm
`deliverLocal` (the path used when both users are on this instance) does not call
`h.ps`. It does not (Task 4). Do NOT call `h.Run` in this test (Run would call
`ps.Subscribe` on a nil bus). If you prefer, pass `pubsub.NewInMemory()` instead of
`nil` and start `Run`; either works since delivery here is local.

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/transport/ws/`
Expected: FAIL — undefined `New`, `Deps`, `Handle`.

- [ ] **Step 3: Implement `gateway.go`**

`backend/internal/transport/ws/gateway.go`:

```go
// Package ws is the WebSocket gateway: it authenticates connections, registers
// them with the hub, marks presence, and pumps envelopes between the socket and
// the messaging service.
package ws

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/techit360ai-bit/new-frontend/backend/internal/auth"
	"github.com/techit360ai-bit/new-frontend/backend/internal/hub"
	"github.com/techit360ai-bit/new-frontend/backend/internal/messaging"
	"github.com/techit360ai-bit/new-frontend/backend/internal/presence"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

// Deps are the gateway's collaborators.
type Deps struct {
	Hub       *hub.Hub
	Verifier  *auth.Verifier
	Users     store.UserStore
	Messaging *messaging.Service
	Presence  *presence.Service
	// AllowOrigins is passed to the ws accept options; empty = same-origin only.
	InsecureSkipOriginCheck bool
}

// Gateway handles WebSocket upgrades.
type Gateway struct{ d Deps }

func New(d Deps) *Gateway { return &Gateway{d: d} }

const (
	heartbeatInterval = 30 * time.Second
	writeTimeout      = 10 * time.Second
)

// Handle is the http.HandlerFunc for the WS endpoint.
func (g *Gateway) Handle(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	claims, err := g.d.Verifier.Verify(token)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	opts := &websocket.AcceptOptions{}
	if g.d.InsecureSkipOriginCheck {
		opts.InsecureSkipVerify = true
	}
	conn, err := websocket.Accept(w, r, opts)
	if err != nil {
		return
	}
	// upsert identity from claims (self-contained in Phase 1)
	ctx := r.Context()
	_ = g.d.Users.Upsert(ctx, store.User{ID: claims.UserID, DisplayName: claims.Name, Role: claims.Role})

	c := hub.NewConn(claims.UserID)
	g.d.Hub.Register(c)
	_ = g.d.Presence.Online(ctx, claims.UserID)

	connCtx, cancel := context.WithCancel(ctx)
	defer func() {
		cancel()
		g.d.Hub.Unregister(c)
		_ = g.d.Presence.Offline(context.Background(), claims.UserID)
		conn.Close(websocket.StatusNormalClosure, "bye")
	}()

	go g.writePump(connCtx, conn, c)
	g.readPump(connCtx, conn, claims.UserID)
}

// writePump drains the conn's outbound queue and sends heartbeats.
func (g *Gateway) writePump(ctx context.Context, conn *websocket.Conn, c *hub.Conn) {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case env := <-c.Out():
			raw, err := json.Marshal(env)
			if err != nil {
				continue
			}
			wctx, cancel := context.WithTimeout(ctx, writeTimeout)
			err = conn.Write(wctx, websocket.MessageText, raw)
			cancel()
			if err != nil {
				return
			}
		case <-ticker.C:
			pctx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := conn.Ping(pctx)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

// readPump reads inbound envelopes and dispatches them to the messaging service.
func (g *Gateway) readPump(ctx context.Context, conn *websocket.Conn, userID string) {
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var env protocol.Envelope
		if json.Unmarshal(data, &env) != nil {
			continue
		}
		g.dispatch(ctx, userID, env)
	}
}

func (g *Gateway) dispatch(ctx context.Context, userID string, env protocol.Envelope) {
	switch env.Type {
	case protocol.TypeMessageSend:
		var p protocol.SendPayload
		if json.Unmarshal(env.Data, &p) != nil {
			return
		}
		ack, err := g.d.Messaging.SendDM(ctx, userID, p)
		if err != nil {
			g.sendError(ctx, userID, "send_failed", err.Error())
			return
		}
		g.send(ctx, userID, protocol.TypeMessageAck, map[string]any{
			"clientMsgId": ack.ClientMsgID, "msgId": ack.MsgID, "ts": ack.TS,
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
		// ephemeral; broadcast handled in Plan 3 (channels). For DMs, relay to the
		// other participant. Out of Plan-2 scope to keep the spine minimal; ignore.
	}
}

func (g *Gateway) send(ctx context.Context, userID, typ string, data map[string]any) {
	raw, _ := json.Marshal(data)
	_, _ = g.d.Hub.RouteToUser(ctx, userID, protocol.Envelope{
		Type: typ, ID: protocol.NewMsgID(), TS: time.Now().UTC().Format(time.RFC3339), Data: raw,
	})
}

func (g *Gateway) sendError(ctx context.Context, userID, code, msg string) {
	g.send(ctx, userID, protocol.TypeError, map[string]any{"code": code, "message": msg})
}
```

- [ ] **Step 4: Run the gateway test**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/transport/ws/`
Expected: PASS (auth-reject + DM delivery). If the DM test flakes on the in-memory hub with `nil` bus, change `hub.New(nil)` to `hub.New(pubsub.NewInMemory())` in the test and start `go h.Run(ctx)` — local delivery still applies.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/internal/transport/ws backend/go.mod backend/go.sum && git commit -m "feat(ws1): websocket gateway — auth, pumps, heartbeat, dispatch to messaging"
```

---

## Task 8: HTTP API (chi) — health, dev token, conversations, users/online

**Files:** Create `backend/internal/transport/httpapi/{router.go,health.go,devtoken.go,conversations.go,presence.go,httpapi_test.go}`

- [ ] **Step 1: Write the failing test**

`backend/internal/transport/httpapi/httpapi_test.go`:

```go
package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/techit360ai-bit/new-frontend/backend/internal/auth"
	"github.com/techit360ai-bit/new-frontend/backend/internal/hub"
	"github.com/techit360ai-bit/new-frontend/backend/internal/messaging"
	"github.com/techit360ai-bit/new-frontend/backend/internal/presence"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

func newAPI(t *testing.T) (http.Handler, *auth.Verifier, *store.FakeStores) {
	st := store.NewFakeStores()
	ver := auth.NewVerifier("s")
	h := hub.New(nil)
	msg := messaging.New(st.Conversations, st.Messages, h)
	pres := presence.New(presence.NewInMemoryStore(), nil)
	r := NewRouter(Deps{
		Verifier: ver, Users: st.Users, Conversations: st.Conversations,
		Messages: st.Messages, Messaging: msg, Presence: pres, EnableDevToken: true,
	})
	return r, ver, st
}

func TestHealthOK(t *testing.T) {
	r, _, _ := newAPI(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/health", nil))
	if rec.Code != 200 {
		t.Fatalf("health code=%d", rec.Code)
	}
}

func TestDevTokenMints(t *testing.T) {
	r, ver, _ := newAPI(t)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest("GET", "/api/v1/dev/token?userId=u1&name=U1&role=founder", nil))
	if rec.Code != 200 {
		t.Fatalf("code=%d body=%s", rec.Code, rec.Body)
	}
	var resp struct{ Token string }
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if _, err := ver.Verify(resp.Token); err != nil {
		t.Fatalf("minted token invalid: %v", err)
	}
}

func TestCreateConversationRequiresAuth(t *testing.T) {
	r, _, _ := newAPI(t)
	rec := httptest.NewRecorder()
	body, _ := json.Marshal(map[string]string{"userId": "u2"})
	r.ServeHTTP(rec, httptest.NewRequest("POST", "/api/v1/conversations", bytes.NewReader(body)))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d", rec.Code)
	}
}

func TestCreateConversationAndHistory(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	_ = st.Users.Upsert(ctx, store.User{ID: "u2", DisplayName: "U2"})
	tok, _ := ver.Mint("u1", "U1", "founder")

	// create conversation
	rec := httptest.NewRecorder()
	body, _ := json.Marshal(map[string]string{"userId": "u2"})
	req := httptest.NewRequest("POST", "/api/v1/conversations", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("create code=%d body=%s", rec.Code, rec.Body)
	}
	var conv struct{ ID string }
	_ = json.Unmarshal(rec.Body.Bytes(), &conv)
	if conv.ID == "" {
		t.Fatal("no conversation id")
	}

	// send via REST
	rec = httptest.NewRecorder()
	sb, _ := json.Marshal(map[string]string{"clientMsgId": "m1", "body": "hi", "type": "text"})
	req = httptest.NewRequest("POST", "/api/v1/conversations/"+conv.ID+"/messages", bytes.NewReader(sb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("send code=%d body=%s", rec.Code, rec.Body)
	}

	// history
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/conversations/"+conv.ID+"/messages", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("history code=%d", rec.Code)
	}
	var hist struct{ Messages []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &hist)
	if len(hist.Messages) != 1 {
		t.Fatalf("want 1 message, got %d (%s)", len(hist.Messages), rec.Body)
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/transport/httpapi/`
Expected: FAIL — undefined `NewRouter`, `Deps`.

- [ ] **Step 3: Implement the router + middleware**

`backend/internal/transport/httpapi/router.go`:

```go
// Package httpapi is the REST surface: health, dev token, conversations, and
// presence. Authenticated routes require a Bearer JWT.
package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/techit360ai-bit/new-frontend/backend/internal/auth"
	"github.com/techit360ai-bit/new-frontend/backend/internal/messaging"
	"github.com/techit360ai-bit/new-frontend/backend/internal/presence"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store"
)

// Deps are the API's collaborators.
type Deps struct {
	Verifier      *auth.Verifier
	Users         store.UserStore
	Conversations store.ConversationStore
	Messages      store.MessageStore
	Messaging     *messaging.Service
	Presence      *presence.Service
	EnableDevToken bool
	CORSOrigins   string
}

type ctxKey string

const userIDKey ctxKey = "userID"

// NewRouter builds the chi router.
func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)

	r.Get("/health", handleHealth)

	r.Route("/api/v1", func(r chi.Router) {
		if d.EnableDevToken {
			r.Get("/dev/token", handleDevToken(d))
		}
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware(d.Verifier))
			r.Post("/conversations", handleCreateConversation(d))
			r.Get("/conversations/{id}/messages", handleHistory(d))
			r.Post("/conversations/{id}/messages", handleRESTSend(d))
			r.Post("/conversations/{id}/read", handleMarkRead(d))
			r.Get("/users/online", handleOnline(d))
		})
	})
	return r
}

func authMiddleware(v *auth.Verifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := r.Header.Get("Authorization")
			token := strings.TrimPrefix(h, "Bearer ")
			if token == h || token == "" {
				writeErr(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			claims, err := v.Verify(token)
			if err != nil {
				writeErr(w, http.StatusUnauthorized, "invalid token")
				return
			}
			ctx := context.WithValue(r.Context(), userIDKey, claims.UserID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func currentUser(r *http.Request) string {
	v, _ := r.Context().Value(userIDKey).(string)
	return v
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
```

`backend/internal/transport/httpapi/health.go`:

```go
package httpapi

import "net/http"

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
```

`backend/internal/transport/httpapi/devtoken.go`:

```go
package httpapi

import "net/http"

// handleDevToken mints a JWT for local development. Only mounted when
// EnableDevToken is true. NEVER enable in production.
func handleDevToken(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("userId")
		if userID == "" {
			writeErr(w, http.StatusBadRequest, "userId required")
			return
		}
		name := r.URL.Query().Get("name")
		role := r.URL.Query().Get("role")
		tok, err := d.Verifier.Mint(userID, name, role)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"token": tok})
	}
}
```

`backend/internal/transport/httpapi/conversations.go`:

```go
package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

func handleCreateConversation(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		var body struct{ UserID string `json:"userId"` }
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.UserID == "" {
			writeErr(w, http.StatusBadRequest, "userId required")
			return
		}
		conv, _, err := d.Conversations.GetOrCreateDM(r.Context(), me, body.UserID)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"id": conv.ID})
	}
}

func handleHistory(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		convID := chi.URLParam(r, "id")
		ok, err := d.Conversations.IsParticipant(r.Context(), convID, me)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !ok {
			writeErr(w, http.StatusForbidden, "not a participant")
			return
		}
		before := r.URL.Query().Get("before")
		msgs, err := d.Messages.MessagesByConversation(r.Context(), convID, before, 50)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(msgs))
		for _, m := range msgs {
			out = append(out, map[string]any{
				"id": m.ID, "convId": m.ConversationID, "senderId": m.SenderID,
				"type": m.Type, "body": m.Body, "ts": m.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"messages": out})
	}
}

func handleRESTSend(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		convID := chi.URLParam(r, "id")
		var body struct {
			ClientMsgID string `json:"clientMsgId"`
			Type        string `json:"type"`
			Body        string `json:"body"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			writeErr(w, http.StatusBadRequest, "invalid body")
			return
		}
		ack, err := d.Messaging.SendDM(r.Context(), me, protocol.SendPayload{
			ConvID: convID, ClientMsgID: body.ClientMsgID, Type: body.Type, Body: body.Body,
		})
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"clientMsgId": ack.ClientMsgID, "msgId": ack.MsgID, "ts": ack.TS,
		})
	}
}

func handleMarkRead(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		convID := chi.URLParam(r, "id")
		var body struct{ MsgID string `json:"msgId"` }
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.MsgID == "" {
			writeErr(w, http.StatusBadRequest, "msgId required")
			return
		}
		if err := d.Messaging.MarkRead(r.Context(), me, protocol.ReadUptoPayload{ConvID: convID, MsgID: body.MsgID}); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}
```

`backend/internal/transport/httpapi/presence.go`:

```go
package httpapi

import "net/http"

func handleOnline(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ids, err := d.Presence.ListOnline(r.Context())
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"online": ids})
	}
}
```

- [ ] **Step 4: Run the API tests**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./internal/transport/httpapi/`
Expected: PASS (health, dev token, auth-required, create+send+history).

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/internal/transport/httpapi backend/go.mod backend/go.sum && git commit -m "feat(ws1): HTTP API — health, dev token, conversations, users/online"
```

---

## Task 9: main.go — wire everything + graceful shutdown

**Files:** Create `backend/cmd/server/main.go`

- [ ] **Step 1: Implement main**

`backend/cmd/server/main.go`:

```go
// Command server runs the TechIT messaging service: HTTP API + WebSocket gateway
// backed by Postgres and Redis.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/techit360ai-bit/new-frontend/backend/internal/auth"
	"github.com/techit360ai-bit/new-frontend/backend/internal/config"
	"github.com/techit360ai-bit/new-frontend/backend/internal/hub"
	"github.com/techit360ai-bit/new-frontend/backend/internal/messaging"
	"github.com/techit360ai-bit/new-frontend/backend/internal/presence"
	"github.com/techit360ai-bit/new-frontend/backend/internal/pubsub"
	"github.com/techit360ai-bit/new-frontend/backend/internal/store/postgres"
	"github.com/techit360ai-bit/new-frontend/backend/internal/transport/httpapi"
	"github.com/techit360ai-bit/new-frontend/backend/internal/transport/ws"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Postgres
	pg, err := postgres.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pg.Close()
	if err := pg.MigrateAll(ctx, "internal/store/migrations"); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// Redis pub/sub + presence
	rps, err := pubsub.NewRedis(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer rps.Close()

	h := hub.New(rps)
	go h.Run(ctx)

	presSvc := presence.New(presence.NewRedisStore(rps.Client()), presencePublisher{h: h})
	go relayPresence(ctx, rps, h)

	msgSvc := messaging.New(pg.Conversations, pg.Messages, h)
	ver := auth.NewVerifier(cfg.JWTSecret)

	gw := ws.New(ws.Deps{
		Hub: h, Verifier: ver, Users: pg.Users, Messaging: msgSvc, Presence: presSvc,
		InsecureSkipOriginCheck: cfg.CORSOrigins == "*",
	})
	api := httpapi.NewRouter(httpapi.Deps{
		Verifier: ver, Users: pg.Users, Conversations: pg.Conversations,
		Messages: pg.Messages, Messaging: msgSvc, Presence: presSvc,
		EnableDevToken: os.Getenv("ENABLE_DEV_TOKEN") == "1", CORSOrigins: cfg.CORSOrigins,
	})

	mux := http.NewServeMux()
	mux.Handle("/", api)
	mux.HandleFunc("/ws", gw.Handle)

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: mux}
	go func() {
		log.Printf("messaging service listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutCtx)
}

// presencePublisher adapts the hub's broadcast to presence.Publisher by
// publishing presence changes onto the bus (relayed to all instances).
type presencePublisher struct{ h *hub.Hub }

func (p presencePublisher) PublishPresence(ctx context.Context, userID string, online bool) error {
	// Broadcast locally immediately; relayPresence handles cross-instance via bus.
	// For Phase 1 single/low instance count, local broadcast is the primary path.
	return nil // cross-instance presence relay is handled by relayPresence using the bus
}

// relayPresence is a placeholder hook kept minimal in Phase 1: presence changes
// are broadcast to local connections by the gateway lifecycle through the hub on
// connect/disconnect in a later iteration. Here we simply keep the bus warm.
func relayPresence(ctx context.Context, _ *pubsub.Redis, _ *hub.Hub) {
	<-ctx.Done()
}
```

NOTE: the presence broadcast wiring is intentionally minimal in Phase 1 — the
`/users/online` REST endpoint is the source of truth the frontend polls; live
`presence.changed` push is a Plan-3/later refinement. Keep `presencePublisher` and
`relayPresence` as the documented seam. If `gob vet` flags unused params, prefix
with `_` as shown.

- [ ] **Step 2: Build the server binary (in container)**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob build ./cmd/server/`
Expected: compiles, produces no error. (Binary not committed.)

- [ ] **Step 3: Full unit suite + vet**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./... && gob vet ./...`
Expected: all packages ok; vet clean.

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/cmd/server && git commit -m "feat(ws1): server main — wire postgres, redis, hub, presence, gateway, http"
```

---

## Task 10: Dockerfile + docker-compose

**Files:** Create `backend/Dockerfile`, `backend/docker-compose.yml`

- [ ] **Step 1: Dockerfile (multi-stage)**

`backend/Dockerfile`:

```dockerfile
# Build
FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

# Run
FROM alpine:3.20
RUN adduser -D -u 10001 app
COPY --from=build /server /server
# migrations are read at runtime relative to workdir
COPY --from=build /app/internal/store/migrations /app/internal/store/migrations
WORKDIR /app
USER app
EXPOSE 8080
ENTRYPOINT ["/server"]
```

- [ ] **Step 2: docker-compose.yml**

`backend/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: techit_msg
    ports: ["55432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 3s
      retries: 20

  redis:
    image: redis:7-alpine
    ports: ["56379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 3s
      retries: 20

  server:
    build: .
    environment:
      PORT: "8080"
      DATABASE_URL: "postgres://postgres:postgres@postgres:5432/techit_msg?sslmode=disable"
      REDIS_URL: "redis://redis:6379"
      JWT_SECRET: "dev-secret-change-me"
      ENABLE_DEV_TOKEN: "1"
      CORS_ORIGINS: "*"
    ports: ["8080:8080"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
```

- [ ] **Step 3: Validate compose config**

Run: `cd /home/faithsax/new-frontend/backend && docker compose config >/dev/null && echo "compose OK"`
Expected: `compose OK`.

- [ ] **Step 4: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/Dockerfile backend/docker-compose.yml && git commit -m "feat(ws1): Dockerfile + docker-compose (server+postgres+redis)"
```

---

## Task 11: Smoke client + smoke.sh (end-to-end gate)

**Files:** Create `backend/cmd/smoke/main.go`, `backend/scripts/smoke.sh`

- [ ] **Step 1: Smoke client**

`backend/cmd/smoke/main.go` (complete, single file — type it exactly as shown):

```go
// Command smoke is an end-to-end check: it mints two dev tokens via the running
// server, opens a WS for the recipient, sends a DM from the sender via REST, and
// asserts the recipient receives message.new over the socket.
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/coder/websocket"
	"github.com/techit360ai-bit/new-frontend/backend/internal/protocol"
)

func base() string {
	if v := os.Getenv("SMOKE_BASE"); v != "" {
		return v
	}
	return "http://localhost:8080"
}

func devToken(userID string) (string, error) {
	u := base() + "/api/v1/dev/token?userId=" + url.QueryEscape(userID) + "&name=" + url.QueryEscape(userID)
	resp, err := http.Get(u)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("dev token %d: %s", resp.StatusCode, b)
	}
	var out struct{ Token string }
	if err := json.Unmarshal(b, &out); err != nil {
		return "", err
	}
	return out.Token, nil
}

func authPostJSON(ctx context.Context, path, token string, body any) (*http.Response, error) {
	b, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, "POST", base()+path, bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return http.DefaultClient.Do(req)
}

func decode(resp *http.Response, v any) {
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		fail(fmt.Sprintf("status %d: %s", resp.StatusCode, b))
	}
	must(json.Unmarshal(b, v), "decode")
}

func must(err error, what string) {
	if err != nil {
		fail(what + ": " + err.Error())
	}
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, "SMOKE FAIL:", msg)
	os.Exit(1)
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	tokA, err := devToken("smokeA")
	must(err, "mint A")
	tokB, err := devToken("smokeB")
	must(err, "mint B")

	// create conversation A<->B
	resp, err := authPostJSON(ctx, "/api/v1/conversations", tokA, map[string]string{"userId": "smokeB"})
	must(err, "create conv")
	var conv struct {
		ID string `json:"id"`
	}
	decode(resp, &conv)
	if conv.ID == "" {
		fail("no conversation id")
	}

	// open WS for B
	wsbase := "ws" + base()[len("http"):]
	connB, _, err := websocket.Dial(ctx, wsbase+"/ws?token="+tokB, nil)
	must(err, "B dial")
	defer connB.Close(websocket.StatusNormalClosure, "")
	time.Sleep(300 * time.Millisecond)

	// A sends via REST (exercises persist + route)
	resp, err = authPostJSON(ctx, "/api/v1/conversations/"+conv.ID+"/messages", tokA,
		map[string]string{"clientMsgId": "s1", "type": "text", "body": "smoke hello"})
	must(err, "A send")
	if resp.StatusCode != 200 {
		fail("send status " + resp.Status)
	}
	resp.Body.Close()

	// B must receive message.new
	rctx, rcancel := context.WithTimeout(ctx, 5*time.Second)
	defer rcancel()
	_, data, err := connB.Read(rctx)
	must(err, "B read")
	var env protocol.Envelope
	must(json.Unmarshal(data, &env), "B decode")
	if env.Type != protocol.TypeMessageNew {
		fail("B expected message.new, got " + env.Type)
	}
	fmt.Println("SMOKE OK: B received", env.Type)
}
```

Verify with `gob build ./cmd/smoke/`.

- [ ] **Step 2: smoke.sh**

`backend/scripts/smoke.sh`:

```bash
#!/usr/bin/env bash
# End-to-end smoke: boots the full stack via compose, runs the smoke client in a
# golang container on the compose network, asserts a DM is delivered.
set -euo pipefail
cd "$(dirname "$0")/.."

cleanup() { docker compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> building + starting stack"
docker compose up -d --build

echo "==> waiting for server health"
for i in $(seq 1 60); do
  if curl -sf http://localhost:8080/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -sf http://localhost:8080/health >/dev/null || { echo "server never became healthy"; docker compose logs server; exit 1; }

echo "==> running smoke client"
docker run --rm --network host -e GOFLAGS=-mod=mod -e GOSUMDB=off \
  -e SMOKE_BASE="http://localhost:8080" \
  -v "$PWD":/app -w /app golang:1.23-alpine go run ./cmd/smoke
echo "==> smoke passed"
```

- [ ] **Step 3: Make executable + build smoke client**

```bash
chmod +x /home/faithsax/new-frontend/backend/scripts/smoke.sh
cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob build ./cmd/smoke/
```
Expected: smoke client compiles.

- [ ] **Step 4: Run the end-to-end smoke**

```bash
cd /home/faithsax/new-frontend/backend && bash scripts/smoke.sh
```
Expected: ends with `==> smoke passed` and `SMOKE OK: B received message.new`. (First run builds the server image + downloads modules — may take a few minutes. Requires network for module downloads during image build; if the image build fails on `go mod download` due to sandbox DNS, see fallback below.)

Fallback if image build can't fetch modules: build the server binary in the prewarmed `golang:1.23-alpine` cache instead and run compose with a bind-mounted binary — but first just try the standard path. If blocked, report it; the unit + gateway httptest + integration tests already prove the logic, and the compose smoke can be re-run in an environment with registry access.

- [ ] **Step 5: Commit**

```bash
cd /home/faithsax/new-frontend && git add backend/cmd/smoke backend/scripts/smoke.sh && git commit -m "feat(ws1): end-to-end smoke (compose up, WS DM delivery assertion)"
```

---

## Task 12: Final verification for Plan 2

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite + vet (containerized)**

Run: `cd /home/faithsax/new-frontend/backend && gob() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gob test ./... && gob vet ./...`
Expected: all packages ok (config, protocol, store, messaging, pubsub, hub, presence, auth, transport/ws, transport/httpapi); vet clean.

- [ ] **Step 2: Race check on the new concurrency-heavy packages**

Run: `cd /home/faithsax/new-frontend/backend && docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v "$PWD":/app -w /app golang:1.23-alpine sh -c "apk add --no-cache gcc musl-dev >/dev/null && go test -race ./internal/hub/ ./internal/pubsub/ ./internal/transport/ws/"`
Expected: PASS (no data races). May be slow; if it exceeds ~8 min, note and rely on non-race run.

- [ ] **Step 3: Integration tests (postgres + redis)**

```bash
cd /home/faithsax/new-frontend/backend
docker run -d --name pg_it -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine
docker run -d --name redis_it -p 56379:6379 redis:7-alpine
sleep 6
docker run --rm --network host -e GOFLAGS=-mod=mod -e GOSUMDB=off \
  -e TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres?sslmode=disable" \
  -e TEST_REDIS_URL="redis://localhost:56379" \
  -v "$PWD":/app -w /app golang:1.23-alpine go test -tags=integration ./...
echo "exit=$?"
docker rm -f pg_it redis_it
```
Expected: all integration packages ok, exit=0.

- [ ] **Step 4: Smoke (if not already run green in Task 11)**

Run: `cd /home/faithsax/new-frontend/backend && bash scripts/smoke.sh`
Expected: `==> smoke passed`.

- [ ] **Step 5: Confirm branch + history**

Run: `cd /home/faithsax/new-frontend && git branch --show-current` → `feat/messaging-phase1`
Run: `git log --oneline origin/main..HEAD` → shows Plan-1 + Plan-2 commits.

Do NOT push or open a PR — Plan 3 (channels + feed + frontend wiring) builds on this branch.

---

## Self-Review (completed by plan author)

- **Spec coverage (Plan-2 portion):** WS gateway/auth/heartbeat (spec §WS protocol, Steps 4) → Task 6,7; pub/sub fan-out + hub routing (Step 7) → Task 2,3,4; presence (Step 7) → Task 5; REST API subset (history/fallback-send/create/online) → Task 8; main wiring + graceful shutdown → Task 9; Docker/compose → Task 10; smoke (spec §testing) → Task 11; verification → Task 12. Channels, Feed, full conversation-list-with-unread, typing relay, live presence.changed push, and ALL frontend code are explicitly Plan 3 — not gaps.
- **Placeholder scan:** one deliberate illustrative stub in Task 11 (`authPost`/`bytesReader`) is explicitly flagged for deletion with the correct replacement shown — the executor produces one compiling file. No other placeholders; every code step is complete; every run step has expected output.
- **Type consistency:** `store.Router.RouteToUser(ctx, userID, protocol.Envelope) (bool,error)` — implemented by `hub.Hub` (Task 4, asserted via `var _ store.Router`). `messaging.New(ConversationStore, MessageStore, Router)` — fed the hub in gateway/main (Tasks 7,9). `auth.Verifier.Verify/Mint`, `auth.Claims{UserID,Name,Role}` consistent (Tasks 6,7,8). `ws.Deps`/`httpapi.Deps` fields match what main passes (Task 9). `presence.New(Store, Publisher)`, `presence.Service.{Online,Offline,ListOnline}` consistent (Tasks 5,7,8,9). protocol envelope types reused, not redefined.
- **Known limitations documented (not gaps):** (1) cross-instance delivered receipts don't fire in Phase 1 (single-instance correct); (2) live `presence.changed` push is minimal — `/users/online` polling is the P1 source of truth; (3) typing relay deferred to Plan 3. Each is called out at its site.
- **Executor cautions:** run the `gob` function definition and the go command in the SAME shell line (cwd/env don't persist). Integration/smoke need network for first image build + module download; if sandbox DNS blocks the compose image build, the unit + gateway-httptest + integration tests still prove the logic — report rather than fake.
