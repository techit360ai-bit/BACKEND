/**
 * AI-harness plugin entry point.
 *
 *   const plugin = await registerAiPlugin({ runtime, registry, workspaceId });
 *
 * Hybrid: uses RealAiHarnessApi (wraps the TechIT ai-router) when
 * AI_HARNESS_CONNECTOR_MODE is 'real' and an ai-router URL is available, else
 * FakeAiHarnessApi. `run_sandbox` is simulated in BOTH modes.
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
import { AiHarnessConnector } from './connector.js';
import { AiHarnessMCPServer } from './mcp.js';
import { FakeAiHarnessApi, RealAiHarnessApi, type AiHarnessApi } from './ai-api.js';
import { resolveToken, storeBaseUrl, storeToken, AI_BASE_URL_KEY, AI_TOKEN_KEY } from './auth.js';

const MANIFEST_PATH = fileURLToPath(new URL('./techit.plugin.yaml', import.meta.url));

function envBaseUrl(): string | undefined {
  return process.env.AI_ROUTER_URL || undefined;
}

export interface AiPluginOptions {
  runtime: SdkRuntime;
  registry: MCPRegistry;
  workspaceId: string;
  /** Override for the AI harness API (defaults to the in-memory fake). */
  api?: AiHarnessApi;
  manifestPath?: string;
}

export class AiPlugin extends BasePlugin {
  connector!: AiHarnessConnector;
  mcp!: AiHarnessMCPServer;
  api!: AiHarnessApi;

  constructor(
    manifest: PluginManifest,
    private readonly apiOverride: AiHarnessApi | undefined,
    private readonly workspaceId: string,
    private readonly creds: WorkspaceCredentialHandle,
  ) {
    super(manifest);
  }

  protected override async authenticateImpl(secrets: ScopedSecrets): Promise<AuthToken> {
    // Persist env-provided ai-router URL / token into the vault so the vault is
    // the single source of truth for real-API selection.
    const url = envBaseUrl();
    if (url && !(await secrets.get(AI_BASE_URL_KEY))) {
      await storeBaseUrl(secrets, url);
    }
    if (process.env.AI_ROUTER_TOKEN && !(await secrets.get(AI_TOKEN_KEY))) {
      await storeToken(secrets, process.env.AI_ROUTER_TOKEN);
    }
    return resolveToken(secrets);
  }

  private buildComponents(): void {
    this.api = this.apiOverride ?? this.selectApi();
    this.connector = new AiHarnessConnector(this.runtime, this.secrets, this.api, this.workspaceId);
    this.mcp = new AiHarnessMCPServer(this.runtime, this.manifest.mcp.tools, this.api, this.creds);
  }

  private selectApi(): AiHarnessApi {
    // Real mode is selected by the connector mode alone (ADR-3): the base URL is
    // resolved from the canonical vault lane at call time.
    const real = process.env.AI_HARNESS_CONNECTOR_MODE === 'real';
    if (real) {
      return new RealAiHarnessApi(
        // Base URL is required → token() denies cleanly when it is absent.
        async () => this.creds.token(AI_BASE_URL_KEY),
        // ai-router token is optional for this connector → value() may be empty.
        async () => (await this.creds.value(AI_TOKEN_KEY)) ?? '',
      );
    }
    return new FakeAiHarnessApi();
  }

  static async install(opts: AiPluginOptions): Promise<AiPlugin> {
    const manifest = loadManifest(opts.manifestPath ?? MANIFEST_PATH);
    const creds = new WorkspaceCredentialHandle(opts.runtime.vault, 'ai', manifest.auth.scopes);
    const plugin = new AiPlugin(manifest, opts.api, opts.workspaceId, creds);
    await plugin.register(opts.runtime);
    plugin.buildComponents();
    opts.registry.register(manifest.name, plugin.mcp);
    return plugin;
  }
}

export async function registerAiPlugin(opts: AiPluginOptions): Promise<AiPlugin> {
  return AiPlugin.install(opts);
}

export { AiHarnessConnector } from './connector.js';
export { AiHarnessMCPServer } from './mcp.js';
export {
  FakeAiHarnessApi,
  RealAiHarnessApi,
  type AiHarnessApi,
  type GenerateResult,
  type ReviewResult,
  type ResearchResult,
  type SandboxResult,
} from './ai-api.js';
