import { describe, it, expect } from 'vitest';
import { makeHarness, ownerActor, WS } from './helpers.js';

describe('Strategy 3 — MCP Inspector smoke test', () => {
  it('lists every registered tool with structured metadata', async () => {
    const { client } = await makeHarness();
    const catalogue = client.listTools();
    expect(catalogue.length).toBeGreaterThanOrEqual(6);
    for (const { plugin, tool } of catalogue) {
      expect(plugin).toBe('github');
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.input_schema).toBe('object');
    }
  });

  it('manually invokes a read tool and returns a structured ok result', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'github',
      'read_file',
      { repo: 'havitec/techit', path: 'README.md' },
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(String(res.data)).toContain('README.md');
  });

  it('returns a structured not_found (never throws) for an unknown tool', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'github',
      'no_such_tool',
      {},
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('not_found');
  });

  it('rejects invalid input against input_schema with a structured error', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'github',
      'read_file',
      { repo: 'havitec/techit' }, // missing required `path`
      { actor: ownerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('invalid_input');
  });
});
