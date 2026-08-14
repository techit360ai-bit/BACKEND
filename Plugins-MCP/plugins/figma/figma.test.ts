import { describe, it, expect } from 'vitest';
import type { Actor, AgentDefinition } from '@techit/core';
import { InMemoryApprovalStore, InMemoryContributionSink } from '@techit/core';
import { InMemoryAuditLogger } from '@techit/infra-audit';
import { createRuntime, type SdkRuntime } from '@techit/plugin-sdk';
import { MCPClient, MCPRegistry } from '@techit/mcp-client';
import { registerFigmaPlugin } from './index.js';

const WS = 'ws-1';

async function makeHarness() {
  const audit = new InMemoryAuditLogger();
  const approvals = new InMemoryApprovalStore();
  const contributions = new InMemoryContributionSink();
  const runtime: SdkRuntime = createRuntime({ audit, approvals, contributions });
  const registry = new MCPRegistry();
  const plugin = await registerFigmaPlugin({ runtime, registry, workspaceId: WS });
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

describe('Figma connector', () => {
  it('get_file returns file info for a viewer', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke('figma', 'get_file', { file_key: 'abc123' }, { actor: viewerActor(), resourceWorkspaceId: WS });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.data as { name: string }).name).toBeTruthy();
  });

  it('export_frame returns an image url', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'figma',
      'export_frame',
      { file_key: 'abc123', node_id: '1:2' },
      { actor: viewerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.data as { imageUrl: string }).imageUrl).toContain('abc123');
  });

  it('list_comments returns comments for a viewer', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke('figma', 'list_comments', { file_key: 'abc123' }, { actor: viewerActor(), resourceWorkspaceId: WS });
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it('denies post_comment to a viewer on role grounds', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'figma',
      'post_comment',
      { file_key: 'abc123', message: 'looks good' },
      { actor: viewerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });

  it('post_comment is gated then executes after approval', async () => {
    const { client, approvals } = await makeHarness();
    const first = await client.invoke(
      'figma',
      'post_comment',
      { file_key: 'abc123', message: 'raise onboarding conversion' },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error.code).toBe('pending_approval');
    const approvalId = !first.ok ? first.approvalRequestId! : '';

    await approvals.decide({ requestId: approvalId, decidedBy: 'founder', status: 'approved', decidedAt: new Date().toISOString() });

    const second = await client.invoke(
      'figma',
      'post_comment',
      { file_key: 'abc123', message: 'raise onboarding conversion', approvalRequestId: approvalId },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(second.ok).toBe(true);
    expect((await approvals.get(approvalId))?.status).toBe('used');
  });

  it('denies an agent invoking post_comment outside its allow-list', async () => {
    const { client } = await makeHarness();
    const { actor, agent } = codingAgent(['figma.get_file']);
    const res = await client.invoke(
      'figma',
      'post_comment',
      { file_key: 'abc123', message: 'hi' },
      { actor, agent, resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });
});
