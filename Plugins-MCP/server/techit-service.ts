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
import {
  FileApprovalStore,
  FileAuditLogger,
  FileContributionSink,
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
  audit(): unknown[];
  contributions(): unknown[];
  approvals(): unknown[];
  invoke(plugin: string, tool: string, params: unknown, actor?: ActorInput): Promise<Result>;
  approve(requestId: string, decidedBy?: string): Promise<{ approved: boolean }>;
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
  // Persistent stores backed by backend/data/plugins-mcp.json (override path
  // with MCP_DATA_FILE env). Audit log + approval queue + contribution feed
  // all survive restarts; the previous In-Memory stores reset on every boot.
  const audit = new FileAuditLogger();
  const approvals = new FileApprovalStore();
  const contributions = new FileContributionSink();
  const runtime = createRuntime({ audit, approvals, contributions });
  const registry = new MCPRegistry();
  await registerGithubPlugin({ runtime, registry, workspaceId: WS });
  const client = new MCPClient(registry);

  const service: TechitService = {
    workspaceId: WS,
    listTools: () => client.listTools(),
    audit: () => [...audit.entries()],
    contributions: () => [...contributions.events],
    approvals: () => [...approvals.requests.values()],
    invoke: (plugin, tool, params, actor) => client.invoke(plugin, tool, params, toContext(actor)),
    approve: async (requestId, decidedBy = 'founder') => {
      const req = await approvals.get(requestId);
      if (!req) return { approved: false };
      await approvals.decide({
        requestId,
        decidedBy,
        status: 'approved',
        decidedAt: new Date().toISOString(),
      });
      return { approved: true };
    },
  };

  // Seed a little activity so the dashboards aren't empty on first load.
  // Only run when the audit log is empty (fresh database) — without this guard
  // every restart would append three more rows, polluting the persistent log.
  if (audit.entries().length === 0) {
    await service.invoke('github', 'list_repositories', {});
    await service.invoke('github', 'list_issues', { repo: 'acme/app' });
    await service.invoke(
      'github',
      'create_pull_request',
      { repo: 'acme/app', head: 'feat/login', base: 'main', title: 'Add login flow' },
      { id: 'coding-agent', kind: 'agent', role: 'editor', toolsAllowed: ['github.create_pull_request'] },
    );
  }

  return service;
}

let singleton: Promise<TechitService> | undefined;

export function getTechitService(): Promise<TechitService> {
  if (!singleton) singleton = build();
  return singleton;
}
