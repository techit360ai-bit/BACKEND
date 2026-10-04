/**
 * Notion plugin entry point.
 *
 *   const plugin = await registerNotionPlugin({ runtime, registry, workspaceId });
 *
 * Builds the connector + MCP server bound to the plugin's scoped secrets, runs
 * the lifecycle (register → authenticate → ready) and registers the MCP server
 * with the client registry. Hybrid: uses RealNotionApi when NOTION_CONNECTOR_MODE
 * is 'real' (and a token is present), else the in-memory FakeNotionApi.
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
import { NotionConnector } from './connector.js';
import { NotionMCPServer } from './mcp.js';
import { FakeNotionApi, RealNotionApi, type NotionApi } from './notion-api.js';
import { resolveToken, storeToken, NOTION_TOKEN_KEY } from './auth.js';

const MANIFEST_PATH = fileURLToPath(new URL('./techit.plugin.yaml', import.meta.url));

export interface NotionPluginOptions {
  runtime: SdkRuntime;
  registry: MCPRegistry;
  workspaceId: string;
  /** Override the API (defaults to real-or-fake selection). */
  api?: NotionApi;
  manifestPath?: string;
}

export class NotionPlugin extends BasePlugin {
  connector!: NotionConnector;
  mcp!: NotionMCPServer;
  api!: NotionApi;

  constructor(
    manifest: PluginManifest,
    private readonly apiOverride: NotionApi | undefined,
    private readonly workspaceId: string,
    private readonly creds: WorkspaceCredentialHandle,
  ) {
    super(manifest);
  }

  protected override async authenticateImpl(secrets: ScopedSecrets): Promise<AuthToken> {
    // Dev convenience: seed a placeholder token so the lifecycle reaches `ready`
    // without a live connect step. Production stores a real integration token.
    const existing = await secrets.get(NOTION_TOKEN_KEY);
    if (!existing) {
      await storeToken(secrets, process.env.NOTION_TOKEN || 'dev-notion-token');
    }
    return resolveToken(secrets);
  }

  private buildComponents(): void {
    this.api = this.apiOverride ?? this.selectApi();
    this.connector = new NotionConnector(this.runtime, this.secrets, this.api, this.workspaceId);
    this.mcp = new NotionMCPServer(this.runtime, this.manifest.mcp.tools, this.api, this.creds);
  }

  private selectApi(): NotionApi {
    const real = process.env.NOTION_CONNECTOR_MODE === 'real' && !!process.env.NOTION_TOKEN;
    if (real) {
      return new RealNotionApi(async () => {
        const token = await this.creds.value(NOTION_TOKEN_KEY);
        if (!token) throw new CredentialMissingError('notion');
        return token;
      });
    }
    return new FakeNotionApi();
  }

  static async install(opts: NotionPluginOptions): Promise<NotionPlugin> {
    const manifest = loadManifest(opts.manifestPath ?? MANIFEST_PATH);
    const creds = new WorkspaceCredentialHandle(opts.runtime.vault, 'notion');
    const plugin = new NotionPlugin(manifest, opts.api, opts.workspaceId, creds);
    await plugin.register(opts.runtime);
    plugin.buildComponents();
    opts.registry.register(manifest.name, plugin.mcp);
    return plugin;
  }
}

export async function registerNotionPlugin(opts: NotionPluginOptions): Promise<NotionPlugin> {
  return NotionPlugin.install(opts);
}

export { NotionConnector } from './connector.js';
export { NotionMCPServer } from './mcp.js';
export { FakeNotionApi, RealNotionApi, type NotionApi } from './notion-api.js';
