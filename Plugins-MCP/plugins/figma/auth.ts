/**
 * Figma auth. Figma uses a personal access token (api_key). The token is stored
 * ONLY in the plugin's scoped vault namespace (`secrets://figma/*`).
 */

import type { ScopedSecrets } from '@techit/infra-secrets';
import type { AuthToken } from '@techit/plugin-sdk';

const TOKEN_KEY = 'access_token';

export async function storeToken(secrets: ScopedSecrets, token: string): Promise<void> {
  await secrets.set(TOKEN_KEY, token);
}

export async function resolveToken(secrets: ScopedSecrets): Promise<AuthToken> {
  const lease = await secrets.get(TOKEN_KEY);
  if (!lease) {
    throw new Error('figma: no stored access token (run the connect flow first)');
  }
  return {
    accessToken: lease.value,
    tokenType: 'bearer',
    scopes: [],
    expiresAt: lease.expiresAt,
  };
}

export const FIGMA_TOKEN_KEY = TOKEN_KEY;
