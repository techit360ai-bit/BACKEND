import { describe, it, expect } from 'vitest';
import { makeHarness, ownerActor, WS } from './helpers.js';

describe('Strategy 2 — contract conformance', () => {
  it('connector satisfies the Connector shape', async () => {
    const { plugin } = await makeHarness();
    const c = plugin.connector;
    for (const m of ['authenticate', 'listResources', 'readResource', 'writeResource', 'executeAction']) {
      expect(typeof (c as unknown as Record<string, unknown>)[m]).toBe('function');
    }
  });

  it('mcp server satisfies the MCPAdapter shape and describes declared tools', async () => {
    const { plugin } = await makeHarness();
    const tools = plugin.mcp.describeTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_repositories');
    expect(names).toContain('create_pull_request');
    expect(tools.find((t) => t.name === 'create_pull_request')?.destructive).toBe(true);
  });

  it('connector authenticate resolves a token from the scoped vault', async () => {
    const { plugin } = await makeHarness();
    const token = await plugin.connector.bind({ actor: ownerActor(), resourceWorkspaceId: WS }).authenticate();
    expect(token.tokenType).toBe('bearer');
    expect(token.accessToken).toContain('token');
  });
});
