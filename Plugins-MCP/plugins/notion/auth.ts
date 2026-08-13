/**
 * Notion auth. Notion uses an internal integration token (api_key), not OAuth.
 * The token is stored ONLY in the plugin's scoped vault namespace
 * (`secrets://notion/*`) — never in env or plaintext. The connector/MCP read it
 * back through the same scoped handle.
 */

import type { ScopedSecrets } from '@techit/infra-secrets';
import type { AuthToken } from '@techit/plugin-sdk';

const TOKEN_KEY = 'access_token';

/** Persist an integration token into the scoped vault (connect flow). */
export async function storeToken(secrets: ScopedSecrets, token: string): Promise<void> {
  await secrets.set(TOKEN_KEY, token);
}

/** Resolve the current token from the scoped vault into an AuthToken. */
export async function resolveToken(secrets: ScopedSecrets): Promise<AuthToken> {
  const lease = await secrets.get(TOKEN_KEY);
  if (!lease) {
    throw new Error('notion: no stored integration token (run the connect flow first)');
  }
  return {
    accessToken: lease.value,
    tokenType: 'bearer',
    scopes: [],
    expiresAt: lease.expiresAt,
  };
}

export const NOTION_TOKEN_KEY = TOKEN_KEY;
