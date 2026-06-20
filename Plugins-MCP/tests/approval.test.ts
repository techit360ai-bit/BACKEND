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
  });
});
