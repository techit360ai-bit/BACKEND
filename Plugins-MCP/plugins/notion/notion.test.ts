import { describe, it, expect } from 'vitest';
import type { Actor, AgentDefinition } from '@techit/core';
import { InMemoryApprovalStore, InMemoryContributionSink } from '@techit/core';
import { InMemoryAuditLogger } from '@techit/infra-audit';
import { createRuntime, type SdkRuntime } from '@techit/plugin-sdk';
import { MCPClient, MCPRegistry } from '@techit/mcp-client';
import { registerNotionPlugin } from './index.js';

const WS = 'ws-1';

async function makeHarness() {
  const audit = new InMemoryAuditLogger();
  const approvals = new InMemoryApprovalStore();
  const contributions = new InMemoryContributionSink();
  const runtime: SdkRuntime = createRuntime({ audit, approvals, contributions });
  const registry = new MCPRegistry();
  const plugin = await registerNotionPlugin({ runtime, registry, workspaceId: WS });
  const client = new MCPClient(registry);
  return { runtime, registry, client, plugin, audit, approvals, contributions };
}

function ownerActor(workspaceId = WS): Actor {
  return { id: 'founder', kind: 'human', workspaceId, role: 'owner' };
}
function viewerActor(workspaceId = WS): Actor {
  return { id: 'guest', kind: 'human', workspaceId, role: 'viewer' };
}
function codingAgent(toolsAllowed: string[], workspaceId = WS): { actor: Actor; agent: AgentDefinition } {
  const agent: AgentDefinition = { id: 'coding-agent', name: 'Coding Agent', workspaceId, toolsAllowed, maxRole: 'editor' };
  const actor: Actor = { id: 'coding-agent', kind: 'agent', workspaceId, role: 'editor' };
  return { actor, agent };
}

describe('Notion connector', () => {
  it('search returns results for a viewer', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke('notion', 'search', { query: 'roadmap' }, { actor: viewerActor(), resourceWorkspaceId: WS });
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it('get_page returns page + blocks for a viewer', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke('notion', 'get_page', { page_id: 'page-welcome' }, { actor: viewerActor(), resourceWorkspaceId: WS });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.data as { page: { id: string } }).page.id).toBe('page-welcome');
  });

  it('denies create_page to a viewer on role grounds', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'notion',
      'create_page',
      { parent_id: 'page-welcome', title: 'New' },
      { actor: viewerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });

  it('create_page is gated then executes after approval', async () => {
    const { client, approvals } = await makeHarness();
    const first = await client.invoke(
      'notion',
      'create_page',
      { parent_id: 'page-welcome', title: 'Sprint Notes' },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error.code).toBe('pending_approval');
    const approvalId = !first.ok ? first.approvalRequestId! : '';

    await approvals.decide({ requestId: approvalId, decidedBy: 'founder', status: 'approved', decidedAt: new Date().toISOString() });

    const second = await client.invoke(
      'notion',
      'create_page',
      { parent_id: 'page-welcome', title: 'Sprint Notes', approvalRequestId: approvalId },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(second.ok).toBe(true);
    if (second.ok) expect((second.data as { id: string }).id).toBeTruthy();
    expect((await approvals.get(approvalId))?.status).toBe('used');
  });

  it('denies an agent invoking append_blocks outside its allow-list', async () => {
    const { client } = await makeHarness();
    const { actor, agent } = codingAgent(['notion.search']);
    const res = await client.invoke(
      'notion',
      'append_blocks',
      { page_id: 'page-welcome', blocks: [{ type: 'paragraph', text: 'hi' }] },
      { actor, agent, resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });
});
