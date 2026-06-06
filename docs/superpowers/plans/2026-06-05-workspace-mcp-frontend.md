# Workspace MCP / Plugin / SDK Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Workspace frontend so it reflects the MCP/plugin/SDK backend layer — remove redundant sections, add a Connectors registry, and add an Agents Console (chat + task list with approval gates) — all over a typed API seam backed by fixtures.

**Architecture:** A shared domain layer (`lib/types.ts`) + a stubbed API client (`lib/api/`) returning fixtures, each function mapped 1:1 to a pinned backend endpoint. Connectors and Agents are presentation over that seam. A small React context+reducer (`lib/console/`) drives live console updates. No Redux/Zustand, no live backend, no test framework.

**Tech Stack:** React + TypeScript, Vite, react-router v7, Tailwind, existing `components/ui/` (shadcn/Radix) kit, lucide-react icons. Path alias `@/` → `frontend/src/`.

---

## Testing note (read first)

This repo has **no test framework** (confirmed: `package.json` scripts are only `dev`/`build`/`lint`/`preview`; prior specs state the same baseline). We do **not** add one in this plan. Per-task verification is therefore:

1. **Type check:** `cd frontend && npx tsc -b` → Expected: completes with no errors.
2. **Manual smoke:** `cd frontend && npm run dev`, open the stated route, confirm the stated behavior.
3. **Commit.**

All paths below are relative to `frontend/`. All work happens on a branch off the docs branch or `main` — confirm with the user; this plan assumes a new branch `feat/workspace-mcp`.

---

## File structure (created/modified)

**Created:**
```
src/dashboard/workspaces/lib/types.ts
src/dashboard/workspaces/lib/fixtures/connectors.ts
src/dashboard/workspaces/lib/fixtures/activity.ts
src/dashboard/workspaces/lib/fixtures/agents.ts
src/dashboard/workspaces/lib/fixtures/tasks.ts
src/dashboard/workspaces/lib/api/client.ts
src/dashboard/workspaces/lib/api/connectors.ts
src/dashboard/workspaces/lib/api/agents.ts
src/dashboard/workspaces/lib/api/tasks.ts
src/dashboard/workspaces/lib/console/ConsoleContext.tsx
src/dashboard/workspaces/pages/Connectors.tsx
src/dashboard/workspaces/pages/Agents.tsx
src/dashboard/workspaces/components/connectors/ConnectorCard.tsx
src/dashboard/workspaces/components/connectors/ConnectorDrawer.tsx
src/dashboard/workspaces/components/connectors/ActivityFeed.tsx
src/dashboard/workspaces/components/console/TaskList.tsx
src/dashboard/workspaces/components/console/ToolCallEvent.tsx
src/dashboard/workspaces/components/console/ApprovalCard.tsx
src/dashboard/workspaces/components/console/Transcript.tsx
src/dashboard/workspaces/components/console/Composer.tsx
```

**Modified:**
```
src/App.tsx                                              (routes)
src/dashboard/workspaces/components/layout/Sidebar.tsx  (nav items)
```

**Deleted:**
```
src/dashboard/workspaces/pages/Incubator.tsx
src/dashboard/workspaces/pages/Tools.tsx
src/dashboard/workspaces/pages/DevTools.tsx
```

---

## Task 1: Navigation + route cleanup (Section A)

**Files:**
- Modify: `src/dashboard/workspaces/components/layout/Sidebar.tsx`
- Modify: `src/App.tsx`
- Delete: `src/dashboard/workspaces/pages/Incubator.tsx`, `pages/Tools.tsx`, `pages/DevTools.tsx`

- [ ] **Step 1: Update the Sidebar nav array**

In `src/dashboard/workspaces/components/layout/Sidebar.tsx`, replace the `navItems` array (currently lines ~29-39) with:

```tsx
  const navItems: NavItem[] = [
    { path: '/workspaces/build', label: 'Build', icon: <Hammer className="w-5 h-5" /> },
    { path: '/workspaces/connectors', label: 'Connectors', icon: <Plug className="w-5 h-5" /> },
    { path: '/workspaces/agents', label: 'Agents', icon: <Bot className="w-5 h-5" />, glow: true },
    { path: '/workspaces/chat', label: 'Chat', icon: <MessageCircle className="w-5 h-5" />, badge: 3 },
    { path: '/workspaces/files', label: 'Files', icon: <FolderOpen className="w-5 h-5" /> },
    { path: '/workspaces/github', label: 'GitHub', icon: <Github className="w-5 h-5" /> },
    { path: '/workspaces/reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" /> },
  ];
```

Then fix the icon imports at the top of the file: in the `lucide-react` import, remove `Rocket`, `Wrench`, `Code2` (no longer used) and add `Plug`. The import becomes:

```tsx
import {
  Hammer,
  Bot,
  MessageCircle,
  FolderOpen,
  BarChart3,
  ChevronLeft,
  Github,
  ArrowLeft,
  Plug,
} from 'lucide-react';
```

- [ ] **Step 2: Update routes in App.tsx**

In `src/App.tsx`, in the workspace import block (lines ~86-98), **remove** these three imports:

```tsx
import { Incubator as WsIncubator } from "@/dashboard/workspaces/pages/Incubator";
import { Tools as WsTools } from "@/dashboard/workspaces/pages/Tools";
import { DevTools as WsDevTools } from "@/dashboard/workspaces/pages/DevTools";
```

And **add** (these page files are created in later tasks; this task will leave temporary type errors until Task 7/8 — that is expected and noted in Step 4):

```tsx
import { Connectors as WsConnectors } from "@/dashboard/workspaces/pages/Connectors";
import { Agents as WsAgents } from "@/dashboard/workspaces/pages/Agents";
```

In the `/workspaces` route block (lines ~191-204), remove the `incubator`, `tools`, `dev-tools`, and `ai-agents` child routes and add:

```tsx
          <Route path="connectors" element={<WsConnectors />} />
          <Route path="agents" element={<WsAgents />} />
          <Route path="ai-agents" element={<Navigate to="/workspaces/agents" replace />} />
```

(`Navigate` is already imported in `App.tsx` from `react-router`.)

- [ ] **Step 3: Delete the dead page files**

```bash
cd frontend
git rm src/dashboard/workspaces/pages/Incubator.tsx \
       src/dashboard/workspaces/pages/Tools.tsx \
       src/dashboard/workspaces/pages/DevTools.tsx
```

- [ ] **Step 4: Type check**

Run: `cd frontend && npx tsc -b`
Expected: errors only of the form "Cannot find module '.../pages/Connectors'" and "'.../pages/Agents'" — these are created in Tasks 7 and 8. No other errors (no lingering references to the deleted pages). If any error mentions `Incubator`, `Tools`, or `DevTools`, fix the stale reference.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/App.tsx src/dashboard/workspaces/components/layout/Sidebar.tsx
git commit -m "refactor(workspace): remove Incubator + Tools/Dev Tools, add Connectors/Agents nav"
```

---

## Task 2: Shared domain types

**Files:**
- Create: `src/dashboard/workspaces/lib/types.ts`

- [ ] **Step 1: Write the domain model**

Create `src/dashboard/workspaces/lib/types.ts` with the full contents:

```ts
// Domain model for the Workspace MCP/plugin/SDK layer.
// Mirrors the backend Plugin Contract (see docs/techit-integration-guide.md).

// --- Connectors / MCP ---
export type ConnectorId = 'github' | 'figma' | 'notion' | 'ml' | 'web3';
export type Capability = 'read' | 'write' | 'execute';
export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, { type: string; required?: boolean }>;
  destructive?: boolean;
}

export interface Connector {
  id: ConnectorId;
  name: string;
  category: string;
  status: ConnectorStatus;
  authType: 'oauth2' | 'api_key' | 'service_account';
  capabilities: Capability[];
  tools: MCPTool[];
  resources: string[];
  deepLink?: string;
  lastSync?: string;
}

export interface ActivityEvent {
  id: string;
  connectorId: ConnectorId;
  kind: 'webhook' | 'agent_action' | 'sync' | 'approval';
  summary: string;
  at: string;
}

// --- Artifacts ---
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

export type TaskEventType =
  | 'message' | 'tool_call' | 'tool_result'
  | 'approval_request' | 'approval_resolved' | 'error' | 'status';

export interface ApprovalRequest {
  id: string;
  action: string;
  connectorId: ConnectorId;
  summary: string;
  resolved?: 'approved' | 'rejected';
}

export interface TaskEvent {
  id: string;
  type: TaskEventType;
  at: string;
  text?: string;
  tool?: { connectorId: ConnectorId; name: string; params: unknown };
  result?: { ok: boolean; detail: unknown };
  approval?: ApprovalRequest;
}

export interface AgentTask {
  id: string;
  agentId: string;
  prompt: string;
  status: AgentTaskStatus;
  createdAt: string;
  events: TaskEvent[];
}
```

- [ ] **Step 2: Type check**

Run: `cd frontend && npx tsc -b`
Expected: same as Task 1 (only the missing-page errors remain; `types.ts` itself adds no errors).

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/dashboard/workspaces/lib/types.ts
git commit -m "feat(workspace): add MCP/connector/agent domain types"
```

---

## Task 3: Fixtures

**Files:**
- Create: `src/dashboard/workspaces/lib/fixtures/connectors.ts`
- Create: `src/dashboard/workspaces/lib/fixtures/activity.ts`
- Create: `src/dashboard/workspaces/lib/fixtures/agents.ts`
- Create: `src/dashboard/workspaces/lib/fixtures/tasks.ts`

- [ ] **Step 1: Connectors fixture**

Create `src/dashboard/workspaces/lib/fixtures/connectors.ts`:

```ts
import type { Connector } from '../types';

export const connectorsFixture: Connector[] = [
  {
    id: 'github', name: 'GitHub', category: 'Code', status: 'connected',
    authType: 'oauth2', capabilities: ['read', 'write', 'execute'],
    resources: ['repository', 'pull_request', 'issue', 'workflow'],
    deepLink: '/workspaces/github', lastSync: '2026-06-05T09:12:00Z',
    tools: [
      { name: 'list_repositories', description: 'List all linked repositories.', inputSchema: {} },
      { name: 'read_file', description: 'Read a file from a repo.', inputSchema: { repo: { type: 'string', required: true }, path: { type: 'string', required: true } } },
      { name: 'create_pull_request', description: 'Open a PR from a branch.', inputSchema: { repo: { type: 'string', required: true }, branch: { type: 'string', required: true }, title: { type: 'string', required: true } }, destructive: true },
      { name: 'get_pr_status', description: 'Get CI/review status of a PR.', inputSchema: { repo: { type: 'string', required: true }, number: { type: 'number', required: true } } },
      { name: 'list_issues', description: 'List issues in a repo.', inputSchema: { repo: { type: 'string', required: true } } },
      { name: 'run_workflow', description: 'Trigger a GitHub Actions workflow.', inputSchema: { repo: { type: 'string', required: true }, workflow: { type: 'string', required: true } }, destructive: true },
    ],
  },
  {
    id: 'figma', name: 'Figma', category: 'Design', status: 'connected',
    authType: 'oauth2', capabilities: ['read'],
    resources: ['file', 'component', 'style'], lastSync: '2026-06-05T08:40:00Z',
    tools: [
      { name: 'read_design_file', description: 'Fetch a Figma file content.', inputSchema: { file_id: { type: 'string', required: true } } },
      { name: 'extract_design_tokens', description: 'Extract colors, spacing, typography.', inputSchema: { file_id: { type: 'string', required: true } } },
      { name: 'list_components', description: 'List components by frame and page.', inputSchema: { file_id: { type: 'string', required: true } } },
      { name: 'detect_design_changes', description: 'Diff a file against its last version.', inputSchema: { file_id: { type: 'string', required: true } } },
      { name: 'add_comment', description: 'Comment on a Figma file.', inputSchema: { file_id: { type: 'string', required: true }, text: { type: 'string', required: true } }, destructive: true },
    ],
  },
  {
    id: 'notion', name: 'Notion', category: 'Docs', status: 'disconnected',
    authType: 'oauth2', capabilities: ['read', 'write'],
    resources: ['page', 'database'],
    tools: [
      { name: 'read_page', description: 'Read a Notion page.', inputSchema: { block_id: { type: 'string', required: true } } },
      { name: 'search_docs', description: 'Search pages and databases.', inputSchema: { query: { type: 'string', required: true } } },
      { name: 'create_page', description: 'Create a new page.', inputSchema: { parent: { type: 'string', required: true }, title: { type: 'string', required: true } }, destructive: true },
      { name: 'update_page', description: 'Append/update page content.', inputSchema: { block_id: { type: 'string', required: true } }, destructive: true },
      { name: 'list_databases', description: 'List accessible databases.', inputSchema: {} },
    ],
  },
  {
    id: 'ml', name: 'ML Tools', category: 'ML', status: 'error',
    authType: 'api_key', capabilities: ['read', 'execute'],
    resources: ['model', 'run'],
    tools: [
      { name: 'list_models', description: 'List models in the registry.', inputSchema: {} },
      { name: 'get_model_metrics', description: 'Fetch metrics for a model.', inputSchema: { model_id: { type: 'string', required: true } } },
      { name: 'deploy_model', description: 'Deploy a model to an environment.', inputSchema: { model_id: { type: 'string', required: true }, environment: { type: 'string', required: true } }, destructive: true },
      { name: 'rollback_model', description: 'Roll back a deployment.', inputSchema: { model_id: { type: 'string', required: true } }, destructive: true },
    ],
  },
];
```

- [ ] **Step 2: Activity fixture**

Create `src/dashboard/workspaces/lib/fixtures/activity.ts`:

```ts
import type { ActivityEvent } from '../types';

export const activityFixture: ActivityEvent[] = [
  { id: 'a1', connectorId: 'figma', kind: 'webhook', summary: 'Figma file "Design System" updated → Design Agent opened PR #42', at: '2026-06-05T08:41:00Z' },
  { id: 'a2', connectorId: 'github', kind: 'agent_action', summary: 'Coding Agent opened PR #42: "Design sync: Button primary color"', at: '2026-06-05T08:42:00Z' },
  { id: 'a3', connectorId: 'github', kind: 'approval', summary: 'Approval requested: merge PR #42 to main', at: '2026-06-05T08:43:00Z' },
  { id: 'a4', connectorId: 'ml', kind: 'sync', summary: 'ML registry sync failed: invalid API key', at: '2026-06-05T07:10:00Z' },
];
```

- [ ] **Step 3: Agents fixture**

Create `src/dashboard/workspaces/lib/fixtures/agents.ts`. Move the existing `initialAgents` array out of `pages/AIAgents.tsx` into here (it will be consumed via the API in Task 8). Import the `AIAgent` type from the existing card component:

```ts
import type { AIAgent } from '../../components/ai/AIAgentCard';

export const agentsFixture: AIAgent[] = [
  { id: 'openclaw', name: 'OpenClaws', description: 'Advanced autonomous coding agent', fullDescription: 'OpenClaws is a state-of-the-art autonomous coding agent that can understand complex requirements, write production-ready code, and refactor existing codebases.', category: 'Builder', isPremium: true, icon: 'code', enabled: true },
  { id: '1', name: 'Claude Code', description: 'AI pair programmer from Anthropic', fullDescription: 'Claude Code is an advanced AI assistant designed for software development. It excels at code review, debugging, architecture discussions, and writing high-quality code.', category: 'Builder', isPremium: true, icon: 'code', enabled: true },
  { id: '2', name: 'Project Planner', description: 'AI-driven project planning and estimation', fullDescription: 'Advanced project planning agent that estimates timelines, identifies dependencies, and optimizes resource allocation.', category: 'Core', isPremium: true, icon: 'calendar', enabled: true },
  { id: '3', name: 'Documentation Writer', description: 'Auto-generates technical documentation', fullDescription: 'Automatically generates comprehensive technical documentation from your code.', category: 'Builder', isPremium: false, icon: 'file', enabled: false },
  { id: '4', name: 'Security Auditor', description: 'Scans for vulnerabilities and security issues', fullDescription: 'Premium security agent that performs deep security audits and suggests fixes.', category: 'Security', isPremium: true, icon: 'shield', enabled: true },
  { id: '5', name: 'Analytics Insights', description: 'Provides data-driven insights', fullDescription: 'Analyzes project metrics and user behavior to provide actionable insights.', category: 'Growth', isPremium: true, icon: 'chart', enabled: false },
  { id: '6', name: 'Bug Tracker', description: 'Automatically categorizes and prioritizes bugs', fullDescription: 'Intelligent bug tracking that categorizes issues, suggests priorities, and recommends fixes.', category: 'Core', isPremium: false, icon: 'bug', enabled: true },
];
```

(The trimmed list is fine — the Catalog is illustrative. If you want all 12 original entries, copy them verbatim from git history of `pages/AIAgents.tsx`.)

- [ ] **Step 4: Tasks fixture (with a scripted stream)**

Create `src/dashboard/workspaces/lib/fixtures/tasks.ts`:

```ts
import type { AgentTask, TaskEvent } from '../types';

// A seeded task that has already finished.
const doneEvents: TaskEvent[] = [
  { id: 'e1', type: 'status', at: '2026-06-04T10:00:00Z', text: 'Task started' },
  { id: 'e2', type: 'message', at: '2026-06-04T10:00:02Z', text: 'Reading the auth module to locate the token refresh logic.' },
  { id: 'e3', type: 'tool_call', at: '2026-06-04T10:00:03Z', tool: { connectorId: 'github', name: 'read_file', params: { repo: 'techit-core', path: 'src/auth.ts' } } },
  { id: 'e4', type: 'tool_result', at: '2026-06-04T10:00:04Z', result: { ok: true, detail: 'auth.ts (142 lines)' } },
  { id: 'e5', type: 'message', at: '2026-06-04T10:00:06Z', text: 'Found the bug: token expiry not checked before refresh. Patch ready.' },
  { id: 'e6', type: 'status', at: '2026-06-04T10:00:07Z', text: 'Completed' },
];

export const tasksFixture: AgentTask[] = [
  { id: 't1', agentId: '1', prompt: 'Find and fix the OAuth token refresh bug', status: 'done', createdAt: '2026-06-04T10:00:00Z', events: doneEvents },
  { id: 't2', agentId: '4', prompt: 'Scan the repo for hardcoded secrets', status: 'failed', createdAt: '2026-06-04T11:00:00Z', events: [
    { id: 'f1', type: 'status', at: '2026-06-04T11:00:00Z', text: 'Task started' },
    { id: 'f2', type: 'error', at: '2026-06-04T11:00:01Z', text: 'Security connector unavailable (mock error state)' },
  ] },
];

// Scripted stream replayed by createTask(). Pauses on the approval_request
// until resolveApproval() is called (handled in api/tasks.ts).
export function scriptedStream(agentId: string, prompt: string): TaskEvent[] {
  return [
    { id: 's1', type: 'status', at: '', text: 'Task started' },
    { id: 's2', type: 'message', at: '', text: `Understood. Working on: "${prompt}".` },
    { id: 's3', type: 'tool_call', at: '', tool: { connectorId: 'figma', name: 'extract_design_tokens', params: { file_id: 'abc123' } } },
    { id: 's4', type: 'tool_result', at: '', result: { ok: true, detail: 'Button primary: #1A3C5E → #0E7DC2' } },
    { id: 's5', type: 'message', at: '', text: 'Token change detected. I will open a PR to apply it.' },
    { id: 's6', type: 'approval_request', at: '', approval: { id: 'ap1', action: 'create_pull_request', connectorId: 'github', summary: 'Open PR "Design sync: Update Button primary color" against main' } },
    { id: 's7', type: 'tool_call', at: '', tool: { connectorId: 'github', name: 'create_pull_request', params: { repo: 'techit-core', branch: 'agent/design-sync', title: 'Design sync: Update Button primary color' } } },
    { id: 's8', type: 'tool_result', at: '', result: { ok: true, detail: 'PR #43 opened' } },
    { id: 's9', type: 'status', at: '', text: 'Completed' },
  ];
}
```

- [ ] **Step 5: Type check + commit**

Run: `cd frontend && npx tsc -b` → Expected: only the missing-page errors from Task 1 remain.

```bash
cd frontend
git add src/dashboard/workspaces/lib/fixtures
git commit -m "feat(workspace): add connector/activity/agent/task fixtures + scripted stream"
```

---

## Task 4: API seam (client + connectors + agents + tasks)

**Files:**
- Create: `src/dashboard/workspaces/lib/api/client.ts`
- Create: `src/dashboard/workspaces/lib/api/connectors.ts`
- Create: `src/dashboard/workspaces/lib/api/agents.ts`
- Create: `src/dashboard/workspaces/lib/api/tasks.ts`

- [ ] **Step 1: Base client**

Create `src/dashboard/workspaces/lib/api/client.ts`:

```ts
// Mock-mode API client. Flip USE_MOCKS to false once a real backend exists;
// each api/*.ts function then swaps its body for a fetch() to the listed endpoint.
export const USE_MOCKS = true;

export const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));

// Deterministic id helper (avoids Date.now()/Math.random in shared code paths).
let counter = 0;
export const nextId = (prefix: string) => `${prefix}_${++counter}`;
```

- [ ] **Step 2: Connectors API**

Create `src/dashboard/workspaces/lib/api/connectors.ts`:

```ts
import type { Connector, ConnectorId, ActivityEvent } from '../types';
import { connectorsFixture } from '../fixtures/connectors';
import { activityFixture } from '../fixtures/activity';
import { delay } from './client';

let connectors: Connector[] = connectorsFixture.map((c) => ({ ...c }));

// GET /api/connectors
export async function listConnectors(): Promise<Connector[]> {
  await delay();
  return connectors.map((c) => ({ ...c }));
}

// GET /api/connectors/:id
export async function getConnector(id: ConnectorId): Promise<Connector | undefined> {
  await delay();
  const c = connectors.find((x) => x.id === id);
  return c ? { ...c } : undefined;
}

// POST /api/connectors/:id/connect  → real backend returns { redirectUrl } (OAuth)
export async function connect(id: ConnectorId): Promise<Connector | undefined> {
  await delay();
  connectors = connectors.map((c) => (c.id === id ? { ...c, status: 'connected' } : c));
  return connectors.find((c) => c.id === id);
}

// POST /api/connectors/:id/disconnect
export async function disconnect(id: ConnectorId): Promise<Connector | undefined> {
  await delay();
  connectors = connectors.map((c) => (c.id === id ? { ...c, status: 'disconnected' } : c));
  return connectors.find((c) => c.id === id);
}

// GET /api/activity?connector=:id
export async function listActivity(id?: ConnectorId): Promise<ActivityEvent[]> {
  await delay();
  return id ? activityFixture.filter((a) => a.connectorId === id) : activityFixture;
}
```

- [ ] **Step 3: Agents API**

Create `src/dashboard/workspaces/lib/api/agents.ts`:

```ts
import type { AIAgent } from '../../components/ai/AIAgentCard';
import { agentsFixture } from '../fixtures/agents';
import { delay, nextId } from './client';

let agents: AIAgent[] = agentsFixture.map((a) => ({ ...a }));

// GET /api/agents
export async function listAgents(): Promise<AIAgent[]> {
  await delay();
  return agents.map((a) => ({ ...a }));
}

// POST /api/agents/:id/toggle
export async function toggleAgent(id: string): Promise<AIAgent[]> {
  await delay();
  agents = agents.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
  return agents.map((a) => ({ ...a }));
}

// POST /api/agents
export async function addCustomAgent(input: { name: string; endpoint: string }): Promise<AIAgent[]> {
  await delay();
  agents = [
    ...agents,
    { id: nextId('agent'), name: input.name, description: 'Custom API-integrated agent', fullDescription: `Custom agent via ${input.endpoint}`, category: 'Builder', isPremium: false, icon: 'code', enabled: true },
  ];
  return agents.map((a) => ({ ...a }));
}
```

- [ ] **Step 4: Tasks API (streaming generator + approval gate)**

Create `src/dashboard/workspaces/lib/api/tasks.ts`:

```ts
import type { AgentTask, TaskEvent } from '../types';
import { tasksFixture, scriptedStream } from '../fixtures/tasks';
import { delay, nextId } from './client';

let tasks: AgentTask[] = tasksFixture.map((t) => ({ ...t, events: [...t.events] }));

// GET /api/agent/tasks
export async function listTasks(): Promise<AgentTask[]> {
  await delay();
  return tasks.map((t) => ({ ...t }));
}

// GET /api/agent/tasks/:id
export async function getTask(id: string): Promise<AgentTask | undefined> {
  const t = tasks.find((x) => x.id === id);
  return t ? { ...t } : undefined;
}

// POST /api/agent/tasks  — creates the task record, returns its id.
export async function createTask(agentId: string, prompt: string): Promise<string> {
  await delay();
  const id = nextId('task');
  tasks = [{ id, agentId, prompt, status: 'queued', createdAt: '', events: [] }, ...tasks];
  return id;
}

// Pending approval resolver bridge: streamTask waits on this promise.
const approvalWaiters: Record<string, (decision: 'approved' | 'rejected') => void> = {};

// POST /api/agent/tasks/:id/approvals/:aid
export async function resolveApproval(taskId: string, approvalId: string, decision: 'approved' | 'rejected'): Promise<void> {
  const key = `${taskId}:${approvalId}`;
  approvalWaiters[key]?.(decision);
  delete approvalWaiters[key];
}

// GET /api/agent/tasks/:id/stream (SSE in real backend).
// Mock: async generator replaying the scripted stream with delays, pausing on approval.
export async function* streamTask(taskId: string): AsyncGenerator<TaskEvent> {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  const script = scriptedStream(task.agentId, task.prompt);
  let stamp = 0;
  for (const ev of script) {
    await delay(450);
    const event: TaskEvent = { ...ev, at: `mock+${++stamp}` };
    if (event.type === 'approval_request' && event.approval) {
      const decision = await new Promise<'approved' | 'rejected'>((resolve) => {
        approvalWaiters[`${taskId}:${event.approval!.id}`] = resolve;
      });
      yield { ...event, approval: { ...event.approval, resolved: decision } };
      if (decision === 'rejected') {
        yield { id: nextId('e'), type: 'status', at: `mock+${++stamp}`, text: 'Cancelled by user' };
        return;
      }
      continue;
    }
    yield event;
  }
}
```

- [ ] **Step 5: Type check + commit**

Run: `cd frontend && npx tsc -b` → Expected: only the missing-page errors from Task 1 remain.

```bash
cd frontend
git add src/dashboard/workspaces/lib/api
git commit -m "feat(workspace): add stubbed API seam (connectors/agents/tasks) over fixtures"
```

---

## Task 5: ConnectorCard component

**Files:**
- Create: `src/dashboard/workspaces/components/connectors/ConnectorCard.tsx`

- [ ] **Step 1: Write the card**

Create `src/dashboard/workspaces/components/connectors/ConnectorCard.tsx`:

```tsx
import { Plug, Github, Figma, FileText, Brain, Boxes, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { Connector, ConnectorId, ConnectorStatus } from '../../lib/types';

const ICONS: Record<ConnectorId, React.ReactNode> = {
  github: <Github className="w-6 h-6" />, figma: <Figma className="w-6 h-6" />,
  notion: <FileText className="w-6 h-6" />, ml: <Brain className="w-6 h-6" />,
  web3: <Boxes className="w-6 h-6" />,
};

const STATUS_STYLES: Record<ConnectorStatus, string> = {
  connected: 'bg-green-100 text-green-700', disconnected: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-700', pending: 'bg-yellow-100 text-yellow-700',
};

interface Props {
  connector: Connector;
  onOpen: (c: Connector) => void;
  onToggle: (c: Connector) => void;
}

export function ConnectorCard({ connector, onOpen, onToggle }: Props) {
  const connected = connector.status === 'connected';
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-[#2196F3]/10 text-[#2196F3]">{ICONS[connector.id] ?? <Plug className="w-6 h-6" />}</div>
        <Badge className={STATUS_STYLES[connector.status]}>{connector.status}</Badge>
      </div>
      <h3 className="font-semibold text-lg">{connector.name}</h3>
      <p className="text-sm text-gray-500 mb-3">{connector.category} • {connector.authType}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {connector.capabilities.map((c) => (<Badge key={c} variant="secondary" className="text-xs">{c}</Badge>))}
      </div>
      <p className="text-xs text-gray-500 mb-4">{connector.tools.length} MCP tools exposed</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onOpen(connector)}>Details</Button>
        {connector.deepLink ? (
          <Button asChild variant="ghost"><Link to={connector.deepLink}><ExternalLink className="w-4 h-4 mr-1" />Open</Link></Button>
        ) : (
          <Button className={connected ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-[#2196F3] hover:bg-[#1976D2]'} onClick={() => onToggle(connector)}>
            {connected ? 'Disconnect' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  );
}
```

> Note: if `Figma` or `Brain` is not exported by the installed `lucide-react`, substitute any present icon (e.g. `PenTool` for Figma, `Cpu` for ML). Verify in Step 2.

- [ ] **Step 2: Type check**

Run: `cd frontend && npx tsc -b`
Expected: only missing-page errors remain. If an icon import errors, swap it per the note above and re-run.

- [ ] **Step 3: Commit**

```bash
cd frontend
git add src/dashboard/workspaces/components/connectors/ConnectorCard.tsx
git commit -m "feat(workspace): add ConnectorCard"
```

---

## Task 6: ConnectorDrawer + ActivityFeed

**Files:**
- Create: `src/dashboard/workspaces/components/connectors/ActivityFeed.tsx`
- Create: `src/dashboard/workspaces/components/connectors/ConnectorDrawer.tsx`

- [ ] **Step 1: ActivityFeed**

Create `src/dashboard/workspaces/components/connectors/ActivityFeed.tsx`:

```tsx
import { Webhook, Bot, RefreshCw, ShieldCheck } from 'lucide-react';
import type { ActivityEvent } from '../../lib/types';

const KIND_ICON = {
  webhook: <Webhook className="w-4 h-4 text-blue-500" />,
  agent_action: <Bot className="w-4 h-4 text-purple-500" />,
  sync: <RefreshCw className="w-4 h-4 text-gray-500" />,
  approval: <ShieldCheck className="w-4 h-4 text-amber-500" />,
} as const;

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-gray-400">No recent activity.</p>;
  return (
    <ul className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-3">
          <div className="mt-0.5">{KIND_ICON[e.kind]}</div>
          <div>
            <p className="text-sm text-gray-700">{e.summary}</p>
            <p className="text-xs text-gray-400">{e.at}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: ConnectorDrawer**

Create `src/dashboard/workspaces/components/connectors/ConnectorDrawer.tsx` (uses the existing `ui/sheet`):

```tsx
import { AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Badge } from '../ui/badge';
import { ActivityFeed } from './ActivityFeed';
import type { Connector, ActivityEvent } from '../../lib/types';

interface Props {
  connector: Connector | null;
  activity: ActivityEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectorDrawer({ connector, activity, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        {connector && (
          <>
            <SheetHeader>
              <SheetTitle>{connector.name}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-6">
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">MCP Tools</h4>
                <ul className="space-y-2">
                  {connector.tools.map((t) => (
                    <li key={t.name} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <code className="text-sm font-medium">{t.name}</code>
                        {t.destructive && (
                          <Badge className="bg-red-100 text-red-700 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />approval</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">Resources</h4>
                <div className="flex flex-wrap gap-1.5">
                  {connector.resources.map((r) => (<Badge key={r} variant="secondary" className="text-xs">{r}</Badge>))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">Recent Activity</h4>
                <ActivityFeed events={activity} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Type check**

Run: `cd frontend && npx tsc -b`
Expected: only missing-page errors remain. If `ui/sheet` exports differ (e.g. no `SheetTitle`), open `components/ui/sheet.tsx` and use the actual exported names.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/dashboard/workspaces/components/connectors/ActivityFeed.tsx src/dashboard/workspaces/components/connectors/ConnectorDrawer.tsx
git commit -m "feat(workspace): add ConnectorDrawer + ActivityFeed"
```

---

## Task 7: Connectors page (wires Section B together)

**Files:**
- Create: `src/dashboard/workspaces/pages/Connectors.tsx`

- [ ] **Step 1: Write the page**

Create `src/dashboard/workspaces/pages/Connectors.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Plug } from 'lucide-react';
import { ConnectorCard } from '../components/connectors/ConnectorCard';
import { ConnectorDrawer } from '../components/connectors/ConnectorDrawer';
import { listConnectors, listActivity, connect, disconnect } from '../lib/api/connectors';
import type { Connector, ActivityEvent } from '../lib/types';

export function Connectors() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [selected, setSelected] = useState<Connector | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    listConnectors().then(setConnectors);
    listActivity().then(setActivity);
  }, []);

  const handleOpen = (c: Connector) => { setSelected(c); setDrawerOpen(true); };

  const handleToggle = async (c: Connector) => {
    const updated = c.status === 'connected' ? await disconnect(c.id) : await connect(c.id);
    if (updated) setConnectors((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  };

  const drawerActivity = selected ? activity.filter((a) => a.connectorId === selected.id) : [];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#2196F3]/10 rounded-lg"><Plug className="w-6 h-6 text-[#2196F3]" /></div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Connectors</h1>
            <p className="text-sm text-gray-500">{connectors.length} integrations • capabilities exposed to agents over MCP</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connectors.map((c) => (
            <ConnectorCard key={c.id} connector={c} onOpen={handleOpen} onToggle={handleToggle} />
          ))}
        </div>
      </div>
      <ConnectorDrawer connector={selected} activity={drawerActivity} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `cd frontend && npx tsc -b`
Expected: the `Connectors` missing-page error from Task 1 is now resolved. Only the `Agents` missing-page error remains.

- [ ] **Step 3: Manual smoke**

Run: `cd frontend && npm run dev`. Open `/workspaces/connectors`. Expected: grid of connector cards with status pills; clicking **Details** opens the drawer showing MCP tools (destructive ones flagged) + activity; clicking **Connect/Disconnect** on Notion flips its status pill; the GitHub card shows **Open** linking to `/workspaces/github`.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/dashboard/workspaces/pages/Connectors.tsx
git commit -m "feat(workspace): add Connectors page (Section B)"
```

---

## Task 8: Agents page — tabbed shell + Catalog over the seam

**Files:**
- Create: `src/dashboard/workspaces/pages/Agents.tsx`

- [ ] **Step 1: Write the tabbed Agents page**

Create `src/dashboard/workspaces/pages/Agents.tsx`. The **Catalog** tab reuses the existing `AIAgentCard` and now reads from the API; the **Console** tab is filled in Task 11 (placeholder import wired here so the shell compiles — the placeholder is replaced, not added to, in Task 11):

```tsx
import { useEffect, useState } from 'react';
import { Bot, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AIAgentCard } from '../components/ai/AIAgentCard';
import type { AIAgent } from '../components/ai/AIAgentCard';
import { listAgents, toggleAgent } from '../lib/api/agents';

export function Agents() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => { listAgents().then(setAgents); }, []);

  const handleToggle = async (id: string) => setAgents(await toggleAgent(id));

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[#2196F3]/10 rounded-lg"><Bot className="w-6 h-6 text-[#2196F3]" /></div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Agents</h1>
        </div>
        <Tabs defaultValue="catalog">
          <TabsList>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="console">Console</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog">
            <div className="relative mt-4 mb-6 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#2196F3]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
              {filtered.map((a) => (<AIAgentCard key={a.id} agent={a} onToggle={handleToggle} />))}
            </div>
          </TabsContent>

          <TabsContent value="console">
            <div className="mt-4 text-sm text-gray-400">Console coming in the next task.</div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `cd frontend && npx tsc -b`
Expected: **no errors** (both missing-page errors from Task 1 are now resolved).

- [ ] **Step 3: Manual smoke**

Run `npm run dev`. Open `/workspaces/agents`. Expected: Catalog tab shows the agent grid with working enable/disable toggles + search; Console tab shows the placeholder. Visiting `/workspaces/ai-agents` redirects to `/workspaces/agents`.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/dashboard/workspaces/pages/Agents.tsx
git commit -m "feat(workspace): add Agents page with Catalog tab over API seam"
```

---

## Task 9: Console state context

**Files:**
- Create: `src/dashboard/workspaces/lib/console/ConsoleContext.tsx`

- [ ] **Step 1: Write the context + reducer**

Create `src/dashboard/workspaces/lib/console/ConsoleContext.tsx`:

```tsx
import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AgentTask, TaskEvent, AgentTaskStatus } from '../types';

interface State { tasks: AgentTask[]; activeTaskId: string | null; }

type Action =
  | { type: 'set_tasks'; tasks: AgentTask[] }
  | { type: 'add_task'; task: AgentTask }
  | { type: 'select'; id: string }
  | { type: 'append_event'; taskId: string; event: TaskEvent }
  | { type: 'set_status'; taskId: string; status: AgentTaskStatus };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set_tasks': return { ...state, tasks: action.tasks };
    case 'add_task': return { ...state, tasks: [action.task, ...state.tasks], activeTaskId: action.task.id };
    case 'select': return { ...state, activeTaskId: action.id };
    case 'append_event':
      return { ...state, tasks: state.tasks.map((t) => t.id === action.taskId ? { ...t, events: [...t.events, action.event] } : t) };
    case 'set_status':
      return { ...state, tasks: state.tasks.map((t) => t.id === action.taskId ? { ...t, status: action.status } : t) };
    default: return state;
  }
}

const ConsoleContext = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { tasks: [], activeTaskId: null });
  return <ConsoleContext.Provider value={{ state, dispatch }}>{children}</ConsoleContext.Provider>;
}

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error('useConsole must be used within ConsoleProvider');
  return ctx;
}
```

- [ ] **Step 2: Type check + commit**

Run: `cd frontend && npx tsc -b` → Expected: no errors.

```bash
cd frontend
git add src/dashboard/workspaces/lib/console/ConsoleContext.tsx
git commit -m "feat(workspace): add console state context (tasks + streaming events)"
```

---

## Task 10: Console presentational components (TaskList, ToolCallEvent, ApprovalCard, Transcript)

**Files:**
- Create: `src/dashboard/workspaces/components/console/ToolCallEvent.tsx`
- Create: `src/dashboard/workspaces/components/console/ApprovalCard.tsx`
- Create: `src/dashboard/workspaces/components/console/TaskList.tsx`
- Create: `src/dashboard/workspaces/components/console/Transcript.tsx`

- [ ] **Step 1: ToolCallEvent**

Create `src/dashboard/workspaces/components/console/ToolCallEvent.tsx`:

```tsx
import { Terminal, CheckCircle2, XCircle } from 'lucide-react';
import type { TaskEvent } from '../../lib/types';

export function ToolCallEvent({ event }: { event: TaskEvent }) {
  if (event.type === 'tool_call' && event.tool) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2 font-mono">
        <Terminal className="w-4 h-4 text-[#2196F3]" />
        <span>{event.tool.connectorId}.{event.tool.name}()</span>
      </div>
    );
  }
  if (event.type === 'tool_result' && event.result) {
    const ok = event.result.ok;
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 pl-6">
        {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
        <span>{String(event.result.detail)}</span>
      </div>
    );
  }
  return null;
}
```

- [ ] **Step 2: ApprovalCard**

Create `src/dashboard/workspaces/components/console/ApprovalCard.tsx`:

```tsx
import { ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import type { ApprovalRequest } from '../../lib/types';

interface Props {
  approval: ApprovalRequest;
  onResolve: (decision: 'approved' | 'rejected') => void;
}

export function ApprovalCard({ approval, onResolve }: Props) {
  const resolved = approval.resolved;
  return (
    <div className="border border-amber-300 bg-amber-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-semibold text-amber-800">Approval required</span>
      </div>
      <p className="text-sm text-gray-700 mb-3">{approval.summary}</p>
      <p className="text-xs text-gray-500 mb-3 font-mono">{approval.connectorId}.{approval.action}</p>
      {resolved ? (
        <span className={`text-sm font-medium ${resolved === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
          {resolved === 'approved' ? 'Approved' : 'Rejected'}
        </span>
      ) : (
        <div className="flex gap-2">
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => onResolve('approved')}>Approve</Button>
          <Button variant="outline" onClick={() => onResolve('rejected')}>Reject</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: TaskList**

Create `src/dashboard/workspaces/components/console/TaskList.tsx`:

```tsx
import { Badge } from '../ui/badge';
import { useConsole } from '../../lib/console/ConsoleContext';
import type { AgentTaskStatus } from '../../lib/types';

const STATUS_STYLE: Record<AgentTaskStatus, string> = {
  queued: 'bg-gray-100 text-gray-600', running: 'bg-blue-100 text-blue-700',
  needs_approval: 'bg-amber-100 text-amber-800', done: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-500',
};

export function TaskList() {
  const { state, dispatch } = useConsole();
  return (
    <div className="w-[260px] border-r border-gray-200 overflow-y-auto">
      <div className="p-3 text-xs font-semibold uppercase text-gray-400">Tasks</div>
      {state.tasks.length === 0 && <p className="px-3 text-sm text-gray-400">No tasks yet.</p>}
      <ul>
        {state.tasks.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => dispatch({ type: 'select', id: t.id })}
              className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 ${state.activeTaskId === t.id ? 'bg-gray-50' : ''}`}>
              <p className="text-sm font-medium text-gray-800 line-clamp-2">{t.prompt}</p>
              <Badge className={`mt-1.5 text-xs ${STATUS_STYLE[t.status]}`}>{t.status.replace('_', ' ')}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Transcript**

Create `src/dashboard/workspaces/components/console/Transcript.tsx`:

```tsx
import { Bot } from 'lucide-react';
import { useConsole } from '../../lib/console/ConsoleContext';
import { ToolCallEvent } from './ToolCallEvent';
import { ApprovalCard } from './ApprovalCard';

interface Props {
  onResolveApproval: (taskId: string, approvalId: string, decision: 'approved' | 'rejected') => void;
}

export function Transcript({ onResolveApproval }: Props) {
  const { state } = useConsole();
  const task = state.tasks.find((t) => t.id === state.activeTaskId);

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
        <Bot className="w-10 h-10 mb-2" />
        <p>Select a task or start a new one below.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {task.events.map((e) => {
        if (e.type === 'message' || e.type === 'status') {
          return <p key={e.id} className={`text-sm ${e.type === 'status' ? 'text-gray-400 italic' : 'text-gray-800'}`}>{e.text}</p>;
        }
        if (e.type === 'error') {
          return <p key={e.id} className="text-sm text-red-600">{e.text}</p>;
        }
        if (e.type === 'tool_call' || e.type === 'tool_result') {
          return <ToolCallEvent key={e.id} event={e} />;
        }
        if (e.type === 'approval_request' && e.approval) {
          const ap = e.approval;
          return <ApprovalCard key={e.id} approval={ap} onResolve={(d) => onResolveApproval(task.id, ap.id, d)} />;
        }
        return null;
      })}
    </div>
  );
}
```

- [ ] **Step 5: Type check + commit**

Run: `cd frontend && npx tsc -b` → Expected: no errors.

```bash
cd frontend
git add src/dashboard/workspaces/components/console
git commit -m "feat(workspace): add console UI components (task list, transcript, tool call, approval)"
```

---

## Task 11: Composer + wire the Console tab (streaming + approval flow)

**Files:**
- Create: `src/dashboard/workspaces/components/console/Composer.tsx`
- Modify: `src/dashboard/workspaces/pages/Agents.tsx`

- [ ] **Step 1: Composer**

Create `src/dashboard/workspaces/components/console/Composer.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../ui/button';
import { listAgents } from '../../lib/api/agents';
import { createTask, streamTask, getTask } from '../../lib/api/tasks';
import { useConsole } from '../../lib/console/ConsoleContext';
import type { AIAgent } from '../ai/AIAgentCard';

export function Composer() {
  const { dispatch } = useConsole();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAgents().then((all) => {
      const enabled = all.filter((a) => a.enabled);
      setAgents(enabled);
      if (enabled[0]) setAgentId(enabled[0].id);
    });
  }, []);

  const submit = async () => {
    if (!prompt.trim() || !agentId || busy) return;
    setBusy(true);
    const id = await createTask(agentId, prompt.trim());
    const created = await getTask(id);
    if (created) dispatch({ type: 'add_task', task: created });
    setPrompt('');
    dispatch({ type: 'set_status', taskId: id, status: 'running' });
    for await (const event of streamTask(id)) {
      dispatch({ type: 'append_event', taskId: id, event });
      if (event.type === 'approval_request') dispatch({ type: 'set_status', taskId: id, status: 'needs_approval' });
      if (event.type === 'approval_resolved' || event.type === 'tool_call') dispatch({ type: 'set_status', taskId: id, status: 'running' });
      if (event.type === 'status' && event.text === 'Completed') dispatch({ type: 'set_status', taskId: id, status: 'done' });
      if (event.type === 'status' && event.text === 'Cancelled by user') dispatch({ type: 'set_status', taskId: id, status: 'cancelled' });
      if (event.type === 'error') dispatch({ type: 'set_status', taskId: id, status: 'failed' });
    }
    setBusy(false);
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
          {agents.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        {busy && <span className="text-xs text-gray-400">Agent working…</span>}
      </div>
      <div className="flex gap-2">
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ask an agent to carry out a task..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#2196F3]" />
        <Button className="bg-[#2196F3] hover:bg-[#1976D2]" onClick={submit} disabled={busy}><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
```

> Note on the approval bridge: `resolveApproval()` in `api/tasks.ts` releases the generator's pending promise, so the same `for await` loop above continues emitting events after the user approves. No extra wiring needed — the Transcript's Approve/Reject button calls `resolveApproval` (Step 2).

- [ ] **Step 2: Replace the Console tab content in Agents.tsx**

In `src/dashboard/workspaces/pages/Agents.tsx`, add these imports at the top:

```tsx
import { ConsoleProvider } from '../lib/console/ConsoleContext';
import { TaskList } from '../components/console/TaskList';
import { Transcript } from '../components/console/Transcript';
import { Composer } from '../components/console/Composer';
import { resolveApproval } from '../lib/api/tasks';
```

Replace the entire `<TabsContent value="console">…</TabsContent>` block (the placeholder from Task 8) with:

```tsx
          <TabsContent value="console">
            <ConsoleProvider>
              <div className="mt-4 flex border border-gray-200 rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 240px)' }}>
                <TaskList />
                <div className="flex-1 flex flex-col">
                  <Transcript onResolveApproval={resolveApproval} />
                  <Composer />
                </div>
              </div>
            </ConsoleProvider>
          </TabsContent>
```

- [ ] **Step 3: Type check**

Run: `cd frontend && npx tsc -b` → Expected: no errors.

- [ ] **Step 4: Manual smoke (the full console flow)**

Run `npm run dev`. Open `/workspaces/agents` → **Console** tab. Expected:
1. Pick an agent, type a task, hit Send/Enter.
2. A task appears in the left rail (status `running`) and events stream into the transcript: status → message → a tool call + result → message.
3. An **Approval required** card appears; the task status flips to `needs approval`.
4. Click **Approve** → streaming resumes (`create_pull_request` call + result), task flips to `done`.
5. Repeat and click **Reject** → a "Cancelled by user" status appears and the task flips to `cancelled`.
6. The two seeded tasks (`done`, `failed`) are visible in the rail with correct status pills, and the `failed` one shows its error in red.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/dashboard/workspaces/components/console/Composer.tsx src/dashboard/workspaces/pages/Agents.tsx
git commit -m "feat(workspace): wire Agents Console (streaming chat + task list + approval gate)"
```

---

## Final verification

- [ ] **Full type check:** `cd frontend && npx tsc -b` → no errors.
- [ ] **Lint (optional, repo has it):** `cd frontend && npm run lint` → review any new warnings in changed files.
- [ ] **Build:** `cd frontend && npm run build` → completes.
- [ ] **Smoke the whole module:** nav shows Build / Connectors / Agents / Chat / Files / GitHub / Reports (no Incubator, Tools, Dev Tools). `/workspaces/connectors` works (cards, drawer, connect/disconnect, GitHub deep-link). `/workspaces/agents` Catalog toggles; Console runs a task end-to-end through an approval gate. `/workspaces/ai-agents` redirects to `/workspaces/agents`.

## Self-review checklist (completed by plan author)

- **Spec coverage:** A (Task 1) ✓; domain layer (Task 2) ✓; fixtures + pinned contract (Tasks 3-4) ✓; Connectors registry + drawer + activity + GitHub deep-link (Tasks 5-7) ✓; Agents Catalog+Console, chat + task list + approval gates (Tasks 8-11) ✓; "integrate capabilities not UIs" (no embedded editors — connectors show tools/activity only) ✓; no deep per-connector UIs (out of scope, honored) ✓; lightweight state, no Redux/Zustand (Task 9) ✓; no test framework (verification adapted to tsc + smoke) ✓.
- **Type consistency:** `Connector`, `MCPTool`, `AgentTask`, `TaskEvent`, `ApprovalRequest` used identically across api/fixtures/components; `streamTask`/`createTask`/`resolveApproval` signatures match between `api/tasks.ts` (Task 4) and `Composer`/`Transcript` (Tasks 10-11); `useConsole`/`ConsoleProvider` names match between Task 9 and Task 11.
- **Placeholder scan:** the only intentional placeholder is the Console tab text in Task 8, explicitly replaced in Task 11 Step 2.
- **Known follow-ups flagged inline:** lucide icon availability (Task 5) and `ui/sheet` export names (Task 6) verified at their type-check steps.
