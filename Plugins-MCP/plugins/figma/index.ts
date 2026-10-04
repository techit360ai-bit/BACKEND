/**
 * Figma plugin entry point.
 *
 *   const plugin = await registerFigmaPlugin({ runtime, registry, workspaceId });
 *
 * Hybrid: uses RealFigmaApi when FIGMA_CONNECTOR_MODE is 'real' (and a token is
 * present), else the in-memory FakeFigmaApi.
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
} from '@techit/plugin-sdk';
import type { ScopedSecrets } from '@techit/infra-secrets';
import { FigmaConnector } from './connector.js';
import { FigmaMCPServer } from './mcp.js';
import { FakeFigmaApi, RealFigmaApi, type FigmaApi } from './figma-api.js';
import { resolveToken, storeToken, FIGMA_TOKEN_KEY } from './auth.js';

const MANIFEST_PATH = fileURLToPath(new URL('./techit.plugin.yaml', import.meta.url));

export interface FigmaPluginOptions {
  runtime: SdkRuntime;
  registry: MCPRegistry;
  workspaceId: string;
  api?: FigmaApi;
  manifestPath?: string;
}

export class FigmaPlugin extends BasePlugin {
  connector!: FigmaConnector;
  mcp!: FigmaMCPServer;
  api!: FigmaApi;

  constructor(
    manifest: PluginManifest,
    private readonly apiOverride: FigmaApi | undefined,
    private readonly workspaceId: string,
    private readonly creds: WorkspaceCredentialHandle,
  ) {
    super(manifest);
  }

  protected override async authenticateImpl(secrets: ScopedSecrets): Promise<AuthToken> {
    const existing = await secrets.get(FIGMA_TOKEN_KEY);
    if (!existing) {
      await storeToken(secrets, process.env.FIGMA_TOKEN || 'dev-figma-token');
    }
    return resolveToken(secrets);
  }

  private buildComponents(): void {
    this.api = this.apiOverride ?? this.selectApi();
    this.connector = new FigmaConnector(this.runtime, this.secrets, this.api, this.workspaceId);
    this.mcp = new FigmaMCPServer(this.runtime, this.manifest.mcp.tools, this.api, this.creds);
  }

  private selectApi(): FigmaApi {
    const real = process.env.FIGMA_CONNECTOR_MODE === 'real' && !!process.env.FIGMA_TOKEN;
    if (real) {
      return new RealFigmaApi(async () => {
        return (await this.creds.value(FIGMA_TOKEN_KEY)) ?? '';
      });
    }
    return new FakeFigmaApi();
  }

  static async install(opts: FigmaPluginOptions): Promise<FigmaPlugin> {
    const manifest = loadManifest(opts.manifestPath ?? MANIFEST_PATH);
    const creds = new WorkspaceCredentialHandle(opts.runtime.vault, 'figma');
    const plugin = new FigmaPlugin(manifest, opts.api, opts.workspaceId, creds);
    await plugin.register(opts.runtime);
    plugin.buildComponents();
    opts.registry.register(manifest.name, plugin.mcp);
    return plugin;
  }
}

export async function registerFigmaPlugin(opts: FigmaPluginOptions): Promise<FigmaPlugin> {
  return FigmaPlugin.install(opts);
}

export { FigmaConnector } from './connector.js';
export { FigmaMCPServer } from './mcp.js';
export { FakeFigmaApi, RealFigmaApi, type FigmaApi } from './figma-api.js';
