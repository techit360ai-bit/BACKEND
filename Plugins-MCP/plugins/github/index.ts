/**
 * GitHub plugin entry point.
 *
 *   const plugin = await registerGithubPlugin({ runtime, registry, workspaceId });
 *
 * Builds the connector + MCP server bound to the plugin's scoped secrets, runs
 * the lifecycle (register → authenticate → ready) and registers the MCP server
 * with the client registry. Adding GitHub to the agent runtime = this one call.
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
import { GitHubConnector } from './connector.js';
import { GitHubMCPServer } from './mcp.js';
import { FakeGitHubApi, RealGitHubApi, type GitHubApi } from './github-api.js';
import { StubOAuthExchange, resolveToken, storeToken, type OAuthExchange } from './auth.js';
import { GITHUB_TOKEN_KEY } from './auth.js';

const MANIFEST_PATH = fileURLToPath(new URL('./techit.plugin.yaml', import.meta.url));

export interface GithubPluginOptions {
  runtime: SdkRuntime;
  registry: MCPRegistry;
  workspaceId: string;
  /** Override for real GitHub API (defaults to in-memory fake). */
  api?: GitHubApi;
  /** Override for the real OAuth token exchange (defaults to a stub). */
  oauth?: OAuthExchange;
  manifestPath?: string;
}

export class GitHubPlugin extends BasePlugin {
  connector!: GitHubConnector;
  mcp!: GitHubMCPServer;

  constructor(
    manifest: PluginManifest,
    private readonly api: GitHubApi,
    private readonly oauth: OAuthExchange,
    private readonly workspaceId: string,
    private readonly creds: WorkspaceCredentialHandle,
  ) {
    super(manifest);
  }

  protected override async authenticateImpl(secrets: ScopedSecrets): Promise<AuthToken> {
    // Boot MUST NOT require a credential: credentials are per-workspace (ADR-1)
    // and resolved lazily at invoke time from the canonical vault lane. Dev
    // convenience only: seed a throwaway token so a local lifecycle reaches
    // `ready`. Production boots with an empty vault and fails closed per request.
    const existing = await secrets.get(GITHUB_TOKEN_KEY);
    if (!existing && !['production', 'staging'].includes((process.env.NODE_ENV || '').toLowerCase())) {
      await storeToken(secrets, this.oauth, 'devcode');
    }
    const lease = await secrets.get(GITHUB_TOKEN_KEY);
    return { accessToken: lease?.value ?? '', tokenType: 'bearer', scopes: [], expiresAt: lease?.expiresAt };
  }

  /** Build connector + MCP server once secrets are bound. */
  private buildComponents(): void {
    this.connector = new GitHubConnector(this.runtime, this.secrets, this.api, this.workspaceId);
    this.mcp = new GitHubMCPServer(this.runtime, this.manifest.mcp.tools, this.api, this.creds);
  }

  static async install(opts: GithubPluginOptions): Promise<GitHubPlugin> {
    const manifest = loadManifest(opts.manifestPath ?? MANIFEST_PATH);
    // Workspace-scoped credential handle (ADR-1): the acting workspace is set
    // on bind() and the real API resolves the CANONICAL lane from it.
    const creds = new WorkspaceCredentialHandle(opts.runtime.vault, 'github', manifest.auth.scopes);
    const plugin = new GitHubPlugin(
      manifest,
      opts.api ?? (process.env.GITHUB_CONNECTOR_MODE === 'real'
        ? new RealGitHubApi(async () => {
            // token() enforces provider + scope at resolve time: missing
            // credential → CredentialMissingError; recorded-but-insufficient
            // scopes → ScopeInsufficientError.
            return creds.token(GITHUB_TOKEN_KEY);
          })
        : new FakeGitHubApi()),
      opts.oauth ?? new StubOAuthExchange(),
      opts.workspaceId,
      creds,
    );
    await plugin.register(opts.runtime);
    plugin.buildComponents();
    opts.registry.register(manifest.name, plugin.mcp);
    return plugin;
  }
}

export async function registerGithubPlugin(opts: GithubPluginOptions): Promise<GitHubPlugin> {
  return GitHubPlugin.install(opts);
}

export { GitHubConnector } from './connector.js';
export { GitHubMCPServer } from './mcp.js';
export { parseWebhook, type TechitEvent } from './webhook.js';
export { FakeGitHubApi, RealGitHubApi, type GitHubApi } from './github-api.js';
