# WS1 — Messaging & Communication Layer, Phase 1 (Design Spec)

- **Date:** 2026-06-08
- **Repo:** new-frontend (`/home/faithsax/new-frontend`)
- **Branch:** `feat/messaging-phase1`
- **Status:** Approved design, pending spec review
- **Source guide:** "Building an Optimized Chat System Like WhatsApp" (23-part thread; Steps 1–16 captured in memory `techit-messaging-whatsapp-guide`). The guide is the architectural blueprint; this spec scopes it to a pragmatic Phase 1.

## Problem

The frontend already has rich messaging UI — 1:1 DMs (`founders/.../Messages.tsx`,
`collaborators/.../Messages.tsx`), group/Hangout chat (`workspaces/.../Chat.tsx`,
`organization/.../Hangout.tsx`), social Feed (`dashboard/chat/Chat.tsx` SAMPLE_POSTS
+ `dashboard/feed/*`), and notifications — but it is **100% mock with zero
WebSocket code**. The repo's `backend/` is a bare Express hello-world. There is no
real messaging backend.

Goal: build a real Go messaging backend that makes the existing DM, Hangout, and
Feed screens live over WebSocket, at web/PWA startup scale, using the guide's
architecture, with seams to grow into the heavier pieces (E2EE, Cassandra, Kafka,
push, mobile) in later phases.

## Decisions (locked during brainstorming)

- **Language:** Go (goroutines + WebSocket). Guide endorses Go for smaller scale;
  E2EE is client-side so the server language does not constrain it.
- **Infra (lean):** Postgres (all persistent state) + Redis (presence + pub/sub
  fan-out) + S3/MinIO seam (unused in P1) + Web Push (later phase). Defer
  Cassandra, Kafka, FCM/APNs.
- **Phase-1 feature scope:** real-time spine + **1:1 DMs + Hangout channels +
  social Feed only**. Deferred: notifications system, email, E2EE/Signal, media
  uploads, voice/video, native mobile.
- **Service location:** `backend/` becomes the Go module. The bare Express
  skeleton (`backend/package.json`, `backend/src/`) is removed — it has no real
  code.

## Assumptions & dependencies

- **JWT origin.** The WS handshake and REST middleware validate a JWT signed with
  `JWT_SECRET`. The platform does not yet issue real JWTs (ai-router's
  `get_user_context()` is a known demo stub — a WS5 hardening item). For P1 the Go
  service validates a JWT containing at least `{ sub: userID, name, role }`; in
  dev a helper (`scripts/devtoken.go` or a `/dev/token` endpoint gated by an
  env flag) mints one so the stack is runnable end-to-end. Real issuance is a
  cross-workstream dependency tracked under WS5; the contract here (claims shape +
  shared secret) is what must eventually match.
- **User records.** `users` rows are **upserted on first authenticated
  connection** from JWT claims (`sub`, `name`, `role`). No separate user-sync
  service in P1. This keeps the messaging service self-contained while staying
  compatible with a future identity source.
- **Feed "views".** The existing feed UI shows a view count. P1 tracks likes and
  comments only; view counts remain client-side mock until a later phase. Called
  out so the wiring does not silently imply server-backed views.

## Verification constraint

Go is **not** installed in the sandbox; Docker (v29.4), `psql`, `redis-server`,
and Node v22 are. Therefore **Go build/test runs inside a `golang` Docker
container**, and integration tests use `docker-compose` (Postgres + Redis). This
is the WS1 gate (analogous to WS4's `python3` smoke test, but containerized).

## Architecture

```
React/PWA client
   │  REST (history, fallback-send, bootstrap)  +  WebSocket (live)
   ▼
Go service (backend/)  — single binary, horizontally scalable
   ├─ HTTP API   (chi):  auth, conversations, channels, posts, history, health
   ├─ WS Gateway (nhooyr/websocket): long-lived conns, JWT handshake, heartbeats
   ├─ Hub/Router: per-instance conn registry + Redis pub/sub cross-instance fan-out
   ├─ Presence:   Redis online-set + last-seen
   └─ Store:      Postgres (users, conversations, messages, channels, posts)
   ▼
Postgres        Redis (pub/sub + presence)        [S3 seam, unused P1]
```

Hot path (send→deliver) stays in one process: client → WS gateway → hub →
recipient conn (same instance) or → Redis pub/sub → recipient's instance →
offline (left for reconnect). Messages persist to Postgres **before ACK**.

Guide alignment: WS gateway (Step 4), JSON envelope now / protobuf seam later
(Step 5), presence + consistent routing (Step 7), hot/cold persistence with
Postgres serving both tiers at this scale (Step 8), end-to-end flow with
receipts + offline cursor (Step 9), observability hooks (Step 16). `messages.body`
is opaque text so E2EE (Step 10) slots in later with no schema change.

## Components & file structure

```
backend/
├─ go.mod, go.sum
├─ cmd/server/main.go            # wire config→stores→hub→http+ws; start
├─ internal/
│  ├─ config/config.go           # env: PORT, DATABASE_URL, REDIS_URL, JWT_SECRET, CORS_ORIGINS
│  ├─ auth/jwt.go                # validate JWT, extract userID; HTTP middleware + WS handshake
│  ├─ transport/
│  │   ├─ httpapi/               # router.go, conversations.go, channels.go, posts.go, health.go
│  │   └─ ws/gateway.go          # upgrade, auth, read/write pumps, heartbeat
│  ├─ hub/hub.go                 # registry userID→conns; register/unregister/route
│  │     hub/pubsub.go           # Redis pub/sub bridge (interface + redis impl + in-memory fake)
│  ├─ presence/presence.go       # Redis online-set + last-seen; publish online/offline
│  ├─ protocol/envelope.go       # WS envelope types + (de)serialize; UUIDv7 helper
│  ├─ messaging/service.go       # DM + channel: send/deliver/receipt/typing orchestration
│  ├─ feed/service.go            # posts: create/list/like/comment
│  └─ store/
│      ├─ store.go               # interfaces: UserStore, ConversationStore, MessageStore,
│      │                         #   ChannelStore, PostStore
│      ├─ postgres/*.go          # pgx implementations
│      └─ migrations/*.sql       # schema (below)
├─ Dockerfile
├─ docker-compose.yml            # go + postgres + redis (dev + CI gate)
├─ scripts/smoke.sh              # boot compose, WS client sends DM, assert ack+delivery
└─ README.md
```

**Boundaries (each independently testable):**
- `protocol` — pure types + serialization, no deps; the frontend's contract.
- `hub` — owns connection registry + routing; depends on `protocol` + a pub/sub
  interface, not on Postgres. Tested with an in-memory pub/sub fake.
- `store` — interfaces first; services depend on interfaces (fakes in unit tests).
- `messaging`/`feed` — business logic (persist-before-ACK, receipts, fan-out,
  dedup); orchestrate `store` + `hub`; no transport knowledge.
- `transport` — HTTP and WS are thin adapters calling services; no business logic.

**Libraries:** `chi` (HTTP), `nhooyr.io/websocket` (WS), `jackc/pgx` (Postgres),
`redis/go-redis`, `google/uuid` (UUIDv7), `golang-jwt/jwt`.

## Data model (Postgres)

Migrations in `internal/store/migrations/`. UUIDs throughout; `body` opaque text
(E2EE-ready). Unread/offline derive from read cursors — no denormalized counters.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY, display_name TEXT NOT NULL, avatar_url TEXT,
  role TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (              -- exactly two participants in P1
  id UUID PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE conversation_participants (
  conversation_id UUID REFERENCES conversations(id),
  user_id UUID REFERENCES users(id),
  last_read_msg_id UUID,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE channels (
  id UUID PRIMARY KEY, name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'hangout',   -- hangout|workspace
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE channel_members (
  channel_id UUID REFERENCES channels(id),
  user_id UUID REFERENCES users(id),
  last_read_msg_id UUID,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE messages (                   -- one table, DM XOR channel
  id UUID PRIMARY KEY,                     -- UUIDv7 → time-ordered
  conversation_id UUID REFERENCES conversations(id),
  channel_id UUID REFERENCES channels(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'text',
  body TEXT NOT NULL,                      -- opaque (plaintext P1, ciphertext later)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((conversation_id IS NULL) <> (channel_id IS NULL))
);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, id);
CREATE INDEX idx_messages_channel      ON messages (channel_id, id);

CREATE TABLE message_receipts (           -- DM per-recipient state; offline-queue source
  message_id UUID REFERENCES messages(id),
  user_id UUID REFERENCES users(id),
  state TEXT NOT NULL DEFAULT 'sent',      -- sent|delivered|read
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE posts (
  id UUID PRIMARY KEY,                      -- UUIDv7
  author_id UUID NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL DEFAULT 'update',      -- milestone|insight|collab-call|build-update|problem|question|update
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_created ON posts (created_at DESC);
CREATE TABLE post_likes (
  post_id UUID REFERENCES posts(id), user_id UUID REFERENCES users(id),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE post_comments (
  id UUID PRIMARY KEY, post_id UUID REFERENCES posts(id),
  author_id UUID REFERENCES users(id), body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Decisions baked in:
- **Unread** = compare `last_read_msg_id` to latest message id (no drifting counter).
- **Offline queue** = DM messages with `message_receipts.state='sent'` for an
  offline user; on reconnect client fetches messages after its read cursor and we
  bump to `delivered`. No separate queue table.
- **Channels** use the same cursor read-state; no per-message receipts in P1.
- **Single `messages` table** (CHECK enforces DM XOR channel) keeps delivery code
  unified; store interface allows a later Cassandra split for channels.

## WebSocket protocol

Connect: `wss://…/ws?token=<JWT>`; gateway validates JWT in handshake → `userID` →
register in hub → presence online → publish `online`. Heartbeat ping/pong every
30s; missed pong → close + unregister + presence offline (last-seen). Reconnect:
exponential backoff + jitter; client re-sends read cursors, server flushes missed.

Envelope (both directions; `protocol/envelope.go` is the contract):
```jsonc
{ "type": "message.send", "id": "<uuidv7>", "ts": "<rfc3339>", "data": { ... } }
```

**Client → Server**
| type | data | effect |
|------|------|--------|
| `message.send` | `{convId?, channelId?, clientMsgId, type:"text", body}` | persist→ack→fan-out |
| `typing.start`/`typing.stop` | `{convId?|channelId}` | ephemeral broadcast (not persisted) |
| `read.upto` | `{convId?|channelId, msgId}` | advance cursor, emit receipts |

**Server → Client**
| type | data |
|------|------|
| `message.ack` | `{clientMsgId, msgId, ts}` |
| `message.new` | full message object |
| `receipt.update` | `{msgId, userId, state}` |
| `typing.indicator` | `{convId?|channelId, userId, isTyping}` (5s debounce) |
| `presence.changed` | `{userId, online, lastSeen}` |
| `post.new`/`post.liked`/`post.comment` | feed live updates |
| `error` | `{code, message}` |

**DM send flow (persist-before-ACK):**
1. validate sender ∈ conversation.
2. INSERT message (UUIDv7) + receipts(state=sent) — durable BEFORE ack.
3. `message.ack` → sender.
4. `hub.route(recipient)`: local conn → `message.new`; other instance → Redis
   PUBLISH → that instance delivers; offline → leave state=sent.
5. recipient delivered → `receipt.update(delivered)` → sender.
6. recipient `read.upto` → `receipt.update(read)` → sender.

**Channel send flow:** validate membership → persist once → fan-out `message.new`
to online members (local + Redis), capped concurrency (avoid thundering herd). No
per-message receipts; read tracked by cursor.

**Dedup/ordering:** server UUIDv7 = time order; `clientMsgId` echoed in
`message.ack` lets client reconcile its optimistic message + dedupe on reconnect.

## REST API (`/api/v1`, JWT-auth'd)

```
GET  /health                              # liveness/readiness (DB + Redis ping)
GET  /conversations                       # DM list + last msg + unread
GET  /conversations/{id}/messages?before= # keyset history (UUIDv7)
POST /conversations/{id}/messages         # WS-fallback send (clientMsgId dedup)
POST /conversations                       # create/get 1:1 with {userId}
POST /conversations/{id}/read             # advance read cursor
GET  /channels                            # my channels + unread
GET  /channels/{id}/messages?before=
POST /channels/{id}/messages
POST /channels/{id}/read
GET  /posts?before=                       # feed, keyset paginated
POST /posts
POST /posts/{id}/like      (DELETE same)
POST /posts/{id}/comments  (GET same)
GET  /users/online                        # presence snapshot
```

REST send shares the exact service path as WS send (same dedup), so it is a true
fallback when the socket is down.

## Frontend wiring

Mirrors the established `lib/api/*` + `withFallback` pattern:
- New `lib/api/messaging.ts`, `lib/api/feed.ts` (REST, camelCase contracts).
- New `lib/ws/client.ts` — first WS client in the repo: connect-with-JWT,
  auto-reconnect (exp backoff + jitter), heartbeat, typed envelope dispatch,
  subscribe callbacks.
- New `contexts/MessagingProvider.tsx` — holds conversations/channels/messages/
  presence/typing state, subscribes to the WS client, exposes hooks
  (`useConversation`, `useChannel`, `useFeed`). Existing `Messages.tsx`,
  `Hangout.tsx`, `Chat.tsx`, feed pages swap local mock arrays for these hooks.
  Initial state = existing mock so first paint is unchanged and screens are
  offline-safe.

## Error handling

- Persist failure → no ACK → client keeps message "sending", retries via REST
  fallback. (ACK only follows a durable write → no phantom-delivered messages.)
- WS drop → provider falls back to REST for history + queues outbound; reconnect
  flushes via cursors.
- WS auth failure → close code `4401`; client stops retrying, surfaces re-login.
- Redis down → degrade to single-instance in-process fan-out (cross-instance
  delivery pauses; local delivery + persistence continue); `/health` = degraded.

## Testing

Gate runs in a `golang` Docker container (Go absent on host); integration uses
`docker-compose` (Postgres + Redis).
- **Unit (no infra):** `protocol` round-trip; `hub` routing with in-memory pub/sub
  fake; `messaging`/`feed` with store fakes — assert persist-before-ACK, receipt
  transitions, channel fan-out, dedup by `clientMsgId`.
- **Integration (compose):** migrations apply; DM send→persist→deliver across two
  simulated gateway instances over real Redis pub/sub; history keyset pagination;
  presence online/offline.
- **Smoke:** `scripts/smoke.sh` boots compose, runs a WS client that sends a DM and
  asserts ack + delivery — the end-to-end gate.
- **Frontend:** no runtime gate (Vite SIGBUS); `tsc` filtered to changed files,
  accepting the known project-wide `react-router-dom` type noise.

## Out of scope (deferred to later WS1 phases)

Notifications system, email, E2EE/Signal Protocol, media uploads, voice/video
calls, Cassandra, Kafka, FCM/APNs, native mobile. Schema/seams chosen so these
add without rewrites (opaque `body`, store interfaces, S3 seam, pub/sub bridge).
```
