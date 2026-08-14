/**
 * AI-harness "auth". The connector talks to the TechIT ai-router with a bearer
 * token. The token and base URL live ONLY in the plugin's scoped vault
 * namespace (`secrets://ai/*`) — never in env or plaintext. The connector/MCP
 * read them back through the same scoped handle.
 *
 * Reads are functional without a token (the fake harness needs no credential),
 * so `resolveToken` falls back to a no-op token when none is stored.
 */

import type { ScopedSecrets } from '@techit/infra-secrets';
import type { AuthToken } from '@techit/plugin-sdk';

const TOKEN_KEY = 'ai_router_token';
const BASE_URL_KEY = 'ai_router_url';

export async function storeToken(secrets: ScopedSecrets, token: string): Promise<void> {
  await secrets.set(TOKEN_KEY, token);
}

export async function storeBaseUrl(secrets: ScopedSecrets, baseUrl: string): Promise<void> {
  await secrets.set(BASE_URL_KEY, baseUrl);
}

export async function resolveBaseUrl(secrets: ScopedSecrets): Promise<string | undefined> {
  const lease = await secrets.get(BASE_URL_KEY);
  return lease?.value;
}

export async function resolveToken(secrets: ScopedSecrets): Promise<AuthToken> {
  const lease = await secrets.get(TOKEN_KEY);
  return {
    accessToken: lease?.value ?? 'fake-harness',
    tokenType: 'bearer',
    scopes: ['ai:invoke'],
    expiresAt: lease?.expiresAt,
  };
}

export const AI_TOKEN_KEY = TOKEN_KEY;
export const AI_BASE_URL_KEY = BASE_URL_KEY;
