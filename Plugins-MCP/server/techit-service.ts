/**
 * TechIT service singleton — builds the plugin runtime once and exposes the
 * three observable surfaces (tools, audit, contributions) plus invoke/approve
 * actions for an HTTP layer. No web framework imported here; the backend mounts
 * these functions onto its own Express app (see ./mount.ts).
 */

import type { Actor, AgentDefinition, Role } from '@techit/core';
import { createRuntime, type CallContext, type Result } from '@techit/plugin-sdk';
import { MCPClient, MCPRegistry } from '@techit/mcp-client';
import { registerGithubPlugin } from '@techit/plugin-github';
import { registerNotionPlugin } from '@techit/plugin-notion';
import { registerFigmaPlugin } from '@techit/plugin-figma';
import { registerWeb3Plugin } from '@techit/plugin-web3';
import { registerAiPlugin } from '@techit/plugin-ai';
import {
  FileApprovalStore,
  FileAuditLogger,
  FileContributionSink,
  validateMcpStoreConfig,
} from './file-store.js';

// Default workspaceId used for the demo-seed activity in build() and as a
// fallback when a caller doesn't supply one. Production traffic should
// always come through mount.ts with a verified JWT claim — see
// resolveActor in app.js, which sets ActorInput.workspaceId from the token.
const WS = 'ws-acme';

export interface ActorInput {
  id?: string;
  kind?: 'human' | 'agent';
  role?: Role;
  /** Tenant scope from the verified JWT (workspaceId claim). Falls back to WS
   *  when omitted — only happens for the in-process seed activity. */
  workspaceId?: string;
  /** For agents: explicit tool allow-list (`<plugin>.<tool>`). */
  toolsAllowed?: string[];
}

export interface TechitService {
  workspaceId: string;
  listTools(): { plugin: string; tool: unknown }[];
  audit(workspaceId?: string): unknown[];
  contributions(workspaceId?: string): unknown[];
  approvals(workspaceId?: string): unknown[];
  invoke(plugin: string, tool: string, params: unknown, actor?: ActorInput): Promise<Result>;
  approve(
    requestId: string,
    actor?: ActorInput,
  ): Promise<{ approved: true } | { approved: false; reason: string }>;
}

function toContext(input: ActorInput | undefined): CallContext {
  const role: Role = input?.role ?? 'owner';
  const kind = input?.kind ?? 'human';
  const id = input?.id ?? (kind === 'agent' ? 'coding-agent' : 'founder');
  const workspaceId = input?.workspaceId ?? WS;
  const actor: Actor = { id, kind, workspaceId, role };
  if (kind === 'agent') {
    const agent: AgentDefinition = {
      id,
      name: id,
      workspaceId,
      toolsAllowed: input?.toolsAllowed ?? [],
      maxRole: role,
    };
    return { actor, agent, resourceWorkspaceId: workspaceId };
  }
  return { actor, resourceWorkspaceId: workspaceId };
}

async function build(): Promise<TechitService> {
  validateProductionConfig();
  validateMcpStoreConfig();

  // Persistent stores backed by backend/data/plugins-mcp.json (override path
  // with MCP_DATA_FILE env). Audit log + approval queue + contribution feed
  // all survive restarts; the previous In-Memory stores reset on every boot.
  const audit = new FileAuditLogger();
  const approvals = new FileApprovalStore();
  const contributions = new FileContributionSink();
  const runtime = createRuntime({ audit, approvals, contributions });
  const registry = new MCPRegistry();
  await registerGithubPlugin({ runtime, registry, workspaceId: WS });
  await registerNotionPlugin({ runtime, registry, workspaceId: WS });
  await registerFigmaPlugin({ runtime, registry, workspaceId: WS });
  await registerWeb3Plugin({ runtime, registry, workspaceId: WS });
  await registerAiPlugin({ runtime, registry, workspaceId: WS });
  const client = new MCPClient(registry);

  const service: TechitService = {
    workspaceId: WS,
    listTools: () => client.listTools(),
    audit: (workspaceId) => workspaceId ? [...audit.entriesForWorkspace(workspaceId)] : [...audit.entries()],
    contributions: (workspaceId) => workspaceId
      ? [...contributions.eventsForWorkspace(workspaceId)]
      : [...contributions.events],
    approvals: (workspaceId) => workspaceId
      ? approvals.listForWorkspace(workspaceId)
      : [...approvals.requests.values()],
    invoke: (plugin, tool, params, actor) => client.invoke(plugin, tool, params, toContext(actor)),
    approve: async (requestId, actor = { id: 'founder', role: 'owner', kind: 'human', workspaceId: WS }) => {
      const req = await approvals.get(requestId);
      if (!req) return { approved: false, reason: 'not_found' };
      const ctx = toContext(actor);
      if (ctx.actor.kind !== 'human') return { approved: false, reason: 'human_required' };
      if (!['admin', 'owner'].includes(ctx.actor.role)) return { approved: false, reason: 'insufficient_role' };
      if (req.workspaceId !== ctx.actor.workspaceId) return { approved: false, reason: 'workspace_mismatch' };
      if (req.status !== 'pending') return { approved: false, reason: `already_${req.status}` };
      await approvals.decide({
        requestId,
        decidedBy: ctx.actor.id,
        status: 'approved',
        decidedAt: new Date().toISOString(),
      });
      return { approved: true };
    },
  };

  // Demo seed activity is opt-in and forbidden in production/staging. An audit
  // log must contain only real actions unless an operator explicitly launches
  // a local demo.
  if (process.env.MCP_SEED_DEMO_ACTIVITY === 'true' && audit.entries().length === 0) {
    await service.invoke('github', 'list_repositories', {});
    await service.invoke('github', 'list_issues', { repo: 'acme/app' });
    await service.invoke(
      'github',
      'create_pull_request',
      { repo: 'acme/app', head: 'feat/login', base: 'main', title: 'Add login flow' },
      { id: 'coding-agent', kind: 'agent', role: 'editor', toolsAllowed: ['github.create_pull_request'] },
    );
    // One read per new connector so every plugin appears in the demo feeds.
    await service.invoke('notion', 'search', { query: 'roadmap' });
    await service.invoke('figma', 'get_file', { file_key: 'demo123' });
    await service.invoke('web3', 'get_balance', { address: '0x1234567890abcdef1234567890abcdef12345678' });
    await service.invoke(
      'ai',
      'review_code',
      { code: 'const x: any = 1;', language: 'typescript' },
      { id: 'founder', kind: 'human', role: 'editor' },
    );
  }

  return service;
}

let singleton: Promise<TechitService> | undefined;

export function getTechitService(): Promise<TechitService> {
  if (!singleton) singleton = build();
  return singleton;
}

function validateProductionConfig(): void {
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  if (!['production', 'staging'].includes(env)) return;
  if (process.env.MCP_ALLOW_STUB_CONNECTORS === 'true') {
    throw new Error('MCP_ALLOW_STUB_CONNECTORS=true is forbidden in production/staging.');
  }
  if (process.env.MCP_SEED_DEMO_ACTIVITY === 'true') {
    throw new Error('MCP_SEED_DEMO_ACTIVITY=true is forbidden in production/staging.');
  }
}
