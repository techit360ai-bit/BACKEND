# WS6 Slice B — Per-Role Post Types + Composer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each role's composer offers its own post types; the backend authoritatively rejects a `kind` not allowed for the author's server-stamped role.

**Architecture:** A small static `role → kinds` map duplicated in Go (`store`) and TS (`lib/messaging`). Backend validates `kind` in `feed.Service.CreatePost` (new `ErrInvalidKind` → 400). Frontend `PostComposer` renders `kindsForRole(viewerRole)`. `kind` + free body only — no structured fields.

**Tech Stack:** Go 1.23 (pgx/chi, containerized via `gobc`), React 18 + TS (Vite; tests via the vite-free local gate `node scripts/run-tests.mjs` since vitest's rolldown-vite SIGBUSes on this host).

**Spec:** `docs/superpowers/specs/2026-06-11-ws6-slice-b-per-role-post-types-design.md`

**Branches:** Tasks 1–3 (backend) on `feat/messaging-backend` (PR #13). Tasks 4–5 (frontend) on `feat/messaging-phase1` (PR #12). Task 6 verifies both + pushes. Plan + spec are committed to **both** branches (docs-on-both).

**`gobc` helper (run from `backend/`):**
```bash
gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
```

---

## Task 1: Backend — postkinds map + AllowedKind

**Branch:** `feat/messaging-backend` (run `git checkout feat/messaging-backend` first).

**Files:**
- Create: `backend/internal/store/postkinds.go`
- Test: `backend/internal/store/postkinds_test.go`

- [ ] **Step 1: Write the failing test**

Create `backend/internal/store/postkinds_test.go`:

```go
package store

import "testing"

func TestAllowedKind(t *testing.T) {
	// generic accepted for every role
	for _, role := range []string{"founder", "collaborator", "investor", "organisation", "community"} {
		if !AllowedKind(role, "milestone") {
			t.Fatalf("generic milestone should be allowed for %s", role)
		}
	}
	if !AllowedKind("founder", "update") {
		t.Fatal("legacy update must stay valid")
	}
	if !AllowedKind("founder", "build") || !AllowedKind("founder", "collab") {
		t.Fatal("legacy aliases build/collab must stay valid")
	}
	// role-specific accepted only for its role
	if !AllowedKind("collaborator", "role-available") {
		t.Fatal("collaborator may post role-available")
	}
	if !AllowedKind("investor", "investment-signal") {
		t.Fatal("investor may post investment-signal")
	}
	if !AllowedKind("organisation", "opportunity-post") {
		t.Fatal("organisation may post opportunity-post")
	}
	// cross-role rejected
	if AllowedKind("collaborator", "investment-signal") {
		t.Fatal("collaborator must NOT post investment-signal")
	}
	if AllowedKind("founder", "skill-showcase") {
		t.Fatal("founder must NOT post collaborator kind")
	}
	// unknown role -> generic only
	if AllowedKind("wizard", "role-available") {
		t.Fatal("unknown role gets generic only")
	}
	if !AllowedKind("wizard", "insight") {
		t.Fatal("unknown role still gets generic")
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `gobc test ./internal/store/`
Expected: FAIL — `AllowedKind` undefined.

- [ ] **Step 3: Implement postkinds.go**

Create `backend/internal/store/postkinds.go`:

```go
package store

// GenericKinds are post kinds any role may use. The first six are canonical;
// "update" is the legacy default; "build"/"collab" are legacy aliases for
// "build-update"/"collab-call" kept valid so older clients/posts don't break.
var GenericKinds = map[string]bool{
	"milestone": true, "insight": true, "build-update": true,
	"collab-call": true, "question": true, "problem": true,
	"update": true, "build": true, "collab": true,
}

// RoleKinds are the role-specific post kinds added on top of GenericKinds,
// keyed by normalized role.
var RoleKinds = map[string][]string{
	"collaborator": {"contribution-update", "skill-showcase", "role-available"},
	"investor":     {"investment-signal", "portfolio-update", "thesis-post"},
	"organisation": {"opportunity-post", "programme-announcement", "community-spotlight"},
}

// AllowedKind reports whether kind may be posted by role
// (generic ∪ role-specific for the normalized role).
func AllowedKind(role, kind string) bool {
	if GenericKinds[kind] {
		return true
	}
	for _, k := range RoleKinds[NormalizeRole(role)] {
		if k == kind {
			return true
		}
	}
	return false
}
```

- [ ] **Step 4: Run to verify it passes**

Run (from `backend/`): `gobc test ./internal/store/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/store/postkinds.go backend/internal/store/postkinds_test.go
git -C /home/faithsax/new-frontend commit -m "feat(ws6): role->post-kinds map + AllowedKind (store)"
```

---

## Task 2: Backend — CreatePost rejects invalid kind

**Branch:** `feat/messaging-backend`.

**Files:**
- Modify: `backend/internal/feed/service.go`
- Test: `backend/internal/feed/service_test.go`

- [ ] **Step 1: Write the failing test**

Append to `backend/internal/feed/service_test.go`:

```go
func TestCreatePostRejectsInvalidKindForRole(t *testing.T) {
	svc, _, _ := newSvc()
	ctx := context.Background()
	_, err := svc.CreatePost(ctx, "u1", "collaborator",
		protocol.CreatePostPayload{Kind: "investment-signal", Body: "x"}, nil)
	if !errors.Is(err, ErrInvalidKind) {
		t.Fatalf("want ErrInvalidKind, got %v", err)
	}
}

func TestCreatePostAcceptsRoleKind(t *testing.T) {
	svc, _, _ := newSvc()
	ctx := context.Background()
	post, err := svc.CreatePost(ctx, "u1", "collaborator",
		protocol.CreatePostPayload{Kind: "role-available", Body: "hiring"}, nil)
	if err != nil || post.Kind != "role-available" {
		t.Fatalf("want role-available accepted, got post=%+v err=%v", post, err)
	}
}
```

Add `"errors"` to the imports of `service_test.go` (the import block currently has `context`, `testing`, `protocol`, `store`).

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `gobc test ./internal/feed/`
Expected: FAIL — `ErrInvalidKind` undefined.

- [ ] **Step 3: Add the sentinel + validation**

In `backend/internal/feed/service.go`, add the sentinel next to `ErrPostNotFound`:

```go
// ErrInvalidKind is returned when a post kind is not allowed for the author's role.
var ErrInvalidKind = errors.New("invalid post kind for role")
```

Then replace the head of `CreatePost` (the `kind := p.Kind` block and the `AuthorRole` field) so the role is normalized once and used for validation:

```go
func (s *Service) CreatePost(ctx context.Context, authorID, authorRole string, p protocol.CreatePostPayload, recipients []string) (store.Post, error) {
	role := store.NormalizeRole(authorRole)
	kind := p.Kind
	if kind == "" {
		kind = "update"
	} else if !store.AllowedKind(role, kind) {
		return store.Post{}, ErrInvalidKind
	}
	post := store.Post{
		ID:         protocol.NewMsgID(),
		AuthorID:   authorID,
		AuthorRole: role,
		Audience:   store.SanitizeAudience(p.Audience),
		Kind:       kind,
		Body:       p.Body,
		CreatedAt:  s.now().UTC(),
	}
```

(The rest of `CreatePost` — `s.posts.CreatePost`, the `s.broadcast(...)` call, and `return post, nil` — is unchanged. `errors` is already imported in `service.go`.)

- [ ] **Step 4: Run to verify it passes**

Run (from `backend/`): `gobc test ./internal/feed/`
Expected: PASS (new tests + existing `TestCreatePostStampsRoleAndAudience` etc. still green).

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/feed/service.go backend/internal/feed/service_test.go
git -C /home/faithsax/new-frontend commit -m "feat(ws6): CreatePost rejects kind not allowed for role (ErrInvalidKind)"
```

---

## Task 3: Backend — HTTP 400 for invalid kind

**Branch:** `feat/messaging-backend`.

**Files:**
- Modify: `backend/internal/transport/httpapi/posts.go`
- Test: `backend/internal/transport/httpapi/httpapi_test.go`

- [ ] **Step 1: Write the failing test**

Append to `backend/internal/transport/httpapi/httpapi_test.go`:

```go
func TestCreatePostInvalidKindReturns400(t *testing.T) {
	r, ver, _ := newAPI(t)
	tok, _ := ver.Mint("u1", "U1", "collaborator")
	rec := httptest.NewRecorder()
	pb, _ := json.Marshal(map[string]any{"kind": "investment-signal", "body": "x"})
	req := httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 400 {
		t.Fatalf("want 400, got %d body=%s", rec.Code, rec.Body)
	}
}

func TestCreatePostValidRoleKindReturns200(t *testing.T) {
	r, ver, _ := newAPI(t)
	tok, _ := ver.Mint("u1", "U1", "collaborator")
	rec := httptest.NewRecorder()
	pb, _ := json.Marshal(map[string]any{"kind": "role-available", "body": "hiring"})
	req := httptest.NewRequest("POST", "/api/v1/posts", bytes.NewReader(pb))
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("want 200, got %d body=%s", rec.Code, rec.Body)
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run (from `backend/`): `gobc test ./internal/transport/httpapi/`
Expected: FAIL — invalid-kind request returns 500 (current behavior), not 400.

- [ ] **Step 3: Map ErrInvalidKind → 400**

In `backend/internal/transport/httpapi/posts.go`, extend `feedErr` to map the new sentinel:

```go
func feedErr(w http.ResponseWriter, err error) {
	if errors.Is(err, feed.ErrPostNotFound) {
		writeErr(w, http.StatusNotFound, err.Error())
		return
	}
	if errors.Is(err, feed.ErrInvalidKind) {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeErr(w, http.StatusInternalServerError, err.Error())
}
```

Then in `handleCreatePost`, replace the inline 500 with `feedErr`:

```go
		post, err := d.Feed.CreatePost(r.Context(), me, currentRole(r), p, audience(d, r))
		if err != nil {
			feedErr(w, err)
			return
		}
```

(`errors` and `feed` are already imported in `posts.go`.)

- [ ] **Step 4: Run to verify it passes**

Run (from `backend/`): `gobc test ./internal/transport/httpapi/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/faithsax/new-frontend add backend/internal/transport/httpapi/posts.go backend/internal/transport/httpapi/httpapi_test.go
git -C /home/faithsax/new-frontend commit -m "feat(ws6): POST /posts returns 400 for kind not allowed for role"
```

---

## Task 4: Frontend — postKinds map + kindsForRole (local-gate tested)

**Branch:** `feat/messaging-phase1` (run `git checkout feat/messaging-phase1` first).

**Files:**
- Create: `frontend/src/lib/messaging/postKinds.ts`
- Test: `frontend/src/lib/messaging/postKinds.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/messaging/postKinds.test.ts`:

```ts
import { test, expect } from "vitest";
import { kindsForRole, KIND_META, GENERIC_KINDS } from "./postKinds";

test("founder and community get generic kinds only", () => {
  expect(kindsForRole("founder")).toEqual(GENERIC_KINDS);
  expect(kindsForRole("community")).toEqual(GENERIC_KINDS);
});

test("collaborator gets generic + collaborator kinds, not other roles'", () => {
  const ks = kindsForRole("collaborator");
  expect(ks).toContain("milestone");
  expect(ks).toContain("role-available");
  expect(ks).not.toContain("investment-signal");
});

test("investor and organisation get their own kinds", () => {
  expect(kindsForRole("investor")).toContain("investment-signal");
  expect(kindsForRole("organisation")).toContain("opportunity-post");
});

test("unknown role falls back to generic only", () => {
  expect(kindsForRole("wizard")).toEqual(GENERIC_KINDS);
});

test("every offered kind has KIND_META", () => {
  const all = [
    ...kindsForRole("collaborator"),
    ...kindsForRole("investor"),
    ...kindsForRole("organisation"),
  ];
  for (const k of all) {
    expect(KIND_META[k]).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run (from `frontend/`): `node --no-warnings --experimental-strip-types scripts/run-tests.mjs src/lib/messaging`
Expected: FAIL — cannot find `./postKinds`.

- [ ] **Step 3: Implement postKinds.ts**

Create `frontend/src/lib/messaging/postKinds.ts`:

```ts
import { normalizeRole } from "./roles";

// Canonical generic kinds (every role). Mirrors store.GenericKinds (Go); the
// backend also accepts legacy aliases build/collab/update, but the composer
// emits these canonical ids going forward.
export const GENERIC_KINDS: string[] = [
  "milestone",
  "insight",
  "build-update",
  "collab-call",
  "question",
  "problem",
];

// Role-specific kinds added on top of generic. Mirrors store.RoleKinds (Go).
export const ROLE_KINDS: Record<string, string[]> = {
  collaborator: ["contribution-update", "skill-showcase", "role-available"],
  investor: ["investment-signal", "portfolio-update", "thesis-post"],
  organisation: ["opportunity-post", "programme-announcement", "community-spotlight"],
};

/** Kinds a viewer of `role` may post: generic ∪ role-specific. Unknown -> generic. */
export function kindsForRole(role: string): string[] {
  return [...GENERIC_KINDS, ...(ROLE_KINDS[normalizeRole(role)] ?? [])];
}

/** Display label + emoji for every kind, for composer chips. */
export const KIND_META: Record<string, { label: string; emoji: string }> = {
  milestone: { label: "Milestone Hit", emoji: "🏆" },
  insight: { label: "Insight", emoji: "💡" },
  "build-update": { label: "Build Update", emoji: "📊" },
  "collab-call": { label: "Collab Call", emoji: "🤝" },
  question: { label: "Question", emoji: "❓" },
  problem: { label: "Problem Signal", emoji: "🌍" },
  "contribution-update": { label: "Contribution Update", emoji: "🧱" },
  "skill-showcase": { label: "Skill Showcase", emoji: "🎯" },
  "role-available": { label: "Role Available", emoji: "🧩" },
  "investment-signal": { label: "Investment Signal", emoji: "📈" },
  "portfolio-update": { label: "Portfolio Update", emoji: "📁" },
  "thesis-post": { label: "Thesis", emoji: "🧭" },
  "opportunity-post": { label: "Opportunity", emoji: "📣" },
  "programme-announcement": { label: "Programme", emoji: "📅" },
  "community-spotlight": { label: "Community Spotlight", emoji: "🌟" },
};
```

- [ ] **Step 4: Run to verify it passes**

Run (from `frontend/`): `node --no-warnings --experimental-strip-types scripts/run-tests.mjs src/lib/messaging`
Expected: all messaging tests pass (the 12 from earlier slices + these 5).

- [ ] **Step 5: tsc check**

Run (from `frontend/`): `npx tsc -b --noEmit 2>&1 | grep -E "lib/messaging/postKinds" || echo "no new errors"`
Expected: `no new errors`.

- [ ] **Step 6: Commit**

```bash
git -C /home/faithsax/new-frontend add frontend/src/lib/messaging/postKinds.ts frontend/src/lib/messaging/postKinds.test.ts
git -C /home/faithsax/new-frontend commit -m "feat(ws6): frontend role->post-kinds map + kindsForRole + KIND_META (vitest)"
```

---

## Task 5: Frontend — role-aware PostComposer menu

**Branch:** `feat/messaging-phase1`.

**Files:**
- Modify: `frontend/src/dashboard/feed/components/PostComposer.tsx`

- [ ] **Step 1: Swap imports + derive the menu from the viewer role**

Replace the import block + the hardcoded `postTypes` array at the top of `PostComposer.tsx`.

Current imports:
```tsx
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { createPost } from '@/lib/messaging/feed';
import { VIEWER_ROLES } from '@/lib/messaging/roles';
```

New imports:
```tsx
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { createPost } from '@/lib/messaging/feed';
import { VIEWER_ROLES, normalizeRole } from '@/lib/messaging/roles';
import { kindsForRole, KIND_META } from '@/lib/messaging/postKinds';
import { useAuth } from '@/contexts/AuthContext';
```

Replace the hardcoded `postTypes` array (the `const postTypes = [ ... ];` block) with a role-derived list:
```tsx
  const { user } = useAuth();
  const viewerRole = normalizeRole(user?.role);
  const postTypes = kindsForRole(viewerRole).map((k) => ({
    id: k,
    label: `${KIND_META[k].emoji} ${KIND_META[k].label}`,
  }));
```

- [ ] **Step 2: Simplify the chip styling (drop per-type color)**

The derived `postTypes` no longer carry a `color`. In the chip `.map((type) => ...)` for `postTypes`, replace the className/style that referenced `type.color` with a single accent style. Change the button to:
```tsx
            <button key={type.id} onClick={() => setSelectedType(type.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${selectedType === type.id ? 'bg-accent-primary/10 border-accent-primary text-accent-primary' : 'bg-transparent border-border-default text-text-secondary hover:border-border-active'}`}>
              {type.label}
            </button>
```
(Remove the previous `style={selectedType === type.id ? { backgroundColor: ... } : undefined}` attribute entirely.)

The `body`/`audience` state, the audience target chips, and the submit handler `handlePost` (which calls `createPost(selectedType, body.trim(), audience.length ? audience : undefined)`) are unchanged from slice A.

- [ ] **Step 3: tsc check**

Run (from `frontend/`): `npx tsc -b --noEmit 2>&1 | grep -E "feed/components/PostComposer\.tsx" | grep -v "react-router-dom" || echo "no new genuine errors"`
Expected: `no new genuine errors`.

- [ ] **Step 4: Commit**

```bash
git -C /home/faithsax/new-frontend add frontend/src/dashboard/feed/components/PostComposer.tsx
git -C /home/faithsax/new-frontend commit -m "feat(ws6): role-aware PostComposer type menu (kindsForRole)"
```

---

## Task 6: Final verification + push both branches

**Files:** none (verification only).

- [ ] **Step 1: Backend suite + vet (on feat/messaging-backend)**

```bash
git -C /home/faithsax/new-frontend checkout feat/messaging-backend
cd /home/faithsax/new-frontend/backend
gobc() { docker run --rm -e GOFLAGS=-mod=mod -e GOSUMDB=off -v gocache:/go/pkg/mod -v "$PWD":/app -w /app golang:1.23-alpine go "$@"; }
gobc test ./... && gobc vet ./...
```
Expected: all packages ok; vet clean.

- [ ] **Step 2: Smoke regression (backend)**

Run: `cd /home/faithsax/new-frontend/backend && bash scripts/smoke.sh`
Expected: `==> smoke passed`.

- [ ] **Step 3: Frontend tests + tsc (on feat/messaging-phase1)**

```bash
git -C /home/faithsax/new-frontend checkout feat/messaging-phase1
cd /home/faithsax/new-frontend/frontend
node --no-warnings --experimental-strip-types scripts/run-tests.mjs src
npx tsc -b --noEmit 2>&1 | grep -E "lib/messaging/|feed/components/PostComposer" | grep -v "react-router-dom" || echo "no new genuine errors in changed files"
```
Expected: all messaging tests pass; `no new genuine errors in changed files`.

- [ ] **Step 4: Commit the plan + spec on both branches (docs-on-both)**

The spec is already committed on both branches. Commit THIS plan file on each:
```bash
# on feat/messaging-phase1 (current)
git -C /home/faithsax/new-frontend add docs/superpowers/plans/2026-06-11-ws6-slice-b-per-role-post-types-plan.md
git -C /home/faithsax/new-frontend commit -m "docs(ws6): slice B implementation plan"
PLAN_SHA=$(git -C /home/faithsax/new-frontend rev-parse HEAD)
git -C /home/faithsax/new-frontend checkout feat/messaging-backend
git -C /home/faithsax/new-frontend cherry-pick "$PLAN_SHA"
git -C /home/faithsax/new-frontend checkout feat/messaging-phase1
```

- [ ] **Step 5: Push both branches (updates PR #12 + PR #13)**

```bash
git -C /home/faithsax/new-frontend push origin feat/messaging-phase1
git -C /home/faithsax/new-frontend push origin feat/messaging-backend
```
Expected: both branches pushed; PR #12 (frontend) and PR #13 (backend) update with slice B.

---

## Self-Review (completed by plan author)

- **Spec coverage:** Taxonomy → Task 1 (`GenericKinds`/`RoleKinds`) + Task 4 (`GENERIC_KINDS`/`ROLE_KINDS`/`KIND_META`). Backend role-gating + `ErrInvalidKind` → Tasks 1–2. 400 mapping → Task 3. Frontend `kindsForRole` + role-aware composer → Tasks 4–5. Testing/verification → each task + Task 6. Docs-on-both → spec already on both; Task 6 Step 4 for the plan.
- **Reconciliation captured:** slice-A composer emitted `build`/`collab`; canonical kinds are `build-update`/`collab-call`. Backend `GenericKinds` keeps `build`/`collab`/`update` as legacy-valid (Task 1); composer moves to canonical ids (Task 4 `GENERIC_KINDS`, Task 5 menu). No existing data breaks (validation only runs on create; reads are unaffected).
- **Type consistency:** `AllowedKind(role, kind)` (Go) ↔ `kindsForRole(role)` (TS) use the same kind strings and the same `NormalizeRole`/`normalizeRole` (unknown → community → generic only). `ErrInvalidKind` defined in `feed` (Task 2), referenced in `feedErr` (Task 3). `KIND_META` keys cover every kind `kindsForRole` can return (Task 4 test asserts this).
- **Placeholder scan:** none — every code step shows complete code; every run step has an expected result.
- **Scope:** single slice, six small tasks across two branches; no decomposition needed.
