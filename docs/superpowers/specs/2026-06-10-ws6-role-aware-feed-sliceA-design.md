# WS6 — Role-Aware Hangout, Slice A: Role Plumbing + Role-Aware Zones (Design Spec)

- **Date:** 2026-06-10
- **Repo:** new-frontend (`/home/faithsax/new-frontend`) — Go feed backend under `backend/`, React app under `frontend/`
- **Branch:** `feat/messaging-phase1` (builds on WS1 Plan 3's feed backend)
- **Status:** Approved design, pending spec review
- **Parent:** WS6 Role-Aware Hangout (see memory `techit-ws6-role-aware-hangout`); this is **slice A of 7**.

## Problem

The Hangout feed is role-blind. The Go feed backend (WS1 Plan 3) stores posts
flat (`{id, authorId, kind, body, ts}` + likes + comments) and broadcasts to every
online user. The React feed has zones (`Global Pulse`, `Your Tribe`, `Build Logs`,
`Questions`, `Problems`) and `AuthContext` exposes `profile.role`, but **no feed
component reads the role** — every role sees the same stream. Slice A makes the
feed role-aware: the backend filters/weights posts per the viewer's role, and the
two primary zones (Global Pulse, Your Tribe) become role-variant.

## Scope

**In scope (slice A):**
- Posts gain `author_role` + `audience[]`.
- Viewer role read authoritatively from the JWT (`role` claim).
- Zone-aware list endpoint: `GET /posts?zone=global|tribe`.
- WS `post.new` carries `authorRole` + `audience`; client reducer routes posts into
  zones.
- Composer gains an `audience` selector.

**Out of scope (later WS6 slices, named so they are not mistaken for gaps):**
- Rich interactive Your-Tribe cards: collaborator project cards + Express Interest,
  investor thesis-matches + Watch, org builder cards (slices D–G).
- Opportunities Board zone, Project Discovery zone (slices D, E).
- CBS/TSS/CRS scoring, contribution records (slice B/C).
- Investor terminal integration, org opportunity broadcast (slices F, G).
- ai-router changes (slice A touches only the Go feed + frontend).

## Decisions (locked during brainstorming)

- **Backend filters.** The Go feed is authoritative for role filtering/weighting
  (not client-side, not hybrid) — paginates correctly, doesn't leak all posts to
  every client, reused by every later zone.
- **Post audience model = author-role + optional target audience.** Each post
  records `author_role` (denormalized from the author's JWT role at create time)
  and `audience` (which roles it targets; `{all}` = everyone). This single field
  also powers the later Opportunities Board.
- **Viewer role from JWT, never client-supplied.** The messaging JWT already
  carries `role`. Unknown/absent role → `community`.

## Roles

Five: `founder | collaborator | investor | organisation | community`. `AuthContext`
currently models four (`founder|collaborator|investor|organisation`); an
unknown/absent role maps to `community` everywhere (backend and frontend).

## Architecture

```
composer (audience=['collaborator'])
  → POST /posts {kind, body, audience}
     → CreatePost: author_role = JWT.role (server-stamped); persist audience
     → broadcast post.new {id, authorId, authorRole, audience, kind, body, ts}
ZoneSwitcher (Global Pulse | Your Tribe)
  → fetchPosts(zone) → GET /posts?zone=global|tribe   (viewer role from JWT)
     → backend zone query → posts
WS reducer (per client): post.new → always `global`;
  → `tribe` iff authorRole === myRole || audience.includes(myRole)
```

The Go feed is authoritative for what each zone returns; the client reducer only
routes *live* posts into the zone buckets it already holds.

## Backend (Go feed)

### Migration `0004_post_roles.sql`

```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_role TEXT NOT NULL DEFAULT 'community';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS audience TEXT[] NOT NULL DEFAULT '{all}';
CREATE INDEX IF NOT EXISTS idx_posts_author_role ON posts (author_role);
```

(`MigrateAll` globs `*.sql` sorted, so `0004` applies after `0001/0002/0003`.)

### Store

- `Post` model gains `AuthorRole string` and `Audience []string`.
- `PostStore.CreatePost` persists both (was: id/author/kind/body/created_at).
- New method `ListPostsByZone(ctx, viewerRole, zone, before string, limit int) ([]Post, error)`:
  - `zone == "tribe"` →
    `WHERE author_role = $viewerRole OR $viewerRole = ANY(audience)`
    `ORDER BY id DESC LIMIT n` (keyset on `id < before`).
  - `zone == "global"` (default for unknown zone) → all posts, **role-boosted
    ordering**: `ORDER BY (author_role = $viewerRole OR $viewerRole = ANY(audience)) DESC, id DESC`
    (relevant first, then newest), `LIMIT n`. Pagination note: because the primary
    sort key is the boost boolean (not `id`), `id < before` keyset paging does NOT
    compose cleanly across the boost boundary. Slice A serves a **single page**
    (the feed UI today renders one page, no infinite scroll), so `before` is
    accepted but the global zone ignores it for now; true paginated global ranking
    is deferred to when infinite scroll lands. `tribe` (single sort key `id DESC`)
    paginates correctly with `id < before`.
- Fakes implement the same; integration test asserts per-role/zone results.
- `audience` is validated server-side on create: keep only values in
  `{founder,collaborator,investor,organisation,community,all}`; empty → `{all}`.

### Service / HTTP

- `feed.Service.CreatePost` gains `authorRole string` + `audience []string` params
  (authorRole passed from the handler's JWT claim; audience from the body). The
  `post.new` broadcast payload gains `authorRole` + `audience`.
- `feed.Service.ListByZone(ctx, viewerRole, zone, before, limit)` wraps the store.
- `handleListPosts` reads `zone` from query + viewer role from the auth context
  (the middleware already puts userID in context; extend it to also carry the role
  claim, OR re-verify — simplest: `authMiddleware` stores `Claims` not just userID).
- `handleCreatePost` passes the claim's role as `authorRole` and the body's
  `audience` (optional) to the service.

### Auth middleware change

`authMiddleware` currently stores only `userID` in the request context. Slice A
needs the role too. Change it to store the full `auth.Claims` (userID+name+role);
add `currentRole(r)` alongside `currentUser(r)`. This is a small, contained change
used by the two feed handlers.

## Frontend

- **`useViewerRole()`** (new tiny hook): reads `AuthContext` `profile.role`; maps
  unknown/absent → `community`. Used only for presentation (composer options,
  labels) — role for filtering travels in the JWT.
- **`lib/messaging/feed.ts`**: `fetchPosts(zone: "global" | "tribe")` →
  `GET /posts?zone=...`. `createPost(kind, body, audience?)` includes `audience`.
- **`WirePost`** type gains `authorRole: string` + `audience: string[]`.
- **WS reducer (`wsReducer.ts`)**: extend the `post.new` case to keep a per-zone
  bucket. The pure routing rule `inTribe(post, myRole) = post.authorRole === myRole
  || post.audience.includes(myRole)` is unit-tested. `global` always includes the
  post.
- **`ZoneSwitcher` + feed screen**: Global Pulse → `fetchPosts("global")`; Your
  Tribe → `fetchPosts("tribe")`. Other zones unchanged in slice A.
- **`PostComposer`**: add an audience selector (default "Everyone" = omit/`["all"]`;
  options Founders/Collaborators/Investors/Organisations/Community). Sends
  `audience`. Does NOT set author_role (server-stamped).
- **Offline-safe**: zones init from existing mock; failed fetch → mock fallback.

## Error handling

- Unknown/missing JWT role → `community` (never 500).
- Unknown `zone` → `global`.
- Invalid `audience` values dropped server-side; empty → `{all}`.
- Frontend fetch failure → existing mock fallback.
- `post.new` with unparseable `audience` → reducer routes to `global` only.

## Testing

- **Go (authoritative; gates = containerized `go test` + integration over real
  Postgres, same as Plans 1–3):**
  - unit (fakes): `ListPostsByZone` returns peers+targeted for `tribe`, all (boosted
    ordering) for `global`; `CreatePost` stamps `author_role` from the passed claim
    and persists `audience`; invalid audience values dropped.
  - integration (migration `0004`): seed posts from different author roles with
    different audiences; assert each zone query returns the correct set per viewer
    role.
  - httpapi: `GET /posts?zone=tribe` with a collaborator JWT returns only
    collaborator-relevant posts; `POST /posts` with `audience` round-trips.
- **Frontend:** vitest for `inTribe` routing rule (extends WS1 `wsReducer.test.ts`).
  Components gated by filtered `tsc` only (no runner; Vite SIGBUS) — same ceiling as
  WS1 Plan 4.

## Dependencies / sequencing

- Builds on the Go feed backend (WS1 Plan 3, on this branch). Does **not** depend on
  WS1 Plan 4 (frontend wiring). Both touch the feed screen, so recommended order is
  WS1 Plan 4 first (completes the messaging layer), then WS6 slice A on top — but the
  two are independent and the feed-rework overlap is one screen.
- The JWT `role` claim is populated by the WS1 dev-token path today; real issuance is
  WS5. Slice A relies on the claim being present (defaults to `community` if not).
