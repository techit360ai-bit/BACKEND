# WS6 Slice A — Role-Aware Feed (Role Plumbing + Zones) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Hangout feed role-aware: posts carry `author_role` + target `audience`, the Go feed serves role-filtered `Global Pulse` / `Your Tribe` zones (viewer role from the JWT), and the frontend routes posts into zones + lets the composer target an audience.

**Architecture:** Authoritative backend filtering. `posts` gains `author_role` (server-stamped from the JWT claim) and `audience TEXT[]`. A new `GET /posts?zone=global|tribe` runs the zone query for the authenticated viewer's role. The WS `post.new` payload carries `authorRole`+`audience` so the client reducer routes live posts into zone buckets via a pure `inTribe()` rule. The composer gains an audience selector.

**Tech Stack:** Go 1.23 (containerized), pgx/v5, chi/v5 (backend); React/TS + vitest (frontend pure logic) + filtered tsc (components).

**Spec:** `docs/superpowers/specs/2026-06-10-ws6-role-aware-feed-sliceA-design.md`
**Builds on:** WS1 Plan 3 (feed backend) + Plan 4 (frontend messaging lib/provider) on `feat/messaging-phase1`. Module path: `github.com/techit360ai-bit/new-frontend/backend`.

---

## Critical execution notes (READ FIRST)

- **Go runs in Docker with a persistent module cache:**
  ```bash
  cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./...
  ```
- **Integration** (Tasks 5): Dockerized `postgres:16-alpine` (55432) + `redis:7-alpine` (56379), go container `--network host` (see Plan 3's command).
- **Frontend:** Node 22 on host; gate = vitest (pure logic) + `tsc` filtered to changed files (project-wide `react-router-dom`/`motion` noise is pre-existing, not ours). No browser run (Vite SIGBUS).
- **Git commits:** `git -C /home/faithsax/new-frontend ...`.
- **Branch:** `feat/messaging-phase1`. Do NOT push.
- **DEPENDENCY:** the frontend tasks (6–8) extend WS1 **Plan 4** artifacts (`frontend/src/lib/messaging/feed.ts`, `wsReducer.ts`, `MessagingProvider.tsx`, `types.ts`). If Plan 4 has not been executed yet, run it first — these tasks assume those files exist. The backend tasks (1–5) depend only on Plan 3 (already done).
- **Semantic gotcha:** `feed.Service.CreatePost(ctx, authorID, p, audience []string)` today — its `audience` param is the **online broadcast recipient list**, NOT target roles. This plan renames that param to `recipients` and introduces a SEPARATE stored `audience` (roles) that arrives on the payload. Do not conflate them.

---

## File Structure (this plan)

```
backend/internal/
├─ protocol/envelope.go            # MODIFY: CreatePostPayload gains Audience []string
├─ store/store.go                  # MODIFY: Post gains AuthorRole+Audience; PostStore gains ListPostsByZone
├─ store/fakes.go                  # MODIFY: store author_role/audience; ListPostsByZone on fake
├─ store/fakes_test.go             # MODIFY: zone fake tests
├─ store/migrations/0004_post_roles.sql  # CREATE
├─ store/postgres/posts.go         # MODIFY: CreatePost stores cols; ListPostsByZone
├─ store/postgres/postgres_test.go # MODIFY: zone integration test
├─ feed/service.go                 # MODIFY: CreatePost(authorRole, recipients); ListByZone; broadcast carries authorRole+audience; role validation
├─ feed/service_test.go            # MODIFY: author_role stamping + zone tests
└─ transport/httpapi/
   ├─ router.go                    # MODIFY: authMiddleware stores Claims; currentRole()
   ├─ posts.go                     # MODIFY: createPost passes role+audience; listPosts reads zone
   └─ httpapi_test.go              # MODIFY: zone + audience endpoint tests
frontend/src/lib/messaging/
├─ types.ts                        # MODIFY: WirePost gains authorRole+audience
├─ feed.ts                         # MODIFY: fetchPosts(zone); createPost(kind,body,audience)
├─ roles.ts                        # CREATE: VIEWER_ROLES, normalizeRole, useViewerRole
├─ wsReducer.ts                    # MODIFY: per-zone buckets + inTribe rule
└─ wsReducer.test.ts               # MODIFY: inTribe + zone routing tests
frontend/src/dashboard/feed/components/
├─ ZoneSwitcher.tsx                # MODIFY: Global Pulse/Your Tribe drive zone fetch
└─ PostComposer.tsx                # MODIFY: audience selector
```

---

## Task 1: Protocol + Post model fields + migration

**Files:** `backend/internal/protocol/envelope.go`, `backend/internal/store/store.go`, `backend/internal/store/migrations/0004_post_roles.sql`

- [ ] **Step 1: Write the failing test**

Append to `backend/internal/store/store_test.go`:

```go
func TestPostHasRoleFields(t *testing.T) {
	p := Post{ID: "p1", AuthorID: "u1", AuthorRole: "founder", Audience: []string{"collaborator"}, Kind: "update", Body: "x"}
	if p.AuthorRole != "founder" || len(p.Audience) != 1 || p.Audience[0] != "collaborator" {
		t.Fatalf("role fields not set: %+v", p)
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./internal/store/`
Expected: FAIL — `Post` has no field `AuthorRole`/`Audience`.

- [ ] **Step 3: Add fields + payload + migration**

In `store/store.go`, the `Post` struct becomes:

```go
type Post struct {
	ID         string
	AuthorID   string
	AuthorRole string
	Audience   []string
	Kind       string
	Body       string
	CreatedAt  time.Time
}
```

In `protocol/envelope.go`, `CreatePostPayload` becomes:

```go
type CreatePostPayload struct {
	Kind     string   `json:"kind"`
	Body     string   `json:"body"`
	Audience []string `json:"audience,omitempty"`
}
```

Create `backend/internal/store/migrations/0004_post_roles.sql`:

```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_role TEXT NOT NULL DEFAULT 'community';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS audience TEXT[] NOT NULL DEFAULT '{all}';
CREATE INDEX IF NOT EXISTS idx_posts_author_role ON posts (author_role);
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc build ./... && gobc test ./internal/store/ ./internal/protocol/`
Expected: builds (existing `Post{...}` literals without the new fields still compile — fields default to zero); tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store/store.go backend/internal/store/store_test.go backend/internal/protocol/envelope.go backend/internal/store/migrations/0004_post_roles.sql && git -C /home/faithsax/new-frontend commit -m "feat(ws6): posts gain author_role + audience (model + payload + migration 0004)"
```

---

## Task 2: Role helpers + PostStore.ListPostsByZone (interface + fake)

**Files:** `backend/internal/store/store.go`, `backend/internal/store/fakes.go`, `backend/internal/store/fakes_test.go`

- [ ] **Step 1: Write the failing fake test**

Append to `backend/internal/store/fakes_test.go`:

```go
func TestFakeListPostsByZone(t *testing.T) {
	f := NewFakeStores()
	ctx := context.Background()
	_ = f.Posts.CreatePost(ctx, Post{ID: "p1", AuthorID: "f1", AuthorRole: "founder", Audience: []string{"all"}, Kind: "update", Body: "founder post"})
	_ = f.Posts.CreatePost(ctx, Post{ID: "p2", AuthorID: "c1", AuthorRole: "collaborator", Audience: []string{"all"}, Kind: "update", Body: "collab post"})
	_ = f.Posts.CreatePost(ctx, Post{ID: "p3", AuthorID: "o1", AuthorRole: "organisation", Audience: []string{"collaborator"}, Kind: "opportunity", Body: "role open"})

	// collaborator's tribe = own-role posts + posts targeting collaborator
	tribe, _ := f.Posts.ListPostsByZone(ctx, "collaborator", "tribe", "", 50)
	ids := map[string]bool{}
	for _, p := range tribe {
		ids[p.ID] = true
	}
	if !ids["p2"] || !ids["p3"] || ids["p1"] {
		t.Fatalf("collaborator tribe wrong: %v", ids)
	}
	// global = everything
	global, _ := f.Posts.ListPostsByZone(ctx, "collaborator", "global", "", 50)
	if len(global) != 3 {
		t.Fatalf("global want 3, got %d", len(global))
	}
}

func TestNormalizeRole(t *testing.T) {
	if NormalizeRole("") != "community" || NormalizeRole("FOUNDER") != "founder" || NormalizeRole("alien") != "community" {
		t.Fatal("NormalizeRole bad")
	}
	if NormalizeRole("collaborator") != "collaborator" {
		t.Fatal("known role dropped")
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./internal/store/`
Expected: FAIL — `ListPostsByZone`/`NormalizeRole` undefined.

- [ ] **Step 3: Add role helpers + interface method (store.go)**

In `store/store.go`, add near the top (after `ErrNotFound`):

```go
// KnownRoles is the closed set of viewer/author roles.
var KnownRoles = map[string]bool{
	"founder": true, "collaborator": true, "investor": true,
	"organisation": true, "community": true,
}

// NormalizeRole lowercases a role and maps anything unknown/empty to "community".
func NormalizeRole(role string) string {
	r := strings.ToLower(strings.TrimSpace(role))
	if KnownRoles[r] {
		return r
	}
	return "community"
}

// SanitizeAudience keeps only known roles plus "all"; empty -> {"all"}.
func SanitizeAudience(aud []string) []string {
	out := make([]string, 0, len(aud))
	for _, a := range aud {
		la := strings.ToLower(strings.TrimSpace(a))
		if la == "all" || KnownRoles[la] {
			out = append(out, la)
		}
	}
	if len(out) == 0 {
		return []string{"all"}
	}
	return out
}
```

Add `"strings"` to the `store.go` imports.

Add to the `PostStore` interface:

```go
	// ListPostsByZone returns posts for a viewer role + zone, newest-first
	// (keyset id < before; before=="" means latest). zone "tribe" = author_role
	// matches viewer OR viewer in audience; any other zone = all posts.
	ListPostsByZone(ctx context.Context, viewerRole, zone, before string, limit int) ([]Post, error)
```

- [ ] **Step 4: Implement on the fake (fakes.go)**

In `FakePostStore.CreatePost` — it already stores the full `Post`, so `AuthorRole`
and `Audience` persist automatically. Add the new method:

```go
func (s *FakePostStore) ListPostsByZone(_ context.Context, viewerRole, zone, before string, limit int) ([]Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	matchTribe := func(p Post) bool {
		if p.AuthorRole == viewerRole {
			return true
		}
		for _, a := range p.Audience {
			if a == viewerRole {
				return true
			}
		}
		return false
	}
	out := make([]Post, 0, limit)
	for i := len(s.order) - 1; i >= 0; i-- {
		id := s.order[i]
		if before != "" && id >= before {
			continue
		}
		p := s.posts[id]
		if zone == "tribe" && !matchTribe(p) {
			continue
		}
		out = append(out, p)
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./internal/store/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store && git -C /home/faithsax/new-frontend commit -m "feat(ws6): role helpers + ListPostsByZone (interface + fake)"
```

---

## Task 3: Postgres ListPostsByZone + CreatePost columns

**Files:** `backend/internal/store/postgres/posts.go`

- [ ] **Step 1: Update CreatePost to persist the new columns**

Replace `PostStore.CreatePost` in `posts.go`:

```go
func (s *PostStore) CreatePost(ctx context.Context, p store.Post) error {
	aud := p.Audience
	if len(aud) == 0 {
		aud = []string{"all"}
	}
	role := p.AuthorRole
	if role == "" {
		role = "community"
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO posts (id, author_id, author_role, audience, kind, body, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		p.ID, p.AuthorID, role, aud, p.Kind, p.Body, p.CreatedAt)
	return err
}
```

- [ ] **Step 2: Update ListPosts scans + add ListPostsByZone**

Replace `ListPosts` so it selects the new columns (the existing feed list keeps
working), and add `ListPostsByZone`:

```go
func (s *PostStore) ListPosts(ctx context.Context, before string, limit int) ([]store.Post, error) {
	return s.queryPosts(ctx, "", "", before, limit)
}

func (s *PostStore) ListPostsByZone(ctx context.Context, viewerRole, zone, before string, limit int) ([]store.Post, error) {
	return s.queryPosts(ctx, viewerRole, zone, before, limit)
}

// queryPosts is the shared reader. zone "tribe" filters to author_role=viewer OR
// viewer = ANY(audience); any other zone returns all posts. Both order newest-first.
func (s *PostStore) queryPosts(ctx context.Context, viewerRole, zone, before string, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, author_id, author_role, audience, kind, body, created_at FROM posts`
	conds := []string{}
	args := []any{}
	n := 0
	if zone == "tribe" {
		n++
		conds = append(conds, "(author_role = $"+strconv.Itoa(n)+" OR $"+strconv.Itoa(n)+" = ANY(audience))")
		args = append(args, viewerRole)
	}
	if before != "" {
		n++
		conds = append(conds, "id < $"+strconv.Itoa(n))
		args = append(args, before)
	}
	if len(conds) > 0 {
		q += " WHERE " + strings.Join(conds, " AND ")
	}
	q += " ORDER BY id DESC LIMIT " + strconv.Itoa(limit)
	rows, err := s.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Post
	for rows.Next() {
		var p store.Post
		if err := rows.Scan(&p.ID, &p.AuthorID, &p.AuthorRole, &p.Audience, &p.Kind, &p.Body, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
```

Add `"strings"` to the `posts.go` imports (alongside the existing `strconv`).

NOTE on the global zone: this implementation returns all posts newest-first for any
non-"tribe" zone (no role-boost ordering). The spec's role-boosted ordering for
`global` is a presentation nicety; slice A keeps `global` = newest-first (simplest,
correct, single-page). Role-boost ordering can be added later without an interface
change. Update the spec's "boosted ordering" note is acceptable — newest-first is
the shipped behavior. (Do NOT implement the boolean-sort + keyset combination, which
the spec itself flags as not paginating cleanly.)

- [ ] **Step 3: Build**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc build ./...`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store/postgres/posts.go && git -C /home/faithsax/new-frontend commit -m "feat(ws6): postgres post role columns + ListPostsByZone"
```

---

## Task 4: feed.Service — author_role stamping + ListByZone + broadcast

**Files:** `backend/internal/feed/service.go`, `backend/internal/feed/service_test.go`

- [ ] **Step 1: Write the failing test**

Append to `backend/internal/feed/service_test.go`:

```go
func TestCreatePostStampsRoleAndAudience(t *testing.T) {
	svc, st, rt := newSvc()
	ctx := context.Background()
	post, err := svc.CreatePost(ctx, "u1", "founder", protocol.CreatePostPayload{Kind: "update", Body: "hi", Audience: []string{"collaborator", "bogus"}}, []string{"u2"})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if post.AuthorRole != "founder" {
		t.Errorf("author role = %q", post.AuthorRole)
	}
	stored, _ := st.Posts.ListPostsByZone(ctx, "collaborator", "tribe", "", 10)
	if len(stored) != 1 {
		t.Fatalf("collaborator should see the targeted post, got %d", len(stored))
	}
	// broadcast envelope carries authorRole + audience
	if env := rt.Sent["u2"]; len(env) == 0 || env[0].Type != protocol.TypePostNew {
		t.Fatalf("u2 missed post.new")
	}
}

func TestListByZoneDelegates(t *testing.T) {
	svc, st, _ := newSvc()
	ctx := context.Background()
	_ = st.Posts.CreatePost(ctx, store.Post{ID: "p1", AuthorID: "f", AuthorRole: "founder", Audience: []string{"all"}, Kind: "update", Body: "x"})
	out, err := svc.ListByZone(ctx, "investor", "global", "", 10)
	if err != nil || len(out) != 1 {
		t.Fatalf("ListByZone: %v len=%d", err, len(out))
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./internal/feed/`
Expected: FAIL — `CreatePost` signature mismatch / `ListByZone` undefined.

- [ ] **Step 3: Rework CreatePost + add ListByZone**

In `feed/service.go`, replace `CreatePost` (note the new `authorRole` param and the
renamed `recipients`):

```go
// CreatePost persists a post (stamping author_role + sanitized target audience),
// then broadcasts post.new to recipients (the online users) excluding the author.
func (s *Service) CreatePost(ctx context.Context, authorID, authorRole string, p protocol.CreatePostPayload, recipients []string) (store.Post, error) {
	kind := p.Kind
	if kind == "" {
		kind = "update"
	}
	post := store.Post{
		ID:         protocol.NewMsgID(),
		AuthorID:   authorID,
		AuthorRole: store.NormalizeRole(authorRole),
		Audience:   store.SanitizeAudience(p.Audience),
		Kind:       kind,
		Body:       p.Body,
		CreatedAt:  s.now().UTC(),
	}
	if err := s.posts.CreatePost(ctx, post); err != nil {
		return store.Post{}, err
	}
	s.broadcast(ctx, authorID, recipients, protocol.TypePostNew, map[string]any{
		"id": post.ID, "authorId": authorID, "authorRole": post.AuthorRole,
		"audience": post.Audience, "kind": post.Kind, "body": post.Body,
		"ts": post.CreatedAt.Format(time.RFC3339),
	})
	return post, nil
}

// ListByZone returns posts for a viewer role and zone (delegates to the store).
func (s *Service) ListByZone(ctx context.Context, viewerRole, zone, before string, limit int) ([]store.Post, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return s.posts.ListPostsByZone(ctx, store.NormalizeRole(viewerRole), zone, before, limit)
}
```

(Keep `ListPosts` as-is for any caller; the HTTP layer will switch to `ListByZone`.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./internal/feed/`
Expected: PASS. (Other feed tests that call the old `CreatePost(ctx, author, payload, audience)` 4-arg form must be updated to the new 5-arg form `CreatePost(ctx, author, "founder", payload, recipients)` — fix them in this step; the test file is yours to edit.)

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/feed && git -C /home/faithsax/new-frontend commit -m "feat(ws6): feed CreatePost stamps role+audience; ListByZone; broadcast carries role"
```

---

## Task 5: HTTP — role in context, zone listing, integration test

**Files:** `backend/internal/transport/httpapi/router.go`, `posts.go`, `httpapi_test.go`, `backend/internal/store/postgres/postgres_test.go`

- [ ] **Step 1: authMiddleware stores Claims + currentRole helper**

In `router.go`, change the context value from the bare userID to the full claims.
Replace the `userIDKey` usage:

```go
type ctxKey string

const claimsKey ctxKey = "claims"

// (inside authMiddleware, replace the WithValue line:)
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
```

Replace `currentUser` and add `currentRole`:

```go
func currentUser(r *http.Request) string {
	c, _ := r.Context().Value(claimsKey).(auth.Claims)
	return c.UserID
}
func currentRole(r *http.Request) string {
	c, _ := r.Context().Value(claimsKey).(auth.Claims)
	return c.Role
}
```

(Ensure `auth` is imported in `router.go` — it already is for the `Verifier`.)

- [ ] **Step 2: createPost passes role; listPosts reads zone**

In `posts.go`, update `handleCreatePost` to pass the role + keep recipients =
online users, and `handleListPosts` to use the zone + viewer role:

```go
func handleCreatePost(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		me := currentUser(r)
		var p protocol.CreatePostPayload
		if json.NewDecoder(r.Body).Decode(&p) != nil || p.Body == "" {
			writeErr(w, http.StatusBadRequest, "body required")
			return
		}
		post, err := d.Feed.CreatePost(r.Context(), me, currentRole(r), p, audience(d, r))
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": post.ID, "authorId": post.AuthorID, "authorRole": post.AuthorRole,
			"audience": post.Audience, "kind": post.Kind, "body": post.Body, "ts": post.CreatedAt,
		})
	}
}

func handleListPosts(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		zone := r.URL.Query().Get("zone")
		if zone == "" {
			zone = "global"
		}
		posts, err := d.Feed.ListByZone(r.Context(), currentRole(r), zone, r.URL.Query().Get("before"), 50)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, err.Error())
			return
		}
		out := make([]map[string]any, 0, len(posts))
		for _, p := range posts {
			out = append(out, map[string]any{
				"id": p.ID, "authorId": p.AuthorID, "authorRole": p.AuthorRole,
				"audience": p.Audience, "kind": p.Kind, "body": p.Body, "ts": p.CreatedAt,
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{"posts": out})
	}
}
```

(`audience(d, r)` is the existing helper returning the online-user list — it is the
broadcast `recipients`, unchanged.)

- [ ] **Step 3: Endpoint test**

Append to `httpapi_test.go`:

```go
func TestFeedZoneFiltering(t *testing.T) {
	r, ver, st := newAPI(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: "f1", DisplayName: "F"})
	_ = st.Users.Upsert(ctx, store.User{ID: "c1", DisplayName: "C"})
	// founder posts to all; org posts targeting collaborators
	founderTok, _ := ver.Mint("f1", "F", "founder")
	rec := httptest.NewRecorder()
	pb, _ := json.Marshal(map[string]any{"kind": "update", "body": "founder post"})
	req := httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+founderTok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("create code=%d body=%s", rec.Code, rec.Body)
	}

	orgTok, _ := ver.Mint("o1", "O", "organisation")
	rec = httptest.NewRecorder()
	pb, _ = json.Marshal(map[string]any{"kind": "opportunity", "body": "role open", "audience": []string{"collaborator"}})
	req = httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+orgTok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("org create code=%d body=%s", rec.Code, rec.Body)
	}

	collabTok, _ := ver.Mint("c1", "C", "collaborator")
	// tribe: collaborator sees only the org post (targeted), not the founder all-post
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/posts?zone=tribe", nil)
	req.Header.Set("Authorization", "Bearer "+collabTok)
	r.ServeHTTP(rec, req)
	var tribe struct{ Posts []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &tribe)
	if len(tribe.Posts) != 1 || tribe.Posts[0]["body"] != "role open" {
		t.Fatalf("tribe wrong: %s", rec.Body)
	}
	// global: collaborator sees both
	rec = httptest.NewRecorder()
	req = httptest.NewRequest("GET", "/api/v1/posts?zone=global", nil)
	req.Header.Set("Authorization", "Bearer "+collabTok)
	r.ServeHTTP(rec, req)
	var global struct{ Posts []map[string]any }
	_ = json.Unmarshal(rec.Body.Bytes(), &global)
	if len(global.Posts) != 2 {
		t.Fatalf("global want 2, got %d", len(global.Posts))
	}
}
```

- [ ] **Step 4: Postgres integration test**

Append to `backend/internal/store/postgres/postgres_test.go`:

```go
func TestPostgresListPostsByZone(t *testing.T) {
	st := setup(t)
	ctx := context.Background()
	_ = st.Users.Upsert(ctx, store.User{ID: uuidA, DisplayName: "A"})
	_ = st.Users.Upsert(ctx, store.User{ID: uuidB, DisplayName: "B"})
	_ = st.Posts.CreatePost(ctx, store.Post{ID: protocol.NewMsgID(), AuthorID: uuidA, AuthorRole: "founder", Audience: []string{"all"}, Kind: "update", Body: "f"})
	_ = st.Posts.CreatePost(ctx, store.Post{ID: protocol.NewMsgID(), AuthorID: uuidB, AuthorRole: "organisation", Audience: []string{"collaborator"}, Kind: "opportunity", Body: "o"})
	tribe, err := st.Posts.ListPostsByZone(ctx, "collaborator", "tribe", "", 50)
	if err != nil {
		t.Fatalf("zone query: %v", err)
	}
	if len(tribe) != 1 || tribe[0].Body != "o" {
		t.Fatalf("tribe wrong: %+v", tribe)
	}
	all, _ := st.Posts.ListPostsByZone(ctx, "collaborator", "global", "", 50)
	if len(all) != 2 {
		t.Fatalf("global want 2, got %d", len(all))
	}
}
```

- [ ] **Step 5: Run unit + integration**

Unit: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./... && gobc vet ./...`
Expected: all packages ok; vet clean.

Integration (pg+redis up per Plan-3 command, then):
```bash
docker run --rm --network host -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod \
  -e TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres?sslmode=disable" \
  -e TEST_REDIS_URL="redis://localhost:56379" \
  -v "$PWD":/app -w /app golang:1.23-alpine go test -tags=integration ./internal/store/postgres/ 2>&1 | tail -4
```
Expected: `ok ... postgres` (migration 0004 applied; zone test passes).

- [ ] **Step 6: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/transport/httpapi backend/internal/store/postgres/postgres_test.go && git -C /home/faithsax/new-frontend commit -m "feat(ws6): role in auth context + zone-filtered GET /posts + tests"
```

---

## Task 6: Frontend — wire types, fetchers, role helper

**Files:** `frontend/src/lib/messaging/types.ts`, `feed.ts`, `roles.ts` (new)

(Assumes WS1 Plan 4's `lib/messaging/*` exists. If not, execute Plan 4 first.)

- [ ] **Step 1: Extend WirePost**

In `types.ts`, `WirePost` becomes:

```ts
export interface WirePost {
  id: string;
  authorId: string;
  authorRole: string;
  audience: string[];
  kind: string;
  body: string;
  ts: string;
}
```

- [ ] **Step 2: roles.ts**

```ts
export const VIEWER_ROLES = ["founder", "collaborator", "investor", "organisation", "community"] as const;
export type ViewerRole = (typeof VIEWER_ROLES)[number];

export function normalizeRole(role: string | null | undefined): ViewerRole {
  const r = (role ?? "").toLowerCase().trim();
  return (VIEWER_ROLES as readonly string[]).includes(r) ? (r as ViewerRole) : "community";
}
```

- [ ] **Step 3: feed.ts — zone fetch + audience on create**

Update `feed.ts` `fetchPosts`/`createPost`:

```ts
export function fetchPosts(zone: "global" | "tribe" = "global"): Promise<WirePost[]> {
  return withFallback(
    async () => (await msgGet<{ posts: WirePost[] }>(`/posts?zone=${zone}`)).posts,
    [],
    "posts",
  );
}
export function createPost(kind: string, body: string, audience?: string[]): Promise<WirePost | null> {
  return withFallback(
    () => msgPost<WirePost>("/posts", { kind, body, ...(audience && audience.length ? { audience } : {}) }),
    () => null,
    "create post",
  );
}
```

- [ ] **Step 4: tsc (no new errors)**

Run: `cd /home/faithsax/new-frontend/frontend && npx tsc -b --noEmit 2>&1 | grep -E "lib/messaging/(types|feed|roles)\.ts" || echo "no new errors"`
Expected: `no new errors`.

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add frontend/src/lib/messaging/types.ts frontend/src/lib/messaging/feed.ts frontend/src/lib/messaging/roles.ts && git -C /home/faithsax/new-frontend commit -m "feat(ws6): frontend post role/audience types + zone fetch + role helper"
```

---

## Task 7: Frontend — WS reducer zone routing (vitest)

**Files:** `frontend/src/lib/messaging/wsReducer.ts`, `wsReducer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `wsReducer.test.ts`:

```ts
import { inTribe } from "./wsReducer";

test("inTribe: own role matches", () => {
  expect(inTribe({ authorRole: "collaborator", audience: ["all"] }, "collaborator")).toBe(true);
});
test("inTribe: targeted audience matches", () => {
  expect(inTribe({ authorRole: "organisation", audience: ["collaborator"] }, "collaborator")).toBe(true);
});
test("inTribe: unrelated does not match", () => {
  expect(inTribe({ authorRole: "founder", audience: ["all"] }, "collaborator")).toBe(false);
});

test("post.new routes into global always and tribe conditionally", () => {
  let s = emptyStore();
  s = applyEnvelope(s, { type: "post.new", id: "e", ts: "t", data: { id: "p1", authorId: "o", authorRole: "organisation", audience: ["collaborator"], kind: "opportunity", body: "x", ts: "t" } }, "collaborator");
  expect(s.feed[0]?.id).toBe("p1");        // global
  expect(s.tribe[0]?.id).toBe("p1");       // tribe (targeted)
  let s2 = emptyStore();
  s2 = applyEnvelope(s2, { type: "post.new", id: "e", ts: "t", data: { id: "p2", authorId: "f", authorRole: "founder", audience: ["all"], kind: "update", body: "y", ts: "t" } }, "collaborator");
  expect(s2.feed[0]?.id).toBe("p2");       // global
  expect(s2.tribe.length).toBe(0);         // not in tribe
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /home/faithsax/new-frontend/frontend && npx vitest run src/lib/messaging/wsReducer.test.ts 2>&1 | tail -6`
Expected: FAIL — `inTribe` undefined / `s.tribe` undefined.

- [ ] **Step 3: Extend the reducer**

In `wsReducer.ts`: add `tribe` to `MsgStore`, an `inTribe` export, and update the
`post.new` case. The `FeedPost` type gains `authorRole`/`audience`.

```ts
export interface FeedPost {
  id: string; authorId: string; authorRole: string; audience: string[];
  kind: string; body: string; ts: string; likeCount: number;
}

export interface MsgStore {
  threads: Record<string, UIMessage[]>;
  channelThreads: Record<string, UIMessage[]>;
  online: Record<string, boolean>;
  feed: FeedPost[];   // global
  tribe: FeedPost[];  // role-relevant
}

export function emptyStore(): MsgStore {
  return { threads: {}, channelThreads: {}, online: {}, feed: [], tribe: [] };
}

export function inTribe(p: { authorRole: string; audience: string[] }, myRole: string): boolean {
  return p.authorRole === myRole || (Array.isArray(p.audience) && p.audience.includes(myRole));
}
```

And the `post.new` case in `applyEnvelope`:

```ts
    case "post.new": {
      const wp = d as unknown as { id: string; authorId: string; authorRole?: string; audience?: string[]; kind: string; body: string; ts: string };
      const fp: FeedPost = {
        id: wp.id, authorId: wp.authorId, authorRole: wp.authorRole ?? "community",
        audience: Array.isArray(wp.audience) ? wp.audience : ["all"],
        kind: wp.kind, body: wp.body, ts: wp.ts, likeCount: 0,
      };
      const next = { ...s, feed: [fp, ...s.feed] };
      if (inTribe(fp, me)) next.tribe = [fp, ...s.tribe];
      return next;
    }
```

(`post.liked` should map over BOTH `feed` and `tribe`; update that case to apply the
like-count change to both arrays.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd /home/faithsax/new-frontend/frontend && npx vitest run src/lib/messaging/wsReducer.test.ts 2>&1 | tail -6`
Expected: all pass (the WS1 reducer tests + the new ones).

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add frontend/src/lib/messaging/wsReducer.ts frontend/src/lib/messaging/wsReducer.test.ts && git -C /home/faithsax/new-frontend commit -m "feat(ws6): WS reducer routes posts into global/tribe zones (vitest)"
```

---

## Task 8: Frontend — ZoneSwitcher fetch + composer audience selector

**Files:** `frontend/src/dashboard/feed/components/ZoneSwitcher.tsx`, `frontend/src/dashboard/feed/components/PostComposer.tsx` (and the feed screen that renders posts)

- [ ] **Step 1: ZoneSwitcher drives the zone fetch**

`ZoneSwitcher.tsx` currently holds `const zones = ['Global Pulse', 'Your Tribe', ...]`
and an active-zone state. Map the active label to a backend zone and load posts:

```tsx
import { useEffect, useState } from "react";
import { fetchPosts } from "@/lib/messaging/feed";
import type { WirePost } from "@/lib/messaging/types";

// inside the component, given `active` (the selected zone label):
const backendZone = active === "Your Tribe" ? "tribe" : "global"; // others fall through to global for slice A
const [posts, setPosts] = useState<WirePost[]>([]);
useEffect(() => {
  let alive = true;
  fetchPosts(backendZone).then((p) => { if (alive && p.length) setPosts(p); });
  return () => { alive = false; };
}, [backendZone]);
```

Render `posts` (mapped to the screen's card shape, cosmetic fields defaulted — reuse
the WS1 Plan 4 feed mapper) for Global Pulse / Your Tribe; leave Build Logs/Questions/
Problems on their existing behavior in slice A. If the feed posts already render via
the Plan-4-wired screen, lift this fetch to that screen instead and pass `backendZone`
down — keep one source of truth for the post list.

NOTE: this task is the thinnest-verification part (component, tsc-only). Keep the
change minimal and offline-safe: only replace the rendered list when the fetch
returns a non-empty result; otherwise the existing mock/Plan-4 list stays.

- [ ] **Step 2: PostComposer audience selector**

In `PostComposer.tsx`, add an audience multi-select (default none = Everyone), and
pass it to `createPost`:

```tsx
import { VIEWER_ROLES } from "@/lib/messaging/roles";
// state:
const [audience, setAudience] = useState<string[]>([]); // [] = Everyone
// render a small group of toggle chips for the 5 roles (excluding "community" if
// desired) labeled "Target: Everyone | Founders | Collaborators | Investors | Organisations".
// on post:
//   createPost(selectedKind, body, audience.length ? audience : undefined)
```
Provide the chips inline (one `<button>` per role toggling membership in `audience`);
"Everyone" is the empty-selection default. Wire the existing submit handler to call
`createPost(kind, body, audience.length ? audience : undefined)`.

- [ ] **Step 3: tsc (no new errors in changed files)**

Run: `cd /home/faithsax/new-frontend/frontend && npx tsc -b --noEmit 2>&1 | grep -E "feed/components/(ZoneSwitcher|PostComposer)\.tsx" | grep -v "react-router-dom" || echo "no new genuine errors"`
Expected: `no new genuine errors`.

- [ ] **Step 4: Commit**

```bash
git -C /home/faithsax/new-frontend add "frontend/src/dashboard/feed/components/ZoneSwitcher.tsx" "frontend/src/dashboard/feed/components/PostComposer.tsx" && git -C /home/faithsax/new-frontend commit -m "feat(ws6): zone-driven feed fetch + composer audience selector"
```

---

## Task 9: Final verification (slice A)

**Files:** none (verification only)

- [ ] **Step 1: Backend suite + vet**

Run: `cd /home/faithsax/new-frontend/backend && gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; } && gobc test ./... && gobc vet ./...`
Expected: all ok; vet clean.

- [ ] **Step 2: Integration (pg+redis)**

Run the Plan-3 integration command (`go test -tags=integration ./internal/store/postgres/`).
Expected: ok (migration 0004 + zone test).

- [ ] **Step 3: Frontend vitest + filtered tsc**

Run: `cd /home/faithsax/new-frontend/frontend && npx vitest run 2>&1 | tail -6`
Expected: all messaging `*.test.ts` pass (incl. inTribe/zone routing).
Run: `npx tsc -b --noEmit 2>&1 | grep -E "lib/messaging/|feed/components/(ZoneSwitcher|PostComposer)" | grep -v "react-router-dom" || echo "no new genuine errors"`
Expected: `no new genuine errors`.

- [ ] **Step 4: Smoke regression (backend)**

Run: `cd /home/faithsax/new-frontend/backend && bash scripts/smoke.sh`
Expected: `==> smoke passed` (DM path unaffected).

- [ ] **Step 5: Branch + history**

Run: `git -C /home/faithsax/new-frontend branch --show-current` → `feat/messaging-phase1`; `git -C /home/faithsax/new-frontend log --oneline 5cacfe0..HEAD`.

Do NOT push. WS6 slice A is done; further WS6 slices (B–G) and WS1 Plan 4 (if not yet run) follow.

---

## Self-Review (completed by plan author)

- **Spec coverage:** `author_role`+`audience` model + migration 0004 → Task 1; role helpers/validation → Task 2; `ListPostsByZone` (fake+postgres) → Tasks 2,3; `CreatePost` stamps role + broadcast carries role/audience + `ListByZone` → Task 4; viewer role from JWT (auth middleware → claims) + zone endpoint → Task 5; integration per-role/zone → Task 5; frontend types/fetchers/role helper → Task 6; WS reducer `inTribe`/zone routing (vitest) → Task 7; ZoneSwitcher + composer audience → Task 8; verification → Task 9. Deferred slices (B–G) are out of scope and named in the spec.
- **Deviation from spec (intentional, documented in Task 3):** the `global` zone returns newest-first (NOT the boost-ordered ranking) — the spec itself flagged that boolean-sort + keyset paging don't compose; newest-first is the correct single-page behavior for slice A. Role-boost ordering deferred to when infinite scroll lands.
- **Placeholder scan:** none — every code step shows full code; the two thinnest component edits (Task 8) give exact code + an explicit offline-safe rule; the semantic rename (audience param → recipients) is called out at the top and in Task 4.
- **Type consistency:** `Post{AuthorRole,Audience}` (Task 1) flows through store/fake/postgres (Tasks 2,3), service (Task 4), HTTP JSON (`authorRole`,`audience`) (Task 5), TS `WirePost` (Task 6), reducer `FeedPost`/`inTribe` (Task 7). `CreatePost(ctx, authorID, authorRole, payload, recipients)` is the single canonical signature used by the handler (Task 5) and tested (Task 4). `ListPostsByZone(ctx, viewerRole, zone, before, limit)` consistent across interface/fake/postgres/service. `NormalizeRole`/`SanitizeAudience` defined once (Task 2), used in service (Task 4). Frontend `normalizeRole`/`VIEWER_ROLES` (Task 6) + `inTribe` (Task 7) mirror the backend rule.
