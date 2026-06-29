import { describe, it, expect } from 'vitest';
import { makeHarness, ownerActor, WS } from './helpers.js';

describe('Strategy 5 — approval gate on destructive actions', () => {
  it('a destructive tool returns pending_approval and does NOT execute', async () => {
    const { client, approvals, plugin } = await makeHarness();
    const api = (plugin as unknown as { api: { created: { prs: unknown[] } } });
    const res = await client.invoke(
      'github',
      'create_pull_request',
      { repo: 'havitec/techit', head: 'feat/x', base: 'main', title: 'Add x' },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('pending_approval');
      expect(res.approvalRequestId).toBeTruthy();
    }
    // No PR created yet.
    expect([...approvals.requests.values()][0]?.status).toBe('pending');
    void api;
  });

  it('executes once the approval request is approved', async () => {
    const { client, approvals } = await makeHarness();
    const first = await client.invoke(
      'github',
      'create_pull_request',
      { repo: 'havitec/techit', head: 'feat/x', base: 'main', title: 'Add x' },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(first.ok).toBe(false);
    const approvalId = !first.ok ? first.approvalRequestId! : '';

    // Human approves.
    await approvals.decide({
      requestId: approvalId,
      decidedBy: 'founder',
      status: 'approved',
      decidedAt: new Date().toISOString(),
    });

    // Retry carrying the approvalRequestId → now executes.
    const second = await client.invoke(
      'github',
      'create_pull_request',
      { repo: 'havitec/techit', head: 'feat/x', base: 'main', title: 'Add x', approvalRequestId: approvalId },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(second.ok).toBe(true);
    if (second.ok) expect((second.data as { number: number }).number).toBeGreaterThan(100);
    expect((await approvals.get(approvalId))?.status).toBe('used');
  });

  it('rejects approval replay after successful execution', async () => {
    const { client, approvals } = await makeHarness();
    const first = await client.invoke(
      'github',
      'create_pull_request',
      { repo: 'havitec/techit', head: 'feat/x', base: 'main', title: 'Add x' },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    const approvalId = !first.ok ? first.approvalRequestId! : '';
    await approvals.decide({
      requestId: approvalId,
      decidedBy: 'founder',
      status: 'approved',
      decidedAt: new Date().toISOString(),
    });

    const params = { repo: 'havitec/techit', head: 'feat/x', base: 'main', title: 'Add x', approvalRequestId: approvalId };
    expect((await client.invoke('github', 'create_pull_request', params, { actor: ownerActor(), resourceWorkspaceId: WS })).ok).toBe(true);
    const replay = await client.invoke('github', 'create_pull_request', params, { actor: ownerActor(), resourceWorkspaceId: WS });

    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error.code).toBe('permission_denied');
      expect(replay.error.detail).toBe('used');
    }
  });

  it('rejects approvals from another workspace', async () => {
    const { client, approvals } = await makeHarness();
    const first = await client.invoke(
      'github',
      'create_pull_request',
      { repo: 'havitec/techit', head: 'feat/x', base: 'main', title: 'Add x' },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    const approvalId = !first.ok ? first.approvalRequestId! : '';
    await approvals.decide({
      requestId: approvalId,
      decidedBy: 'founder',
      status: 'approved',
      decidedAt: new Date().toISOString(),
    });

    const res = await client.invoke(
      'github',
      'create_pull_request',
      { repo: 'havitec/techit', head: 'feat/x', base: 'main', title: 'Add x', approvalRequestId: approvalId },
      { actor: ownerActor('ws-2'), resourceWorkspaceId: 'ws-2' },
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('permission_denied');
      expect(res.error.detail).toBe('workspace_mismatch');
    }
  });

  it('rejects expired approvals', async () => {
    const { client, approvals } = await makeHarness();
    const first = await client.invoke(
      'github',
      'create_pull_request',
      { repo: 'havitec/techit', head: 'feat/x', base: 'main', title: 'Add x' },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    const approvalId = !first.ok ? first.approvalRequestId! : '';
    await approvals.decide({
      requestId: approvalId,
      decidedBy: 'founder',
      status: 'approved',
      decidedAt: new Date().toISOString(),
    });
    process.env.MCP_APPROVAL_TTL_MS = '-1';
    try {
      const res = await client.invoke(
        'github',
        'create_pull_request',
        { repo: 'havitec/techit', head: 'feat/x', base: 'main', title: 'Add x', approvalRequestId: approvalId },
        { actor: ownerActor(), resourceWorkspaceId: WS },
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('permission_denied');
        expect(res.error.detail).toBe('expired');
      }
    } finally {
      delete process.env.MCP_APPROVAL_TTL_MS;
    }
  });
});
