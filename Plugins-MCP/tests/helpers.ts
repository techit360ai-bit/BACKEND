import type { Actor, AgentDefinition } from '@techit/core';
import { InMemoryApprovalStore, InMemoryContributionSink } from '@techit/core';
import { InMemoryAuditLogger } from '@techit/infra-audit';
import { createRuntime, type SdkRuntime } from '@techit/plugin-sdk';
import { MCPClient, MCPRegistry } from '@techit/mcp-client';
import { registerGithubPlugin, GitHubPlugin } from '@techit/plugin-github';

export const WS = 'ws-1';

export interface Harness {
  runtime: SdkRuntime;
  registry: MCPRegistry;
  client: MCPClient;
  plugin: GitHubPlugin;
  audit: InMemoryAuditLogger;
  approvals: InMemoryApprovalStore;
  contributions: InMemoryContributionSink;
}

export async function makeHarness(): Promise<Harness> {
  const audit = new InMemoryAuditLogger();
  const approvals = new InMemoryApprovalStore();
  const contributions = new InMemoryContributionSink();
  const runtime = createRuntime({ audit, approvals, contributions });
  const registry = new MCPRegistry();
  const plugin = await registerGithubPlugin({ runtime, registry, workspaceId: WS });
  const client = new MCPClient(registry);
  return { runtime, registry, client, plugin, audit, approvals, contributions };
}

export function ownerActor(workspaceId = WS): Actor {
  return { id: 'founder', kind: 'human', workspaceId, role: 'owner' };
}

export function viewerActor(workspaceId = WS): Actor {
  return { id: 'guest', kind: 'human', workspaceId, role: 'viewer' };
}

export function codingAgent(toolsAllowed: string[], workspaceId = WS): {
  actor: Actor;
  agent: AgentDefinition;
} {
  const agent: AgentDefinition = {
    id: 'coding-agent',
    name: 'Coding Agent',
    workspaceId,
    toolsAllowed,
    maxRole: 'editor',
  };
  const actor: Actor = { id: 'coding-agent', kind: 'agent', workspaceId, role: 'editor' };
  return { actor, agent };
}
