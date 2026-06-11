# WS6 Slice B — Per-Role Post Types + Composer — Design Spec

**Date:** 2026-06-11
**Workstream:** WS6 (Role-Aware Hangout/Feed)
**Builds on:** WS6 Slice A (`author_role` server-stamped from JWT, `audience[]`, zone-filtered `GET /posts?zone=global|tribe`, role-aware `PostComposer`).
**Branches:** backend → `feat/messaging-backend` (PR #13); frontend → `feat/messaging-phase1` (PR #12). Backend and frontend stay on separate branches. Spec + plan committed to **both** (docs-on-both).

## Goal

Give each user role its own set of post types in the feed composer, and make the backend authoritative about which `kind` a given role may post. Additive: every role keeps the existing generic types and gains role-specific ones. No structured per-type fields in this slice — `kind` + free-text `body` only.

## Non-Goals (explicitly deferred)

- Structured per-type payloads (skills, deadlines, startup refs, etc.) — belongs to the slices that own them (e.g. Slice C contribution records).
- New feed card components — the Slice A feed cards already render any `kind` as a labeled post.
- Per-type automatic audience defaults — the composer's audience selector (Slice A) stays independent of `kind`.
- A server endpoint that publishes the role→kinds map — a small static map is duplicated in Go and TS (same pattern as the existing role lists).
- Dropped WS6 slices: D (Opportunities Board) and E (Project Discovery) already exist in the founder role; F (investor terminal in feed) not needed. Remaining after B: C (scoring + contribution records), G (org broadcast/talent/sponsorship).

## Taxonomy (canonical kinds)

**Generic — valid for every role:** `milestone`, `insight`, `build-update`, `collab-call`, `question`, `problem`. Plus `update` kept valid (legacy default; existing stored posts and the `CreatePost` empty-kind default use it).

**Role-specific — added on top of generic for that role only:**

| Role | Adds |
|---|---|
| `collaborator` | `contribution-update`, `skill-showcase`, `role-available` |
| `investor` | `investment-signal`, `portfolio-update`, `thesis-post` |
| `organisation` | `opportunity-post`, `programme-announcement`, `community-spotlight` |
| `founder` | (generic only) |
| `community` | (generic only) |

"Allowed kinds for a role" = generic ∪ role-specific(role). Role is the **normalized** author role (`NormalizeRole`; unknown/empty → `community`, which yields generic only).

## Backend (Go — `feat/messaging-backend`)

### New file: `internal/store/postkinds.go`
- `GenericKinds map[string]bool` — the 6 generic kinds + `update`.
- `RoleKinds map[string][]string` — role-specific additions, keyed by normalized role (`collaborator`, `investor`, `organisation`).
- `func AllowedKind(role, kind string) bool` — returns true iff `kind` ∈ `GenericKinds` OR `kind` ∈ `RoleKinds[NormalizeRole(role)]`.

### `feed.Service.CreatePost` (`internal/feed/service.go`)
After stamping `authorRole := store.NormalizeRole(authorRole)`:
- if `kind == ""` → `kind = "update"` (unchanged default).
- else if `!store.AllowedKind(authorRole, kind)` → return `store.Post{}, ErrInvalidKind`.

`ErrInvalidKind` is a new sentinel error exported from the `feed` package (where `CreatePost` lives, next to its other errors). Audience sanitization, persistence, and `post.new` broadcast are unchanged.

### HTTP (`internal/transport/httpapi/posts.go`)
`handleCreatePost`: map `ErrInvalidKind` → **400** `{"error":"invalid post kind for role"}`. All other errors keep their current mapping (500 for store errors, existing 400s). No router changes.

Because `author_role` is server-stamped from the JWT (Slice A), a client cannot spoof a role to unlock a role-specific kind.

## Frontend (TS — `feat/messaging-phase1`)

### New file: `src/lib/messaging/postKinds.ts`
- `GENERIC_KINDS: string[]` and `ROLE_KINDS: Record<string, string[]>` — mirror of the Go map.
- `kindsForRole(role: string): string[]` — `GENERIC_KINDS` concatenated with `ROLE_KINDS[normalizeRole(role)] ?? []`. Pure; uses `normalizeRole` from `roles.ts`. Unknown role → generic only.
- `KIND_META: Record<string, { label: string; emoji: string }>` — display label + emoji for every kind. The existing 6 generic types keep their current composer labels/emojis; new types get sensible labels (e.g. `role-available` → "🧩 Role Available", `investment-signal` → "📈 Investment Signal", `opportunity-post` → "📣 Opportunity").

### `PostComposer.tsx` (`src/dashboard/feed/components/`)
- Derive the viewer role from `AuthContext` (fallback `localStorage` `techit_user.role`), then `normalizeRole`.
- Replace the hardcoded `postTypes` array with `kindsForRole(viewerRole).map(k => ({ id: k, ...KIND_META[k] }))`.
- `selectedType` state, the chip rendering, and the Slice A submit `createPost(selectedType, body, audience.length ? audience : undefined)` are unchanged — only the *set of chips* becomes role-aware.

No new card components; the Slice A feed cards already render arbitrary kinds with a label.

## Testing & Verification

### Backend
- `postkinds_test.go`: `AllowedKind` — every generic kind accepted for every role; each role-specific kind accepted only for its role; cross-role rejected (e.g. `AllowedKind("collaborator","investment-signal")` == false); unknown role → generic only; `update` accepted for all.
- `feed` service test: `CreatePost` returns `ErrInvalidKind` for a disallowed kind; succeeds (and stamps `kind`) for a valid one.
- httpapi test: POST `/posts` with a role/kind mismatch → 400; with a valid kind → 200.
- Regression: `go test ./...`, `go vet ./...`, end-to-end `scripts/smoke.sh`.

### Frontend
- `postKinds.test.ts` (local gate `npm run test:local`, since vitest's rolldown-vite SIGBUSes on this host): `kindsForRole` → generic for founder/community, generic + role-specific for collaborator/investor/organisation, generic-only for an unknown role; every returned kind has a `KIND_META` entry.
- `tsc -b --noEmit` clean on changed files (excluding pre-existing project-wide noise).

## Open Questions

None. All decisions resolved during brainstorming:
- Additive type menu (every role keeps generic + gains role-specific).
- Backend role-gated/authoritative (rejects role/kind mismatch with 400).
- `kind` + free body only; no structured fields this slice.
- Role→kinds map duplicated as a small static map in Go and TS (no endpoint).
- Audience selector stays independent of kind.
