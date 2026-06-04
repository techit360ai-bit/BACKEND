# TechIT — Plugin SDK & Connector System: Build & Implementation Plan

> Scope: how we build the **plugin SDK** (`packages/plugin-sdk`) and the **plugin/connector
> system** (`plugins/*`, `packages/mcp-client`) that every TechIT integration depends on.
> Source of truth: `TechIT_Integration_Guide.docx` (HaviTec LTD, v1.0, 2026).
>
> Guiding rule from the guide: **integrate capabilities, not UIs.** Every tool is a *Connector* —
> a capability humans can trigger and AI agents can invoke over MCP. The SDK exists so that every
> connector is built the same way and *cannot* skip security, audit, or approval gates.

---

## 1. Architecture at a glance

```
Agent / Human action
        │
        ▼
packages/mcp-client (registry + protocol client)  ◄── agent runtime is the MCP client
        │   discovers & invokes
        ▼
plugins/<tool>/  (github, figma, notion, ml, web3, ...)
        │   each extends ▼
packages/plugin-sdk  (Plugin Contract: manifest + Connector + MCPAdapter + base classes)
        │   base classes call into ▼
packages/core (artifacts, agent perms, contribution)  +  infra/ (secrets, audit, auth, approval)
        │
        ▼
External APIs (GitHub, Figma, Notion, ML, chains, ...)
```

**Design decision (key):** cross-cutting requirements — audit logging, secrets isolation,
approval gates, agent-permission checks, contribution events — are enforced *inside the SDK base
classes*, not left to each plugin author. A connector author overrides domain methods
(`readResource`, `executeAction`, MCP `invoke`); the base class wraps every call with the
mandatory plumbing. This makes the checklist in the guide structurally guaranteed, not a hope.

---

## 2. Package & ownership boundaries

| Package | Responsibility | Depends on |
| --- | --- | --- |
| `packages/plugin-sdk` | The Plugin Contract: manifest schema + validator, `Connector` & `MCPAdapter` interfaces, `BasePlugin` / `BaseConnector` / `BaseMCPServer` abstract classes, lifecycle, structured error model. **No tool-specific code.** | `core`, `infra` interfaces |
| `packages/mcp-client` | MCP protocol client + `registry.ts`. Discovers MCP servers exported by plugins, validates tool schemas, routes `invoke()` calls from the agent runtime, surfaces tools to the MCP Inspector. | `plugin-sdk` types |
| `packages/core` | Shared domain types: `Artifact` model (`createArtifact`, versioning), agent definition & permission types, `ContributionEvent`, `Workflow`/approval types. | — |
| `infra/secrets` | Token vault interface + adapters. Per-plugin isolated namespaces, lease + rotation. Plugins receive a *scoped* secrets handle, never raw keys. | — |
| `infra/audit` | `logger.ts` — immutable append-only audit entries (actor, action, resource, result, ts). | — |
| `infra/auth` | `rbac.ts` (human roles) + agent-permission enforcement used by the SDK before any action. | `core` |
| `plugins/<tool>` | Concrete connector: `techit.plugin.yaml`, `auth.ts`, `connector.ts`, `mcp.ts`, `webhook.ts`/`poller.ts`, `index.ts`. Implements the contract only. | `plugin-sdk` |

**Build order is bottom-up:** `core` types → `infra` interfaces → `plugin-sdk` → `mcp-client` →
first reference connector. Nothing downstream is real until the SDK contract is frozen.

---

## 3. The Plugin SDK (`packages/plugin-sdk`) — internal layout

```
packages/plugin-sdk/
├── src/
│   ├── manifest/
│   │   ├── schema.ts          # Zod schema for techit.plugin.yaml
│   │   └── load.ts            # parse + validate manifest, fail fast on missing fields
│   ├── contract/
│   │   ├── connector.ts       # interface Connector
│   │   ├── mcp-adapter.ts     # interface MCPAdapter
│   │   └── types.ts           # AuthToken, Resource, Result, MCPTool, structured PluginError
│   ├── base/
│   │   ├── base-plugin.ts     # lifecycle: register() → authenticate() → ready
│   │   ├── base-connector.ts  # wraps every read/write/execute with audit + permission + contribution
│   │   └── base-mcp-server.ts # validates input_schema, enforces agent perms, catches errors
│   ├── hooks/
│   │   ├── audit.ts
│   │   ├── permission.ts
│   │   ├── approval.ts
│   │   └── contribution.ts
│   └── index.ts
├── package.json               # name: @techit/plugin-sdk
└── README.md
```

### Contract (frozen interfaces — from the guide)

```ts
interface Connector {
  authenticate(): Promise<AuthToken>
  listResources(): Promise<Resource[]>
  readResource(id: string): Promise<Resource>
  writeResource(id: string, payload: unknown): Promise<void>
  executeAction(action: string, params: unknown): Promise<Result>
}

interface MCPAdapter {
  describeTools(): MCPTool[]
  invoke(tool: string, params: unknown): Promise<Result>
}
```

### What the base classes guarantee (so authors can't forget)

- **Manifest validation** at load — missing `auth`, `capabilities`, `resources`, or `mcp` → refuse to register.
- **Secrets isolation** — `BasePlugin` resolves a *namespaced* secrets handle (`secrets://<plugin>/*`).
- **Audit on every call** — `BaseConnector` writes an audit entry with `result: success|failure|pending_approval`.
- **Permission check first** — both base classes consult `infra/auth` before executing; denial → structured error + log.
- **Approval gate** — destructive actions return `pending_approval` and emit an approval request instead of executing.
- **Contribution emit** — after a successful trackable action, `emitContribution()` fires automatically.
- **`invoke()` never throws** — all errors become structured `{ error, code, detail }` results.

---

## 4. MCP client & registry (`packages/mcp-client`)

- `registry.ts` — plugins call `register(mcpServer)`; registry indexes by plugin name and validates each `describeTools()` entry.
- Routing — agent runtime calls `client.invoke(plugin, tool, params)`; client runs permission/approval pre-checks, then calls the adapter.
- **MCP Inspector** — `npm run mcp:inspect` lists all registered servers/tools and allows manual invocation before any agent uses them.
- Follows the open MCP spec so adding a tool = adding an MCP server only.

---

## 5. Reference connector — GitHub (`plugins/github`)

GitHub is the first connector because it exercises the **full** contract surface (OAuth, read,
write, execute, webhooks, MCP, artifacts). It becomes the template every other plugin copies.

- Each linked repo registers as `Artifact(type='code', source_tool='github', external_id=repo.id)`.
- Destructive MCP tools (`create_pull_request`, `run_workflow`) flow through the approval gate.
- After this lands, **Notion** is the recommended second connector (poller path).

---

## 6. Cross-cutting concerns (enforced by the SDK)

| Concern | Where | Enforced how |
| --- | --- | --- |
| Zero-trust / per-plugin isolation | `infra/secrets` + `BasePlugin` | scoped secrets handle per plugin namespace |
| Audit log (immutable) | `infra/audit/logger.ts` | base classes write on every action |
| Approval gates on destructive actions | `plugin-sdk/hooks/approval.ts` | manifest flag → `pending_approval` |
| Agent permission minimisation | `infra/auth` + `core` agent defs | explicit `tools_allowed`, no wildcards |
| Contribution / execution intelligence | `plugin-sdk/hooks/contribution.ts` → `core` | `emitContribution()` after success |
| Artifact linkage | `packages/core/artifacts.ts` | `createArtifact()` on link, version bump on change |

---

## 7. Testing & verification strategy

1. **Manifest validation tests** — malformed manifest must fail to register.
2. **Contract tests** — every connector satisfies the `Connector` + `MCPAdapter` shape.
3. **MCP Inspector smoke test** — every tool manually invocable and returns structured output.
4. **Permission boundary (sandbox) test** — actions outside an agent's permissions → rejection + audit entry.
5. **Approval-gate test** — destructive action returns `pending_approval` and does not execute without approval.
6. **Audit completeness** — an audit entry exists for every executed action.

---

## 8. Phased rollout

- **Phase 0 (foundation):** freeze `core` types + `infra` interfaces; build `plugin-sdk` contract + base classes; build `mcp-client` registry + inspector.
- **Phase 1:** GitHub reference connector end-to-end; sandbox + approval tests green.
- **Phase 2:** Notion connector (poller path) + Figma connector (design-to-code flagship).
- **Phase 3:** ML + Web3 connectors; harden secrets rotation, SSO/RBAC, SOC 2 audit coverage.

---

## 9. Risks & trade-offs

- **Freezing the contract too late** blocks every connector — lock `Connector`/`MCPAdapter` and the manifest schema first.
- **Plugins bypassing cross-cutting plumbing** — mitigated by enforcing it in base classes, not docs.
- **Notion has no webhooks** — accept a 5-min poller; design the event bus so polling and webhooks emit identical events.
- **MCP spec drift** — pin the MCP SDK version and gate upgrades behind the inspector test suite.

---

## Implementation status (this build)

- [x] Monorepo scaffold (npm workspaces, TS, vitest)
- [x] `packages/core` — artifacts, agent perms, contribution, workflow/approval types
- [x] `infra/secrets` — scoped vault interface + in-memory adapter
- [x] `infra/audit` — immutable append-only logger
- [x] `infra/auth` — RBAC + agent permission enforcement
- [x] `packages/plugin-sdk` — manifest schema/loader, contract, base classes, hooks
- [x] `packages/mcp-client` — registry, client routing, inspector
- [x] `plugins/github` — reference connector (auth, connector, mcp, webhook, manifest)
- [x] Test suite covering all 6 verification strategies
