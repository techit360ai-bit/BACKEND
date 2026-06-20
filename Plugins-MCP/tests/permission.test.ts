import { describe, it, expect } from 'vitest';
import { makeHarness, codingAgent, viewerActor, WS } from './helpers.js';

describe('Strategy 4 — permission boundary (sandbox)', () => {
  it('denies an agent invoking a tool outside its allow-list, with audit entry', async () => {
    const { client, audit } = await makeHarness();
    const { actor, agent } = codingAgent(['github.read_file']); // create_pull_request NOT allowed
    const res = await client.invoke(
      'github',
      'create_pull_request',
      { repo: 'havitec/techit', head: 'feat', base: 'main', title: 'x' },
      { actor, agent, resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
    expect(audit.entries().some((e) => e.action === 'create_pull_request' && e.result === 'denied')).toBe(
      true,
    );
  });

  it('enforces workspace isolation across workspaces', async () => {
    const { client } = await makeHarness();
    const foreign = viewerActor('ws-other');
    const res = await client.invoke(
      'github',
      'list_repositories',
      {},
      { actor: foreign, resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });

  it('denies a viewer the editor-level create_pull_request on role grounds', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'github',
      'create_pull_request',
      { repo: 'havitec/techit', head: 'feat', base: 'main', title: 'x' },
      { actor: viewerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });

  it('rejects an agent definition containing a wildcard tool', async () => {
    const { client } = await makeHarness();
    const { actor, agent } = codingAgent(['github.*']);
    const res = await client.invoke(
      'github',
      'list_repositories',
      {},
      { actor, agent, resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });
});
