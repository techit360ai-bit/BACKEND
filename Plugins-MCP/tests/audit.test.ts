import { describe, it, expect } from 'vitest';
import { makeHarness, ownerActor, WS } from './helpers.js';
import { parseWebhook } from '@techit/plugin-github';

describe('Strategy 6 — audit completeness & secrets/events', () => {
  it('writes an audit entry for every executed tool', async () => {
    const { client, audit } = await makeHarness();
    await client.invoke('github', 'list_repositories', {}, { actor: ownerActor(), resourceWorkspaceId: WS });
    await client.invoke(
      'github',
      'read_file',
      { repo: 'havitec/techit', path: 'a.ts' },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    const actions = audit.entries().map((e) => e.action);
    expect(actions).toContain('list_repositories');
    expect(actions).toContain('read_file');
    expect(audit.entries().every((e) => e.workspaceId === WS)).toBe(true);
  });

  it('emits a contribution event after a successful tool', async () => {
    const { client, contributions } = await makeHarness();
    await client.invoke('github', 'list_issues', { repo: 'havitec/techit' }, {
      actor: ownerActor(),
      resourceWorkspaceId: WS,
    });
    expect(contributions.events.length).toBeGreaterThan(0);
    expect(contributions.events.at(-1)?.sourceTool).toBe('github');
  });

  it('scoped secrets cannot read another plugin namespace', async () => {
    const { runtime } = await makeHarness();
    const gh = runtime.vault.scopeTo('github');
    const figma = runtime.vault.scopeTo('figma');
    await gh.set('oauth_access_token', 'secret-gh');
    // figma's handle is confined to secrets://figma/* — it sees nothing of github's.
    expect(await figma.get('oauth_access_token')).toBeUndefined();
    expect((await gh.get('oauth_access_token'))?.value).toBe('secret-gh');
  });

  it('webhook and event-bus share one normalized shape', () => {
    const ev = parseWebhook('pull_request', {
      action: 'opened',
      pull_request: { number: 42 },
      repository: { id: 1 },
    });
    expect(ev.sourceTool).toBe('github');
    expect(ev.type).toBe('pull_request');
    expect(ev.externalId).toBe('pr-42');
  });
});
