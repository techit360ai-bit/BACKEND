import { describe, expect, it } from 'vitest';
import { makeHarness, ownerActor, WS } from './helpers.js';

describe('GitHub destination synchronization', () => {
  it('reads a remote head and requires approval before pushing files', async () => {
    const { client, runtime, contributions } = await makeHarness();
    const ctx = { actor: ownerActor(), resourceWorkspaceId: WS };
    const state = await client.invoke('github', 'get_repository_state', { projectId: 'project-1', repo: 'havitec/techit', branch: 'main' }, ctx);
    expect(state.ok).toBe(true);
    const headSha = state.ok ? (state.data as { headSha: string }).headSha : '';
    const params = { repo: 'havitec/techit', branch: 'main', expectedHeadSha: headSha, message: 'feat: sync editor', projectId: 'project-1', files: [{ path: 'src/editor.ts', content: 'export const editor = true;' }] };
    const pending = await client.invoke('github', 'push_files', params, ctx);
    expect(pending.ok).toBe(false);
    if (pending.ok) return;
    expect(pending.error.code).toBe('pending_approval');
    const approval = await runtime.approvals.get(pending.approvalRequestId!);
    expect(approval?.action).toBe('github.push_files');
    await runtime.approvals.decide({ requestId: pending.approvalRequestId!, decidedBy: 'founder', status: 'approved', decidedAt: new Date().toISOString() });
    const pushed = await client.invoke('github', 'push_files', { ...params, approvalRequestId: pending.approvalRequestId }, ctx);
    expect(pushed.ok).toBe(true);
    const contribution = contributions.events.at(-1);
    expect(contribution).toMatchObject({ kind: 'code_commit', projectId: 'project-1', sourceTool: 'github' });
    expect(contribution?.metadata).toMatchObject({ repo: 'havitec/techit', branch: 'main', filesChanged: 1 });
  });

  it('refuses a stale remote head instead of overwriting it', async () => {
    const { client, runtime } = await makeHarness();
    const ctx = { actor: ownerActor(), resourceWorkspaceId: WS };
    const params = { repo: 'havitec/techit', branch: 'main', expectedHeadSha: 'stale-head', message: 'unsafe push', projectId: 'project-1', files: [{ path: 'a.ts', content: 'x' }] };
    const pending = await client.invoke('github', 'push_files', params, ctx);
    if (pending.ok) throw new Error('approval was expected');
    await runtime.approvals.decide({ requestId: pending.approvalRequestId!, decidedBy: 'founder', status: 'approved', decidedAt: new Date().toISOString() });
    const result = await client.invoke('github', 'push_files', { ...params, approvalRequestId: pending.approvalRequestId }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain('github conflict');
  });

  it('rejects secret-like project paths before external mutation', async () => {
    const { client, runtime } = await makeHarness();
    const params = {
      repo: 'havitec/techit', branch: 'main', expectedHeadSha: 'fake-head-1', message: 'unsafe', projectId: 'project-1',
      files: [{ path: '.env.production', content: 'TOKEN=secret' }],
    };
    const pending = await client.invoke('github', 'push_files', params, { actor: ownerActor(), resourceWorkspaceId: WS });
    if (pending.ok) throw new Error('approval was expected');
    await runtime.approvals.decide({ requestId: pending.approvalRequestId!, decidedBy: 'founder', status: 'approved', decidedAt: new Date().toISOString() });
    const result = await client.invoke('github', 'push_files', { ...params, approvalRequestId: pending.approvalRequestId }, { actor: ownerActor(), resourceWorkspaceId: WS });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.detail).toContain('sensitive path');
  });
});
