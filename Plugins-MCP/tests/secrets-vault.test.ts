import { describe, it, expect } from 'vitest';
import { InMemorySecretVault, NEVER_EXPIRES } from '@techit/infra-secrets';
import { CONNECTOR_CREDENTIALS } from '../server/techit-service.js';
import { GITHUB_TOKEN_KEY } from '../plugins/github/auth.js';
import { NOTION_TOKEN_KEY } from '../plugins/notion/auth.js';
import { FIGMA_TOKEN_KEY } from '../plugins/figma/auth.js';
import { WEB3_RPC_KEY } from '../plugins/web3/auth.js';
import { AI_TOKEN_KEY, AI_BASE_URL_KEY } from '../plugins/ai/auth.js';

describe('scoped secret vault', () => {
  it('delete removes the secret and reports whether one was there', async () => {
    const vault = new InMemorySecretVault();
    const github = vault.scopeTo('github');
    await github.set('oauth_access_token', 'ghp_secret');
    expect((await github.get('oauth_access_token'))?.value).toBe('ghp_secret');

    expect(await github.delete('oauth_access_token')).toBe(true);
    expect(await github.get('oauth_access_token')).toBeUndefined();
    // Idempotent: deleting what is not there is false, not an error.
    expect(await github.delete('oauth_access_token')).toBe(false);
  });

  it('delete is confined to the plugin namespace', async () => {
    const vault = new InMemorySecretVault();
    const github = vault.scopeTo('github');
    const notion = vault.scopeTo('notion');
    // Both plugins legitimately use the bare key `access_token`.
    await github.set('access_token', 'gh');
    await notion.set('access_token', 'notion');

    await github.delete('access_token');
    expect(await github.get('access_token')).toBeUndefined();
    expect((await notion.get('access_token'))?.value).toBe('notion');
  });

  it('a secret stored without an explicit TTL does not expire', async () => {
    // Regression guard. The in-memory vault used to default to a 3600s TTL
    // while the Postgres vault defaulted to never, so the same
    // `secrets.set(key, value)` meant "durable credential" in production and
    // "silently gone in an hour" in dev — the connector would start throwing
    // `no stored OAuth token` long after a successful connect.
    const vault = new InMemorySecretVault();
    const github = vault.scopeTo('github');
    await github.set('oauth_access_token', 'ghp_secret');

    const lease = await github.get('oauth_access_token');
    expect(lease?.expiresAt).toBe(NEVER_EXPIRES);

    const hourFromNow = Date.now() + 3600 * 1000;
    expect(Math.abs(Date.parse(lease!.expiresAt) - hourFromNow)).toBeGreaterThan(60 * 1000);
  });

  it('an explicit TTL is still honoured', async () => {
    const vault = new InMemorySecretVault();
    const gitlab = vault.scopeTo('gitlab');
    await gitlab.set('access_token', 'short-lived', 60);

    const lease = await gitlab.get('access_token');
    expect(lease?.expiresAt).not.toBe(NEVER_EXPIRES);
    expect(Date.parse(lease!.expiresAt)).toBeGreaterThan(Date.now());
  });
});

describe('connector credential descriptors', () => {
  // The connect/disconnect API writes to these keys; each plugin reads its own
  // exported constant. If the two drift, a credential connected through the API
  // is invisible to the connector that is supposed to use it — and the failure
  // surfaces as "no stored OAuth token" long after a successful connect.
  const cases: Array<[keyof typeof CONNECTOR_CREDENTIALS, string]> = [
    ['github', GITHUB_TOKEN_KEY],
    ['notion', NOTION_TOKEN_KEY],
    ['figma', FIGMA_TOKEN_KEY],
    ['web3', WEB3_RPC_KEY],
    ['ai', AI_TOKEN_KEY],
  ];

  it.each(cases)('%s reads the same vault key the API writes', (connector, exportedKey) => {
    expect(CONNECTOR_CREDENTIALS[connector].key).toBe(exportedKey);
  });

  it('every connector with a mode var and a documented kind is described once', () => {
    const plugins = Object.keys(CONNECTOR_CREDENTIALS);
    expect(plugins.sort()).toEqual(['ai', 'bitbucket', 'figma', 'github', 'gitlab', 'notion', 'web3']);
    for (const spec of Object.values(CONNECTOR_CREDENTIALS)) {
      expect(spec.modeVar.endsWith('_CONNECTOR_MODE')).toBe(true);
      expect(spec.key).not.toContain('/');
    }
    // Only the two credential-optional connectors may be invoked with no secret.
    expect(Object.entries(CONNECTOR_CREDENTIALS).filter(([, s]) => s.optional).map(([p]) => p).sort())
      .toEqual(['ai', 'web3']);
    // ai needs a base URL alongside its token; nothing else has a second key.
    expect(AI_BASE_URL_KEY).not.toBe(AI_TOKEN_KEY);
  });
});
