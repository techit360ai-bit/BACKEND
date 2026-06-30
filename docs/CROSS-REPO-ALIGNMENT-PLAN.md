# Cross-Repo Alignment Plan

Started 2026-06-20. Single authoritative plan for the C1–C12 conflict-resolution sweep across the three active repositories.

## Repo layout (canonical)

There is **one** backend: this repo (`BACKEND`). Service domains live as branches in the same monorepo:

| Branch | Stack | Purpose | Port |
|---|---|---|---|
| `main` | Node.js (Express 5) + React | Platform auth, users, OTP, current production frontend | `:3000` (API) / `:5173` (frontend dev) |
| `feat/messaging-backend` | Go (chi, pgx, LiveKit) | Messaging, channels, posts, demos, audience Q&A, RTC tokens, presence, WebSocket gateway | `:8080` |
| `feat/plugins-mcp` (TBD) | Node.js (Express 5) + TypeScript MCP SDK | Tools-calling / external connectors (GitHub etc.) for the Workspace section | mounted on `:3000` under `/api/mcp/*` |
| `plan/cross-repo-alignment` | — | This plan + work logs | — |

Two ancillary repos remain separate from BACKEND:

- `new-frontend` (https://github.com/techit360ai-bit/new-frontend.git) — the React/Vite app the user ships. Calls BACKEND/main (`:3000`), ai-router (`:8000`), BACKEND/feat/messaging-backend (`:8080`).
- `ai-router` (https://github.com/techit360ai-bit/ai-router.git) — FastAPI/Python AI orchestrator (`:8000`). Validates JWTs issued by BACKEND/main.

A third repo, `techit-mcp-plugins-and-SDK-deployment`, is empty (initial commit only) and pending a fate decision under C12.

## The 12 conflicts (in execution order)

### C1 — BACKEND default branch + branch hygiene
- `feat/messaging-backend` was set as the remote default; anyone cloning lands on Go messaging code, not on the monorepo. Change default back to `main` once C6 has a stable plugins-mcp branch alongside.
- Audit feature branches; mark stale ones for deletion (destructive — confirm before deleting).

### C2 — Standardize JWT secret env var
- BACKEND/main already uses `JWT_SECRET` (with insecure literal fallback `'fallback_secret_change_in_production'`).
- BACKEND/feat/messaging-backend uses `JWT_SECRET` (required, no default).
- ai-router uses `SECRET_KEY`.
- **Action:** ai-router migrates to `JWT_SECRET` (fallback to `SECRET_KEY` for one release for compat). Document the shared-secret contract here. Remove BACKEND/main's hardcoded fallback — force startup failure when missing.

### C3 — ai-router demo-auth guardrail
- `ALLOW_DEMO_AUTH=true` is the silent default. If unset in prod, unsigned requests succeed as a fake Founder Pro user.
- **Action:** at startup, raise if `ALLOW_DEMO_AUTH=true` and `ENVIRONMENT in {'production', 'staging'}`. Log a loud warning otherwise.

### C4 — Promote-to-startup persistence
- Frontend `PromoteToStartupModal` stores `promotedProjectId` only in React context.
- ai-router `POST /founder/projects` accepts only `{title, tagline, industry, stage}` — no hackathon linkage.
- ai-router `POST /hackathons/{id}/teams/{teamId}/report` may not exist.
- **Action:** extend `POST /founder/projects` payload with optional `hackathon_id`, `team_id`; persist linkage. Implement or remove the `/report` call. Frontend forwards the new fields from `HackathonRegistration`.

### C5 — Align `/admin/monitor/scan` HTTP method
- Frontend agent reported `GET`, ai-router router showed `POST`. Read both directly and align — `POST` is correct for a side-effectful scan trigger; if frontend uses GET, fix the client.

### C6 — Wire Plugins-MCP backend as a live service
- The `Plugins-MCP/` monorepo is built, has a GitHub reference connector + tests, and ships `mountTechitApi(app)` for Express — but no running backend mounts it. Frontend `/plugins` calls `/api/{tools,audit,contributions,approvals,invoke,approvals/:id/approve}` that 404.
- **Action:** create branch `feat/plugins-mcp` on BACKEND from `main`. Copy `Plugins-MCP/` into the branch. Add `mountTechitApi(app, '/api/mcp')` to `backend/src/app.js`. Add `@techit/*` workspace packages or direct path imports so the SDK builds inside the backend's Node runtime. Update frontend to call `/api/mcp/*` instead of `/api/*` (to avoid collision with BACKEND's existing `/api/auth`, `/api/users`).

### C7 — Resolve BACKEND/origin/new-frontend (misplaced mirror)
- That branch contains a stale frontend snapshot (121 commits behind new-frontend/main) plus two extra commits: `aaa1be9` (plugins-mcp SDK + frontend panel) and `688f59b` (screenshot).
- **Action:** before deleting, cherry-pick the Plugins-MCP/ tree from `aaa1be9` and the screenshot from `688f59b` onto `feat/plugins-mcp`. Then delete `origin/new-frontend` on remote (destructive — confirm).

### C8 — Eliminate Plugins-MCP cross-repo drift
- Same `aaa1be9` SHA lives on `new-frontend/feature/plugins-mcp-connector-system`. Once C6 lands on BACKEND, the frontend keeps only the `/plugins` UI panel and points it at the BACKEND-hosted `/api/mcp/*`.
- **Action:** delete `Plugins-MCP/` directory from `new-frontend/feature/plugins-mcp-connector-system`; rebase the frontend changes into a clean branch on new-frontend (call it `feat/plugins-panel`); ensure `frontend/src/lib/api/mcp.ts` (or equivalent) uses `VITE_BACKEND_BASE_URL` (`http://localhost:3000`) + `/api/mcp/*`.

### C9 — Replace Plugins-MCP self-declared auth with JWT
- `Plugins-MCP/server/techit-service.ts` hardcodes `WS = 'ws-acme'` and reads `actor.role` straight from request body — caller-controlled.
- **Action:** add a JWT middleware to `mount.ts` that verifies with the same `JWT_SECRET` as BACKEND/main. Extract `sub`, `role`, and a new `workspaceId` claim. Pass the verified actor into `svc.invoke(...)` instead of the raw body. Reject requests without a valid token.

### C10 — ai-router ↔ Plugins-MCP integration decision
- Two parallel tool surfaces today: ai-router agent endpoints and Plugins-MCP `/api/invoke`. Pick one of:
  - **(A)** Frontend orchestrates: ai-router suggests tools; frontend executes via Plugins-MCP. Lowest coupling.
  - **(B)** ai-router calls Plugins-MCP `/api/invoke` server-side. Requires service-to-service token, MCP client in Python.
  - **(C)** No integration; Plugins-MCP is a standalone tools registry.
- **Action:** document the chosen pattern here; if (B), add a small async HTTP client to ai-router with circuit-breaker; if (A), document the frontend orchestration contract.

### C11 — Stop plugins-mcp branch regressing messaging frontend
- `new-frontend/feature/plugins-mcp-connector-system` (single commit `aaa1be9`) diff vs main shows deletions of `frontend/src/lib/demo/*` and `frontend/src/lib/messaging/*` (~20+ files), which pair with the Go BACKEND D1/D2 work.
- **Action:** verify whether these deletions are in `aaa1be9` itself or stem from base-divergence. Rebase the branch on current `new-frontend/main` so messaging client survives the merge.

### C12 — Decide fate of empty standalone repo
- `techit-mcp-plugins-and-SDK-deployment` has only `README.md`. Architecture clarification puts Plugins-MCP inside BACKEND, so this repo is redundant.
- **Action:** archive on GitHub (preferred) or repurpose for SDK consumer-side artefacts (release tarballs, plugin manifests). Decide here.

## Cross-cutting principles for this work

- **Token minimization:** do not re-explore what's already documented here. Refer back to this doc + memory `project_active_repos` + `project_alignment_plan` instead of re-scanning the repos.
- **No silent destructive ops:** any branch delete, default-branch swap, or force-push gets confirmed in the chat first.
- **Stage on this branch, merge on completion:** small commits to `plan/cross-repo-alignment` are fine for plan iteration. Code changes happen on `feat/*` branches or PRs against the respective repo's `main`.

## Resumption protocol

Fresh Claude session?

1. Read memory file `project_active_repos`.
2. Read memory file `project_alignment_plan`.
3. Read this doc (`docs/CROSS-REPO-ALIGNMENT-PLAN.md` on `plan/cross-repo-alignment`).
4. Run `TaskList`. Pick up the first `in_progress` task; if none, the first `pending` task.
5. Continue. Do not re-do the C1–C12 sweep — it's already captured here.
