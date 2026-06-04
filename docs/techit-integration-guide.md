# TechIT Network — Workspace Integration Guide

**Step-by-Step Implementation Manual for Engineering Teams**

HaviTec LTD  |  Confidential  |  v1.0  |  2026

> Source document captured 2026-06-05 from Agbo Anthony (@faith_rex), shared 6/2/2026.
> This is the primary backend/integration reference for the Workspace MCP/plugin/SDK frontend rework.

---

## This Document Covers

- **GitHub Integration** — Code, PRs, and CI workflows
- **Figma Integration** — Design-to-code pipeline
- **Notion Integration** — Synced documentation and specs
- **Machine Learning Tools** — Model registry and deployment
- **MCP Servers** — AI-native tool access layer
- **AI Automation** — Visual workflow engine (n8n/Temporal)
- **Web3 & Blockchain** — Wallets, contracts, and DAO dashboards
- **Computer Vision** — Live inference and edge devices
- **Robotics Tools** — Telemetry, control panels, and simulation
- **Agent & Permission System** — Roles, access, and approval gates
- **Enterprise Security & Compliance Model**

---

## Introduction

This guide is the primary implementation reference for the TechIT engineering team. It details, step by step, how to integrate every external tool and system into the TechIT Workspace — covering authentication, data access, agent connectivity, permission configuration, and security practices.

TechIT is built as a **Coordination Layer**, not an app that embeds other apps. Every tool you connect becomes a **Connector** — a capability that humans can trigger and AI agents can act on. This document tells your team exactly how to make that happen.

### Core Principle — Integrate Capabilities, Not UIs

TechIT does NOT embed external editors or dashboards inside its UI. Instead, it reads, writes, and acts through APIs, SDKs, OAuth connections, and MCP servers. The result is a unified workspace where design, code, docs, models, and automation all communicate through a single coordination layer.

---

## System Architecture Overview

All integrations follow the same four-layer model. Understanding this model is mandatory before any engineer begins building a connector.

| Component | Details |
|---|---|
| **Layer 1** | **TechIT Workspace** — The UI, permissions, and project space your users interact with. |
| **Layer 2** | **Orchestration & Agent Layer** — Handles human actions, AI agents, and workflow routing. |
| **Layer 3** | **Connector & MCP Layer** — OAuth flows, REST/GraphQL APIs, SDKs, webhooks, and MCP servers. |
| **Layer 4** | **External Tools** — GitHub, Figma, Notion, ML platforms, Web3 chains, robotics systems, and more. |

---

## Repository & Project Structure

All integration code lives in a structured monorepo. Engineers must understand where each module belongs before writing any code.

```
techit/
├── apps/
│   ├── web/                 # Next.js frontend workspace
│   ├── api/                 # Backend API gateway
│   └── agent-runtime/       # Agent execution service
│
├── packages/
│   ├── core/                # Shared types, artifacts, permissions
│   ├── plugin-sdk/          # Plugin & connector interfaces
│   ├── mcp-client/          # MCP protocol implementation
│   ├── workflow-engine/     # Automation engine (n8n/Temporal)
│   └── ui-kit/              # Workspace UI components
│
├── plugins/
│   ├── github/              # GitHub connector
│   ├── figma/               # Figma connector
│   ├── notion/              # Notion connector
│   ├── ml/                  # ML tools connector
│   └── web3/                # Blockchain connector
│
├── agents/
│   ├── coding-agent/
│   ├── design-agent/
│   ├── automation-agent/
│   └── ml-agent/
│
├── infra/
│   ├── auth/                # OAuth + SSO
│   ├── secrets/             # Token vault
│   ├── logging/
│   ├── audit/
│   └── billing/
│
└── docs/
    ├── architecture.md
    ├── plugin-spec.md
    └── security.md
```

---

## The Plugin Contract — How Every Connector Is Built

Every tool that integrates with TechIT must implement the Plugin Contract. This is non-negotiable. The contract defines authentication, capabilities, resources, events, and MCP exposure. Every engineer building a connector starts here.

### Plugin Manifest (`techit.plugin.yaml`)

Create this file in your plugin directory. Fill in all fields before writing any implementation code.

```yaml
name: github                            # Unique plugin identifier
version: 1.0.0
description: GitHub code integration for TechIT

auth:
  type: oauth2                          # or: api_key | service_account
  authorization_url: https://github.com/login/oauth/authorize
  token_url: https://github.com/login/oauth/access_token
  scopes:
    - repo
    - read:user
    - write:discussion

capabilities:
  - read
  - write
  - execute

resources:
  - repository
  - pull_request
  - issue
  - workflow

events:
  - push
  - pull_request
  - workflow_run

agent_access: true

mcp:
  enabled: true
```

### SDK Interfaces — Required Methods

Every plugin must implement these TypeScript interfaces. They live in `packages/plugin-sdk/`.

```ts
// Connector Interface — handles resource access
interface Connector {
  authenticate(): Promise<AuthToken>
  listResources(): Promise<Resource[]>
  readResource(id: string): Promise<Resource>
  writeResource(id: string, payload: any): Promise<void>
  executeAction(action: string, params: any): Promise<Result>
}

// MCP Adapter Interface — handles agent access
interface MCPAdapter {
  describeTools(): MCPTool[]
  invoke(tool: string, params: any): Promise<any>
}
```

---

## 🧠 Integration 1: GitHub

Code repositories, pull requests, issues, CI/CD pipelines, and agent-generated commits.

### What This Integration Delivers

| Component | Details |
|---|---|
| Repo Browser | Engineers browse all linked repositories and branches directly inside TechIT. |
| PR & Issue Manager | Create, review, merge, and comment on pull requests and issues without leaving TechIT. |
| Code Diff Viewer | Inline diff display for all open and merged PRs, linked to design changes. |
| Agent-Generated PRs | AI coding agents open pull requests automatically after completing a task. |
| CI Status Panels | Live build and test status from GitHub Actions, displayed per project. |

### Step-by-Step: GitHub Integration

1. **Register a GitHub App** — GitHub Settings > Developer Settings > GitHub Apps. Create a new app under your organisation. Set homepage URL to your TechIT workspace domain. Generate and download the private key (.pem file).
2. **Configure OAuth Scopes** — Enable: Contents (read/write), Pull Requests (read/write), Issues (read/write), Workflows (read), Checks (read). Store scopes in plugin manifest under `auth.scopes`.
3. **Implement the OAuth Flow** — In `plugins/github/auth.ts`, implement `authenticate()`. Redirect to GitHub's authorization URL. Handle callback, exchange code for access token, store in `infra/secrets/` (token vault). Never store tokens in plain text or env vars in production.
4. **Set Up Webhooks** — In GitHub App settings, add webhook → `https://api.yourtechit.domain/webhooks/github`. Enable events: push, pull_request, workflow_run, issues. In `plugins/github/webhook.ts`, parse payloads and emit to the TechIT event bus.
5. **Register the MCP Server** — In `plugins/github/mcp.ts`, implement `describeTools()` and `invoke()`. Register at minimum: `list_repositories`, `read_file`, `create_pull_request`, `get_pr_status`, `list_issues`, `run_workflow`.
6. **Connect to the Artifact Model** — Every linked repo registered as Artifact with `type=code`. In `packages/core/artifacts.ts`, call `createArtifact({ type: 'code', source_tool: 'github', external_id: repo.id })`.
7. **Test the Integration** — Link a repo to a test project. Confirm browse files, view open PRs, trigger a test agent action (e.g., open a draft PR). Check audit log in `infra/audit/`.

### Agent Capability — Coding Agent via GitHub

Once connected, the Coding Agent can: write code and commit to a branch, open PRs with natural language descriptions, review and comment on existing PRs, fix failing tests, check CI status, and roll back changes. **Every destructive action requires human approval before execution.**

```ts
// Example: Agent opening a PR via MCP
await mcp.invoke('create_pull_request', {
  repo: 'techit-core',
  branch: 'agent/fix-auth-bug',
  title: 'Fix: Resolve OAuth token expiry edge case',
  body: 'This PR resolves the token refresh failure...',
  base: 'main'
})
```

---

## 🎨 Integration 2: Figma

Design infrastructure — read design files, extract tokens, detect changes, and map designs directly to code via AI agent.

### What This Integration Delivers

| Component | Details |
|---|---|
| Design Preview Panels | View Figma frames, components, and pages inside TechIT project views. |
| Component Trees | Browse the full component hierarchy of any linked Figma file. |
| Design Token Extraction | Automatically pull colors, spacing, typography, and breakpoints from Figma. |
| Version History | Track changes to design files over time, linked to code artifact versions. |
| Design-to-Code Mapping | The Design Agent maps Figma components to existing React components and generates diffs. |
| Design Discussion Threads | Comment on Figma files directly from TechIT without opening Figma. |

### Step-by-Step: Figma Integration

1. **Create a Figma OAuth Application** — figma.com > Account Settings > Apps > Create New App. Callback URL: `https://api.yourtechit.domain/auth/figma/callback`. Copy Client ID and Secret into `infra/secrets/`.
2. **Implement OAuth with Correct Scopes** — In `plugins/figma/auth.ts`, redirect with scopes `file_read` and `file_write`. Figma tokens expire — implement refresh flow using the `refresh_token`.
3. **Register Figma Webhooks** — Via Figma REST API, register webhook for `FILE_UPDATE` events on each linked file → `https://api.yourtechit.domain/webhooks/figma`. In `plugins/figma/webhook.ts`, parse and trigger artifact versioning on every design change.
4. **Implement the Read Capabilities** — In `plugins/figma/connector.ts`: `readResource()` (GET /v1/files/:file_id), `listResources()` (pages/frames), `readComponent()`, `extractTokens()` (design variables and styles).
5. **Build the MCP Tools** — In `plugins/figma/mcp.ts`, expose: `read_design_file`, `extract_design_tokens`, `list_components`, `detect_design_changes`, `add_comment`.
6. **Register Figma Files as Artifacts** — Each linked file → `Artifact(type=design)`. `createArtifact({ type: 'design', source_tool: 'figma', external_id: file.id })`. On change, increment `artifact.version` and emit `design_updated` event to the workflow engine.
7. **Activate the Design-to-Code Pipeline** — Figma's killer capability. On detected change: (a) Design Agent reads updated file via MCP, (b) extracts changed components and tokens, (c) generates updated React components + Tailwind/CSS variables, (d) opens a GitHub PR linked to the Figma file change. Human designer and engineer both approve before merge.

### Important — What TechIT Does NOT Do with Figma

TechIT does not embed the Figma editor inside its workspace UI. It reads design data, tracks changes, and enables agent-driven design-to-code flows. Designers still use Figma normally — TechIT simply removes the manual handoff step between design and engineering.

```ts
// Figma Design-to-Code Pipeline — Full Flow

// Step A: Webhook received
POST /webhooks/figma
{ event_type: 'FILE_UPDATE', file_id: 'abc123', timestamp: '...' }

// Step B: Agent reads updated design
await mcp.invoke('read_design_file', { file_id: 'abc123' })
await mcp.invoke('extract_design_tokens', { file_id: 'abc123' })

// Step C: Agent generates component diff
// Agent detects: Button component color changed from #1A3C5E to #0E7DC2

// Step D: Agent updates code
// Updates: src/components/Button.tsx + src/styles/tokens.css

// Step E: Agent opens PR
await mcp.invoke('create_pull_request', {
  title: 'Design sync: Update Button primary color',
  body: 'Figma file abc123 updated at 14:32 UTC. Token change applied.',
  figma_link: 'https://figma.com/file/abc123'
})
```

---

## 📝 Integration 3: Notion

Project documentation, knowledge bases, specifications, and agent-generated summaries — all synced in real time.

### What This Integration Delivers

| Component | Details |
|---|---|
| Synced Documents | Notion pages linked to TechIT projects stay in sync — bidirectional. |
| Editable Knowledge Base | Engineers read and update Notion docs from within TechIT project views. |
| Project Docs Linked to Code | Spec docs in Notion linked to GitHub repos and Figma files via the Artifact model. |
| Agent-Generated Summaries | AI agents summarise meeting notes, generate spec docs from code changes, update Notion pages automatically. |

### Step-by-Step: Notion Integration

1. **Create a Notion Integration** — notion.so/my-integrations. Copy Internal Integration Token into `infra/secrets/`. Capabilities: Read Content, Update Content, Insert Content.
2. **Implement OAuth for User-Facing Flows** — In `plugins/notion/auth.ts`, OAuth 2.0 for individual user authorisation. For shared workspace, the integration token is sufficient.
3. **Connect Notion Pages as Artifacts** — Each page/database → `Artifact(type=doc)`. `readResource()` (GET /v1/blocks/:block_id), `listResources()` (GET /v1/search). `source_tool: 'notion'`.
4. **Implement Write Capabilities** — `writeResource()` updates content (PATCH /v1/blocks/:block_id/children). Allows agents to append summaries, update task statuses, insert generated spec content. Log writes in `infra/audit/`.
5. **Expose MCP Tools** — In `plugins/notion/mcp.ts`: `read_page`, `search_docs`, `create_page`, `update_page`, `list_databases`.
6. **Set Up Event-Driven Updates** — Notion has NO native webhooks. Use TechIT's polling mechanism (`plugins/notion/poller.ts`) every 5 minutes. On detected change, increment artifact version and notify linked agents/workflows.

---

## 🧪 Integration 4: Machine Learning Tools

Model registries, training runs, evaluation metrics, and one-click deployment — all coordinated through TechIT.

### What This Integration Delivers

| Component | Details |
|---|---|
| Model Registry | Browse all ML models by version, framework, deployment status. |
| Training Run Dashboard | Live metrics (loss, accuracy, throughput) for active training jobs. |
| Metrics Panels | Compare experiments side-by-side using synced MLflow or W&B data. |
| Deploy Buttons | Trigger model deployment to staging/production with one approval step. |
| Agent Capabilities | ML Agent can train, evaluate, deploy, roll back models autonomously with human approval gates. |

### Step-by-Step: ML Tools Integration

1. **Select Your ML Backend** — Supports Hugging Face Hub, MLflow, Weights & Biases. Configure in `plugins/ml/config.ts`. Multiple backends can run simultaneously; each model artifact tracks its backend.
2. **Configure API Credentials** — HF: `HF_TOKEN`. MLflow: `MLFLOW_TRACKING_URI` + `MLFLOW_TRACKING_TOKEN`. W&B: `WANDB_API_KEY`. All in `infra/secrets/`. Never hardcode.
3. **Implement Model Listing and Reading** — `listResources()` (model registry API), `readResource(id)` (metadata, metrics, artifact location). Each model → `Artifact(type=model)`.
4. **Implement Training Run Monitoring** — Poll backend every 60s. In `plugins/ml/poller.ts`, fetch run metrics, push to event bus. Metrics dashboard subscribes and updates in real time.
5. **Build Deployment Actions** — `executeAction('deploy', { model_id, environment })`. Gated behind human approval: `approval: { required: true, approvers: ['ml-lead', 'admin'] }`.
6. **Expose MCP Tools** — In `plugins/ml/mcp.ts`: `list_models`, `get_model_metrics`, `train_model`, `evaluate_model`, `deploy_model`, `rollback_model`.

---

## 🔗 Integration 5: MCP Servers

The AI-native tool access layer — how agents understand and operate every tool without scraping, screenshots, or workarounds.

MCP (Model Context Protocol) is TechIT's core differentiator. Every tool integration exposes an MCP server so AI agents can call tool capabilities with structured inputs and outputs — not through UI scraping or brittle hacks.

### How MCP Works in TechIT

| Component | Details |
|---|---|
| MCP Client | Lives in `packages/mcp-client/`. TechIT's agent runtime is the MCP client — it discovers and calls tool MCP servers. |
| MCP Server | Each plugin implements an MCP server (`plugins/[tool]/mcp.ts`) that describes its tools and handles invocations. |
| MCP Flow | Agent → MCP Client (TechIT) → Tool MCP Server → External API Execution → Result returned to Agent. |
| Protocol | Follows the open MCP specification. TechIT is MCP-native — new tools only require adding an MCP server. |

### Step-by-Step: Implementing MCP for a New Tool

1. **Install MCP Dependencies** — `npm install @techit/mcp-sdk`. Provides base `MCPServer` class and `MCPTool` types.
2. **Define Your Tools in describeTools()** — Return an array of `MCPTool` objects, each with name, description, and `input_schema`. Be precise — the agent uses the description to decide when/how to call.
3. **Implement invoke()** — Validate input against schema. Call the underlying connector method. Return a structured result. Always catch errors and return them as structured error objects — never throw unhandled.
4. **Register the MCP Server** — Export the server instance in `index.ts`. Register in `packages/mcp-client/registry.ts`.
5. **Test with the MCP Inspector** — `npm run mcp:inspect`. Lists all registered servers/tools and lets you manually invoke them before agents use them.

```ts
// Example: Figma MCP Server
class FigmaMCPServer extends MCPServer {
  describeTools(): MCPTool[] {
    return [
      {
        name: 'extract_design_tokens',
        description: 'Extract colors, spacing, and typography from a Figma file.',
        input_schema: { file_id: { type: 'string', required: true } }
      },
      {
        name: 'list_components',
        description: 'List all components in a Figma file by frame and page.',
        input_schema: { file_id: { type: 'string', required: true } }
      }
    ]
  }
}
```

---

## Remaining Sections (referenced, detail TBD from source)

The guide also covers **AI Automation** (visual workflow engine — n8n/Temporal), **Web3 & Blockchain** (wallets, contracts, DAO dashboards), **Computer Vision** (live inference, edge devices), **Robotics Tools** (telemetry, control panels, simulation), the **Agent & Permission System** (roles, access, approval gates), and the **Enterprise Security & Compliance Model**. See the companion build plan in `plugin-sdk-build-plan.md` for how the SDK enforces permissions, audit, and approval gates structurally.
