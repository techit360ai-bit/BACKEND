/**
 * TechIT service singleton — builds the plugin runtime once and exposes the
 * three observable surfaces (tools, audit, contributions) plus invoke/approve
 * actions for an HTTP layer. No web framework imported here; the backend mounts
 * these functions onto its own Express app (see ./mount.ts).
 */

import type { Actor, AgentDefinition, Role } from '@techit/core';
import { InMemoryApprovalStore, InMemoryContributionSink } from '@techit/core';
import { InMemoryAuditLogger } from '@techit/infra-audit';
import { createRuntime, type CallContext, type Result } from '@techit/plugin-sdk';
import { MCPClient, MCPRegistry } from '@techit/mcp-client';
import { registerGithubPlugin } from '@techit/plugin-github';

const WS = 'ws-acme';

export interface ActorInput {
  id?: string;
  kind?: 'human' | 'agent';
  role?: Role;
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
  const actor: Actor = { id, kind, workspaceId: WS, role };
  if (kind === 'agent') {
    const agent: AgentDefinition = {
      id,
      name: id,
      workspaceId: WS,
      toolsAllowed: input?.toolsAllowed ?? [],
      maxRole: role,
    };
    return { actor, agent, resourceWorkspaceId: WS };
  }
  return { actor, resourceWorkspaceId: WS };
}

async function build(): Promise<TechitService> {
  const audit = new InMemoryAuditLogger();
  const approvals = new InMemoryApprovalStore();
  const contributions = new InMemoryContributionSink();
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
  await service.invoke('github', 'list_repositories', {});
  await service.invoke('github', 'list_issues', { repo: 'acme/app' });
  await service.invoke(
    'github',
    'create_pull_request',
    { repo: 'acme/app', head: 'feat/login', base: 'main', title: 'Add login flow' },
    { id: 'coding-agent', kind: 'agent', role: 'editor', toolsAllowed: ['github.create_pull_request'] },
  );

  return service;
}

let singleton: Promise<TechitService> | undefined;

export function getTechitService(): Promise<TechitService> {
  if (!singleton) singleton = build();
  return singleton;
}
