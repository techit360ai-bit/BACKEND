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
- 5 connector "clients", each exposing ~4–8 real MCP tools through the existing SDK
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
| **GitHub** | list_repositories, get_repository, read_file, list_issues, get_pr_status, create_issue ✎, create_pull_request ✎, run_workflow ✎ |
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
 │ workspace agents       │──JWT──────▶│  /api/mcp/connectors/:p/... │  │   └───────────────┘
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
- **State is durable.** Audit log, approvals, contributions, and connector secrets live in Postgres.
  Secrets are AES-256-GCM encrypted at rest, scoped per plugin (`secrets://<plugin>/*`).

---

## 4. How to test it (three layers)

**Layer 1 — In-app MCP Inspector (this is also the investor demo).**
`new-frontend` → `/plugins` → "Invoke a Tool": pick connector + tool + actor (human/agent) + role,
pass JSON params, see the structured Result, the new audit-log row, and the contribution feed update.
For a destructive tool you see the full `pending_approval → Approve → re-invoke → success` flow live.

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

Each connector defaults to a deterministic **Fake API** (no network — safe for tests and a can't-fail demo),
and switches to its **Real API** when a token is present in the scoped vault and/or `<NAME>_CONNECTOR_MODE=real`.

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
