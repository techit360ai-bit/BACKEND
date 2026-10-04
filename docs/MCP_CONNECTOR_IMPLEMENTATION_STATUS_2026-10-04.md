# MCP Connector Plan — Implementation Status

**Date:** 2026-10-04 (updated)
**Branches (pushed, PRs open):**

| Repo | Branch | PR |
|---|---|---|
| BACKEND | `feat/mcp-workspace-credentials` | #147 |
| new-frontend | `feat/mcp-connections-panel` | #179 |
| ai-router | `feat/mcp-connections-context` | #88 |

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

## Landed after the initial status (same branches)

### Resolve-time provider + scope enforcement (ADR-1 step 3)
- Every one of the 7 connectors resolves via `creds.token()`: missing credential →
  `credential_missing`; recorded-but-insufficient scopes → `scope_insufficient`.
- Real-API selection is `<NAME>_CONNECTOR_MODE=real` alone — the presence of a
  legacy env token no longer decides the API (ADR-3). The git-host per-call
  `MCP_*_TOKEN` fallback was removed.
- The connect route accepts declared `scopes`; unknowns stay `scopesVerified:false`.
- Tests: platform-GitHub-connection scopes recorded → checked against the vault
  credential → DENIED at call time; provider isolation.

### WS-E — consolidate connector surfaces (new-frontend + BACKEND)
- The workspace `/connectors` surface now reads the live MCP registry
  (`/api/mcp/tools` + `/api/mcp/connections` + `/api/mcp/audit`) through
  `lib/api/connectors.ts`. `ConnectorId` drops the seeded `ml` pseudo-connector
  and adds `gitlab`/`bitbucket`/`ai`; `authType` gains `rpc_url`.
- The GitHub page no longer posts a fake connector into the seeded store.
- The legacy `workspaceConnectors` collection is deprecated (`Deprecation: true`
  + successor Link to `/api/mcp/connections`), retained until the 2026-12-31
  bootstrap-credential milestone.

### WS-H — workspace ↔ hub continuity + canonical execution intelligence
- `IncubationContext` (project/stage/GSIS/goal/org/program/cohort/hackathon) is
  threaded onto `CallContext` and stamped onto every audit + contribution event.
  Resolved server-side in `resolveActor` from the workspace → project mapping —
  never from the client.
- One canonical, scope/role-aware view, `executionIntelligence`:
  - `GET /api/mcp/execution-intelligence` (MCP) and
    `GET /api/domain/execution-intelligence` (composes canonical trust).
  - It is a VIEW, not a scorer: `trustSubjects` points at the canonical Trust
    Engine (`publicTrustFor`); no second engine, no global score.
  - The SAME envelope serves **founder, collaborator, investor, organization and
    hackathon** consumers; roles differ only in `roleFocus`.
- Frontend: `lib/api/executionIntelligence.ts` + `useExecutionIntelligence` +
  `_shared/ExecutionIntelligencePanel`, wired into the founder, collaborator,
  investor and organization dashboards. ai-router exposes
  `MCPClient.execution_intelligence` / `list_execution_intelligence`.

### WS-J4 — GitHub OAuth → MCP vault bridge
- A connect-purpose `/api/github/callback` imports the token + granted scopes
  into the workspace MCP vault (`importCredential`); one connect powers both the
  platform and the GitHub MCP tools. Best-effort (never breaks the redirect).
- Bridge failure is logged (`mcp_vault_bridge_failed`) and swallowed.

---

## Rollout notes

- Pushed; PRs #147 / #179 / #88 are open.
- Migration: existing process-wide/legacy credentials are imported into the workspace lane once
  (`MCP_CREDENTIAL_BOOTSTRAP=import`); unset it (and remove `MCP_*_TOKEN`) before the removal milestone.
- The backend HTTP supertest suite (`backend/src/__tests__/mcp.test.js`) could not run in this sandbox
  (supertest `listen` is EPERM); it should run in CI.
