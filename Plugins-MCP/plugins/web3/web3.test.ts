import { describe, it, expect } from 'vitest';
import type { Actor, AgentDefinition } from '@techit/core';
import { InMemoryApprovalStore, InMemoryContributionSink } from '@techit/core';
import { InMemoryAuditLogger } from '@techit/infra-audit';
import { createRuntime, type SdkRuntime } from '@techit/plugin-sdk';
import { MCPClient, MCPRegistry } from '@techit/mcp-client';
import { registerWeb3Plugin } from './index.js';
import { verifySiwe } from './siwe.js';
import { SEPOLIA_CHAIN_ID } from './web3-api.js';
import { privateKeyToAccount } from 'viem/accounts';

const WS = 'ws-1';

async function makeHarness() {
  const audit = new InMemoryAuditLogger();
  const approvals = new InMemoryApprovalStore();
  const contributions = new InMemoryContributionSink();
  const runtime: SdkRuntime = createRuntime({ audit, approvals, contributions });
  const registry = new MCPRegistry();
  const plugin = await registerWeb3Plugin({ runtime, registry, workspaceId: WS });
  const client = new MCPClient(registry);
  return { runtime, registry, client, plugin, audit, approvals, contributions };
}

function viewerActor(workspaceId = WS): Actor {
  return { id: 'guest', kind: 'human', workspaceId, role: 'viewer' };
}
function codingAgent(toolsAllowed: string[], workspaceId = WS): { actor: Actor; agent: AgentDefinition } {
  const agent: AgentDefinition = { id: 'coding-agent', name: 'Coding Agent', workspaceId, toolsAllowed, maxRole: 'editor' };
  const actor: Actor = { id: 'coding-agent', kind: 'agent', workspaceId, role: 'editor' };
  return { actor, agent };
}

const account = privateKeyToAccount('0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
const ADDRESS = account.address;
const NONCE = 'abcdef123456';
function siweMessage(expirationTime?: string, issuedAt = new Date().toISOString()): string {
  return [
    'app.techit.network wants you to sign in with your Ethereum account:',
    ADDRESS,
    '',
    'Sign in to TechIT Network',
    '',
    'URI: https://app.techit.network',
    'Version: 1',
    `Chain ID: ${SEPOLIA_CHAIN_ID}`,
    `Nonce: ${NONCE}`,
    `Issued At: ${issuedAt}`,
    ...(expirationTime ? [`Expiration Time: ${expirationTime}`] : []),
  ].join('\n');
}

describe('Web3 connector', () => {
  it('get_balance returns a Sepolia balance for a viewer', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke('web3', 'get_balance', { address: ADDRESS }, { actor: viewerActor(), resourceWorkspaceId: WS });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as { address: string; eth: string; chainId: number };
      expect(data.address).toBe(ADDRESS);
      expect(data.chainId).toBe(SEPOLIA_CHAIN_ID);
      expect(data.eth).toBeTruthy();
    }
  });

  it('get_transaction returns a mined tx for a viewer', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke('web3', 'get_transaction', { hash: '0xdead' }, { actor: viewerActor(), resourceWorkspaceId: WS });
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.data as { status: string }).status).toBe('mined');
  });

  it('read_contract returns raw eth_call output for a viewer', async () => {
    const { client } = await makeHarness();
    const res = await client.invoke(
      'web3',
      'read_contract',
      { to: ADDRESS, data: '0x70a08231' },
      { actor: viewerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect((res.data as { raw: string }).raw).toMatch(/^0x/);
  });

  it('siwe_verify accepts a well-formed message via the MCP tool', async () => {
    const { client } = await makeHarness();
    const message = siweMessage();
    const signature = await account.signMessage({ message });
    const res = await client.invoke(
      'web3',
      'siwe_verify',
      { message, signature, expected_nonce: NONCE },
      { actor: viewerActor(), resourceWorkspaceId: WS },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as { valid: boolean; address: string; cryptographicallyVerified: boolean };
      expect(data.valid).toBe(true);
      expect(data.address).toBe(ADDRESS);
      expect(data.cryptographicallyVerified).toBe(true);
    }
  });

  it('verifySiwe rejects a malformed signature and an expired message', async () => {
    const goodMsg = siweMessage();
    expect((await verifySiwe(goodMsg, '0xnothex', { expectedNonce: NONCE })).valid).toBe(false);
    expect((await verifySiwe(goodMsg, '0xnothex', { expectedNonce: NONCE })).checks.signatureFormat).toBe(false);

    const expired = siweMessage('2020-01-01T00:00:00.000Z', '2019-01-01T00:00:00.000Z');
    const signature = await account.signMessage({ message: expired });
    const r = await verifySiwe(expired, signature, {
      now: new Date('2026-08-09T00:00:00.000Z'), expectedNonce: NONCE,
    });
    expect(r.valid).toBe(false);
    expect(r.checks.timeValid).toBe(false);
    expect(r.reason).toBe('message time window is invalid');
  });

  it('allows an agent to read within its allow-list', async () => {
    const { client } = await makeHarness();
    const { actor, agent } = codingAgent(['web3.get_balance']);
    const res = await client.invoke('web3', 'get_balance', { address: ADDRESS }, { actor, agent, resourceWorkspaceId: WS });
    expect(res.ok).toBe(true);
  });

  it('denies an agent a tool outside its allow-list', async () => {
    const { client } = await makeHarness();
    const { actor, agent } = codingAgent(['web3.get_balance']);
    const res = await client.invoke('web3', 'read_contract', { to: ADDRESS, data: '0x' }, { actor, agent, resourceWorkspaceId: WS });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('permission_denied');
  });
});
