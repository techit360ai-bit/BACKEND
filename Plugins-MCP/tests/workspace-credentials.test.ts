/**
 * ADR-1/ADR-2/ADR-3 — workspace-scoped credentials in ONE canonical vault, with
 * environment tokens reduced to a gated, telemetry'd bootstrap import.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemorySecretVault, vaultNamespace } from '@techit/infra-secrets';
import {
  WorkspaceCredentialHandle,
  CredentialMissingError,
  ScopeInsufficientError,
  CREDENTIAL_SCOPES_KEY,
} from '@techit/plugin-sdk';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'mcp-wscred-'));
  process.env.MCP_DATA_FILE = join(tmpDir, 'plugins-mcp.json');
});

afterEach(() => {
  delete process.env.MCP_DATA_FILE;
  delete process.env.MCP_CREDENTIAL_BOOTSTRAP;
  delete process.env.MCP_GITHUB_TOKEN;
  delete process.env.GITHUB_CONNECTOR_MODE;
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
});

describe('vault namespaces (ADR-2)', () => {
  test('legacy lane and workspace lane are distinct', () => {
    expect(vaultNamespace('github')).toBe('secrets://github/');
    expect(vaultNamespace('github', 'ws-acme')).toBe('secrets://ws/ws-acme/github/');
  });

  test('an invalid workspace id is rejected', () => {
    expect(() => vaultNamespace('github', 'bad/../id')).toThrow();
  });

  test('two workspaces never share a credential', async () => {
    const vault = new InMemorySecretVault();
    await vault.scopeTo('github', 'ws-a').set('oauth_access_token', 'token-a');
    await vault.scopeTo('github', 'ws-b').set('oauth_access_token', 'token-b');

    expect((await vault.scopeTo('github', 'ws-a').get('oauth_access_token'))?.value).toBe('token-a');
    expect((await vault.scopeTo('github', 'ws-b').get('oauth_access_token'))?.value).toBe('token-b');
    // The legacy lane is untouched by either write.
    expect(await vault.scopeTo('github').get('oauth_access_token')).toBeUndefined();
  });
});

describe('workspace-scoped connection API (ADR-1)', () => {
  test('connect is isolated to the calling workspace', async () => {
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();

    const out = await svc.connect('ws-a', 'github', 'ghp_workspace_a_token', 0, 'owner-a');
    expect(out.ok).toBe(true);
    expect(out.connection).toMatchObject({ plugin: 'github', connected: true, source: 'vault' });

    const a = await svc.connections('ws-a');
    const b = await svc.connections('ws-b');
    expect(a.find((c: { plugin: string }) => c.plugin === 'github')?.connected).toBe(true);
    // Workspace B must NOT see workspace A's credential.
    expect(b.find((c: { plugin: string }) => c.plugin === 'github')?.connected).toBe(false);
  });

  test('disconnect only affects the calling workspace', async () => {
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();
    await svc.connect('ws-a', 'github', 'ghp_workspace_a_token', 0, 'owner-a');

    const out = await svc.disconnect('ws-a', 'github');
    expect(out.ok).toBe(true);
    expect(out.removed).toBe(true);
    const a = await svc.connections('ws-a');
    expect(a.find((c: { plugin: string }) => c.plugin === 'github')?.connected).toBe(false);
  });

  test('connect requires a workspace', async () => {
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();
    const out = await svc.connect('', 'github', 'x');
    expect(out).toEqual({ ok: false, error: 'workspace_required' });
  });
});

describe('environment tokens are bootstrap-only (ADR-3)', () => {
  test('without the explicit flag, an env token does NOT make a connector connected', async () => {
    process.env.MCP_GITHUB_TOKEN = 'ghp_legacy_env_token';
    // Flag deliberately unset.
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();

    const status = (await svc.connections('ws-env')).find((c: { plugin: string }) => c.plugin === 'github');
    expect(status?.connected).toBe(false);
    expect(status?.source).toBe('legacy-bootstrap');
    // No dynamic fallback happened.
    expect(mod.credentialTelemetry().length).toBe(0);
  });

  test('with the flag, the env token is imported once, with telemetry', async () => {
    process.env.MCP_GITHUB_TOKEN = 'ghp_legacy_env_token';
    process.env.MCP_CREDENTIAL_BOOTSTRAP = 'import';
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();

    const status = (await svc.connections('ws-env')).find((c: { plugin: string }) => c.plugin === 'github');
    expect(status?.connected).toBe(true);
    expect(status?.source).toBe('vault');
    expect(status?.deprecatedEnv).toBe(true);

    const events = mod.credentialTelemetry();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({
      event: 'credential_bootstrap_used',
      plugin: 'github',
      workspaceId: 'ws-env',
      deprecated: true,
      removalMilestone: mod.ENV_CREDENTIAL_REMOVAL_MILESTONE,
    });
    // The token may have been seeded into the legacy lane at boot from env, so
    // either legacy source is correct; what matters is it is deprecated.
    expect(['env', 'legacy-vault']).toContain(events[0].source);
  });
});

describe('missing credential is a clean DENY (no fallback)', () => {
  test('real mode with no workspace credential returns credential_missing', async () => {
    process.env.GITHUB_CONNECTOR_MODE = 'real';
    delete process.env.MCP_CREDENTIAL_BOOTSTRAP;
    delete process.env.MCP_GITHUB_TOKEN;
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();

    const res = await svc.invoke('github', 'list_repositories', {}, {
      id: 'u1',
      kind: 'human',
      role: 'editor',
      workspaceId: 'ws-nocred',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('credential_missing');
      // Actionable: the message tells the workspace to connect the provider.
      expect(res.error.error).toMatch(/Connect github/i);
    }
  });
});

describe('provider + scope verification at resolve time (ADR-1 step 3)', () => {
  test('missing credential throws CredentialMissingError', async () => {
    const handle = new WorkspaceCredentialHandle(new InMemorySecretVault(), 'github', ['repo']);
    handle.use('ws-1');
    await expect(handle.token('oauth_access_token')).rejects.toBeInstanceOf(CredentialMissingError);
  });

  test('recorded-but-insufficient scopes throw ScopeInsufficientError', async () => {
    const vault = new InMemorySecretVault();
    const scoped = vault.scopeTo('github', 'ws-1');
    await scoped.set('oauth_access_token', 'ghp_x');
    await scoped.set(CREDENTIAL_SCOPES_KEY, JSON.stringify(['read:user'])); // no `repo`

    const handle = new WorkspaceCredentialHandle(vault, 'github', ['repo', 'read:user']);
    handle.use('ws-1');
    await expect(handle.token('oauth_access_token')).rejects.toBeInstanceOf(ScopeInsufficientError);
  });

  test('sufficient scopes resolve the credential', async () => {
    const vault = new InMemorySecretVault();
    const scoped = vault.scopeTo('github', 'ws-1');
    await scoped.set('oauth_access_token', 'ghp_x');
    await scoped.set(CREDENTIAL_SCOPES_KEY, JSON.stringify(['repo', 'read:user']));

    const handle = new WorkspaceCredentialHandle(vault, 'github', ['repo', 'read:user']);
    handle.use('ws-1');
    expect(await handle.token('oauth_access_token')).toBe('ghp_x');
  });

  test('unknown scopes (opaque token) do not block, but are reported unverified', async () => {
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();
    // No scopes passed on connect → scopes unknown.
    await svc.connect('ws-unknown', 'github', 'ghp_opaque', 0, 'owner');
    const status = (await svc.connections('ws-unknown')).find((c: { plugin: string }) => c.plugin === 'github');
    expect(status?.connected).toBe(true);
    expect(status?.scopes).toEqual([]);
    expect(status?.scopesVerified).toBe(false);
  });

  test('connect records granted scopes and status verifies them', async () => {
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();
    await svc.connect('ws-scoped', 'github', 'ghp_scoped', 0, 'owner', ['repo', 'read:user']);
    const status = (await svc.connections('ws-scoped')).find((c: { plugin: string }) => c.plugin === 'github');
    expect(status?.scopes).toEqual(['repo', 'read:user']);
    expect(status?.scopesVerified).toBe(true);
  });

  test('importCredential (WS-J4 bridge) stores token + scopes for the workspace', async () => {
    const mod = await import('../server/techit-service.js?cb=' + Date.now());
    const svc = await mod.getTechitService();
    const out = await svc.importCredential('ws-bridge', 'github', 'ghp_from_oauth', ['repo', 'read:user']);
    expect(out.ok).toBe(true);
    const status = (await svc.connections('ws-bridge')).find((c: { plugin: string }) => c.plugin === 'github');
    expect(status?.connected).toBe(true);
    expect(status?.scopesVerified).toBe(true);
  });
});
