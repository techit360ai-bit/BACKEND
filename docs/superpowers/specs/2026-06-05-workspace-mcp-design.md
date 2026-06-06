# Workspace MCP / Plugin / SDK Layer — Frontend Design

**Status:** Draft (awaiting user review)
**Date:** 2026-06-05
**Module:** `frontend/src/dashboard/workspaces/`
**Backend source of truth:** `docs/techit-integration-guide.md` (HaviTec Integration Guide v1.0) + `docs/plugin-sdk-build-plan.md`
**Guiding principle (from the guide):** *Integrate capabilities, not UIs.* TechIT is a coordination layer; it surfaces what tools can do and what agents can call — it does not embed external editors.

## Goal

Rework the Workspace so the frontend reflects the new MCP / plugin / SDK backend layer. Three pieces, designed together, built in this order:

- **(A) Navigation cleanup** — remove the Incubator Hub from the workspace; replace the two redundant static tool grids (`Tools` + `Dev Tools`) with a single new **Connectors** section.
- **(B) Connectors section** — a registry of every integration (GitHub, Figma, Notion, ML, Web3…) showing OAuth connection status, declared capabilities, and the MCP tools each connector exposes, plus a recent-activity feed. GitHub deep-links to its existing dedicated page.
- **(C) Agents section** — the existing AI Agents page reworked into two tabs: **Catalog** (the existing enable/disable marketplace) and **Console** (a hybrid chat + task-list surface where a user asks an agent to carry out a task in natural language and gets readable, streamed feedback with inline approval gates).

This is **not** a full overhaul of the workspace. It adds the connector/MCP/agent representation and removes only what's redundant.

## Non-goals

- **No live backend calls.** Everything runs on typed fixtures behind a stubbed API client. Nothing actually hits GitHub/Figma/an agent runtime. The backend is at Phase 0 of the SDK build plan.
- **No deep per-connector UIs this round.** Figma/Notion/ML get registry cards + activity feed + MCP-tool listing, not embedded editors or custom deep views. Deep views are deferred and gated on the *real* connector landing (Phase 2: Notion+Figma; Phase 3: ML+Web3). They are additive to this design, not a rewrite of it.
- **No re-homing of the existing GitHub or Files pages.** The GitHub connector card deep-links to the existing `/workspaces/github` page.
- **No heavy global state library.** No Redux/Zustand added. Live updates use a small React context + reducer scoped to the agent console (see Architecture §3).
- **No test framework.** Matches the repo baseline (no suite exists). Verification stays `tsc --noEmit` + manual smoke test (see Verification).
- **No real auth/OAuth.** Connect/disconnect toggles mutate fixture state only; the OAuth redirect flow is represented in the contract but stubbed in UI.
- **No removal of Chat.** Workspace "Chat" stays as human team chat, distinct from the agent Console.

## Architecture

### 1. Shared domain types — `workspaces/lib/types.ts`

One source of truth, lifted directly from the guide's Plugin Contract. The contract *is* this file.

```ts
// --- Connectors / MCP ---
export type ConnectorId = 'github' | 'figma' | 'notion' | 'ml' | 'web3';
export type Capability = 'read' | 'write' | 'execute';
export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface MCPTool {
  name: string;                 // e.g. 'create_pull_request'
  description: string;          // agent-facing; why/when to call
  inputSchema: Record<string, { type: string; required?: boolean }>;
  destructive?: boolean;        // true => routes through approval gate
}

export interface Connector {
  id: ConnectorId;
  name: string;                 // 'GitHub'
  category: string;             // 'Code', 'Design', 'Docs', 'ML', 'Web3'
  status: ConnectorStatus;
  authType: 'oauth2' | 'api_key' | 'service_account';
  capabilities: Capability[];
  tools: MCPTool[];             // from describeTools()
  resources: string[];          // 'repository', 'pull_request', ...
  deepLink?: string;            // e.g. '/workspaces/github' for connectors with an existing page
  lastSync?: string;            // ISO; undefined if never
}

export interface ActivityEvent {
  id: string;
  connectorId: ConnectorId;
  kind: 'webhook' | 'agent_action' | 'sync' | 'approval';
  summary: string;              // 'Figma file abc123 updated → Design Agent opened PR #42'
  at: string;                   // ISO
}

// --- Artifacts (cross-tool linkage) ---
export type ArtifactType = 'code' | 'design' | 'doc' | 'model';
export interface Artifact {
  id: string;
  type: ArtifactType;
  sourceTool: ConnectorId;
  externalId: string;
  version: number;
}

// --- Agents / Console ---
export type AgentTaskStatus =
  | 'queued' | 'running' | 'needs_approval' | 'done' | 'failed' | 'cancelled';

export interface AgentTask {
  id: string;
  agentId: string;             // which catalog agent
  prompt: string;              // the natural-language ask
  status: AgentTaskStatus;
  createdAt: string;
  events: TaskEvent[];         // the readable transcript
}

export type TaskEventType =
  | 'message'        // agent text to the human
  | 'tool_call'      // agent invoking an MCP tool
  | 'tool_result'    // structured result back
  | 'approval_request'
  | 'approval_resolved'
  | 'error'
  | 'status';

export interface TaskEvent {
  id: string;
  type: TaskEventType;
  at: string;
  text?: string;                       // for message / status / error
  tool?: { connectorId: ConnectorId; name: string; params: unknown };
  result?: { ok: boolean; detail: unknown };
  approval?: ApprovalRequest;
}

export interface ApprovalRequest {
  id: string;
  action: string;              // 'create_pull_request'
  connectorId: ConnectorId;
  summary: string;             // human-readable description of what will happen
  resolved?: 'approved' | 'rejected';
}
```

### 2. API seam — `workspaces/lib/api/`

Each function maps **1:1** to a pinned backend endpoint and today returns a fixture from `workspaces/lib/fixtures/`. Swapping to the real backend = replacing the function body only; no component changes.

```
workspaces/lib/
├── types.ts
├── fixtures/
│   ├── connectors.ts        # realistic Connector[] incl. GitHub/Figma/Notion/ML
│   ├── activity.ts          # ActivityEvent[]
│   ├── agents.ts            # reuse existing AIAgent catalog data, relocated here
│   └── tasks.ts             # seeded AgentTask[] showing each status incl. needs_approval
└── api/
    ├── client.ts            # base: USE_MOCKS flag, latency sim, typed fetch wrapper
    ├── connectors.ts        # listConnectors, getConnector, connect, disconnect
    ├── agents.ts            # listAgents, toggleAgent, addCustomAgent
    └── tasks.ts             # listTasks, getTask, createTask, streamTask, resolveApproval
```

#### Pinned API contract (what the backend must implement later)

| Function | Endpoint | Returns |
|---|---|---|
| `listConnectors()` | `GET /api/connectors` | `Connector[]` |
| `getConnector(id)` | `GET /api/connectors/:id` | `Connector` |
| `connect(id)` | `POST /api/connectors/:id/connect` | `{ redirectUrl }` (OAuth) → stub flips status |
| `disconnect(id)` | `POST /api/connectors/:id/disconnect` | `Connector` |
| `listActivity(id?)` | `GET /api/activity?connector=:id` | `ActivityEvent[]` |
| `listAgents()` | `GET /api/agents` | `AIAgent[]` |
| `toggleAgent(id)` | `POST /api/agents/:id/toggle` | `AIAgent` |
| `addCustomAgent(body)` | `POST /api/agents` | `AIAgent` |
| `listTasks()` | `GET /api/agent/tasks` | `AgentTask[]` |
| `getTask(id)` | `GET /api/agent/tasks/:id` | `AgentTask` |
| `createTask(body)` | `POST /api/agent/tasks` | `{ id }` then stream |
| `streamTask(id)` | `GET /api/agent/tasks/:id/stream` (SSE) | stream of `TaskEvent` |
| `resolveApproval(taskId, approvalId, decision)` | `POST /api/agent/tasks/:id/approvals/:aid` | `TaskEvent` |

**Streaming event format (SSE):** each `event: task` carries one `TaskEvent` as JSON `data:`. In mock mode, `streamTask` is an async generator that replays a scripted `TaskEvent[]` from the fixture with simulated delays, pausing on an `approval_request` until `resolveApproval` is called. This makes the real swap (EventSource) mechanical.

### 3. Console state — `workspaces/lib/console/ConsoleContext.tsx`

A small React context + `useReducer` (the "essential bit from a store," without the dependency). Holds: `tasks: AgentTask[]`, `activeTaskId`, and a dispatch that appends streamed `TaskEvent`s and updates status. Scoped to the Agents section provider — not global. This is what makes the task list and chat transcript update live as events stream, and keeps approval state in one place.

### 4. Why this shape

- **Approach A backbone:** one typed domain + one API seam; Connectors and Console both read the same model, so MCP-tool shapes and approval gates are defined once.
- **Essential from B:** fixtures are realistic and rich so screens render immediately; components follow existing workspace conventions (Space Grotesk headers, `#2196F3` accent, the existing `ui/` kit, card-grid patterns) — no new design language.
- **Essential from C:** the scoped console reducer gives live-updating task list + streaming transcript without adopting Redux/Zustand.

## Section A — Navigation cleanup

`components/layout/Sidebar.tsx` nav becomes:

| Keep | Remove | Add / change |
|---|---|---|
| Build, Chat, Files, GitHub, Reports | **Incubator Hub** | **Tools + Dev Tools → single "Connectors"** (icon `Plug`); **AI Agents → "Agents"** |

- Routes in `App.tsx`: delete `incubator`, `tools`, `dev-tools` routes; add `connectors` → `<WsConnectors />`; add `agents` → `<WsAgents />` (tabbed page) with a `<Navigate>` redirect from the old `ai-agents` path. Update the Sidebar nav item to `/workspaces/agents`. `Incubator.tsx`, `Tools.tsx`, `DevTools.tsx` page files deleted.
- `RightPanel.tsx` references to `/workspaces/build` etc. checked for stale path conditions.

## Section B — Connectors

**Route:** `/workspaces/connectors` → `pages/Connectors.tsx`

- **Grid of connector cards.** Each card: icon, name, category badge, status pill (connected / disconnected / error), capability chips (read/write/execute), a count of MCP tools exposed, and a connect/disconnect button. GitHub card shows an "Open" deep-link to `/workspaces/github`.
- **Detail drawer** (click a card) — `components/connectors/ConnectorDrawer.tsx`: full MCP tool list (name + description + destructive badge), declared resources, auth type, last sync, and a per-connector activity feed. Destructive tools visibly flagged (these route through the approval gate when an agent calls them).
- **Activity feed** — recent `ActivityEvent`s across connectors (e.g. "Figma file updated → Design Agent opened PR"), demonstrating the design-to-code pipeline as status, not an embedded editor.

New files: `pages/Connectors.tsx`, `components/connectors/ConnectorCard.tsx`, `components/connectors/ConnectorDrawer.tsx`, `components/connectors/ActivityFeed.tsx`.

## Section C — Agents (Catalog + Console)

**Route:** `/workspaces/agents` (with redirect from `/workspaces/ai-agents`) → `pages/Agents.tsx`, a tabbed shell using the existing `ui/tabs`.

### Tab 1 — Catalog
The existing `AIAgents.tsx` content (agent grid, category filter, enable/disable, Add Custom Agent dialog), refactored to read from `lib/api/agents.ts` instead of the inline `initialAgents` array. Minimal behavioral change.

### Tab 2 — Console (hybrid)
Layout: **task list rail (left) + chat transcript (main) + composer (bottom).**

- **Task list rail** — `components/console/TaskList.tsx`: cards for each `AgentTask` with status pill (queued/running/needs_approval/done/failed). Click selects `activeTaskId`. A `needs_approval` task is visually prominent. (This is the "option 2 job-queue" essence.)
- **Chat transcript** — `components/console/Transcript.tsx`: renders the active task's `TaskEvent[]` as a readable feed — agent messages, tool calls (`▸ calling github.create_pull_request`), tool results (collapsible structured output), and **inline approval cards** with Approve / Reject buttons for `approval_request` events. (This is the "option 1 chat + streaming + inline approval" essence.)
- **Composer** — `components/console/Composer.tsx`: pick an enabled agent + type a task → `createTask()` → new task appears in the rail and streams into the transcript.
- **Approval gate** — when the stream emits `approval_request`, the transcript shows an approval card and the task sits in `needs_approval` until the user resolves it; `resolveApproval()` resumes the stream. Mirrors the backend's `pending_approval` model.

New files: `pages/Agents.tsx`, `components/console/{TaskList,Transcript,Composer,ApprovalCard,ToolCallEvent}.tsx`, `lib/console/ConsoleContext.tsx`.

## Build order

1. **A — cleanup:** prune nav + routes, delete dead pages. Smallest, unblocks the rest. (`tsc` green, app boots.)
2. **Domain + API seam:** `types.ts`, `fixtures/`, `api/`. No UI yet.
3. **B — Connectors:** cards + drawer + activity feed over the seam.
4. **C — Agents:** tabbed shell, relocate Catalog onto the seam, then build Console (context → task list → transcript → composer → approval flow).

## Error handling

- API client surfaces typed errors; pages show inline empty/error states (reuse existing "No tools found" empty-state pattern).
- `streamTask` errors emit a terminal `error` `TaskEvent`; the task goes `failed` with the message visible in the transcript.
- `invoke`-style tool results are always structured `{ ok, detail }` — never thrown — matching the guide's "invoke() never throws."

## Verification

- `tsc --noEmit` clean.
- Manual smoke: nav no longer shows Incubator/Tools/Dev Tools; Connectors grid renders, drawer opens, connect/disconnect flips status; Agents Catalog still toggles; Console — submit a task, watch it stream, hit an approval gate, approve, see it complete; a seeded `failed` task renders its error.
- Tone/style audit: matches existing workspace visual conventions.

## Open dependencies (tracked, not blocking this round)

- Deep per-connector UIs await real connectors (SDK build plan Phase 2 Notion+Figma, Phase 3 ML+Web3). No date set by frontend; trigger is "connector's MCP server returns real data."
- Real OAuth, real agent runtime, real SSE endpoint replace the stubs in `lib/api/` with no component changes.
