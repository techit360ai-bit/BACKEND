# MCP Execution Layer — MVP Plan & Architecture

**Status:** in build (feature branch `feat/mcp-execution-layer-mvp` in all three repos)
**Scope decision:** Execution layer + *light* incubation context. Full Context Graph + Impact Engine deferred to phase 2.

This document is the single reference for the MVP that turns `Plugins-MCP` from a single faked
connector into a live, multi-connector execution layer with durable state — and explains **how to test it**
and **how it connects to the site**.

---

## 1. What we are building (and not)

**Building now**
- Durable persistence for the MCP layer (Postgres) replacing single-file JSON + in-memory secret vault.
- 7 connector "clients" exposing **34** real MCP tools through the existing SDK
  (permission → approval → audit → contribution plumbing inherited, not re-implemented).
- Real OAuth/token connect flows for the deployment trio; testnet/sandbox for the rest (hybrid).
- Light incubation-context injection into the AI agents (they know the startup's stage/GSIS/sprint/goal).
- Frontend: real Connect flows, the new connectors surfaced in the MCP Inspector, an Incubation Context card.
- A testing runbook + smoke script.

**Explicitly deferred to phase 2** (not in this MVP): the full Context Graph (knowledge graph),
the Impact Engine (actions → GSIS/readiness deltas), cross-tool auto-propagation, true SSE streaming,
a secrets backend beyond Postgres+AES-GCM, horizontal multi-replica hardening.

---

## 2. Connectors & tools

Category **Deployment Tools** (real execution, hybrid):

| Client | Tools (role, ✎=destructive→approval) |
|---|---|
| **GitHub** | list_repositories, read_file, list_issues, get_pr_status, get_repository_state, get_commit_checks, get_workflow_run, push_files ✎, create_pull_request ✎, run_workflow ✎ |
| **GitLab** | get_repository_state, read_file, get_commit_checks, push_files ✎ |
| **Bitbucket** | get_repository_state, read_file, get_commit_checks, push_files ✎ |
| **Notion** | search, get_page, create_page ✎, append_blocks ✎ |
| **Figma** | get_file, export_frame, list_comments, post_comment ✎ |

Category **Blockchain/Web3** (Sepolia testnet, read-heavy, demo-safe):

| Client | Tools |
|---|---|
| **web3 (EVM)** | get_balance, get_transaction, read_contract, siwe_verify |

Category **AI-Harness** (wraps ai-router, hybrid):

| Client | Tools |
|---|---|
| **ai-harness** | generate_code, review_code, deep_research, run_sandbox ✎ |

Destructive tools return `pending_approval` and create an ApprovalRequest; a human admin/owner approves,
then the tool is re-invoked with `approvalRequestId`. This is enforced by the SDK base classes for every
connector uniformly — no per-connector approval code.

---

## 3. Architecture (how it connects to the site)

```
 new-frontend                         BACKEND (Node/Express :3000)                 external
 ┌───────────────────────┐            ┌──────────────────────────────┐
 │ /plugins  (MCP Inspec)│  Bearer    │  /api/mcp/*  (mount.ts)       │   real / testnet / sandbox
 │ /workspaces/connectors│──JWT──────▶│   resolveActor = verify JWT   │      ┌───────────────┐
 │  Connect + Invoke UI  │            │   getTechitService()          │─────▶│ GitHub API     │
 └───────────────────────┘            │    ├─ MCPClient.invoke        │      │ Notion API     │
                                      │    ├─ connectors (5)          │      │ Figma API      │
 ai-router (FastAPI :8000)            │    └─ Pg stores + vault  ─────┼──┐   │ Sepolia RPC    │
 ┌───────────────────────┐  Bearer    │  /api/mcp/webhooks/:plugin    │  │   │ ai-router      │
 │ workspace agents       │──JWT──────▶│  /api/mcp/connections/:plugin │  │   └───────────────┘
 │ mcp_client → /invoke   │            └──────────────────────────────┘  │
 │ + incubation context   │                                              ▼
 └───────────────────────┘                                   Postgres (audit, approvals,
                                                              contributions, secrets)
```

- **Two entry points, one execution point.** Humans invoke from the frontend; AI agents invoke from
  ai-router (`mcp_client`, forwarding the same JWT). Both hit `POST /api/mcp/invoke`. This resolves the
  open **C10** decision in `CROSS-REPO-ALIGNMENT-PLAN.md` for the MVP: both paths, one governed executor.
- **Identity is never self-declared.** `resolveActor` in `backend/src/app.js` verifies the platform JWT and
  derives actor id/role/workspace from claims (`mcpRoleFromClaim`). Body-supplied actors are dev-only.
- **Connector credentials are workspace-scoped and write-only.** `GET/POST/DELETE /api/mcp/connections`
  reports and manages credentials in the canonical **workspace** vault lane (`secrets://ws/<workspaceId>/<plugin>/`,
  ADR-1/ADR-2). No route reads a credential back out; connect/disconnect require a human admin or owner in the
  acting workspace. A stored credential does **not** by itself select the live API — `<NAME>_CONNECTOR_MODE=real` does.
  Legacy env tokens (`MCP_*_TOKEN`) are **bootstrap-only** and deprecated (ADR-3): imported only via
  `MCP_CREDENTIAL_BOOTSTRAP=import`, with telemetry and a removal milestone. A missing workspace credential is a
  clean `credential_missing` DENY — never an env/global fallback.
- **State is durable.** Audit log, approvals, contributions, and connector secrets live in Postgres.
  Secrets are AES-256-GCM encrypted at rest, scoped per workspace + plugin (`secrets://ws/<workspaceId>/<plugin>/`). With
  `MCP_STORE=file` the vault is in-process instead: connections are lost on restart (see the runbook §8).
  Credentials stored without an explicit TTL do not expire, in either store.

---

## 4. How to test it (three layers)

**Layer 1 — In-app MCP Inspector (this is also the investor demo).**
`new-frontend` → `/plugins` → "Invoke a Tool": pick connector + tool, pass params (generated from the
tool's `input_schema`, with a raw-JSON escape hatch), see the structured Result, the new audit-log row,
and the contribution feed update. The actor and role shown are the ones the **server** resolved from the
JWT — `POST /invoke` ignores any actor in the body, so the UI no longer offers a role picker that would
be silently overridden. For a destructive tool you see the full `pending_approval → Approve → re-invoke →
success` flow live. A Connections panel drives `/api/mcp/connections` (owner/admin only).

**Layer 2 — CLI inspector (headless, fast dev loop).**
`cd BACKEND/Plugins-MCP && npm run mcp:inspect` — lists the catalogue and invokes tools without the UI.

**Layer 3 — Automated.**
- Per-connector vitest: `npx vitest run plugins/<name>/` (happy path, permission-denied, approval gate, agent allow-list).
- Foundation vitest against Postgres: `DATABASE_URL=… npx vitest run server/pg/`.
- Whole suite + smoke: `npm test` then the smoke script (invokes one tool per connector end-to-end).

Dev Postgres for tests/local: `postgresql://techit:techit@127.0.0.1:55432/techit_mcp`
(a disposable container; for real/staging set your own `DATABASE_URL` + `MCP_SECRET_KEY`).

---

## 5. Real vs sandbox (hybrid) & required credentials

Each connector defaults to a deterministic **Fake API** (no network — safe for tests and a can't-fail demo).
`<NAME>_CONNECTOR_MODE=real` selects the **Real API**; a credential must then also be present in the scoped
vault (supplied via `POST /api/mcp/connections`, or seeded from the matching env var at startup), or the
tool fails with `no stored OAuth token`. Note the two are independent: a stored credential without the mode
var changes nothing, and the mode var without a credential fails at invoke time.

To flip a connector to real, provide (not blocking to start — sandbox works without them):
- **GitHub:** OAuth app (`GITHUB_CLIENT_ID`/`SECRET`) or a PAT.
- **Notion:** internal integration token + a shared page/db id.
- **Figma:** personal access token + a file key.
- **Web3:** a Sepolia RPC URL / Alchemy key (`WEB3_RPC_URL` or `ALCHEMY_API_KEY`).
- **AI-harness:** reuses ai-router (`AI_ROUTER_URL`), no extra key.

---

## 6. Build approach

Originally planned as parallel subagents; pivoted to direct single-threaded implementation on the
`feat/mcp-execution-layer-mvp` branch of each repo (more token-efficient given the context was already loaded).
The only shared integration file, `server/techit-service.ts`, is edited once at the wiring step.

---

## 7. Env vars introduced

| Var | Purpose | Default (dev) |
|---|---|---|
| `DATABASE_URL` / `MCP_DATABASE_URL` | Postgres for MCP state | local disposable container |
| `MCP_SECRET_KEY` | 32-byte key for AES-256-GCM secret encryption | derived dev key + warning |
| `<NAME>_CONNECTOR_MODE` | `real` to use the live API for a connector | unset → fake |
| `WEB3_RPC_URL` / `ALCHEMY_API_KEY` | Sepolia RPC for the web3 connector | fake |
| `AI_ROUTER_URL` | ai-router base for the ai-harness connector | http://localhost:8000 |
