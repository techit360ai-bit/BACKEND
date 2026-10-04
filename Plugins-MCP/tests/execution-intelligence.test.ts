/**
 * WS-H — workspace ↔ incubation continuity, and ONE scope/role-aware execution
 * view for every consumer (workspace, founder, collaborator, investor,
 * organization, hackathon). The view never scores trust; it points at the
 * canonical Trust Engine.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mcp-execintel-'));
  process.env.MCP_DATA_FILE = join(tmpDir, 'plugins-mcp.json');
});

afterEach(() => {
  delete process.env.MCP_DATA_FILE;
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

const INCUBATION = {
  projectId: 'proj-1',
  stage: 'building_mvp',
  gsis: 72,
  goal: 'Launch beta',
  organizationId: 'org-1',
  hackathonId: 'hack-1',
};

type StoredEvent = { projectId?: string; metadata: Record<string, unknown> };

describe('WS-H execution intelligence', () => {
  test('incubation context is stamped onto contribution events', async () => {
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();
    const res = await svc.invoke('github', 'list_repositories', {}, {
      id: 'founder-1',
      kind: 'human',
      role: 'editor',
      workspaceId: 'ws-h',
      incubation: INCUBATION,
    });
    expect(res.ok).toBe(true);

    const events = (await svc.contributions('ws-h')) as StoredEvent[];
    const event = events.find((row) => row.projectId === 'proj-1');
    expect(event).toBeTruthy();
    expect(event?.metadata.incubation).toMatchObject({
      stage: 'building_mvp',
      gsis: 72,
      goal: 'Launch beta',
      hackathonId: 'hack-1',
    });
  });

  test('every role reads the same envelope with a role-specific focus', async () => {
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();
    await svc.invoke('github', 'list_repositories', {}, {
      id: 'founder-1',
      kind: 'human',
      role: 'editor',
      workspaceId: 'ws-h2',
      incubation: INCUBATION,
    });

    const founder = await svc.executionIntelligence({ workspaceId: 'ws-h2', projectId: 'proj-1', role: 'founder' });
    expect(founder.signals.events).toBeGreaterThanOrEqual(1);
    expect(founder.roleFocus).toContain('velocity');
    expect(founder.canonical).toMatchObject({ trustEngine: 'canonical', graphView: 'execution-reputation' });
    expect(founder.trustSubjects.some((s) => s.kind === 'project' && s.id === 'proj-1')).toBe(true);

    const collaborator = await svc.executionIntelligence({ workspaceId: 'ws-h2', role: 'collaborator' });
    expect(collaborator.roleFocus).toContain('artifacts');

    const investor = await svc.executionIntelligence({ workspaceId: 'ws-h2', role: 'investor' });
    expect(investor.roleFocus).toContain('trust');

    const organization = await svc.executionIntelligence({ workspaceId: 'ws-h2', role: 'organisation' });
    expect(organization.roleFocus).toContain('cohorts');

    const hackathon = await svc.executionIntelligence({ workspaceId: 'ws-h2', role: 'hackathon' });
    expect(hackathon.roleFocus).toContain('submissions');
  });

  test('scope filters partition the same canonical stream', async () => {
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();
    await svc.invoke('github', 'list_repositories', {}, {
      id: 'founder-1',
      kind: 'human',
      role: 'editor',
      workspaceId: 'ws-h3',
      incubation: INCUBATION,
    });

    const inScope = await svc.executionIntelligence({ workspaceId: 'ws-h3', hackathonId: 'hack-1' });
    const outScope = await svc.executionIntelligence({ workspaceId: 'ws-h3', hackathonId: 'hack-other' });
    expect(inScope.signals.events).toBeGreaterThanOrEqual(1);
    expect(outScope.signals.events).toBe(0);
  });
});
