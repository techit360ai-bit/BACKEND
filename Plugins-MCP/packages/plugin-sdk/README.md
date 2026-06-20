# @techit/plugin-sdk — start here for connector authors

Every TechIT integration is a **Connector**: a capability humans can trigger and
AI agents can invoke over MCP. This SDK gives you the contract and the base
classes so that audit logging, secrets isolation, approval gates, permission
checks and contribution events are **enforced for you** — you can't forget them,
because they live in the base classes, not in docs.

## Build a connector in 5 steps

1. **Write `techit.plugin.yaml`** — declare `auth`, `capabilities`, `resources`,
   optional `events`, and `mcp.tools`. Mark mutating tools `destructive: true`
   and set each tool's `requiredRole`. A manifest missing `auth`, `capabilities`,
   `resources` or `mcp` refuses to load.

2. **`auth.ts`** — exchange credentials and store the token via the *scoped*
   secrets handle (`secrets://<plugin>/*`). Never touch env or another namespace.

3. **`connector.ts`** — `extends BaseConnector`. Implement the protected
   `*Impl` hooks (`listResourcesImpl`, `readResourceImpl`, `executeActionImpl`, …)
   plus `policyFor(action)`. The public `Connector` methods are already wrapped
   with permission → approval → audit → contribution.

4. **`mcp.ts`** — `extends BaseMCPServer`. Call `this.handle('tool_name', fn)`
   for each declared tool. Destructive tools route through the approval gate
   automatically; `invoke()` never throws — every outcome is a structured
   `Result`.

5. **`index.ts`** — run the lifecycle (`register → authenticate → ready`) and
   `registry.register(name, mcpServer)`. Verify with the MCP Inspector
   (`npm run mcp:inspect`) before any agent uses the tools.

## What you get for free

| Guarantee | Enforced in |
| --- | --- |
| Manifest validation at load | `manifest/load.ts` |
| Per-plugin secrets isolation | `BasePlugin` + `infra/secrets` |
| Audit entry on every action | `BaseConnector`, `BaseMCPServer` |
| Permission + workspace-isolation check first | both base classes + `infra/auth` |
| Approval gate on destructive actions | both base classes |
| Contribution event after success | both base classes |
| Structured errors (never throws) | `BaseMCPServer.invoke` |

See `plugins/github` for the full reference implementation.
