# TechIT MCP Execution Layer — MVP Runbook

This is the operator's guide to the MCP execution layer: what's built, how to test
it (three ways, fastest first), and how it reaches the website. Everything here
is live in `BACKEND/Plugins-MCP` and mounted on the platform API at `/api/mcp`.

---

## 1. What's built

Five connectors, **22 tools**, all registered in `server/techit-service.ts` and
served over MCP. Each connector is **hybrid**: a deterministic in-memory *fake*
(the default — safe for demos, needs no secrets) and a *real* implementation you
flip on per-connector with an env var.

| Connector | Tools | Destructive (approval-gated) | Real mode |
|-----------|-------|------------------------------|-----------|
| `github`  | list_repositories, read_file, list_issues, get_pr_status, create_pull_request, run_workflow | create_pull_request, run_workflow | fake only (real API is task #2) |
| `notion`  | search, get_page, create_page, append_blocks | create_page, append_blocks | `NOTION_CONNECTOR_MODE=real` + token |
| `figma`   | get_file, export_frame, list_comments, post_comment | post_comment | `FIGMA_CONNECTOR_MODE=real` + token |
| `web3`    | get_balance, get_transaction, read_contract, siwe_verify | — (read-only Sepolia) | `WEB3_CONNECTOR_MODE=real` + RPC URL |
| `ai`      | generate_code, review_code, deep_research, run_sandbox | run_sandbox | `AI_HARNESS_CONNECTOR_MODE=real` + `AI_ROUTER_URL` |

**Safety note:** `ai.run_sandbox` is **always simulated** — it never executes real
code, in either mode — but it still routes through the approval gate so the
destructive-tool flow is demoable end-to-end.

---

## 2. Architecture in one line

```
Frontend (/plugins Inspector)  ──HTTP──▶  backend Express  /api/mcp/*  (mount.ts)
                                                │
                                                ▼
                              server/techit-service.ts  (singleton)
                                                │  MCPClient → MCPRegistry
                                                ▼
                    5 connectors ──▶ FakeXApi (default)  |  RealXApi (env-gated)
```

Every invocation is: **validate input → permission check (role + agent
allow-list) → approval gate if destructive → run → audit + contribution emitted**.
`invoke` never throws; it returns a structured `Result`.

---

## 3. Test it — fastest first

### (a) Unit tests + typecheck (no backend, seconds)
```bash
cd BACKEND/Plugins-MCP
npx vitest run          # 12 files, 57 tests
npm run typecheck       # tsc --noEmit, must be clean
```

### (b) Smoke script — boots the real service, invokes one tool per connector
```bash
cd BACKEND/Plugins-MCP
MCP_DATA_FILE=/tmp/smoke.json npx tsx scripts/smoke.mts
```
Expected: `total tools: 22`, and `invoke <connector>.<tool>: OK` for all five.
Using a throwaway `MCP_DATA_FILE` keeps the demo seed out of your real store.

### (c) Full-stack — through the HTTP API the website uses

**Prerequisite (one-time):** install workspace deps from the repo root so the
backend's runtime deps (express, jsonwebtoken, …) and the `@techit/*` workspace
symlinks exist:
```bash
cd BACKEND && npm install          # creates node_modules/@techit/* symlinks
```
Without this the backend fails to boot with `Cannot find package '@techit/plugin-sdk'`.

```bash
# 1. Start the backend (serves /api/mcp on :3000). JWT_SECRET is required or every
#    request is rejected 401. MCP_DATA_FILE isolates the demo store.
cd BACKEND/backend && JWT_SECRET=testsecret MCP_DATA_FILE=/tmp/mcp.json npm start

# 2. Mint a test JWT (identity/role come from the token, never the request body)
cd BACKEND/backend && TOKEN=$(node --import tsx -e \
  "import jwt from 'jsonwebtoken'; console.log(jwt.sign({sub:'founder',role:'founder',workspaceId:'ws-acme'}, 'testsecret'))")

# 3. List the live catalogue (all 22 tools)
curl -s localhost:3000/api/mcp/tools -H "Authorization: Bearer $TOKEN" | jq 'length'   # → 22

# 4. Invoke a read-only tool
curl -s localhost:3000/api/mcp/invoke -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"plugin":"web3","tool":"get_balance","params":{"address":"0x1234567890abcdef1234567890abcdef12345678"}}'
```
Roles map from the JWT `role` claim: `founder|organisation` → owner, `admin` →
admin, `collaborator` → editor, everything else → viewer.

---

## 4. The approval gate (destructive tools)

Destructive tools return `pending_approval` on first call, then execute once approved:

```bash
# First call → { ok:false, error.code:"pending_approval", approvalRequestId:"..." }
curl -s localhost:3000/api/mcp/invoke -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"plugin":"ai","tool":"run_sandbox","params":{"language":"python","code":"print(1)"}}'

# Approve (admin/owner only)
curl -s localhost:3000/api/mcp/approvals/<id>/approve -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"decidedBy":"founder"}'

# Re-invoke with the approvalRequestId in params → executes, approval marked "used"
```

---

## 5. How it reaches the website

- **`/plugins` (MCP Inspector)** — *already live against `/api/mcp`.* It calls
  `techitApi.tools()` / `.audit()` / `.contributions()` / `.approvals()` and can
  `.invoke()` + `.approve()`. All 22 tools appear automatically with the 6
  destructive ones flagged; **no frontend change was needed** for the new
  connectors. Point it at a deployed backend with `VITE_TECHIT_API`.
- **`/workspaces/connectors`** — currently reads a separate *seeded* collection
  (`workspaceConnectors`), decoupled from the live registry. Consolidating this
  page onto `/api/mcp/tools` is remaining frontend work (task #9).

---

## 6. Known-good state (2026-08-11)

- `npx vitest run` → 12 files / 57 tests passing.
- `npm run typecheck` → clean.
- `scripts/smoke.mts` → 5 connectors, 22 tools, one live read each OK.
- **Full-stack HTTP path verified:** backend boots on :3000, `/api/mcp/tools`
  returns 22, a read invoke returns live data, and the destructive-tool approval
  loop works end-to-end (`pending_approval` → approve → re-invoke → `success`,
  visible in `/api/mcp/audit`).
- One flaky full-suite run was observed once (file-store contention under
  parallelism); reran clean. If it recurs, run connector suites in isolation.

## 7. Backlog (not yet built)

1. Postgres-backed stores + AES-256-GCM secret vault + webhook receiver (task #1).
2. Real GitHub API + OAuth (task #2).
3. ai-router: inject incubation context into agent prompts (task #8).
4. Frontend: real connect flows + workspace connectors on the live registry +
   incubation-context card (task #9).
