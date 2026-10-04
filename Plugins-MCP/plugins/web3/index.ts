/**
 * Web3 plugin entry point.
 *
 *   const plugin = await registerWeb3Plugin({ runtime, registry, workspaceId });
 *
 * Hybrid: uses RealWeb3Api (Sepolia JSON-RPC, reads only) when
 * WEB3_CONNECTOR_MODE is 'real' and an RPC URL is available, else FakeWeb3Api.
 */

import { fileURLToPath } from 'node:url';
import type { MCPRegistry } from '@techit/mcp-client';
import {
  BasePlugin,
  loadManifest,
  type AuthToken,
  type PluginManifest,
  type SdkRuntime,
  WorkspaceCredentialHandle,
  CredentialMissingError,
} from '@techit/plugin-sdk';
import type { ScopedSecrets } from '@techit/infra-secrets';
import { Web3Connector } from './connector.js';
import { Web3MCPServer } from './mcp.js';
import { FakeWeb3Api, RealWeb3Api, type Web3Api } from './web3-api.js';
import { resolveToken, storeRpcUrl, WEB3_RPC_KEY } from './auth.js';

const MANIFEST_PATH = fileURLToPath(new URL('./techit.plugin.yaml', import.meta.url));

function envRpcUrl(): string | undefined {
  if (process.env.WEB3_RPC_URL) return process.env.WEB3_RPC_URL;
  if (process.env.ALCHEMY_API_KEY) return `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
  return undefined;
}

export interface Web3PluginOptions {
  runtime: SdkRuntime;
  registry: MCPRegistry;
  workspaceId: string;
  api?: Web3Api;
  manifestPath?: string;
}

export class Web3Plugin extends BasePlugin {
  connector!: Web3Connector;
  mcp!: Web3MCPServer;
  api!: Web3Api;

  constructor(
    manifest: PluginManifest,
    private readonly apiOverride: Web3Api | undefined,
    private readonly workspaceId: string,
    private readonly creds: WorkspaceCredentialHandle,
  ) {
    super(manifest);
  }

  protected override async authenticateImpl(secrets: ScopedSecrets): Promise<AuthToken> {
    // Reads are public; still store an RPC URL if one is configured via env so
    // the vault is the single source of truth for the real API selection.
    const existing = await secrets.get(WEB3_RPC_KEY);
    const url = envRpcUrl();
    if (!existing && url) {
      await storeRpcUrl(secrets, url);
    }
    return resolveToken(secrets);
  }

  private buildComponents(): void {
    this.api = this.apiOverride ?? this.selectApi();
    this.connector = new Web3Connector(this.runtime, this.secrets, this.api, this.workspaceId);
    this.mcp = new Web3MCPServer(this.runtime, this.manifest.mcp.tools, this.api, this.creds);
  }

  private selectApi(): Web3Api {
    const url = envRpcUrl();
    const real = process.env.WEB3_CONNECTOR_MODE === 'real' && !!url;
    if (real) {
      return new RealWeb3Api(async () => {
        const value = (await this.creds.value(WEB3_RPC_KEY)) ?? url ?? '';
        if (!value) throw new CredentialMissingError('web3');
        return value;
      });
    }
    return new FakeWeb3Api();
  }

  static async install(opts: Web3PluginOptions): Promise<Web3Plugin> {
    const manifest = loadManifest(opts.manifestPath ?? MANIFEST_PATH);
    const creds = new WorkspaceCredentialHandle(opts.runtime.vault, 'web3', manifest.auth.scopes);
    const plugin = new Web3Plugin(manifest, opts.api, opts.workspaceId, creds);
    await plugin.register(opts.runtime);
    plugin.buildComponents();
    opts.registry.register(manifest.name, plugin.mcp);
    return plugin;
  }
}

export async function registerWeb3Plugin(opts: Web3PluginOptions): Promise<Web3Plugin> {
  return Web3Plugin.install(opts);
}

export { Web3Connector } from './connector.js';
export { Web3MCPServer } from './mcp.js';
export { FakeWeb3Api, RealWeb3Api, type Web3Api } from './web3-api.js';
export { verifySiwe, parseSiweMessage } from './siwe.js';
