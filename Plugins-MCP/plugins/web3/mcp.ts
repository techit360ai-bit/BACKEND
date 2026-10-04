/**
 * Web3MCPServer — exposes read-only EVM (Sepolia) tools + SIWE verification.
 * All tools are viewer-level, non-destructive; no approval gate needed.
 */

import {
  BaseMCPServer,
  type ManifestMCPTool,
  type SdkRuntime,
  type WorkspaceCredentialHandle,
} from '@techit/plugin-sdk';
import type { Web3Api } from './web3-api.js';
import { verifySiwe } from './siwe.js';

export class Web3MCPServer extends BaseMCPServer {
  constructor(runtime: SdkRuntime, toolSpecs: ManifestMCPTool[], private readonly api: Web3Api, creds?: WorkspaceCredentialHandle) {
    super('web3', runtime, toolSpecs, creds);

    this.handle('get_balance', async (p) => this.api.getBalance(String(p.address)));

    this.handle('get_transaction', async (p) => this.api.getTransaction(String(p.hash)));

    this.handle('read_contract', async (p) => this.api.readContract(String(p.to), String(p.data)));

    this.handle('siwe_verify', async (p) => verifySiwe(String(p.message), String(p.signature), {
      expectedDomain: process.env.SIWE_EXPECTED_DOMAIN,
      expectedUri: process.env.SIWE_EXPECTED_URI,
      expectedChainId: process.env.SIWE_EXPECTED_CHAIN_ID ? Number(process.env.SIWE_EXPECTED_CHAIN_ID) : undefined,
      expectedNonce: p.expected_nonce ? String(p.expected_nonce) : undefined,
      maxAgeMs: Number(process.env.SIWE_MAX_AGE_MS || 10 * 60 * 1000),
    }), 'ai_action');
  }
}
