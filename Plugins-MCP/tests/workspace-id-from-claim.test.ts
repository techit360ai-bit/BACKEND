/**
 * Contract test for H3 / issue #9: toContext respects ActorInput.workspaceId.
 *
 * Before this fix, every invocation was stamped with the hardcoded WS = 'ws-acme'
 * label, blocking multi-tenancy. After: an authenticated user whose JWT carries
 * `workspaceId: 'ws-customer-42'` produces audit + actor records with the same
 * label, while a caller who omits the claim still gets the seed default.
 */

import { afterEach, beforeEach, expect, test } from 'vitest';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir: string;
let dataFile: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mcp-ws-'));
  dataFile = join(tmpDir, 'plugins-mcp.json');
  process.env.MCP_DATA_FILE = dataFile;
});

afterEach(() => {
  delete process.env.MCP_DATA_FILE;
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

test('explicit workspaceId from the actor reaches audit + on-disk store', async () => {
  const mod = await import('../server/techit-service.js?cb=' + Date.now());
  const svc = await mod.getTechitService();

  await svc.invoke('github', 'list_repositories', {}, {
    id: 'user-42',
    kind: 'human',
    role: 'editor',
    workspaceId: 'ws-customer-42',
  });

  // The most recent audit entry (after the build-time seed) carries our workspace.
  const entries = svc.audit() as Array<{ workspaceId: string; actor: string }>;
  const last = entries[entries.length - 1];
  expect(last.workspaceId).toBe('ws-customer-42');
  expect(last.actor).toBe('user-42');

  // Disk agrees.
  const onDisk = JSON.parse(readFileSync(dataFile, 'utf-8'));
  const lastDisk = onDisk.audit[onDisk.audit.length - 1];
  expect(lastDisk.workspaceId).toBe('ws-customer-42');
});

test('two callers with different workspaceIds produce two distinct audit rows', async () => {
  const mod = await import('../server/techit-service.js?cb=' + Date.now());
  const svc = await mod.getTechitService();

  await svc.invoke('github', 'list_repositories', {}, {
    id: 'tenant-a-user',
    kind: 'human',
    role: 'editor',
    workspaceId: 'ws-tenant-a',
  });
  await svc.invoke('github', 'list_repositories', {}, {
    id: 'tenant-b-user',
    kind: 'human',
    role: 'editor',
    workspaceId: 'ws-tenant-b',
  });

  const entries = svc.audit() as Array<{ workspaceId: string }>;
  const tail = entries.slice(-2);
  expect(tail.map(e => e.workspaceId).sort()).toEqual(['ws-tenant-a', 'ws-tenant-b'].sort());
});

test('omitted workspaceId falls back to the seed default (no behavior break)', async () => {
  const mod = await import('../server/techit-service.js?cb=' + Date.now());
  const svc = await mod.getTechitService();

  await svc.invoke('github', 'list_repositories', {});

  const entries = svc.audit() as Array<{ workspaceId: string }>;
  const last = entries[entries.length - 1];
  expect(last.workspaceId).toBe('ws-acme');
});
