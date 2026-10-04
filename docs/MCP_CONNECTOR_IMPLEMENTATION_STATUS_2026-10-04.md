# MCP Connector Plan — Implementation Status

**Date:** 2026-10-04
**Branches (local, not pushed):**

| Repo | Branch | Head |
|---|---|---|
| BACKEND | `feat/mcp-workspace-credentials` | M0/M2/F6/clean-DENY/docs commits |
| new-frontend | `feat/mcp-connections-panel` | Connections panel + client |
| ai-router | `feat/mcp-connections-context` | connections passthrough + DENY mapping |

Decisions implemented: **per-workspace credentials**, **one canonical workspace vault**,
**env = bootstrap-only (keep → deprecate → remove)**, **trust engine canonical**, **X deferred**.
See `docs/MCP-CONNECTOR-DECISIONS-ADR.md`.

---

## Implemented

### M0 — Truth & safety
- **ADR** capturing all locked decisions (`MCP-CONNECTOR-DECISIONS-ADR.md`).
- **GitHub OAuth least privilege by purpose** (`backend/src/config/github.js`): connect requests
  `repo read:user user:email`; trust requests `read:user user:email`; one shared callback; the trust
  flow records a **proof only** and never mints/downgrades a connector.
- **Mount fails closed without `resolveActor`** (no body-supplied actor; F7); demo seeding moved off
  `/health` to `POST /api/mcp/dev/seed`.
- **Docs** (runbook, testing guide, MVP doc) aligned to the shipped model (F4).

### M2 — Workspace isolation, one vault, bootstrap-only env
- **Vault owner scoping**: `scopeTo(plugin, workspaceId)` → `secrets://ws/<workspaceId>/<plugin>/`
  (in-memory + Postgres). Legacy lane `secrets://<plugin>/` is bootstrap-only.
- **`WorkspaceCredentialHandle`** threaded through all **7 connectors**; `BaseMCPServer.bind(ctx)`
  points the handle at the acting workspace; real APIs resolve that workspace's credential.
- **Service/mount**: `connections/connect/disconnect` are workspace-scoped; `requireOperator` is a
  human admin/owner **in the acting workspace**.
- **Bootstrap-only env (ADR-3)**: import gated by `MCP_CREDENTIAL_BOOTSTRAP=import`; emits
  `credential_bootstrap_used` telemetry; marked deprecated; removal milestone `2026-12-31`;
  **no dynamic per-request env fallback**.
- **Clean DENY**: new `credential_missing` code + `CredentialMissingError`; a missing workspace
  credential returns `Connect <provider> for this workspace` — never `upstream_error`, never a fallback.
- **Boot no longer requires env tokens**; production contract requires `MCP_STORE=postgres`,
  `<NAME>_CONNECTOR_MODE=real`, and warns (not fails) on legacy env tokens.
- **Tests**: `workspace-credentials.test.ts` (isolation, bootstrap, no-fallback, clean DENY) —
  suite **88 passing / 4 skipped**, typecheck clean.

### M1 — Frontend
- `techitApi`: `ConnectionStatus` + `connections()/connect()/disconnect()`; `health()` returns the
  resolved actor.
- `PluginsDashboard`: **Connector Credentials** panel (mode/connected/source/expiry; connect/disconnect;
  admin/owner-gated; a saved secret is never shown again) and a **read-only role from the token**
  replacing the misleading client role picker.

### M3 — ai-router
- `mcp_client`: `connections()/is_connected()/connect()/disconnect()`.
- `integration_guide.invoke_tool`: maps BACKEND `credential_missing` → `connector_not_connected`
  (+ `action: connect_provider`); new `list_connections()`.

### M4 — Auth-kind taxonomy (F6)
- Manifest `AuthKind` gains `rpc_url`/`none`; web3 declares `rpc_url`; drift guard test asserts every
  manifest matches its credential descriptor.

### Already satisfied
- **WS-J6** — ai-router `/ready` already checks `MCP_BASE_URL` (https in production) via
  `runtime_config.py`.
- **WS-C** — trust-engine-canonical decision recorded (ADR-4); no competing trust calculation added.

---

## Remaining (larger, cross-cutting — not yet implemented)

| Workstream | What remains | Why deferred |
|---|---|---|
| **WS-E — consolidate connector surfaces** | Repoint `/workspaces/connectors` (seeded mock incl. `ml`, missing gitlab/bitbucket/ai) onto the live `/api/mcp/*` registry; unify `ConnectorId`. | Large frontend refactor of the Workspace module; best done as its own PR with the workspace owner. |
| **WS-H — Workspace ↔ Incubation Hub continuity** | Stamp incubation project/stage/goal onto `CallContext` + contribution events; make tool results appear in the Hub. | Spans BACKEND services + ai-router + Hub data flow; needs the Hub context-pack contract agreed. |
| **WS-J4 — GitHub OAuth → MCP vault bridge** | After a connect-purpose `/api/github/callback`, write the token into the workspace MCP vault so one connect powers GitHub tools. | Introduces backend→MCP-service coupling; do after WS-A migration settles. |

---

## Rollout notes

- Nothing was pushed; all three branches are local. Review, then open PRs.
- Migration: existing process-wide/legacy credentials are imported into the workspace lane once
  (`MCP_CREDENTIAL_BOOTSTRAP=import`); unset it (and remove `MCP_*_TOKEN`) before the removal milestone.
- The backend HTTP supertest suite (`backend/src/__tests__/mcp.test.js`) could not run in this sandbox
  (supertest `listen` is EPERM); it should run in CI.
