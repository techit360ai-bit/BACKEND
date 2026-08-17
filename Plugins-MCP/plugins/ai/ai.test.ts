import { describe, it, expect } from 'vitest';
import type { Actor, AgentDefinition } from '@techit/core';
import { InMemoryApprovalStore, InMemoryContributionSink } from '@techit/core';
import { InMemoryAuditLogger } from '@techit/infra-audit';
import { createRuntime, type SdkRuntime } from '@techit/plugin-sdk';
import { MCPClient, MCPRegistry } from '@techit/mcp-client';
import { registerAiPlugin } from './index.js';
import { FakeAiHarnessApi } from './ai-api.js';

const WS = 'ws-1';

async function makeHarness() {
  const audit = new InMemoryAuditLogger();
  const approvals = new InMemoryApprovalStore();
  const contributions = new InMemoryContributionSink();
  const runtime: SdkRuntime = createRuntime({ audit, approvals, contributions });
  const registry = new MCPRegistry();
  const plugin = await registerAiPlugin({ runtime, registry, workspaceId: WS });
  const client = new MCPClient(registry);
  return { runtime, registry, client, plugin, audit, approvals, contributions };
}

function ownerActor(workspaceId = WS): Actor {
  return { id: 'founder', kind: 'human', workspaceId, role: 'owner' };
}
function editorActor(workspaceId = WS): Actor {
  return { id: 'builder', kind: 'human', workspaceId, role: 'editor' };
}
function viewerActor(workspaceId = WS): Actor {
  return { id: 'guest', kind: 'human', workspaceId, role: 'viewer' };
}
function codingAgent(toolsAllowed: string[], workspaceId = WS): { actor: Actor; agent: AgentDefinition } {
  const agent: AgentDefinition = { id: 'coding-agent', name: 'Coding Agent', workspaceId, toolsAllowed, maxRole: 'editor' };
  const actor: Actor = { id: 'coding-agent', kind: 'agent', workspaceId, role: 'editor' };
  return { actor, agent };
}

describe('AI-harness connector', () => {
  it('generate_code returns code for an editor', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'ai',
      'generate_code',
      { prompt: 'a fizzbuzz function', language: 'typescript' },
      { actor: editorActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as { language: string; code: string; model: string };
      expect(data.language).toBe('typescript');
      expect(data.code).toContain('fizzbuzz');
      expect(data.model).toBeTruthy();
    }
  });

  it('review_code flags an `any` usage', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'ai',
      'review_code',
      { code: 'const x: any = 1;\nconsole.log(x);', language: 'typescript' },
      { actor: editorActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as { issues: { message: string }[]; score: number };
      expect(data.issues.length).toBeGreaterThanOrEqual(1);
      expect(data.score).toBeLessThan(100);
    }
  });

  it('deep_research returns a summary with sources', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'ai',
      'deep_research',
      { query: 'seed-stage fintech GTM' },
      { actor: editorActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as { query: string; sources: unknown[] };
      expect(data.query).toBe('seed-stage fintech GTM');
      expect(Array.isArray(data.sources)).toBe(true);
      expect(data.sources.length).toBeGreaterThan(0);
    }
  });

  it('denies generate_code to a viewer on role grounds', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'ai',
      'generate_code',
      { prompt: 'anything' },
      { actor: viewerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });

  it('run_sandbox is gated then executes (simulated) after approval', async () => {
    const { client, approvals } = await makeHarness();
    const params = { language: 'python', code: 'print("hello")' };
    const first = await client.invoke('ai', 'run_sandbox', params, { actor: ownerActor(), resourceWorkspaceId: WS });
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.error.code).toBe('pending_approval');
    const approvalId = !first.ok ? first.approvalRequestId! : '';

    await approvals.decide({ requestId: approvalId, decidedBy: 'founder', status: 'approved', decidedAt: new Date().toISOString() });

    const second = await client.invoke(
      'ai',
      'run_sandbox',
      { ...params, approvalRequestId: approvalId },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      const data = second.data as { ok: boolean; simulated: boolean; exitCode: number };
      expect(data.simulated).toBe(true);
      expect(data.exitCode).toBe(0);
    }
    expect((await approvals.get(approvalId))?.status).toBe('used');
  });

  it('denies an agent invoking run_sandbox outside its allow-list', async () => {
    const { client } = await makeHarness();
    const { actor, agent } = codingAgent(['ai.generate_code']);
    const res = await client.invoke(
      'ai',
      'run_sandbox',
      { language: 'python', code: 'print(1)' },
      { actor, agent, resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });

  it('runSandbox never executes real code (simulated flag is always set)', async () => {
    const api = new FakeAiHarnessApi();
    const r = await api.runSandbox('bash', 'rm -rf /');
    expect(r.simulated).toBe(true);
    expect(r.stdout).toContain('simulated');
  });
});
