/**
 * Web3 "auth". Public RPC reads need no credential, but we keep the scoped-vault
 * pattern: an optional RPC URL / provider key lives in `secrets://web3/*`. The
 * connector authenticates to a no-op token when none is set (reads are public).
 */

import type { ScopedSecrets } from '@techit/infra-secrets';
import type { AuthToken } from '@techit/plugin-sdk';

const RPC_KEY = 'rpc_url';

export async function storeRpcUrl(secrets: ScopedSecrets, rpcUrl: string): Promise<void> {
  await secrets.set(RPC_KEY, rpcUrl);
}

export async function resolveRpcUrl(secrets: ScopedSecrets): Promise<string | undefined> {
  const lease = await secrets.get(RPC_KEY);
  return lease?.value;
}

export async function resolveToken(secrets: ScopedSecrets): Promise<AuthToken> {
  const lease = await secrets.get(RPC_KEY);
  return {
    accessToken: lease?.value ?? 'public-rpc',
    tokenType: 'bearer',
    scopes: [],
    expiresAt: lease?.expiresAt,
  };
}

export const WEB3_RPC_KEY = RPC_KEY;
