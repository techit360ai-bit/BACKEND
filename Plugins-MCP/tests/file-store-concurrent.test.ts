/**
 * Contract test for H2 / issue #7: do concurrent writes to the file-backed
 * audit store lose entries?
 *
 * The security sweep flagged a 1-5ms race between load() and persist(). But
 * each write() body is synchronous (no awaits) and Node runs it to completion
 * before yielding, so in a SINGLE PROCESS there shouldn't be a window for
 * concurrent JS callbacks to interleave. This test verifies that empirically.
 *
 * Run: cd Plugins-MCP && npx vitest run tests/file-store-concurrent.test.ts
 */

import { afterEach, beforeEach, expect, test } from 'vitest';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir: string;
let dataFile: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mcp-store-'));
  dataFile = join(tmpDir, 'plugins-mcp.json');
  process.env.MCP_DATA_FILE = dataFile;
});

afterEach(() => {
  delete process.env.MCP_DATA_FILE;
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

test('100 parallel write()s land 100 entries on disk (no losses)', async () => {
  // Dynamic import so the per-test MCP_DATA_FILE env is picked up by the
  // module-level cache in file-store.ts.
  const mod = await import('../server/file-store.js?cb=' + Date.now());
  const audit = new mod.FileAuditLogger();

  const N = 100;
  await Promise.all(
    Array.from({ length: N }, (_, i) =>
      Promise.resolve().then(() =>
        audit.write({
          actor: `actor-${i}`,
          actorKind: 'human',
          action: 'test',
          sourceTool: 'unit-test',
          result: 'success',
          workspaceId: 'ws-test',
        }),
      ),
    ),
  );

  expect(audit.entries().length).toBe(N);

  // Verify what's actually on disk matches.
  const onDisk = JSON.parse(readFileSync(dataFile, 'utf-8'));
  expect(onDisk.audit.length).toBe(N);
});

test('interleaved writes from two FileAuditLogger instances share the file', async () => {
  // Two instances simulate two concurrent connections in the same process.
  // Both write through the module-level cache, so they should agree.
  const mod = await import('../server/file-store.js?cb=' + Date.now());
  const a = new mod.FileAuditLogger();
  const b = new mod.FileAuditLogger();

  await Promise.all([
    a.write({ actor: 'a1', actorKind: 'human', action: 't', sourceTool: 'x', result: 'success', workspaceId: 'w' }),
    b.write({ actor: 'b1', actorKind: 'human', action: 't', sourceTool: 'x', result: 'success', workspaceId: 'w' }),
    a.write({ actor: 'a2', actorKind: 'human', action: 't', sourceTool: 'x', result: 'success', workspaceId: 'w' }),
    b.write({ actor: 'b2', actorKind: 'human', action: 't', sourceTool: 'x', result: 'success', workspaceId: 'w' }),
  ]);

  // Both instances see the same view (4 entries) because they share the
  // module-level cache.
  expect(a.entries().length).toBe(4);
  expect(b.entries().length).toBe(4);

  const onDisk = JSON.parse(readFileSync(dataFile, 'utf-8'));
  expect(onDisk.audit.length).toBe(4);
});

test('production forbids the single-process MCP file store', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.MCP_DATA_FILE = dataFile;
  delete process.env.MCP_ALLOW_FILE_STORE;
  try {
    const mod = await import('../server/file-store.js?prod=' + Date.now());
    expect(() => mod.validateMcpStoreConfig()).toThrow(/forbidden/i);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.MCP_DATA_FILE = dataFile;
  }
});

test('production still rejects file-store when the legacy opt-in is set', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.MCP_DATA_FILE = dataFile;
  process.env.MCP_ALLOW_FILE_STORE = 'true';
  try {
    const mod = await import('../server/file-store.js?prodok=' + Date.now());
    expect(() => mod.validateMcpStoreConfig()).toThrow(/forbidden/i);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    delete process.env.MCP_ALLOW_FILE_STORE;
    process.env.MCP_DATA_FILE = dataFile;
  }
});
