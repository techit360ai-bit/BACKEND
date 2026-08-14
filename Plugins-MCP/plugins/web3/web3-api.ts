/**
 * Minimal EVM JSON-RPC surface (Sepolia testnet) used by the connector + MCP.
 *
 * `FakeWeb3Api` returns deterministic values so tests + sandbox demos run with no
 * network. `RealWeb3Api` performs read-only JSON-RPC calls (eth_getBalance,
 * eth_getTransactionByHash, eth_call) against a Sepolia RPC URL — reads only, so
 * there is no key/gas risk. Selected when WEB3_CONNECTOR_MODE is 'real'.
 */

export const SEPOLIA_CHAIN_ID = 11155111;

export interface BalanceResult {
  address: string;
  wei: string;
  eth: string;
  chainId: number;
}

export interface TxResult {
  hash: string;
  from: string;
  to: string | null;
  valueWei: string;
  blockNumber: number | null;
  status: 'pending' | 'mined' | 'unknown';
}

export interface Web3Api {
  getBalance(address: string): Promise<BalanceResult>;
  getTransaction(hash: string): Promise<TxResult>;
  readContract(to: string, data: string): Promise<{ to: string; data: string; raw: string }>;
}

function weiToEth(weiHexOrDec: string): string {
  const wei = weiHexOrDec.startsWith('0x') ? BigInt(weiHexOrDec) : BigInt(weiHexOrDec || '0');
  const whole = wei / 1_000_000_000_000_000_000n;
  const frac = wei % 1_000_000_000_000_000_000n;
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

/** Deterministic in-memory EVM. Default for local/dev/tests + sandbox demos. */
export class FakeWeb3Api implements Web3Api {
  async getBalance(address: string): Promise<BalanceResult> {
    const wei = '0x2386f26fc10000'; // 0.01 ETH
    return { address, wei, eth: weiToEth(wei), chainId: SEPOLIA_CHAIN_ID };
  }

  async getTransaction(hash: string): Promise<TxResult> {
    return {
      hash,
      from: '0x1111111111111111111111111111111111111111',
      to: '0x2222222222222222222222222222222222222222',
      valueWei: '10000000000000000',
      blockNumber: 6543210,
      status: 'mined',
    };
  }

  async readContract(to: string, data: string): Promise<{ to: string; data: string; raw: string }> {
    // e.g. an ERC-20 balanceOf returning 1000 tokens (uint256).
    return { to, data, raw: '0x00000000000000000000000000000000000000000000003635c9adc5dea00000' };
  }
}

/** Real Sepolia JSON-RPC (reads only) over global fetch. */
export class RealWeb3Api implements Web3Api {
  constructor(private readonly rpcUrl: string | (() => Promise<string>)) {}

  private async call<T>(method: string, params: unknown[]): Promise<T> {
    const url = typeof this.rpcUrl === 'function' ? await this.rpcUrl() : this.rpcUrl;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!res.ok) throw new Error(`web3 rpc ${res.status}`);
    const json = (await res.json()) as { result?: T; error?: { message: string } };
    if (json.error) throw new Error(`web3 rpc: ${json.error.message}`);
    return json.result as T;
  }

  async getBalance(address: string): Promise<BalanceResult> {
    const wei = await this.call<string>('eth_getBalance', [address, 'latest']);
    return { address, wei, eth: weiToEth(wei), chainId: SEPOLIA_CHAIN_ID };
  }

  async getTransaction(hash: string): Promise<TxResult> {
    const tx = await this.call<null | {
      from: string;
      to: string | null;
      value: string;
      blockNumber: string | null;
    }>('eth_getTransactionByHash', [hash]);
    if (!tx) return { hash, from: '', to: null, valueWei: '0', blockNumber: null, status: 'unknown' };
    return {
      hash,
      from: tx.from,
      to: tx.to,
      valueWei: BigInt(tx.value ?? '0x0').toString(),
      blockNumber: tx.blockNumber ? Number(BigInt(tx.blockNumber)) : null,
      status: tx.blockNumber ? 'mined' : 'pending',
    };
  }

  async readContract(to: string, data: string): Promise<{ to: string; data: string; raw: string }> {
    const raw = await this.call<string>('eth_call', [{ to, data }, 'latest']);
    return { to, data, raw };
  }
}
