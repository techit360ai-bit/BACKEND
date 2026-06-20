/**
 * GitHub OAuth flow. The exchanged token is stored ONLY in the plugin's scoped
 * vault namespace (`secrets://github/*`) — never in env or plaintext. The
 * connector/MCP read it back through the same scoped handle.
 */

import type { ScopedSecrets } from '@techit/infra-secrets';
import type { AuthToken } from '@techit/plugin-sdk';

const TOKEN_KEY = 'oauth_access_token';

export interface OAuthExchange {
  /** Exchanges an authorization code for an access token. */
  exchangeCode(code: string): Promise<{ accessToken: string; scopes: string[] }>;
}

/** Stub exchange for local/dev/tests. Production posts to GitHub's token URL. */
export class StubOAuthExchange implements OAuthExchange {
  async exchangeCode(code: string): Promise<{ accessToken: string; scopes: string[] }> {
    return { accessToken: `ghs_${code}_token`, scopes: ['repo', 'read:user'] };
  }
}

/** Persist a freshly exchanged token into the scoped vault. */
export async function storeToken(
  secrets: ScopedSecrets,
  exchange: OAuthExchange,
  code: string,
): Promise<void> {
  const { accessToken } = await exchange.exchangeCode(code);
  await secrets.set(TOKEN_KEY, accessToken);
}

/** Resolve the current token from the scoped vault into an AuthToken. */
export async function resolveToken(secrets: ScopedSecrets): Promise<AuthToken> {
  const lease = await secrets.get(TOKEN_KEY);
  if (!lease) {
    throw new Error('github: no stored OAuth token (run the connect flow first)');
  }
  return {
    accessToken: lease.value,
    tokenType: 'bearer',
    scopes: ['repo', 'read:user'],
    expiresAt: lease.expiresAt,
  };
}

export const GITHUB_TOKEN_KEY = TOKEN_KEY;
