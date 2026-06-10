# WS1 Messaging Phase 1 — Plan 4: Frontend Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing mock DM / Hangout-channel / Feed screens live against the Go messaging service: a separate-origin messaging API client + a WebSocket client + a `MessagingProvider`, plus the one backend read-model the UI needs (`GET /conversations`).

**Architecture:** The Go service is a different origin than ai-router, so messaging gets its own base URL (`VITE_MESSAGING_BASE_URL`) and WS URL (`VITE_MESSAGING_WS_URL`) and a dedicated client — the existing `lib/api/client.ts` (ai-router) is untouched. A `MessagingProvider` holds conversation/channel/feed/presence state, opens one WebSocket, and exposes hooks; screens swap their local mock arrays for those hooks but initialize from the existing mock so first paint is unchanged and the app stays offline-safe. Backend wire shapes are adapted to the richer UI shapes by pure mapper functions (the parts the backend can't supply — avatars, project/subject, GSIS — stay client-derived/mock, like "feed views").

**Tech Stack:** React 18 + TS, Vite. New: `vitest` (added) for the pure-logic units (mappers + WS reducer). Backend additions in Go (pgx) reuse the Plan-1/2/3 patterns.

**Spec:** `docs/superpowers/specs/2026-06-08-ws1-messaging-phase1-design.md`
**Builds on:** Plans 1–3 (committed on `feat/messaging-phase1`). **This is Plan 4 of 4** (final WS1 Phase-1 plan).

---

## Critical execution notes (READ FIRST)

- **Two repos-of-concern in one:** Go backend under `backend/`, React app under `frontend/`.
- **Go runs in Docker** with a persistent module cache:
  ```bash
  cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./...
  ```
- **Frontend has Node 22 + tsc on the host** (`frontend/node_modules/.bin/tsc`). Run frontend commands from `frontend/`. **No browser/runtime verification** — `vite` SIGBUSes in this sandbox.
- **Project-wide `tsc` is broken** (the installed `react-router-dom` types lack `Link`/`useNavigate`; `motion/react` mismatches). So the frontend gate is **`tsc` filtered to the files this plan touches** — a changed file is "clean" if it introduces no NEW error beyond that known project-wide noise. There is currently NO frontend test runner; this plan **adds vitest** so the pure-logic units (mappers, WS reducer) get real tests.
- **Git commits:** use `git -C /home/faithsax/new-frontend ...` (cwd can persist into a subdir).
- **Branch:** `feat/messaging-phase1`. After Plan 4, WS1 Phase 1 is complete → push/PR.
- **Contract reality:** the backend stores `{id, convId|channelId, senderId, type, body, ts}`. The UI wants richer objects. Mappers fill what they can from the backend + the current user; UI-only cosmetic fields (avatar initials, projectName, subject, gsis, post stats) are derived client-side or kept as their existing mock default. This is intentional and matches how prior workstreams handled gaps.

---

## File Structure (this plan)

```
backend/internal/
├─ store/store.go                  # MODIFY: add ConvSummary model + ConversationStore.SummariesForUser
├─ store/fakes.go                  # MODIFY: implement SummariesForUser on the fake
├─ store/postgres/conversations.go # MODIFY: SummariesForUser (other participant + last msg + unread)
├─ store/postgres/postgres_test.go # MODIFY: integration test for the summary
└─ transport/httpapi/
   ├─ router.go                    # MODIFY: mount GET /conversations
   ├─ conversations.go             # MODIFY: handleListConversations
   └─ httpapi_test.go              # MODIFY: list-conversations endpoint test

frontend/
├─ vitest.config.ts                # CREATE: vitest config (jsdom not needed; node env)
├─ package.json                    # MODIFY: add vitest devDep + "test" script
└─ src/
   ├─ lib/messaging/
   │  ├─ config.ts                 # CREATE: messaging base URL + WS URL + token getter
   │  ├─ client.ts                 # CREATE: msgGet/msgPost (separate base) + withFallback reuse
   │  ├─ types.ts                  # CREATE: backend wire types + UI types
   │  ├─ map.ts                    # CREATE: pure backend->UI mappers
   │  ├─ map.test.ts               # CREATE: vitest mapper tests
   │  ├─ ws.ts                     # CREATE: WebSocket client (connect/reconnect/dispatch)
   │  ├─ wsReducer.ts              # CREATE: pure reducer applying envelopes to state
   │  ├─ wsReducer.test.ts         # CREATE: vitest reducer tests
   │  ├─ conversations.ts          # CREATE: REST fetchers (list/history/send/read/create)
   │  ├─ channels.ts               # CREATE: REST fetchers (list/history/send/read)
   │  └─ feed.ts                   # CREATE: REST fetchers (list/create/like/comment)
   ├─ contexts/MessagingProvider.tsx # CREATE: provider + hooks (useDMs, useChannels, useFeed, usePresence)
   ├─ App.tsx                      # MODIFY: setMessagingToken on boot + mount <MessagingProvider>
   └─ dashboard/
      ├─ founders/section/components/founder/Messages.tsx      # MODIFY: use useDMs
      ├─ collaborators/section/components/collab/Messages.tsx  # MODIFY: use useDMs
      ├─ workspaces/pages/Chat.tsx                             # MODIFY: use useChannels
      └─ chat/Chat.tsx                                         # MODIFY: use useFeed (feed posts)
```

---

## Task 1: Backend — ConversationStore.SummariesForUser

**Files:** `backend/internal/store/store.go`, `backend/internal/store/fakes.go`, `backend/internal/store/fakes_test.go`

- [ ] **Step 1: Write the failing fake test**

Append to `backend/internal/store/fakes_test.go`:

```go
func TestFakeConversationSummaries(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	c, _, _ := f.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	m := Message{ID: "01890000-0000-7000-8000-000000000101", ConversationID: c.ID, SenderID: "u2", Type: "text", Body: "yo"}
	_ = f.Messages.InsertDM(ctx, m, "u1", "x1")
	sums, err := f.Conversations.SummariesForUser(ctx, "u1")
	if err != nil {
		t.Fatalf("summaries: %v", err)
	}
	if len(sums) != 1 {
		t.Fatalf("want 1 summary, got %d", len(sums))
	}
	s := sums[0]
	if s.ConversationID != c.ID || s.OtherUserID != "u2" || s.LastBody != "yo" || s.Unread != 1 {
		t.Fatalf("bad summary: %+v", s)
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./internal/store/`
Expected: FAIL — `SummariesForUser`/`ConvSummary` undefined.

- [ ] **Step 3: Add model + interface method (store.go)**

In `store.go`, add after the `Conversation` struct:

```go
// ConvSummary is a read-model row for the DM list: the other participant, the
// last message, and the unread count for the requesting user.
type ConvSummary struct {
	ConversationID string
	OtherUserID    string
	OtherName      string
	LastBody       string
	LastTS         time.Time
	LastMsgID      string
	Unread         int
}
```

Add to the `ConversationStore` interface:

```go
	// SummariesForUser returns the DM list read-model for userID, newest first.
	SummariesForUser(ctx context.Context, userID string) ([]ConvSummary, error)
```

- [ ] **Step 4: Implement on the fake (fakes.go)**

The fake `FakeConversationStore` tracks `convos` (pair) + `cursors`. It needs the
messages to compute last/unread — but messages live in `FakeMessageStore`. To keep
the fake self-contained, give `FakeConversationStore` a back-reference to the
message store, wired in `NewFakeStores`.

In `NewFakeStores`, after building `Messages`, set the back-ref:

```go
	st := &FakeStores{ ... } // existing construction, assign to a var instead of returning inline
	st.Conversations.msgs = st.Messages
	st.Conversations.users = st.Users
	return st
```

(Refactor `NewFakeStores` to build the struct into `st`, wire the two back-refs,
then `return st`.)

Add fields to `FakeConversationStore`:

```go
	msgs  *FakeMessageStore
	users *FakeUserStore
```

Implement:

```go
func (s *FakeConversationStore) SummariesForUser(ctx context.Context, userID string) ([]ConvSummary, error) {
	ids, _ := s.ListForUser(ctx, userID)
	out := make([]ConvSummary, 0, len(ids))
	for _, convID := range ids {
		parts, _ := s.Participants(ctx, convID)
		other := ""
		for _, u := range parts {
			if u != userID {
				other = u
			}
		}
		msgs, _ := s.msgs.MessagesByConversation(ctx, convID, "", 1) // newest first
		var sum ConvSummary
		sum.ConversationID = convID
		sum.OtherUserID = other
		if s.users != nil {
			if u, err := s.users.Get(ctx, other); err == nil {
				sum.OtherName = u.DisplayName
			}
		}
		if len(msgs) > 0 {
			sum.LastBody = msgs[0].Body
			sum.LastTS = msgs[0].CreatedAt
			sum.LastMsgID = msgs[0].ID
		}
		// unread = messages strictly after the user's read cursor
		cursor := s.cursors[convID+"|"+userID]
		all, _ := s.msgs.MessagesByConversation(ctx, convID, "", 1000)
		for _, m := range all {
			if m.SenderID != userID && (cursor == "" || m.ID > cursor) {
				sum.Unread++
			}
		}
		out = append(out, sum)
	}
	return out, nil
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./internal/store/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store && git -C /home/faithsax/new-frontend commit -m "feat(ws1): ConvSummary read-model + fake SummariesForUser"
```

---

## Task 2: Backend — Postgres SummariesForUser + GET /conversations

**Files:** `backend/internal/store/postgres/conversations.go`, `postgres.go` (assert unchanged — same interface), `postgres_test.go`, `backend/internal/transport/httpapi/{router.go,conversations.go,httpapi_test.go}`

- [ ] **Step 1: Implement Postgres SummariesForUser**

Append to `backend/internal/store/postgres/conversations.go`:

```go
func (s *ConversationStore) SummariesForUser(ctx context.Context, userID string) ([]store.ConvSummary, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT cp.conversation_id,
		       other.user_id,
		       COALESCE(u.display_name, ''),
		       COALESCE(lm.body, ''),
		       lm.created_at,
		       COALESCE(lm.id::text, ''),
		       (SELECT count(*) FROM messages m2
		          WHERE m2.conversation_id = cp.conversation_id
		            AND m2.sender_id <> $1
		            AND (cp.last_read_msg_id IS NULL OR m2.id > cp.last_read_msg_id)) AS unread
		FROM conversation_participants cp
		JOIN conversation_participants other
		  ON other.conversation_id = cp.conversation_id AND other.user_id <> cp.user_id
		LEFT JOIN users u ON u.id = other.user_id
		LEFT JOIN LATERAL (
		  SELECT id, body, created_at FROM messages m
		  WHERE m.conversation_id = cp.conversation_id
		  ORDER BY m.id DESC LIMIT 1
		) lm ON true
		WHERE cp.user_id = $1
		ORDER BY lm.created_at DESC NULLS LAST`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.ConvSummary
	for rows.Next() {
		var c store.ConvSummary
		var lastTS *time.Time
		if err := rows.Scan(&c.ConversationID, &c.OtherUserID, &c.OtherName, &c.LastBody, &lastTS, &c.LastMsgID, &c.Unread); err != nil {
			return nil, err
		}
		if lastTS != nil {
			c.LastTS = *lastTS
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
```

Add `"time"` to the imports of `conversations.go` if not already present.

- [ ] **Step 2: Add the integration test**

Append to `backend/internal/store/postgres/postgres_test.go`:

```go
func TestPostgresConversationSummaries(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "Alice"})
	_ = st.Users.Upsert(ctx, store.User{ID: uuidB, DisplayName: "Bob"})
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, uuidA, uuidB)
	m := store.Message{ID: protocol.NewMsgID(), ConversationID: c.ID, SenderID: uuidB, Type: "text", Body: "hi alice"}
	if err := st.Messages.InsertDM(ctx, m, uuidA, "s1"); err != nil {
		t.Fatalf("insert: %v", err)
	}
	sums, err := st.Conversations.SummariesForUser(ctx, uuidA)
	if err != nil {
		t.Fatalf("summaries: %v", err)
	}
	if len(sums) != 1 {
		t.Fatalf("want 1, got %d", len(sums))
	}
	s := sums[0]
	if s.OtherUserID != uuidB || s.OtherName != "Bob" || s.LastBody != "hi alice" || s.Unread != 1 {
		t.Fatalf("bad summary: %+v", s)
	}
}
```

- [ ] **Step 3: Add the HTTP handler**

In `backend/internal/transport/httpapi/conversations.go`, add:

```go
func handleListConversations(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		sums, err := d.Conversations.SummariesForUser(r.Context(), me)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(sums))
		for _, s := range sums {
			out = append(out, map[string]any{
				"id": s.ConversationID, "otherUserId": s.OtherUserID, "otherName": s.OtherName,
				"lastBody": s.LastBody, "lastTs": s.LastTS, "lastMsgId": s.LastMsgID, "unread": s.Unread,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"conversations": out})
	}
}
```

- [ ] **Step 4: Mount the route**

In `router.go`, inside the authed group, add (next to the other `/conversations` routes):

```go
			r.Get("/conversations", handleListConversations(d))
```

- [ ] **Step 5: Add endpoint test**

Append to `httpapi_test.go`:

```go
func TestListConversationsEndpoint(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "u1", DisplayName: "U1"})
	_ = st.Users.Upsert(ctx, store.User{ID: "u2", DisplayName: "U2"})
	c, _, _ := st.Conversations.GetOrCreateDM(ctx, "u1", "u2")
	_ = st.Messages.InsertDM(ctx, store.Message{ID: "01890000-0000-7000-8000-0000000000f1", ConversationID: c.ID, SenderID: "u2", Type: "text", Body: "hello"}, "u1", "x")
	tok, _ := ver.Mint("u1", "U1", "founder")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/v1/conversations", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("code=%d body=%s", rec.Code, rec.Body)
	}
	var resp struct {
		Conversations []map[string]any
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if len(resp.Conversations) != 1 {
		t.Fatalf("want 1 conversation, got %d", len(resp.Conversations))
	}
}
```

- [ ] **Step 6: Run unit + build, then integration**

Run unit: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc build ./... && gobc test ./...`
Expected: all unit packages ok (includes the new httpapi + store tests).

Run integration (pg+redis up per the Plan-3 command):
```bash
cd /home/faithsax/new-frontend/backend
docker rm -f pg_it redis_it >/dev/null 2>&1
docker run -d --name pg_it -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16-alpine >/dev/null
docker run -d --name redis_it -p 56379:6379 redis:7-alpine >/dev/null ; sleep 8
docker run --rm --network host -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod \
  -e TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres?sslmode=disable" \
  -e TEST_REDIS_URL="redis://localhost:56379" \
  -v "$PWD":/app -w /app golang:1.23-alpine go test -tags=integration ./internal/store/postgres/ 2>&1 | tail -4
docker rm -f pg_it redis_it >/dev/null 2>&1
```
Expected: `ok ... postgres` (the new summary test passes).

- [ ] **Step 7: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store/postgres backend/internal/transport/httpapi && git -C /home/faithsax/new-frontend commit -m "feat(ws1): GET /conversations list read-model (other participant + last msg + unread)"
```

---

## Task 3: Frontend — add vitest

**Files:** `frontend/package.json`, `frontend/vitest.config.ts`

- [ ] **Step 1: Add vitest config**

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Add devDep + script**

In `frontend/package.json`, add to `devDependencies`: `"vitest": "^2.1.8"`, and to
`scripts`: `"test": "vitest run"`.

- [ ] **Step 3: Install + sanity test**

```bash
cd /home/faithsax/new-frontend/frontend && npm install >/dev/null 2>&1 && echo "installed"
printf 'import { test, expect } from "vitest";\ntest("sanity", () => { expect(1+1).toBe(2); });\n' > src/lib/_sanity.test.ts
npx vitest run src/lib/_sanity.test.ts 2>&1 | tail -6
rm -f src/lib/_sanity.test.ts```
Expected: `1 passed`. (vitest pulled on install; if `npm install` can't reach the registry in-sandbox, report it — the rest of the plan's component edits still apply, only the `.test.ts` gates can't run.)

- [ ] **Step 4: Commit**

```bash
git -C /home/faithsax/new-frontend add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts && git -C /home/faithsax/new-frontend commit -m "chore(ws1): add vitest for messaging pure-logic tests"
```

---

## Task 4: Messaging config + client (separate origin)

**Files:** Create `frontend/src/lib/messaging/config.ts`, `frontend/src/lib/messaging/client.ts`

- [ ] **Step 1: config.ts**

`frontend/src/lib/messaging/config.ts`:

```ts
// Messaging service config — a SEPARATE origin from ai-router (lib/api/config.ts).
const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};

export const MESSAGING_BASE_URL: string =
  (env.VITE_MESSAGING_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

export const MESSAGING_WS_URL: string =
  env.VITE_MESSAGING_WS_URL ?? "ws://localhost:8080/ws";

export const MESSAGING_PREFIX = "/api/v1";

export const MESSAGING_FALLBACK_ENABLED: boolean = env.VITE_API_STRICT !== "1";

// Auth token getter; defaults to the AuthContext localStorage key.
let tokenGetter: () => string | null = () => {
  try {
    return localStorage.getItem("techit_token");
  } catch {
    return null;
  }
};
export function setMessagingToken(getter: () => string | null) {
  tokenGetter = getter;
}
export function messagingToken(): string | null {
  return tokenGetter();
}

export function messagingUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${MESSAGING_BASE_URL}${clean.startsWith(MESSAGING_PREFIX) ? "" : MESSAGING_PREFIX}${clean}`;
}
```

- [ ] **Step 2: client.ts**

`frontend/src/lib/messaging/client.ts`:

```ts
import {
  messagingUrl,
  messagingToken,
  MESSAGING_FALLBACK_ENABLED,
} from "./config";

function headers(extra?: HeadersInit): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const t = messagingToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return { ...h, ...(extra as Record<string, string>) };
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`messaging ${res.status}`);
  return (await res.json()) as T;
}

export async function msgGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(messagingUrl(path), { method: "GET", headers: headers(init?.headers), ...init });
  return parse<T>(res);
}

export async function msgPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(messagingUrl(path), {
    method: "POST",
    headers: headers(init?.headers),
    body: body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
  return parse<T>(res);
}

export async function msgDelete<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(messagingUrl(path), { method: "DELETE", headers: headers(init?.headers), ...init });
  return parse<T>(res);
}

// Mirrors lib/api/client.ts withFallback so screens stay offline-safe.
export async function withFallback<T>(call: () => Promise<T>, fallback: T | (() => T), label?: string): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (!MESSAGING_FALLBACK_ENABLED) throw err;
    if (typeof console !== "undefined") console.warn(`[msg] ${label ?? "request"} failed; using fallback`, err);
    return typeof fallback === "function" ? (fallback as () => T)() : fallback;
  }
}
```

- [ ] **Step 3: tsc compile (no NEW errors in these files)**

Run: `cd /home/faithsax/new-frontend/frontend && npx tsc -b --noEmit 2>&1 | grep -E "lib/messaging/(config|client)\.ts" || echo "no new errors in config/client"`
Expected: `no new errors in config/client` (the global react-router noise is unrelated).

- [ ] **Step 4: Commit**

```bash
git -C /home/faithsax/new-frontend add frontend/src/lib/messaging/config.ts frontend/src/lib/messaging/client.ts && git -C /home/faithsax/new-frontend commit -m "feat(ws1): messaging API client (separate base url + token)"
```

---

## Task 5: Wire types + pure mappers (vitest-tested)

**Files:** Create `frontend/src/lib/messaging/types.ts`, `map.ts`, `map.test.ts`

- [ ] **Step 1: Write the failing mapper test**

`frontend/src/lib/messaging/map.test.ts`:

```ts
import { test, expect } from "vitest";
import { initials, mapMessage, mapConvSummary } from "./map";

test("initials derives up to two uppercase letters", () => {
  expect(initials("Sarah Kim")).toBe("SK");
  expect(initials("madonna")).toBe("M");
  expect(initials("")).toBe("?");
});

test("mapMessage marks fromMe and carries body/timestamp", () => {
  const m = mapMessage({ id: "m1", convId: "c1", senderId: "u2", type: "text", body: "hi", ts: "2026-06-10T00:00:00Z" }, "u1");
  expect(m.id).toBe("m1");
  expect(m.fromMe).toBe(false);
  expect(m.body).toBe("hi");
  expect(m.timestamp).toBe("2026-06-10T00:00:00Z");

  const mine = mapMessage({ id: "m2", convId: "c1", senderId: "u1", type: "text", body: "yo", ts: "2026-06-10T00:01:00Z" }, "u1");
  expect(mine.fromMe).toBe(true);
});

test("mapConvSummary builds a UI Conversation with derived avatar", () => {
  const c = mapConvSummary({ id: "c1", otherUserId: "u2", otherName: "Sarah Kim", lastBody: "hey", lastTs: "2026-06-10T00:00:00Z", lastMsgId: "m1", unread: 2 });
  expect(c.id).toBe("c1");
  expect(c.participantName).toBe("Sarah Kim");
  expect(c.participantAvatar).toBe("SK");
  expect(c.unread).toBe(true);
  expect(c.thread).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/frontend && npx vitest run src/lib/messaging/map.test.ts 2>&1 | tail -6`
Expected: FAIL — cannot find `./map` exports.

- [ ] **Step 3: types.ts**

`frontend/src/lib/messaging/types.ts`:

```ts
// Backend wire shapes (what the Go service returns).
export interface WireMessage {
  id: string;
  convId?: string;
  channelId?: string;
  senderId: string;
  type: string;
  body: string;
  ts: string;
}
export interface WireConvSummary {
  id: string;
  otherUserId: string;
  otherName: string;
  lastBody: string;
  lastTs: string;
  lastMsgId: string;
  unread: number;
}
export interface WireChannel { id: string; name: string; kind: string }
export interface WirePost {
  id: string;
  authorId: string;
  kind: string;
  body: string;
  ts: string;
}

// UI shapes the screens already use (kept identical to the existing mock types).
export interface UIMessage {
  id: string;
  fromMe: boolean;
  authorName: string;
  body: string;
  timestamp: string;
}
export interface UIConversation {
  id: string;
  participantName: string;
  participantAvatar: string;
  projectName: string;
  subject: string;
  unread: boolean;
  thread: UIMessage[];
}
```

- [ ] **Step 4: map.ts**

`frontend/src/lib/messaging/map.ts`:

```ts
import type { WireMessage, WireConvSummary, UIMessage, UIConversation } from "./types";

/** Derive up to two uppercase initials from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

/** Map a backend message to the UI message shape relative to the current user. */
export function mapMessage(m: WireMessage, currentUserId: string, authorName = ""): UIMessage {
  const mine = m.senderId === currentUserId;
  return {
    id: m.id,
    fromMe: mine,
    authorName: mine ? "You" : authorName || m.senderId,
    body: m.body,
    timestamp: m.ts,
  };
}

/** Map a backend conversation summary to the UI conversation list item.
 * projectName/subject have no backend source in Phase 1 — left blank (UI shows
 * the participant + last message), consistent with the mock-metadata approach. */
export function mapConvSummary(s: WireConvSummary): UIConversation {
  return {
    id: s.id,
    participantName: s.otherName || s.otherUserId,
    participantAvatar: initials(s.otherName || s.otherUserId),
    projectName: "",
    subject: s.lastBody,
    unread: s.unread > 0,
    thread: [],
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/frontend && npx vitest run src/lib/messaging/map.test.ts 2>&1 | tail -6`
Expected: `3 passed`.

- [ ] **Step 6: Commit**

```bash
git -C /home/faithsax/new-frontend add frontend/src/lib/messaging/types.ts frontend/src/lib/messaging/map.ts frontend/src/lib/messaging/map.test.ts && git -C /home/faithsax/new-frontend commit -m "feat(ws1): messaging wire/UI types + pure mappers (vitest)"
```

---

## Task 6: WS reducer (vitest-tested) + WS client

**Files:** Create `frontend/src/lib/messaging/wsReducer.ts`, `wsReducer.test.ts`, `ws.ts`

The reducer is the pure, testable core: given the current store and an inbound
envelope, return the next store. The `ws.ts` client owns the socket lifecycle and
calls the reducer; only the reducer is unit-tested.

- [ ] **Step 1: Write the failing reducer test**

`frontend/src/lib/messaging/wsReducer.test.ts`:

```ts
import { test, expect } from "vitest";
import { emptyStore, applyEnvelope, type MsgStore } from "./wsReducer";

const me = "u1";

test("message.new appends to the conversation thread", () => {
  let s: MsgStore = emptyStore();
  s = applyEnvelope(s, { type: "message.new", id: "e1", ts: "t", data: { id: "m1", convId: "c1", senderId: "u2", type: "text", body: "hi", ts: "t" } }, me);
  expect(s.threads["c1"]?.length).toBe(1);
  expect(s.threads["c1"][0].fromMe).toBe(false);
});

test("message.new appends channel messages by channelId", () => {
  let s: MsgStore = emptyStore();
  s = applyEnvelope(s, { type: "message.new", id: "e1", ts: "t", data: { id: "m1", channelId: "ch1", senderId: "u2", type: "text", body: "yo", ts: "t" } }, me);
  expect(s.channelThreads["ch1"]?.length).toBe(1);
});

test("presence.changed updates the online set", () => {
  let s: MsgStore = emptyStore();
  s = applyEnvelope(s, { type: "presence.changed", id: "e", ts: "t", data: { userId: "u2", online: true } }, me);
  expect(s.online["u2"]).toBe(true);
  s = applyEnvelope(s, { type: "presence.changed", id: "e", ts: "t", data: { userId: "u2", online: false } }, me);
  expect(s.online["u2"]).toBe(false);
});

test("post.new prepends to the feed", () => {
  let s: MsgStore = emptyStore();
  s = applyEnvelope(s, { type: "post.new", id: "e", ts: "t", data: { id: "p1", authorId: "u2", kind: "update", body: "shipped", ts: "t" } }, me);
  expect(s.feed[0]?.id).toBe("p1");
});

test("unknown envelope type is a no-op (same reference is fine)", () => {
  const s0 = emptyStore();
  const s1 = applyEnvelope(s0, { type: "totally.unknown", id: "e", ts: "t" }, me);
  expect(s1.feed.length).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/frontend && npx vitest run src/lib/messaging/wsReducer.test.ts 2>&1 | tail -6`
Expected: FAIL — cannot find `./wsReducer`.

- [ ] **Step 3: wsReducer.ts**

`frontend/src/lib/messaging/wsReducer.ts`:

```ts
import { mapMessage, type } from "./map";
import type { UIMessage, WireMessage, WirePost } from "./types";

export interface Envelope {
  type: string;
  id: string;
  ts: string;
  data?: Record<string, unknown>;
}

export interface FeedPost {
  id: string;
  authorId: string;
  kind: string;
  body: string;
  ts: string;
  likeCount: number;
}

export interface MsgStore {
  threads: Record<string, UIMessage[]>;        // convId -> messages
  channelThreads: Record<string, UIMessage[]>; // channelId -> messages
  online: Record<string, boolean>;
  feed: FeedPost[];
}

export function emptyStore(): MsgStore {
  return { threads: {}, channelThreads: {}, online: {}, feed: [] };
}

export function applyEnvelope(s: MsgStore, env: Envelope, me: string): MsgStore {
  const d = env.data ?? {};
  switch (env.type) {
    case "message.new": {
      const wm = d as unknown as WireMessage;
      const ui = mapMessage(wm, me);
      if (wm.channelId) {
        const prev = s.channelThreads[wm.channelId] ?? [];
        return { ...s, channelThreads: { ...s.channelThreads, [wm.channelId]: [...prev, ui] } };
      }
      const cid = wm.convId ?? "";
      const prev = s.threads[cid] ?? [];
      return { ...s, threads: { ...s.threads, [cid]: [...prev, ui] } };
    }
    case "presence.changed": {
      const userId = String(d.userId ?? "");
      const online = Boolean(d.online);
      return { ...s, online: { ...s.online, [userId]: online } };
    }
    case "post.new": {
      const wp = d as unknown as WirePost;
      return { ...s, feed: [{ ...wp, likeCount: 0 }, ...s.feed] };
    }
    case "post.liked": {
      const postId = String(d.postId ?? "");
      const likeCount = Number(d.likeCount ?? 0);
      return { ...s, feed: s.feed.map((p) => (p.id === postId ? { ...p, likeCount } : p)) };
    }
    default:
      return s;
  }
}
```

NOTE: the import `import { mapMessage, type } from "./map";` is wrong — `type` is
not an export. Use exactly: `import { mapMessage } from "./map";`. (Stated
explicitly so the executor does not copy the typo.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/frontend && npx vitest run src/lib/messaging/wsReducer.test.ts 2>&1 | tail -6`
Expected: `5 passed`.

- [ ] **Step 5: ws.ts (socket lifecycle; not unit-tested)**

`frontend/src/lib/messaging/ws.ts`:

```ts
import { MESSAGING_WS_URL, messagingToken } from "./config";
import { applyEnvelope, emptyStore, type Envelope, type MsgStore } from "./wsReducer";

type Listener = (store: MsgStore) => void;

// MessagingSocket owns one WebSocket, applies inbound envelopes through the pure
// reducer, and notifies listeners. Auto-reconnects with exponential backoff.
export class MessagingSocket {
  private ws: WebSocket | null = null;
  private store: MsgStore = emptyStore();
  private listeners = new Set<Listener>();
  private backoff = 1000;
  private closedByUs = false;
  private me: string;

  constructor(me: string) {
    this.me = me;
  }

  getStore(): MsgStore {
    return this.store;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  connect(): void {
    const token = messagingToken();
    if (!token) return; // no identity yet; caller retries after login
    this.closedByUs = false;
    const url = `${MESSAGING_WS_URL}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onmessage = (e) => {
      try {
        const env = JSON.parse(e.data) as Envelope;
        this.store = applyEnvelope(this.store, env, this.me);
        this.listeners.forEach((l) => l(this.store));
      } catch {
        /* ignore malformed frame */
      }
    };
    ws.onopen = () => {
      this.backoff = 1000;
    };
    ws.onclose = () => {
      if (this.closedByUs) return;
      const jitter = Math.floor(Math.random() * 400);
      setTimeout(() => this.connect(), this.backoff + jitter);
      this.backoff = Math.min(this.backoff * 2, 30000);
    };
  }

  send(env: { type: string; data: Record<string, unknown> }): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...env, id: cryptoRandomId(), ts: new Date().toISOString() }));
    }
  }

  close(): void {
    this.closedByUs = true;
    this.ws?.close();
    this.ws = null;
  }
}

function cryptoRandomId(): string {
  // Best-effort client id for envelope.id; server generates the authoritative msg id.
  const a = new Uint8Array(8);
  (globalThis.crypto ?? ({ getRandomValues: (x: Uint8Array) => x } as Crypto)).getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 6: tsc (no NEW errors in the messaging dir)**

Run: `cd /home/faithsax/new-frontend/frontend && npx tsc -b --noEmit 2>&1 | grep -E "lib/messaging/" || echo "no new errors in lib/messaging"`
Expected: `no new errors in lib/messaging`.

- [ ] **Step 7: Commit**

```bash
git -C /home/faithsax/new-frontend add frontend/src/lib/messaging/wsReducer.ts frontend/src/lib/messaging/wsReducer.test.ts frontend/src/lib/messaging/ws.ts && git -C /home/faithsax/new-frontend commit -m "feat(ws1): WS reducer (vitest) + socket client"
```

---

## Task 7: REST fetchers (conversations, channels, feed)

**Files:** Create `frontend/src/lib/messaging/conversations.ts`, `channels.ts`, `feed.ts`

- [ ] **Step 1: conversations.ts**

```ts
import { msgGet, msgPost, withFallback } from "./client";
import type { WireConvSummary, WireMessage } from "./types";

export function fetchConversations(): Promise<WireConvSummary[]> {
  return withFallback(
    async () => (await msgGet<{ conversations: WireConvSummary[] }>("/conversations")).conversations,
    [],
    "conversations",
  );
}
export function fetchHistory(convId: string): Promise<WireMessage[]> {
  return withFallback(
    async () => (await msgGet<{ messages: WireMessage[] }>(`/conversations/${convId}/messages`)).messages,
    [],
    "dm history",
  );
}
export function createConversation(userId: string): Promise<{ id: string } | null> {
  return withFallback(() => msgPost<{ id: string }>("/conversations", { userId }), () => null, "create conversation");
}
export function restSendDM(convId: string, clientMsgId: string, body: string): Promise<{ msgId: string } | null> {
  return withFallback(
    () => msgPost<{ msgId: string }>(`/conversations/${convId}/messages`, { clientMsgId, type: "text", body }),
    () => null,
    "rest send dm",
  );
}
export function markConvRead(convId: string, msgId: string): Promise<unknown> {
  return withFallback(() => msgPost(`/conversations/${convId}/read`, { msgId }), () => null, "mark read");
}
```

- [ ] **Step 2: channels.ts**

```ts
import { msgGet, msgPost, withFallback } from "./client";
import type { WireChannel, WireMessage } from "./types";

export function fetchChannels(): Promise<WireChannel[]> {
  return withFallback(
    async () => (await msgGet<{ channels: WireChannel[] }>("/channels")).channels,
    [],
    "channels",
  );
}
export function fetchChannelHistory(channelId: string): Promise<WireMessage[]> {
  return withFallback(
    async () => (await msgGet<{ messages: WireMessage[] }>(`/channels/${channelId}/messages`)).messages,
    [],
    "channel history",
  );
}
export function restSendChannel(channelId: string, clientMsgId: string, body: string): Promise<{ msgId: string } | null> {
  return withFallback(
    () => msgPost<{ msgId: string }>(`/channels/${channelId}/messages`, { clientMsgId, type: "text", body }),
    () => null,
    "rest send channel",
  );
}
```

- [ ] **Step 3: feed.ts**

```ts
import { msgGet, msgPost, msgDelete, withFallback } from "./client";
import type { WirePost } from "./types";

export function fetchPosts(): Promise<WirePost[]> {
  return withFallback(async () => (await msgGet<{ posts: WirePost[] }>("/posts")).posts, [], "posts");
}
export function createPost(kind: string, body: string): Promise<WirePost | null> {
  return withFallback(() => msgPost<WirePost>("/posts", { kind, body }), () => null, "create post");
}
export function likePost(postId: string): Promise<{ likeCount: number } | null> {
  return withFallback(() => msgPost<{ likeCount: number }>(`/posts/${postId}/like`, {}), () => null, "like post");
}
export function unlikePost(postId: string): Promise<{ likeCount: number } | null> {
  return withFallback(() => msgDelete<{ likeCount: number }>(`/posts/${postId}/like`), () => null, "unlike post");
}
```

- [ ] **Step 4: tsc + commit**

Run: `cd /home/faithsax/new-frontend/frontend && npx tsc -b --noEmit 2>&1 | grep -E "lib/messaging/(conversations|channels|feed)\.ts" || echo "no new errors"`
Expected: `no new errors`.

```bash
git -C /home/faithsax/new-frontend add frontend/src/lib/messaging/conversations.ts frontend/src/lib/messaging/channels.ts frontend/src/lib/messaging/feed.ts && git -C /home/faithsax/new-frontend commit -m "feat(ws1): messaging REST fetchers (conversations, channels, feed)"
```

---

## Task 8: MessagingProvider + app boot wiring

**Files:** Create `frontend/src/contexts/MessagingProvider.tsx`; modify `frontend/src/App.tsx`

- [ ] **Step 1: MessagingProvider.tsx**

```tsx
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MessagingSocket } from "@/lib/messaging/ws";
import type { MsgStore } from "@/lib/messaging/wsReducer";
import { emptyStore } from "@/lib/messaging/wsReducer";

interface MessagingCtx {
  store: MsgStore;
  socket: MessagingSocket | null;
}
const Ctx = createContext<MessagingCtx>({ store: emptyStore(), socket: null });

// currentUserId is read from AuthContext localStorage to avoid a hard dependency.
function currentUserId(): string {
  try {
    const u = localStorage.getItem("techit_user");
    if (u) return (JSON.parse(u) as { id?: string }).id ?? "";
  } catch {
    /* ignore */
  }
  return "";
}

export function MessagingProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<MsgStore>(emptyStore());
  const socketRef = useRef<MessagingSocket | null>(null);

  useEffect(() => {
    const me = currentUserId();
    const socket = new MessagingSocket(me);
    socketRef.current = socket;
    const unsub = socket.subscribe(setStore);
    socket.connect();
    return () => {
      unsub();
      socket.close();
    };
  }, []);

  return <Ctx.Provider value={{ store, socket: socketRef.current }}>{children}</Ctx.Provider>;
}

export function useMessaging(): MessagingCtx {
  return useContext(Ctx);
}
```

- [ ] **Step 2: Mount provider + token in App.tsx**

In `frontend/src/App.tsx`, add imports:
```tsx
import { MessagingProvider } from "@/contexts/MessagingProvider";
import { setMessagingToken } from "@/lib/messaging/config";
```
At the top of the `App` component body, wire the token getter once:
```tsx
  setMessagingToken(() => {
    try { return localStorage.getItem("techit_token"); } catch { return null; }
  });
```
Wrap the existing `<Routes>...</Routes>` (currently inside `<UserProvider>`) with
`<MessagingProvider>`:
```tsx
  <UserProvider>
    <MessagingProvider>
      {/* existing <Routes> ... </Routes> */}
    </MessagingProvider>
  </UserProvider>
```
(Keep `<ThemeToggle />` where it is.)

- [ ] **Step 3: tsc (no new errors in the touched files)**

Run: `cd /home/faithsax/new-frontend/frontend && npx tsc -b --noEmit 2>&1 | grep -E "contexts/MessagingProvider\.tsx|App\.tsx" | grep -v "react-router-dom" || echo "no new genuine errors"`
Expected: `no new genuine errors` (App.tsx may still surface the project-wide router noise; that's pre-existing).

- [ ] **Step 4: Commit**

```bash
git -C /home/faithsax/new-frontend add frontend/src/contexts/MessagingProvider.tsx frontend/src/App.tsx && git -C /home/faithsax/new-frontend commit -m "feat(ws1): MessagingProvider + app boot wiring (token + socket)"
```

---

## Task 9: Wire the DM screens

**Files:** modify `frontend/src/dashboard/founders/section/components/founder/Messages.tsx` and `frontend/src/dashboard/collaborators/section/components/collab/Messages.tsx`

Both screens own a `conversations` state initialized from mock. The change:
on mount, fetch the real conversation list + (when a conversation is selected) its
history, map to the existing UI shape, and merge over the mock — keeping the mock
as the offline fallback (the fetchers already return `[]` on failure, so guard:
only replace when the response is non-empty). Send goes through the socket if open,
else REST.

- [ ] **Step 1: Founder Messages.tsx — fetch + map list/history**

Add imports at the top of `Messages.tsx`:
```tsx
import { fetchConversations, fetchHistory, restSendDM } from "@/lib/messaging/conversations";
import { mapConvSummary, mapMessage } from "@/lib/messaging/map";
import { useMessaging } from "@/contexts/MessagingProvider";
```
After the existing `const [conversations, setConversations] = useState(...)`, add a
load effect:
```tsx
  const { store } = useMessaging();
  useEffect(() => {
    let alive = true;
    fetchConversations().then((list) => {
      if (alive && list.length > 0) setConversations(list.map(mapConvSummary));
    });
    return () => { alive = false; };
  }, []);
  // when a conversation is selected, load its history once
  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    fetchHistory(activeId).then((msgs) => {
      if (!alive || msgs.length === 0) return;
      const me = (() => { try { return JSON.parse(localStorage.getItem("techit_user") || "{}").id || ""; } catch { return ""; } })();
      const thread = msgs.slice().reverse().map((m) => mapMessage(m, me));
      setConversations((cur) => cur.map((c) => (c.id === activeId ? { ...c, thread } : c)));
    });
    return () => { alive = false; };
  }, [activeId]);
  // live: when the socket store gains messages for the active conversation, merge
  useEffect(() => {
    if (!activeId) return;
    const live = store.threads[activeId];
    if (!live || live.length === 0) return;
    setConversations((cur) => cur.map((c) => {
      if (c.id !== activeId) return c;
      const seen = new Set(c.thread.map((m) => m.id));
      const merged = [...c.thread, ...live.filter((m) => !seen.has(m.id))];
      return { ...c, thread: merged };
    }));
  }, [store, activeId]);
```

- [ ] **Step 2: Founder Messages.tsx — send through socket/REST**

Replace the body of `handleSend` so it still updates local state optimistically
(unchanged UX) AND emits to the backend:
```tsx
  const handleSend = () => {
    if (!draft.trim() || !activeId) return;
    const clientMsgId = `cm-${Date.now()}`;
    const msg: ConversationMessage = {
      id: clientMsgId,
      fromMe: true,
      authorName: "You",
      body: draft.trim(),
      timestamp: new Date().toISOString(),
    };
    setConversations((cur) =>
      cur.map((c) => (c.id === activeId ? { ...c, thread: [...c.thread, msg] } : c)),
    );
    // emit to backend: socket if connected, else REST fallback
    if (socket) {
      socket.send({ type: "message.send", data: { convId: activeId, clientMsgId, type: "text", body: draft.trim() } });
    } else {
      void restSendDM(activeId, clientMsgId, draft.trim());
    }
    setDraft("");
  };
```
and pull `socket` from the hook (extend the destructure): `const { store, socket } = useMessaging();`

- [ ] **Step 3: Collaborator Messages.tsx — same wiring**

Apply the identical three effects (Step 1) and `handleSend` change (Step 2) to
`collaborators/section/components/collab/Messages.tsx` — it shares the exact
`Conversation`/`ConversationMessage` shapes (from `mockData.ts`), so the code is
the same; only the import path for the mock differs (already present in that file).

- [ ] **Step 4: tsc (no NEW errors)**

Run: `cd /home/faithsax/new-frontend/frontend && npx tsc -b --noEmit 2>&1 | grep -E "founder/Messages\.tsx|collab/Messages\.tsx" | grep -v "react-router-dom" || echo "no new genuine errors"`
Expected: `no new genuine errors`.

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add "frontend/src/dashboard/founders/section/components/founder/Messages.tsx" "frontend/src/dashboard/collaborators/section/components/collab/Messages.tsx" && git -C /home/faithsax/new-frontend commit -m "feat(ws1): wire DM screens to messaging backend (list/history/live/send)"
```

---

## Task 10: Wire channels + feed screens

**Files:** modify `frontend/src/dashboard/workspaces/pages/Chat.tsx` (channels) and `frontend/src/dashboard/chat/Chat.tsx` (feed)

These screens use richer cosmetic shapes (avatar colors, GSIS, post stats) the
backend can't supply. Wire the parts the backend owns — real channel messages and
real feed posts/likes — and keep the cosmetic fields at their existing mock
defaults via a mapper.

- [ ] **Step 1: Workspace Chat.tsx — live channel messages**

Add imports:
```tsx
import { fetchChannelHistory, restSendChannel } from "@/lib/messaging/channels";
import { useMessaging } from "@/contexts/MessagingProvider";
```
The component currently renders a const `messages: Message[]`. Convert it to state
and load/merge backend channel messages for the selected channel, mapping each
`WireMessage` to the screen's `Message` shape (cosmetic fields defaulted):
```tsx
  const { store, socket } = useMessaging();
  const [liveMessages, setLiveMessages] = useState<Message[]>(messages);
  useEffect(() => {
    const chId = String(selectedChannel.id);
    let alive = true;
    fetchChannelHistory(chId).then((ms) => {
      if (!alive || ms.length === 0) return;
      setLiveMessages(ms.slice().reverse().map((m, i) => ({
        id: i + 1, user: m.senderId, avatar: m.senderId.slice(0, 2).toUpperCase(),
        color: "bg-slate-500", message: m.body, time: new Date(m.ts).toLocaleTimeString(),
      })));
    });
    return () => { alive = false; };
  }, [selectedChannel]);
  // live channel messages from the socket store
  useEffect(() => {
    const chId = String(selectedChannel.id);
    const live = store.channelThreads[chId];
    if (!live || live.length === 0) return;
    setLiveMessages((cur) => [
      ...cur,
      ...live.map((m, i) => ({ id: cur.length + i + 1, user: m.authorName, avatar: m.authorName.slice(0, 2).toUpperCase(), color: "bg-slate-500", message: m.body, time: new Date(m.timestamp).toLocaleTimeString() })),
    ]);
  }, [store, selectedChannel]);
```
Render `liveMessages` instead of `messages` in the message list. Wire the send
button to `socket.send({ type: "message.send", data: { channelId: String(selectedChannel.id), clientMsgId, type: "text", body: message } })` (or `restSendChannel` fallback) and clear the input.

NOTE: `selectedChannel.id` is a number in the mock; the backend uses string IDs.
For Phase-1 wiring, real channels come from the backend `/channels` list — replace
the mock `channels` const with a `fetchChannels()` load so the IDs are the real
string UUIDs. If you keep the mock channel list for now, channel send/history will
hit non-existent backend channels and fall back to empty (offline-safe). Prefer
loading real channels; if deferring, leave a one-line `// TODO: load real channels`
and the screen stays mock — acceptable for this task, but note it in the commit.

- [ ] **Step 2: Feed Chat.tsx — real posts + create + like**

Add imports:
```tsx
import { fetchPosts, createPost, likePost } from "@/lib/messaging/feed";
import { useMessaging } from "@/contexts/MessagingProvider";
```
Convert `SAMPLE_POSTS` usage to state seeded from the mock; on mount load real
posts and map each `WirePost` into the screen's `Post` shape (cosmetic fields
defaulted):
```tsx
  const { store } = useMessaging();
  const [posts, setPosts] = useState<Post[]>(SAMPLE_POSTS);
  useEffect(() => {
    let alive = true;
    fetchPosts().then((ps) => {
      if (!alive || ps.length === 0) return;
      setPosts(ps.map((p) => ({
        id: p.id,
        author: { name: p.authorId, role: "", avatar: p.authorId.slice(0, 2).toUpperCase(), initials: p.authorId.slice(0, 2).toUpperCase(), avatarColor: "from-slate-400 to-slate-500" },
        timestamp: new Date(p.ts).toLocaleString(),
        gsis: 0,
        type: (["milestone","insight","problem","question","collab-call"].includes(p.kind) ? p.kind : "insight") as Post["type"],
        title: p.body,
        description: "",
        engagement: { likes: 0, comments: 0 },
      })));
    });
    return () => { alive = false; };
  }, []);
  // live: prepend new posts arriving over the socket
  useEffect(() => {
    if (store.feed.length === 0) return;
    setPosts((cur) => {
      const seen = new Set(cur.map((p) => p.id));
      const fresh = store.feed.filter((p) => !seen.has(p.id)).map((p) => ({
        id: p.id,
        author: { name: p.authorId, role: "", avatar: p.authorId.slice(0,2).toUpperCase(), initials: p.authorId.slice(0,2).toUpperCase(), avatarColor: "from-slate-400 to-slate-500" },
        timestamp: "just now", gsis: 0, type: "insight" as Post["type"], title: p.body, description: "",
        engagement: { likes: p.likeCount, comments: 0 },
      }));
      return [...fresh, ...cur];
    });
  }, [store]);
```
Render `posts` instead of `SAMPLE_POSTS`. If the screen has a composer, wire it to
`createPost("update", text)`; wire any like control to `likePost(post.id)`.

- [ ] **Step 3: tsc (no NEW errors)**

Run: `cd /home/faithsax/new-frontend/frontend && npx tsc -b --noEmit 2>&1 | grep -E "workspaces/pages/Chat\.tsx|dashboard/chat/Chat\.tsx" | grep -v "react-router-dom" || echo "no new genuine errors"`
Expected: `no new genuine errors`.

- [ ] **Step 4: Commit**

```bash
git -C /home/faithsax/new-frontend add "frontend/src/dashboard/workspaces/pages/Chat.tsx" "frontend/src/dashboard/chat/Chat.tsx" && git -C /home/faithsax/new-frontend commit -m "feat(ws1): wire channel + feed screens to messaging backend"
```

---

## Task 11: Final verification + WS1 Phase-1 wrap

**Files:** none (verification only)

- [ ] **Step 1: Backend full suite still green**

Run: `gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./... && gobc vet ./...`
Expected: all packages ok; vet clean.

- [ ] **Step 2: Frontend vitest (pure logic) green**

Run: `cd /home/faithsax/new-frontend/frontend && npx vitest run 2>&1 | tail -8`
Expected: all messaging `*.test.ts` pass (map + wsReducer).

- [ ] **Step 3: Frontend tsc introduced no NEW errors**

Run: `cd /home/faithsax/new-frontend/frontend && npx tsc -b --noEmit 2>&1 | grep -E "lib/messaging/|contexts/MessagingProvider|founder/Messages|collab/Messages|workspaces/pages/Chat|dashboard/chat/Chat" | grep -v "react-router-dom" || echo "no new genuine errors in changed files"`
Expected: `no new genuine errors in changed files` (pre-existing project-wide router/motion noise is unrelated and out of scope).

- [ ] **Step 4: Smoke (backend regression)**

Run: `cd /home/faithsax/new-frontend/backend && bash scripts/smoke.sh`
Expected: `==> smoke passed`.

- [ ] **Step 5: Confirm branch + full Phase-1 history**

Run: `git -C /home/faithsax/new-frontend branch --show-current` → `feat/messaging-phase1`
Run: `git -C /home/faithsax/new-frontend log --oneline origin/main..HEAD | wc -l` → all Phase-1 commits.

WS1 Phase 1 (Plans 1–4) is now complete. Push/PR is a follow-up step (hold for the user): the backend + frontend wiring ship together as the messaging layer.

---

## Self-Review (completed by plan author)

- **Spec coverage (Plan-4 portion):** DM screen wiring (list/history/live/send) → Tasks 1,2,9; channel screen wiring → Task 10; feed screen wiring → Task 10; the missing `GET /conversations` read-model the UI needs → Tasks 1,2; provider + boot → Task 8; separate messaging origin (the approved decision) → Task 4; pure-logic tests via added vitest → Tasks 3,5,6. Notifications/email/E2EE remain out of Phase-1 scope.
- **Placeholder scan:** the one deliberate hazard is the wrong import line in Task 6 Step 3 (`import { mapMessage, type }`) — flagged immediately after the block with the exact correct line. Task 10 Step 1 notes a permitted defer (mock channel list) but states the preferred path (load real channels) and that deferring stays offline-safe. No "TBD"/"add error handling"/uncoded steps.
- **Type consistency:** `ConvSummary`/`WireConvSummary` field names match across Go handler JSON (`id,otherUserId,otherName,lastBody,lastTs,lastMsgId,unread`) → TS `WireConvSummary` → `mapConvSummary`. `WireMessage` (`id,convId?,channelId?,senderId,type,body,ts`) matches the Go message JSON emitted by the gateway/history handlers and the `mapMessage`/reducer consumers. `MsgStore` shape defined in `wsReducer.ts` is consumed identically in `ws.ts`, `MessagingProvider`, and the screens (`store.threads`, `store.channelThreads`, `store.online`, `store.feed`). `setMessagingToken`/`messagingToken` defined in config, used in client + ws + App. UI shapes (`UIConversation`/`UIMessage`) equal the existing screen mock types so the swap is drop-in.
- **Verification honesty:** backend additions are fully Go-tested (unit + integration). Frontend pure logic (mappers, reducer) is vitest-tested. Components are gated only by filtered `tsc` (no runner for components, Vite SIGBUS blocks runtime) — this is the established ceiling for this repo's frontend and is stated, not hidden. Screens stay offline-safe (init = existing mock; fetchers fall back to `[]`/`null`), so a wrong assumption degrades to current behavior rather than a blank screen.
